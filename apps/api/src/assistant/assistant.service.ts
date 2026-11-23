import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  attendanceRecords,
  classes,
  employees,
  institutes,
  statementEntries,
  students,
  tenantPlans,
  type Database,
} from "@nepatronix/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { canOpen } from "../auth/roles";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";
import { DB } from "../db/db.module";
import { FinanceService } from "../finance/finance.service";

const PROMPTS = ["School report with charts", "Message to all students", "Pending fees"];

type Chart = { label: string; income: string; expense: string };

@Injectable()
export class AssistantService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly finance: FinanceService,
  ) {}

  async status(tenantId: string) {
    const plan = await this.ensure(tenantId);
    const period = await this.period(tenantId);
    const used = plan.assistantPeriod === period ? plan.assistantTokensUsed : 0;
    return {
      name: "Adam",
      voiceWake: true,
      prompts: PROMPTS,
      quota: plan.assistantTokenQuota,
      used,
      period,
      limitReached: used >= plan.assistantTokenQuota,
    };
  }

  async ask(user: AuthUser, body: Record<string, unknown>) {
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) throw new BadRequestException("Type a question.");
    const plan = await this.ensure(user.tenantId);
    const period = await this.period(user.tenantId);
    const used = plan.assistantPeriod === period ? plan.assistantTokensUsed : 0;
    if (used >= plan.assistantTokenQuota) throw new ConflictException("Monthly assistant limit reached.");
    const answer = await this.answer(user, prompt, period);
    const tokens = Math.max(1, Math.ceil((prompt.length + answer.text.length) / 4));
    const next = used + tokens;
    await this.db
      .update(tenantPlans)
      .set({ assistantTokensUsed: next, assistantPeriod: period })
      .where(eq(tenantPlans.tenantId, user.tenantId));
    return {
      name: "Adam",
      voiceWake: true,
      prompts: PROMPTS,
      text: answer.text,
      charts: answer.charts,
      used: next,
      quota: plan.assistantTokenQuota,
      period,
      limitReached: next >= plan.assistantTokenQuota,
    };
  }

  private async answer(user: AuthUser, prompt: string, period: string) {
    const text = prompt.toLowerCase();
    if (text.includes("fee")) return this.fees(user, period);
    if (text.includes("message")) return this.message(user);
    if (text.includes("report") || text.includes("chart")) return this.report(user);
    return {
      text: "Ask for a school report with charts, a message to all students, or pending fees.",
      charts: [] as Chart[],
    };
  }

  private async report(user: AuthUser) {
    const institute = await this.institute(user.tenantId);
    const counts = await this.counts(user.tenantId);
    const parts = [
      `${institute.name} has ${counts.employees} employee${counts.employees === 1 ? "" : "s"}, ${counts.classes} class${counts.classes === 1 ? "" : "es"}, ${counts.activeStudents} active student${counts.activeStudents === 1 ? "" : "s"}, and ${counts.inactiveStudents} inactive student${counts.inactiveStudents === 1 ? "" : "s"}.`,
    ];
    let charts: Chart[] = [];
    if (canOpen(user.role, "/admin/accounts")) {
      charts = await this.moneyCharts(user.tenantId);
      const income = charts.reduce((sum, row) => sum + Number(row.income), 0);
      const expense = charts.reduce((sum, row) => sum + Number(row.expense), 0);
      parts.push(charts.length ? `Income is ${income.toFixed(2)} and expense is ${expense.toFixed(2)}.` : "No account entries for this range.");
    }
    if (canOpen(user.role, "/admin/attendance")) {
      const today = this.today(institute.timezone);
      const rows = await this.db
        .select({ status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.tenantId, user.tenantId), eq(attendanceRecords.attendanceDate, today), isNotNull(attendanceRecords.studentId)));
      if (!rows.length) parts.push("No attendance has been marked today.");
      else {
        const present = rows.filter((row) => row.status === "present").length;
        const leave = rows.filter((row) => row.status === "leave").length;
        const absent = rows.filter((row) => row.status === "absent").length;
        parts.push(`Today: ${present} present, ${leave} on leave, ${absent} absent.`);
      }
    }
    return { text: parts.join(" "), charts };
  }

  private async message(user: AuthUser) {
    if (!canOpen(user.role, "/admin/messages")) {
      return { text: "This role cannot message students.", charts: [] as Chart[] };
    }
    const institute = await this.institute(user.tenantId);
    return {
      text: `Dear students of ${institute.name}, please read this notice from the school. This draft is not sent.`,
      charts: [] as Chart[],
    };
  }

  private async fees(user: AuthUser, period: string) {
    if (!canOpen(user.role, "/admin/fees")) {
      return { text: "This role cannot see pending fees.", charts: [] as Chart[] };
    }
    const rows = await this.finance.defaulters(user.tenantId, period);
    const visible = user.role === "parent" ? await this.parentRows(user, rows) : rows;
    if (user.role === "parent" && !visible.length) {
      return { text: "No students are linked to this parent.", charts: [] as Chart[] };
    }
    if (!visible.length) return { text: "No fee defaulters for this month.", charts: [] as Chart[] };
    const lines = visible.map((row) => `${row.name}, ${row.className}, ${row.owing}`);
    return { text: `Pending fees for ${period}: ${lines.join("; ")}.`, charts: [] as Chart[] };
  }

  private async parentRows<T extends { id: string }>(user: AuthUser, rows: T[]) {
    const linked = await linkedStudentIds(this.db, user);
    return rows.filter((row) => linked.has(row.id));
  }

  private async moneyCharts(tenantId: string) {
    const rows = await this.db
      .select({
        label: sql<string>`to_char(${statementEntries.entryDate}, 'YYYY-MM')`,
        income: sql<string>`coalesce(sum(${statementEntries.income}), 0)`,
        expense: sql<string>`coalesce(sum(${statementEntries.expense}), 0)`,
      })
      .from(statementEntries)
      .where(eq(statementEntries.tenantId, tenantId))
      .groupBy(sql`to_char(${statementEntries.entryDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${statementEntries.entryDate}, 'YYYY-MM')`);
    return rows.slice(-6).map((row) => ({
      label: row.label,
      income: Number(row.income).toFixed(2),
      expense: Number(row.expense).toFixed(2),
    }));
  }

  private async counts(tenantId: string) {
    const [employeeCount] = await this.db.select({ count: sql<number>`count(*)::int` }).from(employees).where(eq(employees.tenantId, tenantId));
    const [classCount] = await this.db.select({ count: sql<number>`count(*)::int` }).from(classes).where(eq(classes.tenantId, tenantId));
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

  private async institute(tenantId: string) {
    const [row] = await this.db
      .select({ name: institutes.name, timezone: institutes.timezone })
      .from(institutes)
      .where(eq(institutes.tenantId, tenantId))
      .limit(1);
    return { name: row?.name ?? "This school", timezone: row?.timezone || "Asia/Kathmandu" };
  }

  private async period(tenantId: string) {
    const institute = await this.institute(tenantId);
    return this.today(institute.timezone).slice(0, 7);
  }

  private today(timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  private async ensure(tenantId: string) {
    const [row] = await this.db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, tenantId)).limit(1);
    if (row) return row;
    const [created] = await this.db.insert(tenantPlans).values({ tenantId }).returning();
    return created;
  }
}
