"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { ChildPicker } from "@/components/child-picker";
import { FilterCard, PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { usePortalStudent } from "@/lib/portal-student";

type Card = {
  student: { registrationNo: string; name: string; className: string; dateOfBirth: string | null; gender: string | null; admissionDate: string };
  attendance: string;
  affective: { label: string; traits: Array<{ name: string; rating: number | null }> };
  psychomotor: { label: string; traits: Array<{ name: string; rating: number | null }> };
  overallPercent: number | null;
  grade: string;
  status: string;
  outOf5: number | string;
  position: number | null;
  unmarkedSections: string[];
  exams: Array<{ examName: string; percent: number | null; grade: string | null; status: string | null; sentence: string | null }>;
  classTests: Array<{ subjectName: string; percent: number }>;
  classComparison: { strength: number; average: number; max: number; min: number; position: number | null } | null;
};

export default function ReportCardPage() {
  const { ready, isPortal: isStudent, isParent, me, children, setMe, error: portalError } = usePortalStudent();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !isStudent || !me) return;
    setCard(null);
    api<Card>(`/learning/report-cards?registration=${encodeURIComponent(me.registrationNo)}`)
      .then(setCard)
      .catch((err: Error) => setError(err.message));
  }, [ready, isStudent, me]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const registration = String(new FormData(event.currentTarget).get("registration"));
    setError("");
    try {
      setCard(await api<Card>(`/learning/report-cards?registration=${encodeURIComponent(registration)}`));
    } catch (err) {
      setCard(null);
      setError(err instanceof Error ? err.message : "Student not found.");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-file-lines"
      crumbs={isStudent ? [{ label: isParent ? "Report Card" : "My Report Card" }] : [{ label: "Reports", href: "/admin/reports" }, { label: "Report Card" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          {card ? <button className="esk-btn-primary" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button> : null}
          {isStudent ? null : <Link className="esk-btn-ghost" href="/admin/report-cards/progress">Progress report</Link>}
        </div>
      }
    >
      <div className="print:hidden">
        {isStudent ? (
          <>
            <StudentPanelHead title={isParent ? "Report Card" : "My Report Card"} hint={isParent ? "Academic report for the selected child." : "Your academic report for the current term."} />
            {isParent ? <ChildPicker options={children} selected={me} onSelect={setMe} /> : null}
          </>
        ) : (
          <FilterCard>
            <form className="contents" onSubmit={onSubmit}>
              <Field label="Registration"><input className={control} name="registration" defaultValue="1" required /></Field>
              <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-file-lines" /> Open</button>
            </form>
          </FilterCard>
        )}
        {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
      </div>
      {card ? (
        <article className="esk-rc mx-auto mt-2 max-w-4xl">
          <div className="esk-rc-hero">
            <div>
              <h2>{card.student.name}</h2>
              <p>Reg: {card.student.registrationNo} · Class: {card.student.className}</p>
              <p>
                {card.student.dateOfBirth ? `DOB: ${card.student.dateOfBirth}` : "DOB: —"}
                {" · "}
                ADM: {card.student.admissionDate}
                {card.student.gender ? ` · ${card.student.gender}` : ""}
              </p>
            </div>
            <div className="esk-rc-stats">
              <div className="esk-rc-stat"><strong>{card.attendance}</strong><span>Attendance</span></div>
              <div className="esk-rc-stat"><strong>{card.overallPercent ?? "—"}%</strong><span>Overall Score</span></div>
              <div className="esk-rc-stat"><strong>{card.grade || "—"}</strong><span>Grade</span></div>
              <div className="esk-rc-stat"><strong>{card.position ?? "—"}</strong><span>{card.outOf5} / 5</span></div>
            </div>
          </div>

          <section className="esk-rc-section">
            <h3>Cognitive Domain - Examination</h3>
            {card.exams.length ? (
              <table className="esk-rc-table">
                <thead>
                  <tr>
                    <th>Examination</th>
                    <th>%</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {card.exams.map((exam) => (
                    <tr key={exam.examName}>
                      <td>
                        <strong>{exam.examName}</strong>
                        {exam.sentence ? <p className="text-xs text-[var(--esk-muted)]">{exam.sentence}</p> : null}
                      </td>
                      <td>{exam.percent ?? "—"}%</td>
                      <td>{exam.grade ?? "—"}</td>
                      <td>{exam.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-[var(--esk-muted)]">No examination marks yet.</p>
            )}
          </section>

          <section className="esk-rc-section">
            <h3>Cognitive Domain - Class Tests</h3>
            {card.classTests.length ? (
              <table className="esk-rc-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {card.classTests.map((test) => (
                    <tr key={test.subjectName}>
                      <td>{test.subjectName}</td>
                      <td>{test.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-[var(--esk-muted)]">No class test marks yet.</p>
            )}
          </section>

          {card.classComparison ? (
            <section className="esk-rc-section">
              <h3>Comparison with Class</h3>
              <div className="esk-rc-stats">
                <div className="esk-rc-stat"><strong>{card.classComparison.strength}</strong><span>Class Strength</span></div>
                <div className="esk-rc-stat"><strong>{card.classComparison.average}%</strong><span>Class Average</span></div>
                <div className="esk-rc-stat"><strong>{card.classComparison.max}%</strong><span>Max Average</span></div>
                <div className="esk-rc-stat"><strong>{card.classComparison.min}%</strong><span>Min Average</span></div>
              </div>
            </section>
          ) : null}

          <section className="esk-rc-section">
            <h3>Affective Domains · {card.affective.label}</h3>
            <div className="esk-rc-traits">
              {card.affective.traits.filter((trait) => trait.rating !== null).map((trait) => (
                <div key={trait.name}><span>{trait.name}</span><strong>{trait.rating} / 5</strong></div>
              ))}
              {!card.affective.traits.some((trait) => trait.rating !== null) ? <p className="text-sm text-[var(--esk-muted)]">Not rated yet.</p> : null}
            </div>
          </section>

          <section className="esk-rc-section">
            <h3>Psychomotor Domains · {card.psychomotor.label}</h3>
            <div className="esk-rc-traits">
              {card.psychomotor.traits.filter((trait) => trait.rating !== null).map((trait) => (
                <div key={trait.name}><span>{trait.name}</span><strong>{trait.rating} / 5</strong></div>
              ))}
              {!card.psychomotor.traits.some((trait) => trait.rating !== null) ? <p className="text-sm text-[var(--esk-muted)]">Not rated yet.</p> : null}
            </div>
          </section>

          {card.unmarkedSections.length ? (
            <p className="mt-4 text-xs text-[var(--esk-muted)]">Not rated: {card.unmarkedSections.join(", ")}</p>
          ) : null}
        </article>
      ) : isStudent && ready ? (
        <p className="text-sm text-[var(--esk-muted)]">Loading your report card…</p>
      ) : null}
    </PageChrome>
  );
}
