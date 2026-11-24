export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type SubscriptionSnapshot = {
  planName: string;
  status: string;
  expiresOn: string | null;
  health: "ok" | "trial" | "expiring" | "past_due" | "expired" | "suspended" | "cancelled";
  blocked: boolean;
  message: string | null;
};

export type SessionUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  instituteName: string;
  studentId?: string | null;
  subscription?: SubscriptionSnapshot | null;
  supportSession?: boolean;
};

export type PortalStudent = {
  id: string;
  registrationNo: string;
  name: string;
  classId: string;
  className: string;
  status: string;
};

export type Institute = {
  tenantId: string;
  name: string;
  targetLine: string;
  phone: string;
  website: string | null;
  address: string;
  country: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  currencySymbol: string;
  logoUrl: string | null;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    throw new Error(message || "Request failed");
  }
  return data as T;
}
