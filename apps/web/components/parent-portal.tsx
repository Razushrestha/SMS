"use client";

import { useState } from "react";
import { StudentPortal, type StudentPortalData } from "@/components/student-portal";

export type ParentPortalData = {
  name: string;
  instituteName: string;
  targetLine: string;
  children: StudentPortalData[];
  feeReminder?: { estimated: string; symbol: string; message: string } | null;
};

export function ParentPortal({ data, symbol }: { data: ParentPortalData; symbol: string }) {
  const [childId, setChildId] = useState(data.children[0]?.registrationNo ?? "");
  const selected =
    data.children.find((child) => child.registrationNo === childId) ??
    data.children[0] ??
    null;

  if (!selected) {
    return (
      <section className="ep-layout">
        <div className="ep-main">
          <div className="ep-welcome">
            <h6 className="ep-welcome-top">
              <i className="fa-light fa-hand-wave ep-hi" />
              <span className="ep-welcome-plain"> Welcome </span>
              <span className="ep-welcome-name">{data.name}</span>
              <span className="ep-welcome-plain"> at <b>Parent</b> Portal.</span>
            </h6>
            <p className="mt-4 text-sm text-[var(--esk-muted)]">No students are linked to this parent yet. Ask the school administrator to link your children.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--esk-border)] bg-[var(--esk-panel)] px-4 py-3 print:hidden">
        <div>
          <p className="text-sm text-[var(--esk-muted)]">Signed in as {data.name}</p>
          <p className="font-semibold text-[var(--esk-navy)]">{data.instituteName}</p>
        </div>
        {data.children.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {data.children.map((child) => (
              <button
                key={child.registrationNo}
                type="button"
                className={child.registrationNo === selected.registrationNo ? "esk-btn-primary" : "esk-btn-ghost"}
                onClick={() => setChildId(child.registrationNo)}
              >
                {child.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--esk-muted)]">Child · {selected.name}</p>
        )}
      </div>
      <StudentPortal
        data={{
          ...selected,
          // Parent portal welcome wording is handled by wrapping; StudentPortal still says Student — override name line via institute context is fine for now.
        }}
        symbol={symbol}
        portalLabel="Parent"
      />
    </section>
  );
}
