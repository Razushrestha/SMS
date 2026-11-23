"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Exam = { id: string; name: string; startDate: string; endDate: string; status: string };
type SetupSubject = {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  included: boolean;
  totalMarks: number | string | null;
  examDate: string | null;
  startsAt: string | null;
};

export default function QuestionPaperPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [subjects, setSubjects] = useState<SetupSubject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [blankLines, setBlankLines] = useState(8);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Exam[]>("/learning/exams"), api<{ institute: Institute }>("/institute")])
      .then(([list, profile]) => {
        setExams(list);
        setInstitute(profile.institute);
        if (list[0]) setExamId(list[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!examId) {
      setSubjects([]);
      setSubjectId("");
      return;
    }
    api<{ subjects: SetupSubject[] }>(`/learning/exams/${examId}/setup`)
      .then((data) => {
        const included = data.subjects.filter((row) => row.included);
        setSubjects(included.length ? included : data.subjects);
        setSubjectId((included[0] ?? data.subjects[0])?.subjectId ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, [examId]);

  const exam = exams.find((row) => row.id === examId) ?? null;
  const subject = subjects.find((row) => row.subjectId === subjectId) ?? null;
  const lines = useMemo(() => Array.from({ length: Math.max(3, Math.min(20, blankLines)) }, (_, index) => index + 1), [blankLines]);

  return (
    <PageChrome
      icon="fa-light fa-file-lines"
      crumbs={[{ label: "Question Paper" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link className="esk-btn-ghost" href="/admin/exams">Exams</Link>
          <Link className="esk-btn-ghost" href="/admin/tests">Class Tests</Link>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">
        Print a blank paper shell from an exam subject. Marks and schedule come from exam setup; write questions by hand or paste later.
      </p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      <div className="print:hidden">
        <FilterCard>
          <Field label="Exam">
            <select className={control} value={examId} onChange={(event) => setExamId(event.target.value)}>
              {exams.length === 0 ? <option value="">No exams yet</option> : null}
              {exams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <select className={control} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
              {subjects.length === 0 ? <option value="">No subjects in setup</option> : null}
              {subjects.map((row) => (
                <option key={row.subjectId} value={row.subjectId}>
                  {row.className} · {row.subjectName}{row.included ? "" : " (not included)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Answer lines">
            <input
              className={control}
              type="number"
              min={3}
              max={20}
              value={blankLines}
              onChange={(event) => setBlankLines(Number(event.target.value) || 8)}
            />
          </Field>
          <button className="esk-btn-primary mb-1" type="button" disabled={!subject} onClick={() => window.print()}>
            <i className="fa-light fa-print" /> Print paper
          </button>
        </FilterCard>
      </div>

      {exam && subject ? (
        <article className="esk-qp mt-4">
          <p className="esk-qp-sub">{institute?.name}</p>
          <h1 className="esk-qp-title">{exam.name}</h1>
          <p className="esk-qp-sub">Question Paper · {subject.className} · {subject.subjectName}</p>
          <div className="esk-qp-meta">
            <div><strong>Total marks</strong><br />{subject.totalMarks ?? "—"}</div>
            <div><strong>Date</strong><br />{subject.examDate ?? exam.startDate}</div>
            <div><strong>Starts</strong><br />{subject.startsAt ?? "—"}</div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <p>Name: ______________________________</p>
            <p>Roll / Reg: ________________________</p>
          </div>
          <div className="esk-qp-section">
            <h3>Section A — Answer in the space provided</h3>
            {lines.map((number) => (
              <div key={number}>
                <p className="text-sm font-semibold text-[var(--esk-navy)]">Q{number}.</p>
                <div className="esk-qp-blank" />
                <div className="esk-qp-blank" />
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-[var(--esk-muted)]">— End of paper —</p>
        </article>
      ) : (
        <div className="esk-panel mt-4 print:hidden">
          <p className="text-sm text-[var(--esk-muted)]">
            {exams.length === 0
              ? "Create an exam first, then open Question Paper again."
              : "Add subjects to this exam under Exams → setup, then print a paper shell here."}
          </p>
        </div>
      )}
    </PageChrome>
  );
}
