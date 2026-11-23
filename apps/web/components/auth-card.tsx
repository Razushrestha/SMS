export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--esk-bg)] px-4 py-12">
      <div className="w-full max-w-md rounded-[14px] border border-[var(--esk-border)] bg-white p-8 shadow-[0_1px_3px_rgba(36,22,101,0.04)]">
        <p className="text-sm font-semibold tracking-wide text-[var(--esk-purple)]">NEPATRONIX SMS</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--esk-navy)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--esk-muted)]">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="esk-field">
      {label}
      <div>{children}</div>
    </label>
  );
}

export const control = "esk-control";
