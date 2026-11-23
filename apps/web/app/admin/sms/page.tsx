"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Template = { id: string; name: string; body: string };
type Delivery = { id: string; phone: string; body: string; kind: string; status: string; createdAt: string };
type Home = { balance: number; connected: boolean; handset: string | null; templates: Template[]; optOuts: Array<{ id: string; phone: string }>; deliveries: Delivery[] };
type Setup = { code: string; qrDataUrl: string; message: string };
type Section = "gateway" | "branded" | "templates";

const steps = ["Install the gateway app and allow notifications.", "Log in with the institute admin account.", "Enter the pairing code. Saved messages stay not delivered."];

export default function SmsPage() {
  const [home, setHome] = useState<Home | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [section, setSection] = useState<Section>("gateway");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setHome(await api<Home>("/sms"));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function beginSetup() {
    setError("");
    setNote("");
    try {
      setSetup(await api<Setup>("/sms/setup", { method: "POST", body: "{}" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start setup");
    }
  }

  async function checkConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    try {
      const row = await api<{ message: string }>("/sms/pair", { method: "POST", body: JSON.stringify({ code: new FormData(form).get("code") }) });
      setSetup(null);
      setNote(row.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the connection");
    }
  }

  async function disconnect() {
    setError("");
    const row = await api<{ message: string }>("/sms/unpair", { method: "POST", body: "{}" });
    setSetup(null);
    setNote(row.message);
    await load();
  }

  async function send(path: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setNote("");
    try {
      const row = await api<{ status: string; balance?: number }>(path, {
        method: "POST",
        body: JSON.stringify({ phone: data.get("phone"), message: data.get("message") }),
      });
      form.reset();
      setNote(row.status === "opted_out" ? "This phone has opted out. The balance was not used." : "Recorded. The message stays not delivered.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the SMS");
    }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await api("/sms/templates", { method: "POST", body: JSON.stringify({ name: data.get("name"), body: data.get("body") }) });
    form.reset();
    await load();
  }

  async function optOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await api("/sms/opt-outs", { method: "POST", body: JSON.stringify({ phone: new FormData(form).get("phone") }) });
    form.reset();
    await load();
  }

  const crumb =
    section === "branded" ? "Branded SMS" : section === "templates" ? "SMS Templates" : "SMS Gateway";

  return (
    <PageChrome
      icon="fa-light fa-envelope"
      crumbs={[{ label: "SMS Services", href: "/admin/sms" }, { label: crumb }]}
      actions={<span className="rounded-full bg-[var(--esk-purple)] px-3 py-1 text-xs font-semibold text-white">Balance {home?.balance ?? "–"}</span>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)]">In-app chat and phone SMS are separate. This page records SMS against the balance. A paired handset does not deliver those messages.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["gateway", "Free SMS Gateway"],
            ["branded", "Branded SMS"],
            ["templates", "SMS Templates"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={section === id ? "esk-btn-primary" : "esk-btn-ghost"}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "gateway" ? (
        <>
          <div className="esk-panel mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {home?.connected
                ? `${home.handset ?? "Handset"} is paired. Saved messages stay not delivered.`
                : "No handset gateway is connected."}
            </p>
            {home?.connected ? (
              <button className="esk-btn-ghost" onClick={() => void disconnect()} type="button">Disconnect</button>
            ) : (
              <button className="esk-btn-primary" onClick={() => void beginSetup()} type="button"><i className="fa-light fa-qrcode" /> Start Setup</button>
            )}
          </div>
          {setup ? (
            <div className="esk-panel mb-4">
              <img alt="Pairing QR" className="h-28 w-28" src={setup.qrDataUrl} />
              <p className="mt-3 text-sm">Pairing code, shown once: {setup.code}</p>
              <ol className="mt-3 list-decimal pl-5 text-sm">{steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={checkConnection}>
                <Field label="Pairing code"><input className={control} name="code" required /></Field>
                <button className="esk-btn-primary mb-4" type="submit">Check connection</button>
              </form>
            </div>
          ) : null}
          <form className="esk-panel mb-4 max-w-xl" onSubmit={(event) => send("/sms/test", event)}>
            <h2>Test SMS</h2>
            <div className="mt-3">
              <Field label="Phone"><input className={control} name="phone" required /></Field>
              <Field label="Message"><textarea className={control} name="message" required rows={3} /></Field>
              <button className="esk-btn-primary" type="submit"><i className="fa-light fa-paper-plane" /> Record test</button>
            </div>
          </form>
        </>
      ) : null}

      {section === "branded" ? (
        <form className="esk-panel mb-4 max-w-xl" onSubmit={(event) => send("/sms/branded", event)}>
          <h2>Branded SMS</h2>
          <p className="mt-1 text-sm text-[var(--esk-muted)]">Record a branded message against the institute balance. Delivery still waits on a paired handset.</p>
          <div className="mt-3">
            <Field label="Phone"><input className={control} name="phone" required /></Field>
            <Field label="Message"><textarea className={control} name="message" required rows={3} /></Field>
            <button className="esk-btn-primary" type="submit"><i className="fa-light fa-paper-plane" /> Record branded SMS</button>
          </div>
        </form>
      ) : null}

      {section === "templates" ? (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <form className="esk-panel" onSubmit={saveTemplate}>
            <h2>Templates</h2>
            <div className="mt-3">
              <Field label="Name"><input className={control} name="name" required /></Field>
              <Field label="Message"><textarea className={control} name="body" required rows={2} /></Field>
              <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Save template</button>
            </div>
          </form>
          <form className="esk-panel" onSubmit={optOut}>
            <h2>Opt out</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label="Phone"><input className={control} name="phone" required /></Field>
              <button className="esk-btn-primary mb-4" type="submit">Save</button>
            </div>
          </form>
          <DataCard>
            <p className="mb-2 px-1 text-sm font-semibold">Saved templates</p>
            {!home?.templates.length ? (
              <div className="esk-empty"><div><i className="fa-light fa-file-lines" /></div><h5>No Templates</h5><p>Save a reusable SMS body above.</p></div>
            ) : (
              <table className="esk-table">
                <thead><tr><th>Name</th><th>Message</th></tr></thead>
                <tbody>
                  {home.templates.map((template) => (
                    <tr key={template.id}><td>{template.name}</td><td>{template.body}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataCard>
          <DataCard>
            <p className="mb-2 px-1 text-sm font-semibold">Opted-out numbers</p>
            {!home?.optOuts.length ? (
              <div className="esk-empty"><div><i className="fa-light fa-ban" /></div><h5>No Opt-Outs</h5><p>Numbers here never use the SMS balance.</p></div>
            ) : (
              <table className="esk-table">
                <thead><tr><th>Phone</th></tr></thead>
                <tbody>{home.optOuts.map((row) => <tr key={row.id}><td>{row.phone}</td></tr>)}</tbody>
              </table>
            )}
          </DataCard>
        </div>
      ) : null}

      {note ? <p className="mb-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <DataCard>
        {!home?.deliveries.length ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-envelope" /></div>
            <h5>No SMS Recorded</h5>
            <p>Test or branded SMS will appear here.</p>
          </div>
        ) : (
          <table className="esk-table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {home.deliveries.map((row) => (
                <tr key={row.id}>
                  <td>{row.phone}</td>
                  <td>{row.kind}</td>
                  <td>{row.status}</td>
                  <td>{row.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataCard>
    </PageChrome>
  );
}
