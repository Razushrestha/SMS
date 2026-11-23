"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { EmployeePortal, type EmployeePortalData } from "@/components/employee-portal";
import { ParentPortal, type ParentPortalData } from "@/components/parent-portal";
import { StudentPortal, type StudentPortalData } from "@/components/student-portal";
import { api } from "@/lib/api";
import { contactNepatronixMailto } from "@/lib/support";
import { canOpen } from "@/lib/roles";

type Pair = { allTime: string; thisMonth: string };
type Bar = { label: string; income: string; expense: string };
type Dashboard = {
  view: "classic" | "new";
  today: string;
  dateLabel: string;
  greeting: string;
  symbol: string;
  weather: { place: string; temperature: string; summary: string; feels: string | null; humidity: string | null; wind: string | null } | null;
  students: { allTime: number; thisMonth: number; active: number };
  employees: { allTime: number; thisMonth: number; active: number };
  revenue: Pair | null;
  profit: Pair | null;
  fees: { estimation: string; collections: string; remainings: string; percent: number } | null;
  months: Bar[] | null;
  classStrength: Array<{ name: string; count: number }>;
  absentToday: number;
  presentStaff: number;
  admissions: { count: number; names: string[] };
  birthdays: { count: number; names: string[] };
  demographics: { boys: number; girls: number; boysPercent: number; girlsPercent: number };
  progress: { studentsPresent: number; studentsTotal: number; staffPresent: number; staffTotal: number; feesPercent: number | null };
  alerts: { scope: "transport" | "parent"; parentSms: boolean; items: Array<{ id: string; kind: string; message: string }> } | null;
  cardAlerts: { items: Array<{ id: string; message: string }> } | null;
  smsGateway: { connected: boolean; handset: string | null; balance: number } | null;
  subscription?: {
    planName: string;
    status: string;
    expiresOn: string | null;
    health: string;
    blocked: boolean;
    message: string | null;
    smsBalance: number;
    readers: number;
    readerQuota: number;
    cards: number;
    cardQuota: number;
    vehicles: number;
    vehicleQuota: number;
    nearQuota?: boolean;
    nearQuotaMessage?: string | null;
  } | null;
  employeePortal?: EmployeePortalData | null;
  studentPortal?: StudentPortalData | null;
  parentPortal?: ParentPortalData | null;
};

