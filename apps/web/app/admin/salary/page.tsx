"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { roleLabel } from "@/lib/school";

type Employee = { id: string; name: string; status: string; staffRole: string; portalUsername?: string | null };
type Preview = { id: string; name: string; staffRole: string; fixedSalary: string; month: string; alreadyAdded: boolean };
type Payment = { id: string; salaryMonth: string; paidOn: string; fixedSalary: string; bonus: string; deduction: string; net: string };

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [ready, setReady] = useState(false);
  const [month, setMonth] = useState(thisMonth());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Employee[]>("/employees")
      .then((rows) => setEmployees(rows.filter((row) => row.status === "active")))
      .catch((err: Error) => setError(err.message));
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return employees
      .filter((employee) =>
        `${employee.id} ${employee.name} ${employee.staffRole} ${roleLabel(employee.staffRole)} ${employee.portalUsername ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 6);
  }, [employees, query]);

  async function loadPreview(employeeId: string, salaryMonth: string) {
    setError("");
    try {
      setPreview(await api<Preview>(`/salary/preview?employeeId=${employeeId}&month=${salaryMonth}`));
      const slip = await api<{ payments: Payment[] }>(`/salary/slip?employeeId=${employeeId}`);
      setPayments(slip.payments);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Employee not found or inactive.");
    }
  }

  function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const employee = selected ?? matches[0] ?? employees.find((row) => row.name.toLowerCase() === query.trim().toLowerCase());
    if (!employee) {
      setError("Select an employee to continue.");
      return;
    }
    setSelected(employee);
    setQuery(employee.name);
    setReady(true);
    void loadPreview(employee.id, month);
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) return;
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await api("/salary", {
        method: "POST",
        body: JSON.stringify({
          employeeId: preview.id,
          month: preview.month,
          date: data.get("date"),
          fixedSalary: data.get("fixedSalary"),
          bonus: data.get("bonus") || 0,
          deduction: data.get("deduction") || 0,
        }),
      });
      await loadPreview(preview.id, preview.month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pay the salary");
    }
  }

  async function remove(id: string) {
    if (!preview || !confirm("Delete this salary payment and reverse it on the statement?")) return;
    await api(`/salary/${id}`, { method: "DELETE" });
    await loadPreview(preview.id, preview.month);
  }

  return (
    <PageChrome icon="fa-light fa-credit-card" crumbs={[{ label: "Salary" }, { label: "Pay Salary" }]}>
      {!ready ? (
        <div className="esk-fee-wrap">
          <div className="esk-fee-card esk-sal-search">
            <div className="esk-sal-icon"><i className="fa-light fa-magnifying-glass" /></div>
            <h3>Select Employee</h3>
            <p>Search by employee ID, name, or role to proceed with salary payment.</p>
            <form onSubmit={proceed}>
              <div className="esk-sal-input-wrap">
                <i className="fa-light fa-magnifying-glass" />
                <input
                  className="esk-sal-input"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setSelected(null); setError(""); }}
                  placeholder="Search employee..."
                  aria-label="Search employee"
                  required
                />
              </div>
              {matches.length > 0 ? (
                <ul className="esk-sal-matches">
                  {matches.map((employee) => (
                    <li key={employee.id}>
                      <button
                        type="button"
                        onClick={() => { setSelected(employee); setQuery(employee.name); }}
                      >
                        {employee.name} · {roleLabel(employee.staffRole)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {error ? <p className="esk-fee-error">{error}</p> : null}
              <button className="esk-fee-submit" type="submit"><i className="fa-light fa-arrow-right" /> Proceed</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="esk-fee-wrap">
            <div className="esk-fee-card">
              <div className="esk-fee-head">
                <h4>Pay Salary</h4>
                <p>{selected?.name} · {roleLabel(selected?.staffRole ?? "")}</p>
              </div>
              <div className="esk-fee-panel">
                <Field label="Salary Month *">
                  <input
                    className={control}
                    type="month"
                    value={month}
                    onChange={(event) => {
                      const next = event.target.value;
                      setMonth(next);
                      if (selected) void loadPreview(selected.id, next);
                    }}
                    required
                  />
                </Field>
                <button type="button" className="esk-btn-ghost mt-2" onClick={() => { setReady(false); setPreview(null); setPayments([]); setError(""); }}>
                  Change employee
                </button>
              </div>
              {error ? <p className="esk-fee-error">{error}</p> : null}
              {preview ? (
                <form className="esk-fee-panel" onSubmit={pay}>
                  {preview.alreadyAdded ? (
                    <p className="mb-3 text-sm text-amber-700">Salary for this employee has already been added for the selected month.</p>
                  ) : null}
                  <div className="esk-att-grid">
                    <Field label="Payment date"><input className={control} name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
                    <Field label="Fixed salary"><input className={control} name="fixedSalary" type="number" min="0" step="0.01" defaultValue={preview.fixedSalary} required /></Field>
                    <Field label="Bonus"><input className={control} name="bonus" type="number" min="0" step="0.01" defaultValue="0" /></Field>
                    <Field label="Deduction"><input className={control} name="deduction" type="number" min="0" step="0.01" defaultValue="0" /></Field>
                  </div>
                  <button className="esk-fee-submit" type="submit" disabled={preview.alreadyAdded}><i className="fa-light fa-check" /> Submit salary</button>
                </form>
              ) : null}
            </div>
          </div>

          {payments.length ? (
            <div className="esk-def-card">
              <table className="esk-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Net</th>
                    <th>Bonus</th>
                    <th>Deduction</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.salaryMonth}</td>
                      <td>{payment.net}</td>
                      <td>{payment.bonus}</td>
                      <td>{payment.deduction}</td>
                      <td className="text-right">
                        <button className="esk-fee-delete" type="button" onClick={() => void remove(payment.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </PageChrome>
  );
}
