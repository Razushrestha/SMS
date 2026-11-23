"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { contactNepatronixMailto, supportEmail } from "@/lib/support";

type Plan = {
  name: string;
  status: string;
  expiresOn: string | null;
  health: string;
  blocked?: boolean;
  message?: string | null;
  notes: string | null;
  addons: string[];
  readers: number;
  readerQuota: number;
  cards: number;
  cardQuota: number;
  vehicles: number;
  vehicleQuota: number;
  retentionDays: number;
  smsBalance: number;
  assistantTokenQuota: number;
  assistantTokensUsed: number;
  nearQuota?: boolean;
  nearQuotaMessage?: string | null;
};

export default function PlanPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    api<Plan>("/plan").then(setPlan).catch((err: Error) => setError(err.message));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      setPlan(
        await api<Plan>("/plan", {
          method: "PATCH",
          body: JSON.stringify({
            retentionDays: Number(data.get("retentionDays")),
          }),
        }),
      );
      setNote("Location history setting saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the plan");
    }
  }

  return (
    <PageChrome icon="fa-light fa-crown" crumbs={[{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Plan" }]}>
      <p className="mb-3 text-sm text-[var(--esk-muted)]">
        Subscription status and quotas are managed by NEPATRONIX Platform. Your school can adjust GPS location history retention. For billing
        or quota changes, email {supportEmail()}.
      </p>
      {plan ? (
        <form className="esk-panel max-w-2xl" onSubmit={save}>
          <h2>{plan.name}</h2>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">
            Status {plan.status}
            {plan.expiresOn ? ` · expires ${plan.expiresOn}` : ""}
            {plan.health !== "ok" ? ` · ${plan.health}` : ""}
          </p>
          {plan.message ? (
            <p className={`mt-2 text-sm ${plan.blocked ? "text-rose-700" : "text-[var(--esk-muted)]"}`}>{plan.message}</p>
          ) : null}
          <p className="mt-2 text-sm">
            <a
              className="font-semibold text-[var(--esk-purple)] underline"
              href={contactNepatronixMailto({
                planHealth: plan.health,
                topic: plan.blocked ? "Restore access" : plan.nearQuota ? "Raise quotas" : "Subscription help",
              })}
            >
              Contact NEPATRONIX
            </a>
          </p>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">Add-ons: {plan.addons.join(", ")}</p>
          <p className="mt-1 text-sm">SMS balance {plan.smsBalance}</p>
          <p className="mt-1 text-sm">
            Adam has used {plan.assistantTokensUsed} of {plan.assistantTokenQuota} tokens this month.
          </p>
          {plan.notes ? <p className="mt-1 text-sm text-[var(--esk-muted)]">{plan.notes}</p> : null}
          {plan.nearQuotaMessage ? <p className="mt-2 text-sm text-amber-800">{plan.nearQuotaMessage}</p> : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Quota label="RFID readers" used={plan.readers} quota={plan.readerQuota} />
            <Quota label="RFID cards" used={plan.cards} quota={plan.cardQuota} />
            <Quota label="GPS vehicles" used={plan.vehicles} quota={plan.vehicleQuota} />
            <Quota label="Adam tokens / month" used={plan.assistantTokensUsed} quota={plan.assistantTokenQuota} />
          </div>

          {plan.blocked ? (
            <p className="mt-4 text-sm text-rose-700">Access is locked until NEPATRONIX restores this subscription.</p>
          ) : (
            <>
              <div className="mt-4 max-w-xs">
                <Field label="Location history, days">
                  <input className={control} name="retentionDays" type="number" min={7} max={365} defaultValue={plan.retentionDays} required />
                </Field>
              </div>
              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
              {note ? <p className="mt-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
              <button className="esk-btn-primary mt-4" type="submit">
                <i className="fa-light fa-check" /> Save retention
              </button>
            </>
          )}
        </form>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </PageChrome>
  );
}

function Quota({ label, used, quota }: { label: string; used: number; quota: number }) {
  return (
    <div className="rounded-lg border border-black/5 bg-black/[0.02] px-3 py-2 text-sm">
      <div className="text-[var(--esk-muted)]">{label}</div>
      <div className="mt-1 font-medium">
        {used} / {quota}
      </div>
    </div>
  );
}
