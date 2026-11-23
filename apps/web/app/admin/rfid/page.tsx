"use client";

import { FormEvent, useEffect, useState } from "react";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Reader = { id: string; name: string; serial: string; location: string; direction: string; status: string; tapsToday: number };
type Card = { id: string; uid: string; status: string; person: string };
type Tap = { id: string; tappedAt: string; time: string; personName: string | null; uid: string; readerName: string; direction: string; result: string; photoUrl: string | null; detail: string };
type Home = { readers: Reader[]; cards: Card[]; feed: Tap[]; exceptions: Array<{ id: string; uid: string; result: string; personName: string | null }>; settings: { dayStart: string; cutoffMinutes: number; notifyParents: boolean } };
type Person = { id: string; name: string; registrationNo?: string };
type View = { name: string; className: string; today: { status: string; inTime: string | null; outTime: string | null } };

export default function RfidPage() {
  const [home, setHome] = useState<Home | null>(null);
  const [students, setStudents] = useState<Person[]>([]);
  const [secret, setSecret] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setHome(await api<Home>("/rfid"));
  }

  useEffect(() => {
    Promise.all([load(), api<Person[]>("/students")]).then(([, people]) => setStudents(people)).catch((err: Error) => setError(err.message));
  }, []);

  async function saveParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await api("/rfid/settings", {
        method: "PATCH",
        body: JSON.stringify({
          dayStart: home?.settings.dayStart ?? "09:00",
          cutoffMinutes: home?.settings.cutoffMinutes ?? 15,
          notifyParents: new FormData(event.currentTarget).get("notifyParents") === "on",
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function save(path: string, event: FormEvent<HTMLFormElement>, rememberSecret = false) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    try {
      const row = await api<{ secret?: string }>(path, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      if (rememberSecret && row.secret) setSecret(row.secret);
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function blockCard(id: string) {
    await api(`/rfid/cards/${id}/block`, { method: "POST", body: "{}" });
    await load();
  }

  return (
    <PageChrome icon="fa-light fa-microchip" crumbs={[{ label: "Devices", href: "/admin/rfid" }, { label: "RFID" }]}>
      <p className="mb-3 text-sm text-[var(--esk-muted)]">A gate tap updates the same day’s school row. An In tap on the bus door records boarded and does not mark school present. The first in and an out can leave an in-app message, or a phone message, when parent messages are on.</p>
      {secret ? <p className="esk-panel mb-4 text-sm">Reader secret, shown once: {secret}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="esk-panel" onSubmit={(event) => save("/rfid/readers", event, true)}>
          <h2>Reader</h2>
          <Field label="Name"><input className={control} name="name" required /></Field>
          <Field label="Serial"><input className={control} name="serial" required /></Field>
          <Field label="Location">
            <select className={control} name="location" defaultValue="gate">
              <option value="campus">Campus</option>
              <option value="gate">Gate</option>
              <option value="building">Building</option>
              <option value="room">Room</option>
              <option value="bus">Bus door</option>
            </select>
          </Field>
          <Field label="Direction">
            <select className={control} name="direction" defaultValue="in">
              <option value="in">In</option>
              <option value="out">Out</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Add reader</button>
        </form>
        <form className="esk-panel" onSubmit={(event) => save("/rfid/cards", event)}>
          <h2>Card</h2>
          <Field label="UID"><input className={control} name="uid" required /></Field>
          <Field label="Student">
            <select className={control} name="studentId" defaultValue="">
              <option value="">Unassigned spare</option>
              {students.map((person) => <option key={person.id} value={person.id}>{person.registrationNo} · {person.name}</option>)}
            </select>
          </Field>
          <button className="esk-btn-primary" type="submit"><i className="fa-light fa-plus" /> Assign card</button>
        </form>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DataCard>
          <p className="mb-2 px-1 text-sm font-semibold">Readers</p>
          {!home?.readers.length ? (
            <div className="esk-empty"><div><i className="fa-light fa-microchip" /></div><h5>No Readers</h5><p>Add a gate or bus door reader above.</p></div>
          ) : (
            <table className="esk-table">
              <thead><tr><th>Name</th><th>Serial</th><th>Place</th><th>Dir</th><th>Status</th><th>Today</th></tr></thead>
              <tbody>
                {home.readers.map((reader) => (
                  <tr key={reader.id}>
                    <td>{reader.name}</td>
                    <td>{reader.serial}</td>
                    <td>{reader.location}</td>
                    <td>{reader.direction}</td>
                    <td>{reader.status}</td>
                    <td>{reader.tapsToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
        <DataCard>
          <p className="mb-2 px-1 text-sm font-semibold">Cards</p>
          {!home?.cards.length ? (
            <div className="esk-empty"><div><i className="fa-light fa-id-card" /></div><h5>No Cards</h5><p>Assign a UID to a student or leave it spare.</p></div>
          ) : (
            <table className="esk-table">
              <thead><tr><th>UID</th><th>Person</th><th>Status</th><th /></tr></thead>
              <tbody>
                {home.cards.map((card) => (
                  <tr key={card.id}>
                    <td>{card.uid}</td>
                    <td>{card.person}</td>
                    <td>{card.status}</td>
                    <td className="text-right">
                      {card.status !== "blocked" ? (
                        <button className="text-red-600" type="button" onClick={() => void blockCard(card.id)}>Block</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DataCard>
          <p className="mb-2 px-1 text-sm font-semibold">Live taps</p>
          {!home?.feed.length ? (
            <div className="esk-empty"><div><i className="fa-light fa-wave-pulse" /></div><h5>No Taps Yet</h5><p>Gate taps appear here in time order.</p></div>
          ) : (
            <table className="esk-table">
              <thead><tr><th>Time</th><th>Person</th><th>Reader</th><th>Dir</th><th>Result</th></tr></thead>
              <tbody>
                {home.feed.map((tap) => (
                  <tr key={tap.id} className={tap.personName ? undefined : "text-red-600"}>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        {tap.photoUrl ? <img alt="" className="h-7 w-7 rounded object-cover" src={tap.photoUrl} /> : null}
                        {tap.time}
                      </span>
                    </td>
                    <td>{tap.personName || tap.uid}{tap.detail ? ` · ${tap.detail}` : ""}</td>
                    <td>{tap.readerName}</td>
                    <td>{tap.direction}</td>
                    <td>{tap.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataCard>
        <DataCard>
          <p className="mb-2 px-1 text-sm font-semibold">Exceptions</p>
          {!home?.exceptions.length ? (
            <div className="esk-empty"><div><i className="fa-light fa-triangle-exclamation" /></div><h5>No Exceptions</h5><p>Blocked, lost, or unmatched taps show here.</p></div>
          ) : (
            <table className="esk-table">
              <thead><tr><th>UID</th><th>Person</th><th>Result</th></tr></thead>
              <tbody>
                {home.exceptions.map((tap) => (
                  <tr key={tap.id}>
                    <td>{tap.uid}</td>
                    <td>{tap.personName || "unmatched"}</td>
                    <td>{tap.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 space-y-2 px-1 text-sm">
            <p className="text-[var(--esk-muted)]">Cutoff {home?.settings.cutoffMinutes ?? 15} minutes after {home?.settings.dayStart ?? "09:00"}. Parent messages {home?.settings.notifyParents ? "on" : "off"}. An in-app note does not use the SMS balance.</p>
            <form className="flex flex-wrap items-center gap-3" key={String(home?.settings.notifyParents)} onSubmit={saveParent}>
              <label className="flex items-center gap-2"><input name="notifyParents" type="checkbox" defaultChecked={home?.settings.notifyParents === true} /> Tell a parent on the first in and on out</label>
              <button className="esk-btn-ghost" type="submit">Save</button>
            </form>
            <button className="esk-btn-ghost" type="button" onClick={() => void api<{ message: string }>("/rfid/cutoff", { method: "POST", body: "{}" }).then((row) => setNote(row.message))}>Run cutoff</button>
          </div>
        </DataCard>
      </div>

      <form className="esk-panel mt-4 max-w-md" onSubmit={(event) => { event.preventDefault(); const id = String(new FormData(event.currentTarget).get("studentId")); void api<View>(`/rfid/student?studentId=${id}`).then(setView); }}>
        <h2>What the student sees</h2>
        <Field label="Student"><select className={control} name="studentId" required defaultValue="">{students.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
        <button className="esk-btn-primary" type="submit">Open</button>
        {view ? <p className="mt-3 text-sm">{view.name} · {view.className} · {view.today.status} · in {view.today.inTime || "—"} · out {view.today.outTime || "—"}</p> : null}
      </form>
      {note ? <p className="mt-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </PageChrome>
  );
}
