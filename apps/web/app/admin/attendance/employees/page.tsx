"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { roleLabel } from "@/lib/school";
import { today } from "@/lib/dates";

type SheetRow = { personId: string; name: string; staffRole: string; status: "present" | "leave" | "absent"; saved: boolean };
type Sheet = { date: string; rows: SheetRow[] };

const statusLabel: Record<string, string> = { present: "Present", leave: "On Leave", absent: "Absent" };

const choices = [
  { value: "present", label: "Present" },
  { value: "leave", label: "Leave" },
  { value: "absent", label: "Absent" },
] as const;

export default function EmployeeAttendancePage() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ institute: Institute }>("/institute")
      .then((profile) => setInstitute(profile.institute))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function openSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get("date"));
    setError("");
    setMessage("");
    try {
      setSheet(await api<Sheet>(`/attendance/employees?date=${date}`));
    } catch (err) {
      setSheet(null);
      setError(err instanceof Error ? err.message : "Could not open the sheet");
    }
  }

  function setStatus(personId: string, status: SheetRow["status"]) {
    setSheet((current) =>
      current
        ? { ...current, rows: current.rows.map((row) => (row.personId === personId ? { ...row, status } : row)) }
        : current,
    );
  }

  async function save() {
    if (!sheet) return;
    setError("");
    setMessage("");
    try {
      const result = await api<{ message: string }>("/attendance/employees", {
        method: "POST",
        body: JSON.stringify({
          date: sheet.date,
          marks: sheet.rows.map((row) => ({ personId: row.personId, status: row.status })),
        }),
      });
      setMessage(result.message);
      setSheet({ ...sheet, rows: sheet.rows.map((row) => ({ ...row, saved: true })) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attendance");
    }
  }

  return (
    <PageChrome icon="fa-light fa-briefcase" crumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Mark or update Employee Attendance" }]}>
      <div className="esk-att-wrap print:hidden">
        <div className="esk-att-card">
          <div className="esk-att-section">
            <span className="esk-att-num">1</span>
            <strong>Select Date</strong>
          </div>
          <form onSubmit={openSheet}>
            <div className="esk-att-grid" style={{ gridTemplateColumns: "1fr" }}>
              <Field label="Date *">
                <input className={control} name="date" type="date" defaultValue={today()} required />
              </Field>
            </div>
            <div className="esk-att-actions">
              <button className="esk-btn-primary" type="submit"><i className="fa-light fa-check" /> Submit</button>
            </div>
          </form>
        </div>
      </div>

      {error ? <p className="mt-3 text-center text-sm text-red-600 print:hidden">{error}</p> : null}
      {message ? <p className="mt-3 text-center text-sm text-[var(--esk-purple)] print:hidden">{message}</p> : null}

      {sheet ? (
        <>
          <div className="print:hidden">
            <DataCard>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-sm font-medium">{sheet.date}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="esk-btn-ghost" type="button" onClick={() => window.print()} disabled={sheet.rows.length === 0}>
                    <i className="fa-light fa-print" /> Print
                  </button>
                  <button className="esk-btn-primary" type="button" onClick={() => void save()} disabled={sheet.rows.length === 0}>
                    <i className="fa-light fa-floppy-disk" /> Save attendance
                  </button>
                </div>
              </div>
              {sheet.rows.length === 0 ? (
                <div className="esk-empty">
                  <div><i className="fa-light fa-briefcase" /></div>
                  <h5>No Active Employees</h5>
                  <p>There are no active employees to mark.</p>
                </div>
              ) : (
                <table className="esk-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row) => (
                      <tr key={row.personId}>
                        <td>
                          {row.name}
                          {row.saved ? null : <span className="ml-2 text-xs text-[var(--esk-muted)]">not saved</span>}
                        </td>
                        <td>{roleLabel(row.staffRole)}</td>
                        <td>
                          <div className="esk-att-status">
                            {choices.map((choice) => (
                              <label key={choice.value} className={`esk-att-choice ${row.status === choice.value ? "active" : ""}`}>
                                <input type="radio" name={row.personId} checked={row.status === choice.value} onChange={() => setStatus(row.personId, choice.value)} />
                                {choice.label}
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DataCard>
          </div>
          {sheet.rows.length ? (
            <article className="esk-report-doc mt-4 hidden print:block">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-briefcase text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Employee attendance sheet</h2>
                  <p>{institute?.name ?? "School"} · {sheet.date}</p>
                </div>
              </header>
              <table className="esk-receipt-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row) => (
                    <tr key={row.personId}>
                      <td>{row.name}</td>
                      <td>{roleLabel(row.staffRole)}</td>
                      <td>{statusLabel[row.status] ?? row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ) : null}
        </>
      ) : null}
    </PageChrome>
  );
}
