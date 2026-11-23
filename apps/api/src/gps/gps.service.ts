import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  employees,
  gpsAlerts,
  gpsSettings,
  locationPoints,
  routeAssignments,
  routeStops,
  routes,
  smsAccounts,
  smsMessages,
  smsOptOuts,
  students,
  trips,
  vehicles,
  type Database,
} from "@nepatronix/db";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";
import { DB } from "../db/db.module";
import { AuditService, type Actor } from "../audit/audit.service";
import { PlanService } from "../plan/plan.service";

const types = ["bus", "van", "other"] as const;

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${label} is required`);
  return value.trim();
}

function numberValue(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${label} must be a number`);
  return parsed;
}

function dayKey(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earth = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}

function corridorDistance(lat: number, lng: number, stops: Array<{ latitude: number; longitude: number }>) {
  if (stops.length === 0) return Number.POSITIVE_INFINITY;
  if (stops.length === 1) return distanceMetres(lat, lng, stops[0].latitude, stops[0].longitude);
  const lat0 = (lat * Math.PI) / 180;
  const xy = (pointLat: number, pointLng: number) => ({
    x: pointLng * Math.cos(lat0) * 111320,
    y: pointLat * 110540,
  });
  const point = xy(lat, lng);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < stops.length; index += 1) {
    const start = xy(stops[index - 1].latitude, stops[index - 1].longitude);
    const end = xy(stops[index].latitude, stops[index].longitude);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = dx * dx + dy * dy || 1;
    const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
    nearest = Math.min(nearest, Math.hypot(point.x - (start.x + progress * dx), point.y - (start.y + progress * dy)));
  }
  return nearest;
}

