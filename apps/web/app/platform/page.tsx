"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type School = {
  tenantId: string;
  instituteName: string;
  country: string;
  planName: string;
  status: string;
  expiresOn: string | null;
  notes: string | null;
  health: string;
  nearQuota: boolean;
  attention: boolean;
  archived: boolean;
  students: number;
  readers: number;
  readerQuota: number;
  vehicles: number;
  vehicleQuota: number;
  smsBalance: number;
  onboarding?: { completed: number; total: number; percent: number; complete: boolean };
};

type ListResponse = {
  schools: School[];
  totals: { schools: number; active: number; trial: number; attention: number; onboarding: number; archived: number };
};

type Activity = {
  id: string;
  tenantId: string;
  instituteName: string;
  actorName: string;
  action: string;
  label: string;
  detail: string;
  createdAt: string;
};

function badge(health: string) {
  if (health === "ok" || health === "active") return "bg-emerald-100 text-emerald-800";
  if (health === "trial") return "bg-sky-100 text-sky-800";
  if (health === "expiring" || health === "past_due" || health === "expired") return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

export default function PlatformHomePage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [activityTenant, setActivityTenant] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAmount, setBulkAmount] = useState(100);
  const [bulkPending, setBulkPending] = useState(false);
  const [note, setNote] = useState("");

  function refreshSchools() {
    return api<ListResponse>("/platform/schools")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    void refreshSchools();
  }, []);

  useEffect(() => {
    const path = activityTenant === "all" ? "/platform/activity" : `/platform/activity?tenantId=${encodeURIComponent(activityTenant)}`;
    api<Activity[]>(path)
      .then(setActivity)
      .catch(() => setActivity([]));
  }, [activityTenant]);

  const schools = useMemo(() => {
    const rows = data?.schools ?? [];
    const text = query.trim().toLowerCase();
    return rows.filter((school) => {
      if (healthFilter === "archived") {
        if (!school.archived) return false;
      } else if (!showArchived && school.archived) {
        return false;
      } else if (healthFilter === "attention") {
        if (!school.attention) return false;
      } else if (healthFilter === "onboarding") {
        if (!school.onboarding || school.onboarding.complete || school.archived) return false;
      } else if (healthFilter === "expiring") {
        if (school.health !== "expiring" && !school.nearQuota) return false;
      } else if (healthFilter !== "all" && school.health !== healthFilter && !(healthFilter === "active" && school.health === "ok")) {
        return false;
      }
      if (!text) return true;
      return (
        school.instituteName.toLowerCase().includes(text) ||
        school.country.toLowerCase().includes(text) ||
        school.planName.toLowerCase().includes(text) ||
        school.status.toLowerCase().includes(text) ||
        (school.notes ?? "").toLowerCase().includes(text)
      );
    });
  }, [data, query, healthFilter, showArchived]);

  const selectableIds = useMemo(() => schools.filter((school) => !school.archived).map((school) => school.tenantId), [schools]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  function toggleAll() {
    setSelected(allSelected ? [] : selectableIds);
  }

  function toggleOne(tenantId: string) {
    setSelected((prev) => (prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId]));
  }

  async function bulkTopUp() {
    if (!selected.length) return;
    setError("");
    setNote("");
    setBulkPending(true);
    try {
      const result = await api<{ updated: number; failed: number; amount: number }>("/platform/sms-topup", {
        method: "POST",
        body: JSON.stringify({ tenantIds: selected, amount: bulkAmount }),
      });
      setNote(`Added ${result.amount} SMS credits to ${result.updated} school(s)${result.failed ? ` (${result.failed} failed)` : ""}.`);
      setSelected([]);
      await refreshSchools();
      if (activityTenant === "all") {
        api<Activity[]>("/platform/activity").then(setActivity).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk top-up failed");
    } finally {
      setBulkPending(false);
    }
  }

  function exportCsv() {
    const header = ["School", "Country", "Plan", "Status", "Health", "Expires", "Students", "Readers", "Vehicles", "SMS"];
    const lines = schools.map((school) =>
      [
        school.instituteName,
        school.country,
        school.planName,
        school.status,
        school.health,
        school.expiresOn ?? "",
        school.students,
        `${school.readers}/${school.readerQuota}`,
        `${school.vehicles}/${school.vehicleQuota}`,
        school.smsBalance,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nepatronix-schools-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">Review every school tenant, plan status, and quota use.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="esk-btn-ghost" type="button" onClick={exportCsv} disabled={!schools.length}>
            <i className="fa-light fa-file-csv" /> Export CSV
          </button>
          <Link className="esk-btn-primary" href="/platform/schools/new">
            <i className="fa-light fa-plus" /> Create school
          </Link>
        </div>
      </div>

      {data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Schools" value={data.totals.schools} onClick={() => setHealthFilter("all")} active={healthFilter === "all"} />
          <Stat label="Active" value={data.totals.active} onClick={() => setHealthFilter("active")} active={healthFilter === "active"} />
          <Stat label="Trial" value={data.totals.trial} onClick={() => setHealthFilter("trial")} active={healthFilter === "trial"} />
          <Stat
            label="Needs attention"
            value={data.totals.attention}
            onClick={() => setHealthFilter("attention")}
            active={healthFilter === "attention"}
          />
          <Stat
            label="Onboarding"
            value={data.totals.onboarding}
            onClick={() => setHealthFilter("onboarding")}
            active={healthFilter === "onboarding"}
          />
          <Stat
            label="Archived"
            value={data.totals.archived}
            onClick={() => {
              setShowArchived(true);
              setHealthFilter("archived");
            }}
            active={healthFilter === "archived"}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Search school, country, plan, notes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
          value={healthFilter}
          onChange={(event) => setHealthFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="expiring">Expiring / near quota</option>
          <option value="past_due">Past due</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
          <option value="attention">Needs attention</option>
          <option value="onboarding">Onboarding incomplete</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--esk-muted)]">
          <input type="checkbox" checked={showArchived || healthFilter === "archived"} onChange={(event) => setShowArchived(event.target.checked)} />
          Show archived
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {note ? <p className="text-sm text-[var(--esk-purple)]">{note}</p> : null}

      {selected.length ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 shadow-sm">
          <div className="text-sm">
            <div className="font-medium">{selected.length} selected</div>
            <div className="text-[var(--esk-muted)]">Bulk SMS top-up</div>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--esk-muted)]">Credits each</span>
            <input
              className="w-28 rounded-lg border border-black/10 px-3 py-2"
              type="number"
              min={1}
              value={bulkAmount}
              onChange={(event) => setBulkAmount(Number(event.target.value))}
            />
          </label>
          <button className="esk-btn-primary" type="button" disabled={bulkPending || bulkAmount < 1} onClick={() => void bulkTopUp()}>
            <i className="fa-light fa-plus" /> {bulkPending ? "Adding…" : "Add SMS credits"}
          </button>
          <button className="esk-btn-ghost" type="button" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-[var(--esk-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!selectableIds.length} aria-label="Select all visible schools" />
              </th>
              <th className="px-4 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Setup</th>
              <th className="px-4 py-3 font-medium">Usage</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              <tr key={school.tenantId} className="border-t border-black/5">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(school.tenantId)}
                    disabled={school.archived}
                    onChange={() => toggleOne(school.tenantId)}
                    aria-label={`Select ${school.instituteName}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{school.instituteName}</div>
                  <div className="text-xs text-[var(--esk-muted)]">
                    {school.country} · {school.students} students
                  </div>
                </td>
                <td className="px-4 py-3">{school.planName}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge(school.health)}`}>
                      {school.health === "ok" ? school.status : school.health.replaceAll("_", " ")}
                    </span>
                    {school.nearQuota ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">near quota</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">{school.expiresOn ?? "—"}</td>
                <td className="px-4 py-3">
                  {school.onboarding ? (
                    <div className="min-w-[4.5rem]">
                      <div className={`text-xs font-medium ${school.onboarding.complete ? "text-emerald-700" : "text-amber-800"}`}>
                        {school.onboarding.percent}%
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className={`h-full rounded-full ${school.onboarding.complete ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${school.onboarding.percent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--esk-muted)]">
                  RFID {school.readers}/{school.readerQuota} · GPS {school.vehicles}/{school.vehicleQuota} · SMS {school.smsBalance}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link className="esk-btn-ghost" href={`/platform/schools/${school.tenantId}`}>
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {data && !schools.length ? (
              <tr>
                <td className="px-4 py-8 text-center text-[var(--esk-muted)]" colSpan={8}>
                  No schools match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/5 px-4 py-3">
          <div>
            <h2 className="font-semibold">Recent platform activity</h2>
            <p className="text-sm text-[var(--esk-muted)]">Creates, subscription edits, SMS top-ups, invites, and password resets.</p>
          </div>
          <select
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
            value={activityTenant}
            onChange={(event) => setActivityTenant(event.target.value)}
          >
            <option value="all">All schools</option>
            {(data?.schools ?? []).map((school) => (
              <option key={school.tenantId} value={school.tenantId}>
                {school.instituteName}
              </option>
            ))}
          </select>
        </div>
        <ul className="divide-y divide-black/5">
          {activity.map((row) => (
            <li key={row.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium">{row.label}</span>
                  <span className="text-[var(--esk-muted)]"> · </span>
                  <Link className="text-[var(--esk-muted)] underline-offset-2 hover:underline" href={`/platform/schools/${row.tenantId}`}>
                    {row.instituteName}
                  </Link>
                </div>
                <time className="text-xs text-[var(--esk-muted)]">{new Date(row.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-[var(--esk-muted)]">
                {row.actorName}: {row.detail}
              </p>
            </li>
          ))}
          {!activity.length ? <li className="px-4 py-6 text-sm text-[var(--esk-muted)]">No platform actions logged yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const className = `rounded-xl border px-4 py-3 text-left shadow-sm ${
    active ? "border-[var(--esk-purple)] bg-[var(--esk-purple)]/5" : "border-black/5 bg-white"
  } ${onClick ? "cursor-pointer hover:border-black/20" : ""}`;
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <div className="text-xs uppercase tracking-wide text-[var(--esk-muted)]">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </button>
    );
  }
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wide text-[var(--esk-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
