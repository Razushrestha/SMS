import { randomBytes } from "crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import QRCode from "qrcode";
import {
  chatMessages,
  chatReads,
  chats,
  classes,
  employees,
  meetings,
  smsAccounts,
  smsMessages,
  smsOptOuts,
  smsTemplates,
  students,
  type Database,
} from "@nepatronix/db";
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";
import { hashToken } from "../auth/session";
import { DB } from "../db/db.module";

const audiences = ["all_students", "all_employees", "all_teachers", "class", "student", "employee"] as const;
type Audience = (typeof audiences)[number];
const allowedMime = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${label} is required`);
  return value.trim();
}

function optional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function limited(value: unknown, label: string, max = 260) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new BadRequestException(`${label} is limited to ${max} characters`);
  return text;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function clock() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function attachmentFrom(body: Record<string, unknown>) {
  const name = optional(body.attachmentName);
  const data = optional(body.attachmentData);
  if (!data) return { attachmentName: null, attachmentData: null };
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match || !allowedMime.has(match[1])) throw new BadRequestException("Attachment must be a JPG, PNG, GIF, WEBP, or PDF");
  if (Math.floor((match[2].length * 3) / 4) > 100 * 1024) throw new BadRequestException("Attachment must be 100 KB or smaller");
  return { attachmentName: name ?? "attachment", attachmentData: data };
}

@Injectable()
export class MessagesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listChats(user: AuthUser, search?: string, archived = false) {
    const rows = await this.db.select().from(chats).where(eq(chats.tenantId, user.tenantId)).orderBy(desc(chats.updatedAt));
    const own = user.role === "parent" || user.role === "student" ? await linkedStudentIds(this.db, user) : null;
    const classIds = own?.size
      ? new Set(
          (
            await this.db
              .select({ classId: students.classId })
              .from(students)
              .where(and(eq(students.tenantId, user.tenantId), inArray(students.id, [...own])))
          ).map((row) => row.classId),
        )
      : null;
    const visible = rows
      .filter((row) => (archived ? row.archivedAt : !row.archivedAt))
      .filter((row) => {
        if (!own) return true;
        if (row.audience === "all_students") return true;
        if (row.audience === "student" && row.studentId && own.has(row.studentId)) return true;
        if (row.audience === "class" && row.classId && classIds?.has(row.classId)) return true;
        return false;
      });
    const unread = await this.unreadMap(user.tenantId, user.id, visible.map((row) => row.id));
    const query = search?.trim().toLowerCase();
    const filtered = query ? visible.filter((row) => row.title.toLowerCase().includes(query)) : visible;
    return {
      unread: [...unread.values()].reduce((sum, count) => sum + count, 0),
      chats: filtered.map((row) => ({
        id: row.id,
        title: row.title,
        audience: row.audience,
        group: row.audience === "all_students" || row.audience === "all_employees" || row.audience === "all_teachers" || row.audience === "class",
        updatedAt: row.updatedAt,
        unread: unread.get(row.id) ?? 0,
        archived: Boolean(row.archivedAt),
      })),
    };
  }

  async createChat(tenantId: string, userId: string, senderName: string, body: Record<string, unknown>) {
    const audience = this.audience(body.audience);
    const text = limited(body.message, "Message");
    const file = attachmentFrom(body);
    if (!text && !file.attachmentData) throw new BadRequestException("Message is required");
    const target = await this.target(tenantId, audience, body);
    const chat = await this.findOrCreate(tenantId, userId, audience, target);
    await this.insertMessage(tenantId, chat.id, userId, senderName, text, file);
    return { id: chat.id };
  }

  async leaveStudentNote(tenantId: string, studentId: string, body: string) {
    const [student] = await this.db.select({ id: students.id, name: students.name }).from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).limit(1);
    if (!student) return;
    const chat = await this.findOrCreate(tenantId, null, "student", { classId: null, studentId, employeeId: null, title: student.name });
    await this.insertMessage(tenantId, chat.id, null, "School", body, { attachmentName: null, attachmentData: null });
  }

  async openChat(user: AuthUser, chatId: string) {
    const chat = await this.requireChat(user.tenantId, chatId);
    await this.visibleTo(user, chat);
    const messages = await this.db.select({
      id: chatMessages.id,
      senderName: chatMessages.senderName,
      senderUserId: chatMessages.senderUserId,
      body: chatMessages.body,
      attachmentName: chatMessages.attachmentName,
      createdAt: chatMessages.createdAt,
    }).from(chatMessages).where(eq(chatMessages.chatId, chatId)).orderBy(asc(chatMessages.createdAt));
    await this.markRead(user.id, chatId);
    return {
      id: chat.id,
      title: chat.title,
      audience: chat.audience,
      group: chat.audience !== "student" && chat.audience !== "employee",
      archived: Boolean(chat.archivedAt),
      messages: messages.map((row) => ({ ...row, mine: row.senderUserId === user.id })),
    };
  }

  async postMessage(tenantId: string, userId: string, senderName: string, chatId: string, body: Record<string, unknown>) {
    const chat = await this.requireChat(tenantId, chatId);
    if (chat.archivedAt) throw new BadRequestException("This chat is archived");
    const text = limited(body.message, "Message");
    const file = attachmentFrom(body);
    if (!text && !file.attachmentData) return { ignored: true };
    await this.insertMessage(tenantId, chatId, userId, senderName, text, file);
    return { ignored: false };
  }

  async file(tenantId: string, messageId: string) {
    const [row] = await this.db.select().from(chatMessages).where(and(eq(chatMessages.id, messageId), eq(chatMessages.tenantId, tenantId))).limit(1);
    if (!row?.attachmentData) throw new NotFoundException("This message has no attachment");
    return { name: row.attachmentName, data: row.attachmentData };
  }

  async archiveChat(tenantId: string, chatId: string) {
    await this.requireChat(tenantId, chatId);
    await this.db.update(chats).set({ archivedAt: new Date() }).where(eq(chats.id, chatId));
    return { ok: true };
  }

  async deleteChat(tenantId: string, chatId: string) {
    await this.requireChat(tenantId, chatId);
    await this.db.delete(chats).where(eq(chats.id, chatId));
    return { ok: true };
  }

  async listMeetings(user: AuthUser, filter = "all") {
    const tenantId = user.tenantId;
    const userId = user.id;
    const rows = await this.db.select().from(meetings).where(eq(meetings.tenantId, tenantId)).orderBy(desc(meetings.createdAt));
    const day = today();
    const next = tomorrow();
    const linked = user.role === "student" || user.role === "parent" ? await linkedStudentIds(this.db, user) : null;
    const classIds = linked?.size
      ? new Set(
          (
            await this.db
              .select({ classId: students.classId })
              .from(students)
              .where(and(eq(students.tenantId, tenantId), inArray(students.id, [...linked])))
          ).map((row) => row.classId),
        )
      : null;
    const filtered = rows.filter((row) => {
      if (linked) {
        const forStudent =
          row.audience === "all_students" ||
          (row.audience === "student" && row.studentId && linked.has(row.studentId)) ||
          (row.audience === "class" && row.classId && classIds?.has(row.classId));
        if (!forStudent) return false;
      }
      if (filter === "today") return row.meetingDate === day;
      if (filter === "tomorrow") return row.meetingDate === next;
      if (filter === "self") return row.hostUserId === userId;
      if (filter === "invitations") return row.hostUserId !== userId;
      return true;
    });
    return filtered.map((row) => ({
      id: row.id,
      title: row.title,
      meetingCode: row.meetingCode,
      audience: this.audienceLabel(row.audience),
      date: row.meetingDate,
      time: row.startTime,
      duration: row.duration,
      message: row.message,
      active: row.active,
      host: row.hostUserId === userId,
    }));
  }

  async createMeeting(tenantId: string, userId: string, senderName: string, body: Record<string, unknown>) {
    const scheduled = body.scheduled === true;
    const audience = this.audience(body.audience);
    const message = limited(body.message, "Message");
    const code = required(body.meetingCode, "Meeting ID");
    const target = await this.target(tenantId, audience, body);
    const [existing] = await this.db.select({ id: meetings.id }).from(meetings).where(and(eq(meetings.tenantId, tenantId), eq(meetings.meetingCode, code))).limit(1);
    if (existing) throw new ConflictException("This meeting ID is already used.");
    const meetingDate = scheduled ? required(body.date, "Date") : today();
    const startTime = scheduled ? required(body.time, "Start time") : clock();
    if (scheduled && !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) throw new BadRequestException("Choose a valid date");
    const [row] = await this.db.insert(meetings).values({
      tenantId,
      hostUserId: userId,
      title: required(body.title, "Title"),
      meetingCode: code,
      audience,
      classId: target.classId,
      studentId: target.studentId,
      employeeId: target.employeeId,
      duration: required(body.duration, "Duration"),
      message,
      scheduled,
      meetingDate,
      startTime,
    }).returning();
    if (scheduled && message) {
      const chat = await this.findOrCreate(tenantId, userId, audience, target);
      const notice = await this.insertMessage(tenantId, chat.id, userId, senderName, message, { attachmentName: null, attachmentData: null });
      await this.db.update(meetings).set({ noticeMessageId: notice.id }).where(eq(meetings.id, row.id));
    }
    return { id: row.id, meetingCode: code, joinPath: `/admin/live/${encodeURIComponent(code)}` };
  }

  async setMeetingActive(tenantId: string, id: string, active: boolean) {
    const [row] = await this.db.select({ id: meetings.id }).from(meetings).where(and(eq(meetings.id, id), eq(meetings.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Meeting not found");
    await this.db.update(meetings).set({ active }).where(eq(meetings.id, id));
    return { ok: true };
  }

  async deleteMeeting(tenantId: string, id: string) {
    const [row] = await this.db.select().from(meetings).where(and(eq(meetings.id, id), eq(meetings.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Meeting not found");
    if (row.noticeMessageId) {
      const [notice] = await this.db.select({ chatId: chatMessages.chatId }).from(chatMessages).where(eq(chatMessages.id, row.noticeMessageId)).limit(1);
      await this.db.delete(chatMessages).where(eq(chatMessages.id, row.noticeMessageId));
      if (notice) {
        const [left] = await this.db.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.chatId, notice.chatId)).limit(1);
        if (!left) await this.db.delete(chats).where(eq(chats.id, notice.chatId));
      }
    }
    await this.db.delete(meetings).where(eq(meetings.id, id));
    return { ok: true };
  }

  async room(tenantId: string, code: string) {
    const [row] = await this.db.select().from(meetings).where(and(eq(meetings.tenantId, tenantId), eq(meetings.meetingCode, code))).limit(1);
    if (!row) throw new NotFoundException("Meeting not found");
    return { title: row.title, meetingCode: row.meetingCode, message: row.message, duration: row.duration, active: row.active, date: row.meetingDate, time: row.startTime };
  }

  async smsHome(tenantId: string) {
    const account = await this.smsAccount(tenantId);
    const templates = await this.db.select().from(smsTemplates).where(eq(smsTemplates.tenantId, tenantId)).orderBy(smsTemplates.name);
    const optOuts = await this.db.select().from(smsOptOuts).where(eq(smsOptOuts.tenantId, tenantId)).orderBy(smsOptOuts.phone);
    const deliveries = await this.db.select().from(smsMessages).where(eq(smsMessages.tenantId, tenantId)).orderBy(desc(smsMessages.createdAt)).limit(30);
    return {
      balance: account.balance,
      connected: Boolean(account.pairedAt),
      handset: account.handsetName,
      templates,
      optOuts,
      deliveries,
    };
  }

  async startSetup(tenantId: string) {
    const account = await this.smsAccount(tenantId);
    if (account.pairedAt) throw new BadRequestException("Disconnect the handset before starting setup again.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join("");
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await this.db.update(smsAccounts).set({ pairingTokenHash: hashToken(code), pairingExpiresAt: expires }).where(eq(smsAccounts.tenantId, tenantId));
    return {
      code,
      qrDataUrl: await QRCode.toDataURL(`nepatronix:sms:${code}`, { margin: 1, width: 160 }),
      message: "Pairing code, shown once. Saved messages stay not delivered.",
    };
  }

  async pairHandset(tenantId: string, body: Record<string, unknown>) {
    const raw = typeof body.code === "string" ? body.code.trim() : "";
    if (!raw) throw new BadRequestException("Enter the pairing code.");
    const code = raw.startsWith("nepatronix:sms:") ? raw.slice("nepatronix:sms:".length) : raw;
    const account = await this.smsAccount(tenantId);
    if (!account.pairingTokenHash || !account.pairingExpiresAt) throw new BadRequestException("This pairing code was not accepted.");
    if (account.pairingExpiresAt.getTime() <= Date.now()) {
      await this.db.update(smsAccounts).set({ pairingTokenHash: null, pairingExpiresAt: null }).where(eq(smsAccounts.tenantId, tenantId));
      throw new BadRequestException("This pairing code has expired.");
    }
    if (account.pairingTokenHash !== hashToken(code)) throw new BadRequestException("This pairing code was not accepted.");
    const name = typeof body.handset === "string" && body.handset.trim() ? body.handset.trim().slice(0, 40) : "Handset";
    await this.db.update(smsAccounts).set({
      pairedAt: new Date(),
      handsetName: name,
      pairingTokenHash: null,
      pairingExpiresAt: null,
    }).where(eq(smsAccounts.tenantId, tenantId));
    return { connected: true, handset: name, message: "Handset paired. Saved messages stay not delivered." };
  }

  async unpairHandset(tenantId: string) {
    await this.db.update(smsAccounts).set({
      pairedAt: null,
      handsetName: null,
      pairingTokenHash: null,
      pairingExpiresAt: null,
    }).where(eq(smsAccounts.tenantId, tenantId));
    return { connected: false, message: "No handset gateway is connected." };
  }

  async saveTemplate(tenantId: string, body: Record<string, unknown>) {
    const [row] = await this.db.insert(smsTemplates).values({
      tenantId,
      name: required(body.name, "Template name"),
      body: required(body.body, "Template message"),
    }).returning();
    return row;
  }

  async deleteTemplate(tenantId: string, id: string) {
    await this.db.delete(smsTemplates).where(and(eq(smsTemplates.id, id), eq(smsTemplates.tenantId, tenantId)));
    return { ok: true };
  }

  async optOut(tenantId: string, body: Record<string, unknown>) {
    const phone = required(body.phone, "Phone");
    await this.db.insert(smsOptOuts).values({ tenantId, phone }).onConflictDoNothing();
    return { ok: true };
  }

  async sendSms(tenantId: string, kind: "test" | "branded", body: Record<string, unknown>) {
    const phone = required(body.phone, "Phone");
    const text = required(body.message, "Message");
    const [opted] = await this.db.select({ id: smsOptOuts.id }).from(smsOptOuts).where(and(eq(smsOptOuts.tenantId, tenantId), eq(smsOptOuts.phone, phone))).limit(1);
    if (opted) {
      const [row] = await this.db.insert(smsMessages).values({ tenantId, phone, body: text, kind, status: "opted_out" }).returning();
      return row;
    }
    const account = await this.smsAccount(tenantId);
    if (account.balance < 1) throw new BadRequestException("SMS balance is empty");
    await this.db.update(smsAccounts).set({ balance: account.balance - 1 }).where(eq(smsAccounts.tenantId, tenantId));
    const [row] = await this.db.insert(smsMessages).values({ tenantId, phone, body: text, kind, status: "not_sent" }).returning();
    return { ...row, balance: account.balance - 1 };
  }

  private async smsAccount(tenantId: string) {
    const [existing] = await this.db.select().from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1);
    if (existing) return existing;
    const [created] = await this.db.insert(smsAccounts).values({ tenantId }).returning();
    return created;
  }

  private async unreadMap(tenantId: string, userId: string, chatIds: string[]) {
    const counts = new Map<string, number>();
    if (!chatIds.length) return counts;
    const rows = await this.db
      .select({ chatId: chatMessages.chatId, n: count() })
      .from(chatMessages)
      .leftJoin(chatReads, and(eq(chatReads.chatId, chatMessages.chatId), eq(chatReads.userId, userId)))
      .where(
        and(
          eq(chatMessages.tenantId, tenantId),
          inArray(chatMessages.chatId, chatIds),
          or(isNull(chatMessages.senderUserId), ne(chatMessages.senderUserId, userId)),
          or(isNull(chatReads.lastReadAt), gt(chatMessages.createdAt, chatReads.lastReadAt)),
        ),
      )
      .groupBy(chatMessages.chatId);
    for (const row of rows) counts.set(row.chatId, Number(row.n));
    return counts;
  }

  private async markRead(userId: string, chatId: string) {
    await this.db.insert(chatReads).values({ userId, chatId, lastReadAt: new Date() }).onConflictDoUpdate({
      target: [chatReads.userId, chatReads.chatId],
      set: { lastReadAt: new Date() },
    });
  }

  private async visibleTo(user: AuthUser, chat: { audience: string; studentId: string | null; classId?: string | null }) {
    if (user.role !== "parent" && user.role !== "student") return;
    const ids = await linkedStudentIds(this.db, user);
    if (chat.audience === "all_students") return;
    if (chat.audience === "student" && chat.studentId && ids.has(chat.studentId)) return;
    if (chat.audience === "class" && chat.classId) {
      const [row] = await this.db
        .select({ classId: students.classId })
        .from(students)
        .where(and(eq(students.tenantId, user.tenantId), inArray(students.id, [...ids]), eq(students.classId, chat.classId)))
        .limit(1);
      if (row) return;
    }
    throw new ForbiddenException("This role cannot open that page.");
  }

  private async findOrCreate(tenantId: string, userId: string | null, audience: Audience, target: { classId: string | null; studentId: string | null; employeeId: string | null; title: string }) {
    const rows = await this.db.select().from(chats).where(and(eq(chats.tenantId, tenantId), eq(chats.audience, audience), isNull(chats.archivedAt)));
    const found = rows.find((row) => row.classId === target.classId && row.studentId === target.studentId && row.employeeId === target.employeeId);
    if (found) return found;
    const [created] = await this.db.insert(chats).values({
      tenantId,
      title: target.title,
      audience,
      classId: target.classId,
      studentId: target.studentId,
      employeeId: target.employeeId,
      createdBy: userId,
    }).returning();
    return created;
  }

  private async insertMessage(tenantId: string, chatId: string, userId: string | null, senderName: string, body: string, file: { attachmentName: string | null; attachmentData: string | null }) {
    const [row] = await this.db.insert(chatMessages).values({
      tenantId,
      chatId,
      senderUserId: userId,
      senderName,
      body,
      ...file,
    }).returning();
    await this.db.update(chats).set({ updatedAt: new Date(), archivedAt: null }).where(eq(chats.id, chatId));
    if (userId) await this.markRead(userId, chatId);
    return row;
  }

  private audience(value: unknown): Audience {
    const audience = required(value, "Audience");
    if (!audiences.includes(audience as Audience)) throw new BadRequestException("Choose an audience");
    return audience as Audience;
  }

  private audienceLabel(audience: string) {
    return {
      all_students: "All Students",
      all_employees: "All Employees",
      all_teachers: "All Teachers",
      class: "Specific Class",
      student: "Specific Student",
      employee: "Specific Teacher",
    }[audience] ?? audience;
  }

  private async target(tenantId: string, audience: Audience, body: Record<string, unknown>) {
    if (audience === "all_students") return { classId: null, studentId: null, employeeId: null, title: "All Students" };
    if (audience === "all_employees") return { classId: null, studentId: null, employeeId: null, title: "All Employees" };
    if (audience === "all_teachers") return { classId: null, studentId: null, employeeId: null, title: "All Teachers" };
    if (audience === "class") {
      const classId = required(body.classId, "Class");
      const [room] = await this.db.select({ id: classes.id, name: classes.name }).from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId))).limit(1);
      if (!room) throw new NotFoundException("Class not found.");
      return { classId, studentId: null, employeeId: null, title: room.name };
    }
    if (audience === "student") {
      const studentId = required(body.studentId, "Student");
      const [student] = await this.db.select({ id: students.id, name: students.name }).from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId))).limit(1);
      if (!student) throw new NotFoundException("Student not found.");
      return { classId: null, studentId, employeeId: null, title: student.name };
    }
    const employeeId = required(body.employeeId, "Employee");
    const [employee] = await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId))).limit(1);
    if (!employee) throw new NotFoundException("Employee not found");
    return { classId: null, studentId: null, employeeId, title: employee.name };
  }

  private async requireChat(tenantId: string, id: string) {
    const [row] = await this.db.select().from(chats).where(and(eq(chats.id, id), eq(chats.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Chat not found");
    return row;
  }
}
