"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, FilterCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type ClassRow = { id: string; name: string };
type Subject = { id: string; name: string; totalMarks: number };

export default function SubjectsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<Subject[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ClassRow[]>("/classes").then((list) => {
      setClasses(list);
      if (list[0]) setClassId(list[0].id);
    }).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!classId) return;
    api<Subject[]>(`/subjects?classId=${classId}`).then(setRows).catch((err: Error) => setError(err.message));
  }, [classId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/subjects", {
        method: "POST",
        body: JSON.stringify({ classId, name: form.get("name"), totalMarks: Number(form.get("totalMarks")) }),
      });
      formElement.reset();
      setRows(await api<Subject[]>(`/subjects?classId=${classId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the subject");
    }
  }

  async function remove(id: string) {
    await api(`/subjects/${id}`, { method: "DELETE" });
    setRows(await api<Subject[]>(`/subjects?classId=${classId}`));
  }

  return (
    <PageChrome icon="fa-light fa-book" crumbs={[{ label: "Subjects", href: "/admin/subjects" }, { label: "Assign Subjects" }]}>
      {classes.length === 0 ? (
        <DataCard>
          <div className="esk-empty">
            <div><i className="fa-light fa-book" /></div>
            <h5>Create a class first</h5>
            <p>Subjects are assigned inside a class.</p>
          </div>
        </DataCard>
      ) : (
        <>
          <FilterCard>
            <Field label="Class">
              <select className={control} value={classId} onChange={(event) => setClassId(event.target.value)}>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
              <Field label="Subject name">
                <input className={control} name="name" required />
              </Field>
              <Field label="Total marks">
                <input className={control} name="totalMarks" type="number" min="1" step="1" required />
              </Field>
              <button className="esk-btn-primary mb-1">Add subject</button>
            </form>
          </FilterCard>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DataCard>
            {rows.length === 0 ? (
              <div className="esk-empty">
                <div><i className="fa-light fa-book-open" /></div>
                <h5>No Subjects Found</h5>
                <p>Add a subject for this class.</p>
              </div>
            ) : (
              <table className="esk-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Total marks</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.totalMarks}</td>
                      <td className="text-right">
                        <button className="esk-link-danger" onClick={() => remove(row.id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>
        </>
      )}
    </PageChrome>
  );
}
