"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Template = { id: string; name: string; body: string; conduct: string; duesNote: string };

const blank = { id: "", name: "", body: "This is to certify that {name}. Conduct is {conduct}. {dues}", conduct: "", duesNote: "" };

export default function CertificateTemplatesPage() {
  const [rows, setRows] = useState<Template[]>([]);
  const [editing, setEditing] = useState(blank);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setRows(await api<Template[]>("/learning/certificate-templates"));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNote("");
    const body = { name: editing.name, body: editing.body, conduct: editing.conduct, duesNote: editing.duesNote };
    try {
      if (editing.id) await api(`/learning/certificate-templates/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/learning/certificate-templates", { method: "POST", body: JSON.stringify(body) });
      setEditing(blank);
      setNote("Template saved. A certificate keeps the conduct and dues note it was generated with.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the template");
    }
  }

  async function remove(row: Template) {
    if (!confirm(`Delete the ${row.name} template?`)) return;
    setError("");
    try {
      await api(`/learning/certificate-templates/${row.id}`, { method: "DELETE" });
      if (editing.id === row.id) setEditing(blank);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the template");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-file-lines"
      crumbs={[{ label: "Certificates", href: "/admin/certificates" }, { label: "Templates" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/certificates">Certificates</Link>}
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form className="esk-panel" onSubmit={save}>
          <h2>{editing.id ? "Edit template" : "New template"}</h2>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">Use {"{name}"}, {"{father}"}, {"{admissionNumber}"}, {"{className}"}, {"{dateOfBirth}"}, {"{admissionDate}"}, {"{date}"}, {"{reason}"}, {"{conduct}"}, {"{dues}"}, and {"{institute}"}.</p>
          <div className="mt-3">
            <Field label="Name"><input className={control} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required /></Field>
            <Field label="Conduct"><input className={control} value={editing.conduct} onChange={(event) => setEditing({ ...editing, conduct: event.target.value })} required /></Field>
            <Field label="Dues note"><input className={control} value={editing.duesNote} onChange={(event) => setEditing({ ...editing, duesNote: event.target.value })} required /></Field>
            <Field label="Text"><textarea className={`${control} min-h-32`} value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} required /></Field>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            {note ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-floppy-disk" /> Save template</button>
            {editing.id ? <button className="esk-btn-ghost ml-2" type="button" onClick={() => setEditing(blank)}>Cancel</button> : null}
          </div>
        </form>
        <DataCard>
          {rows.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-file-lines" /></div>
              <h5>No Templates</h5>
              <p>Create a certificate template to reuse later.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--esk-border)]">
              {rows.map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{row.name}</p>
                    <span>
                      <button className="esk-btn-ghost" type="button" onClick={() => setEditing(row)}>Edit</button>
                      <button className="ml-2 text-red-600" type="button" onClick={() => void remove(row)}>Delete</button>
                    </span>
                  </div>
                  <p className="mt-1 text-[var(--esk-muted)]">Conduct {row.conduct}. {row.duesNote}</p>
                  <p className="mt-1 text-[var(--esk-muted)]">{row.body}</p>
                </li>
              ))}
            </ul>
          )}
        </DataCard>
      </div>
    </PageChrome>
  );
}
