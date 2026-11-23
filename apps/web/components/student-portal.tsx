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

type ClassTestRow = { subjectName: string; date: string; obtained: string; total: string };
type ExamRow = { examName: string; subjectName: string; obtained: string; total: string };

type Fees = {
  monthly: string;
  paidThisMonth: boolean;
  due: string;
  latest: { deposit: string; paidOn: string; feeMonth: string } | null;
  records: Array<{ deposit: string; paidOn: string; feeMonth: string }>;
};

export type StudentPortalData = {
  name: string;
  photoUrl: string | null;
  registrationNo: string;
  admissionDate: string;
  className: string;
  familyName: string;
  discountLabel: string;
  dateOfBirth: string;
  gender: string;
  identificationMark: string;
  bloodGroup: string;
  disease: string;
  birthId: string;
  caste: string;
  previousSchool: string;
  previousId: string;
  note: string;
  orphan: string;
  osc: string;
  religion: string;
  siblings: string;
  fatherName: string;
  motherName: string;
  address: string;
  instituteName: string;
  targetLine: string;
  attendance: Attendance;
  classTests: ClassTestRow[];
  examinations: ExamRow[];
  fees: Fees;
  feeReminder?: { estimated: string; symbol: string; message: string } | null;
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
            <linearGradient id="spRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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
            style={{ stroke: "url(#spRingGrad)" }}
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

function EmptyRecord() {
  return (
    <div className="ep-empty-record">
      <i className="fa-light fa-magnifying-glass" />
      <p>No Record Found.</p>
    </div>
  );
}

export function StudentPortal({ data, symbol, portalLabel = "Student" }: { data: StudentPortalData; symbol: string; portalLabel?: "Student" | "Parent" }) {
  const { attendance, classTests, examinations, fees } = data;
  return (
    <section className="ep-layout">
      <aside className="ep-profile print:hidden">
        <div className="ep-avatar">
          {data.photoUrl ? (
            <img src={data.photoUrl} alt="" />
          ) : (
            <img
              src="https://eskooly.com/bb/uploads/students/no-image.png"
              alt=""
              onError={(event) => {
                const target = event.currentTarget;
                target.style.display = "none";
                target.parentElement?.classList.add("ep-avatar-empty");
              }}
            />
          )}
        </div>
        <h4 className="ep-name">{data.name}</h4>
        <div className="ep-facts ep-facts-tone">
          <Fact label="Registration No" value={data.registrationNo} />
          <Fact label="Date of Admission" value={data.admissionDate} />
          <Fact label="Class" value={data.className} />
          <Fact label="Family" value={data.familyName} />
          <Fact label="Discount in Fee" value={data.discountLabel} />
        </div>
        <div className="ep-facts">
          <Fact label="Date Of Birth" value={data.dateOfBirth} />
          <Fact label="Gender" value={data.gender} />
          <Fact label="Any Identification Mark?" value={data.identificationMark} />
          <Fact label="Blood Group" value={data.bloodGroup} />
          <Fact label="Disease If Any?" value={data.disease} />
          <Fact label="Student Birth Form ID / NIC" value={data.birthId} />
          <Fact label="Cast" value={data.caste} />
          <Fact label="Previous School" value={data.previousSchool} />
          <Fact label="Previous ID / Board Roll No" value={data.previousId} />
          <Fact label="Any Additional Note" value={data.note} />
          <Fact label="Orphan Student" value={data.orphan} />
          <Fact label="OSC" value={data.osc} />
          <Fact label="Religion" value={data.religion} />
          <Fact label="Total Siblings" value={data.siblings || "0"} />
        </div>
        <div className="ep-facts ep-facts-tone">
          <Fact label="Father Name" value={data.fatherName} />
          <Fact label="Mother Name" value={data.motherName} />
          <Fact label="Address" value={data.address} />
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
            <span className="ep-welcome-plain"> at <b>{portalLabel}</b> Portal.</span>
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
              <i className="fa-light fa-book-open" />
              <i className="fa-light fa-graduation-cap" />
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
                <h2>Attendance report</h2>
                <p>{data.instituteName} · {data.name} · {data.registrationNo} · {data.className}</p>
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

        <div className="ep-section print:hidden">
          <h6 className="ep-section-title">
            <span>2</span>
            <strong>Class Tests Report</strong>
          </h6>
          <div className="ep-salary-card">
            {classTests.length ? (
              <ul className="ep-record-list">
                {classTests.map((row, index) => (
                  <li key={`${row.subjectName}-${row.date}-${index}`}>
                    <strong>{row.subjectName}</strong>
                    <span>{row.date}</span>
                    <em>{row.obtained} / {row.total}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRecord />
            )}
          </div>
        </div>

        <div className="ep-section print:hidden">
          <h6 className="ep-section-title">
            <span>3</span>
            <strong>Examination Report</strong>
          </h6>
          <div className="ep-salary-card">
            {examinations.length ? (
              <ul className="ep-record-list">
                {examinations.map((row, index) => (
                  <li key={`${row.examName}-${row.subjectName}-${index}`}>
                    <strong>{row.examName}</strong>
                    <span>{row.subjectName}</span>
                    <em>{row.obtained}{row.total ? ` / ${row.total}` : ""}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRecord />
            )}
          </div>
        </div>

        <div className="ep-section print:hidden">
          <h6 className="ep-section-title">
            <span>4</span>
            <strong>Fee Report</strong>
          </h6>
          <div className="ep-salary-card">
            {fees.records.length || fees.latest ? (
              <>
                <div className="ep-salary-row">
                  <div className="ep-salary-pill">
                    <i className="fa-light fa-wallet" />
                    <div>
                      <strong>{money(symbol, fees.monthly)}</strong>
                      <span>Estimated Fee</span>
                    </div>
                  </div>
                  <div className={`ep-salary-pill ${fees.paidThisMonth ? "ok" : "warn"}`}>
                    <i className="fa-light fa-credit-card" />
                    <div>
                      <strong>{fees.paidThisMonth ? "FEE RECEIVED" : "FEE NOT RECIEVED"}</strong>
                      <span>This Month</span>
                    </div>
                  </div>
                </div>
                {(fees.records.length ? fees.records : fees.latest ? [fees.latest] : []).map((row, index) => (
                  <p key={`${row.feeMonth}-${index}`} className="ep-salary-latest">
                    {money(symbol, row.deposit)} · {row.feeMonth} · {row.paidOn}
                  </p>
                ))}
              </>
            ) : (
              <EmptyRecord />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
