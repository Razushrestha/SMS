"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Row = { registrationNo: string; name: string; className: string; source: string; discount: string; billed: string; deposited: string; owing: string };
type Report = { month: string; rows: Row[]; totals: { discount: string; billed: string; deposited: string; owing: string } };

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function FeeReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ institute: Institute }>("/institute")
      .then((profile) => setInstitute(profile.institute))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const month = String(new FormData(event.currentTarget).get("month"));
    setError("");
    try {
      setReport(await api<Report>(`/fees/report?month=${month}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the fees report");
    }
  }

  return (
    <PageChrome icon="fa-light fa-chart-simple" crumbs={[{ label: "Fees", href: "/admin/fees" }, { label: "Fees Report" }]}>
      <div className="esk-fee-wrap print:hidden">
        <div className="esk-fee-card">
          <div className="esk-fee-head">
            <h4>Fees Report</h4>
            <p>Monthly billed, deposited, and owing amounts by student.</p>
          </div>
          <form className="esk-fee-panel" onSubmit={onSubmit}>
            <Field label="Fees Month *">
              <input className={control} name="month" type="month" defaultValue={thisMonth()} required />
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
                <div className="esk-def-empty-icon"><i className="fa-light fa-money-bill" /></div>
                <h4>No Active Students</h4>
                <p>Add students to build a fees report.</p>
              </div>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chart-simple text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Fees report</h2>
                  <p>{institute?.name ?? "School"} · {report.month}</p>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="esk-receipt-table">
                  <thead>
                    <tr>
                      {["Reg", "Name", "Class", "Source", "Discount", "Billed", "Deposited", "Owing"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.registrationNo}>
                        <td>{row.registrationNo}</td>
                        <td>{row.name}</td>
                        <td>{row.className}</td>
                        <td>{row.source}</td>
                        <td>{row.discount}</td>
                        <td>{row.billed}</td>
                        <td>{row.deposited}</td>
                        <td>{row.owing}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td colSpan={4}>Total</td>
                      <td>{report.totals.discount}</td>
                      <td>{report.totals.billed}</td>
                      <td>{report.totals.deposited}</td>
                      <td>{report.totals.owing}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </div>
      ) : null}
    </PageChrome>
  );
}
