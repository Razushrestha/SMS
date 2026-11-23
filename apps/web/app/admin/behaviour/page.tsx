"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";

type Person = { id: string; name: string; registrationNo?: string };
type ClassRow = { id: string; name: string };
type Catalog = { affective: string[]; psychomotor: string[] };
type Report = { className: string; traits: string[]; students: Array<{ registrationNo: string; name: string; percent: number | null; traits: Array<number | null> }> };

export default function BehaviourPage() {
  const [students, setStudents] = useState<Person[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ affective: [], psychomotor: [] });
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [studentId, setStudentId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [reportClassId, setReportClassId] = useState("");
  const [reportDomain, setReportDomain] = useState<"affective" | "psychomotor">("affective");
  const [report, setReport] = useState<Report | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Person[]>("/students"),
      api<ClassRow[]>("/classes"),
      api<Catalog>("/behaviour/catalog"),
      api<{ institute: Institute }>("/institute"),
    ])
      .then(([people, rooms, traits, profile]) => {
        setStudents(people);
        setClasses(rooms);
        setCatalog(traits);
        setInstitute(profile.institute);
        if (people[0]) setStudentId(people[0].id);
        if (rooms[0]) setReportClassId(rooms[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const ratings = Object.entries(scores).filter(([, value]) => value).map(([trait, rating]) => ({ trait, rating: Number(rating) }));
    try {
      await api("/behaviour", { method: "POST", body: JSON.stringify({ studentId, ratings }) });
      setNote("Ratings saved. Unmarked traits stay off the report-card average.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ratings");
    }
  }

  async function observe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await api("/behaviour/observations", { method: "POST", body: JSON.stringify({ studentId, note: data.get("note"), date: data.get("date") }) });
    form.reset();
    setNote("Observation saved.");
  }

  async function loadReport() {
    if (!reportClassId) return;
    setError("");
    try {
      setReport(await api<Report>(`/behaviour/report?classId=${reportClassId}&domain=${reportDomain}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the report");
    }
  }

  function fields(names: string[]) {
    return names.map((name) => (
      <label key={name} className="grid grid-cols-[1fr_80px] items-center gap-2 text-sm">
        {name}
        <input className={control} inputMode="numeric" maxLength={1} value={scores[name] ?? ""} onChange={(event) => setScores({ ...scores, [name]: event.target.value })} />
      </label>
    ));
  }

  return (
    <PageChrome icon="fa-light fa-eye" crumbs={[{ label: "Behaviour & Skills", href: "/admin/behaviour" }, { label: "Ratings" }]}>
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">Rate from 1 to 5. A blank trait stays “not rated.”</p>
      <div className="grid gap-4 lg:grid-cols-2 print:hidden">
        <form className="esk-panel" onSubmit={save}>
          <h2>Student ratings</h2>
          <div className="mt-3">
            <Field label="Student">
              <select className={control} value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                {students.map((person) => <option key={person.id} value={person.id}>{person.registrationNo} · {person.name}</option>)}
              </select>
            </Field>
            <h3 className="mb-2 font-semibold">Affective</h3>
            <div className="space-y-2">{fields(catalog.affective)}</div>
            <h3 className="mb-2 mt-4 font-semibold">Psychomotor</h3>
            <div className="space-y-2">{fields(catalog.psychomotor)}</div>
            <button className="esk-btn-primary mt-4" type="submit"><i className="fa-light fa-check" /> Save ratings</button>
          </div>
        </form>
        <div className="space-y-4">
          <form className="esk-panel" onSubmit={observe}>
            <h2>Observation</h2>
            <Field label="Date"><input className={control} name="date" type="date" defaultValue={today()} required /></Field>
            <Field label="Note"><textarea className={control} name="note" required rows={3} /></Field>
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Save observation</button>
          </form>
          {note ? <p className="text-sm text-[var(--esk-purple)]">{note}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="mt-4 print:hidden">
        <FilterCard>
          <Field label="Class">
            <select className={control} value={reportClassId} onChange={(event) => setReportClassId(event.target.value)}>
              {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </Field>
          <Field label="Domain">
            <select className={control} value={reportDomain} onChange={(event) => setReportDomain(event.target.value as "affective" | "psychomotor")}>
              <option value="affective">Affective</option>
              <option value="psychomotor">Psychomotor</option>
            </select>
          </Field>
          <button className="esk-btn-primary mb-1" type="button" onClick={() => void loadReport()}><i className="fa-light fa-table" /> Load report</button>
          {report ? (
            <button className="esk-btn-ghost mb-1" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button>
          ) : null}
        </FilterCard>
      </div>

      {report ? (
        <article className="esk-report-doc mt-4">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-eye text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>{report.className} · {reportDomain}</h2>
              <p>{institute?.name ?? "School"} · Behaviour class report</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Traits</th>
              </tr>
            </thead>
            <tbody>
              {report.students.map((person) => (
                <tr key={person.registrationNo}>
                  <td>{person.registrationNo} · {person.name}</td>
                  <td>{person.percent === null ? "not rated" : `${person.percent}%`}</td>
                  <td>{report.traits.map((trait, index) => person.traits[index] === null ? null : `${trait} ${person.traits[index]}`).filter(Boolean).join(", ") || "no ratings"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : (
        <DataCard>
          <div className="esk-empty">
            <div><i className="fa-light fa-eye" /></div>
            <h5>No Report Selected</h5>
            <p>Choose a class and domain, then load the report.</p>
          </div>
        </DataCard>
      )}
    </PageChrome>
  );
}
