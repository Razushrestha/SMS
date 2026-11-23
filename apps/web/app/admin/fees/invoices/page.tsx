"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Bank = { id: string; name: string; branchAddress: string; accountNumber: string; instructions: string; logoData: string };
type ClassRow = { id: string; name: string };
type Family = { id: string; name: string };
type Batch = { created: Slip[]; skipped: Array<{ registrationNo: string; name: string }> };
type Slip = {
  id: string;
  instituteName: string;
  instituteLogo: string | null;
  institutePhone: string;
  student: string;
  fatherName: string | null;
  className: string;
  registrationNo: string;
  receiptNo: string;
  month: string;
  issuedOn: string;
  dueDate: string;
  lines: { monthlyFee: string; admission: string; registration: string; art: string; transport: string; books: string; uniform: string; fine: string; others: string; previousBalance: string; discount: string };
  total: string;
  lateFine: string;
  payableAfterDue: string;
  bank: { name: string; branch: string; accountNumber: string; instructions: string };
};

type Mode = "student" | "class" | "family";

const lineLabels: Array<[keyof Slip["lines"], string]> = [
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

function defaultDue() {
  const date = new Date();
  date.setDate(10);
  if (date.getDate() > 10) date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export default function InvoicesPage() {
  const [mode, setMode] = useState<Mode>("student");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [bankRows, classRows, familyRows] = await Promise.all([
      api<Bank[]>("/fees/banks"),
      api<ClassRow[]>("/classes"),
      api<Family[]>("/families"),
    ]);
    setBanks(bankRows);
    setClasses(classRows);
    setFamilies(familyRows);
    if (bankRows.length === 0) setShowBankForm(true);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function saveBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("logo");
    setError("");
    const body: Record<string, unknown> = {
      name: data.get("name"),
      branchAddress: data.get("branchAddress"),
      accountNumber: data.get("accountNumber"),
      instructions: data.get("instructions"),
    };
    if (file instanceof File && file.size > 0) {
      if (file.type !== "image/png" && file.type !== "image/jpeg") {
        setError("Logo must be a JPG or PNG");
        return;
      }
      if (file.size > 500 * 1024) {
        setError("Logo must be 500 KB or smaller");
        return;
      }
      body.logoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the logo"));
        reader.readAsDataURL(file);
      });
    } else if (!editing) {
      setError("Logo must be a JPG or PNG");
      return;
    }
    try {
      await api(editing ? `/fees/banks/${editing.id}` : "/fees/banks", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setEditing(null);
      setShowBankForm(false);
      setNote(editing ? "Bank account updated." : "Bank account saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the bank");
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setNote("");
    try {
      const slip = await api<Slip>("/fees/invoices", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      setSlips([slip]);
      setNote("Invoice created. It is a due, not a payment.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the invoice");
    }
  }

  async function generateMany(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setNote("");
    try {
      const batch = await api<Batch>(path, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      setSlips(batch.created);
      const count = `${batch.created.length} invoice${batch.created.length === 1 ? "" : "s"} created.`;
      const skipped = batch.skipped.length ? ` Skipped ${batch.skipped.map((row) => `${row.registrationNo} ${row.name}`).join(", ")}.` : "";
      setNote(count + skipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the invoices");
    }
  }

  const tabs: Array<{ id: Mode; label: string; icon: string }> = [
    { id: "student", label: "Student Wise", icon: "fa-light fa-user" },
    { id: "class", label: "Class Wise", icon: "fa-light fa-chalkboard" },
    { id: "family", label: "Family Wise", icon: "fa-light fa-people-group" },
  ];

  return (
    <PageChrome icon="fa-light fa-file-invoice" crumbs={[{ label: "Fees", href: "/admin/fees" }, { label: "Generate Fees Invoice" }]}>
      <div className="esk-fee-wrap">
        <div className="esk-fee-card">
          <div className="esk-fee-head">
            <h4>Generate Fees Invoice</h4>
            <p>Create student, class, or family fee challans.</p>
          </div>

          {banks.length === 0 || showBankForm ? (
            <div className="esk-fee-panel">
              <div className="esk-att-section" style={{ marginTop: 0 }}>
                <span className="esk-att-num">1</span>
                <strong>{editing ? "Edit Bank" : "Add New Bank"}</strong>
              </div>
              <form key={editing?.id ?? "new"} onSubmit={saveBank}>
                <div className="esk-att-grid">
                  <Field label="Bank Logo *">
                    <input className={control} name="logo" type="file" accept="image/png,image/jpeg" required={!editing} />
                  </Field>
                  <Field label="Bank Name *">
                    <input className={control} name="name" placeholder="Your Bank Name" defaultValue={editing?.name ?? ""} required />
                  </Field>
                  <Field label="Bank / Branch Address *">
                    <input className={control} name="branchAddress" placeholder="Bank Address" defaultValue={editing?.branchAddress ?? ""} required />
                  </Field>
                  <Field label="Account Number *">
                    <input className={control} name="accountNumber" placeholder="Bank Account No" defaultValue={editing?.accountNumber ?? ""} required />
                  </Field>
                </div>
                <Field label="Instructions">
                  <input className={control} name="instructions" placeholder="Write Instructions" defaultValue={editing?.instructions ?? ""} />
                </Field>
                <p className="mb-3 text-xs text-[var(--esk-muted)]">JPG, PNG. Max 500KB</p>
                <div className="esk-att-actions" style={{ gap: 8 }}>
                  <button className="esk-btn-primary" type="submit">{editing ? "Update Bank" : "Add Bank"}</button>
                  {banks.length > 0 ? (
                    <button type="button" className="esk-btn-ghost" onClick={() => { setEditing(null); setShowBankForm(false); }}>Cancel</button>
                  ) : null}
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="esk-fee-tabs" role="tablist">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`esk-fee-tab ${mode === tab.id ? "active" : ""}`}
                    onClick={() => { setMode(tab.id); setError(""); setNote(""); }}
                  >
                    <i className={tab.icon} /> {tab.label}
                  </button>
                ))}
              </div>

              {mode === "student" ? (
                <form className="esk-fee-panel" onSubmit={generate}>
                  <label className="esk-fee-label"><i className="fa-light fa-magnifying-glass" /> Search Student *</label>
                  <input className="esk-fee-input" name="registration" placeholder="Type student name or registration number" defaultValue="1" required />
                  <div className="esk-att-grid" style={{ marginTop: 14 }}>
                    <Field label="Fee Month *"><input className={control} name="month" type="month" defaultValue={thisMonth()} required /></Field>
                    <Field label="Due Date *"><input className={control} name="dueDate" type="date" defaultValue={defaultDue()} required /></Field>
                    <Field label="Late Fine"><input className={control} name="lateFine" type="number" min="0" step="0.01" defaultValue="50" /></Field>
                    <Field label="Bank *">
                      <select className={control} name="bankId" required defaultValue={banks[0]?.id}>
                        {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  <button className="esk-fee-submit" type="submit"><i className="fa-light fa-check" /> Generate Invoice</button>
                </form>
              ) : null}

              {mode === "class" ? (
                <form className="esk-fee-panel" onSubmit={(event) => generateMany(event, "/fees/invoices/class")}>
                  <Field label="Class *">
                    <select className={control} name="classId" required defaultValue={classes[0]?.id}>
                      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <div className="esk-att-grid" style={{ marginTop: 14 }}>
                    <Field label="Fee Month *"><input className={control} name="month" type="month" defaultValue={thisMonth()} required /></Field>
                    <Field label="Due Date *"><input className={control} name="dueDate" type="date" defaultValue={defaultDue()} required /></Field>
                    <Field label="Late Fine"><input className={control} name="lateFine" type="number" min="0" step="0.01" defaultValue="50" /></Field>
                    <Field label="Bank *">
                      <select className={control} name="bankId" required defaultValue={banks[0]?.id}>
                        {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  <button className="esk-fee-submit" type="submit"><i className="fa-light fa-check" /> Generate Class Invoices</button>
                </form>
              ) : null}

              {mode === "family" ? (
                families.length === 0 ? (
                  <p className="esk-fee-error">Add a family before generating a family invoice.</p>
                ) : (
                  <form className="esk-fee-panel" onSubmit={(event) => generateMany(event, "/fees/invoices/family")}>
                    <Field label="Family *">
                      <select className={control} name="familyId" required defaultValue={families[0]?.id}>
                        {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
                      </select>
                    </Field>
                    <div className="esk-att-grid" style={{ marginTop: 14 }}>
                      <Field label="Fee Month *"><input className={control} name="month" type="month" defaultValue={thisMonth()} required /></Field>
                      <Field label="Due Date *"><input className={control} name="dueDate" type="date" defaultValue={defaultDue()} required /></Field>
                      <Field label="Late Fine"><input className={control} name="lateFine" type="number" min="0" step="0.01" defaultValue="50" /></Field>
                      <Field label="Bank *">
                        <select className={control} name="bankId" required defaultValue={banks[0]?.id}>
                          {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                        </select>
                      </Field>
                    </div>
                    <button className="esk-fee-submit" type="submit"><i className="fa-light fa-check" /> Generate Family Invoices</button>
                  </form>
                )
              ) : null}

              <div className="esk-inv-banks">
                <div className="esk-inv-banks-head">
                  <strong>Accounts For Fees Invoice</strong>
                  <button type="button" className="esk-btn-ghost" onClick={() => { setEditing(null); setShowBankForm(true); }}>
                    <i className="fa-light fa-plus" /> Add Bank
                  </button>
                </div>
                <table className="esk-table">
                  <thead>
                    <tr>
                      <th>Bank Name</th>
                      <th>Logo</th>
                      <th>Account No.</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.map((bank) => (
                      <tr key={bank.id}>
                        <td>{bank.name}</td>
                        <td><img src={bank.logoData} alt="" className="h-8 w-8 object-contain" /></td>
                        <td>{bank.accountNumber}</td>
                        <td>
                          <button type="button" className="esk-btn-ghost" onClick={() => { setEditing(bank); setShowBankForm(true); }}>Edit</button>
                          <button
                            type="button"
                            className="ml-2 text-sm text-red-600"
                            onClick={() => {
                              if (window.confirm("Are you sure to Delete?")) {
                                api(`/fees/banks/${bank.id}`, { method: "DELETE" }).then(load).catch((err: Error) => setError(err.message));
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error ? <p className="esk-fee-error">{error}</p> : null}
          {note ? <p className="mt-3 text-center text-sm text-[var(--esk-purple)]">{note}</p> : null}
        </div>
      </div>

      {slips.length ? (
        <div className="mt-4 flex justify-end print:hidden">
          <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
            <i className="fa-light fa-print" /> Print all copies
          </button>
        </div>
      ) : null}

      {slips.map((slip) => (
        <div key={slip.id} className="mt-4 space-y-4">
          {(["Bank", "Student", "Institute"] as const).map((copy) => (
            <article key={copy} className="esk-receipt">
              <header className="esk-receipt-head">
                {slip.instituteLogo ? <img src={slip.instituteLogo} alt={slip.instituteName} /> : <i className="fa-light fa-file-invoice text-2xl text-[var(--esk-purple)]" />}
                <div>
                  <h2>Fees invoice · {copy} copy</h2>
                  <p>{slip.instituteName} · {slip.institutePhone}</p>
                </div>
              </header>
              <div className="esk-receipt-meta">
                <div><span>Registration</span><strong>{slip.registrationNo}</strong></div>
                <div><span>Student</span><strong>{slip.student}</strong></div>
                <div><span>Guardian</span><strong>{slip.fatherName || "—"}</strong></div>
                <div><span>Class</span><strong>{slip.className}</strong></div>
                <div><span>Receipt</span><strong>{slip.receiptNo}</strong></div>
                <div><span>Fee month</span><strong>{slip.month}</strong></div>
                <div><span>Issued</span><strong>{slip.issuedOn}</strong></div>
                <div><span>Due</span><strong>{slip.dueDate}</strong></div>
              </div>
              <div className="esk-receipt-meta">
                <div><span>Bank</span><strong>{slip.bank.name}</strong></div>
                <div><span>Branch</span><strong>{slip.bank.branch}</strong></div>
                <div><span>Account</span><strong>{slip.bank.accountNumber}</strong></div>
                <div><span>Instructions</span><strong>{slip.bank.instructions}</strong></div>
              </div>
              <table className="esk-receipt-table">
                <thead><tr><th>Particular</th><th>Amount</th></tr></thead>
                <tbody>
                  {lineLabels.map(([key, label]) => (
                    <tr key={key}><td>{label}</td><td>{slip.lines[key]}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="esk-receipt-totals">
                <div><span>Total</span><strong>{slip.total}</strong></div>
                <div><span>Payable after due</span><strong>{slip.payableAfterDue}</strong></div>
                <div><span>Late fine (separate)</span><strong>{slip.lateFine}</strong></div>
              </div>
              <div className="esk-receipt-sign">
                <span>Prepared By</span>
                <span>Checked By</span>
                <span>Accounts Department</span>
              </div>
            </article>
          ))}
        </div>
      ))}
    </PageChrome>
  );
}
