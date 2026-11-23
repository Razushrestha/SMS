"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Field, control } from "@/components/auth-card";
import { api } from "@/lib/api";

type Onboarding = {
  completed: number;
  total: number;
  percent: number;
  complete: boolean;
  steps: Array<{ id: string; label: string; done: boolean }>;
};

type School = {
  tenantId: string;
  instituteName: string;
  phone: string;
  country: string;
  planName: string;
  status: string;
  expiresOn: string | null;
  notes: string | null;
  health: string;
  readers: number;
  readerQuota: number;
  cards: number;
  cardQuota: number;
  vehicles: number;
  vehicleQuota: number;
  assistantTokenQuota: number;
  students: number;
  smsBalance: number;
  admin: { name: string; email: string; emailVerified: boolean } | null;
  onboarding?: Onboarding;
};

type Invite = {
  to: string;
  subject: string;
  body: string;
  mailto: string;
  passwordIncluded?: boolean;
};

type Activity = {
  id: string;
  actorName: string;
  label: string;
  detail: string;
  createdAt: string;
};

export default function PlatformSchoolPage() {
  const params = useParams<{ tenantId: string }>();
  const [school, setSchool] = useState<School | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [supportPending, setSupportPending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [invitePending, setInvitePending] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);

  function loadActivity(tenantId: string) {
    api<Activity[]>(`/platform/activity?tenantId=${encodeURIComponent(tenantId)}`)
      .then(setActivity)
      .catch(() => setActivity([]));
  }

  useEffect(() => {
    api<School>(`/platform/schools/${params.tenantId}`)
      .then(setSchool)
      .catch((err: Error) => setError(err.message));
    loadActivity(params.tenantId);
    try {
      const key = `nepatronix-invite-${params.tenantId}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        setInvite(JSON.parse(raw) as Invite);
        sessionStorage.removeItem(key);
        setNote("Welcome invite ready — copy and send to the school admin.");
      }
    } catch {
      /* ignore */
    }
  }, [params.tenantId]);

  async function prepareInvite(resetPassword: boolean) {
    if (!school) return;
    if (resetPassword && !window.confirm("Reset the admin password and include a new temporary password in the invite?")) return;
    setError("");
    setNote("");
    setInvitePending(true);
    try {
      const result = await api<Invite>(`/platform/schools/${school.tenantId}/invite`, {
        method: "POST",
        body: JSON.stringify({ resetPassword }),
      });
      setInvite(result);
      setNote(resetPassword ? "Invite ready with a new temporary password." : "Invite ready (no password change).");
      setSchool(await api<School>(`/platform/schools/${school.tenantId}`));
      loadActivity(school.tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare invite");
    } finally {
      setInvitePending(false);
    }
  }

  async function setStatus(action: "suspend" | "reactivate" | "archive") {
    if (!school) return;
    if (action === "archive" && !window.confirm(`Archive “${school.instituteName}”? Login will be blocked until reactivated.`)) return;
    setError("");
    setNote("");
    setActionPending(true);
    try {
      setSchool(
        await api<School>(`/platform/schools/${school.tenantId}/status`, {
          method: "POST",
          body: JSON.stringify({ action }),
        }),
      );
      setNote(action === "suspend" ? "School suspended." : action === "archive" ? "School archived." : "School reactivated.");
      loadActivity(school.tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setActionPending(false);
    }
  }

  async function removeSchool() {
    if (!school) return;
    if (!window.confirm(`Delete empty school “${school.instituteName}”? This cannot be undone.`)) return;
    setError("");
    setNote("");
    setActionPending(true);
    try {
      await api(`/platform/schools/${school.tenantId}`, { method: "DELETE" });
      setDeleted(true);
      setNote("School deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete school");
    } finally {
      setActionPending(false);
    }
  }

  async function extend(days: 30 | 365) {
    if (!school) return;
    setError("");
    setNote("");
    setActionPending(true);
    try {
      setSchool(
        await api<School>(`/platform/schools/${school.tenantId}/extend`, {
          method: "POST",
          body: JSON.stringify({ days }),
        }),
      );
      setNote(days === 365 ? "Renewed for 365 days (status set active)." : "Extended by 30 days.");
      loadActivity(school.tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extend subscription");
    } finally {
      setActionPending(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!school) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      setSchool(
        await api<School>(`/platform/schools/${school.tenantId}`, {
          method: "PATCH",
          body: JSON.stringify({
            planName: data.get("planName"),
            status: data.get("status"),
            expiresOn: data.get("expiresOn") || null,
            notes: data.get("notes"),
            readerQuota: Number(data.get("readerQuota")),
            cardQuota: Number(data.get("cardQuota")),
            vehicleQuota: Number(data.get("vehicleQuota")),
            assistantTokenQuota: Number(data.get("assistantTokenQuota")),
          }),
        }),
      );
      setNote("Subscription saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function topUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!school) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      setSchool(
        await api<School>(`/platform/schools/${school.tenantId}/sms-topup`, {
          method: "POST",
          body: JSON.stringify({ amount: Number(data.get("amount")) }),
        }),
      );
      setNote("SMS credits added.");
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not top up SMS");
    }
  }

  async function issueSupportLogin() {
    if (!school) return;
    setError("");
    setNote("");
    setSupportUrl("");
    setSupportPending(true);
    try {
      const result = await api<{ url: string; expiresAt: string; admin: { email: string } }>(
        `/platform/schools/${school.tenantId}/support-login`,
        { method: "POST" },
      );
      setSupportUrl(result.url);
      setNote(`Support link ready for ${result.admin.email}. Expires ${new Date(result.expiresAt).toLocaleString()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue support login");
    } finally {
      setSupportPending(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!school) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      const result = await api<{ message: string; admin: { email: string } }>(
        `/platform/schools/${school.tenantId}/reset-admin-password`,
        {
          method: "POST",
          body: JSON.stringify({ password: data.get("password") }),
        },
      );
      setNote(`${result.message} (${result.admin.email})`);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    }
  }

  if (deleted) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--esk-purple)]">{note || "School deleted."}</p>
        <Link className="esk-btn-primary inline-flex" href="/platform">
          Back to schools
        </Link>
      </div>
    );
  }

  if (!school && !error) return <p className="text-sm text-[var(--esk-muted)]">Loading school…</p>;
  if (!school) return <p className="text-sm text-red-600">{error}</p>;

  const canDelete = school.students === 0 && school.readers === 0 && school.vehicles === 0 && school.cards === 0;
  const isArchived = school.status === "cancelled" || school.health === "cancelled";
  const isSuspended = school.status === "suspended" || school.health === "suspended";
  const onboarding = school.onboarding;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link className="text-sm text-[var(--esk-muted)] hover:underline" href="/platform">
            ← Schools
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{school.instituteName}</h1>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">
            {school.country} · {school.phone} · {school.students} students · health {school.health}
            {isArchived ? " · archived" : ""}
            {onboarding ? ` · onboarding ${onboarding.completed}/${onboarding.total}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isArchived || isSuspended ? (
            <button className="esk-btn-primary" type="button" disabled={actionPending} onClick={() => void setStatus("reactivate")}>
              <i className="fa-light fa-play" /> Reactivate
            </button>
          ) : (
            <>
              <button className="esk-btn-ghost" type="button" disabled={actionPending} onClick={() => void setStatus("suspend")}>
                <i className="fa-light fa-ban" /> Suspend
              </button>
              <button className="esk-btn-ghost" type="button" disabled={actionPending} onClick={() => void setStatus("archive")}>
                <i className="fa-light fa-box-archive" /> Archive
              </button>
            </>
          )}
          {canDelete ? (
            <button className="esk-btn-ghost text-rose-700" type="button" disabled={actionPending} onClick={() => void removeSchool()}>
              <i className="fa-light fa-trash" /> Delete empty school
            </button>
          ) : null}
          {school.admin ? (
            <div className="rounded-lg border border-black/5 bg-white px-3 py-2 text-sm shadow-sm">
              <div className="text-xs uppercase tracking-wide text-[var(--esk-muted)]">School admin</div>
              <div>{school.admin.name}</div>
              <div className="text-[var(--esk-muted)]">{school.admin.email}</div>
            </div>
          ) : null}
        </div>
      </div>

      {onboarding ? (
        <div className="esk-panel max-w-3xl space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Onboarding checklist</h2>
              <p className="text-sm text-[var(--esk-muted)]">
                {onboarding.complete
                  ? "This school has completed the setup checklist."
                  : "Track setup after create — invite the admin, then confirm classes, staff, students, and devices."}
              </p>
            </div>
            <div className="text-sm font-medium">{onboarding.percent}%</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-[var(--esk-purple)]" style={{ width: `${onboarding.percent}%` }} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {onboarding.steps.map((step) => (
              <li
                key={step.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  step.done ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-black/5 bg-black/[0.02] text-[var(--esk-muted)]"
                }`}
              >
                <i className={`fa-light ${step.done ? "fa-circle-check" : "fa-circle"} mr-2`} />
                {step.label}
              </li>
            ))}
          </ul>
          {!onboarding.steps.find((step) => step.id === "invite")?.done && school.admin ? (
            <p className="text-sm text-[var(--esk-muted)]">Next: prepare the admin invite below so the school can sign in.</p>
          ) : null}
        </div>
      ) : null}

      <form className="esk-panel max-w-3xl space-y-4" onSubmit={save} key={`${school.status}-${school.expiresOn}-${school.planName}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Subscription</h2>
          {!isArchived && !isSuspended ? (
            <div className="flex flex-wrap gap-2">
              <button className="esk-btn-ghost" type="button" disabled={actionPending} onClick={() => void extend(30)}>
                <i className="fa-light fa-calendar-plus" /> +30 days
              </button>
              <button className="esk-btn-ghost" type="button" disabled={actionPending} onClick={() => void extend(365)}>
                <i className="fa-light fa-calendar-check" /> Renew +365
              </button>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan name">
            <input className={control} name="planName" defaultValue={school.planName} required />
          </Field>
          <Field label="Status">
            <select className={control} name="status" defaultValue={school.status} required>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="past_due">Past due</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Expires on">
            <input className={control} name="expiresOn" type="date" defaultValue={school.expiresOn ?? ""} />
          </Field>
          <Field label="Current SMS balance">
            <input className={control} value={school.smsBalance} readOnly />
          </Field>
        </div>
        <Field label="Internal notes">
          <textarea className={control} name="notes" rows={3} defaultValue={school.notes ?? ""} />
        </Field>

        <h2 className="pt-2 text-lg font-semibold">Quotas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Readers in use ${school.readers}`}>
            <input className={control} name="readerQuota" type="number" min={1} defaultValue={school.readerQuota} required />
          </Field>
          <Field label={`Cards in use ${school.cards}`}>
            <input className={control} name="cardQuota" type="number" min={1} defaultValue={school.cardQuota} required />
          </Field>
          <Field label={`Vehicles in use ${school.vehicles}`}>
            <input className={control} name="vehicleQuota" type="number" min={1} defaultValue={school.vehicleQuota} required />
          </Field>
          <Field label="Adam tokens / month">
            <input className={control} name="assistantTokenQuota" type="number" min={1} defaultValue={school.assistantTokenQuota} required />
          </Field>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {note ? <p className="text-sm text-[var(--esk-purple)]">{note}</p> : null}
        <button className="esk-btn-primary" type="submit">
          <i className="fa-light fa-check" /> Save subscription
        </button>
      </form>

      <form className="esk-panel max-w-3xl space-y-4" onSubmit={topUp}>
        <h2 className="text-lg font-semibold">SMS top-up</h2>
        <p className="text-sm text-[var(--esk-muted)]">Add credits to this school’s SMS balance. Current balance {school.smsBalance}.</p>
        <div className="grid max-w-sm gap-3">
          <Field label="Credits to add">
            <input className={control} name="amount" type="number" min={1} defaultValue={100} required />
          </Field>
        </div>
        <button className="esk-btn-primary" type="submit">
          <i className="fa-light fa-plus" /> Add SMS credits
        </button>
      </form>

      <div className="esk-panel max-w-3xl space-y-4">
        <h2 className="text-lg font-semibold">Admin invite</h2>
        <p className="text-sm text-[var(--esk-muted)]">
          No mail gateway is connected. Prepare a welcome email stub you can copy or open in your mail client.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="esk-btn-primary" type="button" disabled={!school.admin || invitePending} onClick={() => void prepareInvite(false)}>
            <i className="fa-light fa-envelope" /> {invitePending ? "Preparing…" : "Prepare invite"}
          </button>
          <button className="esk-btn-ghost" type="button" disabled={!school.admin || invitePending} onClick={() => void prepareInvite(true)}>
            <i className="fa-light fa-key" /> Reset password &amp; invite
          </button>
          {invite ? (
            <>
              <button
                className="esk-btn-ghost"
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(`${invite.subject}\n\n${invite.body}`).then(() => setNote("Invite copied."))
                }
              >
                Copy invite
              </button>
              <a className="esk-btn-ghost" href={invite.mailto}>
                Open mail app
              </a>
            </>
          ) : null}
        </div>
        {invite ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-black/5 bg-black/[0.02] p-3 text-xs text-[var(--esk-navy)]">
            To: {invite.to}
            {"\n"}
            Subject: {invite.subject}
            {"\n\n"}
            {invite.body}
          </pre>
        ) : null}
      </div>

      <div className="esk-panel max-w-3xl space-y-4">
        <h2 className="text-lg font-semibold">Support login</h2>
        <p className="text-sm text-[var(--esk-muted)]">
          Issue a one-time link that signs in as the school admin for 15 minutes. Use it for support without changing their password.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="esk-btn-primary" type="button" onClick={() => void issueSupportLogin()} disabled={!school.admin || supportPending}>
            <i className="fa-light fa-life-ring" /> {supportPending ? "Issuing…" : "Create support link"}
          </button>
          {supportUrl ? (
            <>
              <a className="esk-btn-ghost" href={supportUrl} target="_blank" rel="noreferrer">
                Open link
              </a>
              <button
                className="esk-btn-ghost"
                type="button"
                onClick={() => void navigator.clipboard.writeText(supportUrl).then(() => setNote("Support link copied."))}
              >
                Copy link
              </button>
            </>
          ) : null}
        </div>
        {supportUrl ? <p className="break-all text-xs text-[var(--esk-muted)]">{supportUrl}</p> : null}
      </div>

      <form className="esk-panel max-w-3xl space-y-4" onSubmit={resetPassword}>
        <h2 className="text-lg font-semibold">Reset admin password</h2>
        <p className="text-sm text-[var(--esk-muted)]">
          {school.admin
            ? `Sets a new password for ${school.admin.email}.`
            : "No school admin found for this tenant."}
        </p>
        <div className="grid max-w-sm gap-3">
          <Field label="New password">
            <input className={control} name="password" type="text" minLength={6} required disabled={!school.admin} />
          </Field>
        </div>
        <button className="esk-btn-primary" type="submit" disabled={!school.admin}>
          <i className="fa-light fa-key" /> Update password
        </button>
      </form>

      <div className="esk-panel max-w-3xl space-y-3">
        <h2 className="text-lg font-semibold">Platform activity for this school</h2>
        <p className="text-sm text-[var(--esk-muted)]">Subscription changes, SMS top-ups, invites, and support actions.</p>
        <ul className="divide-y divide-black/5 rounded-lg border border-black/5">
          {activity.map((row) => (
            <li key={row.id} className="px-3 py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{row.label}</span>
                <time className="text-xs text-[var(--esk-muted)]">{new Date(row.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-[var(--esk-muted)]">
                {row.actorName}: {row.detail}
              </p>
            </li>
          ))}
          {!activity.length ? <li className="px-3 py-4 text-sm text-[var(--esk-muted)]">No platform actions for this school yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
