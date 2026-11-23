"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Student = { id: string; registrationNo: string; name: string; classId: string; className: string };
type Classroom = { id: string; name: string };

export default function PromotePage() {
  const [rows, setRows] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [filterClassId, setFilterClassId] = useState("");
  const [bulkTarget, setBulkTarget] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Student[]>("/students/promote"), api<Classroom[]>("/classes")])
      .then(([people, rooms]) => {
        setRows(people);
        setClasses(rooms);
        setTargets(Object.fromEntries(people.map((student) => [student.id, student.classId])));
        setBulkTarget(rooms[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const visible = useMemo(
    () => rows.filter((student) => !filterClassId || student.classId === filterClassId),
    [rows, filterClassId],
  );

  const pending = visible.filter((student) => (targets[student.id] || student.classId) !== student.classId).length;

  function applyBulk() {
    if (!bulkTarget) return;
    setTargets((current) => {
      const next = { ...current };
      for (const student of visible) next[student.id] = bulkTarget;
      return next;
    });
    setNote(`Set target class for ${visible.length} student${visible.length === 1 ? "" : "s"}. Save to apply.`);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNote("");
    try {
      const result = await api<{ updated: number }>("/students/promote", {
        method: "POST",
        body: JSON.stringify({
          moves: rows.map((student) => ({ studentId: student.id, classId: targets[student.id] || student.classId })),
        }),
      });
      if (!result.updated) {
        setNote("Choose a different class to promote.");
        return;
      }
      const people = await api<Student[]>("/students/promote");
      setRows(people);
      setTargets(Object.fromEntries(people.map((student) => [student.id, student.classId])));
      setNote(`Promotion saved for ${result.updated} student${result.updated === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not promote the students");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-arrow-up"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Promote" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/students">Students</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)]">Inactive students are left off. Saving changes the class on the student record.</p>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {note ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
      <div className="print:hidden">
        <FilterCard>
          <Field label="From class">
            <select className={control} value={filterClassId} onChange={(event) => setFilterClassId(event.target.value)}>
              <option value="">All classes</option>
              {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </Field>
          <Field label="Set all targets to">
            <select className={control} value={bulkTarget} onChange={(event) => setBulkTarget(event.target.value)}>
              {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </Field>
          <button className="esk-btn-ghost mb-1" type="button" onClick={applyBulk} disabled={!visible.length}>
            <i className="fa-light fa-layer-group" /> Apply to filtered
          </button>
          <p className="mb-1 text-sm text-[var(--esk-muted)]">{pending === 1 ? "1 pending change" : `${pending} pending changes`}</p>
        </FilterCard>
      </div>
      <form onSubmit={save}>
        <DataCard>
          {visible.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-users" /></div>
              <h5>No Active Students</h5>
              <p>{filterClassId ? "No active students in this class." : "No active students to promote."}</p>
            </div>
          ) : (
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Reg</th>
                  <th>Name</th>
                  <th>Current class</th>
                  <th>Target class</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((student) => {
                  const target = targets[student.id] ?? student.classId;
                  const changed = target !== student.classId;
                  return (
                    <tr key={student.id} className={changed ? "bg-[var(--esk-purple)]/5" : undefined}>
                      <td>{student.registrationNo}</td>
                      <td>{student.name}</td>
                      <td>{student.className}</td>
                      <td>
                        <select
                          className={control}
                          value={target}
                          onChange={(event) => setTargets({ ...targets, [student.id]: event.target.value })}
                        >
                          {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </DataCard>
        {rows.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="esk-btn-primary" type="submit" disabled={!pending}>
              <i className="fa-light fa-check" /> Save promotion{pending ? ` (${pending})` : ""}
            </button>
            {pending ? <p className="text-sm text-[var(--esk-muted)]">Only rows with a new target class are updated.</p> : null}
          </div>
        ) : null}
      </form>
    </PageChrome>
  );
}
