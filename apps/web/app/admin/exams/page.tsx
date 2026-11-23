"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { ChildPicker } from "@/components/child-picker";
import { PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { usePortalStudent } from "@/lib/portal-student";

type Exam = { id: string; name: string; startDate: string; endDate: string; status: string };
type OwnExam = { examName: string; percent: number | null; grade: string | null; status: string | null; sentence: string | null; empty?: boolean };

export default function ExamsPage() {
  const { ready, isPortal: isStudent, isParent, me, children, setMe, error: portalError } = usePortalStudent();
  const [rows, setRows] = useState<Exam[]>([]);
  const [own, setOwn] = useState<OwnExam[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setRows(await api<Exam[]>("/learning/exams"));
  }

  useEffect(() => {
    if (!ready) return;
    if (isStudent) {
      if (!me) return;
      Promise.all([
        api<{ exams: OwnExam[] }>(`/learning/exams/recent?registration=${encodeURIComponent(me.registrationNo)}&last=4`),
        api<{ institute: Institute }>("/institute"),
      ])
        .then(([data, profile]) => {
          setOwn(data.exams ?? []);
          setInstitute(profile.institute);
        })
        .catch((err: Error) => setError(err.message));
      return;
    }
    Promise.all([
      load(),
      api<{ institute: Institute }>("/institute").then((profile) => setInstitute(profile.institute)),
    ]).catch((err: Error) => setError(err.message));
  }, [ready, isStudent, me]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      await api("/learning/exams", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), startDate: data.get("startDate"), endDate: data.get("endDate") }),
      });
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the exam");
    }
  }

  const published = own.filter((row) => !row.empty);

  if (isStudent) {
    return (
      <PageChrome icon="fa-light fa-pen" crumbs={[{ label: "Exam Result" }]}>
        <div className="print:hidden">
          <StudentPanelHead title="Exam Result" hint={isParent ? "Published examination marks for the selected child." : "Published examination marks for your registration."} />
          {isParent ? <ChildPicker options={children} selected={me} onSelect={setMe} /> : null}
          {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
          {published.length ? (
            <div className="mb-3 flex justify-end">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            </div>
          ) : null}
        </div>
        {published.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-pen" /></div>
            <h5>No Record Found.</h5>
            <p>Exam results will appear here after marks are published.</p>
          </div>
        ) : (
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-pen text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Exam results</h2>
                <p>{institute?.name ?? "School"} · {me?.name} · {me?.registrationNo} · {me?.className}</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Percent</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {published.map((row) => (
                  <tr key={row.examName}>
                    <td>{row.examName}</td>
                    <td>{row.percent ?? "—"}%</td>
                    <td>{row.grade ?? "—"}</td>
                    <td>{row.status ?? "—"}</td>
                    <td>{row.sentence ?? "—"}</td>
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
      icon="fa-light fa-pen-to-square"
      crumbs={[{ label: "Exams", href: "/admin/exams" }, { label: "Date Sheet" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link className="esk-btn-ghost" href="/admin/tests">Class Tests</Link>
          <button className="esk-btn-primary" type="button" disabled={!rows.length} onClick={() => window.print()}>
            <i className="fa-light fa-print" /> Print
          </button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] print:hidden">
        <form className="esk-panel" onSubmit={onSubmit}>
          <h2>New exam</h2>
          <div className="mt-3">
            <Field label="Exam name"><input className={control} name="name" required /></Field>
            <Field label="Start date"><input className={control} name="startDate" type="date" required /></Field>
            <Field label="End date"><input className={control} name="endDate" type="date" required /></Field>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Publish exam</button>
          </div>
        </form>
        {rows.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-pen-to-square" /></div>
            <h5>No Exams Yet</h5>
            <p>Publish an exam to build the date sheet.</p>
          </div>
        ) : (
          <div className="esk-panel overflow-x-auto">
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((exam) => (
                  <tr key={exam.id}>
                    <td>
                      <Link className="font-semibold text-[var(--esk-purple)]" href={`/admin/exams/${exam.id}`}>{exam.name}</Link>
                    </td>
                    <td>{exam.startDate} to {exam.endDate}</td>
                    <td className="capitalize">{exam.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length ? (
        <article className="esk-report-doc mt-4 hidden print:block">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-pen-to-square text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Exam date sheet</h2>
              <p>{institute?.name ?? "School"} · {rows.length} exam{rows.length === 1 ? "" : "s"}</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.name}</td>
                  <td>{exam.startDate}</td>
                  <td>{exam.endDate}</td>
                  <td className="capitalize">{exam.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}
    </PageChrome>
  );
}
