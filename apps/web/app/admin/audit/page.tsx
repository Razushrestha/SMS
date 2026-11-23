"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { FilterCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";

type EventRow = { id: string; actorName: string; label: string; detail: string; createdAt: string };

export default function AuditPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<EventRow[]>("/audit"),
      api<{ institute: Institute }>("/institute"),
    ]).then(([events, profile]) => {
      setRows(events);
      setInstitute(profile.institute);
    }).catch((err: Error) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const when = new Date(row.createdAt);
      const iso = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
      if (day && iso !== day) return false;
      if (!needle) return true;
      return `${row.label} ${row.detail} ${row.actorName}`.toLowerCase().includes(needle);
    });
  }, [rows, query, day]);

  return (
    <PageChrome icon="fa-light fa-clipboard-list" crumbs={[{ label: "Accounts", href: "/admin/accounts" }, { label: "Audit" }]}>
      <p className="mb-3 max-w-2xl text-sm text-[var(--esk-muted)] print:hidden">Who collected a fee, paid a salary, edited attendance, assigned a card, or exported the location history.</p>
      {error ? <p className="mb-3 text-sm text-red-600 print:hidden">{error}</p> : null}
      <div className="print:hidden">
        <FilterCard>
          <Field label="Search">
            <input className={control} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Actor, event, detail" />
          </Field>
          <Field label="Date">
            <input className={control} type="date" value={day} onChange={(event) => setDay(event.target.value)} max={today()} />
          </Field>
          <button className="esk-btn-ghost mb-1" type="button" onClick={() => { setQuery(""); setDay(""); }}>Clear</button>
          <button className="esk-btn-primary mb-1" type="button" disabled={!filtered.length} onClick={() => window.print()}>
            <i className="fa-light fa-print" /> Print
          </button>
        </FilterCard>
      </div>
      {filtered.length === 0 ? (
        <div className="esk-empty">
          <div><i className="fa-light fa-clipboard-list" /></div>
          <h5>{rows.length ? "No Matching Events" : "No Audit Events Yet"}</h5>
          <p>{rows.length ? "Try another search or date." : "Actions will appear here as they happen."}</p>
        </div>
      ) : (
        <article className="esk-report-doc mt-4">
          <header className="esk-letter-head">
            {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-clipboard-list text-2xl text-[var(--esk-purple)]" />}
            <div>
              <h2>Audit log</h2>
              <p>{institute?.name ?? "School"} · {filtered.length} event{filtered.length === 1 ? "" : "s"}{day ? ` · ${day}` : ""}</p>
            </div>
          </header>
          <table className="esk-receipt-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Detail</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <p className="font-semibold">{row.label}</p>
                    <p className="text-xs text-[var(--esk-muted)]">{row.actorName}</p>
                  </td>
                  <td>{row.detail}</td>
                  <td className="text-[var(--esk-muted)]">{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </PageChrome>
  );
}
