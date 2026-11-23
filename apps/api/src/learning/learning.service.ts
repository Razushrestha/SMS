import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  attendanceRecords,
  behaviourRatings,
  certificateTemplates,
  certificates,
  classes,
  classTestMarks,
  classTests,
  employees,
  examMarks,
  institutes,
  schoolPreferences,
  exams,
  examSubjects,
  gradingSettings,
  homework,
  students,
  subjects,
  type Database,
} from "@nepatronix/db";
import { randomBytes } from "crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import QRCode from "qrcode";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";
import { hashPassword } from "../auth/session";
import { affectiveTraits, psychomotorTraits } from "../campus/traits";
import { DB } from "../db/db.module";
import { defaultBands, gradeFor, round1, round2, type GradeBand } from "./learning.grade";

type Settings = {
  weakBelow: number;
  strongFrom: number;
  overallFailAt: number;
  subjectFailAt: number;
  failSubjectCount: number;
  bands: GradeBand[];
};

const allowedMime = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

const defaultCertificateTemplate = {
  name: "leave",
  conduct: "excellent",
  duesNote: "All dues are cleared.",
  body: "This is to certify that {name}, child of {father}, admission number {admissionNumber}, class {className}, born {dateOfBirth}, admitted {admissionDate}, is granted leave on {date} for {reason}. Conduct is {conduct}. {dues}",
};

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${label} is required`);
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateKey(value: unknown, label = "Date") {
  const date = required(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException(`Choose a valid ${label.toLowerCase()}`);
  return date;
}

function numberValue(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${label} must be zero or more`);
  return number;
}

function attachmentFrom(body: Record<string, unknown>) {
  const name = optionalText(body.attachmentName);
  const data = optionalText(body.attachmentData);
  if (!data) return { attachmentName: null, attachmentData: null };
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match || !allowedMime.has(match[1])) {
    throw new BadRequestException("Attachment must be a JPG, PNG, GIF, WEBP, or PDF");
  }
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > 100 * 1024) throw new BadRequestException("Attachment must be 100 KB or smaller");
  return { attachmentName: name ?? "attachment", attachmentData: data };
}

