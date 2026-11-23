"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Head = { id: string; name: string; type: "income" | "expense" };

export default function AccountsPage() {
  const [heads, setHeads] = useState<Head[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setHeads(await api<Head[]>("/account-heads"));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function addHead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      await api("/account-heads", { method: "POST", body: JSON.stringify({ name: data.get("name"), type: data.get("type") }) });
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the head");
    }
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setMessage("");
    try {
      await api("/statement", {
        method: "POST",
        body: JSON.stringify({
          headId: data.get("headId"),
          date: data.get("date"),
          description: data.get("description"),
          amount: data.get("amount"),
        }),
      });
      form.reset();
      setMessage("Posted to the statement.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this account head?")) return;
    try {
      await api(`/account-heads/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the head");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-wallet"
      crumbs={[{ label: "Accounts", href: "/admin/accounts" }, { label: "Chart of Accounts" }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link className="esk-btn-ghost" href="/admin/accounts/statement">Statement</Link>
          <Link className="esk-btn-ghost" href="/admin/accounts/report">Report</Link>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="esk-panel" onSubmit={addHead}>
          <h2>Add account head</h2>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">Income and expense need a head. Delete removes only an unused head.</p>
          <div className="mt-3">
            <Field label="Head name"><input className={control} name="name" required /></Field>
            <Field label="Type">
              <select className={control} name="type" defaultValue="income">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </Field>
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Save head</button>
          </div>
        </form>
        <form className="esk-panel" onSubmit={addEntry}>
          <h2>Add income or expense</h2>
          <div className="mt-3">
            <Field label="Account head">
              <select className={control} name="headId" required defaultValue="">
                <option value="" disabled>Select a head</option>
                {heads.map((head) => <option key={head.id} value={head.id}>{head.name} ({head.type})</option>)}
              </select>
            </Field>
            <Field label="Date"><input className={control} name="date" type="date" required /></Field>
            <Field label="Description"><input className={control} name="description" required /></Field>
            <Field label="Amount"><input className={control} name="amount" type="number" min="0.01" step="0.01" required /></Field>
            {message ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{message}</p> : null}
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <button className="esk-btn-primary" type="submit" disabled={heads.length === 0}><i className="fa-light fa-check" /> Post</button>
          </div>
        </form>
      </div>
      <DataCard>
        {heads.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-wallet" /></div>
            <h5>No Account Heads</h5>
            <p>Add an income or expense head to start posting.</p>
          </div>
        ) : (
          <table className="esk-table">
            <thead>
              <tr>
                <th>Head</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {heads.map((head) => (
                <tr key={head.id}>
                  <td>{head.name}</td>
                  <td className="capitalize">{head.type}</td>
                  <td className="text-right">
                    <button className="text-red-600" type="button" onClick={() => void remove(head.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataCard>
    </PageChrome>
  );
}
