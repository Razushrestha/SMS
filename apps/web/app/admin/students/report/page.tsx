"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Row = {
  id: string;
  registrationNo: string;
  name: string;
  fatherName: string | null;
  className: string;
  discount: string;
  admissionDate: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  birthId: string | null;
  religion: string | null;
  caste: string | null;
  status: string;
};

type Report = { total: number; active: number; inactive: number; classes: number; rows: Row[] };

function formatDate(value: string, format: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (format === "yyyy-MM-dd") return `${year}-${month}-${day}`;
  if (format === "dd/MM/yyyy") return `${day}/${month}/${year}`;
  const named = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return named.replace(/ (\d{4})$/, ", $1");
}

function shown(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "–";
  return String(value);
}

export default function StudentInfoReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [format, setFormat] = useState("d MMMM, yyyy");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Report>("/students/info"), api<{ institute: Institute }>("/institute")])
      .then(([info, profile]) => {
        setReport(info);
        setInstitute(profile.institute);
        setFormat(profile.institute.dateFormat);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <PageChrome
      icon="fa-light fa-chart-simple"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Info Report" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link className="esk-btn-ghost" href="/admin/students">Students</Link>
          <button className="esk-btn-primary" onClick={() => window.print()} type="button" disabled={!report?.rows.length}>
            <i className="fa-light fa-print" /> Print
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">Age is counted from the date of birth. A missing field is a dash.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      {!report || report.rows.length === 0 ? (
        <div className="esk-empty">
          <div><i className="fa-light fa-chart-simple" /></div>
          <h5>No Students</h5>
          <p>No students yet.</p>
        </div>
      ) : (
        <article className="esk-report-doc">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chart-simple text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Student information report</h2>
              <p>{institute?.name ?? "School"}</p>
            </div>
          </header>
          <div className="esk-certificate-meta">
            <div><span>Total</span><strong>{report.total}</strong></div>
            <div><span>Active</span><strong>{report.active}</strong></div>
            <div><span>Inactive</span><strong>{report.inactive}</strong></div>
            <div><span>Classes</span><strong>{report.classes}</strong></div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  {["Serial", "ID", "Name", "Father", "Class", "Discount", "Admission", "Date of birth", "Age", "Gender", "Birth ID", "Religion", "Caste", "Status"].map((heading) => (
                    <th key={heading} className="whitespace-nowrap">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.registrationNo}</td>
                    <td className="whitespace-nowrap">{row.name}</td>
                    <td className="whitespace-nowrap">{shown(row.fatherName)}</td>
                    <td className="whitespace-nowrap">{row.className}</td>
                    <td className="whitespace-nowrap">{row.discount}</td>
                    <td className="whitespace-nowrap">{formatDate(row.admissionDate, format)}</td>
                    <td className="whitespace-nowrap">{row.dateOfBirth ? formatDate(row.dateOfBirth, format) : "–"}</td>
                    <td>{shown(row.age)}</td>
                    <td className="capitalize">{shown(row.gender)}</td>
                    <td>{shown(row.birthId)}</td>
                    <td>{shown(row.religion)}</td>
                    <td>{shown(row.caste)}</td>
                    <td className="capitalize">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </PageChrome>
  );
}
