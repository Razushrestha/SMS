"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Family = { id: string; name: string; phone: string | null };

export default function FamiliesPage() {
  const [rows, setRows] = useState<Family[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Family | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setRows(await api<Family[]>("/families"));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.name} ${row.phone ?? ""}`.toLowerCase().includes(needle));
  }, [rows, query]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setNote("");
    try {
      if (editing) {
        await api(`/families/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.get("name"), phone: form.get("phone") }),
        });
        setEditing(null);
        setNote("Family updated.");
      } else {
        await api("/families", { method: "POST", body: JSON.stringify({ name: form.get("name"), phone: form.get("phone") }) });
        setNote("Family saved.");
      }
      formElement.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the family");
    }
  }

  return (
    <PageChrome icon="fa-light fa-people-roof" crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Manage Families" }]}>
      <div className="mb-3">
        <FilterCard>
          <Field label="Search">
            <input className={control} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Family name or phone" />
          </Field>
          <p className="mb-1 text-sm text-[var(--esk-muted)]">{filtered.length} of {rows.length}</p>
        </FilterCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form className="esk-panel" key={editing?.id ?? "new"} onSubmit={onSubmit}>
          <h2>{editing ? "Edit family" : "New family"}</h2>
          <div className="mt-3">
            <Field label="Family name">
              <input className={control} name="name" required defaultValue={editing?.name ?? ""} />
            </Field>
            <Field label="Phone">
              <input className={control} name="phone" defaultValue={editing?.phone ?? ""} />
            </Field>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            {note ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button className="esk-btn-primary" type="submit">{editing ? "Save changes" : "Save family"}</button>
              {editing ? (
                <button className="esk-btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
              ) : null}
            </div>
          </div>
        </form>
        <DataCard>
          {filtered.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-people-roof" /></div>
              <h5>{rows.length ? "No Matching Families" : "No Families Found"}</h5>
              <p>{rows.length ? "Try another search." : "A student can be linked to one family on admission."}</p>
            </div>
          ) : (
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Phone</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.phone || "—"}</td>
                    <td className="text-right">
                      <button className="esk-btn-ghost" type="button" onClick={() => { setEditing(row); setNote(""); setError(""); }}>Edit</button>
                      <button
                        className="esk-link-danger ml-2"
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete ${row.name}?`)) return;
                          await api(`/families/${row.id}`, { method: "DELETE" });
                          if (editing?.id === row.id) setEditing(null);
                          await load();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
      </div>
    </PageChrome>
  );
}
