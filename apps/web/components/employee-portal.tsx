"use client";

type Attendance = {
  overallPercent: number;
  monthPercent: number;
  monthLabel: string;
  today: string | null;
  yesterday: string | null;
  presents: number;
  leaves: number;
  absents: number;
};

type Salary = {
  current: string;
  receivedThisMonth: boolean;
  latest: { net: string; paidOn: string; salaryMonth: string } | null;
};

export type EmployeePortalData = {
  name: string;
  photoUrl: string | null;
  registrationNo: string;
  roleLabel: string;
  monthlySalary: string;
  fatherOrHusband: string;
  phone: string;
  email: string;
  address: string;
  nationalId: string;
  education: string;
  gender: string;
  religion: string;
  bloodGroup: string;
  dateOfBirth: string;
  joiningDate: string;
  experience: string;
  instituteName: string;
  targetLine: string;
  attendance: Attendance;
  salary: Salary;
};

function money(symbol: string, value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${symbol} ${value}`;
  return `${symbol} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function markLabel(status: string | null) {
  if (!status) return "NOT MARKED";
  if (status === "present") return "PRESENT";
  if (status === "leave") return "LEAVE";
  return "ABSENT";
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="ep-fact">
      <i className="fa-light fa-arrow-right" />
      <div>
        <span className="ep-fact-label">{label}</span>
        <strong className="ep-fact-value">{value || "\u00a0"}</strong>
      </div>
    </div>
  );
}

function Ring({ percent, caption }: { percent: number; caption: string }) {
  const safe = Math.max(0, Math.min(100, percent));
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  return (
    <div className="ep-ring-wrap">
      <div className="ep-ring-block">
        <div className="ep-ring-box">
          <p className="ep-ring-number">
            <span>{Math.round(safe)}</span>
            <span className="ep-ring-sub">%</span>
          </p>
          <p className="ep-ring-title">{caption}</p>
        </div>
        <svg className="ep-ring-svg" viewBox="0 0 110 110">
          <defs>
            <linearGradient id="epRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff808b" />
              <stop offset="100%" stopColor="#9698d6" />
            </linearGradient>
          </defs>
          <circle className="ep-ring-track" cx="55" cy="55" r={radius} />
          <circle
            className="ep-ring-progress"
            cx="55"
            cy="55"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
      </div>
    </div>
  );
}

function AttendancePie({ presents, leaves, absents }: { presents: number; leaves: number; absents: number }) {
  const total = presents + leaves + absents;
  const circ = 2 * Math.PI * 40;
  if (!total) {
    return (
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="40" fill="none" stroke="#e8ebf7" strokeWidth="18" />
        <circle cx="60" cy="60" r="28" fill="#fff" />
      </svg>
    );
  }
  const p = (presents / total) * circ;
  const l = (leaves / total) * circ;
  const a = (absents / total) * circ;
  return (
    <svg viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="40" fill="none" stroke="#5e81f4" strokeWidth="18" strokeDasharray={`${p} ${circ - p}`} transform="rotate(-90 60 60)" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="#9698d6" strokeWidth="18" strokeDasharray={`${l} ${circ - l}`} strokeDashoffset={-p} transform="rotate(-90 60 60)" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="#ff808b" strokeWidth="18" strokeDasharray={`${a} ${circ - a}`} strokeDashoffset={-(p + l)} transform="rotate(-90 60 60)" />
      <circle cx="60" cy="60" r="28" fill="#fff" />
    </svg>
  );
}

function MarkPill({ label, day }: { label: string; day: string }) {
  return (
    <div className="ep-mark-pill">
      <span className="ep-mark-day">{day}</span>
      <strong>{label}</strong>
    </div>
  );
}

