"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Row = {
  className: string;
  monthlyFee: string;
  admission: string;
  registration: string;
  art: string;
  transport: string;
  books: string;
  uniform: string;
  fine: string;
  others: string;
  total: string;
};

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function FeeStructurePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [month, setMonth] = useState(thisMonth());
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ institute: Institute }>("/institute")
      .then((profile) => setInstitute(profile.institute))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMonth = String(new FormData(event.currentTarget).get("month"));
    setMonth(nextMonth);
    setError("");
    try {
      const result = await api<{ rows: Row[] }>(`/fees/structure?month=${nextMonth}`);
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the fee structure");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-sitemap"
      crumbs={[{ label: "Fees", href: "/admin/fees" }, { label: "Fee Structure" }]}
      actions={<Link className="esk-btn-ghost print:hidden" href="/admin/fees">Collect fees</Link>}
    >
      <p className="mb-3 max-w-2xl text-sm text-[var(--esk-muted)] print:hidden">Class monthly fee plus the particular that applies to the whole class. Student discounts and previous balances are added on the invoice.</p>
      <div className="print:hidden">
        <FilterCard>
          <form className="contents" onSubmit={onSubmit}>
            <Field label="Month"><input className={control} name="month" type="month" defaultValue={thisMonth()} required /></Field>
            <button className="esk-btn-primary mb-1" type="submit"><i className="fa-light fa-list" /> Show</button>
          </form>
        </FilterCard>
      </div>
      {error ? <p className="text-sm text-red-600 print:hidden">{error}</p> : null}
      {rows ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!rows.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          {rows.length === 0 ? (
            <div className="esk-empty">
              <div><i className="fa-light fa-sitemap" /></div>
              <h5>No Classes Yet</h5>
              <p>Add classes before viewing fee structure.</p>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-sitemap text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Fee structure</h2>
                  <p>{institute?.name ?? "School"} · {month}</p>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="esk-receipt-table">
                  <thead>
                    <tr>
                      {["Class", "Monthly", "Admission", "Registration", "Art", "Transport", "Books", "Uniform", "Fine", "Others", "Total"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.className}>
                        <td>{row.className}</td>
                        <td>{row.monthlyFee}</td>
                        <td>{row.admission}</td>
                        <td>{row.registration}</td>
                        <td>{row.art}</td>
                        <td>{row.transport}</td>
                        <td>{row.books}</td>
                        <td>{row.uniform}</td>
                        <td>{row.fine}</td>
                        <td>{row.others}</td>
                        <td>{row.total}</td>
                      </tr>
                    ))}
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
