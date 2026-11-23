"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Statement = {
  from: string;
  to: string;
  income: string;
  expense: string;
  net: string;
  incomePercent: number;
  expensePercent: number;
  marginPercent: number;
  ledger: Array<{
    id: string;
    entryDate: string;
    description: string;
    income: string;
    expense: string;
    netBalance: string;
    reference: string;
    headName: string;
  }>;
};

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function StatementPage() {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [showReferences, setShowReferences] = useState(false);
  const [error, setError] = useState("");

  async function load(from = monthStart(), to = today()) {
    setStatement(await api<Statement>(`/statement?from=${from}&to=${to}`));
  }

  useEffect(() => {
    Promise.all([
      load(),
      api<{ institute: Institute }>("/institute").then((profile) => setInstitute(profile.institute)),
    ]).catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await load(String(data.get("from")), String(data.get("to")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the statement");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this row and reverse the linked fee or salary payment?")) return;
    await api(`/statement/${id}`, { method: "DELETE" });
    if (statement) await load(statement.from, statement.to);
  }

  return (
    <PageChrome
      icon="fa-light fa-file-invoice-dollar"
      crumbs={[{ label: "Accounts", href: "/admin/accounts" }, { label: "Statement" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/accounts/report">Report</Link>}
    >
      <div className="print:hidden">
        <FilterCard>
          <form className="contents" onSubmit={onSubmit}>
            <Field label="From"><input className={control} name="from" type="date" defaultValue={monthStart()} /></Field>
            <Field label="To"><input className={control} name="to" type="date" defaultValue={today()} /></Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-filter" /> Apply</button>
          </form>
        </FilterCard>
      </div>
      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}
      {statement ? (
        <>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 print:hidden">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showReferences} onChange={(event) => setShowReferences(event.target.checked)} />
              Show references
            </label>
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!statement.ledger.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3 print:hidden">
            <div className="esk-panel">
              <p className="text-sm text-[var(--esk-muted)]">Income</p>
              <p className="text-xl font-semibold text-[var(--esk-purple)]">{statement.income}</p>
              <p className="text-xs text-[var(--esk-muted)]">{statement.incomePercent}%</p>
            </div>
            <div className="esk-panel">
              <p className="text-sm text-[var(--esk-muted)]">Expense</p>
              <p className="text-xl font-semibold">{statement.expense}</p>
              <p className="text-xs text-[var(--esk-muted)]">{statement.expensePercent}%</p>
            </div>
            <div className="esk-panel">
              <p className="text-sm text-[var(--esk-muted)]">Net margin</p>
              <p className="text-xl font-semibold">{statement.net}</p>
              <p className="text-xs text-[var(--esk-muted)]">{statement.marginPercent}%</p>
            </div>
          </div>

          {statement.ledger.length === 0 ? (
            <div className="esk-empty mt-4">
              <div><i className="fa-light fa-file-lines" /></div>
              <h5>No Rows In This Range</h5>
              <p>Try a wider date range or post a new entry.</p>
            </div>
          ) : (
            <article className="esk-report-doc mt-4">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-file-invoice-dollar text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Account statement</h2>
                  <p>{institute?.name ?? "School"} · {statement.from} to {statement.to}</p>
                </div>
              </header>
              <div className="esk-certificate-meta">
                <div><span>Income</span><strong>{statement.income}</strong></div>
                <div><span>Expense</span><strong>{statement.expense}</strong></div>
                <div><span>Net</span><strong>{statement.net}</strong></div>
                <div><span>Margin</span><strong>{statement.marginPercent}%</strong></div>
              </div>
              <table className="esk-receipt-table mt-3">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Expense</th>
                    <th>Income</th>
                    <th>Net balance</th>
                    {showReferences ? <th>Reference</th> : null}
                    <th className="print:hidden" />
                  </tr>
                </thead>
                <tbody>
                  {statement.ledger.map((row) => (
                    <tr key={row.id}>
                      <td>{row.entryDate}</td>
                      <td>
                        {row.description}
                        <div className="text-xs text-[var(--esk-muted)]">{row.headName}</div>
                      </td>
                      <td>{row.expense}</td>
                      <td>{row.income}</td>
                      <td>{row.netBalance}</td>
                      {showReferences ? <td>{row.reference}</td> : null}
                      <td className="text-right print:hidden">
                        <button className="text-red-600" type="button" onClick={() => void remove(row.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          )}
        </>
      ) : null}
    </PageChrome>
  );
}
