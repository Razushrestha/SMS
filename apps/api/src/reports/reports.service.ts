import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  accountHeads,
  attendanceRecords,
  classes,
  customReports,
  employees,
  feePayments,
  salaryPayments,
  statementEntries,
  students,
  type Database,
} from "@nepatronix/db";
import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { DB } from "../db/db.module";

type Source = "students" | "fees" | "accounts" | "attendance" | "salary";
type Row = Record<string, string>;
const ROW_CAP = 5_000;

const catalog: Record<Source, { filters: string[]; columns: Array<[string, string]> }> = {
  students: {
    filters: ["all", "active", "inactive"],
    columns: [
      ["registration", "Registration"],
      ["name", "Name"],
      ["class", "Class"],
      ["status", "Status"],
      ["father", "Father"],
      ["admissionDate", "Admission date"],
      ["gender", "Gender"],
    ],
  },
  fees: {
    filters: ["all", "owing", "cleared"],
    columns: [
      ["registration", "Registration"],
      ["name", "Name"],
      ["month", "Month"],
      ["total", "Total"],
      ["deposit", "Deposit"],
      ["due", "Due"],
      ["paidOn", "Paid on"],
    ],
  },
  accounts: {
    filters: ["all", "income", "expense"],
    columns: [
      ["date", "Date"],
      ["head", "Head"],
      ["type", "Type"],
      ["description", "Description"],
      ["income", "Income"],
      ["expense", "Expense"],
    ],
  },
  attendance: {
    filters: ["all", "present", "leave", "absent"],
    columns: [
      ["date", "Date"],
      ["name", "Name"],
      ["person", "Person"],
      ["status", "Status"],
      ["source", "Source"],
    ],
  },
  salary: {
    filters: ["all"],
    columns: [
      ["name", "Name"],
      ["month", "Month"],
      ["paidOn", "Paid on"],
      ["net", "Net"],
    ],
  },
};

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${label} is required`);
  return value.trim();
}

function dayKey(value: unknown, label: string) {
  const day = required(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException(`Choose a ${label}`);
  return day;
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  catalog() {
    return Object.entries(catalog).map(([source, item]) => ({
      source,
      filters: item.filters,
      columns: item.columns.map(([key, label]) => ({ key, label })),
    }));
  }

  list(tenantId: string) {
    return this.db
      .select({
        id: customReports.id,
        name: customReports.name,
        source: customReports.source,
        columns: customReports.columns,
        filter: customReports.filter,
        fromDate: customReports.fromDate,
        toDate: customReports.toDate,
      })
      .from(customReports)
      .where(eq(customReports.tenantId, tenantId))
      .orderBy(asc(customReports.name));
  }

  async save(tenantId: string, body: Record<string, unknown>, id?: string) {
    const values = this.values(body);
    try {
      if (!id) {
        const [row] = await this.db.insert(customReports).values({ tenantId, ...values }).returning({ id: customReports.id });
        return row;
      }
      const [row] = await this.db
        .update(customReports)
        .set(values)
        .where(and(eq(customReports.id, id), eq(customReports.tenantId, tenantId)))
        .returning({ id: customReports.id });
      if (!row) throw new NotFoundException("Report not found");
      return row;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (this.unique(error)) throw new ConflictException("A report with this name already exists.");
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    const [row] = await this.db
      .delete(customReports)
      .where(and(eq(customReports.id, id), eq(customReports.tenantId, tenantId)))
      .returning({ id: customReports.id });
    if (!row) throw new NotFoundException("Report not found");
    return { ok: true };
  }

  async run(tenantId: string, id: string) {
    const report = await this.one(tenantId, id);
    const source = catalog[report.source as Source];
    const rows = await this.rows(tenantId, report);
    const truncated = rows.length === ROW_CAP;
    const columns = report.columns.map((key) => ({ key, label: source.columns.find((column) => column[0] === key)?.[1] ?? key }));
    return {
      name: report.name,
      from: report.fromDate,
      to: report.toDate,
      columns,
      rows,
      truncated,
      message: rows.length ? (truncated ? `Showing the first ${ROW_CAP.toLocaleString()} rows.` : null) : "No rows for this report.",
    };
  }

  async export(tenantId: string, id: string) {
    const result = await this.run(tenantId, id);
    const line = (cells: string[]) => cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",");
    const csv = [
      line(result.columns.map((column) => column.label)),
      ...result.rows.map((row) => line(result.columns.map((column) => row[column.key] ?? ""))),
    ].join("\r\n");
    const filename = `${result.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}.csv`;
    return { filename, csv };
  }

  private values(body: Record<string, unknown>) {
    const source = required(body.source, "Source") as Source;
    const item = catalog[source];
    if (!item) throw new BadRequestException("Choose a report source");
    if (!Array.isArray(body.columns) || body.columns.length === 0) throw new BadRequestException("Choose at least one column.");
    const columns = body.columns.map((column) => (typeof column === "string" ? column : ""));
    if (columns.some((column) => !item.columns.some(([key]) => key === column))) throw new BadRequestException("Choose columns for this report.");
    const filter = required(body.filter, "Filter");
    if (!item.filters.includes(filter)) throw new BadRequestException("Choose a filter for this report.");
    const fromDate = dayKey(body.from, "start date");
    const toDate = dayKey(body.to, "end date");
    if (fromDate > toDate) throw new BadRequestException("Choose an end date on or after the start date.");
    return { name: required(body.name, "Report name"), source, columns, filter, fromDate, toDate };
  }

  private async one(tenantId: string, id: string) {
    const [row] = await this.db.select().from(customReports).where(and(eq(customReports.id, id), eq(customReports.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Report not found");
    return row;
  }

  private async rows(tenantId: string, report: { source: string; filter: string; fromDate: string; toDate: string; columns: string[] }) {
    const found = await this.sourceRows(tenantId, report);
    return found.slice(0, ROW_CAP).map((row) => {
      const picked: Row = {};
      for (const key of report.columns) picked[key] = row[key] ?? "";
      return picked;
    });
  }

  private async sourceRows(tenantId: string, report: { source: string; filter: string; fromDate: string; toDate: string }): Promise<Row[]> {
    if (report.source === "students") return this.studentRows(tenantId, report);
    if (report.source === "fees") return this.feeRows(tenantId, report);
    if (report.source === "accounts") return this.accountRows(tenantId, report);
    if (report.source === "attendance") return this.attendanceRows(tenantId, report);
    return this.salaryRows(tenantId, report);
  }

  private async studentRows(tenantId: string, report: { filter: string; fromDate: string; toDate: string }) {
    const filters: SQL[] = [eq(students.tenantId, tenantId), gte(students.admissionDate, report.fromDate), lte(students.admissionDate, report.toDate)];
    if (report.filter === "active" || report.filter === "inactive") filters.push(eq(students.status, report.filter));
    const rows = await this.db
      .select({
        registration: students.registrationNo,
        name: students.name,
        class: classes.name,
        status: students.status,
        father: students.fatherName,
        admissionDate: students.admissionDate,
        gender: students.gender,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(...filters))
      .orderBy(asc(students.registrationNo));
    return rows.map((row) => ({ ...row, father: row.father ?? "", gender: row.gender ?? "" }));
  }

  private async feeRows(tenantId: string, report: { filter: string; fromDate: string; toDate: string }) {
    const filters: SQL[] = [eq(feePayments.tenantId, tenantId), gte(feePayments.paidOn, report.fromDate), lte(feePayments.paidOn, report.toDate)];
    if (report.filter === "owing") filters.push(sql`${feePayments.due} > 0`);
    if (report.filter === "cleared") filters.push(sql`${feePayments.due} = 0`);
    const rows = await this.db
      .select({
        registration: students.registrationNo,
        name: students.name,
        month: feePayments.feeMonth,
        total: feePayments.total,
        deposit: feePayments.deposit,
        due: feePayments.due,
        paidOn: feePayments.paidOn,
      })
      .from(feePayments)
      .innerJoin(students, eq(students.id, feePayments.studentId))
      .where(and(...filters))
      .orderBy(asc(feePayments.paidOn), asc(students.registrationNo));
    return rows;
  }

  private async accountRows(tenantId: string, report: { filter: string; fromDate: string; toDate: string }) {
    const filters: SQL[] = [eq(statementEntries.tenantId, tenantId), gte(statementEntries.entryDate, report.fromDate), lte(statementEntries.entryDate, report.toDate)];
    if (report.filter === "income" || report.filter === "expense") filters.push(eq(accountHeads.type, report.filter));
    const rows = await this.db
      .select({
        date: statementEntries.entryDate,
        head: accountHeads.name,
        type: accountHeads.type,
        description: statementEntries.description,
        income: statementEntries.income,
        expense: statementEntries.expense,
      })
      .from(statementEntries)
      .innerJoin(accountHeads, eq(accountHeads.id, statementEntries.headId))
      .where(and(...filters))
      .orderBy(asc(statementEntries.entryDate));
    return rows;
  }

  private async attendanceRows(tenantId: string, report: { filter: string; fromDate: string; toDate: string }) {
    const filters: SQL[] = [eq(attendanceRecords.tenantId, tenantId), gte(attendanceRecords.attendanceDate, report.fromDate), lte(attendanceRecords.attendanceDate, report.toDate)];
    if (report.filter === "present" || report.filter === "leave" || report.filter === "absent") filters.push(eq(attendanceRecords.status, report.filter));
    const rows = await this.db
      .select({
        date: attendanceRecords.attendanceDate,
        studentName: students.name,
        employeeName: employees.name,
        status: attendanceRecords.status,
        source: attendanceRecords.source,
      })
      .from(attendanceRecords)
      .leftJoin(students, eq(students.id, attendanceRecords.studentId))
      .leftJoin(employees, eq(employees.id, attendanceRecords.employeeId))
      .where(and(...filters))
      .orderBy(asc(attendanceRecords.attendanceDate));
    return rows.map((row) => ({
      date: row.date,
      name: row.studentName ?? row.employeeName ?? "",
      person: row.studentName ? "Student" : "Staff",
      status: row.status,
      source: row.source,
    }));
  }

  private async salaryRows(tenantId: string, report: { fromDate: string; toDate: string }) {
    return this.db
      .select({
        name: employees.name,
        month: salaryPayments.salaryMonth,
        paidOn: salaryPayments.paidOn,
        net: salaryPayments.net,
      })
      .from(salaryPayments)
      .innerJoin(employees, eq(employees.id, salaryPayments.employeeId))
      .where(and(eq(salaryPayments.tenantId, tenantId), gte(salaryPayments.paidOn, report.fromDate), lte(salaryPayments.paidOn, report.toDate)))
      .orderBy(asc(salaryPayments.paidOn));
  }

  private unique(error: unknown) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code === "23505" || (error as { code?: string }).code === "23505";
  }
}
