"use client";

import { FormEvent, useEffect, useState } from "react";
import { AttendanceNav } from "@/components/attendance-nav";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { thisMonth } from "@/lib/dates";
import { roleLabel } from "@/lib/school";

type ClassRow = { id: string; name: string };
type Grid = {
  month: string;
  className: string | null;
  days: string[];
  rows: Array<{ id: string; label: string; code: string; cells: string[]; present: number; leave: number; absent: number }>;
};

function GridDoc({ grid, institute, title }: { grid: Grid; institute: Institute | null; title: string }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end print:hidden">
        <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!grid.rows.length}>
          <i className="fa-light fa-print" /> Print
        </button>
      </div>
      {grid.rows.length === 0 ? (
        <div className="esk-empty">
          <div><i className="fa-light fa-calendar" /></div>
          <h5>No Active People</h5>
          <p>No active people for this sheet.</p>
        </div>
      ) : (
        <article className="esk-report-doc">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-calendar text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>{title}</h2>
              <p>{institute?.name ?? "School"} · {grid.month}{grid.className ? ` · ${grid.className}` : ""}</p>
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  <th>Name</th>
                  {grid.days.map((day) => <th key={day}>{Number(day)}</th>)}
                  <th>P</th>
                  <th>L</th>
                  <th>A</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">
                      {row.label}
                      <div className="text-xs text-[var(--esk-muted)]">{roleLabel(row.code)}</div>
                    </td>
                    {row.cells.map((cell, index) => <td key={`${row.id}-${grid.days[index]}`}>{cell || "·"}</td>)}
                    <td>{row.present}</td>
                    <td>{row.leave}</td>
                    <td>{row.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}

export default function MonthlyAttendancePage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [students, setStudents] = useState<Grid | null>(null);
  const [employees, setEmployees] = useState<Grid | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<ClassRow[]>("/classes"),
      api<{ institute: Institute }>("/institute"),
    ]).then(([rooms, profile]) => {
      setClasses(rooms);
      setInstitute(profile.institute);
    }).catch((err: Error) => setError(err.message));
  }, []);

  async function loadStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      setStudents(await api<Grid>(`/attendance/monthly/students?classId=${data.get("classId")}&month=${data.get("month")}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the student month");
    }
  }

  async function loadEmployees(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const month = String(new FormData(event.currentTarget).get("month"));
    setError("");
    try {
      setEmployees(await api<Grid>(`/attendance/monthly/employees?month=${month}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the staff month");
    }
  }

  return (
    <PageChrome icon="fa-light fa-calendar" crumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Monthly" }]}>
      <div className="print:hidden">
        <AttendanceNav />
        <p className="mb-3 text-sm text-[var(--esk-muted)]">P is present, L is leave, and A is absent. An empty day was not marked.</p>
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <FilterCard>
          <form className="contents" onSubmit={loadStudents}>
            <Field label="Class">
              <select className={control} name="classId" required defaultValue="">
                <option value="" disabled>Select a class</option>
                {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </Field>
            <Field label="Student month"><input className={control} name="month" type="month" defaultValue={thisMonth()} required /></Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-users" /> Show students</button>
          </form>
        </FilterCard>
      </div>
      {students ? <GridDoc grid={students} institute={institute} title="Student monthly attendance" /> : null}
      <div className="print:hidden">
        <FilterCard>
          <form className="contents" onSubmit={loadEmployees}>
            <Field label="Staff month"><input className={control} name="month" type="month" defaultValue={thisMonth()} required /></Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-briefcase" /> Show staff</button>
          </form>
        </FilterCard>
      </div>
      {employees ? <GridDoc grid={employees} institute={institute} title="Staff monthly attendance" /> : null}
    </PageChrome>
  );
}
