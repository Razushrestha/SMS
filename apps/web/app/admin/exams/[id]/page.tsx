"use client";

import Link from "next/link";
import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type SetupSubject = { subjectId: string; subjectName: string; className: string; defaultMarks: number; included: boolean; totalMarks: number | null; examDate: string | null; startsAt: string | null };
type Sitting = { className: string; subjectName: string; examDate: string | null; startsAt: string | null; total: number };
type DateSheet = { exam: { name: string; startDate: string; endDate: string }; rows: Sitting[] };
type Student = { id: string; registrationNo: string; name: string };
type Mark = { studentId: string; subjectId: string; obtained: string };
type Sheet = { className: string; subjects: Array<{ subjectId: string; subjectName: string; total: number }>; students: Student[]; marks: Mark[] };
type Result = { empty: boolean; message: string | null; sentence: string | null; percent: number | null; grade: string | null; status: string | null; obtained: number; total: number; subjects: Array<{ subjectName: string; obtained: number | null; total: number; percent: number | null; grade: string | null; status: string }> };
type ResultSheet = { exam: { name: string; startDate: string; endDate: string }; className: string; subjects: Array<{ subjectId: string; subjectName: string; total: number }>; rows: Array<{ registrationNo: string; name: string; marks: Array<{ subjectId: string; obtained: number | null }>; obtained: number | null; total: number; percent: number | null; grade: string | null; status: string | null }> };
type Award = { exam: { name: string; startDate: string; endDate: string }; className: string; subjects: Array<{ subjectId: string; subjectName: string; total: number }>; students: Student[] };

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const examId = params.id;
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [setup, setSetup] = useState<SetupSubject[]>([]);
  const [emptySetup, setEmptySetup] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [resultSheet, setResultSheet] = useState<ResultSheet | null>(null);
  const [award, setAward] = useState<Award | null>(null);
  const [dateSheet, setDateSheet] = useState<DateSheet | null>(null);
  const [schedule, setSchedule] = useState<Array<Sitting & { examName: string }> | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [registration, setRegistration] = useState("1");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      api<Array<{ id: string; name: string }>>("/classes"),
      api<{ subjects: SetupSubject[]; emptyMessage: string | null }>(`/learning/exams/${examId}/setup`),
      api<{ institute: Institute }>("/institute"),
    ]).then(([rooms, current, profile]) => {
      setClasses(rooms);
      setSetup(current.subjects);
      setEmptySetup(current.emptyMessage);
      setInstitute(profile.institute);
    }).catch((err: Error) => setError(err.message));
  }, [examId]);

  async function saveSetup() {
    setError("");
    try {
      await api(`/learning/exams/${examId}/setup`, {
        method: "POST",
        body: JSON.stringify({
          subjects: setup.filter((row) => row.included).map((row) => ({ subjectId: row.subjectId, totalMarks: row.totalMarks, examDate: row.examDate, startsAt: row.startsAt })),
        }),
      });
      setMessage("Exam subjects saved. An empty total keeps the class default.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the exam subjects");
    }
  }

  async function openMarks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextClass = String(new FormData(event.currentTarget).get("classId"));
    setClassId(nextClass);
    setError("");
    try {
      const next = await api<Sheet>(`/learning/exams/${examId}/marks?classId=${nextClass}`);
      setSheet(next);
      const initial: Record<string, string> = {};
      for (const mark of next.marks) initial[`${mark.studentId}:${mark.subjectId}`] = String(mark.obtained);
      setValues(initial);
    } catch (err) {
      setSheet(null);
      setError(err instanceof Error ? err.message : "Could not open marks");
    }
  }

  async function saveMarks() {
    if (!sheet) return;
    setError("");
    const marks = sheet.students.flatMap((student) =>
      sheet.subjects.map((subject) => ({
        studentId: student.id,
        subjectId: subject.subjectId,
        obtained: values[`${student.id}:${subject.subjectId}`] ?? "",
      })),
    );
    try {
      await api(`/learning/exams/${examId}/marks`, { method: "POST", body: JSON.stringify({ classId, marks }) });
      setMessage("Marks saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save marks");
    }
  }

  async function showPrint(kind: "sheet" | "award", event: MouseEvent<HTMLButtonElement>) {
    const nextClass = String(new FormData(event.currentTarget.form!).get("classId"));
    if (!nextClass) {
      setError("Select a class");
      return;
    }
    setClassId(nextClass);
    setError("");
    try {
      if (kind === "sheet") setResultSheet(await api<ResultSheet>(`/learning/exams/${examId}/sheet?classId=${nextClass}`));
      else setAward(await api<Award>(`/learning/exams/${examId}/award?classId=${nextClass}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the printout");
    }
  }

  async function showResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const registration = String(new FormData(event.currentTarget).get("registration"));
    setError("");
    try {
      setResult(await api<Result>(`/learning/exams/${examId}/result?registration=${encodeURIComponent(registration)}`));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Could not open the result");
    }
  }

  async function showRecent(last: number) {
    setError("");
    try {
      const data = await api<{ exams: Result[] }>(`/learning/exams/recent?registration=${encodeURIComponent(registration)}&last=${last}`);
      setResult(data.exams[0] ?? null);
      setMessage(`Last ${last} exams loaded for reg ${registration}. Showing the newest.`);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Could not load recent results");
    }
  }

  async function clearStudent(studentId: string) {
    if (!confirm("Delete this student's marks? This cannot be undone.")) return;
    await api(`/learning/exams/${examId}/marks?studentId=${studentId}`, { method: "DELETE" });
    if (classId) {
      const next = await api<Sheet>(`/learning/exams/${examId}/marks?classId=${classId}`);
      setSheet(next);
      setValues({});
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-pen-to-square"
      crumbs={[{ label: "Exams", href: "/admin/exams" }, { label: "Exam Setup" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/exams">All exams</Link>}
    >
      <div className="space-y-4">
        {emptySetup ? <p className="text-sm text-[var(--esk-muted)]">{emptySetup}</p> : null}
        <DataCard>
          <div className="overflow-x-auto">
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Include</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Class default</th>
                  <th>Total for this exam</th>
                  <th>Date</th>
                  <th>Start</th>
                </tr>
              </thead>
              <tbody>
                {setup.map((row) => (
                  <tr key={row.subjectId}>
                    <td><input type="checkbox" checked={row.included} onChange={(event) => setSetup(setup.map((item) => item.subjectId === row.subjectId ? { ...item, included: event.target.checked } : item))} /></td>
                    <td>{row.className}</td>
                    <td>{row.subjectName}</td>
                    <td>{row.defaultMarks}</td>
                    <td><input className={control} type="number" min="1" placeholder="Keep default" value={row.totalMarks ?? ""} onChange={(event) => setSetup(setup.map((item) => item.subjectId === row.subjectId ? { ...item, totalMarks: event.target.value === "" ? null : Number(event.target.value) } : item))} /></td>
                    <td><input className={control} type="date" value={row.examDate ?? ""} onChange={(event) => setSetup(setup.map((item) => item.subjectId === row.subjectId ? { ...item, examDate: event.target.value || null } : item))} /></td>
                    <td><input className={control} type="time" value={row.startsAt ?? ""} onChange={(event) => setSetup(setup.map((item) => item.subjectId === row.subjectId ? { ...item, startsAt: event.target.value || null } : item))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 px-1">
            <button className="esk-btn-primary" onClick={saveSetup} type="button"><i className="fa-light fa-floppy-disk" /> Save subjects</button>
            <button className="esk-btn-ghost" type="button" onClick={() => api<DateSheet>(`/learning/exams/${examId}/datesheet`).then(setDateSheet).catch((err: Error) => setError(err.message))}><i className="fa-light fa-calendar" /> Date sheet</button>
            <button className="esk-btn-ghost" type="button" onClick={() => api<Array<Sitting & { examName: string }>>("/learning/exams/schedule").then(setSchedule).catch((err: Error) => setError(err.message))}><i className="fa-light fa-list" /> Exam schedule</button>
          </div>
        </DataCard>

        <FilterCard>
          <form className="contents" onSubmit={openMarks}>
            <Field label="Class for marks">
              <select className={control} name="classId" required defaultValue="">
                <option value="" disabled>Select a class</option>
                {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-table" /> Open mark sheet</button>
            <button className="esk-btn-ghost mb-1" type="button" onClick={(event) => showPrint("sheet", event)}>Result sheet</button>
            <button className="esk-btn-ghost mb-1" type="button" onClick={(event) => showPrint("award", event)}>Blank award list</button>
          </form>
        </FilterCard>

        {sheet ? (
          <DataCard>
            <div className="overflow-x-auto">
              <table className="esk-table">
                <thead>
                  <tr>
                    <th>Reg</th>
                    <th>Name</th>
                    {sheet.subjects.map((subject) => <th key={subject.subjectId}>{subject.subjectName} / {subject.total}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sheet.students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.registrationNo}</td>
                      <td>{student.name}</td>
                      {sheet.subjects.map((subject) => (
                        <td key={subject.subjectId}>
                          <input className={control} type="number" min="0" max={subject.total} step="any" value={values[`${student.id}:${subject.subjectId}`] ?? ""} onChange={(event) => setValues({ ...values, [`${student.id}:${subject.subjectId}`]: event.target.value })} />
                        </td>
                      ))}
                      <td><button className="text-red-600" type="button" onClick={() => clearStudent(student.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 px-1"><button className="esk-btn-primary" type="button" onClick={saveMarks}><i className="fa-light fa-floppy-disk" /> Save marks</button></div>
          </DataCard>
        ) : null}

        <FilterCard>
          <form className="contents" onSubmit={showResult}>
            <Field label="Registration for result card">
              <input className={control} name="registration" value={registration} onChange={(event) => setRegistration(event.target.value)} required />
            </Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-file-lines" /> Result card</button>
            <button className="esk-btn-ghost mb-1" type="button" onClick={() => void showRecent(2)}>Last 2</button>
            <button className="esk-btn-ghost mb-1" type="button" onClick={() => void showRecent(3)}>Last 3</button>
            <button className="esk-btn-ghost mb-1" type="button" onClick={() => void showRecent(4)}>Last 4</button>
          </form>
        </FilterCard>

        {dateSheet ? (
          <div className="space-y-3">
            <div className="flex justify-end print:hidden">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button>
            </div>
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-calendar text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Date sheet</h2>
                  <p>{institute?.name ?? "School"} · {dateSheet.exam.name} · {dateSheet.exam.startDate} to {dateSheet.exam.endDate}</p>
                </div>
              </header>
              <table className="esk-receipt-table">
                <thead><tr><th>Date</th><th>Start</th><th>Class</th><th>Subject</th><th>Total</th></tr></thead>
                <tbody>
                  {dateSheet.rows.length === 0 ? <tr><td colSpan={5}>No subjects are on this exam yet.</td></tr> : null}
                  {dateSheet.rows.map((row) => (
                    <tr key={`${row.className}-${row.subjectName}`}>
                      <td>{row.examDate || "Date not set"}</td>
                      <td>{row.startsAt || ""}</td>
                      <td>{row.className}</td>
                      <td>{row.subjectName}</td>
                      <td>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </div>
        ) : null}

        {schedule ? (
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-list text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Exam schedule</h2>
                <p>{institute?.name ?? "School"} · All exams</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead><tr><th>Date</th><th>Start</th><th>Exam</th><th>Class</th><th>Subject</th></tr></thead>
              <tbody>
                {schedule.length === 0 ? <tr><td colSpan={5}>No exam subjects yet.</td></tr> : null}
                {schedule.map((row) => (
                  <tr key={`${row.examName}-${row.className}-${row.subjectName}`}>
                    <td>{row.examDate || "Date not set"}</td>
                    <td>{row.startsAt || ""}</td>
                    <td>{row.examName}</td>
                    <td>{row.className}</td>
                    <td>{row.subjectName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ) : null}

        {resultSheet ? (
          <div className="space-y-3">
            <div className="flex justify-end print:hidden">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button>
            </div>
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-table text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Result sheet</h2>
                  <p>{institute?.name ?? "School"} · {resultSheet.exam.name} · {resultSheet.className} · {resultSheet.exam.startDate} to {resultSheet.exam.endDate}</p>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="esk-receipt-table">
                  <thead><tr><th>Reg</th><th>Name</th>{resultSheet.subjects.map((subject) => <th key={subject.subjectId}>{subject.subjectName}</th>)}<th>Total</th><th>Percent</th><th>Grade</th><th>Status</th></tr></thead>
                  <tbody>
                    {resultSheet.rows.map((row) => (
                      <tr key={row.registrationNo}>
                        <td>{row.registrationNo}</td>
                        <td>{row.name}</td>
                        {row.marks.map((mark) => <td key={mark.subjectId}>{mark.obtained ?? ""}</td>)}
                        <td>{row.obtained ?? ""}{row.obtained !== null ? ` / ${row.total}` : ""}</td>
                        <td>{row.percent ?? ""}</td>
                        <td>{row.grade ?? ""}</td>
                        <td>{row.status ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        ) : null}

        {award ? (
          <div className="space-y-3">
            <div className="flex justify-end print:hidden">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button>
            </div>
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-medal text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Blank award list</h2>
                  <p>{institute?.name ?? "School"} · {award.exam.name} · {award.className} · {award.exam.startDate} to {award.exam.endDate}</p>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="esk-receipt-table">
                  <thead><tr><th>Reg</th><th>Name</th>{award.subjects.map((subject) => <th key={subject.subjectId}>{subject.subjectName} / {subject.total}</th>)}<th>Total</th></tr></thead>
                  <tbody>
                    {award.students.map((student) => (
                      <tr key={student.id}>
                        <td>{student.registrationNo}</td>
                        <td>{student.name}</td>
                        {award.subjects.map((subject) => <td key={subject.subjectId} />)}
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        ) : null}

        {message ? <p className="text-sm text-[var(--esk-purple)] print:hidden">{message}</p> : null}
        {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}

        {result ? (
          <div className="space-y-3">
            <div className="flex justify-end print:hidden">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button>
            </div>
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-file-lines text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Result card</h2>
                  <p>{institute?.name ?? "School"} · Reg {registration}</p>
                </div>
              </header>
              {result.empty ? <p>{result.message}</p> : (
                <>
                  <p className="text-sm">{result.percent}% · grade {result.grade} · {result.status}</p>
                  <p className="mt-2 text-sm">{result.sentence}</p>
                  <table className="esk-receipt-table mt-3">
                    <thead><tr><th>Subject</th><th>Marks</th><th>%</th><th>Grade</th><th>Status</th></tr></thead>
                    <tbody>
                      {result.subjects.map((subject) => (
                        <tr key={subject.subjectName}>
                          <td>{subject.subjectName}</td>
                          <td>{subject.obtained ?? "—"} / {subject.total}</td>
                          <td>{subject.percent ?? "—"}%</td>
                          <td>{subject.grade}</td>
                          <td>{subject.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="esk-receipt-sign mt-6">
                    <span>Prepared By</span>
                    <span>Checked By</span>
                    <span>Controller of Examination</span>
                  </div>
                </>
              )}
            </article>
          </div>
        ) : null}
      </div>
    </PageChrome>
  );
}
