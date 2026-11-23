"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { loginRoles, menusFor, roleLabel } from "@/lib/roles";

type Login = { id: string; name: string; email: string; role: string; children: Array<{ id: string; name: string }> };
type Student = { id: string; name: string };

export default function RolesPage() {
  const [rows, setRows] = useState<Login[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setRows(await api<Login[]>("/auth/users"));
  }

  useEffect(() => {
    Promise.all([load(), api<Student[]>("/students").then(setStudents)]).catch((err: Error) => setError(err.message));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setNote("");
    try {
      const row = await api<Login & { password: string }>("/auth/users", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), role: data.get("role") }),
      });
      setCreated({ email: row.email, password: row.password });
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the login");
    }
  }

  async function saveRole(row: Login, role: string) {
    setError("");
    setCreated(null);
    try {
      await api(`/auth/users/${row.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      setNote(`${row.name} is now ${roleLabel(role)}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the role");
    }
  }

  async function saveChildren(event: FormEvent<HTMLFormElement>, row: Login) {
    event.preventDefault();
    const ids = [...new FormData(event.currentTarget).getAll("studentId")].map(String);
    setError("");
    setCreated(null);
    try {
      await api(`/auth/users/${row.id}/children`, { method: "PATCH", body: JSON.stringify({ studentIds: ids }) });
      setNote(`Children saved for ${row.name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link the children");
    }
  }

  async function remove(row: Login) {
    if (!confirm(`Delete the login for ${row.name}?`)) return;
    setError("");
    setCreated(null);
    try {
      await api(`/auth/users/${row.id}`, { method: "DELETE" });
      setNote("Login deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the login");
    }
  }

  return (
    <PageChrome icon="fa-light fa-users-gear" crumbs={[{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Roles" }]}>
      <p className="mb-3 max-w-2xl text-sm text-[var(--esk-muted)]">A role opens only the menus listed here. The password for a new login is shown once and is not stored.</p>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {note ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
      {created ? <p className="mb-3 text-sm text-[var(--esk-purple)]">Login {created.email}. Password {created.password}. This password is shown once and is not stored.</p> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {loginRoles.map((role) => (
          <article key={role.value} className="esk-panel text-sm">
            <h2>{role.label}</h2>
            <p className="mt-2 text-[var(--esk-muted)]">{menusFor(role.value).join(", ")}</p>
          </article>
        ))}
      </div>
      <form className="esk-panel mb-4" onSubmit={create}>
        <h2>New login</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Name"><input className={control} name="name" placeholder="Name" required /></Field>
          <Field label="Email"><input className={control} name="email" type="email" placeholder="Email" required /></Field>
          <Field label="Role">
            <select className={control} name="role" defaultValue="teacher">
              {loginRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </Field>
        </div>
        <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Create login</button>
      </form>
      <DataCard>
        <table className="esk-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>
                  <select className={control} value={row.role} onChange={(event) => void saveRole(row, event.target.value)}>
                    {loginRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                </td>
                <td className="text-right">
                  <button className="text-red-600" type="button" onClick={() => void remove(row)}>Delete</button>
                  {row.role === "parent" ? (
                    <form key={row.children.map((child) => child.id).join()} className="mt-2 text-left" onSubmit={(event) => void saveChildren(event, row)}>
                      {students.map((student) => (
                        <label key={student.id} className="block text-xs">
                          <input name="studentId" type="checkbox" value={student.id} defaultChecked={row.children.some((child) => child.id === student.id)} /> {student.name}
                        </label>
                      ))}
                      <button className="esk-btn-ghost mt-1" type="submit">Save children</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataCard>
    </PageChrome>
  );
}
