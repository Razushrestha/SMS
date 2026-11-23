"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Student = {
  id: string;
  registrationNo: string;
  name: string;
  className: string;
  status: string;
};

export default function StudentStatusPage() {
  const [rows, setRows] = useState<Student[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setRows(await api<Student[]>("/students"));
  }

  useEffect(() => {
    Promise.all([
      load(),
      api<{ institute: Institute }>("/institute").then((profile) => setInstitute(profile.institute)),
    ]).catch((err: Error) => setError(err.message));
  }, []);

  async function setStatus(row: Student, status: "active" | "inactive") {
    setError("");
    setNote("");
    try {
      const current = await api<Record<string, unknown>>(`/students/${row.id}`);
      await api(`/students/${row.id}`, { method: "PATCH", body: JSON.stringify({ ...current, status }) });
      setNote(`${row.name} is now ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  }

  const active = rows.filter((row) => row.status === "active").length;
  const inactive = rows.length - active;

  return (
    <PageChrome
      icon="fa-light fa-user-check"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Active / Inactive" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link className="esk-btn-ghost" href="/admin/students">All students</Link>
          <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!rows.length}>
            <i className="fa-light fa-print" /> Print
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">Inactive students stay on the record but are left off attendance, cards, and fee defaults.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      {note ? <p className="mb-3 text-sm text-[var(--esk-purple)] print:hidden">{note}</p> : null}
      {rows.length === 0 ? (
        <div className="esk-empty">
          <div><i className="fa-light fa-user-check" /></div>
          <h5>No Students Found</h5>
          <p>Admit a student first.</p>
        </div>
      ) : (
        <article className="esk-report-doc">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-user-check text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Student status roster</h2>
              <p>{institute?.name ?? "School"} · Active {active} · Inactive {inactive}</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead>
              <tr>
                <th>Reg</th>
                <th>Name</th>
                <th>Class</th>
                <th>Status</th>
                <th className="print:hidden" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.registrationNo}</td>
                  <td>{row.name}</td>
                  <td>{row.className}</td>
                  <td className="capitalize">{row.status}</td>
                  <td className="text-right print:hidden">
                    {row.status === "active" ? (
                      <button className="esk-btn-ghost" type="button" onClick={() => void setStatus(row, "inactive")}>Set inactive</button>
                    ) : (
                      <button className="esk-btn-primary" type="button" onClick={() => void setStatus(row, "active")}>Set active</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </PageChrome>
  );
}