@Injectable()
export class LearningService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async settings(tenantId: string) {
    const [existing] = await this.db.select().from(gradingSettings).where(eq(gradingSettings.tenantId, tenantId)).limit(1);
    const row = existing ?? (await this.db.insert(gradingSettings).values({ tenantId }).returning())[0];
    return this.presentSettings(row);
  }

  async updateSettings(tenantId: string, body: Record<string, unknown>) {
    const current = await this.settings(tenantId);
    const weakBelow = numberValue(body.weakBelow, "Weak cutoff");
    const strongFrom = numberValue(body.strongFrom, "Strong cutoff");
    if (weakBelow > strongFrom) throw new BadRequestException("The weak cutoff cannot be above the strong cutoff");
    const bands = body.bands === undefined ? current.bands : this.parseBands(body.bands);
    const [row] = await this.db
      .update(gradingSettings)
      .set({
        weakBelow: String(weakBelow),
        strongFrom: String(strongFrom),
        overallFailAt: String(numberValue(body.overallFailAt, "Overall fail cutoff")),
        subjectFailAt: String(numberValue(body.subjectFailAt, "Subject fail cutoff")),
        failSubjectCount: Math.max(1, Math.round(numberValue(body.failSubjectCount, "Fail subject count"))),
        bands,
      })
      .where(eq(gradingSettings.tenantId, tenantId))
      .returning();
    return this.presentSettings(row);
  }

  async resetSettings(tenantId: string) {
    await this.settings(tenantId);
    const [row] = await this.db
      .update(gradingSettings)
      .set({ weakBelow: "60", strongFrom: "80", overallFailAt: "32", subjectFailAt: "32", failSubjectCount: 1, bands: defaultBands })
      .where(eq(gradingSettings.tenantId, tenantId))
      .returning();
    return this.presentSettings(row);
  }

  private presentSettings(row: typeof gradingSettings.$inferSelect): Settings {
    return {
      weakBelow: Number(row.weakBelow),
      strongFrom: Number(row.strongFrom),
      overallFailAt: Number(row.overallFailAt),
      subjectFailAt: Number(row.subjectFailAt),
      failSubjectCount: row.failSubjectCount,
      bands: row.bands?.length ? row.bands : defaultBands,
    };
  }

  private parseBands(value: unknown): GradeBand[] {
    if (!Array.isArray(value) || value.length === 0) throw new BadRequestException("Add at least one grade");
    const bands = value.map((item) => {
      const row = item as Record<string, unknown>;
      const grade = required(row.grade, "Grade");
      const lower = numberValue(row.lower, `${grade} lower mark`);
      const upper = numberValue(row.upper, `${grade} upper mark`);
      if (lower > 100 || upper > 100 || lower > upper) throw new BadRequestException(`${grade} needs a lower mark at or below the upper mark, from 0 to 100`);
      return { grade, lower, upper, pass: row.pass === true || row.pass === "true" || row.pass === "PASS" };
    });
    const ordered = [...bands].sort((a, b) => a.lower - b.lower);
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].lower <= ordered[index - 1].upper) throw new BadRequestException("Grade ranges cannot overlap");
    }
    return bands;
  }

  async listHomework(tenantId: string, date?: string, classId?: string, teacherId?: string) {
    const filters = [eq(homework.tenantId, tenantId)];
    if (date) filters.push(eq(homework.homeworkDate, dateKey(date)));
    if (classId) filters.push(eq(homework.classId, classId));
    if (teacherId === "admin") filters.push(sql`${homework.setByEmployeeId} is null`);
    else if (teacherId) filters.push(eq(homework.setByEmployeeId, teacherId));
    const rows = await this.db
      .select({
        id: homework.id,
        homeworkDate: homework.homeworkDate,
        className: classes.name,
        subjectName: subjects.name,
        teacherName: employees.name,
        detail: homework.detail,
        attachmentName: homework.attachmentName,
      })
      .from(homework)
      .innerJoin(classes, eq(classes.id, homework.classId))
      .innerJoin(subjects, eq(subjects.id, homework.subjectId))
      .leftJoin(employees, eq(employees.id, homework.setByEmployeeId))
      .where(and(...filters))
      .orderBy(desc(homework.homeworkDate));
    return rows.map((row) => ({ ...row, teacherName: row.teacherName ?? "Admin" }));
  }

  async createHomework(tenantId: string, body: Record<string, unknown>) {
    const classId = required(body.classId, "Class");
    const subjectId = required(body.subjectId, "Subject");
    await this.requireClass(tenantId, classId);
    await this.requireSubject(tenantId, subjectId, classId);
    const setBy = optionalText(body.setByEmployeeId);
    if (setBy) await this.requireEmployee(tenantId, setBy);
    const file = attachmentFrom(body);
    const [row] = await this.db
      .insert(homework)
      .values({
        tenantId,
        homeworkDate: dateKey(body.date),
        classId,
        subjectId,
        setByEmployeeId: setBy,
        detail: required(body.detail, "Detail"),
        ...file,
      })
      .returning({ id: homework.id });
    return row;
  }

  async updateHomework(tenantId: string, id: string, body: Record<string, unknown>) {
    const current = await this.requireHomework(tenantId, id);
    const classId = required(body.classId, "Class");
    const subjectId = required(body.subjectId, "Subject");
    await this.requireSubject(tenantId, subjectId, classId);
    const setBy = optionalText(body.setByEmployeeId);
    if (setBy) await this.requireEmployee(tenantId, setBy);
    const file = body.attachmentData === undefined && body.attachmentName === undefined
      ? { attachmentName: current.attachmentName, attachmentData: current.attachmentData }
      : attachmentFrom(body);
    await this.db
      .update(homework)
      .set({
        homeworkDate: dateKey(body.date),
        classId,
        subjectId,
        setByEmployeeId: setBy,
        detail: required(body.detail, "Detail"),
        ...file,
        updatedAt: new Date(),
      })
      .where(eq(homework.id, id));
    return { ok: true };
  }

  async homeworkFile(tenantId: string, id: string) {
    const row = await this.requireHomework(tenantId, id);
    if (!row.attachmentData) throw new NotFoundException("This homework has no attachment");
    return { name: row.attachmentName, data: row.attachmentData };
  }

  async deleteHomework(tenantId: string, id: string) {
    await this.requireHomework(tenantId, id);
    await this.db.delete(homework).where(eq(homework.id, id));
    return { ok: true };
  }

  async listExams(tenantId: string) {
    return this.db.select().from(exams).where(eq(exams.tenantId, tenantId)).orderBy(desc(exams.startDate));
  }

  async createExam(tenantId: string, body: Record<string, unknown>) {
    const startDate = dateKey(body.startDate, "Start date");
    const endDate = dateKey(body.endDate, "End date");
    if (startDate > endDate) throw new BadRequestException("The start date is after the end date");
    const [row] = await this.db
      .insert(exams)
      .values({ tenantId, name: required(body.name, "Exam name"), startDate, endDate, status: "published" })
      .returning();
    return row;
  }

  async updateExam(tenantId: string, id: string, body: Record<string, unknown>) {
    await this.requireExam(tenantId, id);
    const startDate = dateKey(body.startDate, "Start date");
    const endDate = dateKey(body.endDate, "End date");
    if (startDate > endDate) throw new BadRequestException("The start date is after the end date");
    const [row] = await this.db
      .update(exams)
      .set({ name: required(body.name, "Exam name"), startDate, endDate })
      .where(eq(exams.id, id))
      .returning();
    return row;
  }

  async deleteExam(tenantId: string, id: string) {
    await this.requireExam(tenantId, id);
    await this.db.delete(exams).where(eq(exams.id, id));
    return { ok: true };
  }

  async examSetup(tenantId: string, examId: string) {
    await this.requireExam(tenantId, examId);
    const catalog = await this.db
      .select({
        subjectId: subjects.id,
        subjectName: subjects.name,
        classId: classes.id,
        className: classes.name,
        defaultMarks: subjects.totalMarks,
      })
      .from(subjects)
      .innerJoin(classes, eq(classes.id, subjects.classId))
      .where(eq(subjects.tenantId, tenantId))
      .orderBy(asc(classes.name), asc(subjects.name));
    const chosen = await this.db
      .select({ subjectId: examSubjects.subjectId, totalMarks: examSubjects.totalMarks, examDate: examSubjects.examDate, startsAt: examSubjects.startsAt })
      .from(examSubjects)
      .where(and(eq(examSubjects.tenantId, tenantId), eq(examSubjects.examId, examId)));
    const chosenBySubject = new Map(chosen.map((row) => [row.subjectId, row]));
    return {
      subjects: catalog.map((row) => ({
        ...row,
        included: chosenBySubject.has(row.subjectId),
        totalMarks: chosenBySubject.get(row.subjectId)?.totalMarks ?? null,
        examDate: chosenBySubject.get(row.subjectId)?.examDate ?? null,
        startsAt: chosenBySubject.get(row.subjectId)?.startsAt ?? null,
      })),
      emptyMessage: catalog.length ? null : "No subjects assigned to this class yet.",
    };
  }

  async saveExamSetup(tenantId: string, examId: string, body: Record<string, unknown>) {
    const exam = await this.requireExam(tenantId, examId);
    const catalog = await this.examSetup(tenantId, examId);
    if (!catalog.subjects.length) throw new BadRequestException("No subjects assigned to this class yet.");
    const rows = Array.isArray(body.subjects) ? body.subjects : [];
    const known = new Map(catalog.subjects.map((row) => [row.subjectId, row]));
    const values = rows.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const subjectId = required(row.subjectId, "Subject");
      if (!known.has(subjectId) || row.included === false) return [];
      const total = row.totalMarks === null || row.totalMarks === "" || row.totalMarks === undefined ? null : Math.round(numberValue(row.totalMarks, "Total marks"));
      const examDate = typeof row.examDate === "string" && row.examDate ? row.examDate : null;
      const startsAt = typeof row.startsAt === "string" && row.startsAt ? row.startsAt : null;
      if (examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) throw new BadRequestException("Choose a date inside the exam");
      if (examDate && (examDate < exam.startDate || examDate > exam.endDate)) throw new BadRequestException("Choose a date inside the exam");
      if (startsAt && !examDate) throw new BadRequestException("Choose a date for the start time");
      if (startsAt && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startsAt)) throw new BadRequestException("Choose a start time");
      return [{ tenantId, examId, subjectId, totalMarks: total, examDate, startsAt }];
    });
    await this.db.delete(examSubjects).where(and(eq(examSubjects.tenantId, tenantId), eq(examSubjects.examId, examId)));
    if (values.length) await this.db.insert(examSubjects).values(values);
    return { ok: true };
  }

  async examSchedule(tenantId: string) {
    const rows = await this.sittings(tenantId);
    return rows;
  }

  async dateSheet(tenantId: string, examId: string) {
    const exam = await this.requireExam(tenantId, examId);
    const rows = (await this.sittings(tenantId)).filter((row) => row.examId === examId);
    return { exam, rows };
  }

  async examMarkSheet(tenantId: string, examId: string, classId: string) {
    await this.requireExam(tenantId, examId);
    const classroom = await this.requireClass(tenantId, classId);
    const subjectRows = await this.examSubjectTotals(tenantId, examId, classId);
    if (!subjectRows.length) throw new BadRequestException("No subjects assigned to this class yet.");
    const people = await this.activeStudents(tenantId, classId);
    const marks = people.length
      ? await this.db
          .select({ studentId: examMarks.studentId, subjectId: examMarks.subjectId, obtained: examMarks.obtained })
          .from(examMarks)
          .where(and(eq(examMarks.tenantId, tenantId), eq(examMarks.examId, examId), inArray(examMarks.studentId, people.map((person) => person.id))))
      : [];
    return { className: classroom.name, subjects: subjectRows, students: people, marks };
  }

  async saveExamMarks(tenantId: string, examId: string, body: Record<string, unknown>) {
    await this.requireExam(tenantId, examId);
    const classId = required(body.classId, "Class");
    const sheet = await this.examMarkSheet(tenantId, examId, classId);
    const totals = new Map(sheet.subjects.map((subject) => [subject.subjectId, subject.total]));
    const people = new Set(sheet.students.map((student) => student.id));
    const incoming = Array.isArray(body.marks) ? body.marks : [];
    await this.db.transaction(async (tx) => {
      for (const item of incoming) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const studentId = required(row.studentId, "Student");
        const subjectId = required(row.subjectId, "Subject");
        if (!people.has(studentId) || !totals.has(subjectId)) throw new BadRequestException("That mark is outside this class sheet");
        if (row.obtained === "" || row.obtained === null || row.obtained === undefined) {
          await tx.delete(examMarks).where(and(eq(examMarks.examId, examId), eq(examMarks.studentId, studentId), eq(examMarks.subjectId, subjectId)));
          continue;
        }
        const obtained = numberValue(row.obtained, "Marks");
        const total = totals.get(subjectId) ?? 0;
        if (obtained > total) throw new BadRequestException(`Marks cannot be above ${total}`);
        await tx
          .insert(examMarks)
          .values({ tenantId, examId, studentId, subjectId, obtained: obtained.toFixed(2) })
          .onConflictDoUpdate({
            target: [examMarks.examId, examMarks.studentId, examMarks.subjectId],
            set: { obtained: obtained.toFixed(2) },
          });
      }
    });
    return { ok: true };
  }

  async deleteExamMarks(tenantId: string, examId: string, studentId?: string, subjectId?: string) {
    await this.requireExam(tenantId, examId);
    const filters = [eq(examMarks.tenantId, tenantId), eq(examMarks.examId, examId)];
    if (studentId) filters.push(eq(examMarks.studentId, studentId));
    if (subjectId) filters.push(eq(examMarks.subjectId, subjectId));
    await this.db.delete(examMarks).where(and(...filters));
    return { ok: true };
  }

  async examResult(tenantId: string, examId: string, registration: string) {
    const exam = await this.requireExam(tenantId, examId);
    const student = await this.studentByRegistration(tenantId, registration);
    const card = await this.oneResult(tenantId, exam, student);
    return card;
  }

  async recentResults(tenantId: string, registration: string, last: number) {
    const count = Math.min(4, Math.max(2, Math.round(last)));
    const student = await this.studentByRegistration(tenantId, registration);
    const list = await this.db.select().from(exams).where(eq(exams.tenantId, tenantId)).orderBy(desc(exams.startDate)).limit(count);
    const cards = [];
    for (const exam of list) cards.push(await this.oneResult(tenantId, exam, student));
    return { registration: student.registrationNo, name: student.name, exams: cards };
  }

  async resultSheet(tenantId: string, examId: string, classId: string) {
    const exam = await this.requireExam(tenantId, examId);
    const sheet = await this.examMarkSheet(tenantId, examId, classId);
    const settings = await this.readSettings(tenantId);
    const rows = sheet.students.map((student) => {
      const own = sheet.marks.filter((mark) => mark.studentId === student.id);
      const total = sheet.subjects.reduce((sum, subject) => sum + subject.total, 0);
      const obtained = own.length ? round2(own.reduce((sum, mark) => sum + Number(mark.obtained), 0)) : null;
      const percent = obtained === null || !total ? null : round2((obtained / total) * 100);
      const graded = percent === null ? null : this.overallStatus(percent, own.map((mark) => ({ percent: (Number(mark.obtained) / (sheet.subjects.find((subject) => subject.subjectId === mark.subjectId)?.total || 1)) * 100 })), settings);
      return {
        registrationNo: student.registrationNo,
        name: student.name,
        marks: sheet.subjects.map((subject) => {
          const mark = own.find((row) => row.subjectId === subject.subjectId);
          return { subjectId: subject.subjectId, obtained: mark ? Number(mark.obtained) : null };
        }),
        obtained,
        total,
        percent,
        grade: graded?.grade ?? null,
        status: graded?.status ?? null,
      };
    });
    return { exam, className: sheet.className, subjects: sheet.subjects, rows };
  }

  async blankAward(tenantId: string, examId: string, classId: string) {
    const exam = await this.requireExam(tenantId, examId);
    const sheet = await this.examMarkSheet(tenantId, examId, classId);
    return { exam, className: sheet.className, subjects: sheet.subjects, students: sheet.students };
  }

  async testSheet(tenantId: string, classId: string, subjectId: string, dateRaw: string) {
    const date = dateKey(dateRaw);
    const classroom = await this.requireClass(tenantId, classId);
    const subject = await this.requireSubject(tenantId, subjectId, classId);
    const people = await this.activeStudents(tenantId, classId);
    const [test] = await this.db
      .select()
      .from(classTests)
      .where(and(eq(classTests.tenantId, tenantId), eq(classTests.classId, classId), eq(classTests.subjectId, subjectId), eq(classTests.testDate, date)))
      .limit(1);
    const marks = test
      ? await this.db.select().from(classTestMarks).where(eq(classTestMarks.testId, test.id))
      : [];
    return {
      className: classroom.name,
      subjectName: subject.name,
      date,
      totalMarks: test ? Number(test.totalMarks) : subject.totalMarks,
      saved: Boolean(test),
      students: people.map((person) => ({
        ...person,
        obtained: marks.find((mark) => mark.studentId === person.id)?.obtained ?? "",
      })),
    };
  }

  async saveTest(tenantId: string, body: Record<string, unknown>) {
    const classId = required(body.classId, "Class");
    const subjectId = required(body.subjectId, "Subject");
    const date = dateKey(body.date);
    await this.requireSubject(tenantId, subjectId, classId);
    const total = numberValue(body.totalMarks, "Total marks");
    if (total <= 0) throw new BadRequestException("Total marks must be more than zero");
    const people = await this.activeStudents(tenantId, classId);
    const incoming = Array.isArray(body.marks) ? body.marks : [];
    const byStudent = new Map<string, number>();
    for (const item of incoming) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const studentId = required(row.studentId, "Student");
      if (!people.some((person) => person.id === studentId)) throw new BadRequestException("That student is not in this class");
      if (row.obtained === "" || row.obtained === null || row.obtained === undefined) continue;
      const obtained = numberValue(row.obtained, "Obtained marks");
      if (obtained > total) throw new BadRequestException(`Marks cannot be above ${total}`);
      byStudent.set(studentId, obtained);
    }
    const [existing] = await this.db
      .select()
      .from(classTests)
      .where(and(eq(classTests.tenantId, tenantId), eq(classTests.classId, classId), eq(classTests.subjectId, subjectId), eq(classTests.testDate, date)))
      .limit(1);
    await this.db.transaction(async (tx) => {
      const testId = existing
        ? existing.id
        : (await tx.insert(classTests).values({ tenantId, classId, subjectId, testDate: date, totalMarks: total.toFixed(2) }).returning({ id: classTests.id }))[0].id;
      if (existing) {
        await tx.update(classTests).set({ totalMarks: total.toFixed(2) }).where(eq(classTests.id, existing.id));
        await tx.delete(classTestMarks).where(eq(classTestMarks.testId, existing.id));
      }
      if (byStudent.size) {
        await tx.insert(classTestMarks).values([...byStudent.entries()].map(([studentId, obtained]) => ({ testId, studentId, obtained: obtained.toFixed(2) })));
      }
    });
    return { message: existing ? "Test updated." : "Test saved." };
  }

  async deleteTest(tenantId: string, classId: string, subjectId: string, dateRaw: string) {
    const date = dateKey(dateRaw);
    const [test] = await this.db
      .select({ id: classTests.id })
      .from(classTests)
      .where(and(eq(classTests.tenantId, tenantId), eq(classTests.classId, classId), eq(classTests.subjectId, subjectId), eq(classTests.testDate, date)))
      .limit(1);
    if (!test) throw new NotFoundException("No test results found for this class.");
    await this.db.delete(classTests).where(eq(classTests.id, test.id));
    return { ok: true };
  }

  async testResults(tenantId: string, filters: { classId?: string; subjectId?: string; registration?: string; from?: string; to?: string }) {
    const where = [eq(classTests.tenantId, tenantId)];
    if (filters.classId) where.push(eq(classTests.classId, filters.classId));
    if (filters.subjectId) where.push(eq(classTests.subjectId, filters.subjectId));
    if (filters.registration) where.push(eq(students.registrationNo, filters.registration.trim()));
    if (filters.from) where.push(gte(classTests.testDate, dateKey(filters.from, "From")));
    if (filters.to) where.push(lte(classTests.testDate, dateKey(filters.to, "To")));
    const rows = await this.db
      .select({
        registrationNo: students.registrationNo,
        name: students.name,
        className: classes.name,
        subjectName: subjects.name,
        date: classTests.testDate,
        total: classTests.totalMarks,
        obtained: classTestMarks.obtained,
      })
      .from(classTestMarks)
      .innerJoin(classTests, eq(classTests.id, classTestMarks.testId))
      .innerJoin(students, eq(students.id, classTestMarks.studentId))
      .innerJoin(classes, eq(classes.id, classTests.classId))
      .innerJoin(subjects, eq(subjects.id, classTests.subjectId))
      .where(and(...where))
      .orderBy(desc(classTests.testDate), asc(students.registrationNo));
    return rows.map((row) => ({
      ...row,
      total: Number(row.total),
      obtained: Number(row.obtained),
      percent: round2((Number(row.obtained) / Number(row.total)) * 100),
    }));
  }

  async testPerformance(tenantId: string, classId: string) {
    const classroom = await this.requireClass(tenantId, classId);
    const settings = await this.readSettings(tenantId);
    const rows = await this.testResults(tenantId, { classId });
    if (!rows.length) return { className: classroom.name, message: "No test results found for this class.", students: [], subjects: [] };
    const byStudent = new Map<string, { registrationNo: string; name: string; percents: number[]; strong: string[]; weak: string[] }>();
    const bySubject = new Map<string, { strong: number; total: number }>();
    for (const row of rows) {
      const person = byStudent.get(row.registrationNo) ?? { registrationNo: row.registrationNo, name: row.name, percents: [], strong: [], weak: [] };
      person.percents.push(row.percent);
      if (row.percent >= settings.strongFrom && !person.strong.includes(row.subjectName)) person.strong.push(row.subjectName);
      if (row.percent < settings.weakBelow && !person.weak.includes(row.subjectName)) person.weak.push(row.subjectName);
      byStudent.set(row.registrationNo, person);
      const subject = bySubject.get(row.subjectName) ?? { strong: 0, total: 0 };
      subject.total += 1;
      if (row.percent >= settings.strongFrom) subject.strong += 1;
      bySubject.set(row.subjectName, subject);
    }
    return {
      className: classroom.name,
      message: null,
      weakBelow: settings.weakBelow,
      strongFrom: settings.strongFrom,
      students: [...byStudent.values()].map((person) => ({
        registrationNo: person.registrationNo,
        name: person.name,
        strongSubjects: person.strong,
        weakSubjects: person.weak,
        averagePercent: round2(person.percents.reduce((sum, value) => sum + value, 0) / person.percents.length),
      })),
      subjects: [...bySubject.entries()].map(([name, value]) => ({ name, strongPercent: round2((value.strong / value.total) * 100) })),
    };
  }

  async reportCard(tenantId: string, registration: string) {
    const student = await this.studentByRegistration(tenantId, registration);
    const settings = await this.readSettings(tenantId);
    const classmates = await this.activeStudents(tenantId, student.classId);
    const attendance = await this.db
      .select({ status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.studentId, student.id)));
    const attendancePercent = attendance.length ? round2((attendance.filter((row) => row.status === "present").length / attendance.length) * 100) : null;
    const examList = await this.db.select().from(exams).where(eq(exams.tenantId, tenantId)).orderBy(desc(exams.startDate));
    const cognitive = [];
    for (const exam of examList) {
      const card = await this.oneResult(tenantId, exam, student);
      if (!card.empty) cognitive.push(card);
    }
    const tests = await this.testResults(tenantId, { registration: student.registrationNo });
    const testPercent = tests.length ? round2(tests.reduce((sum, row) => sum + row.percent, 0) / tests.length) : null;
    const examPercent = cognitive.length ? round2(cognitive.reduce((sum, card) => sum + (card.percent ?? 0), 0) / cognitive.length) : null;
    const affective = await this.domainBlock(tenantId, student.id, "affective", affectiveTraits);
    const psychomotor = await this.domainBlock(tenantId, student.id, "psychomotor", psychomotorTraits);
    const rated = [
      attendancePercent === null ? null : { name: "Attendance", percent: attendancePercent },
      examPercent === null ? null : { name: "Exams", percent: examPercent },
      testPercent === null ? null : { name: "Class tests", percent: testPercent },
      affective.percent === null ? null : { name: "Affective", percent: affective.percent },
      psychomotor.percent === null ? null : { name: "Psychomotor", percent: psychomotor.percent },
    ].filter((section): section is { name: string; percent: number } => section !== null);
    const overallPercent = rated.length ? round2(rated.reduce((sum, section) => sum + section.percent, 0) / rated.length) : null;
    const overall = overallPercent === null ? null : this.overallStatus(overallPercent, [], settings);
    const ranks = await Promise.all(classmates.map(async (person) => ({ id: person.id, percent: (await this.sectionPercents(tenantId, person.id, person.registrationNo)).overall })));
    const ranked = ranks.filter((row) => row.percent !== null).sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
    const position = overallPercent === null ? null : ranked.findIndex((row) => row.id === student.id) + 1;
    const percents = ranked.map((row) => row.percent ?? 0);
    return {
      student: {
        registrationNo: student.registrationNo,
        name: student.name,
        className: student.className,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        admissionDate: student.admissionDate,
      },
      attendance: attendancePercent === null ? "not rated" : `${attendancePercent}%`,
      exams: cognitive,
      classTests: tests,
      affective,
      psychomotor,
      ratedSections: rated,
      unmarkedSections: [
        attendancePercent === null ? "Attendance" : null,
        examPercent === null ? "Exams" : null,
        testPercent === null ? "Class tests" : null,
        affective.percent === null ? "Affective" : null,
        psychomotor.percent === null ? "Psychomotor" : null,
      ].filter((name): name is string => name !== null),
      overallPercent,
      grade: overall?.grade ?? "not rated",
      status: overall?.status ?? "not rated",
      outOf5: overallPercent === null ? "not rated" : round1(overallPercent / 20),
      position,
      classComparison: percents.length
        ? {
            strength: classmates.length,
            average: round2(percents.reduce((sum, value) => sum + value, 0) / percents.length),
            max: round2(Math.max(...percents)),
            min: round2(Math.min(...percents)),
            position,
          }
        : null,
    };
  }

  async progressReport(tenantId: string, classId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)) {
      throw new BadRequestException("Choose a class");
    }
    const classroom = await this.requireClass(tenantId, classId);
    const people = await this.activeStudents(tenantId, classroom.id);
    const examList = await this.db.select().from(exams).where(eq(exams.tenantId, tenantId)).orderBy(asc(exams.startDate));
    if (!people.length) return { className: classroom.name, exams: examList.map((exam) => exam.name), students: [], message: "No active students." };
    const settings = await this.readSettings(tenantId);
    const students = [];
    for (const person of people) {
      const full = await this.studentById(tenantId, person.id);
      const sections = await this.sectionPercents(tenantId, person.id, person.registrationNo);
      const affective = await this.domainBlock(tenantId, person.id, "affective", affectiveTraits);
      const psychomotor = await this.domainBlock(tenantId, person.id, "psychomotor", psychomotorTraits);
      const examRows = [];
      for (const exam of examList) {
        const card = await this.oneResult(tenantId, exam, full);
        examRows.push({
          name: exam.name,
          percent: card.empty ? null : card.percent,
          grade: card.empty ? null : card.grade,
          status: card.empty ? null : card.status,
        });
      }
      const graded = sections.overall === null ? null : this.overallStatus(sections.overall, [], settings);
      students.push({
        registrationNo: person.registrationNo,
        name: person.name,
        attendancePercent: sections.attendancePercent,
        testPercent: sections.testPercent,
        affectivePercent: affective.percent,
        psychomotorPercent: psychomotor.percent,
        overallPercent: sections.overall,
        grade: graded?.grade ?? "not rated",
        exams: examRows,
      });
    }
    return { className: classroom.name, exams: examList.map((exam) => exam.name), students, message: null };
  }

  async listTemplates(tenantId: string) {
    const rows = await this.db
      .select()
      .from(certificateTemplates)
      .where(eq(certificateTemplates.tenantId, tenantId))
      .orderBy(asc(certificateTemplates.name));
    if (rows.length) return rows;
    const [created] = await this.db.insert(certificateTemplates).values({ tenantId, ...defaultCertificateTemplate }).returning();
    return [created];
  }

  async saveTemplate(tenantId: string, body: Record<string, unknown>, id?: string) {
    const values = this.templateValues(body);
    try {
      if (!id) {
        const [row] = await this.db.insert(certificateTemplates).values({ tenantId, ...values }).returning();
        return row;
      }
      const [row] = await this.db
        .update(certificateTemplates)
        .set(values)
        .where(and(eq(certificateTemplates.id, id), eq(certificateTemplates.tenantId, tenantId)))
        .returning();
      if (!row) throw new NotFoundException("Template not found");
      return row;
    } catch (error) {
      if (this.unique(error)) throw new ConflictException("A template with this name already exists.");
      throw error;
    }
  }

  async deleteTemplate(tenantId: string, id: string) {
    const rows = await this.listTemplates(tenantId);
    if (rows.length <= 1) throw new BadRequestException("Keep at least one certificate template.");
    const [row] = await this.db
      .delete(certificateTemplates)
      .where(and(eq(certificateTemplates.id, id), eq(certificateTemplates.tenantId, tenantId)))
      .returning({ id: certificateTemplates.id });
    if (!row) throw new NotFoundException("Template not found");
    return { ok: true };
  }

  async listCertificates(tenantId: string) {
    const rows = await this.db
      .select({
        id: certificates.id,
        template: certificates.template,
        recipientType: certificates.recipientType,
        studentName: students.name,
        employeeName: employees.name,
        certificateDate: certificates.certificateDate,
        reason: certificates.reason,
      })
      .from(certificates)
      .leftJoin(students, eq(students.id, certificates.studentId))
      .leftJoin(employees, eq(employees.id, certificates.employeeId))
      .where(eq(certificates.tenantId, tenantId))
      .orderBy(desc(certificates.certificateDate));
    return rows.map((row) => ({
      ...row,
      recipient: row.recipientType === "student" ? row.studentName : row.employeeName,
    }));
  }

  async createCertificate(tenantId: string, body: Record<string, unknown>) {
    const recipientType = required(body.recipientType, "Recipient type");
    if (recipientType !== "student" && recipientType !== "staff") {
      throw new BadRequestException("Recipient type must be student or staff");
    }
    const templates = await this.listTemplates(tenantId);
    const templateName = optionalText(body.template) ?? templates[0]?.name ?? defaultCertificateTemplate.name;
    if (!templates.some((item) => item.name.toLowerCase() === templateName.toLowerCase())) {
      throw new BadRequestException("Choose a certificate template");
    }
    const studentId = recipientType === "student" ? required(body.studentId, "Student") : null;
    const employeeId = recipientType === "staff" ? required(body.employeeId, "Staff") : null;
    if (studentId) await this.studentById(tenantId, studentId);
    if (employeeId) await this.requireEmployee(tenantId, employeeId);
    const [row] = await this.db
      .insert(certificates)
      .values({
        tenantId,
        template: templateName,
        recipientType,
        studentId,
        employeeId,
        reason: required(body.reason, "Reason"),
        certificateDate: dateKey(body.date, "Certificate date"),
        conduct: required(body.conduct, "Conduct"),
        duesNote: required(body.duesNote, "Dues note"),
      })
      .returning({ id: certificates.id });
    return row;
  }

  async certificatePrint(tenantId: string, id: string) {
    const [row] = await this.db.select().from(certificates).where(and(eq(certificates.id, id), eq(certificates.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Certificate not found");
    const templates = await this.listTemplates(tenantId);
    const template = templates.find((item) => item.name.toLowerCase() === row.template.toLowerCase());
    const [institute] = await this.db.select({ name: institutes.name }).from(institutes).where(eq(institutes.tenantId, tenantId)).limit(1);
    if (row.recipientType === "student" && row.studentId) {
      const student = await this.studentById(tenantId, row.studentId);
      return {
        template: row.template,
        recipientType: row.recipientType,
        date: row.certificateDate,
        reason: row.reason,
        conduct: row.conduct,
        duesNote: row.duesNote,
        name: student.name,
        fatherName: student.fatherName,
        admissionNumber: student.registrationNo,
        className: student.className,
        dateOfBirth: student.dateOfBirth,
        admissionDate: student.admissionDate,
        text: this.renderCertificate(template?.body ?? defaultCertificateTemplate.body, {
          name: student.name,
          father: student.fatherName ?? "",
          admissionNumber: student.registrationNo,
          className: student.className,
          dateOfBirth: student.dateOfBirth ?? "",
          admissionDate: student.admissionDate,
          date: row.certificateDate,
          reason: row.reason,
          conduct: row.conduct,
          dues: row.duesNote,
          institute: institute?.name ?? "",
        }),
      };
    }
    const employee = row.employeeId ? await this.requireEmployee(tenantId, row.employeeId) : null;
    const name = employee?.name ?? "N/A";
    return {
      template: row.template,
      recipientType: row.recipientType,
      date: row.certificateDate,
      reason: row.reason,
      conduct: row.conduct,
      duesNote: row.duesNote,
      name,
      text: this.renderCertificate(template?.body ?? defaultCertificateTemplate.body, {
        name,
        father: "",
        admissionNumber: "",
        className: "",
        dateOfBirth: "",
        admissionDate: "",
        date: row.certificateDate,
        reason: row.reason,
        conduct: row.conduct,
        dues: row.duesNote,
        institute: institute?.name ?? "",
      }),
    };
  }

  async admissionLetter(tenantId: string, studentId: string, reveal: boolean) {
    const student = await this.studentById(tenantId, studentId);
    const frame = await this.letterFrame(tenantId, "student");
    const login = await this.studentPortal(tenantId, student.id, `s${student.registrationNo.replace(/[^a-z0-9]/gi, "").toLowerCase() || "student"}`, reveal);
    return {
      title: "Admission letter",
      ...frame,
      name: student.name,
      lines: [
        `Registration ${student.registrationNo}`,
        `Class ${student.className}`,
        `Guardian ${student.fatherName || "—"}`,
        `Admitted ${student.admissionDate}`,
      ],
      ...login,
    };
  }

  async admissionLetterFor(user: AuthUser, studentId: string, reveal: boolean) {
    if (user.role === "student" || user.role === "parent") {
      const linked = await linkedStudentIds(this.db, user);
      if (!linked.has(studentId)) throw new ForbiddenException("That student record is not linked to this login.");
    }
    return this.admissionLetter(user.tenantId, studentId, reveal);
  }

  async assertOwnRegistration(user: AuthUser, registration: string) {
    if (user.role !== "student" && user.role !== "parent") return;
    const [row] = await this.db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.tenantId, user.tenantId), eq(students.registrationNo, registration.trim())))
      .limit(1);
    if (!row) throw new NotFoundException("Student not found");
    const linked = await linkedStudentIds(this.db, user);
    if (!linked.has(row.id)) throw new ForbiddenException("That student record is not linked to this login.");
  }

  async jobLetter(tenantId: string, employeeId: string, reveal: boolean) {
    const [employee] = await this.db
      .select({ id: employees.id, name: employees.name, phone: employees.phone, joiningDate: employees.joiningDate, staffRole: employees.staffRole })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
      .limit(1);
    if (!employee) throw new NotFoundException("Employee not found");
    const frame = await this.letterFrame(tenantId, "employee");
    const slug = employee.name.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 16) || "staff";
    const login = await this.employeePortal(tenantId, employee.id, `e${slug}`, reveal);
    return {
      title: "Job letter",
      ...frame,
      name: employee.name,
      lines: [
        `Role ${employee.staffRole.replace(/_/g, " ")}`,
        `Phone ${employee.phone}`,
        `Joined ${employee.joiningDate}`,
      ],
      ...login,
    };
  }

  async deleteCertificate(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: certificates.id }).from(certificates).where(and(eq(certificates.id, id), eq(certificates.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Certificate not found");
    await this.db.delete(certificates).where(eq(certificates.id, id));
    return { ok: true };
  }

  private async oneResult(
    tenantId: string,
    exam: { id: string; name: string; startDate: string; endDate: string },
    student: { id: string; name: string; registrationNo: string; gender: string | null; classId: string },
  ) {
    const subjectRows = await this.examSubjectTotals(tenantId, exam.id, student.classId);
    const marks = await this.db
      .select({ subjectId: examMarks.subjectId, obtained: examMarks.obtained })
      .from(examMarks)
      .where(and(eq(examMarks.tenantId, tenantId), eq(examMarks.examId, exam.id), eq(examMarks.studentId, student.id)));
    if (!marks.length) {
      return { examId: exam.id, examName: exam.name, startDate: exam.startDate, endDate: exam.endDate, empty: true, message: "NO EXAM DATA FOUND YET.", subjects: [], percent: null, grade: null, status: null, sentence: null };
    }
    const settings = await this.readSettings(tenantId);
    const lines = subjectRows.map((subject) => {
      const mark = marks.find((row) => row.subjectId === subject.subjectId);
      if (!mark) return { ...subject, obtained: null, percent: null, grade: null, status: "not rated" };
      const percent = round2((Number(mark.obtained) / subject.total) * 100);
      const graded = this.subjectStatus(percent, settings);
      return { ...subject, obtained: Number(mark.obtained), percent, grade: graded.grade, status: graded.status };
    });
    const marked = lines.filter((line) => line.obtained !== null);
    const obtained = marked.reduce((sum, line) => sum + (line.obtained ?? 0), 0);
    const total = marked.reduce((sum, line) => sum + line.total, 0);
    const percent = round2((obtained / total) * 100);
    const overall = this.overallStatus(percent, marked.map((line) => ({ percent: line.percent ?? 0 })), settings);
    const pronoun = student.gender?.toLowerCase() === "female" ? "She" : student.gender?.toLowerCase() === "male" ? "He" : "He/She";
    return {
      examId: exam.id,
      examName: exam.name,
      startDate: exam.startDate,
      endDate: exam.endDate,
      empty: false,
      message: null,
      registrationNo: student.registrationNo,
      name: student.name,
      subjects: lines,
      obtained: round2(obtained),
      total,
      percent,
      grade: overall.grade,
      status: overall.status,
      sentence: `${pronoun} Scored ${round2(obtained)} out of ${total}… Grade ${overall.grade}… Overall status is ${overall.status}.`,
    };
  }

  private subjectStatus(percent: number, settings: Settings) {
    const band = gradeFor(percent, settings.bands);
    const failed = percent <= settings.subjectFailAt || !band.pass;
    return { grade: band.grade, status: failed ? "FAIL" : "PASS" };
  }

  private overallStatus(percent: number, subjects: Array<{ percent: number }>, settings: Settings) {
    const band = gradeFor(percent, settings.bands);
    const failedSubjects = subjects.filter((subject) => subject.percent <= settings.subjectFailAt).length;
    const failed = percent <= settings.overallFailAt || failedSubjects >= settings.failSubjectCount || !band.pass;
    return { grade: failed ? "F" : band.grade, status: failed ? "FAIL" : "PASS" };
  }

  private async sectionPercents(tenantId: string, studentId: string, registration: string) {
    const attendance = await this.db
      .select({ status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.studentId, studentId)));
    const attendancePercent = attendance.length ? round2((attendance.filter((row) => row.status === "present").length / attendance.length) * 100) : null;
    const tests = await this.testResults(tenantId, { registration });
    const testPercent = tests.length ? round2(tests.reduce((sum, row) => sum + row.percent, 0) / tests.length) : null;
    const examList = await this.db.select().from(exams).where(eq(exams.tenantId, tenantId));
    const examPercents: number[] = [];
    const person = await this.studentById(tenantId, studentId);
    for (const exam of examList) {
      const card = await this.oneResult(tenantId, exam, person);
      if (!card.empty && card.percent !== null) examPercents.push(card.percent);
    }
    const examPercent = examPercents.length ? round2(examPercents.reduce((sum, value) => sum + value, 0) / examPercents.length) : null;
    const affective = await this.domainBlock(tenantId, studentId, "affective", affectiveTraits);
    const psychomotor = await this.domainBlock(tenantId, studentId, "psychomotor", psychomotorTraits);
    const rated = [attendancePercent, examPercent, testPercent, affective.percent, psychomotor.percent].filter((value): value is number => value !== null);
    return { attendancePercent, examPercent, testPercent, overall: rated.length ? round2(rated.reduce((sum, value) => sum + value, 0) / rated.length) : null };
  }

  private async domainBlock(tenantId: string, studentId: string, domain: "affective" | "psychomotor", names: string[]) {
    const rows = await this.db
      .select({ trait: behaviourRatings.trait, rating: behaviourRatings.rating })
      .from(behaviourRatings)
      .where(and(eq(behaviourRatings.tenantId, tenantId), eq(behaviourRatings.studentId, studentId), eq(behaviourRatings.domain, domain)));
    const byTrait = new Map(rows.map((row) => [row.trait, row.rating]));
    const rated = names.filter((name) => byTrait.has(name));
    const percent = rated.length ? round2((rated.reduce((sum, name) => sum + (byTrait.get(name) ?? 0), 0) / (rated.length * 5)) * 100) : null;
    return {
      label: percent === null ? "not rated" : `${percent}%`,
      percent,
      traits: names.map((name) => ({ name, rating: byTrait.get(name) ?? null })),
    };
  }

  private async readSettings(tenantId: string): Promise<Settings> {
    const row = await this.settings(tenantId);
    return row;
  }

  private async examSubjectTotals(tenantId: string, examId: string, classId: string) {
    const rows = await this.db
      .select({
        subjectId: subjects.id,
        subjectName: subjects.name,
        defaultMarks: subjects.totalMarks,
        examTotal: examSubjects.totalMarks,
      })
      .from(examSubjects)
      .innerJoin(subjects, eq(subjects.id, examSubjects.subjectId))
      .where(and(eq(examSubjects.tenantId, tenantId), eq(examSubjects.examId, examId), eq(subjects.classId, classId)));
    return rows.map((row) => ({ subjectId: row.subjectId, subjectName: row.subjectName, total: row.examTotal ?? row.defaultMarks }));
  }

  private async sittings(tenantId: string) {
    const rows = await this.db
      .select({
        examId: exams.id,
        examName: exams.name,
        startDate: exams.startDate,
        endDate: exams.endDate,
        className: classes.name,
        subjectName: subjects.name,
        examDate: examSubjects.examDate,
        startsAt: examSubjects.startsAt,
        totalMarks: examSubjects.totalMarks,
        defaultMarks: subjects.totalMarks,
      })
      .from(examSubjects)
      .innerJoin(exams, eq(exams.id, examSubjects.examId))
      .innerJoin(subjects, eq(subjects.id, examSubjects.subjectId))
      .innerJoin(classes, eq(classes.id, subjects.classId))
      .where(eq(examSubjects.tenantId, tenantId));
    return rows
      .map((row) => ({
        examId: row.examId,
        examName: row.examName,
        startDate: row.startDate,
        endDate: row.endDate,
        className: row.className,
        subjectName: row.subjectName,
        examDate: row.examDate,
        startsAt: row.startsAt,
        total: row.totalMarks ?? row.defaultMarks,
      }))
      .sort((a, b) => {
        const date = (a.examDate ?? "9999-99-99").localeCompare(b.examDate ?? "9999-99-99");
        if (date) return date;
        return (a.startsAt ?? "99:99").localeCompare(b.startsAt ?? "99:99") || a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName);
      });
  }

  private async requireExam(tenantId: string, id: string) {
    const [exam] = await this.db.select().from(exams).where(and(eq(exams.id, id), eq(exams.tenantId, tenantId))).limit(1);
    if (!exam) throw new NotFoundException("Exam not found");
    return exam;
  }

  private async requireClass(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: classes.id, name: classes.name }).from(classes).where(and(eq(classes.id, id), eq(classes.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Class not found.");
    return row;
  }

  private async requireSubject(tenantId: string, id: string, classId?: string) {
    const filters = [eq(subjects.id, id), eq(subjects.tenantId, tenantId)];
    if (classId) filters.push(eq(subjects.classId, classId));
    const [row] = await this.db.select({ id: subjects.id, name: subjects.name, totalMarks: subjects.totalMarks, classId: subjects.classId }).from(subjects).where(and(...filters)).limit(1);
    if (!row) throw new NotFoundException("Subject not found.");
    return row;
  }

  private async requireEmployee(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(and(eq(employees.id, id), eq(employees.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Employee not found");
    return row;
  }

  private async requireHomework(tenantId: string, id: string) {
    const [row] = await this.db.select().from(homework).where(and(eq(homework.id, id), eq(homework.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Homework not found");
    return row;
  }

  private activeStudents(tenantId: string, classId: string) {
    return this.db
      .select({ id: students.id, name: students.name, registrationNo: students.registrationNo, fatherName: students.fatherName })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.classId, classId), eq(students.status, "active")))
      .orderBy(asc(students.registrationNo));
  }

  private async studentByRegistration(tenantId: string, registration: string) {
    const [row] = await this.db
      .select({
        id: students.id,
        name: students.name,
        registrationNo: students.registrationNo,
        classId: students.classId,
        className: classes.name,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        admissionDate: students.admissionDate,
        fatherName: students.fatherName,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, tenantId), eq(students.registrationNo, registration.trim())))
      .limit(1);
    if (!row) throw new NotFoundException("Student not found.");
    return row;
  }

  private async letterFrame(tenantId: string, kind: "student" | "employee") {
    const [institute] = await this.db
      .select({ name: institutes.name, phone: institutes.phone, logoUrl: institutes.logoUrl })
      .from(institutes)
      .where(eq(institutes.tenantId, tenantId))
      .limit(1);
    const [prefs] = await this.db
      .select({ studentRules: schoolPreferences.studentRules, employeeRules: schoolPreferences.employeeRules })
      .from(schoolPreferences)
      .where(eq(schoolPreferences.tenantId, tenantId))
      .limit(1);
    const rules = (kind === "student" ? prefs?.studentRules : prefs?.employeeRules)?.trim();
    return {
      instituteName: institute?.name ?? "",
      institutePhone: institute?.phone ?? "",
      instituteLogo: institute?.logoUrl ?? null,
      rules: rules || "No rules have been saved.",
    };
  }

  private async studentPortal(tenantId: string, id: string, base: string, reveal: boolean) {
    return this.portalLogin("student", tenantId, id, base, reveal);
  }

  private async employeePortal(tenantId: string, id: string, base: string, reveal: boolean) {
    return this.portalLogin("employee", tenantId, id, base, reveal);
  }

  private async portalLogin(kind: "student" | "employee", tenantId: string, id: string, base: string, reveal: boolean) {
    const table = kind === "student" ? students : employees;
    const [current] = await this.db
      .select({ username: table.portalUsername })
      .from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId)))
      .limit(1);
    if (current?.username || !reveal) {
      const username = current?.username ?? null;
      const qrText = username ? `nepatronix:portal:${username}` : "";
      return {
        username,
        password: null as string | null,
        passwordNote: username ? "This password was shown once and is not printed again." : "Open the letter to create the portal login.",
        qrText,
        qrDataUrl: qrText ? await QRCode.toDataURL(qrText, { margin: 1, width: 160 }) : null,
      };
    }
    const password = this.oneTimePassword();
    const username = await this.claimPortal(kind, tenantId, id, base, password);
    const created = username.created;
    const qrText = `nepatronix:portal:${username.username}`;
    return {
      username: username.username,
      password: created ? password : null,
      passwordNote: created ? "This password is shown once. A reprinted letter does not include it." : "This password was shown once and is not printed again.",
      qrText,
      qrDataUrl: await QRCode.toDataURL(qrText, { margin: 1, width: 160 }),
    };
  }

  private async claimPortal(kind: "student" | "employee", tenantId: string, id: string, base: string, password: string) {
    const table = kind === "student" ? students : employees;
    let username = base.slice(0, 24);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [row] = await this.db
          .update(table)
          .set({ portalUsername: username, portalPasswordHash: hashPassword(password) })
          .where(and(eq(table.id, id), eq(table.tenantId, tenantId), isNull(table.portalUsername)))
          .returning({ username: table.portalUsername });
        if (!row?.username) {
          const [existing] = await this.db.select({ username: table.portalUsername }).from(table).where(eq(table.id, id)).limit(1);
          return { username: existing?.username ?? username, created: false };
        }
        return { username: row.username, created: true };
      } catch (error) {
        if (!this.unique(error)) throw error;
        username = `${base.slice(0, 18)}${randomBytes(2).toString("hex")}`;
      }
    }
    throw new BadRequestException("Could not create a portal username");
  }

  private oneTimePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    return [...randomBytes(12)].map((byte) => alphabet[byte % alphabet.length]).join("");
  }

  private templateValues(body: Record<string, unknown>) {
    const name = required(body.name, "Template name");
    const templateBody = required(body.body, "Template text");
    if (!templateBody.includes("{name}")) throw new BadRequestException("The template text must include {name}");
    return {
      name,
      body: templateBody,
      conduct: required(body.conduct, "Conduct"),
      duesNote: required(body.duesNote, "Dues note"),
    };
  }

  private renderCertificate(body: string, values: Record<string, string>) {
    let text = body;
    for (const [key, value] of Object.entries(values)) text = text.replaceAll(`{${key}}`, value);
    return text
      .replace(/, child of (?=,| is)/g, "")
      .replace(/, admission number (?=,| is)/g, "")
      .replace(/, class (?=,| is)/g, "")
      .replace(/, born (?=,| is)/g, "")
      .replace(/, admitted (?=,| is)/g, "")
      .replace(/ +/g, " ")
      .replace(/ ,/g, ",")
      .trim();
  }

  private unique(error: unknown) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code === "23505" || (error as { code?: string }).code === "23505";
  }

  private async studentById(tenantId: string, id: string) {
    const [row] = await this.db
      .select({
        id: students.id,
        name: students.name,
        registrationNo: students.registrationNo,
        classId: students.classId,
        className: classes.name,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        admissionDate: students.admissionDate,
        fatherName: students.fatherName,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, tenantId), eq(students.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException("Student not found.");
    return row;
  }
}
