"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type ClassRow = { id: string; name: string };
type Student = {
  registrationNo: string;
  name: string;
  attendancePercent: number | null;
  testPercent: number | null;
  affectivePercent: number | null;
  psychomotorPercent: number | null;
  overallPercent: number | null;
  grade: string;
  exams: Array<{ name: string; percent: number | null; grade: string | null; status: string | null }>;
};
type Report = { className: string; exams: string[]; students: Student[]; message: string | null };

function cell(value: number | null) {
  return value === null ? "not rated" : `${value}%`;
}

export default function ProgressReportPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [report, setReport] = useState<Report | null>(null);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const classId = String(new FormData(event.currentTarget).get("classId"));
    setError("");
    try {
      setReport(await api<Report>(`/learning/progress?classId=${encodeURIComponent(classId)}`));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Could not load the progress report");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-chart-line"
      crumbs={[{ label: "Reports", href: "/admin/reports" }, { label: "Progress Report" }]}
      actions={<Link className="esk-btn-ghost print:hidden" href="/admin/report-cards">Report card</Link>}
    >
      <p className="mb-3 max-w-2xl text-sm text-[var(--esk-muted)] print:hidden">Active students only. A section with no marks is “not rated” and is left out of the overall.</p>
      <div className="print:hidden">
        <FilterCard>
          <form className="contents" onSubmit={onSubmit}>
            <Field label="Class">
              <select className={control} name="classId" required defaultValue="">
                <option value="" disabled>Select a class</option>
                {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-chart-line" /> Show</button>
          </form>
        </FilterCard>
      </div>
      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}
      {report ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!!report.message || !report.students.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          {report.message ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-chart-line" /></div>
              <h5>No Progress Data</h5>
              <p>{report.message}</p>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chart-line text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Progress report</h2>
                  <p>{institute?.name ?? "School"} · {report.className}</p>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="esk-receipt-table">
                  <thead>
                    <tr>
                      {["Reg", "Name", "Attendance", ...report.exams, "Class tests", "Affective", "Psychomotor", "Overall", "Grade"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.students.map((student) => (
                      <tr key={student.registrationNo}>
                        <td>{student.registrationNo}</td>
                        <td>{student.name}</td>
                        <td>{cell(student.attendancePercent)}</td>
                        {student.exams.map((exam) => (
                          <td key={exam.name}>{exam.percent === null ? "not rated" : `${exam.percent}% ${exam.grade} ${exam.status}`}</td>
                        ))}
                        <td>{cell(student.testPercent)}</td>
                        <td>{cell(student.affectivePercent)}</td>
                        <td>{cell(student.psychomotorPercent)}</td>
                        <td>{cell(student.overallPercent)}</td>
                        <td>{student.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </div>
      ) : null}
    </PageChrome>
  );
}
