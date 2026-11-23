import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import {
  attendanceRecords,
  classes,
  employees,
  salaryPayments,
  families,
  feePayments,
  institutes,
  smsAccounts,
  smsMessages,
  smsOptOuts,
  students,
  subjects,
  type Database,
} from "@nepatronix/db";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";
import { hashPassword, verifyPassword } from "../auth/session";
import { DB } from "../db/db.module";

const STAFF_ROLES = ["principal", "management_staff", "teacher", "accountant", "store_manager", "other"] as const;

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }
  return value.trim();
}

function optional(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function ageInYears(dateOfBirth: string | null, today: string) {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  if (!year || !todayYear) return null;
  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) age -= 1;
  return age < 0 ? null : age;
}

function photo(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new BadRequestException("Photo must be a JPG, PNG, GIF, or WEBP");
  const match = value.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new BadRequestException("Photo must be a JPG, PNG, GIF, or WEBP");
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > 100 * 1024) throw new BadRequestException("Photo must be 100 KB or smaller");
  return value;
}

function money(value: unknown, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new BadRequestException(`${label} must be zero or more`);
  }
  return amount.toFixed(2);
}

@Injectable()
export class SchoolService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async summary(tenantId: string) {
    const [employeeCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(eq(employees.tenantId, tenantId));
    const [classCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(classes)
      .where(eq(classes.tenantId, tenantId));
    const [activeStudents] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.status, "active")));
    const [inactiveStudents] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.status, "inactive")));
    return {
      employees: employeeCount?.count ?? 0,
      classes: classCount?.count ?? 0,
      activeStudents: activeStudents?.count ?? 0,
      inactiveStudents: inactiveStudents?.count ?? 0,
    };
  }

  staffCards(tenantId: string) {
    return this.db
      .select({
        id: employees.id,
        name: employees.name,
        phone: employees.phone,
        joiningDate: employees.joiningDate,
        staffRole: employees.staffRole,
        status: employees.status,
        photoUrl: employees.photoUrl,
      })
      .from(employees)
      .where(eq(employees.tenantId, tenantId))
      .orderBy(asc(employees.name));
  }

  async employeeReport(tenantId: string) {
    const people = await this.db
      .select({
        id: employees.id,
        name: employees.name,
        phone: employees.phone,
        joiningDate: employees.joiningDate,
        staffRole: employees.staffRole,
        monthlySalary: employees.monthlySalary,
        status: employees.status,
        fatherOrHusband: employees.fatherOrHusband,
        nationalId: employees.nationalId,
        education: employees.education,
        gender: employees.gender,
        religion: employees.religion,
        bloodGroup: employees.bloodGroup,
        experience: employees.experience,
        email: employees.email,
        dateOfBirth: employees.dateOfBirth,
        address: employees.address,
        showOnWebsite: employees.showOnWebsite,
        photoUrl: employees.photoUrl,
        portalUsername: employees.portalUsername,
      })
      .from(employees)
      .where(eq(employees.tenantId, tenantId))
      .orderBy(asc(employees.name));
    const payments = await this.db
      .select({ employeeId: salaryPayments.employeeId, salaryMonth: salaryPayments.salaryMonth, paidOn: salaryPayments.paidOn, net: salaryPayments.net })
      .from(salaryPayments)
      .where(eq(salaryPayments.tenantId, tenantId))
      .orderBy(desc(salaryPayments.paidOn));
    const marks = await this.db
      .select({ employeeId: attendanceRecords.employeeId, attendanceDate: attendanceRecords.attendanceDate, status: attendanceRecords.status, markedTime: attendanceRecords.markedTime })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, tenantId), isNotNull(attendanceRecords.employeeId)))
      .orderBy(desc(attendanceRecords.attendanceDate));
    return people.map((person) => {
      const paid = payments.filter((row) => row.employeeId === person.id);
      const attendance = marks.filter((row) => row.employeeId === person.id);
      return {
        ...person,
        password: null,
        passwordNote: person.portalUsername ? "This password was shown once and is not stored." : "No portal login.",
        salaryStatus: paid.length ? "SALARY RECEIVED" : "SALARY NOT RECEIVED",
        latestSalary: paid[0] ? { month: paid[0].salaryMonth, paidOn: paid[0].paidOn, net: paid[0].net } : null,
        attendance: {
          present: attendance.filter((row) => row.status === "present").length,
          leave: attendance.filter((row) => row.status === "leave").length,
          absent: attendance.filter((row) => row.status === "absent").length,
          rows: attendance.map((row) => ({ date: row.attendanceDate, status: row.status, time: row.markedTime })),
        },
      };
    });
  }

  listEmployees(tenantId: string) {
    return this.db.select().from(employees).where(eq(employees.tenantId, tenantId)).orderBy(employees.name);
  }

  async createEmployee(tenantId: string, body: Record<string, unknown>) {
    const role = required(body.staffRole, "Role");
    if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
      throw new BadRequestException("Choose a valid role");
    }
    const [row] = await this.db
      .insert(employees)
      .values({
        tenantId,
        name: required(body.name, "Name"),
        phone: required(body.phone, "Phone"),
        joiningDate: required(body.joiningDate, "Joining date"),
        staffRole: role as (typeof STAFF_ROLES)[number],
        monthlySalary: money(body.monthlySalary, "Monthly salary"),
        fatherOrHusband: optional(body.fatherOrHusband),
        nationalId: optional(body.nationalId),
        education: optional(body.education),
        gender: optional(body.gender),
        religion: optional(body.religion),
        bloodGroup: optional(body.bloodGroup),
        experience: optional(body.experience),
        email: optional(body.email),
        dateOfBirth: optional(body.dateOfBirth),
        address: optional(body.address),
        showOnWebsite: body.showOnWebsite === true || body.showOnWebsite === "true",
        photoUrl: photo(body.photoUrl) ?? null,
      })
      .returning();
    return row;
  }

  async updateEmployee(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.requireEmployee(tenantId, id);
    const role = required(body.staffRole, "Role");
    if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
      throw new BadRequestException("Choose a valid role");
    }
    const status = body.status === "inactive" ? "inactive" : "active";
    const [row] = await this.db
      .update(employees)
      .set({
        name: required(body.name, "Name"),
        phone: required(body.phone, "Phone"),
        joiningDate: required(body.joiningDate, "Joining date"),
        staffRole: role as (typeof STAFF_ROLES)[number],
        monthlySalary: money(body.monthlySalary, "Monthly salary"),
        fatherOrHusband: optional(body.fatherOrHusband),
        nationalId: optional(body.nationalId),
        education: optional(body.education),
        gender: optional(body.gender),
        religion: optional(body.religion),
        bloodGroup: optional(body.bloodGroup),
        experience: optional(body.experience),
        email: optional(body.email),
        dateOfBirth: optional(body.dateOfBirth),
        address: optional(body.address),
        showOnWebsite: body.showOnWebsite === true || body.showOnWebsite === "true",
        status,
        ...(photo(body.photoUrl) !== undefined ? { photoUrl: photo(body.photoUrl) } : {}),
      })
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
      .returning();
    return row;
  }

  async deleteEmployee(tenantId: string, id: string) {
    await this.requireEmployee(tenantId, id);
    const [assigned] = await this.db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(and(eq(classes.teacherId, id), eq(classes.tenantId, tenantId)))
      .limit(1);
    if (assigned) {
      throw new ConflictException(`This employee is the class teacher of ${assigned.name}. Choose another teacher first.`);
    }
    await this.db.delete(employees).where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)));
    return { ok: true };
  }

  listClasses(tenantId: string) {
    return this.db
      .select({
        id: classes.id,
        name: classes.name,
        monthlyFee: classes.monthlyFee,
        teacherId: classes.teacherId,
        teacherName: employees.name,
      })
      .from(classes)
      .innerJoin(employees, eq(employees.id, classes.teacherId))
      .where(eq(classes.tenantId, tenantId))
      .orderBy(classes.name);
  }

  async createClass(tenantId: string, body: Record<string, unknown>) {
    const teacherId = required(body.teacherId, "Class teacher");
    await this.requireEmployee(tenantId, teacherId);
    try {
      const [row] = await this.db
        .insert(classes)
        .values({
          tenantId,
          name: required(body.name, "Class name"),
          monthlyFee: money(body.monthlyFee, "Monthly tuition"),
          teacherId,
        })
        .returning();
      return row;
    } catch (error) {
      this.rethrowUnique(error, "A class with this name already exists");
    }
  }

  async updateClass(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.requireClass(tenantId, id);
    const teacherId = required(body.teacherId, "Class teacher");
    await this.requireEmployee(tenantId, teacherId);
    try {
      const [row] = await this.db
        .update(classes)
        .set({
          name: required(body.name, "Class name"),
          monthlyFee: money(body.monthlyFee, "Monthly tuition"),
          teacherId,
        })
        .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId)))
        .returning();
      return row;
    } catch (error) {
      this.rethrowUnique(error, "A class with this name already exists");
    }
  }

  async deleteClass(tenantId: string, id: string) {
    await this.requireClass(tenantId, id);
    await this.db.delete(classes).where(and(eq(classes.id, id), eq(classes.tenantId, tenantId)));
    return { ok: true };
  }

  listSubjects(tenantId: string, classId: string) {
    return this.db
      .select()
      .from(subjects)
      .where(and(eq(subjects.tenantId, tenantId), eq(subjects.classId, classId)))
      .orderBy(subjects.name);
  }

  async addSubject(tenantId: string, body: Record<string, unknown>) {
    const classId = required(body.classId, "Class");
    await this.requireClass(tenantId, classId);
    const totalMarks = Number(body.totalMarks);
    if (!Number.isInteger(totalMarks) || totalMarks <= 0) {
      throw new BadRequestException("Total marks must be a whole number above zero");
    }
    try {
      const [row] = await this.db
        .insert(subjects)
        .values({
          tenantId,
          classId,
          name: required(body.name, "Subject name"),
          totalMarks,
        })
        .returning();
      return row;
    } catch (error) {
      this.rethrowUnique(error, "This class already has that subject");
    }
  }

  async deleteSubject(tenantId: string, id: string) {
    const result = await this.db
      .delete(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId)))
      .returning({ id: subjects.id });
    if (!result.length) throw new NotFoundException("Subject not found");
    return { ok: true };
  }

  listFamilies(tenantId: string) {
    return this.db.select().from(families).where(eq(families.tenantId, tenantId)).orderBy(families.name);
  }

  async createFamily(tenantId: string, body: Record<string, unknown>) {
    const [row] = await this.db
      .insert(families)
      .values({ tenantId, name: required(body.name, "Family name"), phone: optional(body.phone) })
      .returning();
    return row;
  }

  async updateFamily(tenantId: string, id: string, body: Record<string, unknown>) {
    const [row] = await this.db
      .update(families)
      .set({ name: required(body.name, "Family name"), phone: optional(body.phone) })
      .where(and(eq(families.id, id), eq(families.tenantId, tenantId)))
      .returning();
    if (!row) throw new NotFoundException("Family not found");
    return row;
  }

  async deleteFamily(tenantId: string, id: string) {
    const result = await this.db
      .delete(families)
      .where(and(eq(families.id, id), eq(families.tenantId, tenantId)))
      .returning({ id: families.id });
    if (!result.length) throw new NotFoundException("Family not found");
    return { ok: true };
  }

  async studentMeta(tenantId: string) {
    const [last] = await this.db
      .select({ registrationNo: students.registrationNo })
      .from(students)
      .where(eq(students.tenantId, tenantId))
      .orderBy(desc(students.createdAt))
      .limit(1);
    return { lastRegistration: last?.registrationNo ?? null };
  }

  async basicList(tenantId: string) {
    const people = await this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        fatherName: students.fatherName,
        classId: students.classId,
        className: classes.name,
        smsPhone: students.smsPhone,
        fatherMobile: students.fatherMobile,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(students.tenantId, tenantId))
      .orderBy(asc(students.name));
    const dues = await this.db
      .select({
        studentId: feePayments.studentId,
        due: sql<string>`coalesce(sum(${feePayments.due}), 0)`,
      })
      .from(feePayments)
      .where(eq(feePayments.tenantId, tenantId))
      .groupBy(feePayments.studentId);
    const dueByStudent = new Map(dues.map((row) => [row.studentId, Number(row.due)]));
    return people.map((student) => {
      const remaining = dueByStudent.get(student.id) ?? 0;
      return {
        id: student.id,
        registrationNo: student.registrationNo,
        name: student.name,
        fatherName: student.fatherName,
        classId: student.classId,
        className: student.className,
        feeRemaining: remaining > 0 ? remaining.toFixed(2) : null,
        phone: student.smsPhone || student.fatherMobile,
      };
    });
  }

  async infoReport(tenantId: string) {
    const [institute] = await this.db
      .select({ timezone: institutes.timezone })
      .from(institutes)
      .where(eq(institutes.tenantId, tenantId))
      .limit(1);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: institute?.timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const rows = await this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        fatherName: students.fatherName,
        className: classes.name,
        discountType: students.discountType,
        discountPercent: students.discountPercent,
        discountAmount: students.discountAmount,
        discountReason: students.discountReason,
        admissionDate: students.admissionDate,
        dateOfBirth: students.dateOfBirth,
        gender: students.gender,
        birthId: students.birthId,
        religion: students.religion,
        caste: students.caste,
        status: students.status,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(students.tenantId, tenantId))
      .orderBy(asc(students.name));
    const people = rows.map((row) => ({
      id: row.id,
      registrationNo: row.registrationNo,
      name: row.name,
      fatherName: row.fatherName,
      className: row.className,
      discount: row.discountType === "fixed" ? `${row.discountAmount} ${row.discountReason}`.trim() : `${Number(row.discountPercent)}%`,
      admissionDate: row.admissionDate,
      dateOfBirth: row.dateOfBirth,
      age: ageInYears(row.dateOfBirth, today),
      gender: row.gender,
      birthId: row.birthId,
      religion: row.religion,
      caste: row.caste,
      status: row.status,
    }));
    return {
      total: people.length,
      active: people.filter((row) => row.status === "active").length,
      inactive: people.filter((row) => row.status === "inactive").length,
      classes: new Set(rows.map((row) => row.className)).size,
      rows: people,
    };
  }

  async contactReport(tenantId: string) {
    const rows = await this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        className: classes.name,
        fatherName: students.fatherName,
        fatherNationalId: students.fatherNationalId,
        fatherEducation: students.fatherEducation,
        fatherMobile: students.fatherMobile,
        fatherOccupation: students.fatherOccupation,
        fatherProfession: students.fatherProfession,
        fatherIncome: students.fatherIncome,
        motherName: students.motherName,
        motherNationalId: students.motherNationalId,
        motherEducation: students.motherEducation,
        motherMobile: students.motherMobile,
        motherOccupation: students.motherOccupation,
        motherProfession: students.motherProfession,
        motherIncome: students.motherIncome,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(students.tenantId, tenantId))
      .orderBy(asc(students.name));
    const hasMobile = (value: string | null) => Boolean(value?.trim());
    return {
      total: rows.length,
      fathersWithMobile: rows.filter((row) => hasMobile(row.fatherMobile)).length,
      mothersWithMobile: rows.filter((row) => hasMobile(row.motherMobile)).length,
      classes: new Set(rows.map((row) => row.className)).size,
      rows,
    };
  }

  listStudents(tenantId: string) {
    return this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        admissionDate: students.admissionDate,
        classId: students.classId,
        className: classes.name,
        discountPercent: students.discountPercent,
        discountType: students.discountType,
        discountAmount: students.discountAmount,
        discountReason: students.discountReason,
        status: students.status,
        smsPhone: students.smsPhone,
        fatherName: students.fatherName,
        photoUrl: students.photoUrl,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(students.tenantId, tenantId))
      .orderBy(students.name);
  }

  async lookupStudents(tenantId: string, q: string) {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const rows = await this.listStudents(tenantId);
    return rows
      .filter((row) => row.name.toLowerCase().includes(query) || row.registrationNo.toLowerCase() === query)
      .slice(0, 8)
      .map((row) => ({ id: row.id, name: row.name, registrationNo: row.registrationNo, className: row.className }));
  }

  async promotionList(tenantId: string) {
    return this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        classId: students.classId,
        className: classes.name,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, tenantId), eq(students.status, "active")))
      .orderBy(asc(students.name));
  }

  async promoteStudents(tenantId: string, body: Record<string, unknown>) {
    const moves = Array.isArray(body.moves) ? body.moves : [];
    if (!moves.length) throw new BadRequestException("Choose a target class");
    let updated = 0;
    for (const item of moves) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const studentId = required(row.studentId, "Student");
      const classId = required(row.classId, "Target class");
      const student = await this.requirePortalStudent(tenantId, studentId);
      if (student.status !== "active") throw new BadRequestException("Inactive students are not promoted.");
      await this.requireClass(tenantId, classId);
      if (student.classId === classId) continue;
      await this.db.update(students).set({ classId }).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId)));
      updated += 1;
    }
    return { updated };
  }

  async portalLogin(tenantId: string, id: string) {
    const student = await this.requirePortalStudent(tenantId, id);
    return {
      id: student.id,
      name: student.name,
      username: student.portalUsername,
      phone: student.smsPhone || student.fatherMobile,
      password: null,
      passwordNote: student.portalUsername
        ? "This password was shown once and is not stored."
        : "Save a username, then reset the password. It is shown once.",
    };
  }

  async savePortalUsername(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.requirePortalStudent(tenantId, id);
    const username = required(body.username, "Username").toLowerCase();
    if (!/^[a-z0-9]{1,24}$/.test(username)) throw new BadRequestException("Use 1 to 24 letters or numbers");
    const [studentClash] = await this.db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.portalUsername, username)))
      .limit(1);
    if (studentClash && studentClash.id !== id) throw new ConflictException("That username is already used.");
    const [staffClash] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.portalUsername, username)))
      .limit(1);
    if (staffClash) throw new ConflictException("That username is already used.");
    await this.db.update(students).set({ portalUsername: username }).where(and(eq(students.id, id), eq(students.tenantId, tenantId)));
    return { username };
  }

  async resetPortalPassword(tenantId: string, id: string) {
    const student = await this.requirePortalStudent(tenantId, id);
    if (!student.portalUsername) throw new BadRequestException("Save a username before resetting the password.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const password = [...randomBytes(12)].map((byte) => alphabet[byte % alphabet.length]).join("");
    await this.db
      .update(students)
      .set({ portalPasswordHash: hashPassword(password) })
      .where(and(eq(students.id, id), eq(students.tenantId, tenantId)));
    return {
      username: student.portalUsername,
      password,
      passwordNote: "This password is shown once. It is not stored and is left out of the next SMS unless you reset it again.",
    };
  }

  async sendPortalSms(tenantId: string, id: string, body: Record<string, unknown>) {
    const student = await this.requirePortalStudent(tenantId, id);
    if (!student.portalUsername) throw new BadRequestException("Save a username before sending the login.");
    const phone = student.smsPhone || student.fatherMobile;
    if (!phone) throw new BadRequestException("This student has no SMS phone.");
    const supplied = typeof body.password === "string" ? body.password : "";
    let includesPassword = false;
    if (supplied) {
      if (!student.portalPasswordHash || !verifyPassword(supplied, student.portalPasswordHash)) {
        throw new BadRequestException("That password is not the current portal password.");
      }
      includesPassword = true;
    }
    const [institute] = await this.db.select({ name: institutes.name }).from(institutes).where(eq(institutes.tenantId, tenantId)).limit(1);
    const text = includesPassword
      ? `Portal login for ${student.name}. Username ${student.portalUsername}. Password ${supplied}. ${institute?.name ?? ""}`.trim()
      : `Portal login for ${student.name}. Username ${student.portalUsername}. ${institute?.name ?? ""}`.trim();
    const [opted] = await this.db
      .select({ id: smsOptOuts.id })
      .from(smsOptOuts)
      .where(and(eq(smsOptOuts.tenantId, tenantId), eq(smsOptOuts.phone, phone)))
      .limit(1);
    if (opted) {
      await this.db.insert(smsMessages).values({ tenantId, phone, body: text, kind: "login", status: "opted_out" });
      return { phone, status: "opted_out", balance: null, includesPassword };
    }
    const [account] = await this.db.select().from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1);
    const balance = account?.balance ?? 100;
    if (!account) await this.db.insert(smsAccounts).values({ tenantId });
    if (balance < 1) throw new BadRequestException("SMS balance is empty");
    await this.db.update(smsAccounts).set({ balance: balance - 1 }).where(eq(smsAccounts.tenantId, tenantId));
    await this.db.insert(smsMessages).values({ tenantId, phone, body: text, kind: "login", status: "not_sent" });
    return { phone, status: "not_sent", balance: balance - 1, includesPassword };
  }

  async getStudent(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(students)
      .where(and(eq(students.id, id), eq(students.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new NotFoundException("Student not found");
    return row;
  }

  async listChildren(user: AuthUser) {
    const ids = await linkedStudentIds(this.db, user);
    if (!ids.size) return [];
    return this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        classId: students.classId,
        className: classes.name,
        status: students.status,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, user.tenantId), inArray(students.id, [...ids])))
      .orderBy(asc(students.registrationNo));
  }

  async meStudent(user: AuthUser) {
    if (user.role === "parent") {
      const children = await this.listChildren(user);
      if (!children[0]) throw new NotFoundException("No students are linked to this parent.");
      return children[0];
    }
    const tenantId = user.tenantId;
    const studentId = user.studentId;
    const name = user.name;
    const byId = studentId
      ? await this.db
          .select({
            id: students.id,
            registrationNo: students.registrationNo,
            name: students.name,
            classId: students.classId,
            className: classes.name,
            status: students.status,
          })
          .from(students)
          .innerJoin(classes, eq(classes.id, students.classId))
          .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
          .limit(1)
      : [];
    if (byId[0]) return byId[0];
    const needle = name.trim().toLowerCase();
    if (!needle) throw new NotFoundException("Student profile not linked");
    const [row] = await this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        classId: students.classId,
        className: classes.name,
        status: students.status,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, tenantId), sql`lower(${students.name}) = ${needle}`))
      .limit(1);
    if (!row) throw new NotFoundException("Student profile not linked");
    return row;
  }

  async createStudent(tenantId: string, body: Record<string, unknown>) {
    const classId = required(body.classId, "Class");
    await this.requireClass(tenantId, classId);
    const familyId = optional(body.familyId);
    if (familyId) await this.requireFamily(tenantId, familyId);
    try {
      const [row] = await this.db.insert(students).values({ ...this.studentValues(tenantId, body, classId, familyId), photoUrl: photo(body.photoUrl) ?? null }).returning();
      return row;
    } catch (error) {
      this.rethrowUnique(error, "This Registration No. Already Exists!");
    }
  }

  async updateStudent(tenantId: string, id: string, body: Record<string, unknown>) {
    const current = await this.getStudent(tenantId, id);
    const classId = required(body.classId, "Class");
    await this.requireClass(tenantId, classId);
    const familyId = optional(body.familyId);
    if (familyId) await this.requireFamily(tenantId, familyId);
    const values = this.studentValues(tenantId, body, classId, familyId);
    const [row] = await this.db
      .update(students)
      .set({ ...values, registrationNo: current.registrationNo, tenantId, ...(photo(body.photoUrl) !== undefined ? { photoUrl: photo(body.photoUrl) } : {}) })
      .where(and(eq(students.id, id), eq(students.tenantId, tenantId)))
      .returning();
    return row;
  }

  async deleteStudent(tenantId: string, id: string) {
    await this.getStudent(tenantId, id);
    await this.db.delete(students).where(and(eq(students.id, id), eq(students.tenantId, tenantId)));
    return { ok: true };
  }

  private studentValues(tenantId: string, body: Record<string, unknown>, classId: string, familyId: string | null) {
    const discountType = body.discountType === "fixed" ? "fixed" : body.discountType === "percent" || body.discountType === undefined || body.discountType === "" ? "percent" : null;
    if (!discountType) throw new BadRequestException("Choose a discount type");
    const discount = Number(body.discountPercent ?? 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      throw new BadRequestException("Discount percent must be between 0 and 100");
    }
    const fixed = Number(body.discountAmount ?? 0);
    if (!Number.isFinite(fixed) || fixed < 0) throw new BadRequestException("Discount amount must be zero or more");
    const reason = String(body.discountReason ?? "").trim();
    if (discountType === "fixed" && !reason) throw new BadRequestException("Enter a discount reason");
    const gender = optional(body.gender);
    if (gender && gender !== "male" && gender !== "female") {
      throw new BadRequestException("Gender must be male or female");
    }
    return {
      tenantId,
      registrationNo: required(body.registrationNo, "Registration number"),
      name: required(body.name, "Student name"),
      admissionDate: required(body.admissionDate, "Admission date"),
      classId,
      familyId,
      discountPercent: discount.toFixed(2),
      discountType,
      discountAmount: discountType === "fixed" ? fixed.toFixed(2) : "0.00",
      discountReason: discountType === "fixed" ? reason : "",
      status: body.status === "inactive" ? ("inactive" as const) : ("active" as const),
      smsPhone: optional(body.smsPhone),
      dateOfBirth: optional(body.dateOfBirth),
      gender,
      identificationMark: optional(body.identificationMark),
      bloodGroup: optional(body.bloodGroup),
      disease: optional(body.disease),
      birthId: optional(body.birthId),
      caste: optional(body.caste),
      previousSchool: optional(body.previousSchool),
      previousId: optional(body.previousId),
      note: optional(body.note),
      orphan: optional(body.orphan),
      osc: optional(body.osc),
      religion: optional(body.religion),
      siblings: optional(body.siblings),
      address: optional(body.address),
      fatherName: optional(body.fatherName),
      fatherEducation: optional(body.fatherEducation),
      fatherNationalId: optional(body.fatherNationalId),
      fatherMobile: optional(body.fatherMobile),
      fatherOccupation: optional(body.fatherOccupation),
      fatherProfession: optional(body.fatherProfession),
      fatherIncome: optional(body.fatherIncome),
      motherName: optional(body.motherName),
      motherEducation: optional(body.motherEducation),
      motherNationalId: optional(body.motherNationalId),
      motherMobile: optional(body.motherMobile),
      motherOccupation: optional(body.motherOccupation),
      motherProfession: optional(body.motherProfession),
      motherIncome: optional(body.motherIncome),
    };
  }

  private async requirePortalStudent(tenantId: string, id: string) {
    const [row] = await this.db
      .select({
        id: students.id,
        name: students.name,
        portalUsername: students.portalUsername,
        portalPasswordHash: students.portalPasswordHash,
        smsPhone: students.smsPhone,
        fatherMobile: students.fatherMobile,
        status: students.status,
        classId: students.classId,
      })
      .from(students)
      .where(and(eq(students.id, id), eq(students.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new NotFoundException("Student not found");
    return row;
  }

  private async requireEmployee(tenantId: string, id: string) {
    const [row] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new BadRequestException("Add a teacher before creating a class");
  }

  private async requireClass(tenantId: string, id: string) {
    const [row] = await this.db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, id), eq(classes.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new BadRequestException("Add a class before admitting a student");
  }

  private async requireFamily(tenantId: string, id: string) {
    const [row] = await this.db
      .select({ id: families.id })
      .from(families)
      .where(and(eq(families.id, id), eq(families.tenantId, tenantId)))
      .limit(1);
    if (!row) throw new BadRequestException("Family not found");
  }

  private rethrowUnique(error: unknown, message: string): never {
    const code = (value: unknown) =>
      typeof value === "object" && value && "code" in value ? (value as { code?: string }).code : undefined;
    if (code(error) === "23505" || code((error as { cause?: unknown })?.cause) === "23505") {
      throw new ConflictException(message);
    }
    throw error;
  }
}
