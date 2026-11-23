"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { roleLabel } from "@/lib/school";

type Attendance = { date: string; status: string; time: string };
type Report = {
  id: string;
  name: string;
  phone: string;
  joiningDate: string;
  staffRole: string;
  monthlySalary: string;
  status: string;
  fatherOrHusband: string | null;
  nationalId: string | null;
  education: string | null;
  gender: string | null;
  religion: string | null;
  bloodGroup: string | null;
  experience: string | null;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  showOnWebsite: boolean;
  photoUrl: string | null;
  portalUsername: string | null;
  password: null;
  passwordNote: string;
  salaryStatus: string;
  latestSalary: { month: string; paidOn: string; net: string } | null;
  attendance: { present: number; leave: number; absent: number; rows: Attendance[] };
};

const statusLabel: Record<string, string> = { present: "Present", leave: "On Leave", absent: "Absent" };

function formatDate(value: string, format: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (format === "yyyy-MM-dd") return `${year}-${month}-${day}`;
  if (format === "dd/MM/yyyy") return `${day}/${month}/${year}`;
  const named = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return named.replace(/ (\d{4})$/, ", $1");
}

function shown(value: string | null | undefined) {
  return value?.trim() ? value : "–";
}

export default function EmployeeReportPage() {
  const [rows, setRows] = useState<Report[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [format, setFormat] = useState("d MMMM, yyyy");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Report[]>("/employees/report"), api<{ institute: Institute }>("/institute")])
      .then(([people, profile]) => {
        setRows(people);
        setInstitute(profile.institute);
        setFormat(profile.institute.dateFormat);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <PageChrome
      icon="fa-light fa-file-lines"
      crumbs={[{ label: "Employees", href: "/admin/employees" }, { label: "Info Report" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link className="esk-btn-ghost" href="/admin/employees">Employees</Link>
          <button className="esk-btn-primary" onClick={() => window.print()} type="button" disabled={!rows.length}>
            <i className="fa-light fa-print" /> Print
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">Salary status stays SALARY NOT RECEIVED until a salary is paid. The portal password is not printed.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      {rows.length === 0 ? (
        <div className="esk-empty">
          <div><i className="fa-light fa-users" /></div>
          <h5>No Employees</h5>
          <p>No employees yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((person) => (
            <article key={person.id} className="esk-report-doc">
              <header className="esk-letter-head">
                {person.photoUrl ? <img alt="" src={person.photoUrl} /> : institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-user text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>{person.name}</h2>
                  <p>{institute?.name ?? "School"} · {roleLabel(person.staffRole)} · {person.phone}</p>
                </div>
              </header>
              <div className="esk-certificate-meta">
                <div><span>Joined</span><strong>{formatDate(person.joiningDate, format)}</strong></div>
                <div><span>Monthly salary</span><strong>{person.monthlySalary}</strong></div>
                <div><span>Status</span><strong className="capitalize">{person.status}</strong></div>
                <div><span>Website</span><strong>{person.showOnWebsite ? "Shown" : "Hidden"}</strong></div>
              </div>
              <p className="mt-3 text-sm font-semibold">{person.salaryStatus}{person.latestSalary ? ` · ${person.latestSalary.month} · ${person.latestSalary.net}` : ""}</p>
              <table className="esk-receipt-table mt-3">
                <tbody>
                  <tr><td>Father or husband</td><td>{shown(person.fatherOrHusband)}</td></tr>
                  <tr><td>National ID</td><td>{shown(person.nationalId)}</td></tr>
                  <tr><td>Education</td><td>{shown(person.education)}</td></tr>
                  <tr><td>Gender</td><td>{shown(person.gender)}</td></tr>
                  <tr><td>Religion</td><td>{shown(person.religion)}</td></tr>
                  <tr><td>Blood group</td><td>{shown(person.bloodGroup)}</td></tr>
                  <tr><td>Experience</td><td>{shown(person.experience)}</td></tr>
                  <tr><td>Email</td><td>{shown(person.email)}</td></tr>
                  <tr><td>Date of birth</td><td>{person.dateOfBirth ? formatDate(person.dateOfBirth, format) : "–"}</td></tr>
                  <tr><td>Address</td><td>{shown(person.address)}</td></tr>
                  <tr><td>Portal username</td><td>{shown(person.portalUsername)}</td></tr>
                  <tr><td>Password</td><td>{person.passwordNote}</td></tr>
                </tbody>
              </table>
              <div className="esk-certificate-meta mt-3">
                <div><span>Present</span><strong>{person.attendance.present}</strong></div>
                <div><span>Leave</span><strong>{person.attendance.leave}</strong></div>
                <div><span>Absent</span><strong>{person.attendance.absent}</strong></div>
              </div>
              {person.attendance.rows.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--esk-muted)]">No attendance marked.</p>
              ) : (
                <table className="esk-receipt-table mt-3">
                  <thead><tr><th>Date</th><th>Status</th><th>Time</th></tr></thead>
                  <tbody>
                    {person.attendance.rows.map((row) => (
                      <tr key={row.date}>
                        <td>{formatDate(row.date, format)}</td>
                        <td>{statusLabel[row.status] ?? row.status}</td>
                        <td>{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </div>
      )}
    </PageChrome>
  );
}