function StatusCard({ title, value, tone }: { title: string; value: number; tone: "p" | "l" | "a" }) {
  return (
    <div className={`ep-status ep-status-${tone}`}>
      <h6>{title}</h6>
      <div className="ep-status-value">
        <i className={`fa-light ${tone === "p" ? "fa-arrow-right" : tone === "l" ? "fa-plane" : "fa-user-xmark"}`} />
        <strong>{value}</strong>
      </div>
      <p>This Month <span>{value}</span></p>
    </div>
  );
}

export function EmployeePortal({ data, symbol }: { data: EmployeePortalData; symbol: string }) {
  const { attendance, salary } = data;
  return (
    <section className="ep-layout">
      <aside className="ep-profile print:hidden">
        <div className="ep-avatar">
          {data.photoUrl ? (
            <img src={data.photoUrl} alt="" />
          ) : (
            <img src="https://eskooly.com/bb/uploads/employees/no-image.png" alt="" onError={(event) => {
              const target = event.currentTarget;
              target.style.display = "none";
              target.parentElement?.classList.add("ep-avatar-empty");
            }} />
          )}
        </div>
        <h4 className="ep-name">{data.name}</h4>
        <div className="ep-facts ep-facts-tone">
          <Fact label="Registration No" value={data.registrationNo} />
          <Fact label="Employee Role" value={data.roleLabel} />
          <Fact label="Monthly Salary" value={money(symbol, data.monthlySalary)} />
        </div>
        <div className="ep-facts">
          <Fact label="Father / Husband Name" value={data.fatherOrHusband} />
          <Fact label="Mobile No" value={data.phone} />
          <Fact label="Email Address" value={data.email} />
          <Fact label="Home Address" value={data.address} />
        </div>
        <div className="ep-facts ep-facts-tone">
          <Fact label="National ID" value={data.nationalId} />
          <Fact label="Education" value={data.education} />
        </div>
        <div className="ep-facts">
          <Fact label="Gender" value={data.gender} />
          <Fact label="Religion" value={data.religion} />
          <Fact label="Blood Group" value={data.bloodGroup} />
          <Fact label="Date of Birth" value={data.dateOfBirth} />
          <Fact label="Date of Joining" value={data.joiningDate} />
          <Fact label="Experience" value={data.experience} />
        </div>
      </aside>

      <div className="ep-main">
        <div className="ep-welcome print:hidden">
          <h6 className="ep-welcome-top">
            <i className="fa-light fa-hand-wave ep-hi" />
            <span className="ep-welcome-plain"> Welcome </span>
            <span className="ep-welcome-name">
              {data.name}
              <svg className="ep-name-line" viewBox="0 0 80 8" preserveAspectRatio="none" aria-hidden>
                <path d="M1 6 C20 1, 40 1, 79 6" fill="none" stroke="#ff847f" strokeWidth="2" />
              </svg>
            </span>
            <span className="ep-welcome-plain"> at <b>{data.roleLabel}</b> Portal.</span>
          </h6>
          <div className="ep-welcome-body">
            <div className="ep-welcome-institute">
              <div className="ep-welcome-logo"><i className="fa-light fa-building-columns" /></div>
              <div>
                <strong>{data.instituteName}</strong>
                <span>{data.targetLine}</span>
              </div>
            </div>
            <div className="ep-welcome-art" aria-hidden>
              <i className="fa-light fa-comments" />
              <i className="fa-light fa-laptop" />
            </div>
          </div>
        </div>

        <div className="ep-section">
          <h6 className="ep-section-title">
            <span>1</span>
            <strong>Attendance Report</strong>
            <button className="esk-btn-ghost ml-auto print:hidden" type="button" onClick={() => window.print()}>
              <i className="fa-light fa-print" /> Print
            </button>
          </h6>
          <div className="ep-attend-card print:hidden">
            <div className="ep-legend">
              <span><i className="ep-dot ep-dot-p" /> P</span>
              <span><i className="ep-dot ep-dot-l" /> L</span>
              <span><i className="ep-dot ep-dot-a" /> A</span>
            </div>
            <div className="ep-attend-grid">
              <div className="ep-pie">
                <AttendancePie presents={attendance.presents} leaves={attendance.leaves} absents={attendance.absents} />
              </div>
              <div className="ep-attend-col">
                <Ring percent={attendance.overallPercent} caption="Overall" />
                <MarkPill label={markLabel(attendance.today)} day="Today" />
              </div>
              <div className="ep-attend-col">
                <Ring percent={attendance.monthPercent} caption={attendance.monthLabel} />
                <MarkPill label={markLabel(attendance.yesterday)} day="Yesterday" />
              </div>
            </div>
            <div className="ep-status-row">
              <StatusCard title="PRESENTS" value={attendance.presents} tone="p" />
              <StatusCard title="LEAVES" value={attendance.leaves} tone="l" />
              <StatusCard title="ABSENTS" value={attendance.absents} tone="a" />
            </div>
          </div>
          <article className="esk-report-doc mt-3 hidden print:block">
            <header className="esk-letter-head">
              <i className="fa-light fa-hand text-2xl text-[var(--esk-purple)]" />
              <div>
                <h2>Staff attendance report</h2>
                <p>{data.instituteName} · {data.name} · {data.roleLabel}</p>
              </div>
            </header>
            <div className="esk-certificate-meta">
              <div><span>Overall</span><strong>{Math.round(attendance.overallPercent)}%</strong></div>
              <div><span>{attendance.monthLabel}</span><strong>{Math.round(attendance.monthPercent)}%</strong></div>
              <div><span>Today</span><strong>{markLabel(attendance.today)}</strong></div>
              <div><span>Yesterday</span><strong>{markLabel(attendance.yesterday)}</strong></div>
              <div><span>Presents</span><strong>{attendance.presents}</strong></div>
              <div><span>Leaves</span><strong>{attendance.leaves}</strong></div>
              <div><span>Absents</span><strong>{attendance.absents}</strong></div>
            </div>
          </article>
        </div>

        <div className="ep-section">
          <h6 className="ep-section-title">
            <span>2</span>
            <strong>Salary Report</strong>
          </h6>
          <div className="ep-salary-card print:hidden">
            <div className="ep-salary-row">
              <div className="ep-salary-pill">
                <i className="fa-light fa-wallet" />
                <div>
                  <strong>{money(symbol, salary.current)}</strong>
                  <span>Current Salary</span>
                </div>
              </div>
              <div className={`ep-salary-pill ${salary.receivedThisMonth ? "ok" : "warn"}`}>
                <i className="fa-light fa-credit-card" />
                <div>
                  <strong>{salary.receivedThisMonth ? "SALARY RECEIVED" : "SALARY NOT RECIEVED"}</strong>
                  <span>This Month</span>
                </div>
              </div>
            </div>
            <p className="ep-salary-note">Latest salary record</p>
            {salary.latest ? (
              <p className="ep-salary-latest">{money(symbol, salary.latest.net)} · {salary.latest.salaryMonth} · {salary.latest.paidOn}</p>
            ) : (
              <p className="ep-salary-empty">No Record Found.</p>
            )}
          </div>
          <article className="esk-report-doc mt-3 hidden print:block">
            <header className="esk-letter-head">
              <i className="fa-light fa-wallet text-2xl text-[var(--esk-purple)]" />
              <div>
                <h2>Salary report</h2>
                <p>{data.instituteName} · {data.name} · {data.roleLabel}</p>
              </div>
            </header>
            <div className="esk-certificate-meta">
              <div><span>Current salary</span><strong>{money(symbol, salary.current)}</strong></div>
              <div><span>This month</span><strong>{salary.receivedThisMonth ? "Received" : "Not received"}</strong></div>
              <div><span>Latest net</span><strong>{salary.latest ? money(symbol, salary.latest.net) : "—"}</strong></div>
              <div><span>Latest month</span><strong>{salary.latest?.salaryMonth ?? "—"}</strong></div>
              <div><span>Paid on</span><strong>{salary.latest?.paidOn ?? "—"}</strong></div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
