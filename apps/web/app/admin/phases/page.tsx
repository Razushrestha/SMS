import { PageChrome } from "@/components/page-chrome";
import { phases } from "@/lib/phases";

export default function PhasesPage() {
  return (
    <PageChrome icon="fa-light fa-list-check" crumbs={[{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Build Phases" }]}>
      <p className="mb-3 max-w-2xl text-sm text-[var(--esk-muted)]">
        The order follows the product spec. A teacher exists before a class, and a class exists before a student.
      </p>
      <ol className="grid gap-3">
        {phases.map((phase) => (
          <li key={phase.id} className="esk-panel">
            <div className="flex items-center justify-between gap-3">
              <h2>Phase {phase.id}. {phase.title}</h2>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  phase.state === "Done"
                    ? "bg-[var(--esk-teal)]/15 text-[var(--esk-teal)]"
                    : phase.state === "Doing"
                      ? "bg-[var(--esk-purple)]/15 text-[var(--esk-purple)]"
                      : "bg-[var(--esk-bg)] text-[var(--esk-navy)]"
                }`}
              >
                {phase.state}
              </span>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-[var(--esk-muted)]">
              {phase.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </PageChrome>
  );
}
