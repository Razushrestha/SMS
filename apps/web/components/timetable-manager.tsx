"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Field, control } from "@/components/auth-card";
import { ChildPicker } from "@/components/child-picker";
import { PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { usePortalStudent } from "@/lib/portal-student";

type Period = { id: string; name: string; startsAt: string; endsAt: string };
type Room = { id: string; name: string };
type ClassRow = { id: string; name: string };
type Subject = { id: string; name: string; classId: string };
type Teacher = { id: string; name: string; status: string };
type Slot = { id: string; weekday: string; periodName: string; startsAt: string; endsAt: string; roomName: string; className: string; subjectName: string; teacherName: string };

export type TimetableTab = "weekdays" | "periods" | "rooms" | "create" | "class" | "teacher";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const tabs: Array<{ id: TimetableTab; label: string; icon: string; href: string }> = [
  { id: "weekdays", label: "Weekdays", icon: "fa-light fa-calendar-week", href: "/admin/timetable/weekdays" },
  { id: "periods", label: "Time Periods", icon: "fa-light fa-clock", href: "/admin/timetable/periods" },
  { id: "rooms", label: "Class Rooms", icon: "fa-light fa-door-open", href: "/admin/timetable/rooms" },
  { id: "create", label: "Create Timetable", icon: "fa-light fa-plus", href: "/admin/timetable" },
  { id: "class", label: "Generate For Class", icon: "fa-light fa-chalkboard", href: "/admin/timetable/class" },
  { id: "teacher", label: "Generate For Teacher", icon: "fa-light fa-user", href: "/admin/timetable/teacher" },
];

export function TimetableManager({ tab }: { tab: TimetableTab }) {
  const { ready, isPortal: isStudent, isParent, me, children, setMe, error: portalError } = usePortalStudent();
  const crumb = tabs.find((item) => item.id === tab)?.label ?? "Create Timetable";
  const [periods, setPeriods] = useState<Period[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classId, setClassId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [view, setView] = useState("");
  const [activeDays, setActiveDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const [periodRows, roomRows, classRows, staff, profile] = await Promise.all([
      api<Period[]>("/timetable/periods"),
      api<Room[]>("/timetable/rooms"),
      api<ClassRow[]>("/classes"),
      api<Teacher[]>("/employees"),
      api<{ institute: Institute }>("/institute"),
    ]);
    setPeriods(periodRows);
    setRooms(roomRows);
    setClasses(classRows);
    setTeachers(staff.filter((person) => person.status === "active"));
    setInstitute(profile.institute);
  }

  useEffect(() => {
    if (!ready) return;
    if (isStudent) {
      if (!me) return;
      Promise.all([
        api<{ name: string; slots: Slot[] }>(`/timetable/class/${me.classId}`),
        api<{ institute: Institute }>("/institute"),
      ])
        .then(([result, profile]) => {
          setSlots(result.slots ?? []);
          setView(result.name || me.className);
          setInstitute(profile.institute);
        })
        .catch((err: Error) => setError(err.message));
      return;
    }
    load().catch((err: Error) => setError(err.message));
  }, [ready, isStudent, me]);

  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      return;
    }
    api<Subject[]>(`/subjects?classId=${classId}`).then(setSubjects).catch((err: Error) => setError(err.message));
  }, [classId]);

  async function save(path: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setError("");
    setNote("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(data) });
      form.reset();
      setNote(path.includes("periods") ? "Period saved." : "Class room saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function addSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setNote("");
    try {
      await api("/timetable/slots", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      setClassId("");
      setNote("Slot added to the timetable.");
      setSlots(await api<Slot[]>("/timetable/slots"));
      setView("All slots");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the slot");
    }
  }

  async function loadClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get("classId"));
    setError("");
    try {
      const result = await api<{ name: string; slots: Slot[] }>(`/timetable/class/${id}`);
      setView(result.name);
      setSlots(result.slots);
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Could not load class timetable");
    }
  }

  async function loadTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get("teacherId"));
    setError("");
    try {
      const result = await api<{ name: string; slots: Slot[] }>(`/timetable/teacher/${id}`);
      setView(result.name);
      setSlots(result.slots);
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Could not load teacher timetable");
    }
  }

  function toggleDay(day: string) {
    setActiveDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  if (isStudent) {
    return (
      <PageChrome icon="fa-light fa-calendar" crumbs={[{ label: isParent ? "Timetable" : "My Timetable" }]}>
        <div className="print:hidden">
          <StudentPanelHead title={isParent ? "Timetable" : "My Timetable"} hint={`Weekly periods for ${view || me?.className || "your class"}.`} />
          {isParent ? <ChildPicker options={children} selected={me} onSelect={setMe} /> : null}
          {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
          {slots.length > 0 ? (
            <div className="mb-3 flex justify-end">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            </div>
          ) : null}
        </div>
        {slots.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-calendar" /></div>
            <h5>No Record Found.</h5>
            <p>Your class timetable will appear here once slots are published.</p>
          </div>
        ) : (
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-calendar text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Class timetable</h2>
                <p>{institute?.name ?? "School"} · {view || me?.className || "Class"}</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Period</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{slot.weekday}</td>
                    <td>{slot.periodName} · {slot.startsAt}-{slot.endsAt}</td>
                    <td>{slot.subjectName}</td>
                    <td>{slot.teacherName}</td>
                    <td>{slot.roomName}</td>
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
    <PageChrome icon="fa-light fa-calendar" crumbs={[{ label: "Timetable", href: "/admin/timetable" }, { label: crumb }]}>
      <div className="esk-tt-wrap print:hidden">
        <div className="esk-tt-card">
          <div className="esk-fee-tabs esk-tt-tabs" role="tablist">
            {tabs.map((item) => (
              <Link key={item.id} href={item.href} className={`esk-fee-tab ${tab === item.id ? "active" : ""}`}>
                <i className={item.icon} /> {item.label}
              </Link>
            ))}
          </div>

          {tab === "weekdays" ? (
            <div className="esk-fee-panel">
              <div className="esk-fee-head" style={{ marginBottom: 16 }}>
                <h4>Weekdays</h4>
                <p>Choose which days appear when creating timetable slots.</p>
              </div>
              <div className="esk-tt-days">
                {days.map((day) => (
                  <label key={day} className={`esk-tt-day ${activeDays.includes(day) ? "active" : ""}`}>
                    <input type="checkbox" checked={activeDays.includes(day)} onChange={() => toggleDay(day)} />
                    {day}
                  </label>
                ))}
              </div>
              <p className="mt-3 text-center text-sm text-[var(--esk-muted)]">{activeDays.length} weekday{activeDays.length === 1 ? "" : "s"} active for Create Timetable.</p>
            </div>
          ) : null}

          {tab === "periods" ? (
            <div className="esk-fee-panel">
              <div className="esk-fee-head" style={{ marginBottom: 16 }}>
                <h4>Time Periods</h4>
                <p>Define period names and start/end times used by slots.</p>
              </div>
              <form onSubmit={(event) => save("/timetable/periods", event)}>
                <div className="esk-att-grid">
                  <Field label="Period Name *"><input className={control} name="name" placeholder="Period 1" required /></Field>
                  <Field label="Start *"><input className={control} name="startsAt" type="time" required /></Field>
                  <Field label="End *"><input className={control} name="endsAt" type="time" required /></Field>
                </div>
                <button className="esk-fee-submit" type="submit"><i className="fa-light fa-plus" /> Add Period</button>
              </form>
              <div className="esk-tt-list">
                {periods.length === 0 ? <p className="text-sm text-[var(--esk-muted)]">No periods yet.</p> : null}
                {periods.map((period) => (
                  <div key={period.id} className="esk-tt-row">
                    <strong>{period.name}</strong>
                    <span>{period.startsAt} – {period.endsAt}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "rooms" ? (
            <div className="esk-fee-panel">
              <div className="esk-fee-head" style={{ marginBottom: 16 }}>
                <h4>Class Rooms</h4>
                <p>Rooms used when assigning timetable slots.</p>
              </div>
              <form onSubmit={(event) => save("/timetable/rooms", event)}>
                <Field label="Room Name *"><input className={control} name="name" placeholder="Room A" required /></Field>
                <button className="esk-fee-submit" type="submit"><i className="fa-light fa-plus" /> Add Room</button>
              </form>
              <div className="esk-tt-list">
                {rooms.length === 0 ? <p className="text-sm text-[var(--esk-muted)]">No rooms yet.</p> : null}
                {rooms.map((room) => (
                  <div key={room.id} className="esk-tt-row">
                    <strong>{room.name}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "create" ? (
            <div className="esk-fee-panel">
              <div className="esk-fee-head" style={{ marginBottom: 16 }}>
                <h4>Create Timetable</h4>
                <p>A teacher, a room, and a class can each appear once in a period.</p>
              </div>
              <form onSubmit={addSlot}>
                <div className="esk-att-grid">
                  <Field label="Weekday *">
                    <select className={control} name="weekday" required defaultValue={activeDays[0] ?? "Monday"}>
                      {(activeDays.length ? activeDays : days).map((day) => <option key={day}>{day}</option>)}
                    </select>
                  </Field>
                  <Field label="Period *">
                    <select className={control} name="periodId" required defaultValue="">
                      <option value="" disabled>Select period</option>
                      {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Class Room *">
                    <select className={control} name="roomId" required defaultValue="">
                      <option value="" disabled>Select room</option>
                      {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Class *">
                    <select className={control} name="classId" required value={classId} onChange={(event) => setClassId(event.target.value)}>
                      <option value="">Select class</option>
                      {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Subject *">
                    <select className={control} name="subjectId" required defaultValue="">
                      <option value="" disabled>Select subject</option>
                      {subjects.filter((subject) => subject.classId === classId).map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Teacher *">
                    <select className={control} name="teacherId" required defaultValue="">
                      <option value="" disabled>Select teacher</option>
                      {teachers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                    </select>
                  </Field>
                </div>
                <button className="esk-fee-submit" type="submit"><i className="fa-light fa-plus" /> Add Slot</button>
              </form>
            </div>
          ) : null}

          {tab === "class" ? (
            <div className="esk-fee-panel">
              <div className="esk-fee-head" style={{ marginBottom: 16 }}>
                <h4>Generate For Class</h4>
                <p>View the timetable slots assigned to one class.</p>
              </div>
              <form onSubmit={loadClass}>
                <Field label="Class *">
                  <select className={control} name="classId" required defaultValue="">
                    <option value="" disabled>Select class</option>
                    {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                  </select>
                </Field>
                <button className="esk-fee-submit" type="submit"><i className="fa-light fa-table" /> Generate</button>
              </form>
            </div>
          ) : null}

          {tab === "teacher" ? (
            <div className="esk-fee-panel">
              <div className="esk-fee-head" style={{ marginBottom: 16 }}>
                <h4>Generate For Teacher</h4>
                <p>View the timetable slots assigned to one teacher.</p>
              </div>
              <form onSubmit={loadTeacher}>
                <Field label="Teacher *">
                  <select className={control} name="teacherId" required defaultValue="">
                    <option value="" disabled>Select teacher</option>
                    {teachers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </Field>
                <button className="esk-fee-submit" type="submit"><i className="fa-light fa-table" /> Generate</button>
              </form>
            </div>
          ) : null}

          {error ? <p className="esk-fee-error">{error}</p> : null}
          {note ? <p className="mt-2 text-center text-sm text-[var(--esk-purple)]">{note}</p> : null}
        </div>
      </div>

      {(tab === "create" || tab === "class" || tab === "teacher") && (slots.length > 0 || view) ? (
        <div className="mt-4 space-y-3">
          {slots.length === 0 ? (
            <div className="esk-def-card">
              <div className="esk-def-empty">
                <div className="esk-def-empty-icon"><i className="fa-light fa-calendar" /></div>
                <h4>{view || "No Slots"}</h4>
                <p>No timetable slots found for this selection.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-end print:hidden">
                <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                  <i className="fa-light fa-print" /> Print
                </button>
              </div>
              <article className="esk-report-doc">
                <header className="esk-letter-head">
                  {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-calendar text-2xl text-[var(--esk-purple)]" />}
                  <div>
                    <h2>{tab === "teacher" ? "Teacher timetable" : tab === "class" ? "Class timetable" : "Timetable slots"}</h2>
                    <p>{institute?.name ?? "School"} · {view || "Slots"}</p>
                  </div>
                </header>
                <table className="esk-receipt-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Period</th>
                      <th>Room</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => (
                      <tr key={slot.id}>
                        <td>{slot.weekday}</td>
                        <td>{slot.periodName} {slot.startsAt}–{slot.endsAt}</td>
                        <td>{slot.roomName}</td>
                        <td>{slot.className}</td>
                        <td>{slot.subjectName}</td>
                        <td>{slot.teacherName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </>
          )}
        </div>
      ) : null}
    </PageChrome>
  );
}
