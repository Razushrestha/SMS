"use client";

import { FormEvent, useEffect, useState } from "react";
import { AttendanceNav } from "@/components/attendance-nav";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";

type Report = {
  date: string;
  classes: Array<{
    id: string;
    name: string;
    total: number;
    present: number | null;
    leave: number | null;
    absent: number | null;
    presentPercent: number | null;
  }>;
};

export default function ClassAttendanceReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ institute: Institute }>("/institute")
      .then((profile) => setInstitute(profile.institute))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get("date"));
    setError("");
    try {
      setReport(await api<Report>(`/attendance/reports/classes?date=${date}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the report");
    }
  }

  return (
    <PageChrome icon="fa-light fa-chalkboard" crumbs={[{ label: "Attendance", href: "/admin/attendance" }, { label: "Class-wise" }]}>
      <div className="print:hidden">
        <AttendanceNav />
        <FilterCard>
          <form className="contents" onSubmit={onSubmit}>
            <Field label="Date"><input className={control} name="date" type="date" defaultValue={today()} required /></Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-filter" /> Show</button>
          </form>
        </FilterCard>
      </div>
      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}
      {report ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!report.classes.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          {report.classes.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-chalkboard" /></div>
              <h5>No Classes Yet</h5>
              <p>Add classes to see class-wise attendance.</p>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chalkboard text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Class-wise attendance</h2>
                  <p>{institute?.name ?? "School"} · {report.date}</p>
                </div>
              </header>
              <table className="esk-receipt-table">
                <thead>
                  <tr>
                    <th>Class</th><th>Total</th><th>Present</th><th>On Leave</th><th>Absent</th><th>Present %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.classes.map((room) => (
                    <tr key={room.id}>
                      <td>{room.name}</td>
                      <td>{room.total}</td>
                      <td>{room.present ?? "—"}</td>
                      <td>{room.leave ?? "—"}</td>
                      <td>{room.absent ?? "—"}</td>
                      <td>{room.presentPercent === null ? "Not marked" : `${room.presentPercent}%`}</td>
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
