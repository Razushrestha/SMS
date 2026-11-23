"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { roleLabel } from "@/lib/school";

type Employee = { id: string; name: string; status: string; staffRole: string; portalUsername?: string | null };
type Payment = { id: string; salaryMonth: string; paidOn: string; fixedSalary: string; bonus: string; deduction: string; net: string };
type Slip = { employee: { id: string; name: string; staffRole: string }; payments: Payment[] };

export default function SalarySlipsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Employee[]>("/employees"),
      api<{ institute: Institute }>("/institute"),
    ])
      .then(([rows, profile]) => {
        setEmployees(rows.filter((row) => row.status === "active"));
        setInstitute(profile.institute);
      })
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

  async function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const employee = selected ?? matches[0];
    if (!employee) {
      setError("Select an employee to continue.");
      return;
    }
    setSelected(employee);
    setQuery(employee.name);
    setError("");
    try {
      setSlip(await api<Slip>(`/salary/slip?employeeId=${employee.id}`));
    } catch (err) {
      setSlip(null);
      setError(err instanceof Error ? err.message : "Could not load the salary slip");
    }
  }

  return (
    <PageChrome icon="fa-light fa-receipt" crumbs={[{ label: "Salary", href: "/admin/salary" }, { label: "Salary Paid Slip" }]}>
      <div className="esk-fee-wrap print:hidden">
        <div className="esk-fee-card esk-sal-search">
          <div className="esk-sal-icon"><i className="fa-light fa-magnifying-glass" /></div>
          <h3>Select Employee</h3>
          <p>Search by employee ID, name, or role to view or print the salary slip.</p>
          <form onSubmit={proceed}>
            <div className="esk-sal-input-wrap">
              <i className="fa-light fa-magnifying-glass" />
              <input
                className="esk-sal-input"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSelected(null); setError(""); setSlip(null); }}
                placeholder="Search employee..."
                aria-label="Search employee"
                required
              />
            </div>
            {matches.length > 0 ? (
              <ul className="esk-sal-matches">
                {matches.map((employee) => (
                  <li key={employee.id}>
                    <button type="button" onClick={() => { setSelected(employee); setQuery(employee.name); }}>
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

      {slip ? (
        <div className="mx-auto mt-4 max-w-3xl space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          <article className="esk-receipt">
            <header className="esk-receipt-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-receipt text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Salary Paid Slip</h2>
                <p>{institute?.name ?? "School"} · {slip.employee.name} · {roleLabel(slip.employee.staffRole)}</p>
              </div>
            </header>
            {slip.payments.length === 0 ? (
              <div className="esk-def-empty">
                <div className="esk-def-empty-icon"><i className="fa-light fa-receipt" /></div>
                <h4>No Salary Payments</h4>
                <p>No paid salary slips found for this employee.</p>
              </div>
            ) : (
              <>
                <table className="esk-receipt-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Paid On</th>
                      <th>Fixed</th>
                      <th>Bonus</th>
                      <th>Deduction</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slip.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.salaryMonth}</td>
                        <td>{payment.paidOn}</td>
                        <td>{payment.fixedSalary}</td>
                        <td>{payment.bonus}</td>
                        <td>{payment.deduction}</td>
                        <td>{payment.net}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="esk-receipt-sign">
                  <span>Prepared By</span>
                  <span>Checked By</span>
                  <span>Accounts Department</span>
                </div>
              </>
            )}
          </article>
        </div>
      ) : null}
    </PageChrome>
  );
}
