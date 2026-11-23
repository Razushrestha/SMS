import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  attendanceRecords,
  classes,
  employees,
  students,
  type Database,
} from "@nepatronix/db";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { DB } from "../db/db.module";
import { AuditService, type Actor } from "../audit/audit.service";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";

type MarkStatus = "present" | "leave" | "absent";

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }
  return value.trim();
}

function dateKey(value: unknown, label = "Date") {
  const date = required(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException(`Choose a valid ${label.toLowerCase()}`);
  return date;
}

function monthKey(value: unknown) {
  const month = required(value, "Month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException("Choose a valid month");
  return month;
}

function dayName(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

function statusLabel(status: string) {
  if (status === "present") return "Present";
  if (status === "leave") return "On Leave";
  if (status === "absent") return "Absent";
  return "NOT MARKED";
}

function sourceLabel(source: string) {
  return source === "rfid" ? "RFID" : "Manual";
}

function parseMarks(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException("The sheet is empty");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new BadRequestException("Each row needs a person and a status");
    const row = item as Record<string, unknown>;
    const personId = required(row.personId, "Person");
    const status = required(row.status, "Status");
    if (status !== "present" && status !== "leave" && status !== "absent") {
      throw new BadRequestException("Status must be Present, Leave, or Absent");
    }
    if (seen.has(personId)) throw new BadRequestException("Each person can appear once on the sheet");
    seen.add(personId);
    return { personId, status: status as MarkStatus };
  });
}

function counts(rows: Array<{ status: string }>) {
  return {
    total: rows.length,
    present: rows.filter((row) => row.status === "present").length,
    leave: rows.filter((row) => row.status === "leave").length,
    absent: rows.filter((row) => row.status === "absent").length,
  };
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async own(user: AuthUser) {
    if (user.role !== "student" && user.role !== "parent") throw new ForbiddenException("This role cannot open that page.");
    const ids = await linkedStudentIds(this.db, user);
    const people = await this.db
      .select({
        id: students.id,
        name: students.name,
        className: classes.name,
        fatherName: students.fatherName,
        motherName: students.motherName,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(students.tenantId, user.tenantId))
      .orderBy(asc(students.registrationNo));
    const linked = people.filter((person) => ids.has(person.id));
    const day = this.today();
    const month = day.slice(0, 7);
    if (!linked.length) {
      return {
        today: day,
        month,
        people: [],
        message: user.role === "parent" ? "No students are linked to this parent." : "No student record matches this login.",
      };
    }
    const rows = await this.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, user.tenantId), inArray(attendanceRecords.studentId, linked.map((person) => person.id))));
    return {
      today: day,
      month,
      message: "",
      people: linked.map((person) => {
        const marks = rows.filter((row) => row.studentId === person.id);
        const current = marks.find((row) => row.attendanceDate === day);
        return {
          name: person.name,
          className: person.className,
          today: current
            ? { status: current.status, inTime: current.markedTime, outTime: current.outTime }
            : { status: "not marked", inTime: null, outTime: null },
          month: marks
            .filter((row) => row.attendanceDate.startsWith(month))
            .map((row) => ({ date: row.attendanceDate, status: row.status, inTime: row.markedTime, outTime: row.outTime })),
        };
      }),
    };
  }

  async studentSheet(tenantId: string, classId: string, dateRaw: string) {
    const date = dateKey(dateRaw);
    const classroom = await this.requireClass(tenantId, classId);
    const people = await this.activeStudents(tenantId, classroom.id);
    const saved = people.length
      ? await this.db
          .select({ studentId: attendanceRecords.studentId, status: attendanceRecords.status })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.tenantId, tenantId),
              eq(attendanceRecords.attendanceDate, date),
              inArray(
                attendanceRecords.studentId,
                people.map((person) => person.id),
              ),
            ),
          )
      : [];
    const savedByStudent = new Map(saved.map((row) => [row.studentId, row.status]));
    return {
      date,
      classId: classroom.id,
      className: classroom.name,
      rows: people.map((person) => ({
        personId: person.id,
        registrationNo: person.registrationNo,
        name: person.name,
        status: savedByStudent.get(person.id) ?? "present",
        saved: savedByStudent.has(person.id),
      })),
    };
  }

  async saveStudentSheet(tenantId: string, actor: Actor, body: Record<string, unknown>) {
    const date = dateKey(body.date);
    const classroom = await this.requireClass(tenantId, required(body.classId, "Class"));
    const marks = parseMarks(body.marks);
    const people = await this.activeStudents(tenantId, classroom.id);
    this.assertWholeSheet(
      people.map((person) => person.id),
      marks.map((mark) => mark.personId),
      "Save the whole class sheet.",
    );
    await this.upsertPeople(tenantId, actor, date, marks, "student");
    return { message: "Attendance saved successfully." };
  }

  async employeeSheet(tenantId: string, dateRaw: string) {
    const date = dateKey(dateRaw);
    const people = await this.activeEmployees(tenantId);
    const saved = people.length
      ? await this.db
          .select({ employeeId: attendanceRecords.employeeId, status: attendanceRecords.status })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.tenantId, tenantId),
              eq(attendanceRecords.attendanceDate, date),
              inArray(
                attendanceRecords.employeeId,
                people.map((person) => person.id),
              ),
            ),
          )
      : [];
    const savedByEmployee = new Map(saved.map((row) => [row.employeeId, row.status]));
    return {
      date,
      rows: people.map((person) => ({
        personId: person.id,
        name: person.name,
        staffRole: person.staffRole,
        status: savedByEmployee.get(person.id) ?? "present",
        saved: savedByEmployee.has(person.id),
      })),
    };
  }

  async saveEmployeeSheet(tenantId: string, actor: Actor, body: Record<string, unknown>) {
    const date = dateKey(body.date);
    const marks = parseMarks(body.marks);
    const people = await this.activeEmployees(tenantId);
    this.assertWholeSheet(
      people.map((person) => person.id),
      marks.map((mark) => mark.personId),
      "Save the whole employee sheet.",
    );
    await this.upsertPeople(tenantId, actor, date, marks, "employee");
    return { message: "Attendance saved successfully." };
  }

  async studentReport(tenantId: string, fromRaw?: string, toRaw?: string, classId?: string) {
    const { from, to } = this.range(fromRaw, toRaw);
    const filters = [
      eq(attendanceRecords.tenantId, tenantId),
      gte(attendanceRecords.attendanceDate, from),
      lte(attendanceRecords.attendanceDate, to),
    ];
    if (classId) filters.push(eq(students.classId, classId));
    const rows = await this.db
      .select({
        date: attendanceRecords.attendanceDate,
        registrationNo: students.registrationNo,
        name: students.name,
        className: classes.name,
        status: attendanceRecords.status,
        source: attendanceRecords.source,
        markedTime: attendanceRecords.markedTime,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(students.id, attendanceRecords.studentId))
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(...filters))
      .orderBy(asc(attendanceRecords.attendanceDate), asc(students.registrationNo));
    return {
      from,
      to,
      counts: counts(rows),
      rows: rows.map((row) => ({
        date: row.date,
        day: dayName(row.date),
        studentId: row.registrationNo,
        name: row.name,
        className: row.className,
        status: statusLabel(row.status),
        type: sourceLabel(row.source),
        time: row.markedTime,
      })),
    };
  }

  async employeeReport(tenantId: string, fromRaw?: string, toRaw?: string) {
    const { from, to } = this.range(fromRaw, toRaw);
    const rows = await this.db
      .select({
        date: attendanceRecords.attendanceDate,
        employeeId: employees.id,
        name: employees.name,
        status: attendanceRecords.status,
        source: attendanceRecords.source,
        markedTime: attendanceRecords.markedTime,
      })
      .from(attendanceRecords)
      .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
      .where(
        and(
          eq(attendanceRecords.tenantId, tenantId),
          gte(attendanceRecords.attendanceDate, from),
          lte(attendanceRecords.attendanceDate, to),
        ),
      )
      .orderBy(asc(attendanceRecords.attendanceDate), asc(employees.name));
    return {
      from,
      to,
      counts: counts(rows),
      rows: rows.map((row) => ({
        date: row.date,
        day: dayName(row.date),
        employeeId: row.employeeId,
        name: row.name,
        type: sourceLabel(row.source),
        status: statusLabel(row.status),
        time: row.markedTime,
      })),
    };
  }

  async classReport(tenantId: string, dateRaw: string) {
    const date = dateKey(dateRaw);
    const rooms = await this.db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(eq(classes.tenantId, tenantId))
      .orderBy(asc(classes.name));
    const people = await this.db
      .select({ id: students.id, classId: students.classId })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.status, "active")));
    const marks = people.length
      ? await this.db
          .select({ studentId: attendanceRecords.studentId, status: attendanceRecords.status })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.tenantId, tenantId),
              eq(attendanceRecords.attendanceDate, date),
              inArray(
                attendanceRecords.studentId,
                people.map((person) => person.id),
              ),
            ),
          )
      : [];
    const statusByStudent = new Map(marks.map((mark) => [mark.studentId, mark.status]));
    return {
      date,
      classes: rooms.map((room) => {
        const members = people.filter((person) => person.classId === room.id);
        const marked = members.filter((person) => statusByStudent.has(person.id));
        const present = members.filter((person) => statusByStudent.get(person.id) === "present").length;
        const leave = members.filter((person) => statusByStudent.get(person.id) === "leave").length;
        const absent = members.filter((person) => statusByStudent.get(person.id) === "absent").length;
        const markedAll = members.length > 0 && marked.length === members.length;
        return {
          id: room.id,
          name: room.name,
          total: members.length,
          present: markedAll ? present : null,
          leave: markedAll ? leave : null,
          absent: markedAll ? absent : null,
          presentPercent: markedAll ? Math.round((present / members.length) * 1000) / 10 : null,
        };
      }),
    };
  }

  async monthlyStudents(tenantId: string, classId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const classroom = await this.requireClass(tenantId, classId);
    const people = await this.activeStudents(tenantId, classroom.id);
    const rows = await this.marksForMonth(
      tenantId,
      month,
      people.map((person) => person.id),
      "student",
    );
    return this.monthGrid(month, classroom.name, people.map((person) => ({ id: person.id, label: person.name, code: person.registrationNo })), rows, "student");
  }

  async monthlyEmployees(tenantId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const people = await this.activeEmployees(tenantId);
    const rows = await this.marksForMonth(
      tenantId,
      month,
      people.map((person) => person.id),
      "employee",
    );
    return this.monthGrid(month, null, people.map((person) => ({ id: person.id, label: person.name, code: person.staffRole })), rows, "employee");
  }

  private monthGrid(
    month: string,
    className: string | null,
    people: Array<{ id: string; label: string; code: string }>,
    rows: Array<{ personId: string | null; attendanceDate: string; status: string }>,
    kind: "student" | "employee",
  ) {
    const dayCount = daysInMonth(month);
    const days = Array.from({ length: dayCount }, (_, index) => String(index + 1).padStart(2, "0"));
    const byPerson = new Map<string, Map<string, string>>();
    for (const row of rows) {
      if (!row.personId) continue;
      const day = row.attendanceDate.slice(-2);
      const own = byPerson.get(row.personId) ?? new Map<string, string>();
      own.set(day, row.status === "present" ? "P" : row.status === "leave" ? "L" : "A");
      byPerson.set(row.personId, own);
    }
    return {
      month,
      className,
      days,
      rows: people.map((person) => {
        const own = byPerson.get(person.id) ?? new Map<string, string>();
        const cells = days.map((day) => own.get(day) ?? "");
        return {
          id: person.id,
          label: person.label,
          code: person.code,
          kind,
          cells,
          present: cells.filter((cell) => cell === "P").length,
          leave: cells.filter((cell) => cell === "L").length,
          absent: cells.filter((cell) => cell === "A").length,
        };
      }),
    };
  }

  private async marksForMonth(tenantId: string, month: string, personIds: string[], kind: "student" | "employee") {
    if (personIds.length === 0) return [];
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
    const personColumn = kind === "student" ? attendanceRecords.studentId : attendanceRecords.employeeId;
    const rows = await this.db
      .select({
        personId: personColumn,
        attendanceDate: attendanceRecords.attendanceDate,
        status: attendanceRecords.status,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.tenantId, tenantId),
          gte(attendanceRecords.attendanceDate, from),
          lte(attendanceRecords.attendanceDate, to),
          inArray(personColumn, personIds),
        ),
      );
    return rows;
  }

  private async upsertPeople(
    tenantId: string,
    actor: Actor,
    date: string,
    marks: Array<{ personId: string; status: MarkStatus }>,
    kind: "student" | "employee",
  ) {
    const personColumn = kind === "student" ? attendanceRecords.studentId : attendanceRecords.employeeId;
    const existing = await this.db
      .select({
        id: attendanceRecords.id,
        personId: personColumn,
        status: attendanceRecords.status,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.tenantId, tenantId),
          eq(attendanceRecords.attendanceDate, date),
          inArray(
            personColumn,
            marks.map((mark) => mark.personId),
          ),
        ),
      );
    const existingByPerson = new Map(existing.map((row) => [row.personId, row]));
    const changes: Array<{ personId: string; from: string; to: string }> = [];
    await this.db.transaction(async (tx) => {
      for (const mark of marks) {
        const current = existingByPerson.get(mark.personId);
        if (current) {
          if (current.status === mark.status) continue;
          changes.push({ personId: mark.personId, from: current.status, to: mark.status });
          await tx
            .update(attendanceRecords)
            .set({
              status: mark.status,
              editedManually: true,
              editedByName: actor.name,
              updatedAt: new Date(),
            })
            .where(eq(attendanceRecords.id, current.id));
          continue;
        }
        await tx.insert(attendanceRecords).values({
          tenantId,
          studentId: kind === "student" ? mark.personId : null,
          employeeId: kind === "employee" ? mark.personId : null,
          attendanceDate: date,
          status: mark.status,
          source: "manual",
          markedTime: "-",
        });
      }
    });
    if (!changes.length) return;
    const ids = changes.map((change) => change.personId);
    const named = kind === "student"
      ? await this.db.select({ id: students.id, name: students.name }).from(students).where(inArray(students.id, ids))
      : await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(inArray(employees.id, ids));
    const names = new Map(named.map((row) => [row.id, row.name]));
    for (const change of changes) {
      await this.audit.record(tenantId, actor, "attendance_edited", `${names.get(change.personId) ?? "Someone"} on ${date} changed from ${change.from} to ${change.to}.`);
    }
  }

  private assertWholeSheet(expected: string[], received: string[], message: string) {
    if (expected.length === 0) throw new BadRequestException(message === "Save the whole class sheet." ? "This class has no active students." : "There are no active employees.");
    const incoming = new Set(received);
    if (expected.length !== received.length || expected.some((id) => !incoming.has(id))) {
      throw new BadRequestException(message);
    }
  }

  private today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  private range(fromRaw?: string, toRaw?: string) {
    const today = new Date();
    const fallbackTo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const fallbackFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const from = fromRaw ? dateKey(fromRaw, "From") : fallbackFrom;
    const to = toRaw ? dateKey(toRaw, "To") : fallbackTo;
    if (from > to) throw new BadRequestException("The start date is after the end date");
    return { from, to };
  }

  private async requireClass(tenantId: string, classId: string) {
    const [classroom] = await this.db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId)))
      .limit(1);
    if (!classroom) throw new NotFoundException("Class not found.");
    return classroom;
  }

  private activeStudents(tenantId: string, classId: string) {
    return this.db
      .select({ id: students.id, name: students.name, registrationNo: students.registrationNo })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.classId, classId), eq(students.status, "active")))
      .orderBy(asc(students.registrationNo));
  }

  private activeEmployees(tenantId: string) {
    return this.db
      .select({ id: employees.id, name: employees.name, staffRole: employees.staffRole })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active")))
      .orderBy(asc(employees.name));
  }
}
