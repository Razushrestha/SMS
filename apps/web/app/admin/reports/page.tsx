"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";

type Column = { key: string; label: string };
type Source = { source: string; filters: string[]; columns: Column[] };
type Saved = { id: string; name: string; source: string; columns: string[]; filter: string; fromDate: string; toDate: string };
type Run = { name: string; from: string; to: string; columns: Column[]; rows: Array<Record<string, string>>; message: string | null };

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function CustomReportsPage() {
  const [catalog, setCatalog] = useState<Source[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [source, setSource] = useState("accounts");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [result, setResult] = useState<Run | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const current = catalog.find((item) => item.source === source);

  async function load() {
    const [sources, rows, profile] = await Promise.all([
      api<Source[]>("/custom-reports/catalog"),
      api<Saved[]>("/custom-reports"),
      api<{ institute: Institute }>("/institute"),
    ]);
    setCatalog(sources);
    setSaved(rows);
    setInstitute(profile.institute);
    const first = sources.find((item) => item.source === "accounts") ?? sources[0];
    if (first && picked.length === 0) {
      setSource(first.source);
      setPicked(first.columns.map((column) => column.key));
      setFilter(first.filters[0] ?? "all");
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  function chooseSource(next: string) {
    const item = catalog.find((row) => row.source === next);
    setSource(next);
    setPicked(item?.columns.map((column) => column.key) ?? []);
    setFilter(item?.filters[0] ?? "all");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      await api("/custom-reports", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          source,
          columns: picked,
          filter,
          from: data.get("from"),
          to: data.get("to"),
        }),
      });
      setNote("Report saved. Running it does not post a payment.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the report");
    }
  }

  async function run(id: string) {
    setError("");
    setResult(await api<Run>(`/custom-reports/${id}/run`));
  }

  async function download(row: Saved) {
    const file = await api<{ filename: string; csv: string }>(`/custom-reports/${row.id}/export`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([file.csv], { type: "text/csv" }));
    link.download = file.filename;
    link.click();
  }

  async function remove(row: Saved) {
    if (!confirm(`Delete the ${row.name} report?`)) return;
    await api(`/custom-reports/${row.id}`, { method: "DELETE" });
    if (result?.name === row.name) setResult(null);
    await load();
  }

  return (
    <PageChrome icon="fa-light fa-file-lines" crumbs={[{ label: "Reports", href: "/admin/reports" }, { label: "Custom Reports" }]}>
      <p className="mb-3 max-w-2xl text-sm text-[var(--esk-muted)]">Save the columns, filter, and date range. Print and export use the saved report and do not change fees or salaries.</p>
      <form className="esk-panel" onSubmit={save}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><input className={control} name="name" required /></Field>
          <Field label="Source">
            <select className={control} value={source} onChange={(event) => chooseSource(event.target.value)}>
              {catalog.map((item) => <option key={item.source} value={item.source}>{item.source}</option>)}
            </select>
          </Field>
          <Field label="Filter">
            <select className={control} value={filter} onChange={(event) => setFilter(event.target.value)}>
              {(current?.filters ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><input className={control} name="from" type="date" defaultValue={monthStart()} required /></Field>
            <Field label="To"><input className={control} name="to" type="date" defaultValue={today()} required /></Field>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {(current?.columns ?? []).map((column) => (
            <label key={column.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={picked.includes(column.key)}
                onChange={(event) => setPicked(event.target.checked ? [...picked, column.key] : picked.filter((key) => key !== column.key))}
              />
              {column.label}
            </label>
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {note ? <p className="mt-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
        <button className="esk-btn-primary mt-4" type="submit"><i className="fa-light fa-floppy-disk" /> Save report</button>
      </form>
      <DataCard>
        {saved.length === 0 ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-file-lines" /></div>
            <h5>No Custom Reports Yet</h5>
            <p>Save a report configuration above.</p>
          </div>
        ) : (
          <table className="esk-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Range</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {saved.map((row) => (
                <tr key={row.id}>
                  <td>{row.name} · {row.source} · {row.filter}</td>
                  <td>{row.fromDate} to {row.toDate}</td>
                  <td className="text-right">
                    <button className="esk-btn-ghost" type="button" onClick={() => void run(row.id)}>Run</button>
                    <button className="esk-btn-ghost ml-2" type="button" onClick={() => void download(row)}>Export</button>
                    <button className="ml-2 text-red-600" type="button" onClick={() => void remove(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataCard>
      {result ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end print:hidden">
            <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
              <i className="fa-light fa-print" /> Print
            </button>
          </div>
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-file-lines text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>{result.name}</h2>
                <p>{institute?.name ?? "School"} · {result.from} to {result.to}</p>
              </div>
            </header>
            {result.message ? (
              <div className="esk-empty">
                <div><i className="fa-light fa-file-lines" /></div>
                <h5>No Rows</h5>
                <p>{result.message}</p>
              </div>
            ) : (
              <table className="esk-receipt-table">
                <thead>
                  <tr>{result.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index}>
                      {result.columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </div>
      ) : null}
    </PageChrome>
  );
}