@Injectable()
export class GpsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly plan: PlanService,
  ) {}

  async exportHistory(tenantId: string, actor: Actor) {
    const rows = await this.db
      .select({
        vehicle: vehicles.name,
        recordedAt: locationPoints.deviceTime,
        latitude: locationPoints.latitude,
        longitude: locationPoints.longitude,
        speed: locationPoints.speed,
      })
      .from(locationPoints)
      .innerJoin(vehicles, eq(vehicles.id, locationPoints.vehicleId))
      .where(eq(locationPoints.tenantId, tenantId))
      .orderBy(asc(locationPoints.deviceTime));
    const line = (cells: string[]) => cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",");
    const csv = [
      line(["Vehicle", "Recorded at", "Latitude", "Longitude", "Speed"]),
      ...rows.map((row) => line([
        row.vehicle,
        new Date(row.recordedAt).toISOString(),
        String(row.latitude),
        String(row.longitude),
        row.speed === null ? "" : String(row.speed),
      ])),
    ].join("\r\n");
    await this.audit.record(tenantId, actor, "location_exported", `Exported ${rows.length} location points.`);
    return { filename: "locations.csv", csv, count: rows.length };
  }

  async deleteHistory(user: AuthUser) {
    if (user.role !== "admin") throw new ForbiddenException("Only an admin can delete location history.");
    const rows = await this.db.delete(locationPoints).where(eq(locationPoints.tenantId, user.tenantId)).returning({ id: locationPoints.id });
    await this.audit.record(user.tenantId, user, "location_deleted", `Deleted ${rows.length} location points.`);
    return { deleted: rows.length };
  }

  async home(tenantId: string) {
    const settings = await this.settings(tenantId);
    const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000);
    await this.db.delete(locationPoints).where(and(eq(locationPoints.tenantId, tenantId), lt(locationPoints.receivedAt, cutoff)));
    const fleet = await this.db.select().from(vehicles).where(eq(vehicles.tenantId, tenantId)).orderBy(asc(vehicles.name));
    const routeRows = await this.db.select().from(routes).where(eq(routes.tenantId, tenantId)).orderBy(asc(routes.name));
    const stops = await this.db.select().from(routeStops).where(eq(routeStops.tenantId, tenantId)).orderBy(asc(routeStops.sortOrder));
    const assignments = await this.db.select().from(routeAssignments).where(eq(routeAssignments.tenantId, tenantId));
    const tripRows = await this.db.select().from(trips).where(eq(trips.tenantId, tenantId)).orderBy(desc(trips.tripDate));
    const people = await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.tenantId, tenantId));
    const names = new Map(people.map((person) => [person.id, person.name]));
    await this.noteLateTrips(tenantId, tripRows);
    await this.noteOffline(tenantId, fleet, tripRows);
    const alerts = await this.db.select().from(gpsAlerts).where(eq(gpsAlerts.tenantId, tenantId)).orderBy(desc(gpsAlerts.createdAt)).limit(20);
    const live = [];
    for (const vehicle of fleet) {
      const [point] = await this.db
        .select()
        .from(locationPoints)
        .where(and(eq(locationPoints.tenantId, tenantId), eq(locationPoints.vehicleId, vehicle.id)))
        .orderBy(desc(locationPoints.receivedAt))
        .limit(1);
      const trip = tripRows.find((row) => row.vehicleId === vehicle.id && row.status === "running") ?? null;
      const routeStopsForTrip = trip ? stops.filter((stop) => stop.routeId === trip.routeId) : [];
      const placed = point ? this.place(point.latitude, point.longitude, routeStopsForTrip) : { current: null, next: null };
      const ageSeconds = point ? Math.round((Date.now() - point.receivedAt.getTime()) / 1000) : null;
      live.push({
        id: vehicle.id,
        name: vehicle.name,
        plate: vehicle.plate,
        type: vehicle.type,
        capacity: vehicle.capacity,
        trackerId: vehicle.trackerId,
        driver: vehicle.driverId ? names.get(vehicle.driverId) ?? "" : "",
        status: vehicle.status,
        trip: trip ? { id: trip.id, status: trip.status, plannedStart: trip.plannedStart } : null,
        last: point
          ? { latitude: point.latitude, longitude: point.longitude, speed: point.speed, ageSeconds, stale: ageSeconds !== null && ageSeconds > 180 }
          : null,
        currentStop: placed.current?.name ?? null,
        nextStop: placed.next?.name ?? null,
      });
    }
    return {
      settings,
      vehicles: live,
      routes: routeRows.map((route) => ({
        id: route.id,
        name: route.name,
        vehicleId: route.vehicleId,
        driver: route.driverId ? names.get(route.driverId) ?? "" : "",
        stops: stops
          .filter((stop) => stop.routeId === route.id)
          .map((stop) => ({
            id: stop.id,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
            radiusMetres: stop.radiusMetres,
            students: assignments.filter((row) => row.stopId === stop.id).length,
          })),
      })),
      trips: tripRows.slice(0, 20).map((trip) => ({
        id: trip.id,
        routeId: trip.routeId,
        vehicleId: trip.vehicleId,
        date: trip.tripDate,
        plannedStart: trip.plannedStart,
        status: trip.status,
      })),
      alerts: alerts.map((alert) => ({ id: alert.id, kind: alert.kind, message: alert.message })),
    };
  }

  async addVehicle(tenantId: string, body: Record<string, unknown>) {
    const type = required(body.type, "Type");
    if (!types.includes(type as (typeof types)[number])) throw new BadRequestException("Choose a vehicle type");
    await this.plan.assertVehicle(tenantId);
    const capacity = numberValue(body.capacity, "Capacity");
    if (capacity < 1) throw new BadRequestException("Capacity must be at least 1");
    const driverId = typeof body.driverId === "string" && body.driverId ? body.driverId : null;
    if (driverId) await this.requireDriver(tenantId, driverId);
    try {
      const [row] = await this.db
        .insert(vehicles)
        .values({
          tenantId,
          name: required(body.name, "Name"),
          plate: required(body.plate, "Plate"),
          type: type as (typeof types)[number],
          capacity,
          trackerId: typeof body.trackerId === "string" && body.trackerId.trim() ? body.trackerId.trim() : null,
          driverId,
        })
        .returning({ id: vehicles.id });
      return row;
    } catch (error) {
      if (this.unique(error)) throw new ConflictException("This plate or tracker is already used.");
      throw error;
    }
  }

  async addRoute(tenantId: string, body: Record<string, unknown>) {
    const vehicleId = required(body.vehicleId, "Vehicle");
    await this.requireVehicle(tenantId, vehicleId);
    const driverId = typeof body.driverId === "string" && body.driverId ? body.driverId : null;
    if (driverId) await this.requireDriver(tenantId, driverId);
    const [row] = await this.db
      .insert(routes)
      .values({ tenantId, name: required(body.name, "Name"), vehicleId, driverId })
      .returning({ id: routes.id });
    return row;
  }

  async addStop(tenantId: string, body: Record<string, unknown>) {
    const routeId = required(body.routeId, "Route");
    const [route] = await this.db.select({ id: routes.id }).from(routes).where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId))).limit(1);
    if (!route) throw new NotFoundException("Route not found");
    const existing = await this.db.select({ sortOrder: routeStops.sortOrder }).from(routeStops).where(eq(routeStops.routeId, routeId));
    const [row] = await this.db
      .insert(routeStops)
      .values({
        tenantId,
        routeId,
        name: required(body.name, "Stop"),
        latitude: numberValue(body.latitude, "Latitude"),
        longitude: numberValue(body.longitude, "Longitude"),
        radiusMetres: body.radiusMetres === undefined || body.radiusMetres === "" ? 80 : numberValue(body.radiusMetres, "Radius"),
        sortOrder: existing.length + 1,
      })
      .returning({ id: routeStops.id });
    return row;
  }

  async reorderStops(tenantId: string, routeId: string, body: Record<string, unknown>) {
    const [route] = await this.db.select({ id: routes.id }).from(routes).where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId))).limit(1);
    if (!route) throw new NotFoundException("Route not found");
    const ids = Array.isArray(body.stopIds) ? body.stopIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
    const stops = await this.db
      .select({ id: routeStops.id })
      .from(routeStops)
      .where(and(eq(routeStops.routeId, routeId), eq(routeStops.tenantId, tenantId)))
      .orderBy(asc(routeStops.sortOrder));
    const current = new Set(stops.map((stop) => stop.id));
    if (!ids.length || ids.length !== current.size || new Set(ids).size !== ids.length || ids.some((id) => !current.has(id))) {
      throw new BadRequestException("Put every stop for this route in the new order.");
    }
    await this.db.transaction(async (tx) => {
      for (let index = 0; index < ids.length; index += 1) {
        await tx.update(routeStops).set({ sortOrder: index + 1 }).where(and(eq(routeStops.id, ids[index]), eq(routeStops.tenantId, tenantId)));
      }
    });
    return { ok: true };
  }

  async placeStop(tenantId: string, stopId: string, body: Record<string, unknown>) {
    const [stop] = await this.db.select({ id: routeStops.id }).from(routeStops).where(and(eq(routeStops.id, stopId), eq(routeStops.tenantId, tenantId))).limit(1);
    if (!stop) throw new NotFoundException("Stop not found");
    const latitude = numberValue(body.latitude, "Latitude");
    const longitude = numberValue(body.longitude, "Longitude");
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new BadRequestException("Choose a point on the map.");
    await this.db.update(routeStops).set({ latitude, longitude }).where(eq(routeStops.id, stopId));
    return { ok: true };
  }

  async assignStudent(tenantId: string, body: Record<string, unknown>) {
    const stopId = required(body.stopId, "Stop");
    const studentId = required(body.studentId, "Student");
    const [stop] = await this.db.select().from(routeStops).where(and(eq(routeStops.id, stopId), eq(routeStops.tenantId, tenantId))).limit(1);
    if (!stop) throw new NotFoundException("Stop not found");
    const [student] = await this.db.select({ id: students.id }).from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).limit(1);
    if (!student) throw new NotFoundException("Student not found");
    try {
      const [row] = await this.db
        .insert(routeAssignments)
        .values({ tenantId, routeId: stop.routeId, stopId, studentId })
        .returning({ id: routeAssignments.id });
      return row;
    } catch (error) {
      if (this.unique(error)) throw new ConflictException("This student is already assigned to a bus stop.");
      throw error;
    }
  }

  async addTrip(tenantId: string, body: Record<string, unknown>) {
    const routeId = required(body.routeId, "Route");
    const [route] = await this.db.select().from(routes).where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId))).limit(1);
    if (!route) throw new NotFoundException("Route not found");
    const [row] = await this.db
      .insert(trips)
      .values({
        tenantId,
        routeId,
        vehicleId: route.vehicleId,
        driverId: route.driverId,
        tripDate: required(body.tripDate, "Date"),
        plannedStart: required(body.plannedStart, "Planned start"),
      })
      .returning({ id: trips.id });
    return row;
  }

  async startTrip(tenantId: string, id: string) {
    const trip = await this.requireTrip(tenantId, id);
    if (trip.status !== "scheduled") throw new ConflictException("Only a scheduled trip can be started.");
    const [running] = await this.db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.tenantId, tenantId), eq(trips.vehicleId, trip.vehicleId), eq(trips.status, "running")))
      .limit(1);
    if (running) throw new ConflictException("This vehicle already has a running trip.");
    await this.db.update(trips).set({ status: "running", startedAt: new Date() }).where(eq(trips.id, id));
    return { ok: true };
  }

  async endTrip(tenantId: string, id: string) {
    const trip = await this.requireTrip(tenantId, id);
    if (trip.status !== "running") throw new ConflictException("Only a running trip can be ended.");
    await this.db.update(trips).set({ status: "completed", endedAt: new Date() }).where(eq(trips.id, id));
    return { ok: true };
  }

  async points(tenantId: string, tripId: string) {
    await this.requireTrip(tenantId, tripId);
    const rows = await this.db
      .select()
      .from(locationPoints)
      .where(and(eq(locationPoints.tenantId, tenantId), eq(locationPoints.tripId, tripId)))
      .orderBy(asc(locationPoints.deviceTime));
    return rows.map((row) => ({
      id: row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      speed: row.speed,
      deviceTime: row.deviceTime,
    }));
  }

  async parentView(user: AuthUser, studentId: string) {
    if (user.role === "parent") {
      const linked = await linkedStudentIds(this.db, user);
      if (!linked.has(studentId)) throw new ForbiddenException("This role cannot open that page.");
    }
    const tenantId = user.tenantId;
    const [student] = await this.db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId)))
      .limit(1);
    if (!student) throw new NotFoundException("Student not found");
    const [assignment] = await this.db
      .select()
      .from(routeAssignments)
      .where(and(eq(routeAssignments.tenantId, tenantId), eq(routeAssignments.studentId, studentId)))
      .limit(1);
    if (!assignment) return { name: student.name, assigned: false };
    const [stop] = await this.db.select().from(routeStops).where(eq(routeStops.id, assignment.stopId)).limit(1);
    const [route] = await this.db.select().from(routes).where(eq(routes.id, assignment.routeId)).limit(1);
    const [vehicle] = await this.db.select().from(vehicles).where(eq(vehicles.id, route.vehicleId)).limit(1);
    const [trip] = await this.db
      .select()
      .from(trips)
      .where(and(eq(trips.tenantId, tenantId), eq(trips.vehicleId, vehicle.id), eq(trips.status, "running")))
      .limit(1);
    const [point] = await this.db
      .select()
      .from(locationPoints)
      .where(eq(locationPoints.vehicleId, vehicle.id))
      .orderBy(desc(locationPoints.receivedAt))
      .limit(1);
    const ageSeconds = point ? Math.round((Date.now() - point.receivedAt.getTime()) / 1000) : null;
    const metres = point && stop ? distanceMetres(point.latitude, point.longitude, stop.latitude, stop.longitude) : null;
    const speed = point?.speed && point.speed > 1 ? point.speed : 20;
    return {
      name: student.name,
      assigned: true,
      stop: stop ? { name: stop.name, latitude: stop.latitude, longitude: stop.longitude } : null,
      vehicle: { name: vehicle.name, plate: vehicle.plate },
      trip: trip ? trip.status : "not running",
      last: point ? { latitude: point.latitude, longitude: point.longitude, speed: point.speed, stale: ageSeconds !== null && ageSeconds > 180 } : null,
      etaMinutes: metres === null ? null : Math.max(1, Math.round((metres / 1000 / speed) * 60)),
    };
  }

  async driverBoard(user: AuthUser) {
    const staff = await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.tenantId, user.tenantId));
    const privileged = user.role === "admin" || user.role === "principal";
    const mine = staff.filter((person) => person.name.trim().toLowerCase() === user.name.trim().toLowerCase());
    const allowed = new Set((privileged ? staff : mine).map((person) => person.id));
    if (!allowed.size) return { assigned: false, message: "No trip is assigned to you.", duties: [] };
    const routeRows = await this.db.select().from(routes).where(eq(routes.tenantId, user.tenantId));
    const vehicleRows = await this.db.select().from(vehicles).where(eq(vehicles.tenantId, user.tenantId));
    const stops = await this.db.select().from(routeStops).where(eq(routeStops.tenantId, user.tenantId)).orderBy(asc(routeStops.sortOrder));
    const assignments = await this.db.select({ stopId: routeAssignments.stopId }).from(routeAssignments).where(eq(routeAssignments.tenantId, user.tenantId));
    const tripRows = await this.db.select().from(trips).where(eq(trips.tenantId, user.tenantId));
    const names = new Map(staff.map((person) => [person.id, person.name]));
    const duties = [];
    for (const route of routeRows) {
      const vehicle = vehicleRows.find((row) => row.id === route.vehicleId);
      const driverId = route.driverId ?? vehicle?.driverId ?? null;
      if (!driverId || !allowed.has(driverId) || !vehicle) continue;
      const trip = tripRows.find((row) => row.vehicleId === vehicle.id && row.status === "running") ?? tripRows.find((row) => row.vehicleId === vehicle.id && row.status === "scheduled") ?? null;
      const [point] = await this.db
        .select({ latitude: locationPoints.latitude, longitude: locationPoints.longitude })
        .from(locationPoints)
        .where(eq(locationPoints.vehicleId, vehicle.id))
        .orderBy(desc(locationPoints.receivedAt))
        .limit(1);
      duties.push({
        driver: names.get(driverId) ?? "",
        vehicle: { name: vehicle.name, plate: vehicle.plate },
        trip: trip ? { id: trip.id, status: trip.status, date: trip.tripDate, plannedStart: trip.plannedStart } : null,
        stops: stops
          .filter((stop) => stop.routeId === route.id)
          .map((stop) => ({ name: stop.name, students: assignments.filter((row) => row.stopId === stop.id).length })),
        last: point ?? null,
      });
    }
    if (!duties.length) return { assigned: false, message: "No trip is assigned to you.", duties: [] };
    return { assigned: true, message: null, duties };
  }

  async driverStart(user: AuthUser, body: Record<string, unknown>) {
    const tripId = await this.driverTrip(user, body);
    return this.startTrip(user.tenantId, tripId);
  }

  async driverEnd(user: AuthUser, body: Record<string, unknown>) {
    const tripId = await this.driverTrip(user, body);
    return this.endTrip(user.tenantId, tripId);
  }

  async driverPoint(user: AuthUser, body: Record<string, unknown>) {
    const trip = await this.requireTrip(user.tenantId, await this.driverTrip(user, body));
    if (trip.status !== "running") throw new BadRequestException("Start the trip before sending a location.");
    const vehicle = await this.driverVehicle(trip.vehicleId);
    return this.ingest({
      trackerId: vehicle.trackerId,
      latitude: body.latitude,
      longitude: body.longitude,
      speed: body.speed ?? 20,
      accuracy: body.accuracy ?? 10,
      deviceTime: new Date().toISOString(),
    });
  }

  async driverSos(user: AuthUser, body: Record<string, unknown>) {
    const trip = await this.requireTrip(user.tenantId, await this.driverTrip(user, body));
    if (trip.status !== "running") throw new BadRequestException("Start the trip before sending an SOS.");
    const vehicle = await this.driverVehicle(trip.vehicleId);
    return this.sos({ trackerId: vehicle.trackerId });
  }

  private async driverTrip(user: AuthUser, body: Record<string, unknown>) {
    const tripId = required(body.tripId, "Trip");
    const board = await this.driverBoard(user);
    if (!board.duties.some((duty) => duty.trip?.id === tripId)) throw new ForbiddenException("This trip is not assigned to you.");
    return tripId;
  }

  private async driverVehicle(vehicleId: string) {
    const [vehicle] = await this.db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!vehicle?.trackerId) throw new BadRequestException("This vehicle has no tracker.");
    return vehicle;
  }

  async ingest(body: Record<string, unknown>) {
    const trackerId = required(body.trackerId, "Tracker");
    const [vehicle] = await this.db.select().from(vehicles).where(eq(vehicles.trackerId, trackerId)).limit(1);
    if (!vehicle) throw new NotFoundException("This tracker is not registered.");
    if (vehicle.status !== "active") throw new ForbiddenException("This vehicle is inactive.");
    const accuracy = body.accuracy === undefined || body.accuracy === "" ? null : numberValue(body.accuracy, "Accuracy");
    if (accuracy !== null && accuracy > 100) return { result: "ignored" };
    const latitude = numberValue(body.latitude, "Latitude");
    const longitude = numberValue(body.longitude, "Longitude");
    const speed = body.speed === undefined || body.speed === "" ? null : numberValue(body.speed, "Speed");
    const heading = body.heading === undefined || body.heading === "" ? null : Math.round(numberValue(body.heading, "Heading"));
    const deviceTime = typeof body.deviceTime === "string" && body.deviceTime ? new Date(body.deviceTime) : new Date();
    if (Number.isNaN(deviceTime.getTime())) throw new BadRequestException("Device time is not a valid time");
    const [previous] = await this.db
      .select()
      .from(locationPoints)
      .where(eq(locationPoints.vehicleId, vehicle.id))
      .orderBy(desc(locationPoints.receivedAt))
      .limit(1);
    const [trip] = await this.db
      .select()
      .from(trips)
      .where(and(eq(trips.tenantId, vehicle.tenantId), eq(trips.vehicleId, vehicle.id), eq(trips.status, "running")))
      .limit(1);
    await this.db.insert(locationPoints).values({
      tenantId: vehicle.tenantId,
      vehicleId: vehicle.id,
      tripId: trip?.id ?? null,
      latitude,
      longitude,
      speed,
      heading,
      accuracy,
      deviceTime,
    });
    await this.reviewPoint(vehicle.tenantId, vehicle.id, trip?.id ?? null, trip?.routeId ?? null, latitude, longitude, speed, deviceTime, previous);
    return { result: "stored" };
  }

  async sos(body: Record<string, unknown>) {
    const trackerId = required(body.trackerId, "Tracker");
    const [vehicle] = await this.db.select().from(vehicles).where(eq(vehicles.trackerId, trackerId)).limit(1);
    if (!vehicle) throw new NotFoundException("This tracker is not registered.");
    const [trip] = await this.db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.vehicleId, vehicle.id), eq(trips.status, "running")))
      .limit(1);
    await this.db.insert(gpsAlerts).values({
      tenantId: vehicle.tenantId,
      vehicleId: vehicle.id,
      tripId: trip?.id ?? null,
      kind: "sos",
      message: `${vehicle.name} sent an SOS.`,
    });
    return { result: "sos" };
  }

  private async reviewPoint(
    tenantId: string,
    vehicleId: string,
    tripId: string | null,
    routeId: string | null,
    latitude: number,
    longitude: number,
    speed: number | null,
    deviceTime: Date,
    previous: typeof locationPoints.$inferSelect | undefined,
  ) {
    const settings = await this.settings(tenantId);
    const gapSeconds = previous ? (deviceTime.getTime() - previous.deviceTime.getTime()) / 1000 : 0;
    if (speed !== null && speed > settings.speedLimitKmh && previous?.speed !== null && previous?.speed !== undefined && previous.speed > settings.speedLimitKmh && gapSeconds >= 15 && gapSeconds <= 300) {
      if (!(await this.recentAlert(tenantId, vehicleId, "speeding", 120000))) {
        await this.alert(tenantId, vehicleId, tripId, "speeding", `Speed stayed above ${settings.speedLimitKmh} km/h.`);
      }
    }
    if (routeId) {
      const stops = await this.db.select().from(routeStops).where(eq(routeStops.routeId, routeId)).orderBy(asc(routeStops.sortOrder));
      const away = corridorDistance(latitude, longitude, stops);
      const wasAway = previous ? corridorDistance(previous.latitude, previous.longitude, stops) > settings.corridorMetres : false;
      if (away > settings.corridorMetres && wasAway && gapSeconds >= 60 && !(await this.recentAlert(tenantId, vehicleId, "off_route", 120000))) {
        await this.alert(tenantId, vehicleId, tripId, "off_route", `The vehicle is more than ${settings.corridorMetres} metres off the route.`);
      }
      const here = stops.find((stop) => distanceMetres(latitude, longitude, stop.latitude, stop.longitude) <= stop.radiusMetres);
      const before = previous ? stops.find((stop) => distanceMetres(previous.latitude, previous.longitude, stop.latitude, stop.longitude) <= stop.radiusMetres) : undefined;
      if (here && here.id !== before?.id) {
        await this.alert(tenantId, vehicleId, tripId, "arrival", `Arrived at ${here.name}.`);
        await this.notifyArrival(tenantId, here.id, here.name);
      }
      if (before && before.id !== here?.id) await this.alert(tenantId, vehicleId, tripId, "departure", `Left ${before.name}.`);
    }
  }

  private place(latitude: number, longitude: number, stops: Array<{ name: string; latitude: number; longitude: number; radiusMetres: number; sortOrder: number }>) {
    const currentIndex = stops.findIndex((stop) => distanceMetres(latitude, longitude, stop.latitude, stop.longitude) <= stop.radiusMetres);
    if (currentIndex >= 0) return { current: stops[currentIndex], next: stops[currentIndex + 1] ?? null };
    const next = [...stops].sort((a, b) => distanceMetres(latitude, longitude, a.latitude, a.longitude) - distanceMetres(latitude, longitude, b.latitude, b.longitude))[0] ?? null;
    return { current: null, next };
  }

  private async noteLateTrips(tenantId: string, tripRows: Array<typeof trips.$inferSelect>) {
    const now = new Date();
    const today = dayKey(now);
    for (const trip of tripRows) {
      if (trip.status !== "scheduled" || trip.tripDate !== today) continue;
      const [hour, minute] = trip.plannedStart.split(":").map(Number);
      const planned = new Date(now);
      planned.setHours(hour || 0, minute || 0, 0, 0);
      if (now.getTime() - planned.getTime() < 10 * 60 * 1000) continue;
      const [existing] = await this.db.select({ id: gpsAlerts.id }).from(gpsAlerts).where(and(eq(gpsAlerts.tripId, trip.id), eq(gpsAlerts.kind, "late"))).limit(1);
      if (!existing) await this.alert(tenantId, trip.vehicleId, trip.id, "late", "Trip not started 10 minutes after the planned time.");
    }
  }

  private async noteOffline(tenantId: string, fleet: Array<typeof vehicles.$inferSelect>, tripRows: Array<typeof trips.$inferSelect>) {
    for (const trip of tripRows.filter((row) => row.status === "running")) {
      const vehicle = fleet.find((row) => row.id === trip.vehicleId);
      if (!vehicle) continue;
      const [point] = await this.db.select({ receivedAt: locationPoints.receivedAt }).from(locationPoints).where(eq(locationPoints.vehicleId, vehicle.id)).orderBy(desc(locationPoints.receivedAt)).limit(1);
      if (point && Date.now() - point.receivedAt.getTime() <= 3 * 60 * 1000) continue;
      if (!(await this.recentAlert(tenantId, vehicle.id, "offline", 10 * 60 * 1000))) {
        await this.alert(tenantId, vehicle.id, trip.id, "offline", `${vehicle.name} has no location during a running trip.`);
      }
    }
  }

  private async alert(tenantId: string, vehicleId: string | null, tripId: string | null, kind: string, message: string) {
    await this.db.insert(gpsAlerts).values({ tenantId, vehicleId, tripId, kind, message });
  }

  private async notifyArrival(tenantId: string, stopId: string, stopName: string) {
    const settings = await this.settings(tenantId);
    if (!settings.notifySms) return;
    const people = await this.db
      .select({ smsPhone: students.smsPhone, fatherMobile: students.fatherMobile, motherMobile: students.motherMobile })
      .from(routeAssignments)
      .innerJoin(students, eq(students.id, routeAssignments.studentId))
      .where(and(eq(routeAssignments.tenantId, tenantId), eq(routeAssignments.stopId, stopId)));
    for (const person of people) {
      const phone = person.smsPhone || person.fatherMobile || person.motherMobile;
      if (!phone) continue;
      const body = `Arrived at ${stopName}.`;
      const [opted] = await this.db.select({ id: smsOptOuts.id }).from(smsOptOuts).where(and(eq(smsOptOuts.tenantId, tenantId), eq(smsOptOuts.phone, phone))).limit(1);
      if (opted) {
        await this.db.insert(smsMessages).values({ tenantId, phone, body, kind: "arrival", status: "opted_out" });
        continue;
      }
      const [account] = await this.db.select().from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1);
      if (!account || account.balance < 1) return;
      await this.db.update(smsAccounts).set({ balance: account.balance - 1 }).where(eq(smsAccounts.tenantId, tenantId));
      await this.db.insert(smsMessages).values({ tenantId, phone, body, kind: "arrival", status: "not_sent" });
    }
  }

  async saveParentSms(user: AuthUser, body: Record<string, unknown>) {
    if (user.role !== "admin" && user.role !== "principal") throw new ForbiddenException("This role cannot open that page.");
    await this.settings(user.tenantId);
    await this.db.update(gpsSettings).set({ notifySms: body.notifySms === true }).where(eq(gpsSettings.tenantId, user.tenantId));
    return { ok: true };
  }

  private async recentAlert(tenantId: string, vehicleId: string, kind: string, withinMs: number) {
    const [row] = await this.db
      .select({ id: gpsAlerts.id })
      .from(gpsAlerts)
      .where(and(eq(gpsAlerts.tenantId, tenantId), eq(gpsAlerts.vehicleId, vehicleId), eq(gpsAlerts.kind, kind), gte(gpsAlerts.createdAt, new Date(Date.now() - withinMs))))
      .limit(1);
    return Boolean(row);
  }

  private async settings(tenantId: string) {
    const [row] = await this.db.select().from(gpsSettings).where(eq(gpsSettings.tenantId, tenantId)).limit(1);
    if (row) return row;
    const [created] = await this.db.insert(gpsSettings).values({ tenantId }).returning();
    return created;
  }

  private async requireVehicle(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Vehicle not found");
  }

  private async requireDriver(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, id), eq(employees.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Driver not found");
  }

  private async requireTrip(tenantId: string, id: string) {
    const [row] = await this.db.select().from(trips).where(and(eq(trips.id, id), eq(trips.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Trip not found");
    return row;
  }

  private unique(error: unknown) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code === "23505" || (error as { code?: string }).code === "23505";
  }
}
