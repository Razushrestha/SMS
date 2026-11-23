"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Duty = {
  driver: string;
  vehicle: { name: string; plate: string };
  trip: { id: string; status: string; date: string; plannedStart: string } | null;
  stops: Array<{ name: string; students: number }>;
  last: { latitude: number; longitude: number } | null;
};

type Board = { assigned: boolean; message: string | null; duties: Duty[] };

function statusClass(status: string) {
  if (status === "running") return "bg-[var(--esk-teal)]/15 text-[var(--esk-teal)]";
  if (status === "scheduled") return "bg-[var(--esk-purple)]/15 text-[var(--esk-purple)]";
  return "bg-[var(--esk-bg)] text-[var(--esk-muted)]";
}

export default function DriverPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function load() {
    return api<Board>("/gps/driver").then(setBoard);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function act(path: string, tripId: string) {
    setError("");
    setNote("");
    try {
      await api(path, { method: "POST", body: JSON.stringify({ tripId }) });
      setNote(path.endsWith("sos") ? "SOS sent." : "Trip updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the trip");
    }
  }

  async function locate(event: FormEvent<HTMLFormElement>, tripId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setNote("");
    try {
      await api("/gps/driver/location", {
        method: "POST",
        body: JSON.stringify({
          tripId,
          latitude: Number(data.get("latitude")),
          longitude: Number(data.get("longitude")),
          speed: Number(data.get("speed") || 20),
        }),
      });
      setNote("Location sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the location");
    }
  }

  if (!board) {
    return (
      <PageChrome icon="fa-light fa-bus" crumbs={[{ label: "GPS", href: "/admin/gps" }, { label: "Driver" }]}>
        <p className="text-sm text-[var(--esk-muted)]">{error || "Loading the driver app…"}</p>
      </PageChrome>
    );
  }

  return (
    <PageChrome
      icon="fa-light fa-bus"
      crumbs={[{ label: "GPS", href: "/admin/gps" }, { label: "Driver" }]}
      actions={<Link className="esk-btn-ghost" href="/admin/gps">GPS</Link>}
    >
      <p className="mb-3 max-w-2xl text-sm text-[var(--esk-muted)]">The stop list shows student counts. Phone numbers stay off this screen. A bus location does not mark a student present at school.</p>
      {board.message ? <p className="mb-3 text-sm">{board.message}</p> : null}
      <div className="max-w-2xl space-y-4">
        {board.duties.map((duty) => (
          <div key={duty.vehicle.plate} className="esk-panel">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2>{duty.vehicle.name} · {duty.vehicle.plate}</h2>
                <p className="mt-1 text-sm text-[var(--esk-muted)]">Driver {duty.driver || "unassigned"}</p>
              </div>
              {duty.trip ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(duty.trip.status)}`}>
                  {duty.trip.status}
                </span>
              ) : (
                <span className="rounded-full bg-[var(--esk-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--esk-muted)]">no trip</span>
              )}
            </div>
            {duty.trip ? (
              <p className="mt-2 text-sm">{duty.trip.date} · starts {duty.trip.plannedStart}</p>
            ) : (
              <p className="mt-2 text-sm text-[var(--esk-muted)]">No trip is scheduled.</p>
            )}

            <DataCard>
              <p className="mb-2 px-1 text-sm font-semibold">Stops</p>
              {!duty.stops.length ? (
                <p className="px-1 text-sm text-[var(--esk-muted)]">No stops on this route.</p>
              ) : (
                <table className="esk-table">
                  <thead><tr><th>#</th><th>Stop</th><th>Students</th></tr></thead>
                  <tbody>
                    {duty.stops.map((stop, index) => (
                      <tr key={stop.name}>
                        <td>{index + 1}</td>
                        <td>{stop.name}</td>
                        <td>{stop.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DataCard>

            <div className="mt-3 flex flex-wrap gap-2">
              {duty.trip?.status === "scheduled" ? (
                <button className="esk-btn-primary" onClick={() => void act("/gps/driver/start", duty.trip!.id)} type="button">
                  <i className="fa-light fa-play" /> Start trip
                </button>
              ) : null}
              {duty.trip?.status === "running" ? (
                <>
                  <button className="esk-btn-ghost" onClick={() => void act("/gps/driver/end", duty.trip!.id)} type="button">
                    <i className="fa-light fa-flag-checkered" /> End trip
                  </button>
                  <button
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => { if (confirm("Send an SOS for this bus?")) void act("/gps/driver/sos", duty.trip!.id); }}
                    type="button"
                  >
                    SOS
                  </button>
                </>
              ) : null}
            </div>

            {duty.trip?.status === "running" ? (
              <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(event) => void locate(event, duty.trip!.id)}>
                <Field label="Latitude"><input className={control} name="latitude" defaultValue={duty.last?.latitude ?? ""} required /></Field>
                <Field label="Longitude"><input className={control} name="longitude" defaultValue={duty.last?.longitude ?? ""} required /></Field>
                <Field label="Speed"><input className={control} name="speed" type="number" min="0" defaultValue="20" /></Field>
                <button className="esk-btn-primary h-10 self-end" type="submit">Send location</button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
      {note ? <p className="mt-3 text-sm text-[var(--esk-purple)]">{note}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </PageChrome>
  );
}
