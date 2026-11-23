"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, control } from "@/components/auth-card";
import { api } from "@/lib/api";

type Invite = { to: string; subject: string; body: string; mailto: string };
type School = { tenantId: string; invite?: Invite };

export default function PlatformNewSchoolPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      const school = await api<School>("/platform/schools", {
        method: "POST",
        body: JSON.stringify({
          instituteName: data.get("instituteName"),
          targetLine: data.get("targetLine"),
          phone: data.get("phone"),
          address: data.get("address"),
          country: data.get("country"),
          website: data.get("website") || undefined,
          adminName: data.get("adminName"),
          adminEmail: data.get("adminEmail"),
          adminPassword: data.get("adminPassword"),
          planName: data.get("planName"),
          status: data.get("status"),
          expiresOn: data.get("expiresOn") || null,
          smsBalance: Number(data.get("smsBalance")),
          notes: data.get("notes"),
        }),
      });
      if (school.invite) {
        sessionStorage.setItem(`nepatronix-invite-${school.tenantId}`, JSON.stringify(school.invite));
      }
      router.push(`/platform/schools/${school.tenantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create school");
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link className="text-sm text-[var(--esk-muted)] hover:underline" href="/platform">
          ← Schools
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create school</h1>
        <p className="mt-1 text-sm text-[var(--esk-muted)]">Provision a tenant, admin login, plan, and SMS balance.</p>
      </div>

      <form className="esk-panel max-w-3xl space-y-4" onSubmit={create}>
        <h2 className="text-lg font-semibold">Institute</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Institute name">
            <input className={control} name="instituteName" required />
          </Field>
          <Field label="Target line">
            <input className={control} name="targetLine" required defaultValue="Quality education for every child" />
          </Field>
          <Field label="Phone">
            <input className={control} name="phone" required />
          </Field>
          <Field label="Country">
            <input className={control} name="country" required defaultValue="Nepal" />
          </Field>
          <Field label="Address">
            <input className={control} name="address" required />
          </Field>
          <Field label="Website">
            <input className={control} name="website" placeholder="optional" />
          </Field>
        </div>

        <h2 className="pt-2 text-lg font-semibold">School admin</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Admin name">
            <input className={control} name="adminName" required />
          </Field>
          <Field label="Admin email">
            <input className={control} name="adminEmail" type="email" required />
          </Field>
          <Field label="Temp password">
            <input className={control} name="adminPassword" type="text" required minLength={6} />
          </Field>
        </div>

        <h2 className="pt-2 text-lg font-semibold">Subscription</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan name">
            <input className={control} name="planName" defaultValue="Core" required />
          </Field>
          <Field label="Status">
            <select className={control} name="status" defaultValue="trial" required>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="past_due">Past due</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Expires on">
            <input className={control} name="expiresOn" type="date" />
          </Field>
          <Field label="Starting SMS balance">
            <input className={control} name="smsBalance" type="number" min={0} defaultValue={100} required />
          </Field>
        </div>
        <Field label="Internal notes">
          <textarea className={control} name="notes" rows={3} />
        </Field>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="esk-btn-primary" type="submit" disabled={pending}>
          <i className="fa-light fa-plus" /> {pending ? "Creating…" : "Create school"}
        </button>
      </form>
    </div>
  );
}
