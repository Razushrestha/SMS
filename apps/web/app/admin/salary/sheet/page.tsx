"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { roleLabel } from "@/lib/school";

type Row = { id: string; name: string; staffRole: string; fixedSalary: string; bonus: string; deduction: string; net: string; status: string };
type Sheet = { month: string; rows: Row[]; totals: { bonus: string; deduction: string; net: string } };

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalarySheetPage() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
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
      setSheet(await api<Sheet>(`/salary/sheet?month=${month}`));
    } catch (err) {
      setSheet(null);
      setError(err instanceof Error ? err.message : "Could not open the salary sheet");
    }
  }

  return (
    <PageChrome icon="fa-light fa-table" crumbs={[{ label: "Salary", href: "/admin/salary" }, { label: "Salary Sheet" }]}>
      <div className="esk-fee-wrap print:hidden">
        <div className="esk-fee-card">
          <div className="esk-fee-head">
            <h4>Salary Sheet</h4>
            <p>Active employees for the selected month. Unpaid rows stay Not paid.</p>
          </div>
          <form className="esk-fee-panel" onSubmit={load}>
            <Field label="Salary Month *">
              <input className={control} name="month" type="month" required defaultValue={thisMonth()} />
            </Field>
            <button className="esk-fee-submit" type="submit"><i className="fa-light fa-list" /> Show Sheet</button>
          </form>
          {error ? <p className="esk-fee-error">{error}</p> : null}
        </div>
      </div>

      {sheet ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()} disabled={!sheet.rows.length}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          {sheet.rows.length === 0 ? (
            <div className="esk-def-card">
              <div className="esk-def-empty">
                <div className="esk-def-empty-icon"><i className="fa-light fa-briefcase" /></div>
                <h4>No Active Employees</h4>
                <p>Add employees before opening a salary sheet.</p>
              </div>
            </div>
          ) : (
            <article className="esk-report-doc">
              <header className="esk-letter-head">
                {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-table text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Salary sheet</h2>
                  <p>{institute?.name ?? "School"} · {sheet.month}</p>
                </div>
              </header>
              <table className="esk-receipt-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Fixed</th>
                    <th>Bonus</th>
                    <th>Deduction</th>
                    <th>Net</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{roleLabel(row.staffRole)}</td>
                      <td>{row.fixedSalary}</td>
                      <td>{row.bonus}</td>
                      <td>{row.deduction}</td>
                      <td>{row.net}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={3}>Total</td>
                    <td>{sheet.totals.bonus}</td>
                    <td>{sheet.totals.deduction}</td>
                    <td>{sheet.totals.net}</td>
                    <td />
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
