"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Field, control } from "@/components/auth-card";
import { DataCard, PageChrome, StudentPanelHead } from "@/components/page-chrome";
import { api, type Institute } from "@/lib/api";
import { today } from "@/lib/dates";
import { usePortalStudent } from "@/lib/portal-student";

type Stop = { id: string; name: string; latitude: number; longitude: number; radiusMetres: number; students: number };
type RouteRow = { id: string; name: string; vehicleId: string; driver: string; stops: Stop[] };
type Vehicle = {
  id: string;
  name: string;
  plate: string;
  type: string;
  trackerId: string | null;
  driver: string;
  status: string;
  trip: { id: string; status: string; plannedStart: string } | null;
  last: { latitude: number; longitude: number; speed: number | null; ageSeconds: number; stale: boolean } | null;
  currentStop: string | null;
  nextStop: string | null;
};
type Trip = { id: string; routeId: string; vehicleId: string; date: string; plannedStart: string; status: string };
type Home = {
  settings: { speedLimitKmh: number; corridorMetres: number; retentionDays: number; notifySms: boolean };
  vehicles: Vehicle[];
  routes: RouteRow[];
  trips: Trip[];
  alerts: Array<{ id: string; kind: string; message: string }>;
};
type Person = { id: string; name: string };
type Point = { id: string; latitude: number; longitude: number; speed: number | null; deviceTime: string };
type Parent = {
  name: string;
  assigned: boolean;
  stop?: { name: string; latitude: number; longitude: number } | null;
  vehicle?: { name: string; plate: string };
  trip?: string;
  etaMinutes?: number | null;
};

