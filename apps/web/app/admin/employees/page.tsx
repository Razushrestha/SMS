"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { readPhoto } from "@/lib/photo";
import { roleLabel, staffRoles } from "@/lib/school";

type Employee = {
  id: string;
  name: string;
  phone: string;
  joiningDate: string;
  staffRole: string;
  monthlySalary: string;
  status: string;
  showOnWebsite: boolean;
  email: string | null;
  photoUrl: string | null;
};

const empty = {
  name: "",
  phone: "",
  joiningDate: "",
  staffRole: "teacher",
  monthlySalary: "",
  email: "",
  showOnWebsite: false,
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");

  async function load() {
    setRows(await api<Employee[]>("/employees"));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      name: form.get("name"),
      phone: form.get("phone"),
      joiningDate: form.get("joiningDate"),
      staffRole: form.get("staffRole"),
      monthlySalary: form.get("monthlySalary"),
      email: form.get("email"),
      showOnWebsite: form.get("showOnWebsite") === "on",
      status: form.get("status") || "active",
      ...(photoUrl !== undefined ? { photoUrl } : {}),
    };
    try {
      if (editing) {
        await api(`/employees/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
        setEditing(null);
      } else {
        await api("/employees", { method: "POST", body: JSON.stringify(body) });
      }
      formElement.reset();
      setPhotoUrl(undefined);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the employee");
    }
  }

  async function remove(row: Employee) {
    if (!confirm(`Delete ${row.name}?`)) return;
    try {
      await api(`/employees/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  const values = editing ?? empty;

  return (
    <PageChrome
      icon="fa-light fa-briefcase"
      crumbs={[{ label: "Employees", href: "/admin/employees" }, { label: "All Employees" }]}
      actions={
        <div className="flex gap-2">
          <Link className="esk-btn-ghost" href="/admin/employees/report">Report</Link>
          <Link className="esk-btn-ghost" href="/admin/employees/cards">ID cards</Link>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form className="esk-panel" onSubmit={onSubmit} key={editing?.id ?? "new"}>
          <h2>{editing ? "Edit employee" : "Add employee"}</h2>
          <div className="mt-3">
            <Field label="Name">
              <input className={control} name="name" defaultValue={values.name} required />
            </Field>
            <Field label="Phone">
              <input className={control} name="phone" defaultValue={values.phone} required />
            </Field>
            <Field label="Joining date">
              <input className={control} name="joiningDate" type="date" defaultValue={values.joiningDate} required />
            </Field>
            <Field label="Role">
              <select className={control} name="staffRole" defaultValue={values.staffRole}>
                {staffRoles.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Monthly salary">
              <input className={control} name="monthlySalary" type="number" min="0" step="0.01" defaultValue={values.monthlySalary} required />
            </Field>
            <Field label="Photo">
              <input className={control} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                readPhoto(file).then((url) => { setPhotoUrl(url); setError(""); }).catch((err: Error) => setError(err.message));
              }} />
            </Field>
            {(photoUrl !== undefined ? photoUrl : editing?.photoUrl) ? <img alt="" className="mb-3 h-16 w-16 rounded object-cover" src={(photoUrl !== undefined ? photoUrl : editing?.photoUrl) ?? ""} /> : null}
            {editing?.photoUrl ? <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={photoUrl === null} onChange={(event) => setPhotoUrl(event.target.checked ? null : undefined)} /> Remove photo</label> : null}
            <Field label="Email">
              <input className={control} name="email" type="email" defaultValue={values.email ?? ""} />
            </Field>
            {editing ? (
              <Field label="Status">
                <select className={control} name="status" defaultValue={editing.status}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            ) : null}
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input name="showOnWebsite" type="checkbox" defaultChecked={values.showOnWebsite} />
              Show profile on website
            </label>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <button className="esk-btn-primary">Save</button>
            {editing ? (
              <button className="ml-2 text-sm text-[var(--esk-muted)]" type="button" onClick={() => { setEditing(null); setPhotoUrl(undefined); }}>Cancel</button>
            ) : null}
          </div>
        </form>
        <DataCard>
          {rows.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-briefcase" /></div>
              <h5>No Employees Found</h5>
              <p>Add a staff member to assign classes and salaries.</p>
            </div>
          ) : (
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {row.photoUrl ? <img alt="" className="h-8 w-8 rounded object-cover" src={row.photoUrl} /> : null}
                        <div>{row.name}<div className="text-xs text-[var(--esk-muted)]">{row.phone}</div></div>
                      </div>
                    </td>
                    <td>{roleLabel(row.staffRole)}</td>
                    <td>{row.monthlySalary}</td>
                    <td className="capitalize">{row.status}</td>
                    <td className="text-right">
                      <Link className="esk-link" href={`/admin/employees/${row.id}/letter`}>Job letter</Link>
                      <button className="esk-link ml-3" onClick={() => { setEditing(row); setPhotoUrl(undefined); }}>Edit</button>
                      <button className="esk-link-danger ml-3" onClick={() => remove(row)}>Delete</button>
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
