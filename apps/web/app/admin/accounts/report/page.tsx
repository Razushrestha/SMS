"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Head = { name: string; type: "income" | "expense"; income: string; expense: string; count: number };
type Report = { from: string; to: string; income: string; expense: string; net: string; heads: Head[]; message: string | null };

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AccountsReportPage() {
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
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      setReport(await api<Report>(`/statement/report?from=${data.get("from")}&to=${data.get("to")}`));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Could not load the accounts report");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-chart-pie"
      crumbs={[{ label: "Accounts", href: "/admin/accounts" }, { label: "Accounts Report" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/accounts/statement">Statement</Link>}
    >
      <div className="print:hidden">
        <FilterCard>
          <form className="contents" onSubmit={onSubmit}>
            <Field label="From"><input className={control} name="from" type="date" defaultValue={monthStart()} required /></Field>
            <Field label="To"><input className={control} name="to" type="date" defaultValue={today()} required /></Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-chart-simple" /> Show</button>
          </form>
        </FilterCard>
      </div>
      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}
      {report ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!!report.message || !report.heads.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          {report.message ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-chart-pie" /></div>
              <h5>No Report Data</h5>
              <p>{report.message}</p>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-chart-pie text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Accounts report</h2>
                  <p>{institute?.name ?? "School"} · {report.from} to {report.to}</p>
                </div>
              </header>
              <div className="esk-certificate-meta">
                <div><span>Income</span><strong>{report.income}</strong></div>
                <div><span>Expense</span><strong>{report.expense}</strong></div>
                <div><span>Net</span><strong>{report.net}</strong></div>
              </div>
              <table className="esk-receipt-table mt-3">
                <thead>
                  <tr>
                    <th>Head</th>
                    <th>Type</th>
                    <th>Entries</th>
                    <th>Income</th>
                    <th>Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {report.heads.map((head) => (
                    <tr key={head.name}>
                      <td>{head.name}</td>
                      <td className="capitalize">{head.type}</td>
                      <td>{head.count}</td>
                      <td>{head.income}</td>
                      <td>{head.expense}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={3}>Total</td>
                    <td>{report.income}</td>
                    <td>{report.expense}</td>
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
