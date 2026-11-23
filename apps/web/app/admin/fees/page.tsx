"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Preview = {
  name: string;
  fatherName: string | null;
  className: string;
  registrationNo: string;
  month: string;
  alreadyAdded: boolean;
  monthlyFee: string;
  discount: string;
  discountReason: string;
  total: string;
};

type Payment = Preview & { id: string; deposit: string; due: string; paidOn: string; total: string };
type FamilyRow = { registrationNo: string; name: string; className: string; alreadyAdded: boolean; total: string };
type FamilyBill = { familyId: string; family: string; month: string; students: FamilyRow[] };
type OpenInvoice = { receiptNo: string; registrationNo: string; name: string; className: string; month: string; total: string; deposited: string; owing: string };
type ScanHit = { receiptNo: string; registrationNo: string; name: string; className: string; month: string; total: string; deposited: string; owing: string };
type Mode = "student" | "family" | "scan";

function thisMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function FeesPage() {
  const [mode, setMode] = useState<Mode>("student");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState("");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [studentReady, setStudentReady] = useState(false);
  const [families, setFamilies] = useState<Array<{ id: string; name: string }>>([]);
  const [familyBill, setFamilyBill] = useState<FamilyBill | null>(null);
  const [familyDeposits, setFamilyDeposits] = useState<Record<string, string>>({});
  const [familyNote, setFamilyNote] = useState("");
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [scan, setScan] = useState<ScanHit | null>(null);
  const [scanNote, setScanNote] = useState("");

  async function loadInvoices() {
    setInvoices(await api<OpenInvoice[]>("/fees/invoices"));
  }

  useEffect(() => {
    api<Array<{ id: string; name: string }>>("/families").then(setFamilies).catch((err: Error) => setError(err.message));
    loadInvoices().catch((err: Error) => setError(err.message));
  }, []);

  async function findStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setReceipt(null);
    setPreview(null);
    const reg = query.trim();
    if (!reg) return;
    setRegistration(reg);
    try {
      setPreview(await api<Preview>(`/fees/preview?registration=${encodeURIComponent(reg)}&month=${month}`));
      setStudentReady(true);
    } catch (err) {
      setStudentReady(false);
      setError(err instanceof Error ? err.message : "Student not found.");
    }
  }

  async function reloadBill(nextMonth: string) {
    if (!registration) return;
    setMonth(nextMonth);
    setError("");
    try {
      setPreview(await api<Preview>(`/fees/preview?registration=${encodeURIComponent(registration)}&month=${nextMonth}`));
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Student not found.");
    }
  }

  async function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) return;
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      const payment = await api<Payment>("/fees", {
        method: "POST",
        body: JSON.stringify({
          registration,
          month,
          date: data.get("date"),
          deposit: data.get("deposit"),
        }),
      });
      setReceipt({ ...preview, ...payment });
      setPreview(await api<Preview>(`/fees/preview?registration=${encodeURIComponent(registration)}&month=${month}`));
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not collect the fee");
    }
  }

  async function loadFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFamilyNote("");
    setError("");
    try {
      const bill = await api<FamilyBill>(`/fees/family?familyId=${encodeURIComponent(String(data.get("familyId")))}&month=${encodeURIComponent(String(data.get("month")))}`);
      setFamilyBill(bill);
      setFamilyDeposits(Object.fromEntries(bill.students.map((student) => [student.registrationNo, student.total])));
    } catch (err) {
      setFamilyBill(null);
      setError(err instanceof Error ? err.message : "Could not load the family");
    }
  }

  async function payFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!familyBill) return;
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      const result = await api<{ count: number }>(`/fees/family`, {
        method: "POST",
        body: JSON.stringify({
          familyId: data.get("familyId"),
          month: familyBill.month,
          date: data.get("date"),
          deposits: familyBill.students.map((student) => ({ registration: student.registrationNo, deposit: familyDeposits[student.registrationNo] ?? "0" })),
        }),
      });
      setFamilyNote(`${result.count} family payment${result.count === 1 ? "" : "s"} posted. Each deposit is its own statement row.`);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not collect the family fee");
    }
  }

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code"));
    setScanNote("");
    setError("");
    try {
      setScan(await api<ScanHit>(`/fees/scan?code=${encodeURIComponent(code)}`));
    } catch (err) {
      setScan(null);
      setError(err instanceof Error ? err.message : "No invoice matches that receipt.");
    }
  }

  async function payScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scan) return;
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      const paid = await api<{ receiptNo: string; deposit: string; due: string }>("/fees/scan", {
        method: "POST",
        body: JSON.stringify({ code: scan.receiptNo, date: data.get("date"), deposit: data.get("deposit") }),
      });
      setScanNote(`${paid.receiptNo} paid ${paid.deposit}. Due ${paid.due}.`);
      setScan(null);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pay the invoice");
    }
  }

  const tabs: Array<{ id: Mode; label: string; icon: string }> = [
    { id: "student", label: "Student Wise", icon: "fa-light fa-user" },
    { id: "family", label: "Family Wise", icon: "fa-light fa-people-group" },
    { id: "scan", label: "Scan Paid Invoice", icon: "fa-light fa-barcode" },
  ];

  return (
    <PageChrome icon="fa-light fa-money-bill" crumbs={[{ label: "Fees", href: "/admin/fees" }, { label: "Collect Fees" }]}>
      <div className="esk-fee-wrap">
        <div className="esk-fee-card">
          <div className="esk-fee-head">
            <h4>Collect Fees</h4>
            <p>Choose how you want to collect fees today.</p>
          </div>

          <div className="esk-fee-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`esk-fee-tab ${mode === tab.id ? "active" : ""}`}
                onClick={() => {
                  setMode(tab.id);
                  setError("");
                  setStudentReady(false);
                  setPreview(null);
                  setReceipt(null);
                  setFamilyBill(null);
                  setScan(null);
                }}
              >
                <i className={tab.icon} /> {tab.label}
              </button>
            ))}
          </div>

          {error ? <p className="esk-fee-error">{error}</p> : null}

          {mode === "student" ? (
            <div className="esk-fee-panel">
              <form onSubmit={findStudent}>
                <label className="esk-fee-label">
                  <i className="fa-light fa-magnifying-glass" /> Search Student *
                </label>
                <input
                  className="esk-fee-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type student name or registration number"
                  required
                />
                <button className="esk-fee-submit" type="submit">Continue</button>
              </form>

              {studentReady && preview ? (
                <form className="esk-fee-bill" onSubmit={collect}>
                  <div className="esk-fee-student">
                    <strong>{preview.name}</strong>
                    <span>{preview.className} · Reg {preview.registrationNo}</span>
                    <span>Father {preview.fatherName || "—"}</span>
                  </div>
                  <label className="esk-fee-label">
                    <i className="fa-light fa-calendar" /> Fee Month *
                  </label>
                  <input
                    className="esk-fee-input"
                    type="month"
                    value={month}
                    onChange={(event) => void reloadBill(event.target.value)}
                    required
                  />
                  {preview.alreadyAdded ? (
                    <p className="esk-fee-warn">Monthly fee of this student is already added for this month. The system will not add it again.</p>
                  ) : null}
                  <div className="esk-fee-totals">
                    <p>Monthly fee <strong>{preview.monthlyFee}</strong></p>
                    <p>Discount <strong>{preview.discount}{preview.discountReason ? ` · ${preview.discountReason}` : ""}</strong></p>
                    <p className="total">Total <strong>{preview.total}</strong></p>
                  </div>
                  <div className="esk-fee-grid">
                    <Field label="Date"><input className={control} name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
                    <Field label="Deposit"><input className={control} name="deposit" type="number" min="0" step="0.01" required defaultValue={preview.total} /></Field>
                  </div>
                  <button className="esk-fee-submit solid" type="submit">Submit fees</button>
                </form>
              ) : null}

              {receipt ? (
                <div className="esk-fee-slip">
                  <h5>Fee submission slip</h5>
                  <p>Reg {receipt.registrationNo} · {receipt.name} · {receipt.className}</p>
                  <p>Total {receipt.total} · Deposit {receipt.deposit} · Due {receipt.due}</p>
                  <button
                    className="esk-fee-delete"
                    type="button"
                    onClick={async () => {
                      if (!confirm("Delete this fee payment and reverse the statement row?")) return;
                      await api(`/fees/${receipt.id}`, { method: "DELETE" });
                      setReceipt(null);
                      setPreview(await api<Preview>(`/fees/preview?registration=${encodeURIComponent(registration)}&month=${month}`));
                    }}
                  >
                    Delete this payment
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "family" ? (
            <div className="esk-fee-panel">
              <form onSubmit={loadFamily}>
                <label className="esk-fee-label">
                  <i className="fa-light fa-calendar" /> Fee Month *
                </label>
                <input className="esk-fee-input" name="month" type="month" defaultValue={month} required />
                <label className="esk-fee-label">
                  <i className="fa-light fa-people-group" /> Select Family *
                </label>
                <select className="esk-fee-input" name="familyId" required defaultValue="">
                  <option value="" disabled>Select Family</option>
                  {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
                </select>
                <button className="esk-fee-submit solid" type="submit">Load family</button>
              </form>
              {familyBill ? (
                <form className="esk-fee-bill" onSubmit={payFamily}>
                  <input type="hidden" name="familyId" value={familyBill.familyId} />
                  <p className="esk-fee-family-title">{familyBill.family} · {familyBill.month}</p>
                  {familyBill.students.map((student) => (
                    <div key={student.registrationNo} className="esk-fee-family-row">
                      <p>{student.registrationNo} · {student.name} · {student.className} · total {student.total}{student.alreadyAdded ? " · already added" : ""}</p>
                      <input className={control} type="number" min="0" step="0.01" value={familyDeposits[student.registrationNo] ?? ""} onChange={(event) => setFamilyDeposits((current) => ({ ...current, [student.registrationNo]: event.target.value }))} />
                    </div>
                  ))}
                  <Field label="Date"><input className={control} name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
                  <button className="esk-fee-submit solid" type="submit">Collect family</button>
                </form>
              ) : null}
              {familyNote ? <p className="esk-fee-note">{familyNote}</p> : null}
            </div>
          ) : null}

          {mode === "scan" ? (
            <div className="esk-fee-panel">
              <p className="esk-fee-hint">Enter the receipt number, or the QR text.</p>
              <form onSubmit={lookup}>
                <label className="esk-fee-label">
                  <i className="fa-light fa-barcode" /> Receipt or QR *
                </label>
                <input className="esk-fee-input" name="code" required placeholder="INV- or nepatronix:invoice:INV-" />
                <button className="esk-fee-submit solid" type="submit">Find invoice</button>
              </form>
              <ul className="esk-fee-invoice-list">
                {invoices.map((row) => <li key={row.receiptNo}>{row.receiptNo} · {row.registrationNo} {row.name} · {row.month} · owing {row.owing}</li>)}
                {invoices.length === 0 ? <li>No open invoices.</li> : null}
              </ul>
              {scan ? (
                <form className="esk-fee-bill" onSubmit={payScan}>
                  <p>{scan.receiptNo} · {scan.name} · {scan.className} · {scan.month}</p>
                  <p>Total {scan.total} · deposited {scan.deposited} · owing {scan.owing}</p>
                  <div className="esk-fee-grid">
                    <Field label="Date"><input className={control} name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
                    <Field label="Deposit"><input className={control} name="deposit" type="number" min="0" step="0.01" required defaultValue={scan.owing} /></Field>
                  </div>
                  <button className="esk-fee-submit solid" type="submit">Pay invoice</button>
                </form>
              ) : null}
              {scanNote ? <p className="esk-fee-note">{scanNote}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </PageChrome>
  );
}
