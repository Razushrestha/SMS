"use client";

import { FormEvent, useEffect, useState } from "react";
import { AttendanceNav } from "@/components/attendance-nav";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { daysAgo, lastMonthRange, monthStart, today } from "@/lib/dates";

type ClassRow = { id: string; name: string };
type Report = {
  from: string;
  to: string;
  counts: { total: number; present: number; leave: number; absent: number };
  rows: Array<{ date: string; day: string; studentId: string; name: string; className: string; status: string; type: string; time: string }>;
};

const presets = [
  { label: "Today", from: today(), to: today() },
  { label: "Yesterday", from: daysAgo(1), to: daysAgo(1) },
  { label: "Last 7 Days", from: daysAgo(6), to: today() },
  { label: "Last 30 Days", from: daysAgo(29), to: today() },
  { label: "This Month", from: monthStart(), to: today() },
  { label: "Last Month", ...lastMonthRange() },
];

export default function StudentAttendanceReportPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [classId, setClassId] = useState("");

  async function load(nextFrom = from, nextTo = to, nextClass = classId) {
    const query = new URLSearchParams({ from: nextFrom, to: nextTo });
    if (nextClass) query.set("classId", nextClass);
    setReport(await api<Report>(`/attendance/reports/students?${query}`));
  }

  useEffect(() => {
    Promise.all([
      api<ClassRow[]>("/classes"),
      api<{ institute: Institute }>("/institute"),
      load(),
    ]).then(([rooms, profile]) => {
      setClasses(rooms);
      setInstitute(profile.institute);
    }).catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextFrom = String(data.get("from"));
    const nextTo = String(data.get("to"));
    const nextClass = String(data.get("classId") ?? "");
    setFrom(nextFrom);
    setTo(nextTo);
    setClassId(nextClass);
    setError("");
    try {
      await load(nextFrom, nextTo, nextClass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the report");
    }
  }

  return (
    <PageChrome icon="fa-light fa-hand" crumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Student Report" }]}>
      <div className="print:hidden">
        <AttendanceNav />
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              className="esk-btn-ghost"
              type="button"
              onClick={() => {
                setFrom(preset.from);
                setTo(preset.to);
                load(preset.from, preset.to).catch((err: Error) => setError(err.message));
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <FilterCard>
          <form className="contents" onSubmit={onSubmit}>
            <Field label="From"><input className={control} name="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></Field>
            <Field label="To"><input className={control} name="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></Field>
            <Field label="Class">
              <select className={control} name="classId" value={classId} onChange={(event) => setClassId(event.target.value)}>
                <option value="">All classes</option>
                {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-filter" /> Show</button>
          </form>
        </FilterCard>
      </div>
      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}
      {report ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!report.rows.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          {report.rows.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-hand" /></div>
              <h5>No Attendance</h5>
              <p>No attendance in this range.</p>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-hand text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Student attendance report</h2>
                  <p>{institute?.name ?? "School"} · {report.from} to {report.to}</p>
                </div>
              </header>
              <div className="esk-certificate-meta">
                <div><span>Total</span><strong>{report.counts.total}</strong></div>
                <div><span>Present</span><strong>{report.counts.present}</strong></div>
                <div><span>Leave</span><strong>{report.counts.leave}</strong></div>
                <div><span>Absent</span><strong>{report.counts.absent}</strong></div>
              </div>
              <table className="esk-receipt-table mt-3">
                <thead>
                  <tr>
                    <th>Date</th><th>Day</th><th>Student ID</th><th>Name</th><th>Class</th><th>Status</th><th>Type</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={`${row.date}-${row.studentId}`}>
                      <td>{row.date}</td>
                      <td>{row.day}</td>
                      <td>{row.studentId}</td>
                      <td>{row.name}</td>
                      <td>{row.className}</td>
                      <td>{row.status}</td>
                      <td>{row.type}</td>
                      <td>{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          )}
        </div>
      ) : null}
    </PageChrome>
  );
}
