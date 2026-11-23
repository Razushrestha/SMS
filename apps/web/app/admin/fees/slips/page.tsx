"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { ChildPicker } from "@/components/child-picker";
import { PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { usePortalStudent } from "@/lib/portal-student";

type Student = { registrationNo: string; name: string; className: string };
type Lines = { monthlyFee: string; admission: string; registration: string; art: string; transport: string; books: string; uniform: string; fine: string; others: string; previousBalance: string; discount: string };
type Slip = {
  title: string;
  empty: boolean;
  message?: string;
  dateFormat: string;
  instituteName?: string;
  institutePhone?: string;
  instituteLogo?: string | null;
  student?: { registrationNo: string; name: string; fatherName: string | null; className: string };
  serial?: number;
  month?: string;
  paidOn?: string;
  printedAt?: string;
  lines?: Lines;
  total?: string;
  deposit?: string;
  due?: string;
  history?: Array<{ serial: number; date: string; month: string; total: string; deposit: string; due: string }>;
};

const lineLabels: Array<[keyof Lines, string]> = [
  ["monthlyFee", "Monthly tuition"],
  ["admission", "Admission"],
  ["registration", "Registration"],
  ["art", "Art material"],
  ["transport", "Transport"],
  ["books", "Books"],
  ["uniform", "Uniform"],
  ["fine", "Fine"],
  ["others", "Others"],
  ["previousBalance", "Previous balance"],
  ["discount", "Discount"],
];

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function FeeSlipsPage() {
  const { ready, isPortal: isStudent, isParent, me, children, setMe, error: portalError } = usePortalStudent();
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [registration, setRegistration] = useState("");
  const [slip, setSlip] = useState<Slip | null>(null);
  const [layout, setLayout] = useState<"detailed" | "mini" | "thermal">("detailed");
  const [month, setMonth] = useState(thisMonth());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (isStudent) return;
    api<Student[]>("/students").then(setStudents).catch((err: Error) => setError(err.message));
  }, [ready, isStudent]);

  useEffect(() => {
    if (!ready || !isStudent || !me) return;
    setRegistration(me.registrationNo);
    setQuery(`${me.registrationNo} ${me.name}`);
    api<Slip>(`/fees/slip?registration=${encodeURIComponent(me.registrationNo)}&month=${encodeURIComponent(month)}`)
      .then(setSlip)
      .catch((err: Error) => setError(err.message));
  }, [ready, isStudent, me, month]);

  const matches = query.trim().length === 0 ? [] : students.filter((student) => `${student.registrationNo} ${student.name}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  async function show(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const nextMonth = String(new FormData(form).get("month"));
    const chosen = isStudent && me ? me.registrationNo : registration || query.trim();
    setMonth(nextMonth);
    setError("");
    try {
      setSlip(await api<Slip>(`/fees/slip?registration=${encodeURIComponent(chosen)}&month=${encodeURIComponent(nextMonth)}`));
    } catch (err) {
      setSlip(null);
      setError(err instanceof Error ? err.message : "Could not load the slip");
    }
  }

  return (
    <PageChrome icon="fa-light fa-receipt" crumbs={isStudent ? [{ label: "Paid Fee Recipt" }] : [{ label: "Fees", href: "/admin/fees" }, { label: "Fees Paid Slip" }]}>
      <div className="esk-fee-wrap">
        <div className="esk-fee-card">
          <div className="esk-fee-head">
            <h4>Fees Paid Receipt</h4>
            <p>{isStudent ? (isParent ? "Choose a child and fee month to view or print their paid receipt." : "Choose a fee month to view or print your paid receipt.") : "Select a student and fee month to view or print their paid receipt."}</p>
          </div>

          <form className="esk-fee-panel" onSubmit={show}>
            {isParent ? <ChildPicker options={children} selected={me} onSelect={setMe} /> : null}
            <Field label="Fee Month *">
              <input className={control} name="month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required />
            </Field>
            {isStudent ? (
              <p className="mb-3 text-sm text-[var(--esk-muted)]">{me ? `${me.registrationNo} · ${me.name} · ${me.className}` : "Loading your student profile…"}</p>
            ) : (
              <>
                <label className="esk-fee-label"><i className="fa-light fa-magnifying-glass" /> Search Student *</label>
                <input
                  className="esk-fee-input"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setRegistration(""); }}
                  placeholder="Type student name or registration number"
                  required
                />
                {matches.length > 0 ? (
                  <ul className="mt-2 overflow-hidden rounded-lg border border-[var(--esk-border)] text-sm">
                    {matches.map((student) => (
                      <li key={student.registrationNo}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-[var(--esk-sidebar)]"
                          onClick={() => { setQuery(`${student.registrationNo} ${student.name}`); setRegistration(student.registrationNo); }}
                        >
                          {student.registrationNo} · {student.name} · {student.className}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
            <button className="esk-fee-submit" type="submit"><i className="fa-light fa-receipt" /> Generate Receipt</button>
          </form>

          {error || portalError ? <p className="esk-fee-error">{error || portalError}</p> : null}
        </div>
      </div>

      {slip?.empty ? (
        <article className="esk-panel mx-auto mt-4 max-w-3xl text-sm">
          <h2>{slip.title}</h2>
          <p className="mt-2">{slip.message}</p>
        </article>
      ) : null}

      {slip && !slip.empty && slip.student && slip.lines ? (
        <div className="mx-auto mt-4 max-w-3xl space-y-3">
          <div className="flex flex-wrap gap-2 print:hidden">
            {(["detailed", "mini", "thermal"] as const).map((item) => (
              <button key={item} className={layout === item ? "esk-btn-primary" : "esk-btn-ghost"} type="button" onClick={() => setLayout(item)}>{item}</button>
            ))}
            <button className="esk-btn-primary" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button>
          </div>
          <article className={`esk-receipt ${layout === "thermal" ? "thermal" : ""} ${layout === "mini" ? "mini" : ""}`}>
            <header className="esk-receipt-head">
              {slip.instituteLogo ? <img src={slip.instituteLogo} alt={slip.instituteName || "Institute"} /> : <i className="fa-light fa-building-columns text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>{slip.title}</h2>
                <p>{slip.instituteName} · {slip.institutePhone}</p>
              </div>
            </header>

            {layout === "detailed" ? (
              <>
                <div className="esk-receipt-meta">
                  <div><span>Registration</span><strong>{slip.student.registrationNo}</strong></div>
                  <div><span>Student</span><strong>{slip.student.name}</strong></div>
                  <div><span>Guardian</span><strong>{slip.student.fatherName || "—"}</strong></div>
                  <div><span>Class</span><strong>{slip.student.className}</strong></div>
                  <div><span>Serial</span><strong>{slip.serial}</strong></div>
                  <div><span>Submission date</span><strong>{slip.paidOn}</strong></div>
                  <div><span>Fee month</span><strong>{slip.month}</strong></div>
                </div>
                <table className="esk-receipt-table">
                  <thead><tr><th>Particular</th><th>Amount</th></tr></thead>
                  <tbody>
                    {lineLabels.map(([key, label]) => (
                      <tr key={key}><td>{label}</td><td>{slip.lines?.[key]}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="esk-receipt-totals">
                  <div><span>Total</span><strong>{slip.total}</strong></div>
                  <div><span>Deposit</span><strong>{slip.deposit}</strong></div>
                  <div><span>Due</span><strong>{slip.due}</strong></div>
                </div>
                {slip.history?.length ? (
                  <table className="esk-receipt-table mt-4">
                    <thead><tr><th>Date</th><th>Month</th><th>Total</th><th>Deposit</th><th>Due</th></tr></thead>
                    <tbody>
                      {slip.history.map((row) => (
                        <tr key={row.serial}><td>{row.date}</td><td>{row.month}</td><td>{row.total}</td><td>{row.deposit}</td><td>{row.due}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                <div className="esk-receipt-sign">
                  <span>Prepared By</span>
                  <span>Checked By</span>
                  <span>Accounts Department</span>
                </div>
              </>
            ) : null}

            {layout === "mini" ? (
              <>
                <div className="esk-receipt-meta">
                  <div><span>Student</span><strong>{slip.student.name}</strong></div>
                  <div><span>Serial</span><strong>{slip.serial}</strong></div>
                  <div><span>Date</span><strong>{slip.paidOn}</strong></div>
                  <div><span>Month</span><strong>{slip.month}</strong></div>
                </div>
                <div className="esk-receipt-totals">
                  <div><span>Total</span><strong>{slip.total}</strong></div>
                  <div><span>Deposit</span><strong>{slip.deposit}</strong></div>
                  <div><span>Due</span><strong>{slip.due}</strong></div>
                </div>
              </>
            ) : null}

            {layout === "thermal" ? (
              <div className="space-y-1">
                <p>Date {slip.paidOn}</p>
                <p>Registration {slip.student.registrationNo}</p>
                <p>{slip.student.name}</p>
                <p>Class {slip.student.className}</p>
                <p>Month {slip.month}</p>
                <p>Total {slip.total}</p>
                <p>Deposit {slip.deposit}</p>
                <p>Balance {slip.due}</p>
                <p>Printed {slip.printedAt}</p>
                <p className="pt-2">Thank you for payment!</p>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </PageChrome>
  );
}
