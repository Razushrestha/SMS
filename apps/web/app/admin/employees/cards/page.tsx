"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { roleLabel, staffRoles } from "@/lib/school";

type Employee = {
  id: string;
  name: string;
  phone: string;
  joiningDate: string;
  staffRole: string;
  status: string;
  photoUrl: string | null;
};

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

export default function StaffCardsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [role, setRole] = useState("");
  const [style, setStyle] = useState<(typeof styles)[number]["id"]>("default");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Employee[]>("/employees/cards"), api<{ institute: Institute }>("/institute")])
      .then(([people, profile]) => {
        setEmployees(people);
        setInstitute(profile.institute);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const cards = employees.filter((person) => person.status === "active" && (!role || person.staffRole === role));

  return (
    <PageChrome
      icon="fa-light fa-id-card"
      crumbs={[{ label: "Employees", href: "/admin/employees" }, { label: "ID Cards" }]}
      actions={<Link className="esk-btn-ghost print:hidden" href="/admin/employees">Employees</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">Inactive staff are left off the cards. Salary is not printed. Customize stays locked.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      <div className="print:hidden">
        <FilterCard>
          <Field label="Role">
            <select className={control} value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All roles</option>
              {staffRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
      {cards.length === 0 ? <p className="mb-3 text-sm text-[var(--esk-muted)]">No active employees in this role.</p> : null}
      <div className={`esk-id-grid ${style === "4" ? "cols-3" : "cols-2"}`}>
        {cards.map((person) => (
          <article key={person.id} className="esk-id-card" data-style={style}>
            <div className="esk-id-top">
              {person.photoUrl ? <img alt="" className="photo" src={person.photoUrl} /> : <i className="fa-light fa-user text-xl text-[var(--esk-purple)]" />}
              {institute?.logoUrl ? <img alt="" className="logo" src={institute.logoUrl} /> : null}
              <p className="esk-id-muted">{institute?.name}</p>
            </div>
            <h2>{person.name}</h2>
            <p>ID {person.phone || "—"}</p>
            <p>{roleLabel(person.staffRole)}</p>
            <p>Joined {institute ? formatDate(person.joiningDate, institute.dateFormat) : person.joiningDate}</p>
          </article>
        ))}
      </div>
    </PageChrome>
  );
}
