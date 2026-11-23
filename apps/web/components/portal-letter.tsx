"use client";

import { useEffect, useState } from "react";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { usePortalStudent } from "@/lib/portal-student";

type Letter = {
  title: string;
  instituteName: string;
  institutePhone: string;
  instituteLogo: string | null;
  rules: string;
  name: string;
  lines: string[];
  username: string | null;
  password: string | null;
  passwordNote: string;
  qrDataUrl: string | null;
};

export function PortalLetter({ title, createPath, body, reprintPath }: { title: string; createPath: string; body: Record<string, string>; reprintPath: string }) {
  const { ready, isStudent } = usePortalStudent();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Letter>(reprintPath)
      .then(setLetter)
      .catch((err: Error) => setError(err.message));
  }, [reprintPath]);

  async function createLogin() {
    setError("");
    setLetter(await api<Letter>(createPath, { method: "POST", body: JSON.stringify(body) }));
  }

  async function reprint() {
    setLetter(await api<Letter>(reprintPath));
  }

  if (error) {
    return (
      <PageChrome icon="fa-light fa-envelope-open-text" crumbs={[{ label: title }]}>
        <p className="text-sm text-red-600">{error}</p>
      </PageChrome>
    );
  }
  if (!letter || !ready) {
    return (
      <PageChrome icon="fa-light fa-envelope-open-text" crumbs={[{ label: title }]}>
        <p className="text-sm text-[var(--esk-muted)]">Loading {title.toLowerCase()}…</p>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-envelope-open-text"
      crumbs={[{ label: title }]}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <button className="esk-btn-primary" type="button" onClick={() => window.print()}><i className="fa-light fa-print" /> Print</button>
          <button className="esk-btn-ghost" type="button" onClick={() => reprint().catch((err: Error) => setError(err.message))}>Print again</button>
        </div>
      }
    >
      <article className="esk-letter-doc mx-auto max-w-2xl">
        <header className="esk-letter-head">
          {letter.instituteLogo ? <img src={letter.instituteLogo} alt={letter.instituteName} /> : <i className="fa-light fa-building-columns text-2xl text-[var(--esk-purple)]" />}
          <div>
            <h2>{letter.instituteName}</h2>
            <p>{letter.institutePhone}</p>
          </div>
        </header>
        <h1>{letter.title}</h1>
        <div className="esk-letter-body">
          <p className="mb-3 font-semibold text-[var(--esk-navy)]">{letter.name}</p>
          {letter.lines.map((line) => <p key={line} className="mb-1">{line}</p>)}
        </div>
        <div className="esk-letter-rules">
          <strong className="mb-1 block">Rules</strong>
          {letter.rules}
        </div>
        <div className="esk-letter-login">
          <strong className="mb-1 block">Portal login</strong>
          <p>Username {letter.username || "—"}</p>
          {!isStudent && letter.password ? <p>Password {letter.password}</p> : null}
          {!isStudent ? <p className="mt-1 text-[var(--esk-muted)]">{letter.passwordNote}</p> : letter.username ? <p className="mt-1 text-[var(--esk-muted)]">Use your student username to sign in on the login page.</p> : <p className="mt-1 text-[var(--esk-muted)]">Ask your administrator for portal login details.</p>}
          {!isStudent && !letter.username ? (
            <button className="esk-btn-primary mt-3 print:hidden" type="button" onClick={() => createLogin().catch((err: Error) => setError(err.message))}>
              <i className="fa-light fa-key" /> Create portal login
            </button>
          ) : null}
          {letter.qrDataUrl ? <img src={letter.qrDataUrl} alt="Portal QR" className="mt-3 h-28 w-28" /> : null}
        </div>
      </article>
    </PageChrome>
  );
}
