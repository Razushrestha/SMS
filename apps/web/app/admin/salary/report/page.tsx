"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { roleLabel } from "@/lib/school";

type Row = { id: string; name: string; staffRole: string; paidOn: string; bonus: string; deduction: string; net: string };
type Report = { month: string; rows: Row[]; totals: { bonus: string; deduction: string; net: string } };

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalaryReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ institute: Institute }>("/institute")
      .then((profile) => setInstitute(profile.institute))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const month = String(new FormData(event.currentTarget).get("month"));
    setError("");
    try {
      setReport(await api<Report>(`/salary/report?month=${month}`));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Could not open the salary report");
    }
  }

  return (
    <PageChrome icon="fa-light fa-chart-column" crumbs={[{ label: "Salary", href: "/admin/salary" }, { label: "Salary Report" }]}>
      <div className="esk-fee-wrap print:hidden">
        <div className="esk-fee-card">
          <div className="esk-fee-head">
            <h4>Salary Report</h4>
            <p>Only salaries paid in the selected month are listed.</p>
          </div>
          <form className="esk-fee-panel" onSubmit={load}>
            <Field label="Salary Month *">
              <input className={control} name="month" type="month" required defaultValue={thisMonth()} />
            </Field>
            <button className="esk-fee-submit" type="submit"><i className="fa-light fa-chart-simple" /> Show Report</button>
          </form>
          {error ? <p className="esk-fee-error">{error}</p> : null}
        </div>
      </div>

      {report ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!report.rows.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          {report.rows.length === 0 ? (
            <div className="esk-def-card">
              <div className="esk-def-empty">
                <div className="esk-def-empty-icon"><i className="fa-light fa-credit-card" /></div>
                <h4>No Paid Salaries</h4>
                <p>No salaries were paid for this month.</p>
              </div>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chart-column text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Salary report</h2>
                  <p>{institute?.name ?? "School"} · {report.month}</p>
                </div>
              </header>
              <table className="esk-receipt-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Paid On</th>
                    <th>Bonus</th>
                    <th>Deduction</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{roleLabel(row.staffRole)}</td>
                      <td>{row.paidOn}</td>
                      <td>{row.bonus}</td>
                      <td>{row.deduction}</td>
                      <td>{row.net}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={3}>Total</td>
                    <td>{report.totals.bonus}</td>
                    <td>{report.totals.deduction}</td>
                    <td>{report.totals.net}</td>
                  </tr>
                </tbody>
              </table>
            </article>
          )}
        </div>
      ) : null}
    </PageChrome>
  );
}
