"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";
import { usePortalStudent } from "@/lib/portal-student";

type Meeting = { id: string; title: string; meetingCode: string; audience: string; date: string | null; time: string | null; duration: string; message: string; active: boolean };
type ClassRow = { id: string; name: string };
type Person = { id: string; name: string };

const filters = [
  { id: "all", label: "All Meetings" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "self", label: "Self Hosted" },
  { id: "invitations", label: "Invitations" },
];

export default function LiveClassPage() {
  const { ready, isStudent, error: portalError } = usePortalStudent();
  const [rows, setRows] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState("all");
  const [scheduled, setScheduled] = useState(false);
  const [audience, setAudience] = useState("all_students");
  const [message, setMessage] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");

  async function load(next = filter) {
    setRows(await api<Meeting[]>(`/meetings?filter=${next}`));
  }

  useEffect(() => {
    if (!ready) return;
    if (!isStudent) {
      Promise.all([
        api<ClassRow[]>("/classes"),
        api<Person[]>("/students"),
        api<Array<Person & { status: string }>>("/employees"),
        api<{ institute: Institute }>("/institute"),
      ])
        .then(([rooms, people, employees, profile]) => {
          setClasses(rooms);
          setStudents(people);
          setTeachers(employees.filter((person) => person.status === "active"));
          setInstitute(profile.institute);
        })
        .catch((err: Error) => setError(err.message));
    } else {
      api<{ institute: Institute }>("/institute")
        .then((profile) => setInstitute(profile.institute))
        .catch((err: Error) => setError(err.message));
    }
    load().catch((err: Error) => setError(err.message));
  }, [ready, isStudent]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      const created = await api<{ joinPath: string }>("/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          meetingCode: data.get("meetingCode"),
          audience,
          classId: data.get("classId"),
          studentId: data.get("studentId"),
          employeeId: data.get("employeeId"),
          duration: data.get("duration"),
          message,
          scheduled,
          date: data.get("date"),
          time: data.get("time"),
        }),
      });
      form.reset();
      setMessage("");
      setScheduled(false);
      await load();
      if (!scheduled) window.open(created.joinPath, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the meeting");
    }
  }

  async function toggle(row: Meeting) {
    await api(`/meetings/${row.id}`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) });
    await load();
  }

  async function remove(row: Meeting) {
    if (!confirm("Delete this meeting?")) return;
    await api(`/meetings/${row.id}`, { method: "DELETE" });
    await load();
  }

  const scheduleDoc = rows.length ? (
    <article className="esk-report-doc mt-4">
      <header className="esk-letter-head">
        {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-video text-2xl text-[var(--esk-purple)]" />}
        <div>
          <h2>Live class schedule</h2>
          <p>{institute?.name ?? "School"} · {filters.find((item) => item.id === filter)?.label ?? "Meetings"} · {rows.length} meeting{rows.length === 1 ? "" : "s"}</p>
        </div>
      </header>
      <table className="esk-receipt-table">
        <thead>
          <tr>
            <th>Meeting</th>
            <th>Code</th>
            <th>When</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.title}
                <div className="text-xs text-[var(--esk-muted)]">{row.audience}</div>
              </td>
              <td>{row.meetingCode}</td>
              <td>{row.date || "—"} {row.time || ""}</td>
              <td>{row.duration}</td>
              <td>{row.active ? "Active" : "Scheduled"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  ) : null;

  if (isStudent) {
    return (
      <PageChrome icon="fa-light fa-video" crumbs={[{ label: "Live Class" }]}>
        <div className="print:hidden">
          <StudentPanelHead title="Live Class" hint="Join meetings scheduled for your class." />
          {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
          <div className="mb-3 flex flex-wrap gap-2">
            {filters.filter((item) => item.id !== "self").map((item) => (
              <button
                key={item.id}
                className={filter === item.id ? "esk-btn-primary" : "esk-btn-ghost"}
                type="button"
                onClick={() => { setFilter(item.id); load(item.id).catch((err: Error) => setError(err.message)); }}
              >
                {item.label}
              </button>
            ))}
            {rows.length ? (
              <button className="esk-btn-primary ml-auto" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            ) : null}
          </div>
          <DataCard>
            {rows.length === 0 ? (
              <div className="esk-empty">
                <div><i className="fa-light fa-video" /></div>
                <h5>No Meetings Found</h5>
                <p>Live classes for your class will appear here.</p>
              </div>
            ) : (
              <table className="esk-table">
                <thead>
                  <tr>
                    <th>Meeting</th>
                    <th>When</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <p className="font-semibold">{row.title}</p>
                        <p className="text-xs text-[var(--esk-muted)]">{row.audience} · {row.meetingCode}</p>
                        {row.message ? <p className="mt-1 text-xs text-[var(--esk-muted)]">{row.message}</p> : null}
                      </td>
                      <td>{row.date || "—"} {row.time || ""} · {row.duration}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.active ? "bg-[var(--esk-teal)]/15 text-[var(--esk-teal)]" : "bg-[var(--esk-bg)] text-[var(--esk-muted)]"}`}>
                          {row.active ? "Active" : "Scheduled"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button className="esk-btn-primary disabled:opacity-40" type="button" disabled={!row.active} onClick={() => window.open(`/admin/live/${encodeURIComponent(row.meetingCode)}`, "_blank")}>
                          Join
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>
        </div>
        <div className="hidden print:block">{scheduleDoc}</div>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-video"
      crumbs={[{ label: "Live Class", href: "/admin/live" }, { label: "Meetings" }]}
      actions={
        <button className="esk-btn-primary print:hidden" type="button" disabled={!rows.length} onClick={() => window.print()}>
          <i className="fa-light fa-print" /> Print
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[340px_1fr] print:hidden">
        <form className="esk-panel" onSubmit={onSubmit}>
          <h2>New meeting</h2>
          <div className="mt-3">
            <Field label="Title"><input className={control} name="title" required /></Field>
            <Field label="Meeting ID"><input className={control} name="meetingCode" required /></Field>
            <Field label="Audience">
              <select className={control} value={audience} onChange={(event) => setAudience(event.target.value)}>
                <option value="all_students">All Students</option>
                <option value="all_teachers">All Teachers</option>
                <option value="class">Specific Class</option>
                <option value="student">Specific Student</option>
                <option value="employee">Specific Teacher</option>
              </select>
            </Field>
            {audience === "class" ? <Field label="Class"><select className={control} name="classId" required defaultValue="">{classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></Field> : null}
            {audience === "student" ? <Field label="Student"><select className={control} name="studentId" required defaultValue="">{students.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field> : null}
            {audience === "employee" ? <Field label="Teacher"><select className={control} name="employeeId" required defaultValue="">{teachers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field> : null}
            <Field label="Duration"><input className={control} name="duration" placeholder="1 hour 30 minutes" required /></Field>
            <Field label="Message"><textarea className={control} maxLength={260} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
            <p className="mb-3 text-xs text-[var(--esk-muted)]">{260 - message.length} characters left</p>
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} /> Schedule</label>
            {scheduled ? (
              <>
                <Field label="Date"><input className={control} name="date" type="date" defaultValue={today()} required /></Field>
                <Field label="Start time"><input className={control} name="time" type="time" required /></Field>
              </>
            ) : null}
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-video" /> {scheduled ? "Schedule" : "Create & Join"}</button>
          </div>
        </form>
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                className={filter === item.id ? "esk-btn-primary" : "esk-btn-ghost"}
                type="button"
                onClick={() => { setFilter(item.id); load(item.id).catch((err: Error) => setError(err.message)); }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <DataCard>
            {rows.length === 0 ? (
              <div className="esk-empty">
                <div><i className="fa-light fa-video" /></div>
                <h5>No Meetings Found</h5>
                <p>Create a live class or change the filter.</p>
              </div>
            ) : (
              <table className="esk-table">
                <thead>
                  <tr>
                    <th>Meeting</th>
                    <th>When</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <p className="font-semibold">{row.title}</p>
                        <p className="text-xs text-[var(--esk-muted)]">{row.audience} · {row.meetingCode}</p>
                        {row.message ? <p className="mt-1 text-xs text-[var(--esk-muted)]">{row.message}</p> : null}
                      </td>
                      <td>{row.date || "—"} {row.time || ""} · {row.duration}</td>
                      <td>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={row.active} onChange={() => void toggle(row)} />
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.active ? "bg-[var(--esk-teal)]/15 text-[var(--esk-teal)]" : "bg-[var(--esk-bg)] text-[var(--esk-muted)]"}`}>
                            {row.active ? "Active" : "Scheduled"}
                          </span>
                        </label>
                      </td>
                      <td className="text-right">
                        <button className="esk-btn-ghost disabled:opacity-40" type="button" disabled={!row.active} onClick={() => window.open(`/admin/live/${encodeURIComponent(row.meetingCode)}`, "_blank")}>Join</button>
                        <button className="ml-2 text-red-600" type="button" onClick={() => void remove(row)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>
        </div>
      </div>
      <div className="hidden print:block">{scheduleDoc}</div>
    </PageChrome>
  );
}
