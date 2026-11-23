"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Employee = { id: string; name: string; status: string };
type ClassRow = { id: string; name: string; monthlyFee: string; teacherId: string; teacherName: string };

export default function ClassesPage() {
  const [teachers, setTeachers] = useState<Employee[]>([]);
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [people, list] = await Promise.all([api<Employee[]>("/employees"), api<ClassRow[]>("/classes")]);
    setTeachers(people.filter((person) => person.status === "active"));
    setRows(list);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/classes", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          monthlyFee: form.get("monthlyFee"),
          teacherId: form.get("teacherId"),
        }),
      });
      formElement.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the class");
    }
  }

  async function remove(row: ClassRow) {
    if (!confirm(`Delete ${row.name}? Students in this class are removed permanently.`)) return;
    try {
      await api(`/classes/${row.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the class");
    }
  }

  return (
    <PageChrome icon="fa-light fa-pencil" crumbs={[{ label: "Classes", href: "/admin/classes" }, { label: "All Classes" }]}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form className="esk-panel" onSubmit={onSubmit}>
          <h2>New class</h2>
          {teachers.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--esk-muted)]">Add an employee before creating a class.</p>
          ) : (
            <div className="mt-3">
              <Field label="Class name">
                <input className={control} name="name" required />
              </Field>
              <Field label="Monthly tuition">
                <input className={control} name="monthlyFee" type="number" min="0" step="0.01" required />
              </Field>
              <Field label="Class teacher">
                <select className={control} name="teacherId" required defaultValue="">
                  <option value="" disabled>Select a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </Field>
              {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
              <button className="esk-btn-primary">Save class</button>
            </div>
          )}
        </form>
        <DataCard>
          {rows.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-chalkboard" /></div>
              <h5>No Classes Found</h5>
              <p>Create a class to start adding students.</p>
            </div>
          ) : (
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Monthly fee</th>
                  <th>Teacher</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.monthlyFee}</td>
                    <td>{row.teacherName}</td>
                    <td className="text-right">
                      <button className="esk-link-danger" onClick={() => remove(row)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
      </div>
    </PageChrome>
  );
}
