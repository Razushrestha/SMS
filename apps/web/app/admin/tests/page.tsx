"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { ChildPicker } from "@/components/child-picker";
import { DataCard, FilterCard, PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";
import { usePortalStudent } from "@/lib/portal-student";

type ClassRow = { id: string; name: string };
type Subject = { id: string; name: string; totalMarks: number };
type Sheet = { totalMarks: number; saved: boolean; students: Array<{ id: string; registrationNo: string; name: string; obtained: string }> };
type Performance = { message: string | null; students: Array<{ registrationNo: string; name: string; strongSubjects: string[]; weakSubjects: string[]; averagePercent: number }>; subjects: Array<{ name: string; strongPercent: number }> };
type Settings = { weakBelow: number; strongFrom: number; overallFailAt: number; subjectFailAt: number; failSubjectCount: number };
type TestResult = { registrationNo: string; name: string; className: string; subjectName: string; date: string; total: string; obtained: string };

export default function ClassTestsPage() {
  const { ready, isPortal: isStudent, isParent, me, children, setMe, error: portalError } = usePortalStudent();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [total, setTotal] = useState("20");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(today());
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [ownResults, setOwnResults] = useState<TestResult[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (isStudent) {
      if (!me) return;
      Promise.all([
        api<TestResult[]>(`/learning/tests/results?registration=${encodeURIComponent(me.registrationNo)}`),
        api<{ institute: Institute }>("/institute"),
      ])
        .then(([results, profile]) => {
          setOwnResults(results);
          setInstitute(profile.institute);
        })
        .catch((err: Error) => setError(err.message));
      return;
    }
    Promise.all([
      api<ClassRow[]>("/classes"),
      api<Settings>("/learning/settings"),
      api<{ institute: Institute }>("/institute"),
    ]).then(([rooms, current, profile]) => {
      setClasses(rooms);
      setSettings(current);
      setInstitute(profile.institute);
    }).catch((err: Error) => setError(err.message));
  }, [ready, isStudent, me]);

  const className = classes.find((room) => room.id === classId)?.name ?? "";
  const subjectName = subjects.find((subject) => subject.id === subjectId)?.name ?? "";

  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      return;
    }
    api<Subject[]>(`/subjects?classId=${classId}`).then(setSubjects).catch((err: Error) => setError(err.message));
  }, [classId]);

  async function openSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextClass = String(data.get("classId"));
    const nextSubject = String(data.get("subjectId"));
    const nextDate = String(data.get("date"));
    setClassId(nextClass);
    setSubjectId(nextSubject);
    setDate(nextDate);
    setError("");
    try {
      const next = await api<Sheet>(`/learning/tests?classId=${nextClass}&subjectId=${nextSubject}&date=${nextDate}`);
      setSheet(next);
      setTotal(String(next.totalMarks));
      const initial: Record<string, string> = {};
      next.students.forEach((student) => {
        initial[student.id] = student.obtained === null || student.obtained === undefined ? "" : String(student.obtained);
      });
      setMarks(initial);
    } catch (err) {
      setSheet(null);
      setError(err instanceof Error ? err.message : "Could not open the test");
    }
  }

  async function save() {
    setError("");
    try {
      const result = await api<{ message: string }>("/learning/tests", {
        method: "POST",
        body: JSON.stringify({
          classId,
          subjectId,
          date,
          totalMarks: total,
          marks: Object.entries(marks).map(([studentId, obtained]) => ({ studentId, obtained })),
        }),
      });
      setMessage(result.message);
      setSheet(sheet ? { ...sheet, saved: true } : sheet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the test");
    }
  }

  async function showPerformance() {
    if (!classId) return;
    setError("");
    try {
      setPerformance(await api<Performance>(`/learning/tests/performance?classId=${classId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load performance");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      setSettings(await api<Settings>("/learning/settings", {
        method: "PATCH",
        body: JSON.stringify({
          weakBelow: data.get("weakBelow"),
          strongFrom: data.get("strongFrom"),
          overallFailAt: data.get("overallFailAt"),
          subjectFailAt: data.get("subjectFailAt"),
          failSubjectCount: data.get("failSubjectCount"),
        }),
      }));
      setMessage("Grading cutoffs saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save cutoffs");
    }
  }

  if (isStudent) {
    return (
      <PageChrome icon="fa-light fa-chart-pie" crumbs={[{ label: "Test Results" }]}>
        <div className="print:hidden">
          <StudentPanelHead title="Test Results" hint={isParent ? "Class test marks for the selected child." : "Class test marks saved by your teachers."} />
          {isParent ? <ChildPicker options={children} selected={me} onSelect={setMe} /> : null}
          {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
          {ownResults.length ? (
            <div className="mb-3 flex justify-end">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            </div>
          ) : null}
        </div>
        {ownResults.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-chart-pie" /></div>
            <h5>No Record Found.</h5>
            <p>Class test marks will appear here once your teacher saves them.</p>
          </div>
        ) : (
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chart-pie text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Class test results</h2>
                <p>{institute?.name ?? "School"} · {me?.name} · {me?.registrationNo} · {me?.className}</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Obtained</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {ownResults.map((row, index) => (
                  <tr key={`${row.subjectName}-${row.date}-${index}`}>
                    <td>{row.date}</td>
                    <td>{row.subjectName}</td>
                    <td>{row.obtained}</td>
                    <td>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-file-lines"
      crumbs={[{ label: "Class Tests", href: "/admin/tests" }, { label: "Enter Marks" }]}
      actions={<Link className="esk-btn-ghost print:hidden" href="/admin/exams">Exams</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">The same class, subject, and date updates the existing test.</p>
      <div className="print:hidden">
        <FilterCard>
          <form className="contents" onSubmit={openSheet}>
            <Field label="Class">
              <select className={control} name="classId" required value={classId} onChange={(event) => setClassId(event.target.value)}>
                <option value="" disabled>Select a class</option>
                {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <select className={control} name="subjectId" required defaultValue="" disabled={!subjects.length}>
                <option value="" disabled>{subjects.length ? "Select a subject" : "No subjects assigned to this class yet."}</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </Field>
            <Field label="Date"><input className={control} name="date" type="date" defaultValue={today()} required /></Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-list" /> Open test</button>
          </form>
        </FilterCard>
      </div>
      {sheet ? (
        <DataCard>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1 print:hidden">
            <div className="max-w-xs">
              <Field label="Total marks"><input className={control} type="number" min="1" step="any" value={total} onChange={(event) => setTotal(event.target.value)} /></Field>
            </div>
            <button className="esk-btn-ghost mb-1" type="button" onClick={() => window.print()}>
              <i className="fa-light fa-print" /> Print mark sheet
            </button>
          </div>
          <table className="esk-table print:hidden">
            <thead>
              <tr>
                <th>Reg</th>
                <th>Name</th>
                <th>Obtained</th>
              </tr>
            </thead>
            <tbody>
              {sheet.students.map((student) => (
                <tr key={student.id}>
                  <td>{student.registrationNo}</td>
                  <td>{student.name}</td>
                  <td>
                    <input className={control} type="number" min="0" step="any" value={marks[student.id] ?? ""} onChange={(event) => setMarks({ ...marks, [student.id]: event.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2 px-1 print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => void save()}>
              <i className="fa-light fa-floppy-disk" /> {sheet.saved ? "Update test" : "Save test"}
            </button>
            <button className="esk-btn-ghost" type="button" onClick={() => void showPerformance()}>
              <i className="fa-light fa-chart-line" /> Performance
            </button>
          </div>
          <article className="esk-report-doc mt-4 hidden print:block">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-file-lines text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Class test mark sheet</h2>
                <p>{institute?.name ?? "School"} · {className} · {subjectName} · {date} · Total {total}</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead><tr><th>Reg</th><th>Name</th><th>Obtained</th></tr></thead>
              <tbody>
                {sheet.students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.registrationNo}</td>
                    <td>{student.name}</td>
                    <td>{marks[student.id] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </DataCard>
      ) : null}
      {performance ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
              <i className="fa-light fa-print" /> Print performance
            </button>
          </div>
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chart-line text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Class test performance</h2>
                <p>{institute?.name ?? "School"} · {className || "Class"}</p>
              </div>
            </header>
            {performance.message ? (
              <div className="esk-empty">
                <div><i className="fa-light fa-chart-line" /></div>
                <h5>Performance</h5>
                <p>{performance.message}</p>
              </div>
            ) : (
              <table className="esk-receipt-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Strong</th>
                    <th>Weak</th>
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.students.map((student) => (
                    <tr key={student.registrationNo}>
                      <td>{student.registrationNo} · {student.name}</td>
                      <td>{student.strongSubjects.join(", ") || "—"}</td>
                      <td>{student.weakSubjects.join(", ") || "—"}</td>
                      <td>{student.averagePercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {performance.subjects?.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {performance.subjects.map((subject) => (
                  <li key={subject.name}>{subject.name} · strong {subject.strongPercent}%</li>
                ))}
              </ul>
            ) : null}
          </article>
        </div>
      ) : null}
      {settings ? (
        <form className="esk-panel mt-4 max-w-xl print:hidden" onSubmit={saveSettings}>
          <h2>Grading cutoffs</h2>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">Weak is below the first number. Strong starts at the second. Defaults are 60 and 80.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Weak below"><input className={control} name="weakBelow" type="number" defaultValue={settings.weakBelow} required /></Field>
            <Field label="Strong from"><input className={control} name="strongFrom" type="number" defaultValue={settings.strongFrom} required /></Field>
            <Field label="Overall fail at or below"><input className={control} name="overallFailAt" type="number" defaultValue={settings.overallFailAt} required /></Field>
            <Field label="Subject fail at or below"><input className={control} name="subjectFailAt" type="number" defaultValue={settings.subjectFailAt} required /></Field>
            <Field label="Fail if this many subjects fail"><input className={control} name="failSubjectCount" type="number" min="1" defaultValue={settings.failSubjectCount} required /></Field>
          </div>
          <button className="esk-btn-primary" type="submit"><i className="fa-light fa-check" /> Save cutoffs</button>
        </form>
      ) : null}
      {message ? <p className="mt-3 text-sm text-[var(--esk-purple)] print:hidden">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600 print:hidden">{error}</p> : null}
    </PageChrome>
  );
}