const actions = [
  { label: "Add Student", href: "/admin/students/new", menu: "/admin/students" },
  { label: "Collect Fee", href: "/admin/fees", menu: "/admin/fees" },
  { label: "Mark Attendance", href: "/admin/attendance", menu: "/admin/attendance" },
  { label: "Send SMS", href: "/admin/messages", menu: "/admin/messages" },
  { label: "Add Exam", href: "/admin/exams", menu: "/admin/exams" },
  { label: "Homework", href: "/admin/homework", menu: "/admin/homework" },
];

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [role, setRole] = useState("admin");
  const [verified, setVerified] = useState(true);
  const [code, setCode] = useState("");
  const [verifyNote, setVerifyNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/dashboard").then(setData).catch((err: Error) => setError(err.message));
    api<{ user: { role: string; emailVerified: boolean } }>("/auth/me")
      .then((session) => {
        setRole(session.user.role);
        setVerified(session.user.emailVerified);
      })
      .catch(() => undefined);
  }, []);

  async function choose(view: "classic" | "new") {
    setError("");
    try {
      setData(await api<Dashboard>("/dashboard", { method: "PATCH", body: JSON.stringify({ view }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch the dashboard");
    }
  }

  async function sendCode() {
    setError("");
    try {
      const row = await api<{ verified: boolean; code?: string; message: string }>("/auth/verification", { method: "POST", body: "{}" });
      setVerified(row.verified);
      setCode(row.code ?? "");
      setVerifyNote(row.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification");
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entered = String(new FormData(event.currentTarget).get("code") ?? "");
    setError("");
    try {
      const row = await api<{ verified: boolean; message: string }>("/auth/verify", { method: "POST", body: JSON.stringify({ code: entered }) });
      setVerified(row.verified);
      setCode("");
      setVerifyNote(row.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the email");
    }
  }

  if (!data) return <p className="text-sm text-[var(--esk-muted)]">{error || "Loading dashboard…"}</p>;
  if (data.employeePortal) {
    return (
      <section>
        <EmployeePortal data={data.employeePortal} symbol={data.symbol} />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }
  if (data.studentPortal) {
    return (
      <section>
        <StudentPortal data={data.studentPortal} symbol={data.symbol} />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }
  if (data.parentPortal) {
    return (
      <section>
        <ParentPortal data={data.parentPortal} symbol={data.symbol} />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }
  const other = data.view === "classic" ? "new" : "classic";

  return (
    <section>
      <div className="dm-topbar">
        <div className="dm-weather-card">
          <i className={`fa-light ${data.weather?.summary?.toLowerCase().includes("clear") || data.weather?.summary?.toLowerCase().includes("sun") ? "fa-sun" : "fa-moon"} text-[22px]`} />
          <div>
            <div className="temp">{data.weather?.temperature ?? "—"}</div>
            <div className="meta">
              {data.weather ? (
                <>
                  <span>{data.weather.place}</span>
                  <span className="dm-weather-summary">{data.weather.summary.toUpperCase()}</span>
                  {data.weather.feels ? <span>{data.weather.feels}</span> : null}
                  {data.weather.humidity ? <span>{data.weather.humidity}</span> : null}
                  {data.weather.wind ? <span>{data.weather.wind}</span> : null}
                </>
              ) : "Weather is unavailable."}
            </div>
          </div>
        </div>
        <button className="dm-switch-btn" onClick={() => void choose(other)} type="button">
          <i className="fa-light fa-rocket" />
          {data.view === "classic" ? "Switch to New Dashboard" : "Switch to Classic View"}
        </button>
      </div>
      {data.view === "classic" ? <Classic data={data} role={role} verified={verified} code={code} verifyNote={verifyNote} onSend={sendCode} onConfirm={confirmCode} /> : <NewView data={data} role={role} />}
      {verified && verifyNote ? <p className="mt-3 text-sm text-[var(--esk-teal)]">{verifyNote}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

function money(symbol: string, value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${symbol} ${value}`;
  return `${symbol} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function share(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function Classic({
  data,
  role,
  verified,
  code,
  verifyNote,
  onSend,
  onConfirm,
}: {
  data: Dashboard;
  role: string;
  verified: boolean;
  code: string;
  verifyNote: string;
  onSend: () => void;
  onConfirm: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const max = Math.max(1, ...(data.months ?? []).flatMap((row) => [Number(row.income), Number(row.expense)]));
  const studentPct = share(data.progress.studentsPresent, data.progress.studentsTotal);
  const staffPct = share(data.progress.staffPresent, data.progress.staffTotal);
  const feePct = data.progress.feesPercent ?? 0;

  return (
    <div className="grid gap-4">
      <div className="dm-stat-row">
        <StatCard label="Total Students" href="/admin/students" value={String(data.students.allTime)} month={String(data.students.thisMonth)} icon="fa-light fa-user-graduate" tone="students" />
        <StatCard label="Total Employees" href="/admin/employees" value={String(data.employees.allTime)} month={String(data.employees.thisMonth)} icon="fa-light fa-user-tie" tone="employees" />
        {data.revenue ? <StatCard label="Revenue" href="/admin/accounts/statement" value={money(data.symbol, data.revenue.allTime)} month={money(data.symbol, data.revenue.thisMonth)} icon="fa-light fa-coins" tone="revenue" /> : null}
        {data.profit ? <StatCard label="Total Profit" href="/admin/accounts" value={money(data.symbol, data.profit.allTime)} month={money(data.symbol, data.profit.thisMonth)} icon="fa-light fa-chart-line" tone="profit" /> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {verified ? (
          <div className="dm-welcome-banner">
            <div className="welcome-art"><i className="fa-light fa-shapes" /></div>
            <div>
              <h6 className="welcome-title">{data.greeting}</h6>
              <p className="welcome-text">{data.dateLabel}</p>
            </div>
          </div>
        ) : (
          <div className="dm-welcome-banner">
            <div className="welcome-art"><i className="fa-light fa-shapes" /></div>
            <div className="welcome-content">
              <h6 className="welcome-title">Welcome back, Admin</h6>
              <p className="welcome-text">Verify your email to unlock the full power of your dashboard.</p>
              <div className="welcome-actions">
                <button className="btn-verify" type="button" onClick={() => void onSend()}><i className="fa-light fa-envelope" /> Verify Email</button>
              </div>
              {verifyNote ? <p className="welcome-text mt-2">{verifyNote}</p> : null}
              {code ? (
                <>
                  <p className="welcome-text mt-1">Code, shown once: {code}</p>
                  <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(event) => void onConfirm(event)}>
                    <input className="rounded-full border-0 px-3 py-1 text-[12px] text-[var(--esk-navy)]" name="code" placeholder="Verification code" defaultValue={code} />
                    <button className="btn-verify" type="submit">Confirm</button>
                  </form>
                </>
              ) : null}
            </div>
          </div>
        )}
        {data.fees ? (
          <Panel title="Fee Status" subtitle="Estimated vs collected for This Month">
            <div className="dm-fee-rows">
              <div>
                <p>Total Estimation</p>
                <strong>{money(data.symbol, data.fees.estimation)}</strong>
              </div>
              <div>
                <p>Collections</p>
                <strong>{money(data.symbol, data.fees.collections)}</strong>
              </div>
              <div>
                <p>Remainings</p>
                <strong>{money(data.symbol, data.fees.remainings)}</strong>
              </div>
            </div>
          </Panel>
        ) : <div />}
      </div>
      {data.months ? (
        <Panel title="Income vs Expense" subtitle="Last 6 months trend">
          <div className="dm-trend">
            {data.months.map((row) => (
              <div key={row.label} className="dm-trend-row">
                <span>{row.label}</span>
                <div className="dm-trend-bars">
                  <div className="dm-trend-income" style={{ width: `${Math.max(4, (Number(row.income) / max) * 100)}%` }} />
                  <div className="dm-trend-expense" style={{ width: `${Math.max(4, (Number(row.expense) / max) * 100)}%` }} />
                </div>
                <small>{money(data.symbol, row.income)} / {money(data.symbol, row.expense)}</small>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Panel title="Class-wise Student Strength" subtitle="Distribution across classes">
          {data.classStrength.length
            ? data.classStrength.map((row) => <p key={row.name} className="dm-soft-line">{row.name}: {row.count}</p>)
            : <p className="dm-empty">No classes yet.</p>}
        </Panel>
        <Panel title="Absent Students Today" subtitle={data.absentToday ? "Marked absent today" : "Attendance Not Marked Yet!"}>
          <p className="dm-big-num">{data.absentToday}</p>
        </Panel>
        <Panel title="Present Staff Today" subtitle={data.presentStaff ? "Marked present today" : "Attendance Not Marked Yet!"}>
          <p className="dm-big-num">{data.presentStaff}</p>
        </Panel>
        <Panel title="New Admissions" subtitle="This month’s new students">
          <Names count={data.admissions.count} names={data.admissions.names} empty="No New Admissions This Month" />
        </Panel>
        <Panel title="Key Progress">
          <ProgressRow label="Today Present Students" percent={studentPct} />
          <ProgressRow label="Today Present Employees" percent={staffPct} />
          {data.progress.feesPercent === null ? null : <ProgressRow label="This Month Fee Collection" percent={feePct} />}
        </Panel>
        <Calendar today={data.today} />
      </div>
      <Alerts data={data} role={role} />
      <CardAlerts data={data} role={role} />
      <div className="grid gap-3 sm:grid-cols-2">
        {canOpen(role, "/admin/plan") && data.subscription ? <SubscriptionPanel plan={data.subscription} /> : null}
        {canOpen(role, "/admin/sms") && data.smsGateway ? (
          <Panel title="Free SMS Gateway" subtitle="Send SMS on mobile numbers.">
            <p className="text-sm">
              {data.smsGateway.connected
                ? `${data.smsGateway.handset ?? "Handset"} is paired. Balance ${data.smsGateway.balance}.`
                : `Message balance ${data.smsGateway.balance}. No handset gateway is connected yet.`}
            </p>
            <Link className="mt-2 inline-block text-sm font-semibold text-[var(--esk-purple)]" href="/admin/sms">Open SMS</Link>
          </Panel>
        ) : null}
        {canOpen(role, "/admin/timetable") ? (
          <Panel title="Desktop tools" subtitle="Timetable, behaviour, and store.">
            <p className="text-sm">Open the desktop-style school tools from this admin.</p>
            <Link className="mt-2 inline-block text-sm font-semibold text-[var(--esk-purple)]" href="/admin/timetable">Open the timetable</Link>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function SubscriptionPanel({
  plan,
}: {
  plan: NonNullable<Dashboard["subscription"]>;
}) {
  const tone =
    plan.blocked || plan.health === "suspended" || plan.health === "cancelled" || plan.health === "expired"
      ? "text-rose-700"
      : plan.health === "past_due" || plan.health === "expiring" || plan.nearQuota
        ? "text-amber-800"
        : plan.health === "trial"
          ? "text-sky-800"
          : "text-[var(--esk-navy)]";
  return (
    <Panel title="Subscription" subtitle={`${plan.planName} · ${plan.status}`}>
      <p className={`text-sm ${tone}`}>
        {plan.message ?? (plan.expiresOn ? `Active through ${plan.expiresOn}.` : "Subscription is healthy.")}
      </p>
      {plan.nearQuotaMessage ? <p className="mt-2 text-sm text-amber-800">{plan.nearQuotaMessage}</p> : null}
      <p className="mt-2 text-sm text-[var(--esk-muted)]">
        Quotas · readers {plan.readers}/{plan.readerQuota} · cards {plan.cards}/{plan.cardQuota} · vehicles {plan.vehicles}/
        {plan.vehicleQuota} · SMS {plan.smsBalance}
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-[var(--esk-purple)]">
        <Link className="underline" href="/admin/plan">
          Open plan
        </Link>
        {plan.blocked || plan.health === "expiring" || plan.health === "past_due" || plan.nearQuota ? (
          <a
            className="underline"
            href={contactNepatronixMailto({
              planHealth: plan.health,
              topic: plan.blocked ? "Restore access" : plan.nearQuota ? "Raise quotas" : "Subscription help",
            })}
          >
            Contact NEPATRONIX
          </a>
        ) : null}
      </div>
    </Panel>
  );
}

function NewView({ data, role }: { data: Dashboard; role: string }) {
  const max = Math.max(1, ...(data.months ?? []).flatMap((row) => [Number(row.income), Number(row.expense)]));
  return (
    <div className="grid gap-4">
      <div className="dm-stat-row">
        <StatCard label="Students Present" href="/admin/attendance" value={`${data.progress.studentsPresent}/${data.progress.studentsTotal}`} month="Today" icon="fa-light fa-user-graduate" tone="students" />
        <StatCard label="Staff Present" href="/admin/attendance/employees" value={`${data.progress.staffPresent}/${data.progress.staffTotal}`} month="Today" icon="fa-light fa-user-tie" tone="employees" />
        {data.progress.feesPercent === null ? null : <StatCard label="Fees" href="/admin/fees" value={`${data.progress.feesPercent}%`} month="This Month" icon="fa-light fa-coins" tone="revenue" />}
        <StatCard label="New Admissions" href="/admin/students" value={String(data.admissions.count)} month="This Month" icon="fa-light fa-chart-line" tone="profit" />
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.filter((action) => canOpen(role, action.menu)).map((action) => (
          <Link key={action.label} className="esk-btn-ghost" href={action.href}>{action.label}</Link>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Students" href="/admin/students" value={String(data.students.active)} month={`${data.students.allTime} on record`} icon="fa-light fa-user-graduate" tone="students" />
        <StatCard label="Employees" href="/admin/employees" value={String(data.employees.active)} month={`${data.employees.allTime} on record`} icon="fa-light fa-user-tie" tone="employees" />
        {data.revenue ? <StatCard label="Revenue" href="/admin/accounts/statement" value={`${data.symbol}${data.revenue.thisMonth}`} month={`${data.symbol}${data.revenue.allTime} all time`} icon="fa-light fa-coins" tone="revenue" /> : null}
        {data.profit ? <StatCard label="Profit" href="/admin/accounts" value={`${data.symbol}${data.profit.thisMonth}`} month={`${data.symbol}${data.profit.allTime} all time`} icon="fa-light fa-chart-line" tone="profit" /> : null}
      </div>
      {data.months ? (
        <Panel title="Income versus expense, last 6 months">
          <div className="grid gap-3">
            {data.months.map((row) => (
              <div key={row.label}>
                <p className="text-xs font-semibold text-[var(--esk-muted)]">{row.label}</p>
                <div className="mt-1 h-2 rounded bg-[var(--esk-purple)]" style={{ width: `${Math.max(4, (Number(row.income) / max) * 100)}%` }} />
                <div className="mt-1 h-2 rounded bg-[var(--esk-border)]" style={{ width: `${Math.max(4, (Number(row.expense) / max) * 100)}%` }} />
                <p className="mt-1 text-xs text-[var(--esk-muted)]">Income {data.symbol}{row.income} · Expense {data.symbol}{row.expense}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      {data.fees ? (
        <Panel title="Fee collection">
          <p className="text-sm">Estimation {data.symbol}{data.fees.estimation} · Collected {data.symbol}{data.fees.collections} · Remaining {data.symbol}{data.fees.remainings}</p>
        </Panel>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Panel title="Today’s progress">
          <p className="text-sm">Students {data.progress.studentsPresent}/{data.progress.studentsTotal} · Staff {data.progress.staffPresent}/{data.progress.staffTotal}</p>
        </Panel>
        <Panel title="Demographics">
          <p className="text-sm">Boys {data.demographics.boys} ({data.demographics.boysPercent}%)</p>
          <p className="text-sm">Girls {data.demographics.girls} ({data.demographics.girlsPercent}%)</p>
        </Panel>
        <Panel title="Class strength">{data.classStrength.map((row) => <p key={row.name} className="text-sm">{row.name}: {row.count}</p>)}</Panel>
        <Panel title="Absent today"><p className="text-2xl font-semibold">{data.absentToday}</p></Panel>
        <Panel title="Present staff"><p className="text-2xl font-semibold">{data.presentStaff}</p></Panel>
        <Panel title="Birthdays"><Names count={data.birthdays.count} names={data.birthdays.names} empty="No birthdays today." /></Panel>
      </div>
      {canOpen(role, "/admin/plan") && data.subscription ? <SubscriptionPanel plan={data.subscription} /> : null}
      <Alerts data={data} role={role} />
      <CardAlerts data={data} role={role} />
    </div>
  );
}

function Alerts({ data, role }: { data: Dashboard; role: string }) {
  if (!data.alerts) return null;
  const parent = data.alerts.scope === "parent";
  return (
    <Panel title="Transport alerts">
      {parent ? null : <p className="text-sm text-[var(--esk-muted)]">{data.alerts.parentSms ? "Parent arrival messages are on." : "Parent arrival messages are off."}</p>}
      {data.alerts.items.length ? (
        <ul className="mt-2 text-sm">{data.alerts.items.map((item) => <li key={item.id}>{item.kind} · {item.message}</li>)}</ul>
      ) : <p className="mt-2 text-sm">{parent ? "No arrival at your child's stop." : "No transport alerts."}</p>}
      {parent || !canOpen(role, "/admin/gps") ? null : <Link className="mt-2 inline-block text-sm font-semibold text-[var(--esk-purple)]" href="/admin/gps">Open GPS</Link>}
    </Panel>
  );
}

function CardAlerts({ data, role }: { data: Dashboard; role: string }) {
  if (!data.cardAlerts) return null;
  return (
    <Panel title="Card alerts">
      {data.cardAlerts.items.length ? (
        <ul className="mt-2 text-sm">{data.cardAlerts.items.map((item) => <li key={item.id}>{item.message}</li>)}</ul>
      ) : <p className="mt-2 text-sm">No blocked or lost card taps.</p>}
      {canOpen(role, "/admin/rfid") ? <Link className="mt-2 inline-block text-sm font-semibold text-[var(--esk-purple)]" href="/admin/rfid">Open RFID</Link> : null}
    </Panel>
  );
}

function StatCard({
  label,
  value,
  month,
  href,
  icon,
  tone,
}: {
  label: string;
  value: string;
  month: string;
  href: string;
  icon: string;
  tone: "students" | "employees" | "revenue" | "profit";
}) {
  return (
    <Link href={href} className="dm-stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-body">
        <div className={`stat-icon ${tone}`}><i className={icon} /></div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-footer">
        <span>This Month</span>
        <span className="stat-month-value">{month}</span>
      </div>
    </Link>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="esk-panel">
      <h2>{title}</h2>
      {subtitle ? <p className="dm-panel-sub">{subtitle}</p> : null}
      <div>{children}</div>
    </div>
  );
}

function ProgressRow({ label, percent }: { label: string; percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="dm-progress-row">
      <div className="dm-progress-head">
        <span>{label}</span>
        <strong>{safe}%</strong>
      </div>
      <div className="dm-progress-track">
        <div className="dm-progress-fill" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function Names({ count, names, empty }: { count: number; names: string[]; empty: string }) {
  if (!count) return <p className="dm-empty">{empty}</p>;
  return <p className="text-sm">{count}{names.length ? `: ${names.join(", ")}` : ""}</p>;
}

function Calendar({ today }: { today: string }) {
  const [year, month, day] = today.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))).toUpperCase();
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day))).toUpperCase();
  return (
    <Panel title={`${label}`}>
      <p className="dm-cal-today">{weekday}</p>
      <div className="dm-cal-grid">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((name) => <span key={name} className="dm-cal-head">{name}</span>)}
        {cells.map((value, index) => (
          <span key={index} className={value === day ? "dm-cal-day active" : "dm-cal-day"}>{value ?? ""}</span>
        ))}
      </div>
    </Panel>
  );
}
