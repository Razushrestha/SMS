"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";

type ClassRow = { id: string; name: string };
type SheetRow = { personId: string; registrationNo: string; name: string; status: "present" | "leave" | "absent"; saved: boolean };
type Sheet = { date: string; classId: string; className: string; rows: SheetRow[] };
type OwnDay = { date: string; status: string; inTime: string | null; outTime: string | null };
type OwnPerson = { name: string; className: string; today: { status: string; inTime: string | null; outTime: string | null }; month: OwnDay[] };
type Own = { today: string; month: string; message: string; people: OwnPerson[] };
type Mode = "manual" | "card";

const statusLabel: Record<string, string> = { present: "Present", leave: "On Leave", absent: "Absent", "not marked": "not marked" };

const choices = [
  { value: "present", label: "Present" },
  { value: "leave", label: "Leave" },
  { value: "absent", label: "Absent" },
] as const;

export default function StudentAttendancePage() {
  const [mode, setMode] = useState<Mode>("manual");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [own, setOwn] = useState<Own | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ user: { role: string } }>("/auth/me")
      .then((session) => {
        if (session.user.role === "student" || session.user.role === "parent") {
          return Promise.all([
            api<Own>("/attendance/own"),
            api<{ institute: Institute }>("/institute"),
          ]).then(([attendance, profile]) => {
            setOwn(attendance);
            setInstitute(profile.institute);
          });
        }
        return Promise.all([
          api<ClassRow[]>("/classes"),
          api<{ institute: Institute }>("/institute"),
        ]).then(([rooms, profile]) => {
          setClasses(rooms);
          setInstitute(profile.institute);
        });
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function openSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    try {
      setSheet(await api<Sheet>(`/attendance/students?classId=${data.get("classId")}&date=${data.get("date")}`));
    } catch (err) {
      setSheet(null);
      setError(err instanceof Error ? err.message : "Could not open the sheet");
    }
  }

  function setStatus(personId: string, status: SheetRow["status"]) {
    setSheet((current) =>
      current
        ? { ...current, rows: current.rows.map((row) => (row.personId === personId ? { ...row, status } : row)) }
        : current,
    );
  }

  async function save() {
    if (!sheet) return;
    setError("");
    setMessage("");
    try {
      const result = await api<{ message: string }>("/attendance/students", {
        method: "POST",
        body: JSON.stringify({
          classId: sheet.classId,
          date: sheet.date,
          marks: sheet.rows.map((row) => ({ personId: row.personId, status: row.status })),
        }),
      });
      setMessage(result.message);
      setSheet({ ...sheet, rows: sheet.rows.map((row) => ({ ...row, saved: true })) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attendance");
    }
  }

  if (own) {
    const multi = own.people.length > 1;
    return (
      <PageChrome icon="fa-light fa-hand" crumbs={[{ label: "Attendance" }, { label: multi ? "Children" : "My Attendance" }]}>
        <div className="print:hidden">
          <StudentPanelHead
            title={multi ? "Children’s Attendance" : "Attendance"}
            hint="Today’s status, in-time, out-time, and this month for linked students only."
          />
          {own.message ? <p className="mb-3 text-sm">{own.message}</p> : null}
          {own.people.length ? (
            <div className="mb-3 flex justify-end">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {own.people.map((person) => (
              <article key={person.name} className="esk-panel">
                <h2>{person.name}</h2>
                <p className="text-sm text-[var(--esk-muted)]">{person.className}</p>
                <p className="mt-2 text-sm">{statusLabel[person.today.status] ?? person.today.status} · in {person.today.inTime && person.today.inTime !== "-" ? person.today.inTime : "—"} · out {person.today.outTime || "—"}</p>
                <MonthCalendar month={own.month} today={own.today} days={person.month} />
              </article>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
        {own.people.length ? (
          <article className="esk-report-doc hidden print:block">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-hand text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Attendance summary</h2>
                <p>{institute?.name ?? "School"} · {own.month}</p>
              </div>
            </header>
            {own.people.map((person) => (
              <section key={person.name} className="mt-4">
                <h3 className="text-base font-semibold">{person.name} · {person.className}</h3>
                <p className="mb-2 text-sm">
                  Today {statusLabel[person.today.status] ?? person.today.status}
                  {" · "}in {person.today.inTime && person.today.inTime !== "-" ? person.today.inTime : "—"}
                  {" · "}out {person.today.outTime || "—"}
                </p>
                <table className="esk-receipt-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>In</th>
                      <th>Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {person.month.length === 0 ? (
                      <tr><td colSpan={4}>No marks this month.</td></tr>
                    ) : person.month.map((day) => (
                      <tr key={day.date}>
                        <td>{day.date}</td>
                        <td>{statusLabel[day.status] ?? day.status}</td>
                        <td>{day.inTime && day.inTime !== "-" ? day.inTime : "—"}</td>
                        <td>{day.outTime || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </article>
        ) : null}
      </PageChrome>
    );
  }

  return (
    <PageChrome icon="fa-light fa-hand" crumbs={[{ label: "Attendance" }, { label: "Mark or update Student Attendance" }]}>
      <div className="esk-att-wrap print:hidden">
        <div className="esk-att-card">
          <div className="esk-fee-tabs" role="tablist">
            <button type="button" className={`esk-fee-tab ${mode === "manual" ? "active" : ""}`} onClick={() => setMode("manual")}>
              <i className="fa-light fa-pen-to-square" /> Manual Attendance
            </button>
            <button type="button" className={`esk-fee-tab ${mode === "card" ? "active" : ""}`} onClick={() => setMode("card")}>
              <i className="fa-light fa-barcode" /> Card Scanning
            </button>
          </div>

          {mode === "manual" ? (
            <div>
              <div className="esk-att-section">
                <span className="esk-att-num">1</span>
                <strong>Select Date & Class</strong>
              </div>
              <form onSubmit={openSheet}>
                <div className="esk-att-grid">
                  <Field label="Date *">
                    <input className={control} name="date" type="date" defaultValue={today()} required />
                  </Field>
                  <Field label="Class *">
                    <select className={control} name="classId" required defaultValue="">
                      <option value="" disabled>Select Class</option>
                      {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="esk-att-actions">
                  <button className="esk-btn-primary" type="submit"><i className="fa-light fa-check" /> Submit</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="esk-att-card-scan">
              <div className="esk-att-section">
                <span className="esk-att-num">2</span>
                <strong>Card Scanning</strong>
              </div>
              <div className="esk-att-rfid">
                <i className="fa-light fa-microchip" />
                <h5>RFID card attendance</h5>
                <p>Tap student cards on a paired reader. Opens the RFID devices page.</p>
                <Link className="esk-btn-primary" href="/admin/rfid">Open RFID</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {error ? <p className="mt-3 text-center text-sm text-red-600 print:hidden">{error}</p> : null}
      {message ? <p className="mt-3 text-center text-sm text-[var(--esk-purple)] print:hidden">{message}</p> : null}

      {sheet && mode === "manual" ? (
        <>
          <div className="print:hidden">
            <DataCard>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <p className="text-sm font-medium">{sheet.className} · {sheet.date}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="esk-btn-ghost" type="button" onClick={() => window.print()} disabled={sheet.rows.length === 0}>
                    <i className="fa-light fa-print" /> Print
                  </button>
                  <button className="esk-btn-primary" type="button" onClick={() => void save()} disabled={sheet.rows.length === 0}>
                    <i className="fa-light fa-floppy-disk" /> Save attendance
                  </button>
                </div>
              </div>
              {sheet.rows.length === 0 ? (
                <div className="esk-empty">
                  <div><i className="fa-light fa-users" /></div>
                  <h5>No Active Students</h5>
                  <p>This class has no active students.</p>
                </div>
              ) : (
                <table className="esk-table">
                  <thead>
                    <tr>
                      <th>Reg</th>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row) => (
                      <tr key={row.personId}>
                        <td>{row.registrationNo}</td>
                        <td>
                          {row.name}
                          {row.saved ? null : <span className="ml-2 text-xs text-[var(--esk-muted)]">not saved</span>}
                        </td>
                        <td>
                          <div className="esk-att-status">
                            {choices.map((choice) => (
                              <label key={choice.value} className={`esk-att-choice ${row.status === choice.value ? "active" : ""}`}>
                                <input type="radio" name={row.personId} checked={row.status === choice.value} onChange={() => setStatus(row.personId, choice.value)} />
                                {choice.label}
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DataCard>
          </div>
          {sheet.rows.length ? (
            <article className="esk-report-doc mt-4 hidden print:block">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-hand text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Student attendance sheet</h2>
                  <p>{institute?.name ?? "School"} · {sheet.className} · {sheet.date}</p>
                </div>
              </header>
              <table className="esk-receipt-table">
                <thead>
                  <tr>
                    <th>Reg</th>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row) => (
                    <tr key={row.personId}>
                      <td>{row.registrationNo}</td>
                      <td>{row.name}</td>
                      <td>{statusLabel[row.status] ?? row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ) : null}
        </>
      ) : null}
    </PageChrome>
  );
}

function MonthCalendar({ month, today, days }: { month: string; today: string; days: OwnDay[] }) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(year, mon, 0).getDate();
  const lead = new Date(year, mon - 1, 1).getDay();
  const marks = new Map(days.map((day) => [day.date, day]));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  const title = new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <div className="mt-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => <div key={label} className="text-[var(--esk-muted)]">{label}</div>)}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const mark = marks.get(date);
          return (
            <div key={date} className={`rounded p-1 ${date === today ? "bg-[var(--esk-purple)]/10 font-semibold" : "bg-[var(--esk-sidebar)]"}`}>
              <div>{day}</div>
              {mark ? <div>{statusLabel[mark.status] ?? mark.status}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
