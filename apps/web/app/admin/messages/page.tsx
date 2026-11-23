"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api } from "@/lib/api";
import { usePortalStudent } from "@/lib/portal-student";

type Chat = { id: string; title: string; audience: string; group: boolean; unread: number; archived: boolean };
type Message = { id: string; senderName: string; body: string; attachmentName: string | null; createdAt: string; mine: boolean };
type Thread = { id: string; title: string; group: boolean; messages: Message[] };
type Person = { id: string; name: string };
type ClassRow = { id: string; name: string };

const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

export default function MessagesPage() {
  const { ready, isPortal: isStudent, error: portalError } = usePortalStudent();
  const [inbox, setInbox] = useState<{ unread: number; chats: Chat[] }>({ unread: 0, chats: [] });
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState("all_students");
  const [compose, setCompose] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [error, setError] = useState("");

  async function loadList(nextSearch = search, nextArchived = archived) {
    const query = new URLSearchParams();
    if (nextSearch) query.set("search", nextSearch);
    if (nextArchived) query.set("archived", "1");
    setInbox(await api(`/messages?${query}`));
  }

  async function open(id: string) {
    setThread(await api<Thread>(`/messages/${id}`));
    await loadList();
  }

  useEffect(() => {
    if (!ready) return;
    if (!isStudent) {
      Promise.all([api<ClassRow[]>("/classes"), api<Person[]>("/students"), api<Array<Person & { status: string }>>("/employees")])
        .then(([rooms, people, employees]) => {
          setClasses(rooms);
          setStudents(people);
          setStaff(employees.filter((person) => person.status === "active"));
        })
        .catch((err: Error) => setError(err.message));
    }
    loadList().catch((err: Error) => setError(err.message));
  }, [ready, isStudent]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const box = document.getElementById("chat-box") as HTMLTextAreaElement | null;
      loadList().catch(() => undefined);
      if (!thread || document.activeElement === box || box?.value) return;
      open(thread.id).catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [thread?.id, search, archived]);

  async function onFile(selected?: File) {
    setError("");
    if (!selected) return setFile(null);
    if (!allowed.includes(selected.type) || selected.size > 100 * 1024) {
      setFile(null);
      setError("Attachment must be a JPG, PNG, GIF, WEBP, or PDF, and 100 KB or smaller");
      return;
    }
    const bytes = new Uint8Array(await selected.arrayBuffer());
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    setFile({ name: selected.name, data: `data:${selected.type};base64,${btoa(binary)}` });
  }

  async function startChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = compose;
    if (!message.trim() && !file) return;
    setError("");
    try {
      const created = await api<{ id: string }>("/messages", {
        method: "POST",
        body: JSON.stringify({
          audience: data.get("audience"),
          classId: data.get("classId"),
          studentId: data.get("studentId"),
          employeeId: data.get("employeeId"),
          message,
          attachmentName: file?.name,
          attachmentData: file?.data,
        }),
      });
      setFile(null);
      setCompose("");
      form.reset();
      setAudience("all_students");
      await open(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message");
    }
  }

  async function send() {
    if (!thread || sending || (!draft.trim() && !file)) return;
    setSending(true);
    setError("");
    try {
      await api(`/messages/${thread.id}`, {
        method: "POST",
        body: JSON.stringify({ message: draft, attachmentName: file?.name, attachmentData: file?.data }),
      });
      setDraft("");
      setFile(null);
      await open(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  }

  async function archive() {
    if (!thread) return;
    await api(`/messages/${thread.id}/archive`, { method: "POST", body: "{}" });
    setThread(null);
    await loadList();
  }

  async function remove() {
    if (!thread || !confirm("Delete this chat?")) return;
    await api(`/messages/${thread.id}`, { method: "DELETE" });
    setThread(null);
    await loadList();
  }

  const remaining = 260 - draft.length;

  return (
    <PageChrome
      icon="fa-light fa-comment"
      crumbs={[{ label: "Messaging", href: "/admin/messages" }, { label: "Chats" }]}
      actions={
        <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${inbox.unread > 0 ? "bg-[var(--esk-rose)]" : "bg-[var(--esk-teal)]"}`}>
          {inbox.unread} unread
        </span>
      }
    >
      {isStudent ? <StudentPanelHead title="Messaging" hint="School broadcasts and chats for linked students. Reply is allowed; archive and new chats stay with staff." /> : <p className="mb-3 text-sm text-[var(--esk-muted)]">Messages are stored for the institute. They are not end-to-end encrypted.</p>}
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className={thread ? "hidden md:block" : "block"}>
          <input className={control} placeholder="Search chats" value={search} onChange={(event) => { setSearch(event.target.value); loadList(event.target.value).catch(() => undefined); }} />
          {isStudent ? null : (
            <button className="esk-btn-ghost mt-2" type="button" onClick={() => { const next = !archived; setArchived(next); loadList(search, next).catch(() => undefined); }}>
              {archived ? "Chats" : "Archived"}
            </button>
          )}
          <div className="esk-data-card mt-3">
            {inbox.chats.length === 0 ? (
              <div className="esk-empty">
                <div><i className="fa-light fa-comment" /></div>
                <h5>No Chats Found</h5>
                <p>Start a new chat below.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--esk-border)]">
                {inbox.chats.map((chat) => (
                  <li key={chat.id}>
                    <button className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--esk-sidebar)]" type="button" onClick={() => void open(chat.id)}>
                      <span className="font-medium">{chat.title}</span>
                      {chat.group ? <span className="ml-2 rounded bg-[var(--esk-bg)] px-1.5 text-xs">Group</span> : null}
                      {chat.unread ? <span className="ml-2 text-xs text-[var(--esk-rose)]">{chat.unread}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isStudent ? null : (
            <form className="esk-panel mt-4" onSubmit={startChat}>
              <h2>New chat</h2>
              <Field label="To">
                <select className={control} name="audience" value={audience} onChange={(event) => setAudience(event.target.value)}>
                  <option value="all_students">All Students</option>
                  <option value="all_employees">All Employees</option>
                  <option value="class">Specific Class</option>
                  <option value="student">Specific Student</option>
                  <option value="employee">Specific Employee</option>
                </select>
              </Field>
              {audience === "class" ? <Field label="Class"><select className={control} name="classId" required defaultValue="">{classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></Field> : null}
              {audience === "student" ? <Field label="Student"><select className={control} name="studentId" required defaultValue="">{students.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field> : null}
              {audience === "employee" ? <Field label="Employee"><select className={control} name="employeeId" required defaultValue="">{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field> : null}
              <Field label="Message">
                <textarea className={control} maxLength={260} required rows={3} value={compose} onChange={(event) => setCompose(event.target.value)} />
              </Field>
              <p className="mb-3 text-xs text-[var(--esk-muted)]">{260 - compose.length} characters left</p>
              <input className={control} type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf" onChange={(event) => void onFile(event.target.files?.[0])} />
              {file ? <p className="mt-1 text-xs">{file.name} <button type="button" onClick={() => setFile(null)}>X</button></p> : null}
              <button className="esk-btn-primary mt-3" type="submit"><i className="fa-light fa-paper-plane" /> Send</button>
            </form>
          )}
          {error || portalError ? <p className="mt-3 text-sm text-red-600">{error || portalError}</p> : null}
        </div>
        <div className={thread ? "block" : "hidden md:block"}>
          {thread ? (
            <div className="esk-panel">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <button className="esk-btn-ghost mr-2 md:hidden" type="button" onClick={() => setThread(null)}>Back</button>
                  <span className="font-semibold">{thread.title}</span>
                  {thread.group ? <span className="ml-2 rounded bg-[var(--esk-bg)] px-1.5 text-xs">Group</span> : null}
                </div>
                {isStudent ? null : (
                  <div className="flex gap-2 text-sm">
                    <button className="esk-btn-ghost" type="button" onClick={() => void archive()}>Archive</button>
                    <button className="text-red-600" type="button" onClick={() => void remove()}>Delete</button>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {thread.messages.map((message) => (
                  <div key={message.id} className={message.mine ? "text-right" : "text-left"}>
                    <p className="text-xs text-[var(--esk-muted)]">{message.senderName} · {relative(message.createdAt)}</p>
                    <p className="inline-block rounded-xl bg-[var(--esk-bg)] px-3 py-2 text-sm">{message.body}</p>
                    {message.attachmentName ? <p className="text-xs text-[var(--esk-muted)]">{message.attachmentName}</p> : null}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <textarea id="chat-box" className={control} maxLength={260} placeholder="Type a message" value={draft} onChange={(event) => setDraft(event.target.value)} />
                <p className="mt-1 text-xs text-[var(--esk-muted)]">{remaining} characters left</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf" onChange={(event) => void onFile(event.target.files?.[0])} />
                  {file ? <span className="text-xs">{file.name} <button type="button" onClick={() => setFile(null)}>X</button></span> : null}
                  <button className="esk-btn-primary" type="button" onClick={() => void send()}>{sending ? "Sending.." : "Send"}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="esk-empty">
              <div><i className="fa-light fa-comments" /></div>
              <h5>Select a Chat</h5>
              <p>Chats for admins, teachers, students, and staff.</p>
            </div>
          )}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </PageChrome>
  );
}
