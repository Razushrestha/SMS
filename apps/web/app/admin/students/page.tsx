"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Student = {
  id: string;
  registrationNo: string;
  name: string;
  className: string;
  discountPercent: string;
  discountType: string;
  discountAmount: string;
  discountReason: string;
  status: string;
  fatherName: string | null;
};

export default function StudentsPage() {
  const [rows, setRows] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");

  async function load() {
    setRows(await api<Student[]>("/students"));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function remove(row: Student) {
    if (!confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    await api(`/students/${row.id}`, { method: "DELETE" });
    await load();
  }

  const classes = useMemo(() => [...new Set(rows.map((row) => row.className))].sort(), [rows]);
  const filtered = rows.filter((row) => {
    const text = query.trim().toLowerCase();
    const matchText = !text || row.name.toLowerCase().includes(text) || row.registrationNo.toLowerCase().includes(text);
    const matchClass = !classFilter || row.className === classFilter;
    return matchText && matchClass;
  });

  return (
    <PageChrome
      icon="fa-light fa-graduation-cap"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "All Students" }]}
      actions={
        <button className="esk-btn-ghost" type="button" onClick={() => void load()}>
          <i className="fa-light fa-rotate-right" /> Reload
        </button>
      }
    >
      <FilterCard>
        <Field label="Search Student">
          <input className={control} value={query} placeholder="Type student name or reg number..." onChange={(event) => setQuery(event.target.value)} />
        </Field>
        <Field label="Filter by Class">
          <select className={control} value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="">-- Select a class --</option>
            {classes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Link className="esk-btn-primary mb-1" href="/admin/students/new"><i className="fa-light fa-plus" /> Add Student</Link>
      </FilterCard>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <DataCard>
        {filtered.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-users" /></div>
            <h5>No Students Found</h5>
            <p>Try adjusting your search or add a new student.</p>
          </div>
        ) : (
          <table className="esk-table">
            <thead>
              <tr>
                <th>Reg</th>
                <th>Name</th>
                <th>Class</th>
                <th>Discount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.registrationNo}</td>
                  <td>
                    {row.name}
                    <div className="text-xs text-[var(--esk-muted)]">{row.fatherName}</div>
                  </td>
                  <td>{row.className}</td>
                  <td>{row.discountType === "fixed" ? `${row.discountAmount} ${row.discountReason}` : `${row.discountPercent}%`}</td>
                  <td className="capitalize">{row.status}</td>
                  <td className="text-right">
                    <Link className="esk-link" href={`/admin/students/${row.id}/login`}>Login</Link>
                    <Link className="esk-link ml-3" href={`/admin/students/${row.id}/letter`}>Admission letter</Link>
                    <Link className="esk-link ml-3" href={`/admin/students/${row.id}`}>Edit</Link>
                    <button className="esk-link-danger ml-3" onClick={() => remove(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataCard>
      <div className="flex flex-wrap gap-2">
        <Link className="esk-btn-ghost" href="/admin/students/contacts">Contact report</Link>
        <Link className="esk-btn-ghost" href="/admin/students/report">Info report</Link>
        <Link className="esk-btn-ghost" href="/admin/students/promote">Promote</Link>
        <Link className="esk-btn-ghost" href="/admin/students/list">Basic list</Link>
        <Link className="esk-btn-ghost" href="/admin/students/cards">ID cards</Link>
      </div>
    </PageChrome>
  );
}
