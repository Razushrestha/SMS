import Link from "next/link";
import type { ReactNode } from "react";

export function PageChrome({
  icon = "fa-light fa-folder",
  crumbs,
  actions,
  children,
}: {
  icon?: string;
  crumbs: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="esk-page">
      <div className="esk-crumb-card">
        <div className="esk-crumb">
          <span className="esk-crumb-icon"><i className={icon} /></span>
          <div className="esk-crumb-text">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`}>
                {index > 0 ? <span className="esk-crumb-sep"><i className="fa-light fa-chevron-right" /></span> : null}
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <strong>{crumb.label}</strong>}
              </span>
            ))}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function FilterCard({ children }: { children: ReactNode }) {
  return <div className="esk-filter-card">{children}</div>;
}

export function DataCard({ children }: { children: ReactNode }) {
  return <div className="esk-data-card">{children}</div>;
}

/** Compact intro strip used on student portal list pages (eSkooly-style panel head). */
export function StudentPanelHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 rounded-lg border border-[var(--esk-border)] bg-white px-4 py-3">
      <h2 className="text-base font-semibold text-[var(--esk-ink)]">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-[var(--esk-muted)]">{hint}</p> : null}
    </div>
  );
}
