"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthCard, Field, control } from "@/components/auth-card";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      await api("/auth/register", { method: "POST", body: JSON.stringify(body) });
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the institute");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title="Create your institute" subtitle="This creates the school and the first admin account.">
      <form onSubmit={onSubmit}>
        <Field label="Institute name">
          <input className={control} name="instituteName" required />
        </Field>
        <Field label="Target line">
          <input className={control} name="targetLine" required placeholder="A short line under the school name" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input className={control} name="phone" required />
          </Field>
          <Field label="Country">
            <input className={control} name="country" required defaultValue="Nepal" />
          </Field>
        </div>
        <Field label="Address">
          <input className={control} name="address" required />
        </Field>
        <Field label="Website">
          <input className={control} name="website" placeholder="Optional" />
        </Field>
        <Field label="Your name">
          <input className={control} name="adminName" required />
        </Field>
        <Field label="Email">
          <input className={control} name="email" type="email" required />
        </Field>
        <Field label="Password">
          <input className={control} name="password" type="password" minLength={8} required />
        </Field>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <button className="esk-btn-primary w-full" disabled={pending}>
          {pending ? "Creating…" : "Create institute"}
        </button>
      </form>
      <p className="mt-4 text-sm text-[var(--esk-muted)]">
        Already registered? <Link className="font-semibold text-[var(--esk-purple)]" href="/login">Sign in</Link>
      </p>
    </AuthCard>
  );
}
