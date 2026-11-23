"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { usePortalStudent } from "@/lib/portal-student";

type Student = { id: string; registrationNo: string; name: string; className: string; status: string };

export default function AdmissionLetterHubPage() {
  const router = useRouter();
  const { ready, isStudent, me, error: portalError } = usePortalStudent();
  const [rows, setRows] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (isStudent && me) {
      router.replace(`/admin/students/${me.id}/letter`);
      return;
    }
    if (isStudent) return;
    api<Student[]>("/students").then(setRows).catch((err: Error) => setError(err.message));
  }, [ready, isStudent, me, router]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => !text || row.name.toLowerCase().includes(text) || row.registrationNo.toLowerCase().includes(text));
  }, [query, rows]);

  if (!ready || (isStudent && me)) {
    return <p className="text-sm text-[var(--esk-muted)]">Opening your admission letter…</p>;
  }

  return (
    <PageChrome
      icon="fa-light fa-envelope-open-text"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Admission Letter" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/students">All students</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)]">Pick a student to print or create their admission letter and portal login.</p>
      {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
      <FilterCard>
        <Field label="Search Student">
          <input className={control} value={query} placeholder="Type student name or reg number..." onChange={(event) => setQuery(event.target.value)} />
        </Field>
      </FilterCard>
      <DataCard>
        {filtered.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-envelope-open-text" /></div>
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
                    <Link className="esk-btn-primary" href={`/admin/students/${row.id}/letter`}>
                      <i className="fa-light fa-print" /> Open letter
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
