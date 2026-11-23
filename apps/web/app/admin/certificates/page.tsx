"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";

type Student = { id: string; name: string; registrationNo: string };
type Employee = { id: string; name: string; status: string };
type Row = { id: string; template: string; recipientType: string; recipient: string | null; certificateDate: string; reason: string };
type Print = {
  text: string;
  name: string;
  date: string;
  reason: string;
  conduct: string;
  duesNote: string;
  recipientType: string;
  template?: string;
  fatherName?: string | null;
  admissionNumber?: string;
  className?: string;
};
type Template = { id: string; name: string; conduct: string; duesNote: string };

export default function CertificatesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [conduct, setConduct] = useState("excellent");
  const [duesNote, setDuesNote] = useState("All dues are cleared.");
  const [recipientType, setRecipientType] = useState("student");
  const [printed, setPrinted] = useState<Print | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const [people, employees, list, templateRows, profile] = await Promise.all([
      api<Student[]>("/students"),
      api<Employee[]>("/employees"),
      api<Row[]>("/learning/certificates"),
      api<Template[]>("/learning/certificate-templates"),
      api<{ institute: Institute }>("/institute"),
    ]);
    setStudents(people);
    setStaff(employees.filter((person) => person.status === "active"));
    setRows(list);
    setTemplates(templateRows);
    setInstitute(profile.institute);
    const first = templateRows[0];
    if (first) {
      setTemplateId(first.id);
      setConduct(first.conduct);
      setDuesNote(first.duesNote);
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      const created = await api<{ id: string }>("/learning/certificates", {
        method: "POST",
        body: JSON.stringify({
          recipientType: data.get("recipientType"),
          studentId: data.get("studentId"),
          employeeId: data.get("employeeId"),
          template: templates.find((item) => item.id === templateId)?.name,
          reason: data.get("reason"),
          date: data.get("date"),
          conduct,
          duesNote,
        }),
      });
      form.reset();
      setRecipientType("student");
      await load();
      setPrinted(await api<Print>(`/learning/certificates/${created.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the certificate");
    }
  }

  async function openPrint(id: string) {
    setPrinted(await api<Print>(`/learning/certificates/${id}`));
  }

  async function remove(id: string) {
    if (!confirm("Delete this certificate?")) return;
    await api(`/learning/certificates/${id}`, { method: "DELETE" });
    setPrinted(null);
    await load();
  }

  const activeTemplate = templates.find((item) => item.id === templateId);

  return (
    <PageChrome
      icon="fa-light fa-medal"
      crumbs={[{ label: "Certificates", href: "/admin/certificates" }, { label: "Leave Certificate" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/certificates/templates">Templates</Link>}
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form className="esk-panel" onSubmit={onSubmit}>
          <h2>Generate</h2>
          <div className="mt-3">
            <Field label="Template">
              <select className={control} value={templateId} onChange={(event) => {
                const next = templates.find((item) => item.id === event.target.value);
                setTemplateId(event.target.value);
                if (next) {
                  setConduct(next.conduct);
                  setDuesNote(next.duesNote);
                }
              }}>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            {activeTemplate ? (
              <p className="mb-3 rounded-lg bg-[var(--esk-sidebar)] px-3 py-2 text-xs text-[var(--esk-muted)]">
                Preview defaults · Conduct <strong className="text-[var(--esk-navy)]">{conduct}</strong> · {duesNote}
              </p>
            ) : null}
            <Field label="Recipient type">
              <select className={control} name="recipientType" value={recipientType} onChange={(event) => setRecipientType(event.target.value)}>
                <option value="student">student</option>
                <option value="staff">staff</option>
              </select>
            </Field>
            {recipientType === "student" ? (
              <Field label="Student">
                <select className={control} name="studentId" required defaultValue="">
                  <option value="" disabled>Select a student</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.registrationNo} · {student.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Staff">
                <select className={control} name="employeeId" required defaultValue="">
                  <option value="" disabled>Select a staff member</option>
                  {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Reason"><input className={control} name="reason" required /></Field>
            <Field label="Certificate date"><input className={control} name="date" type="date" defaultValue={today()} required /></Field>
            <Field label="Conduct"><input className={control} value={conduct} onChange={(event) => setConduct(event.target.value)} required /></Field>
            <Field label="Dues note"><input className={control} value={duesNote} onChange={(event) => setDuesNote(event.target.value)} required /></Field>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-medal" /> Generate</button>
          </div>
        </form>
        <div className="space-y-4">
          <DataCard>
            {rows.length === 0 ? (
              <div className="esk-empty">
                <div><i className="fa-light fa-medal" /></div>
                <h5>No Certificates Yet</h5>
                <p>Generate a leave certificate to list it here.</p>
              </div>
            ) : (
              <table className="esk-table">
                <thead>
                  <tr>
                    <th>Certificate</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.template} · {row.recipientType} · {row.recipient} · {row.certificateDate}</td>
                      <td className="text-right">
                        <button className="esk-btn-ghost" type="button" onClick={() => void openPrint(row.id)}>Print</button>
                        <button className="ml-2 text-red-600" type="button" onClick={() => void remove(row.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>
          {printed ? (
            <div className="space-y-3">
              <div className="flex justify-end print:hidden">
                <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                  <i className="fa-light fa-print" /> Print
                </button>
              </div>
              <article className="esk-certificate">
                <div className="esk-certificate-brand">
                  {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-building-columns text-3xl text-[var(--esk-purple)]" />}
                  <h2>{institute?.name ?? "School"}</h2>
                  <p>{institute?.address}{institute?.phone ? ` · ${institute.phone}` : ""}</p>
                </div>
                <h1 className="esk-certificate-title">{printed.template || "Leave Certificate"}</h1>
                <div className="esk-certificate-body">
                  <p>{printed.text}</p>
                </div>
                <div className="esk-certificate-meta">
                  <div><span>Recipient</span><strong>{printed.name}</strong></div>
                  <div><span>Date</span><strong>{printed.date}</strong></div>
                  {printed.admissionNumber ? <div><span>Admission No</span><strong>{printed.admissionNumber}</strong></div> : null}
                  {printed.className ? <div><span>Class</span><strong>{printed.className}</strong></div> : null}
                  <div><span>Conduct</span><strong>{printed.conduct}</strong></div>
                  <div><span>Dues</span><strong>{printed.duesNote}</strong></div>
                </div>
                <div className="esk-receipt-sign" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <span>Authorized Signature</span>
                  <span>School Stamp</span>
                </div>
              </article>
            </div>
          ) : null}
        </div>
      </div>
    </PageChrome>
  );
}
