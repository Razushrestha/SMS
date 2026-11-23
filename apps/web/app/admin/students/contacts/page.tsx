"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Parent = {
  name: string | null;
  nationalId: string | null;
  education: string | null;
  mobile: string | null;
  occupation: string | null;
  profession: string | null;
  income: string | null;
};

type Row = {
  id: string;
  registrationNo: string;
  name: string;
  className: string;
  fatherName: string | null;
  fatherNationalId: string | null;
  fatherEducation: string | null;
  fatherMobile: string | null;
  fatherOccupation: string | null;
  fatherProfession: string | null;
  fatherIncome: string | null;
  motherName: string | null;
  motherNationalId: string | null;
  motherEducation: string | null;
  motherMobile: string | null;
  motherOccupation: string | null;
  motherProfession: string | null;
  motherIncome: string | null;
};

type Report = { total: number; fathersWithMobile: number; mothersWithMobile: number; classes: number; rows: Row[] };

function shown(value: string | null) {
  return value?.trim() ? value : "–";
}

function parentCells(parent: Parent) {
  return [parent.name, parent.nationalId, parent.education, parent.mobile, parent.occupation, parent.profession, parent.income].map((value) => shown(value));
}

export default function StudentContactReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Report>("/students/contacts"),
      api<{ institute: Institute }>("/institute"),
    ])
      .then(([contacts, profile]) => {
        setReport(contacts);
        setInstitute(profile.institute);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <PageChrome
      icon="fa-light fa-address-book"
      crumbs={[{ label: "Students", href: "/admin/students" }, { label: "Contact Report" }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link className="esk-btn-ghost" href="/admin/students">Students</Link>
          <button className="esk-btn-primary" onClick={() => window.print()} type="button" disabled={!report?.rows.length}>
            <i className="fa-light fa-print" /> Print
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)] print:hidden">A parent counts as having a mobile only when that number is saved. A missing field is a dash.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      {!report || report.rows.length === 0 ? (
        <div className="esk-empty">
          <div><i className="fa-light fa-address-book" /></div>
          <h5>No Students</h5>
          <p>No students yet.</p>
        </div>
      ) : (
        <article className="esk-report-doc">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-address-book text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Student contact report</h2>
              <p>{institute?.name ?? "School"}</p>
            </div>
          </header>
          <div className="esk-certificate-meta">
            <div><span>Students</span><strong>{report.total}</strong></div>
            <div><span>Fathers with mobile</span><strong>{report.fathersWithMobile}</strong></div>
            <div><span>Mothers with mobile</span><strong>{report.mothersWithMobile}</strong></div>
            <div><span>Classes</span><strong>{report.classes}</strong></div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  {["Serial", "ID", "Student", "Class", "Father", "Father ID", "Father education", "Father mobile", "Father occupation", "Father profession", "Father income", "Mother", "Mother ID", "Mother education", "Mother mobile", "Mother occupation", "Mother profession", "Mother income"].map((heading) => (
                    <th key={heading} className="whitespace-nowrap">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={row.id}>
                    {[
                      String(index + 1),
                      row.registrationNo,
                      row.name,
                      row.className,
                      ...parentCells({
                        name: row.fatherName,
                        nationalId: row.fatherNationalId,
                        education: row.fatherEducation,
                        mobile: row.fatherMobile,
                        occupation: row.fatherOccupation,
                        profession: row.fatherProfession,
                        income: row.fatherIncome,
                      }),
                      ...parentCells({
                        name: row.motherName,
                        nationalId: row.motherNationalId,
                        education: row.motherEducation,
                        mobile: row.motherMobile,
                        occupation: row.motherOccupation,
                        profession: row.motherProfession,
                        income: row.motherIncome,
                      }),
                    ].map((value, cell) => (
                      <td key={cell} className="whitespace-nowrap">{value}</td>
                    ))}
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