export default function GpsPage() {
  const { ready, isParent, children, error: portalError } = usePortalStudent();
  const [home, setHome] = useState<Home | null>(null);
  const [students, setStudents] = useState<Person[]>([]);
  const [drivers, setDrivers] = useState<Person[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState(0);
  const [parent, setParent] = useState<Parent | null>(null);
  const [parentViews, setParentViews] = useState<Array<Parent & { studentId: string }>>([]);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setHome(await api<Home>("/gps"));
  }

  useEffect(() => {
    if (!ready) return;
    if (isParent) {
      Promise.all([
        Promise.all(children.map(async (child) => {
          const view = await api<Parent>(`/gps/parent?studentId=${encodeURIComponent(child.id)}`);
          return { ...view, studentId: child.id };
        })),
        api<{ institute: Institute }>("/institute"),
      ])
        .then(([views, profile]) => {
          setParentViews(views);
          setInstitute(profile.institute);
        })
        .catch((err: Error) => setError(err.message));
      return;
    }
    Promise.all([load(), api<Person[]>("/students"), api<Person[]>("/employees")])
      .then(([, people, staff]) => {
        setStudents(people);
        setDrivers(staff);
      })
      .catch((err: Error) => setError(err.message));
  }, [ready, isParent, children]);

  if (isParent) {
    return (
      <PageChrome icon="fa-light fa-bus" crumbs={[{ label: "Bus Tracking" }]}>
        <div className="print:hidden">
          <StudentPanelHead title="Bus Tracking" hint="Live status for each linked child’s assigned bus." />
          {error || portalError ? <p className="mb-3 text-sm text-red-600">{error || portalError}</p> : null}
          {parentViews.length ? (
            <div className="mb-3 flex justify-end">
              <button className="esk-btn-primary" type="button" onClick={() => window.print()}>
                <i className="fa-light fa-print" /> Print
              </button>
            </div>
          ) : null}
        </div>
        {!parentViews.length ? (
          <div className="esk-empty">
            <div><i className="fa-light fa-bus" /></div>
            <h5>No Bus Assigned</h5>
            <p>When the school assigns a stop, the running trip appears here.</p>
          </div>
        ) : (
          <article className="esk-report-doc">
            <header className="esk-letter-head">
              {institute?.logoUrl ? <img alt="" src={institute.logoUrl} /> : <i className="fa-light fa-bus text-2xl text-[var(--esk-purple)]" />}
              <div>
                <h2>Bus tracking status</h2>
                <p>{institute?.name ?? "School"} · {parentViews.length} child{parentViews.length === 1 ? "" : "ren"}</p>
              </div>
            </header>
            <table className="esk-receipt-table">
              <thead>
                <tr>
                  <th>Child</th>
                  <th>Bus</th>
                  <th>Stop</th>
                  <th>Trip</th>
                  <th>ETA</th>
                </tr>
              </thead>
              <tbody>
                {parentViews.map((view) => (
                  <tr key={view.studentId}>
                    <td>{view.name}</td>
                    <td>{view.assigned ? `${view.vehicle?.name ?? "—"} · ${view.vehicle?.plate ?? ""}` : "Not assigned"}</td>
                    <td>{view.assigned ? (view.stop?.name ?? "—") : "—"}</td>
                    <td>{view.assigned ? (view.trip ?? "—") : "—"}</td>
                    <td>{view.assigned ? `${view.etaMinutes ?? "—"} min` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </PageChrome>
    );
  }

  async function saveParentSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await api("/gps/settings", { method: "PATCH", body: JSON.stringify({ notifySms: new FormData(event.currentTarget).get("notifySms") === "on" }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function save(path: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      setNote("Saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function moveStop(route: RouteRow, index: number, delta: number) {
    const ids = route.stops.map((stop) => stop.id);
    const next = index + delta;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setError("");
    try {
      await api(`/gps/routes/${route.id}/stops`, { method: "PATCH", body: JSON.stringify({ stopIds: ids }) });
      setNote("Stop order saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reorder the stops");
    }
  }

  async function placeStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStop) return;
    const data = new FormData(event.currentTarget);
    const latitude = Number(data.get("latitude"));
    const longitude = Number(data.get("longitude"));
    setError("");
    try {
      await api(`/gps/stops/${selectedStop.id}`, { method: "PATCH", body: JSON.stringify({ latitude, longitude }) });
      setSelectedStop({ ...selectedStop, latitude, longitude });
      setNote("Stop placed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the stop");
    }
  }

  const focused = home?.vehicles.find((vehicle) => vehicle.last) ?? home?.vehicles[0];
  const shown = selectedStop ?? points[cursor] ?? (focused?.last ? { latitude: focused.last.latitude, longitude: focused.last.longitude } : null);
  const map = shown
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${shown.longitude - 0.02}%2C${shown.latitude - 0.02}%2C${shown.longitude + 0.02}%2C${shown.latitude + 0.02}&layer=mapnik&marker=${shown.latitude}%2C${shown.longitude}`
    : "";

  return (
    <PageChrome
      icon="fa-light fa-location-dot"
      crumbs={[{ label: "Devices", href: "/admin/rfid" }, { label: "GPS Tracking" }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link className="esk-btn-ghost" href="/admin/gps/drive">Driver</Link>
          <button className="esk-btn-primary" type="button" onClick={() => {
            api<{ filename: string; csv: string; truncated?: boolean }>("/gps/export").then((file) => {
              const link = document.createElement("a");
              link.href = URL.createObjectURL(new Blob([file.csv], { type: "text/csv" }));
              link.download = file.filename;
              link.click();
              setNote(file.truncated ? "Exported the newest 10,000 location points." : "Location history exported.");
            }).catch((err: Error) => setError(err.message));
          }}><i className="fa-light fa-download" /> Export</button>
        </div>
      }
    >
      <div className="space-y-4">
      <p className="max-w-2xl text-sm text-[var(--esk-muted)]">A parent sees only their child’s bus during a running trip. A bus location does not mark the student present at school. Location is kept for {home?.settings.retentionDays ?? 90} days.</p>
      <form className="grid gap-3 esk-panel md:grid-cols-3" onSubmit={(event) => save("/gps/vehicles", event)}>
        <h2 className="font-semibold md:col-span-3">Vehicle</h2>
        <Field label="Name"><input className={control} name="name" required /></Field>
        <Field label="Plate"><input className={control} name="plate" required /></Field>
        <Field label="Type">
          <select className={control} name="type" defaultValue="bus"><option value="bus">Bus</option><option value="van">Van</option><option value="other">Other</option></select>
        </Field>
        <Field label="Capacity"><input className={control} name="capacity" type="number" min="1" required /></Field>
        <Field label="Tracker"><input className={control} name="trackerId" placeholder="Device id or driver phone" /></Field>
        <Field label="Driver">
          <select className={control} name="driverId" defaultValue=""><option value="">Unassigned</option>{drivers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
        </Field>
        <button className="esk-btn-primary self-end">Add vehicle</button>
      </form>
      <form className="grid gap-3 esk-panel md:grid-cols-3" onSubmit={(event) => save("/gps/routes", event)}>
        <h2 className="font-semibold md:col-span-3">Route</h2>
        <Field label="Name"><input className={control} name="name" required /></Field>
        <Field label="Vehicle">
          <select className={control} name="vehicleId" required defaultValue="">{home?.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select>
        </Field>
        <Field label="Driver">
          <select className={control} name="driverId" defaultValue=""><option value="">Unassigned</option>{drivers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
        </Field>
        <button className="esk-btn-primary self-end">Add route</button>
      </form>
      <form className="grid gap-3 esk-panel md:grid-cols-4" onSubmit={(event) => save("/gps/stops", event)}>
        <h2 className="font-semibold md:col-span-4">Stop</h2>
        <Field label="Route">
          <select className={control} name="routeId" required defaultValue="">{home?.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select>
        </Field>
        <Field label="Name"><input className={control} name="name" required /></Field>
        <Field label="Latitude"><input className={control} name="latitude" required /></Field>
        <Field label="Longitude"><input className={control} name="longitude" required /></Field>
        <button className="esk-btn-primary self-end">Add stop</button>
      </form>
      <form className="grid gap-3 esk-panel md:grid-cols-3" onSubmit={(event) => save("/gps/assignments", event)}>
        <h2 className="font-semibold md:col-span-3">Student stop</h2>
        <Field label="Stop">
          <select className={control} name="stopId" required defaultValue="">
            {home?.routes.flatMap((route) => route.stops.map((stop) => <option key={stop.id} value={stop.id}>{route.name} · {stop.name}</option>))}
          </select>
        </Field>
        <Field label="Student">
          <select className={control} name="studentId" required defaultValue="">{students.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
        </Field>
        <button className="esk-btn-primary self-end">Assign</button>
      </form>
      <form className="grid gap-3 esk-panel md:grid-cols-3" onSubmit={(event) => save("/gps/trips", event)}>
        <h2 className="font-semibold md:col-span-3">Trip</h2>
        <Field label="Route">
          <select className={control} name="routeId" required defaultValue="">{home?.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select>
        </Field>
        <Field label="Date"><input className={control} name="tripDate" type="date" required defaultValue={today()} /></Field>
        <Field label="Planned start"><input className={control} name="plannedStart" type="time" required defaultValue="07:00" /></Field>
        <button className="esk-btn-primary self-end">Schedule trip</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="esk-panel text-sm">
          <h2 className="font-semibold">Live map</h2>
          <p className="mt-1 text-[var(--esk-muted)]">Speed limit {home?.settings.speedLimitKmh ?? 50} km/h. Off route after {home?.settings.corridorMetres ?? 150} metres. A vehicle with no point for 3 minutes is stale. Parent arrival messages {home?.settings.notifySms ? "on" : "off"}. A text goes only to the parent of a child at that stop.</p>
          <form className="mt-2 flex items-center gap-3" key={String(home?.settings.notifySms)} onSubmit={saveParentSms}>
            <label className="flex items-center gap-2"><input name="notifySms" type="checkbox" defaultChecked={home?.settings.notifySms === true} /> Text a parent when the bus arrives at their child's stop</label>
            <button className="text-[var(--esk-purple)]">Save</button>
          </form>
          {map ? <iframe className="mt-3 h-64 w-full rounded-xl" title="Live map" src={map} /> : <p className="mt-3">No location yet.</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Speed</th>
                  <th>Stop</th>
                  <th>Next</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(home?.vehicles ?? []).map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.name} · {vehicle.plate}</td>
                    <td>{vehicle.last ? `${vehicle.last.speed ?? 0} km/h · ${vehicle.last.stale ? "stale" : "live"}` : "no point"}</td>
                    <td>{vehicle.currentStop ? `at ${vehicle.currentStop}` : "between stops"}</td>
                    <td>{vehicle.nextStop || "—"}</td>
                    <td className="text-right">
                      {vehicle.trip ? (
                        <button className="esk-btn-ghost" type="button" onClick={() => void api(`/gps/trips/${vehicle.trip?.id}/end`, { method: "POST", body: "{}" }).then(load)}>End</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="esk-panel text-sm">
          <h2 className="font-semibold">Route editor</h2>
          <ul className="mt-2">
            {home?.routes.map((route) => (
              <li key={route.id} className="mt-2">
                {route.name} · {route.driver || "no driver"}
                <ul>
                  {route.stops.map((stop, index) => (
                    <li key={stop.id} className="mt-1">
                      <button className="text-left" onClick={() => setSelectedStop(stop)} type="button">{index + 1}. {stop.name} · {stop.students} {stop.students === 1 ? "student" : "students"}</button>
                      <button className="ml-2 text-[var(--esk-purple)] disabled:opacity-40" disabled={index === 0} onClick={() => void moveStop(route, index, -1)} type="button">Earlier</button>
                      <button className="ml-2 text-[var(--esk-purple)] disabled:opacity-40" disabled={index === route.stops.length - 1} onClick={() => void moveStop(route, index, 1)} type="button">Later</button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {selectedStop ? (
            <form key={selectedStop.id} className="mt-3 grid gap-2" onSubmit={placeStop}>
              <p className="font-semibold">Place {selectedStop.name}</p>
              <Field label="Latitude"><input className={control} name="latitude" defaultValue={selectedStop.latitude} required /></Field>
              <Field label="Longitude"><input className={control} name="longitude" defaultValue={selectedStop.longitude} required /></Field>
              <button className="esk-btn-primary">Place stop</button>
            </form>
          ) : <p className="mt-2 text-[var(--esk-muted)]">Choose a stop to show it on the map.</p>}
          <div className="mt-3 overflow-x-auto">
            <table className="esk-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(home?.trips ?? []).map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.date}</td>
                    <td>{trip.plannedStart}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        trip.status === "running"
                          ? "bg-[var(--esk-teal)]/15 text-[var(--esk-teal)]"
                          : trip.status === "scheduled"
                            ? "bg-[var(--esk-purple)]/15 text-[var(--esk-purple)]"
                            : "bg-[var(--esk-bg)] text-[var(--esk-muted)]"
                      }`}>{trip.status}</span>
                    </td>
                    <td className="text-right">
                      {trip.status === "scheduled" ? (
                        <button className="esk-btn-ghost" type="button" onClick={() => void api(`/gps/trips/${trip.id}/start`, { method: "POST", body: "{}" }).then(load)}>Start</button>
                      ) : null}
                      <button className="esk-btn-ghost ml-1" type="button" onClick={() => void api<Point[]>(`/gps/trips/${trip.id}/points`).then((rows) => { setPoints(rows); setCursor(0); })}>Playback</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {points.length ? <input className="mt-3 w-full" type="range" min={0} max={points.length - 1} value={cursor} onChange={(event) => setCursor(Number(event.target.value))} /> : null}
        </div>
      </div>
      <DataCard>
        <p className="mb-2 px-1 text-sm font-semibold">Alerts</p>
        {!home?.alerts.length ? (
          <div className="esk-empty"><div><i className="fa-light fa-bell" /></div><h5>No Alerts</h5><p>Speed, corridor, and SOS events appear here.</p></div>
        ) : (
          <table className="esk-table">
            <thead><tr><th>Kind</th><th>Message</th></tr></thead>
            <tbody>
              {home.alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.kind}</td>
                  <td>{alert.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataCard>
      <form className="max-w-md esk-panel" onSubmit={(event) => { event.preventDefault(); const id = String(new FormData(event.currentTarget).get("studentId")); api<Parent>(`/gps/parent?studentId=${id}`).then(setParent); }}>
        <h2 className="font-semibold">What the parent sees</h2>
        <Field label="Student"><select className={control} name="studentId" required defaultValue="">{students.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
        <button className="esk-btn-primary">Open</button>
        {parent ? <p className="mt-3 text-sm">{parent.assigned ? `${parent.name} · ${parent.vehicle?.name} ${parent.vehicle?.plate} · stop ${parent.stop?.name} · ${parent.trip} · ETA ${parent.etaMinutes ?? "—"} min` : `${parent.name} is not assigned to a bus.`}</p> : null}
      </form>
      {note ? <p className="text-sm text-[var(--esk-purple)]">{note}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </PageChrome>
  );
}
