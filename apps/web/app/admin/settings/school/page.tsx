"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Preferences = {
  direction: string;
  sidebar: string;
  header: string;
  activeColor: string;
  language: string;
  studentRules: string;
  employeeRules: string;
};
type Band = { grade: string; lower: number; upper: number; pass: boolean };
type Grading = { weakBelow: number; strongFrom: number; overallFailAt: number; subjectFailAt: number; failSubjectCount: number; bands: Band[] };

const languages = ["English", "Nepali", "Hindi", "Urdu", "Arabic", "Bengali", "Chinese", "French", "Spanish", "Xhosa"];

export default function SchoolSettingsPage() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [grading, setGrading] = useState<Grading | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Preferences>("/institute/preferences"), api<Grading>("/learning/settings")])
      .then(([theme, scale]) => {
        setPreferences(theme);
        setGrading(scale);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function saveTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    try {
      const saved = await api<Preferences>("/institute/preferences", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      setPreferences(saved);
      window.dispatchEvent(new Event("school-preferences"));
      setMessage("Theme and rules saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function saveGrading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!grading) return;
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      const saved = await api<Grading>("/learning/settings", {
        method: "PATCH",
        body: JSON.stringify({
          weakBelow: data.get("weakBelow"),
          strongFrom: data.get("strongFrom"),
          overallFailAt: data.get("overallFailAt"),
          subjectFailAt: data.get("subjectFailAt"),
          failSubjectCount: data.get("failSubjectCount"),
          bands: grading.bands,
        }),
      });
      setGrading(saved);
      setMessage("Grade scale saved. Report cards use this scale.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the grade scale");
    }
  }

  if (!preferences || !grading) {
    return (
      <PageChrome icon="fa-light fa-sliders" crumbs={[{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Theme & Grading" }]}>
        <p className="text-sm text-[var(--esk-muted)]">{error || "Loading settings…"}</p>
      </PageChrome>
    );
  }

  return (
    <PageChrome icon="fa-light fa-sliders" crumbs={[{ label: "General Settings", href: "/admin/settings/institute" }, { label: "Theme & Grading" }]}>
      <p className="mb-3 text-sm text-[var(--esk-muted)]">The grade scale is used on report cards. Student rules print on the admission letter. Employee rules print on the job letter.</p>
      <div className="max-w-3xl space-y-4">
        <form className="esk-panel grid gap-3 md:grid-cols-2" onSubmit={saveTheme}>
          <h2 className="md:col-span-2">Theme and rules</h2>
          <Field label="Direction">
            <select className={control} name="direction" value={preferences.direction} onChange={(event) => setPreferences({ ...preferences, direction: event.target.value })}><option value="ltr">Left to right</option><option value="rtl">Right to left</option></select>
          </Field>
          <Field label="Sidebar">
            <select className={control} name="sidebar" value={preferences.sidebar} onChange={(event) => setPreferences({ ...preferences, sidebar: event.target.value })}><option value="dark">Dark</option><option value="light">Light</option></select>
          </Field>
          <Field label="Header">
            <select className={control} name="header" value={preferences.header} onChange={(event) => setPreferences({ ...preferences, header: event.target.value })}>
              <option value="dark">Dark</option><option value="red">Red</option><option value="dark-green">Dark Green</option><option value="green">Green</option><option value="blue">Blue</option><option value="white">White</option>
            </select>
          </Field>
          <Field label="Active item">
            <select className={control} name="activeColor" value={preferences.activeColor} onChange={(event) => setPreferences({ ...preferences, activeColor: event.target.value })}>
              <option value="teal">Teal</option><option value="blue">Blue</option><option value="red">Red</option><option value="green">Green</option><option value="amber">Amber</option>
            </select>
          </Field>
          <Field label="Language">
            <select className={control} name="language" value={preferences.language} onChange={(event) => setPreferences({ ...preferences, language: event.target.value })}>{languages.map((language) => <option key={language}>{language}</option>)}</select>
          </Field>
          <Field label="Student rules"><textarea className={control} name="studentRules" rows={4} value={preferences.studentRules} onChange={(event) => setPreferences({ ...preferences, studentRules: event.target.value })} /></Field>
          <Field label="Employee rules"><textarea className={control} name="employeeRules" rows={4} value={preferences.employeeRules} onChange={(event) => setPreferences({ ...preferences, employeeRules: event.target.value })} /></Field>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-check" /> Save</button>
            <button type="button" className="esk-btn-ghost" onClick={() => void api<Preferences>("/institute/preferences/reset", { method: "POST", body: "{}" }).then((saved) => { setPreferences(saved); window.dispatchEvent(new Event("school-preferences")); })}>Reset theme</button>
          </div>
        </form>
        <form className="esk-panel" onSubmit={saveGrading}>
          <h2>Marks grading</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--esk-border)]">
            <table className="esk-table">
              <thead><tr><th>Grade</th><th>Lower</th><th>Upper</th><th>Result</th></tr></thead>
              <tbody>
                {grading.bands.map((band, index) => (
                  <tr key={band.grade}>
                    <td><input className={control} value={band.grade} onChange={(event) => setGrading({ ...grading, bands: grading.bands.map((row, rowIndex) => rowIndex === index ? { ...row, grade: event.target.value } : row) })} /></td>
                    <td><input className={control} type="number" value={band.lower} onChange={(event) => setGrading({ ...grading, bands: grading.bands.map((row, rowIndex) => rowIndex === index ? { ...row, lower: Number(event.target.value) } : row) })} /></td>
                    <td><input className={control} type="number" value={band.upper} onChange={(event) => setGrading({ ...grading, bands: grading.bands.map((row, rowIndex) => rowIndex === index ? { ...row, upper: Number(event.target.value) } : row) })} /></td>
                    <td>
                      <select className={control} value={band.pass ? "PASS" : "FAIL"} onChange={(event) => setGrading({ ...grading, bands: grading.bands.map((row, rowIndex) => rowIndex === index ? { ...row, pass: event.target.value === "PASS" } : row) })}>
                        <option>PASS</option><option>FAIL</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="Weak below"><input className={control} name="weakBelow" type="number" defaultValue={grading.weakBelow} /></Field>
            <Field label="Strong from"><input className={control} name="strongFrom" type="number" defaultValue={grading.strongFrom} /></Field>
            <Field label="Overall fail at"><input className={control} name="overallFailAt" type="number" defaultValue={grading.overallFailAt} /></Field>
            <Field label="Subject fail at"><input className={control} name="subjectFailAt" type="number" defaultValue={grading.subjectFailAt} /></Field>
            <Field label="Fail if this many subjects fail"><input className={control} name="failSubjectCount" type="number" defaultValue={grading.failSubjectCount} /></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-check" /> Save grade scale</button>
            <button type="button" className="esk-btn-ghost" onClick={() => void api<Grading>("/learning/settings/reset", { method: "POST", body: "{}" }).then(setGrading)}>Reset grade scale</button>
          </div>
        </form>
        {message ? <p className="text-sm text-[var(--esk-purple)]">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </PageChrome>
  );
}
