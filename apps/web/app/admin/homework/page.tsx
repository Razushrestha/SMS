"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { ChildPicker } from "@/components/child-picker";
import { DataCard, FilterCard, PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";
import { usePortalStudent } from "@/lib/portal-student";

type ClassRow = { id: string; name: string };
type Subject = { id: string; name: string };
type Employee = { id: string; name: string; status: string };
type Row = { id: string; homeworkDate: string; className: string; subjectName: string; teacherName: string; detail: string; attachmentName: string | null };

const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export default function HomeworkPage() {
  const { ready, isPortal: isStudent, isParent, me, children, setMe, error: portalError } = usePortalStudent();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [classId, setClassId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);

  async function load(nextClassId?: string) {
    const query = nextClassId ? `?classId=${encodeURIComponent(nextClassId)}` : "";
    setRows(await api<Row[]>(`/learning/homework${query}`));
  }

  useEffect(() => {
    if (!ready) return;
    if (isStudent) {
      if (!me) return;
      Promise.all([
        load(me.classId),
        api<{ institute: Institute }>("/institute").then((profile) => setInstitute(profile.institute)),
      ]).catch((err: Error) => setError(err.message));
      return;
    }
    Promise.all([
      api<ClassRow[]>("/classes"),
      api<Employee[]>("/employees"),
      api<{ institute: Institute }>("/institute"),
      load(),
    ]).then(([rooms, people, profile]) => {
      setClasses(rooms);
      setTeachers(people.filter((person) => person.status === "active"));
      setInstitute(profile.institute);
    }).catch((err: Error) => setError(err.message));
  }, [ready, isStudent, me]);

  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      return;
    }
    api<Subject[]>(`/subjects?classId=${classId}`).then(setSubjects).catch((err: Error) => setError(err.message));
  }, [classId]);

  async function onFile(selected: File | undefined) {
    setError("");
    if (!selected) {
      setFile(null);
      return;
    }
    if (!allowed.includes(selected.type) || selected.size > 100 * 1024) {
      setFile(null);
      setError("Attachment must be a JPG, PNG, GIF, WEBP, or PDF, and 100 KB or smaller");
      return;
    }
    const data = await selected.arrayBuffer();
    const bytes = new Uint8Array(data);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    setFile({ name: selected.name, data: `data:${selected.type};base64,${btoa(binary)}` });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      await api("/learning/homework", {
        method: "POST",
        body: JSON.stringify({
          date: data.get("date"),
          classId: data.get("classId"),
          subjectId: data.get("subjectId"),
          setByEmployeeId: data.get("setBy") || null,
          detail: data.get("detail"),
          attachmentName: file?.name,
          attachmentData: file?.data,
        }),
      });
      form.reset();
      setFile(null);
      setClassId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the homework");
    }
  }

  async function remove(id: string) {
    if (!confirm("Are you sure to Delete?")) return;
    await api(`/learning/homework/${id}`, { method: "DELETE" });
    await load();
  }

  if (isStudent) {
    return (
      <PageChrome icon="fa-light fa-book" crumbs={[{ label: isParent ? "Homework" : "Home Assignments" }]}>
        <div className="print:hidden">
          <StudentPanelHead title={isParent ? "Homework" : "Home Assignments"} hint={`Homework for ${me?.className ?? "your class"}.`} />
          {isParent ? <ChildPicker options={children} selected={me} onSelect={setMe} /> : null}
          {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
          {rows.length ? (
            <div className="mb-3 flex justify-end">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            </div>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-book" /></div>
            <h5>No Homework Yet</h5>
            <p>Assignments for {me?.className ?? "your class"} will show here.</p>
          </div>
        ) : (
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-book text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Homework</h2>
                <p>{institute?.name ?? "School"} · {me?.name} · {me?.className}</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Assignment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.homeworkDate}</td>
                    <td>{row.subjectName}</td>
                    <td>{row.teacherName}</td>
                    <td>
                      {row.detail}
                      {row.attachmentName ? <div className="text-xs text-[var(--esk-muted)]">{row.attachmentName}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </PageChrome>
    );
  }

  const filterLabel = classes.find((room) => room.id === filterClassId)?.name;

  return (
    <PageChrome icon="fa-light fa-book-open" crumbs={[{ label: "Homework", href: "/admin/homework" }, { label: "Assign Homework" }]}>
      <div className="print:hidden">
        <FilterCard>
          <Field label="Filter by class">
            <select
              className={control}
              value={filterClassId}
              onChange={(event) => {
                const next = event.target.value;
                setFilterClassId(next);
                void load(next || undefined).catch((err: Error) => setError(err.message));
              }}
            >
              <option value="">All classes</option>
              {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </Field>
          <button className="esk-btn-ghost mb-1" type="button" disabled={!rows.length} onClick={() => window.print()}>
            <i className="fa-light fa-print" /> Print sheet
          </button>
        </FilterCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr] print:hidden">
        <form className="esk-panel" onSubmit={onSubmit}>
          <h2>Add homework</h2>
          <div className="mt-3">
            <Field label="Date"><input className={control} name="date" type="date" defaultValue={today()} required /></Field>
            <Field label="Set by">
              <select className={control} name="setBy" defaultValue="">
                <option value="">Admin</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </Field>
            <Field label="Class">
              <select className={control} name="classId" required value={classId} onChange={(event) => setClassId(event.target.value)}>
                <option value="" disabled>Select a class</option>
                {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <select className={control} name="subjectId" required defaultValue="" disabled={!classId}>
                <option value="" disabled>{classId ? "Select a subject" : "Choose a class first"}</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </Field>
            <Field label="Detail"><textarea className={control} name="detail" required rows={4} /></Field>
            <Field label="Attachment">
              <input className={control} type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf" onChange={(event) => void onFile(event.target.files?.[0])} />
            </Field>
            {file ? <p className="mb-3 text-xs text-[var(--esk-muted)]">{file.name}</p> : null}
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Save homework</button>
          </div>
        </form>
        <DataCard>
          {rows.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-book-open" /></div>
              <h5>No Homework Yet</h5>
              <p>{filterClassId ? "No homework for this class." : "Assign homework for a class and subject."}</p>
            </div>
          ) : (
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Assignment</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.homeworkDate}</td>
                    <td>
                      <p className="font-medium">{row.teacherName} · {row.className} · {row.subjectName}</p>
                      <p className="mt-1 text-[var(--esk-muted)]">{row.detail}</p>
                      {row.attachmentName ? <p className="text-xs text-[var(--esk-muted)]">{row.attachmentName}</p> : null}
                    </td>
                    <td className="text-right">
                      <button className="text-red-600" type="button" onClick={() => void remove(row.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
      </div>
      {rows.length ? (
        <article className="esk-report-doc mt-4 hidden print:block">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-book-open text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Homework sheet</h2>
              <p>{institute?.name ?? "School"}{filterLabel ? ` · ${filterLabel}` : " · All classes"}</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead><tr><th>Date</th><th>Class</th><th>Subject</th><th>Set by</th><th>Detail</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.homeworkDate}</td>
                  <td>{row.className}</td>
                  <td>{row.subjectName}</td>
                  <td>{row.teacherName}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}
    </PageChrome>
  );
}
