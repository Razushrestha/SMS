"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Field, control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Login = {
  name: string;
  username: string | null;
  phone: string | null;
  passwordNote: string;
};

type Reset = { username: string; password: string; passwordNote: string };
type Sms = { phone: string; status: string; balance: number | null; includesPassword: boolean };

export default function ManageLoginPage() {
  const params = useParams<{ id: string }>();
  const [login, setLogin] = useState<Login | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Login>(`/students/${params.id}/login`)
      .then((row) => {
        setLogin(row);
        setUsername(row.username ?? "");
        setNote(row.passwordNote);
      })
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const saved = await api<{ username: string }>(`/students/${params.id}/login`, {
        method: "PATCH",
        body: JSON.stringify({ username }),
      });
      setUsername(saved.username);
      setLogin((current) => current ? { ...current, username: saved.username } : current);
      setNote("Username saved. The password was not changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the username");
    }
  }

  async function reset() {
    setError("");
    try {
      const row = await api<Reset>(`/students/${params.id}/login/reset`, { method: "POST" });
      setPassword(row.password);
      setNote(row.passwordNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    }
  }

  async function sendSms() {
    setError("");
    try {
      const row = await api<Sms>(`/students/${params.id}/login/sms`, {
        method: "POST",
        body: JSON.stringify(password ? { password } : {}),
      });
      setPassword(null);
      const delivery = row.status === "opted_out" ? "The number is opted out, so no balance was used." : `Status not sent. Balance ${row.balance}.`;
      const included = row.includesPassword ? "The password was included once." : "The password was left out.";
      setNote(`SMS saved for ${row.phone}. ${delivery} ${included} No gateway is connected, so this message is not delivered.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the SMS");
    }
  }

  return (
    <PageChrome
      icon="fa-light fa-key"
      crumbs={[
        { label: "Students", href: "/admin/students" },
        { label: login?.name ?? "Student", href: `/admin/students/${params.id}` },
        { label: "Manage Login" },
      ]}
      actions={<Link className="esk-btn-ghost" href="/admin/students">Students</Link>}
    >
      <p className="mb-3 text-sm text-[var(--esk-muted)]">{login?.name}. A password is shown once and is not stored.</p>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <form className="esk-panel max-w-xl" onSubmit={save}>
        <Field label="Username">
          <input className={control} value={username} onChange={(event) => setUsername(event.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={`${control} bg-mist`} value={password ?? ""} readOnly placeholder="Shown once after a reset" />
        </Field>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="esk-btn-primary" type="submit"><i className="fa-light fa-floppy-disk" /> Save changes</button>
          <button className="esk-btn-ghost" type="button" onClick={reset}>Reset password</button>
          <button className="esk-btn-ghost" type="button" onClick={sendSms}>Send SMS</button>
        </div>
      </form>
      {note ? <p className="mt-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
    </PageChrome>
  );
}
