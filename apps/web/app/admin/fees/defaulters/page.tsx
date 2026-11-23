"use client";

import { useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Row = { id: string; registrationNo: string; name: string; className: string; owing: string };
type Detail = {
  name: string;
  registrationNo: string;
  className: string;
  month: string;
  source: string;
  phone: string | null;
  lines: { monthlyFee: string; admission: string; registration: string; art: string; transport: string; books: string; uniform: string; fine: string; others: string; previousBalance: string; discount: string };
  billed: string;
  deposited: string;
  owing: string;
};
type Reminder = { phone: string; body: string; status: string; balance: number | null };

const lineLabels: Array<[keyof Detail["lines"], string]> = [
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

function monthLabel(value: string) {
  const [year, mon] = value.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function DefaultersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [month, setMonth] = useState(thisMonth());
  const [showList, setShowList] = useState(false);
  const [carryOpen, setCarryOpen] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);

  async function load(feeMonth: string) {
    setError("");
    try {
      setRows(await api<Row[]>(`/fees/defaulters?month=${feeMonth}`));
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : "Could not load defaulters");
    }
  }

  useEffect(() => {
    void load(month);
  }, [month]);

  useEffect(() => {
    api<{ institute: Institute }>("/institute")
      .then((profile) => setInstitute(profile.institute))
      .catch((err: Error) => setError(err.message));
  }, []);

  async function remindAll() {
    if (!rows?.length) {
      setNote("No defaulters to remind.");
      return;
    }
    setError("");
    setNote("");
    try {
      const results = await Promise.all(
        rows.map((row) => api<Reminder>(`/fees/defaulters/${row.id}/remind`, { method: "POST", body: JSON.stringify({ month }) })),
      );
      const opted = results.filter((row) => row.status === "opted_out").length;
      setNote(`Reminders queued for ${results.length - opted} student${results.length - opted === 1 ? "" : "s"}${opted ? ` · ${opted} opted out` : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reminders");
    }
  }

  async function carryAll() {
    if (!rows?.length) {
      setCarryOpen(false);
      setNote("No balances to carry.");
      return;
    }
    setError("");
    setNote("");
    try {
      const results = await Promise.all(
        rows.map((row) => api<{ targetMonth: string; amount: string }>("/fees/carry", { method: "POST", body: JSON.stringify({ studentId: row.id, month }) })),
      );
      setCarryOpen(false);
      setNote(`${results.length} balance${results.length === 1 ? "" : "s"} carried forward.`);
      await load(month);
    } catch (err) {
      setCarryOpen(false);
      setError(err instanceof Error ? err.message : "Could not carry balances");
    }
  }

  const count = rows?.length ?? 0;

  return (
    <PageChrome icon="fa-light fa-triangle-exclamation" crumbs={[{ label: "Fees", href: "/admin/fees" }, { label: "Fees Defaulters" }]}>
      <div className="esk-def-card print:hidden">
        <div className="esk-def-bar">
          <Field label="Fees Month">
            <input
              className={control}
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setShowList(false);
                setDetail(null);
                setNote("");
              }}
              required
            />
          </Field>
          <div className="esk-def-actions">
            <button type="button" className="esk-def-btn soft" onClick={() => setShowList((current) => !current)}>
              <i className="fa-light fa-list" /> See Details
            </button>
            <button type="button" className="esk-def-btn warn" onClick={() => void remindAll()}>
              <i className="fa-light fa-bell" /> Send Reminder
            </button>
            <button type="button" className="esk-def-btn primary" onClick={() => setCarryOpen(true)}>
              <i className="fa-light fa-cash-register" /> Carry Forward Balance
            </button>
            {(showList && count > 0) || detail ? (
              <button type="button" className="esk-def-btn soft" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            ) : null}
          </div>
        </div>

        <div className="esk-def-stat">
          <span>Total Defaulters</span>
          <strong>{count}</strong>
        </div>

        {error ? <p className="esk-fee-error">{error}</p> : null}
        {note ? <p className="mt-2 text-center text-sm text-[var(--esk-purple)]">{note}</p> : null}

        {rows && count === 0 ? (
          <div className="esk-def-empty">
            <div className="esk-def-empty-icon"><i className="fa-light fa-face-smile" /></div>
            <h4>No Fee Defaulters</h4>
            <p>No fee defaulters found for <strong>{monthLabel(month)}</strong>.</p>
          </div>
        ) : null}

        {rows && count > 0 && !showList ? (
          <p className="mt-4 text-center text-sm text-[var(--esk-muted)]">
            {count} student{count === 1 ? "" : "s"} owing for {monthLabel(month)}. Use See Details for the list.
          </p>
        ) : null}

        {rows && count > 0 && showList ? (
          <div className="mt-4 overflow-x-auto">
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Reg</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Owing</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.registrationNo}</td>
                    <td>{row.name}</td>
                    <td>{row.className}</td>
                    <td>{row.owing}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="esk-btn-ghost"
                        onClick={() => void api<Detail>(`/fees/defaulters/${row.id}?month=${month}`).then(setDetail).catch((err: Error) => setError(err.message))}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="esk-btn-ghost ml-1"
                        onClick={() =>
                          void api<Reminder>(`/fees/defaulters/${row.id}/remind`, { method: "POST", body: JSON.stringify({ month }) })
                            .then((result) =>
                              setNote(
                                result.status === "opted_out"
                                  ? `${result.phone} has opted out. No balance was used.`
                                  : `Reminder saved for ${result.phone}. Status not sent. Balance ${result.balance}.`,
                              ),
                            )
                            .catch((err: Error) => setError(err.message))
                        }
                      >
                        Remind
                      </button>
                      <button
                        type="button"
                        className="esk-btn-ghost ml-1"
                        onClick={() =>
                          void api<{ targetMonth: string; amount: string }>("/fees/carry", {
                            method: "POST",
                            body: JSON.stringify({ studentId: row.id, month }),
                          })
                            .then((result) => {
                              setNote(`${result.amount} carries to ${result.targetMonth}.`);
                              return load(month);
                            })
                            .catch((err: Error) => setError(err.message))
                        }
                      >
                        Carry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {rows && count > 0 && showList ? (
        <article className="esk-report-doc mt-4 hidden print:block">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-triangle-exclamation text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Fee defaulters</h2>
              <p>{institute?.name ?? "School"} · {monthLabel(month)} · {count} student{count === 1 ? "" : "s"}</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead><tr><th>Reg</th><th>Name</th><th>Class</th><th>Owing</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.registrationNo}</td>
                  <td>{row.name}</td>
                  <td>{row.className}</td>
                  <td>{row.owing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      {detail ? (
        <article className="esk-report-doc mt-4">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-receipt text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Defaulter detail</h2>
              <p>{institute?.name ?? "School"} · {detail.registrationNo} · {detail.name} · {detail.className}</p>
            </div>
          </header>
          <div className="esk-certificate-meta">
            <div><span>Fee month</span><strong>{detail.month}</strong></div>
            <div><span>Source</span><strong>{detail.source}</strong></div>
            <div><span>SMS phone</span><strong>{detail.phone || "none"}</strong></div>
            <div><span>Owing</span><strong>{detail.owing}</strong></div>
          </div>
          <table className="esk-receipt-table mt-3">
            <thead><tr><th>Line</th><th>Amount</th></tr></thead>
            <tbody>
              {lineLabels.map(([key, label]) => (
                <tr key={key}><td>{label}</td><td>{detail.lines[key]}</td></tr>
              ))}
              <tr className="font-semibold"><td>Billed</td><td>{detail.billed}</td></tr>
              <tr className="font-semibold"><td>Deposited</td><td>{detail.deposited}</td></tr>
              <tr className="font-semibold"><td>Owing</td><td>{detail.owing}</td></tr>
            </tbody>
          </table>
        </article>
      ) : null}

      {carryOpen ? (
        <div className="esk-modal-backdrop" role="presentation" onClick={() => setCarryOpen(false)}>
          <div className="esk-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h5>Carry Forward Balance?</h5>
            <p>This will transfer unpaid fees of {monthLabel(month)} as previous balance and clear the defaulter list.</p>
            <div className="esk-modal-actions">
              <button type="button" className="esk-btn-ghost" onClick={() => setCarryOpen(false)}>Cancel</button>
              <button type="button" className="esk-btn-primary" onClick={() => void carryAll()}>Carry Forward</button>
            </div>
          </div>
        </div>
      ) : null}
    </PageChrome>
  );
}
