"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Student = {
  id: string;
  registrationNo: string;
  name: string;
  classId: string;
  className: string;
  admissionDate: string;
  status: string;
  photoUrl: string | null;
};

type Classroom = { id: string; name: string };

const styles = [
  { id: "default", label: "Default" },
  { id: "1", label: "Style 1" },
  { id: "2", label: "Style 2" },
  { id: "3", label: "Style 3" },
  { id: "4", label: "Style 4" },
] as const;

function formatDate(value: string, format: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (format === "yyyy-MM-dd") return `${year}-${month}-${day}`;
  if (format === "dd/MM/yyyy") return `${day}/${month}/${year}`;
  const named = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return named.replace(/ (\d{4})$/, ", $1");
}

export default function StudentCardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [classId, setClassId] = useState("");
  const [style, setStyle] = useState<(typeof styles)[number]["id"]>("default");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Student[]>("/students"), api<Classroom[]>("/classes"), api<{ institute: Institute }>("/institute")])
      .then(([people, rooms, profile]) => {
        setStudents(people);
        setClasses(rooms);
        setInstitute(profile.institute);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const cards = students.filter((student) => student.status === "active" && (!classId || student.classId === classId));

  return (
    <PageChrome
      icon="fa-light fa-id-card"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "ID Cards" }]}
      actions={<Link className="esk-btn-ghost print:hidden" href="/admin/students">Students</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">Inactive students are left off the cards. Customize stays locked.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      <div className="print:hidden">
        <FilterCard>
          <Field label="Class">
            <select className={control} value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
          </Field>
          <Field label="Style">
            <select className={control} value={style} onChange={(event) => setStyle(event.target.value as (typeof styles)[number]["id"])}>
              {styles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <button className="esk-btn-ghost mb-1 opacity-60" disabled type="button">Customize is locked</button>
          <button className="esk-btn-primary mb-1" onClick={() => window.print()} type="button"><i className="fa-light fa-print" /> Print</button>
        </FilterCard>
      </div>
      {cards.length === 0 ? <p className="mb-3 text-sm text-[var(--esk-muted)]">No active students in this class.</p> : null}
      <div className={`esk-id-grid ${style === "4" ? "cols-3" : "cols-2"}`}>
        {cards.map((student) => (
          <article key={student.id} className="esk-id-card" data-style={style}>
            <div className="esk-id-top">
              {student.photoUrl ? <img alt="" className="photo" src={student.photoUrl} /> : <i className="fa-light fa-user text-xl text-[var(--esk-purple)]" />}
              {institute?.logoUrl ? <img alt="" className="logo" src={institute.logoUrl} /> : null}
              <p className="esk-id-muted">{institute?.name}</p>
            </div>
            <h2>{student.name}</h2>
            <p>ID {student.registrationNo}</p>
            <p>{student.className}</p>
            <p>Admitted {institute ? formatDate(student.admissionDate, institute.dateFormat) : student.admissionDate}</p>
          </article>
        ))}
      </div>
    </PageChrome>
  );
}
