"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("admin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    Promise.all([api<{ user: { email: string; name: string; role: string } }>("/auth/me"), api<{ institute: Institute }>("/institute")])
      .then(([session, profile]) => {
        setEmail(session.user.email);
        setName(session.user.name);
        setRole(session.user.role);
        setInstitute(profile.institute);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const isAdmin = role === "admin";
  const isPortal = role === "student" || role === "parent" || role === "employee" || role === "principal" || role === "teacher" || role === "accountant" || role === "store_manager";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      const body: Record<string, unknown> = {
        email: data.get("email"),
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
      };
      if (isAdmin) {
        body.timezone = data.get("timezone");
        body.currency = data.get("currency");
        body.currencySymbol = data.get("currencySymbol");
      }
      const saved = await api<{ email: string }>("/auth/account", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEmail(saved.email);
      setNote("Account saved.");
      event.currentTarget.querySelectorAll<HTMLInputElement>("input[type=password]").forEach((input) => {
        input.value = "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the account");
    }
  }

  async function exportLocations() {
    setError("");
    setNote("");
    try {
      const file = await api<{ filename: string; csv: string; truncated?: boolean }>("/gps/export");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([file.csv], { type: "text/csv" }));
      link.download = file.filename;
      link.click();
      setNote(file.truncated ? "Exported the newest 10,000 location points." : "Location history exported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export locations");
    }
  }

  async function clearLocations() {
    if (!confirm("Delete stored location points? Students, fees, and trips stay.")) return;
    setError("");
    setNote("");
    try {
      const result = await api<{ deleted: number }>("/gps/locations", { method: "DELETE" });
      setNote(`Deleted ${result.deleted} location points.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete locations");
    }
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!confirm("Delete this institute and all of its data?")) return;
    setError("");
    try {
      await api("/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ instituteName: data.get("instituteName"), password: data.get("password") }),
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the account");
    }
  }

  if (!institute) {
    return (
      <PageChrome icon="fa-light fa-user-gear" crumbs={[{ label: "Account Settings" }]}>
        <p className="text-sm text-[var(--esk-muted)]">{error || "Loading account…"}</p>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-user-gear"
      crumbs={isAdmin ? [{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Account" }] : [{ label: "Account Settings" }]}
      actions={isAdmin ? <Link className="esk-btn-ghost" href="/admin/settings/institute">Institute profile</Link> : undefined}
    >
      {isPortal ? <StudentPanelHead title="Account Settings" hint={`${name} · ${institute.name}`} /> : null}
      {!isPortal ? <p className="mb-3 text-sm text-[var(--esk-muted)]">Email and password belong to this login. Timezone and currency belong to {institute.name}.</p> : null}
      <div className="grid max-w-3xl gap-4">
        <form className="esk-panel" onSubmit={save}>
          <h2>{isAdmin ? "Login & currency" : "Login"}</h2>
          <div className="mt-3">
            <Field label={isPortal ? "Email / Username" : "Email"}>
              <input className={control} name="email" type="text" defaultValue={email} required />
            </Field>
            <Field label="Current password"><input className={control} name="currentPassword" type="password" autoComplete="current-password" /></Field>
            <Field label="New password"><input className={control} name="newPassword" type="password" autoComplete="new-password" /></Field>
            {isAdmin ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Timezone"><input className={control} name="timezone" defaultValue={institute.timezone} required /></Field>
                <Field label="Currency"><input className={control} name="currency" defaultValue={institute.currency} required /></Field>
                <Field label="Symbol"><input className={control} name="currencySymbol" defaultValue={institute.currencySymbol} required /></Field>
              </div>
            ) : null}
            {note ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-check" /> Save account</button>
          </div>
        </form>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {isAdmin ? (
          <>
            <div className="esk-panel">
              <h2>Location history</h2>
              <p className="mt-1 text-sm text-[var(--esk-muted)]">Export or delete stored GPS points for {institute.name}. Students, fees, trips, and the route stay.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="esk-btn-primary" onClick={() => void exportLocations()} type="button"><i className="fa-light fa-download" /> Export locations</button>
                <button className="esk-btn-ghost text-red-600" onClick={() => void clearLocations()} type="button">Delete locations</button>
              </div>
            </div>
            <form className="esk-panel" onSubmit={remove}>
              <h2>Delete account</h2>
              <p className="mt-1 text-sm text-[var(--esk-muted)]">This removes {institute.name} and its students, staff, fees, attendance, cards, and locations. Type the institute name to confirm.</p>
              <Field label="Institute name"><input className={control} name="instituteName" required /></Field>
              <Field label="Password"><input className={control} name="password" type="password" required /></Field>
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white" type="submit">Delete account</button>
            </form>
          </>
        ) : null}
      </div>
    </PageChrome>
  );
}
