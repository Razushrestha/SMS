import { createHash, randomBytes } from "crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  attendanceRecords,
  classes,
  employees,
  rfidCards,
  rfidReaders,
  rfidSettings,
  rfidTaps,
  smsAccounts,
  smsMessages,
  students,
  type Database,
} from "@nepatronix/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { DB } from "../db/db.module";
import { AuditService, type Actor } from "../audit/audit.service";
import { MessagesService } from "../messages/messages.service";
import { PlanService } from "../plan/plan.service";

const locations = ["campus", "gate", "building", "room", "bus"] as const;
const directions = ["in", "out", "both"] as const;

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${label} is required`);
  return value.trim();
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parts(date: Date) {
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function today() {
  return parts(new Date()).day;
}

@Injectable()
export class RfidService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly plan: PlanService,
    private readonly messages: MessagesService,
  ) {}

  async home(tenantId: string) {
    const settings = await this.settings(tenantId);
    const readers = await this.db.select().from(rfidReaders).where(eq(rfidReaders.tenantId, tenantId)).orderBy(rfidReaders.name);
    const day = today();
    const taps = await this.db.select().from(rfidTaps).where(eq(rfidTaps.tenantId, tenantId));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return {
      settings,
      readers: readers.map((reader) => ({
        id: reader.id,
        name: reader.name,
        serial: reader.serial,
        location: reader.location,
        direction: reader.direction,
        status: this.liveStatus(reader.status, reader.lastSeenAt),
        lastSeenAt: reader.lastSeenAt,
        tapsToday: taps.filter((tap) => tap.readerId === reader.id && tap.tappedAt >= start).length,
      })),
      cards: await this.cards(tenantId),
      feed: await this.feed(tenantId),
      exceptions: taps
        .filter((tap) => ["unknown", "blocked", "lost", "duplicate", "edited"].includes(tap.result))
        .sort((a, b) => b.tappedAt.getTime() - a.tappedAt.getTime())
        .slice(0, 30),
      cutoffPassed: this.pastCutoff(settings.dayStart, settings.cutoffMinutes),
      day,
    };
  }

  async addReader(tenantId: string, body: Record<string, unknown>) {
    const location = required(body.location, "Location");
    const direction = required(body.direction, "Direction");
    if (!locations.includes(location as (typeof locations)[number])) throw new BadRequestException("Choose a location");
    if (!directions.includes(direction as (typeof directions)[number])) throw new BadRequestException("Choose a direction");
    await this.plan.assertReader(tenantId);
    const secret = randomBytes(12).toString("hex");
    try {
      const [row] = await this.db.insert(rfidReaders).values({
        tenantId,
        name: required(body.name, "Reader name"),
        serial: required(body.serial, "Serial"),
        secretHash: hashSecret(secret),
        location: location as (typeof locations)[number],
        direction: direction as (typeof directions)[number],
      }).returning({ id: rfidReaders.id, name: rfidReaders.name });
      return { ...row, secret };
    } catch (error) {
      if (this.unique(error)) throw new ConflictException("This reader serial is already used.");
      throw error;
    }
  }

  async setReader(tenantId: string, id: string, status: "active" | "disabled") {
    const [row] = await this.db.select({ id: rfidReaders.id }).from(rfidReaders).where(and(eq(rfidReaders.id, id), eq(rfidReaders.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Reader not found");
    await this.db.update(rfidReaders).set({ status }).where(eq(rfidReaders.id, id));
    return { ok: true };
  }

  async addCard(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const uid = required(body.uid, "Card UID");
    const studentId = typeof body.studentId === "string" && body.studentId ? body.studentId : null;
    const employeeId = typeof body.employeeId === "string" && body.employeeId ? body.employeeId : null;
    if (studentId && employeeId) throw new BadRequestException("Assign the card to one person");
    await this.plan.assertCard(tenantId);
    const student = studentId ? await this.requireStudent(tenantId, studentId) : null;
    const employee = employeeId ? await this.requireEmployee(tenantId, employeeId) : null;
    const status = student || employee ? "active" : "spare";
    try {
      const [row] = await this.db.insert(rfidCards).values({
        tenantId,
        uid,
        studentId,
        employeeId,
        status,
        issuedOn: status === "active" ? today() : null,
      }).returning();
      if (student || employee) {
        await this.audit.record(tenantId, actor, "card_assigned", `Card ${uid} assigned to ${student?.name ?? employee?.name}.`);
      }
      return row;
    } catch (error) {
      if (this.unique(error)) throw new ConflictException("This card UID is already in the institute.");
      throw error;
    }
  }

  async blockCard(tenantId: string, id: string) {
    const card = await this.requireCard(tenantId, id);
    await this.db.update(rfidCards).set({ status: "blocked", returnedOn: today() }).where(eq(rfidCards.id, card.id));
    return { ok: true };
  }

  async replaceCard(tenantId: string, id: string, body: Record<string, unknown>, actor: Actor) {
    const card = await this.requireCard(tenantId, id);
    const uid = required(body.uid, "Card UID");
    await this.db.update(rfidCards).set({ status: "blocked", returnedOn: today() }).where(eq(rfidCards.id, card.id));
    return this.addCard(tenantId, { uid, studentId: card.studentId, employeeId: card.employeeId }, actor);
  }

  async removeCard(tenantId: string, id: string) {
    const card = await this.requireCard(tenantId, id);
    const [tap] = await this.db.select({ id: rfidTaps.id }).from(rfidTaps).where(eq(rfidTaps.cardId, card.id)).limit(1);
    if (tap) throw new ConflictException("This card has taps. Block it instead of deleting it.");
    await this.db.delete(rfidCards).where(eq(rfidCards.id, card.id));
    return { ok: true };
  }

  async personView(tenantId: string, studentId: string) {
    const student = await this.requireStudent(tenantId, studentId);
    const rows = await this.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.studentId, studentId)));
    const day = today();
    const current = rows.find((row) => row.attendanceDate === day);
    const month = day.slice(0, 7);
    return {
      name: student.name,
      className: student.className,
      today: current ? { status: current.status, inTime: current.markedTime, outTime: current.outTime } : { status: "not marked", inTime: null, outTime: null },
      month: rows.filter((row) => row.attendanceDate.startsWith(month)).map((row) => ({ date: row.attendanceDate, status: row.status, inTime: row.markedTime, outTime: row.outTime })),
    };
  }

  async saveSettings(tenantId: string, body: Record<string, unknown>) {
    const cutoff = Number(body.cutoffMinutes);
    if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 180) throw new BadRequestException("Cutoff must be from 0 to 180 minutes");
    const dayStart = required(body.dayStart, "Day start");
    if (!/^\d{2}:\d{2}$/.test(dayStart)) throw new BadRequestException("Day start must be a time");
    await this.settings(tenantId);
    await this.db.update(rfidSettings).set({
      dayStart,
      cutoffMinutes: cutoff,
      notifyParents: body.notifyParents === true,
    }).where(eq(rfidSettings.tenantId, tenantId));
    return { ok: true };
  }

  async applyCutoff(tenantId: string) {
    const settings = await this.settings(tenantId);
    if (!this.pastCutoff(settings.dayStart, settings.cutoffMinutes)) return { marked: 0, message: "The cutoff has not passed." };
    const day = today();
    const people = await this.db.select({ id: students.id }).from(students).where(and(eq(students.tenantId, tenantId), eq(students.status, "active")));
    const staff = await this.db.select({ id: employees.id }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active")));
    const existing = await this.db.select({ studentId: attendanceRecords.studentId, employeeId: attendanceRecords.employeeId }).from(attendanceRecords).where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.attendanceDate, day)));
    const haveStudent = new Set(existing.map((row) => row.studentId).filter(Boolean));
    const haveStaff = new Set(existing.map((row) => row.employeeId).filter(Boolean));
    let marked = 0;
    for (const person of people) {
      if (haveStudent.has(person.id)) continue;
      await this.db.insert(attendanceRecords).values({ tenantId, studentId: person.id, attendanceDate: day, status: "absent", source: "manual", markedTime: "-" });
      marked += 1;
    }
    for (const person of staff) {
      if (haveStaff.has(person.id)) continue;
      await this.db.insert(attendanceRecords).values({ tenantId, employeeId: person.id, attendanceDate: day, status: "absent", source: "manual", markedTime: "-" });
      marked += 1;
    }
    return { marked, message: marked ? `${marked} marked absent.` : "No one was marked absent." };
  }

  async ingest(body: Record<string, unknown>) {
    const serial = required(body.serial, "Serial");
    const secret = required(body.secret, "Reader secret");
    const uid = required(body.uid, "Card UID");
    const [reader] = await this.db.select().from(rfidReaders).where(eq(rfidReaders.serial, serial)).limit(1);
    if (!reader || reader.secretHash !== hashSecret(secret)) throw new UnauthorizedException("Reader secret was not accepted");
    if (reader.status === "disabled") throw new ForbiddenException("This reader is disabled.");
    const tappedAt = body.tappedAt ? new Date(String(body.tappedAt)) : new Date();
    if (Number.isNaN(tappedAt.getTime())) throw new BadRequestException("Tap time is not valid");
    const when = parts(tappedAt);
    const direction = reader.direction === "both" ? (body.direction === "out" ? "out" : "in") : reader.direction;
    await this.db.update(rfidReaders).set({ lastSeenAt: new Date() }).where(eq(rfidReaders.id, reader.id));
    const recent = await this.db.select({ id: rfidTaps.id, tappedAt: rfidTaps.tappedAt }).from(rfidTaps).where(and(eq(rfidTaps.readerId, reader.id), eq(rfidTaps.uid, uid), gte(rfidTaps.tappedAt, new Date(tappedAt.getTime() - 30_000))));
    if (recent.some((tap) => tap.tappedAt <= tappedAt)) {
      await this.storeTap(reader.tenantId, reader.id, null, uid, tappedAt, direction, "duplicate", null);
      return { result: "duplicate" };
    }
    const [card] = await this.db.select().from(rfidCards).where(and(eq(rfidCards.tenantId, reader.tenantId), eq(rfidCards.uid, uid))).limit(1);
    if (!card) {
      await this.storeTap(reader.tenantId, reader.id, null, uid, tappedAt, direction, "unknown", null);
      return { result: "unknown" };
    }
    if (card.status === "blocked" || card.status === "lost" || card.status === "spare") {
      const result = card.status === "spare" ? "unknown" : card.status;
      await this.storeTap(reader.tenantId, reader.id, card.id, uid, tappedAt, direction, result, null);
      return { result };
    }
    const person = card.studentId ? await this.requireStudent(reader.tenantId, card.studentId) : await this.requireEmployee(reader.tenantId, card.employeeId ?? "");
    if (reader.location === "bus") {
      const result = direction === "in" ? "boarded" : "bus";
      await this.storeTap(reader.tenantId, reader.id, card.id, uid, tappedAt, direction, result, person.name);
      return { result };
    }
    const column = card.studentId ? attendanceRecords.studentId : attendanceRecords.employeeId;
    const personId = card.studentId ?? card.employeeId ?? "";
    const [row] = await this.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.tenantId, reader.tenantId), eq(column, personId), eq(attendanceRecords.attendanceDate, when.day))).limit(1);
    if (row?.status === "leave" || row?.editedManually) {
      const result = row.status === "leave" ? "leave" : "edited";
      await this.storeTap(reader.tenantId, reader.id, card.id, uid, tappedAt, direction, result, person.name);
      return { result };
    }
    if (direction === "out") {
      if (row) await this.db.update(attendanceRecords).set({ outTime: when.time, updatedAt: new Date() }).where(eq(attendanceRecords.id, row.id));
      await this.storeTap(reader.tenantId, reader.id, card.id, uid, tappedAt, direction, "out", person.name);
      if (card.studentId) await this.notify(reader.tenantId, card.studentId, "out");
      return { result: "out" };
    }
    if (!row) {
      await this.db.insert(attendanceRecords).values({
        tenantId: reader.tenantId,
        studentId: card.studentId,
        employeeId: card.employeeId,
        attendanceDate: when.day,
        status: "present",
        source: "rfid",
        markedTime: when.time,
      });
    } else if (row.status !== "present") {
      await this.db.update(attendanceRecords).set({ status: "present", source: "rfid", markedTime: when.time, updatedAt: new Date() }).where(eq(attendanceRecords.id, row.id));
    }
    const result = row?.status === "present" ? "seen" : "present";
    await this.storeTap(reader.tenantId, reader.id, card.id, uid, tappedAt, direction, result, person.name);
    if (result === "present" && card.studentId) await this.notify(reader.tenantId, card.studentId, "in");
    return { result };
  }

  private async notify(tenantId: string, studentId: string, kind: "in" | "out") {
    const settings = await this.settings(tenantId);
    if (!settings.notifyParents) return;
    const student = await this.requireStudent(tenantId, studentId);
    const body = kind === "in" ? `${student.name} tapped in.` : `${student.name} tapped out.`;
    await this.messages.leaveStudentNote(tenantId, studentId, body);
    if (!student.smsPhone) return;
    const [account] = await this.db.select().from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1);
    if (!account || account.balance < 1) return;
    await this.db.update(smsAccounts).set({ balance: account.balance - 1 }).where(eq(smsAccounts.tenantId, tenantId));
    await this.db.insert(smsMessages).values({
      tenantId,
      phone: student.smsPhone,
      body,
      kind: "branded",
      status: "not_sent",
    });
  }

  private async feed(tenantId: string) {
    const taps = await this.db
      .select({
        id: rfidTaps.id,
        tappedAt: rfidTaps.tappedAt,
        uid: rfidTaps.uid,
        direction: rfidTaps.direction,
        result: rfidTaps.result,
        personName: rfidTaps.personName,
        readerName: rfidReaders.name,
        studentPhoto: students.photoUrl,
        employeePhoto: employees.photoUrl,
        className: classes.name,
        staffRole: employees.staffRole,
      })
      .from(rfidTaps)
      .innerJoin(rfidReaders, eq(rfidReaders.id, rfidTaps.readerId))
      .leftJoin(rfidCards, eq(rfidCards.id, rfidTaps.cardId))
      .leftJoin(students, eq(students.id, rfidCards.studentId))
      .leftJoin(classes, eq(classes.id, students.classId))
      .leftJoin(employees, eq(employees.id, rfidCards.employeeId))
      .where(eq(rfidTaps.tenantId, tenantId))
      .orderBy(desc(rfidTaps.tappedAt))
      .limit(20);
    return taps.map((tap) => ({
      id: tap.id,
      tappedAt: tap.tappedAt,
      time: tap.tappedAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
      uid: tap.personName ? "" : tap.uid,
      direction: tap.direction,
      result: tap.result,
      personName: tap.personName,
      readerName: tap.readerName,
      photoUrl: tap.studentPhoto ?? tap.employeePhoto ?? null,
      detail: tap.className ?? tap.staffRole ?? "",
    }));
  }

  private async cards(tenantId: string) {
    const rows = await this.db.select({
      id: rfidCards.id,
      uid: rfidCards.uid,
      status: rfidCards.status,
      issuedOn: rfidCards.issuedOn,
      returnedOn: rfidCards.returnedOn,
      studentName: students.name,
      employeeName: employees.name,
    }).from(rfidCards)
      .leftJoin(students, eq(students.id, rfidCards.studentId))
      .leftJoin(employees, eq(employees.id, rfidCards.employeeId))
      .where(eq(rfidCards.tenantId, tenantId))
      .orderBy(rfidCards.uid);
    return rows.map((row) => ({ ...row, person: row.studentName ?? row.employeeName ?? "Unassigned" }));
  }

  private async storeTap(tenantId: string, readerId: string, cardId: string | null, uid: string, tappedAt: Date, direction: string, result: string, personName: string | null) {
    await this.db.insert(rfidTaps).values({ tenantId, readerId, cardId, uid, tappedAt, direction, result, personName });
  }

  private liveStatus(status: string, lastSeenAt: Date | null) {
    if (status === "disabled") return "disabled";
    if (!lastSeenAt || Date.now() - lastSeenAt.getTime() > 10 * 60 * 1000) return "offline";
    return "active";
  }

  private pastCutoff(dayStart: string, minutes: number) {
    const [hour, minute] = dayStart.split(":").map(Number);
    const cutoff = new Date();
    cutoff.setHours(hour, minute + minutes, 0, 0);
    return new Date() > cutoff;
  }

  private async settings(tenantId: string) {
    const [existing] = await this.db.select().from(rfidSettings).where(eq(rfidSettings.tenantId, tenantId)).limit(1);
    if (existing) return existing;
    const [created] = await this.db.insert(rfidSettings).values({ tenantId }).returning();
    return created;
  }

  private async requireCard(tenantId: string, id: string) {
    const [row] = await this.db.select().from(rfidCards).where(and(eq(rfidCards.id, id), eq(rfidCards.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Card not found");
    return row;
  }

  private async requireStudent(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: students.id, name: students.name, className: classes.name, smsPhone: students.smsPhone }).from(students).innerJoin(classes, eq(classes.id, students.classId)).where(and(eq(students.id, id), eq(students.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Student not found.");
    return row;
  }

  private async requireEmployee(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: employees.id, name: employees.name, className: employees.staffRole }).from(employees).where(and(eq(employees.id, id), eq(employees.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Employee not found");
    return row;
  }

  private unique(error: unknown) {
    const cause = (error as { cause?: { code?: string }; code?: string }).cause;
    return cause?.code === "23505" || (error as { code?: string }).code === "23505";
  }
}
