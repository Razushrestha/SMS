"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Row = {
  id: string;
  registrationNo: string;
  name: string;
  fatherName: string | null;
  classId: string;
  className: string;
  feeRemaining: string | null;
  phone: string | null;
};

type Classroom = { id: string; name: string };

export default function BasicListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [classId, setClassId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Row[]>("/students/basic"),
      api<Classroom[]>("/classes"),
      api<{ institute: Institute }>("/institute"),
    ])
      .then(([people, rooms, profile]) => {
        setRows(people);
        setClasses(rooms);
        setInstitute(profile.institute);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const visible = rows.filter((row) => !classId || row.classId === classId);
  const classLabel = classes.find((room) => room.id === classId)?.name;

  return (
    <PageChrome
      icon="fa-light fa-list"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Basic List" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link className="esk-btn-ghost" href="/admin/students">Students</Link>
          <button className="esk-btn-primary" onClick={() => window.print()} type="button" disabled={!visible.length}>
            <i className="fa-light fa-print" /> Print
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">Fee remaining stays a dash until a payment still has an amount due. An unpaid invoice is not printed here.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      <div className="print:hidden">
        <FilterCard>
          <Field label="Class">
            <select className={control} value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </Field>
        </FilterCard>
      </div>
      {visible.length === 0 ? (
        <div className="esk-empty">
          <div><i className="fa-light fa-users" /></div>
          <h5>No Students</h5>
          <p>No students in this class.</p>
        </div>
      ) : (
        <article className="esk-report-doc mt-4">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-list text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Student basic list</h2>
              <p>{institute?.name ?? "School"} · {classLabel ?? "All classes"} · {visible.length} student{visible.length === 1 ? "" : "s"}</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Reg</th>
                <th>Name</th>
                <th>Father</th>
                <th>Class</th>
                <th>Fee remaining</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.registrationNo}</td>
                  <td>{row.name}</td>
                  <td>{row.fatherName || "–"}</td>
                  <td>{row.className}</td>
                  <td>{row.feeRemaining ?? "–"}</td>
                  <td>{row.phone || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </PageChrome>
  );
}
