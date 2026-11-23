import { tenantPlans, type Database } from "@nepatronix/db";
import { eq } from "drizzle-orm";

export type SubscriptionSnapshot = {
  planName: string;
  status: string;
  expiresOn: string | null;
  health: "ok" | "trial" | "expiring" | "past_due" | "expired" | "suspended" | "cancelled";
  blocked: boolean;
  message: string | null;
};

const EXPIRING_SOON_DAYS = 14;

export function evaluateSubscription(input: {
  planName?: string | null;
  status: string;
  expiresOn: string | null;
}): SubscriptionSnapshot {
  const planName = input.planName?.trim() || "Core";
  const expiresOn = input.expiresOn ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const expired = Boolean(expiresOn && expiresOn < today);
  const daysLeft = expiresOn ? daysBetween(today, expiresOn) : null;
  const expiringSoon = Boolean(daysLeft !== null && daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS);

  let health: SubscriptionSnapshot["health"] = "ok";
  if (input.status === "suspended") health = "suspended";
  else if (input.status === "cancelled") health = "cancelled";
  else if (input.status === "past_due") health = "past_due";
  else if (expired) health = "expired";
  else if (expiringSoon) health = "expiring";
  else if (input.status === "trial") health = "trial";

  const blocked = health === "suspended" || health === "cancelled" || health === "expired";
  return {
    planName,
    status: input.status,
    expiresOn,
    health,
    blocked,
    message: messageFor(health, expiresOn, daysLeft),
  };
}

export async function loadSubscription(db: Database, tenantId: string): Promise<SubscriptionSnapshot> {
  const [row] = await db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, tenantId)).limit(1);
  if (!row) {
    return evaluateSubscription({ planName: "Core", status: "trial", expiresOn: null });
  }
  return evaluateSubscription({
    planName: row.planName,
    status: row.status,
    expiresOn: row.expiresOn,
  });
}

export function subscriptionAllowsPath(method: string, path: string) {
  const clean = path.replace(/^\/api/, "").split("?")[0] || "/";
  if (clean === "/auth/me" || clean === "/auth/logout") return true;
  if (method === "GET" && (clean === "/plan" || clean === "/institute" || clean === "/institute/preferences")) return true;
  return false;
}

export function isNearQuota(input: {
  readers: number;
  readerQuota: number;
  cards: number;
  cardQuota: number;
  vehicles: number;
  vehicleQuota: number;
  smsBalance: number;
}) {
  const ratio = (used: number, quota: number) => (quota > 0 ? used / quota : 0);
  return (
    ratio(input.readers, input.readerQuota) >= 0.9 ||
    ratio(input.cards, input.cardQuota) >= 0.9 ||
    ratio(input.vehicles, input.vehicleQuota) >= 0.9 ||
    input.smsBalance <= 20
  );
}

export function nearQuotaMessage(input: {
  readers: number;
  readerQuota: number;
  cards: number;
  cardQuota: number;
  vehicles: number;
  vehicleQuota: number;
  smsBalance: number;
}) {
  if (!isNearQuota(input)) return null;
  const parts: string[] = [];
  const tight = (used: number, quota: number, label: string) => {
    if (quota > 0 && used / quota >= 0.9) parts.push(`${label} ${used}/${quota}`);
  };
  tight(input.readers, input.readerQuota, "readers");
  tight(input.cards, input.cardQuota, "cards");
  tight(input.vehicles, input.vehicleQuota, "vehicles");
  if (input.smsBalance <= 20) parts.push(`SMS ${input.smsBalance}`);
  return `Approaching plan limits (${parts.join(", ")}). Contact NEPATRONIX to raise quotas or top up SMS.`;
}

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function messageFor(health: SubscriptionSnapshot["health"], expiresOn: string | null, daysLeft: number | null) {
  if (health === "suspended") return "This school's subscription is suspended. Contact NEPATRONIX to restore access.";
  if (health === "cancelled") return "This school's subscription is cancelled. Contact NEPATRONIX to renew.";
  if (health === "expired") {
    return expiresOn
      ? `This school's subscription expired on ${expiresOn}. Contact NEPATRONIX to renew.`
      : "This school's subscription has expired. Contact NEPATRONIX to renew.";
  }
  if (health === "past_due") return "Payment is past due. Update billing with NEPATRONIX to avoid suspension.";
  if (health === "expiring") {
    const when = expiresOn ?? "soon";
    if (daysLeft === 0) return `Subscription expires today (${when}). Contact NEPATRONIX to renew.`;
    if (daysLeft === 1) return `Subscription expires tomorrow (${when}). Contact NEPATRONIX to renew.`;
    return `Subscription expires in ${daysLeft} days (${when}). Contact NEPATRONIX to renew.`;
  }
  if (health === "trial") {
    return expiresOn ? `Trial plan — access until ${expiresOn}.` : "You are on a trial plan.";
  }
  return null;
}
