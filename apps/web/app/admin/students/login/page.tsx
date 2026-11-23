"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Student = { id: string; registrationNo: string; name: string; className: string; status: string };

export default function ManageLoginHubPage() {
  const [rows, setRows] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Student[]>("/students").then(setRows).catch((err: Error) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => !text || row.name.toLowerCase().includes(text) || row.registrationNo.toLowerCase().includes(text));
  }, [query, rows]);

  return (
    <PageChrome
      icon="fa-light fa-key"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Manage Login" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/students">All students</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)]">Pick a student to set their portal username, reset the password once, or save an SMS.</p>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <FilterCard>
        <Field label="Search Student">
          <input className={control} value={query} placeholder="Type student name or reg number..." onChange={(event) => setQuery(event.target.value)} />
        </Field>
      </FilterCard>
      <DataCard>
        {filtered.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-key" /></div>
            <h5>No Students Found</h5>
            <p>Try adjusting your search or admit a student.</p>
          </div>
        ) : (
          <table className="esk-table">
            <thead>
              <tr>
                <th>Reg</th>
                <th>Name</th>
                <th>Class</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.registrationNo}</td>
                  <td>{row.name}</td>
                  <td>{row.className}</td>
                  <td className="capitalize">{row.status}</td>
                  <td className="text-right">
                    <Link className="esk-btn-primary" href={`/admin/students/${row.id}/login`}>
                      <i className="fa-light fa-key" /> Manage login
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataCard>
    </PageChrome>
  );
}
