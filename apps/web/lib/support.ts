const DEFAULT_SUPPORT_EMAIL = "platform@nepatronix.test";

export function supportEmail() {
  const fromEnv = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return fromEnv || DEFAULT_SUPPORT_EMAIL;
}

export function contactNepatronixMailto(input?: {
  schoolName?: string | null;
  planHealth?: string | null;
  topic?: string;
}) {
  const school = input?.schoolName?.trim() || "our school";
  const topic = input?.topic?.trim() || "Subscription help";
  const health = input?.planHealth?.trim();
  const subject = `${topic} — ${school}`;
  const body = [
    "Hello NEPATRONIX,",
    "",
    `We need help with ${school}'s NEPATRONIX SMS subscription.`,
    health ? `Current status: ${health}.` : null,
    "",
    "Details:",
    "",
    "Thanks,",
  ]
    .filter((line) => line !== null)
    .join("\n");
  return `mailto:${encodeURIComponent(supportEmail())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
