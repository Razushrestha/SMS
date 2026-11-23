import type { SubscriptionSnapshot } from "../plan/subscription";
import { evaluateSubscription } from "../plan/subscription";

export type CachedAuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  studentId: string | null;
  instituteName: string;
};

type PlanFields = {
  planName: string;
  status: string;
  expiresOn: string | null;
};

type CacheEntry = {
  user: CachedAuthUser;
  plan: PlanFields | null;
  expiresAt: number;
};

const TTL_MS = 45_000;
const MAX_ENTRIES = 5_000;

const byToken = new Map<string, CacheEntry>();

function prune(now = Date.now()) {
  for (const [key, entry] of byToken) {
    if (entry.expiresAt <= now) byToken.delete(key);
  }
  if (byToken.size <= MAX_ENTRIES) return;
  const overflow = byToken.size - MAX_ENTRIES;
  let removed = 0;
  for (const key of byToken.keys()) {
    byToken.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function getCachedAuth(tokenHash: string): {
  user: CachedAuthUser;
  subscription: SubscriptionSnapshot | null;
} | null {
  const entry = byToken.get(tokenHash);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    byToken.delete(tokenHash);
    return null;
  }
  return {
    user: entry.user,
    subscription: entry.plan
      ? evaluateSubscription({
          planName: entry.plan.planName,
          status: entry.plan.status,
          expiresOn: entry.plan.expiresOn,
        })
      : null,
  };
}

export function setCachedAuth(
  tokenHash: string,
  user: CachedAuthUser,
  plan: PlanFields | null,
) {
  prune();
  byToken.set(tokenHash, {
    user,
    plan,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function invalidateSessionToken(tokenHash: string | undefined) {
  if (!tokenHash) return;
  byToken.delete(tokenHash);
}

export function invalidateSessionsForUser(userId: string) {
  for (const [key, entry] of byToken) {
    if (entry.user.id === userId) byToken.delete(key);
  }
}

export function invalidateSessionsForTenant(tenantId: string) {
  for (const [key, entry] of byToken) {
    if (entry.user.tenantId === tenantId) byToken.delete(key);
  }
}
