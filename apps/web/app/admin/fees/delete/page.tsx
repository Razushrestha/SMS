"use client";

import { FormEvent, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type HistoryRow = { id: string; serial: number; date: string; month: string; total: string; deposit: string; due: string };
type Slip = {
  empty: boolean;
  message?: string;
  student?: { registrationNo: string; name: string; className: string };
  history?: HistoryRow[];
};

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function DeleteFeesPage() {
  const [slip, setSlip] = useState<Slip | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      setSlip(await api<Slip>(`/fees/slip?registration=${encodeURIComponent(String(data.get("registration")))}&month=${encodeURIComponent(String(data.get("month")))}`));
    } catch (err) {
      setSlip(null);
      setError(err instanceof Error ? err.message : "Could not load fee payments");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this fee payment and reverse the statement row?")) return;
    setError("");
    try {
      await api(`/fees/${id}`, { method: "DELETE" });
      setNote("Payment deleted.");
      setSlip((current) => (current ? { ...current, history: (current.history ?? []).filter((row) => row.id !== id) } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the payment");
    }
  }

  return (
    <PageChrome icon="fa-light fa-trash" crumbs={[{ label: "Fees", href: "/admin/fees" }, { label: "Delete Fees" }]}>
      <div className="esk-fee-wrap">
        <div className="esk-fee-card">
          <div className="esk-fee-head">
            <h4>Delete Fees</h4>
            <p>Find a student payment and remove it from the ledger.</p>
          </div>
          <form className="esk-fee-panel" onSubmit={load}>
            <label className="esk-fee-label"><i className="fa-light fa-magnifying-glass" /> Search Student *</label>
            <input className="esk-fee-input" name="registration" required placeholder="Type student name or registration number" />
            <div className="mt-3">
              <Field label="Fees Month *">
                <input className={control} name="month" type="month" defaultValue={thisMonth()} required />
              </Field>
            </div>
            <button className="esk-fee-submit" type="submit"><i className="fa-light fa-magnifying-glass" /> Show Payments</button>
          </form>
          {error ? <p className="esk-fee-error">{error}</p> : null}
          {note ? <p className="mt-2 text-center text-sm text-[var(--esk-teal)]">{note}</p> : null}
        </div>
      </div>

      {slip ? (
        <div className="esk-def-card mt-4">
          {slip.empty || !(slip.history ?? []).length ? (
            <div className="esk-def-empty">
              <div className="esk-def-empty-icon"><i className="fa-light fa-trash" /></div>
              <h4>No Fees Record</h4>
              <p>{slip.message ?? "No fee record found for the selected student and period."}</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-[var(--esk-navy)]">
                {slip.student?.name} · {slip.student?.className} · Reg {slip.student?.registrationNo}
              </p>
              <div className="overflow-x-auto">
                <table className="esk-table">
                  <thead>
                    <tr>
                      {["#", "Date", "Month", "Total", "Deposit", "Due", ""].map((label) => (
                        <th key={label || "action"}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(slip.history ?? []).map((row) => (
                      <tr key={row.id}>
                        <td>{row.serial}</td>
                        <td>{row.date}</td>
                        <td>{row.month}</td>
                        <td>{row.total}</td>
                        <td>{row.deposit}</td>
                        <td>{row.due}</td>
                        <td className="text-right">
                          <button type="button" className="esk-fee-delete" onClick={() => void remove(row.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}
    </PageChrome>
  );
}
