"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { control, Field } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

export default function InstitutePage() {
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    api<{ institute: Institute }>("/institute")
      .then((data) => setInstitute(data.institute))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("logo");
    const body = Object.fromEntries(data.entries()) as Record<string, unknown>;
    delete body.logo;
    try {
      if (removeLogo) body.logoUrl = null;
      else if (file instanceof File && file.size > 0) {
        if (file.type !== "image/png" && file.type !== "image/jpeg") throw new Error("Logo must be a JPG or PNG");
        if (file.size > 500 * 1024) throw new Error("Logo must be 500 KB or smaller");
        body.logoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read the logo"));
          reader.readAsDataURL(file);
        });
      }
      const data = await api<{ institute: Institute }>("/institute", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setInstitute(data.institute);
      setRemoveLogo(false);
      setMessage("Institute profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  if (!institute) {
    return (
      <PageChrome icon="fa-light fa-gear" crumbs={[{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Institute Profile" }]}>
        <p className="text-sm text-[var(--esk-muted)]">{error || "Loading profile…"}</p>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-gear"
      crumbs={[{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Institute Profile" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/settings/account">Account</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)]">Name, target line, phone, address, and country are required.</p>
      <form className="esk-panel max-w-2xl" onSubmit={onSubmit}>
        <Field label="Institute name">
          <input className={control} name="name" defaultValue={institute.name} required />
        </Field>
        <Field label="Target line">
          <input className={control} name="targetLine" defaultValue={institute.targetLine} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input className={control} name="phone" defaultValue={institute.phone} required />
          </Field>
          <Field label="Website">
            <input className={control} name="website" defaultValue={institute.website ?? ""} />
          </Field>
        </div>
        <Field label="Address">
          <input className={control} name="address" defaultValue={institute.address} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country">
            <input className={control} name="country" defaultValue={institute.country} required />
          </Field>
          <Field label="Timezone">
            <input className={control} name="timezone" defaultValue={institute.timezone} />
          </Field>
        </div>
        <Field label="Logo">
          <input className={control} name="logo" type="file" accept="image/png,image/jpeg" />
        </Field>
        {institute.logoUrl && !removeLogo ? <img src={institute.logoUrl} alt={institute.name} className="mb-4 h-16 w-16 object-contain" /> : null}
        {institute.logoUrl ? (
          <button type="button" className="mb-4 text-sm text-red-600" onClick={() => setRemoveLogo((value) => !value)}>
            {removeLogo ? "Keep the current logo" : "Remove logo"}
          </button>
        ) : null}
        <Field label="Date format">
          <select className={control} name="dateFormat" defaultValue={institute.dateFormat || "d MMMM, yyyy"}>
            <option value="d MMMM, yyyy">18 November, 2026</option>
            <option value="yyyy-MM-dd">2026-11-18</option>
            <option value="dd/MM/yyyy">18/11/2026</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <input className={control} name="currency" defaultValue={institute.currency} />
          </Field>
          <Field label="Currency symbol">
            <input className={control} name="currencySymbol" defaultValue={institute.currencySymbol} />
          </Field>
        </div>
        {message ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{message}</p> : null}
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <button className="esk-btn-primary" disabled={pending} type="submit">
          <i className="fa-light fa-check" /> {pending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </PageChrome>
  );
}
