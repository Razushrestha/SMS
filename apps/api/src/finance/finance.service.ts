import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  accountHeads,
  bankAccounts,
  classes,
  employees,
  families,
  feeCarryForwards,
  feeInvoices,
  feeParticulars,
  feePayments,
  institutes,
  products,
  salaryPayments,
  smsAccounts,
  smsMessages,
  smsOptOuts,
  storeOrderLines,
  storeOrders,
  statementEntries,
  students,
  type Database,
} from "@nepatronix/db";
import { randomBytes } from "crypto";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";
import { DB } from "../db/db.module";
import { AuditService, type Actor } from "../audit/audit.service";

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }
  return value.trim();
}

function amount(value: unknown, label: string) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException(`${label} must be zero or more`);
  }
  return Math.round(number * 100) / 100;
}

function money(value: number) {
  return value.toFixed(2);
}

function dayKey(value: string | undefined, label: string) {
  const day = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException(`Choose a ${label}`);
  return day;
}

function monthKey(value: unknown) {
  const month = required(value, "Month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException("Choose a valid month");
  return month;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const name = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${name} ${String(year).slice(2)}`;
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const dateFormats = ["d MMMM, yyyy", "yyyy-MM-dd", "dd/MM/yyyy"];

function dateOnly(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value);
}

function formatDate(value: string, format: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  if (format === "yyyy-MM-dd") return `${year}-${month}-${day}`;
  if (format === "dd/MM/yyyy") return `${day}/${month}/${year}`;
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  return `${Number(day)} ${monthName}, ${year}`;
}

function formatNow(format: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${formatDate(`${part("year")}-${part("month")}-${part("day")}`, format)} ${part("hour")}:${part("minute")}`;
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthStart() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-01`;
}

@Injectable()
export class FinanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  listHeads(tenantId: string) {
    return this.db.select().from(accountHeads).where(eq(accountHeads.tenantId, tenantId)).orderBy(accountHeads.name);
  }

  async createHead(tenantId: string, body: Record<string, unknown>) {
    const type = required(body.type, "Head type");
    if (type !== "income" && type !== "expense") throw new BadRequestException("Head type must be Income or Expense");
    const [row] = await this.db
      .insert(accountHeads)
      .values({ tenantId, name: required(body.name, "Head name"), type })
      .returning();
    return row;
  }

  async deleteHead(tenantId: string, id: string) {
    const [used] = await this.db
      .select({ id: statementEntries.id })
      .from(statementEntries)
      .where(and(eq(statementEntries.headId, id), eq(statementEntries.tenantId, tenantId)))
      .limit(1);
    if (used) throw new ConflictException("This head is used on the statement. Remove those rows first.");
    const result = await this.db
      .delete(accountHeads)
      .where(and(eq(accountHeads.id, id), eq(accountHeads.tenantId, tenantId)))
      .returning({ id: accountHeads.id });
    if (!result.length) throw new NotFoundException("Account head not found");
    return { ok: true };
  }

  async addManual(tenantId: string, body: Record<string, unknown>) {
    const headId = required(body.headId, "Account head");
    const head = await this.requireHead(tenantId, headId);
    const value = amount(body.amount, "Amount");
    if (value <= 0) throw new BadRequestException("Amount must be greater than zero");
    const [row] = await this.db
      .insert(statementEntries)
      .values({
        tenantId,
        headId,
        entryDate: required(body.date, "Date"),
        description: required(body.description, "Description"),
        income: head.type === "income" ? money(value) : "0.00",
        expense: head.type === "expense" ? money(value) : "0.00",
        source: "manual",
      })
      .returning();
    return row;
  }

  async statement(tenantId: string, fromRaw?: string, toRaw?: string) {
    const from = fromRaw || monthStart();
    const to = toRaw || today();
    const rows = await this.db
      .select({
        id: statementEntries.id,
        entryDate: statementEntries.entryDate,
        description: statementEntries.description,
        income: statementEntries.income,
        expense: statementEntries.expense,
        reference: statementEntries.reference,
        headName: accountHeads.name,
        source: statementEntries.source,
      })
      .from(statementEntries)
      .innerJoin(accountHeads, eq(accountHeads.id, statementEntries.headId))
      .where(and(eq(statementEntries.tenantId, tenantId), gte(statementEntries.entryDate, from), lte(statementEntries.entryDate, to)))
      .orderBy(asc(statementEntries.entryDate), asc(statementEntries.createdAt));

    let balance = 0;
    let income = 0;
    let expense = 0;
    const ledger = rows.map((row) => {
      const inAmount = Number(row.income);
      const outAmount = Number(row.expense);
      income += inAmount;
      expense += outAmount;
      balance = Math.round((balance + inAmount - outAmount) * 100) / 100;
      return { ...row, netBalance: money(balance) };
    });
    const base = income + expense;
    return {
      from,
      to,
      income: money(income),
      expense: money(expense),
      net: money(Math.round((income - expense) * 100) / 100),
      incomePercent: base === 0 ? 0 : Math.round((income / base) * 1000) / 10,
      expensePercent: base === 0 ? 0 : Math.round((expense / base) * 1000) / 10,
      marginPercent: income === 0 ? 0 : Math.round(((income - expense) / income) * 1000) / 10,
      ledger,
    };
  }

  async accountsReport(tenantId: string, fromRaw?: string, toRaw?: string) {
    const from = dayKey(fromRaw, "start date");
    const to = dayKey(toRaw, "end date");
    if (from > to) throw new BadRequestException("Choose an end date on or after the start date.");
    const rows = await this.db
      .select({
        headName: accountHeads.name,
        headType: accountHeads.type,
        income: statementEntries.income,
        expense: statementEntries.expense,
      })
      .from(statementEntries)
      .innerJoin(accountHeads, eq(accountHeads.id, statementEntries.headId))
      .where(and(eq(statementEntries.tenantId, tenantId), gte(statementEntries.entryDate, from), lte(statementEntries.entryDate, to)));
    const grouped = new Map<string, { name: string; type: "income" | "expense"; income: number; expense: number; count: number }>();
    for (const row of rows) {
      const current = grouped.get(row.headName) ?? { name: row.headName, type: row.headType, income: 0, expense: 0, count: 0 };
      current.income += Number(row.income);
      current.expense += Number(row.expense);
      current.count += 1;
      grouped.set(row.headName, current);
    }
    const heads = [...grouped.values()]
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
      .map((head) => ({ ...head, income: money(head.income), expense: money(head.expense) }));
    const income = rows.reduce((sum, row) => sum + Number(row.income), 0);
    const expense = rows.reduce((sum, row) => sum + Number(row.expense), 0);
    return {
      from,
      to,
      income: money(income),
      expense: money(expense),
      net: money(Math.round((income - expense) * 100) / 100),
      heads,
      message: heads.length ? null : "No account entries for this range.",
    };
  }

  async deleteEntry(tenantId: string, id: string) {
    const [entry] = await this.db
      .select({ id: statementEntries.id })
      .from(statementEntries)
      .where(and(eq(statementEntries.id, id), eq(statementEntries.tenantId, tenantId)))
      .limit(1);
    if (!entry) throw new NotFoundException("Statement row not found");
    const orders = await this.db.select({ id: storeOrders.id }).from(storeOrders).where(and(eq(storeOrders.statementEntryId, id), eq(storeOrders.tenantId, tenantId)));
    for (const order of orders) {
      const lines = await this.db.select().from(storeOrderLines).where(eq(storeOrderLines.orderId, order.id));
      for (const line of lines) {
        await this.db.update(products).set({ stock: sql`${products.stock} + ${line.quantity}` }).where(eq(products.id, line.productId));
      }
      await this.db.delete(storeOrders).where(eq(storeOrders.id, order.id));
    }
    await this.db.delete(feePayments).where(and(eq(feePayments.statementEntryId, id), eq(feePayments.tenantId, tenantId)));
    await this.db.delete(salaryPayments).where(and(eq(salaryPayments.statementEntryId, id), eq(salaryPayments.tenantId, tenantId)));
    await this.db.delete(statementEntries).where(and(eq(statementEntries.id, id), eq(statementEntries.tenantId, tenantId)));
    return { ok: true };
  }

  async feePreview(tenantId: string, registration: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const student = await this.findBillableStudent(tenantId, registration);
    const lines = await this.resolveLines(tenantId, student, month);
    return {
      studentId: student.id,
      registrationNo: student.registrationNo,
      name: student.name,
      fatherName: student.fatherName,
      className: student.className,
      month,
      alreadyAdded: lines.alreadyAdded,
      monthlyFee: money(lines.monthlyFee),
      admission: money(lines.admission),
      registrationFee: money(lines.registration),
      art: money(lines.art),
      transport: money(lines.transport),
      books: money(lines.books),
      uniform: money(lines.uniform),
      fine: money(lines.fine),
      others: money(lines.others),
      previousBalance: money(lines.previousBalance),
      discount: money(lines.discount),
      discountReason: lines.discountReason,
      total: money(lines.total),
    };
  }

  async collectFee(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const preview = await this.feePreview(tenantId, required(body.registration, "Student"), required(body.month, "Month"));
    const defaults: Record<string, string> = {
      admission: preview.admission,
      registrationFee: preview.registrationFee,
      art: preview.art,
      transport: preview.transport,
      books: preview.books,
      uniform: preview.uniform,
      fine: preview.fine,
      others: preview.others,
      previousBalance: preview.previousBalance,
    };
    const extras = Object.keys(defaults).map((key) => (body[key] === undefined || body[key] === "" ? Number(defaults[key]) : amount(body[key], key)));
    const total = Math.round((Number(preview.monthlyFee) + extras.reduce((sum, value) => sum + value, 0) - Number(preview.discount)) * 100) / 100;
    const deposit = amount(body.deposit, "Deposit");
    const due = Math.round((total - deposit) * 100) / 100;
    const head = await this.ensureHead(tenantId, "Fee collection", "income");
    const description = `Fee Submission for ${monthLabel(preview.month)} of Student ID:- ${preview.registrationNo}`;

    const payment = await this.db.transaction(async (tx) => {
      let statementEntryId: string | null = null;
      if (deposit > 0) {
        const [entry] = await tx
          .insert(statementEntries)
          .values({
            tenantId,
            headId: head.id,
            entryDate: required(body.date, "Date"),
            description,
            income: money(deposit),
            expense: "0.00",
            source: "fee",
          })
          .returning({ id: statementEntries.id });
        statementEntryId = entry.id;
      }
      const [payment] = await tx
        .insert(feePayments)
        .values({
          tenantId,
          studentId: preview.studentId,
          statementEntryId,
          feeMonth: preview.month,
          paidOn: required(body.date, "Date"),
          monthlyFee: preview.monthlyFee,
          admission: money(extras[0]),
          registration: money(extras[1]),
          art: money(extras[2]),
          transport: money(extras[3]),
          books: money(extras[4]),
          uniform: money(extras[5]),
          fine: money(extras[6]),
          others: money(extras[7]),
          previousBalance: money(extras[8]),
          discount: preview.discount,
          total: money(total),
          deposit: money(deposit),
          due: money(due),
        })
        .returning();
      return payment;
    });
    await this.audit.record(tenantId, actor, "fee_collected", `Fee collected for ${preview.name}, ${preview.month}, deposit ${money(deposit)}.`);
    return payment;
  }

  async feeSlip(user: AuthUser, registration: string, monthRaw: string) {
    const tenantId = user.tenantId;
    const month = monthKey(monthRaw);
    const [institute] = await this.db
      .select({ name: institutes.name, phone: institutes.phone, dateFormat: institutes.dateFormat, timezone: institutes.timezone, logoUrl: institutes.logoUrl })
      .from(institutes)
      .where(eq(institutes.tenantId, tenantId))
      .limit(1);
    const format = dateFormats.includes(institute?.dateFormat ?? "") ? institute!.dateFormat : "d MMMM, yyyy";
    const empty = {
      title: "Fee Submission Slip",
      empty: true,
      message: "No Fees Record. No fee record found for the selected student and period.",
      dateFormat: format,
    };
    const [student] = await this.db
      .select({ id: students.id, name: students.name, registrationNo: students.registrationNo, className: classes.name, fatherName: students.fatherName })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, tenantId), eq(students.registrationNo, registration.trim())))
      .limit(1);
    if (!student) return empty;
    if (user.role === "student" || user.role === "parent") {
      const linked = await linkedStudentIds(this.db, user);
      if (!linked.has(student.id)) return empty;
    }
    const history = await this.db
      .select()
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tenantId), eq(feePayments.studentId, student.id)))
      .orderBy(asc(feePayments.paidOn), asc(feePayments.createdAt));
    const monthPayments = history.filter((payment) => payment.feeMonth === month);
    const payment = monthPayments[monthPayments.length - 1];
    if (!payment) return empty;
    const serial = history.findIndex((row) => row.id === payment.id) + 1;
    return {
      title: "Fee Submission Slip",
      empty: false,
      dateFormat: format,
      instituteName: institute?.name ?? "",
      institutePhone: institute?.phone ?? "",
      instituteLogo: institute?.logoUrl ?? null,
      student,
      serial,
      month: payment.feeMonth,
      paidOn: formatDate(dateOnly(payment.paidOn), format),
      printedAt: formatNow(format, institute?.timezone || "Asia/Kathmandu"),
      lines: {
        monthlyFee: payment.monthlyFee,
        admission: payment.admission,
        registration: payment.registration,
        art: payment.art,
        transport: payment.transport,
        books: payment.books,
        uniform: payment.uniform,
        fine: payment.fine,
        others: payment.others,
        previousBalance: payment.previousBalance,
        discount: payment.discount,
      },
      total: payment.total,
      deposit: payment.deposit,
      due: payment.due,
      history: history.map((row, index) => ({
        id: row.id,
        serial: index + 1,
        date: formatDate(dateOnly(row.paidOn), format),
        month: row.feeMonth,
        total: row.total,
        deposit: row.deposit,
        due: row.due,
      })),
    };
  }

  async deleteFee(tenantId: string, id: string) {
    const [payment] = await this.db
      .select()
      .from(feePayments)
      .where(and(eq(feePayments.id, id), eq(feePayments.tenantId, tenantId)))
      .limit(1);
    if (!payment) throw new NotFoundException("Fee payment not found");
    await this.db.delete(feePayments).where(eq(feePayments.id, id));
    if (payment.statementEntryId) {
      await this.db.delete(statementEntries).where(eq(statementEntries.id, payment.statementEntryId));
    }
    return { ok: true };
  }

  async defaulters(tenantId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const people = await this.db
      .select({
        id: students.id,
        registrationNo: students.registrationNo,
        name: students.name,
        className: classes.name,
        classId: students.classId,
        monthlyFee: classes.monthlyFee,
        discountPercent: students.discountPercent,
        discountType: students.discountType,
        discountAmount: students.discountAmount,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, tenantId), eq(students.status, "active")));
    const payments = await this.db
      .select({ studentId: feePayments.studentId, total: feePayments.total, deposit: feePayments.deposit })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tenantId), eq(feePayments.feeMonth, month)));
    const invoices = await this.db
      .select({ studentId: feeInvoices.studentId, total: feeInvoices.total })
      .from(feeInvoices)
      .where(and(eq(feeInvoices.tenantId, tenantId), eq(feeInvoices.feeMonth, month)));
    return people.flatMap((person) => {
      const own = payments.filter((payment) => payment.studentId === person.id);
      const invoice = invoices.find((row) => row.studentId === person.id);
      const expected = Math.max(0, Math.round((Number(person.monthlyFee) - this.feeDiscount(person, Number(person.monthlyFee))) * 100) / 100);
      const billed = invoice ? Number(invoice.total) : own.length ? own.reduce((sum, payment) => sum + Number(payment.total), 0) : expected;
      const received = own.reduce((sum, payment) => sum + Number(payment.deposit), 0);
      const owing = Math.round((billed - received) * 100) / 100;
      if (owing <= 0) return [];
      return [{ ...person, owing: money(owing) }];
    });
  }

  async defaulterDetail(tenantId: string, studentId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const [student] = await this.db
      .select({
        id: students.id,
        name: students.name,
        registrationNo: students.registrationNo,
        className: classes.name,
        smsPhone: students.smsPhone,
        fatherMobile: students.fatherMobile,
        classId: students.classId,
        monthlyFee: classes.monthlyFee,
        discountPercent: students.discountPercent,
        discountType: students.discountType,
        discountAmount: students.discountAmount,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.status, "active")))
      .limit(1);
    if (!student) throw new NotFoundException("Student not found.");
    const owingRow = (await this.defaulters(tenantId, month)).find((person) => person.id === studentId);
    if (!owingRow) throw new BadRequestException("This student has nothing owing for that month.");
    const [invoice] = await this.db
      .select()
      .from(feeInvoices)
      .where(and(eq(feeInvoices.tenantId, tenantId), eq(feeInvoices.studentId, studentId), eq(feeInvoices.feeMonth, month)))
      .limit(1);
    const deposited = await this.deposited(tenantId, studentId, month);
    const lines = invoice
      ? {
          monthlyFee: invoice.monthlyFee,
          admission: invoice.admission,
          registration: invoice.registration,
          art: invoice.art,
          transport: invoice.transport,
          books: invoice.books,
          uniform: invoice.uniform,
          fine: invoice.fine,
          others: invoice.others,
          previousBalance: invoice.previousBalance,
          discount: invoice.discount,
        }
      : {
          monthlyFee: student.monthlyFee,
          admission: "0.00",
          registration: "0.00",
          art: "0.00",
          transport: "0.00",
          books: "0.00",
          uniform: "0.00",
          fine: "0.00",
          others: "0.00",
          previousBalance: "0.00",
          discount: money(this.feeDiscount(student, Number(student.monthlyFee))),
        };
    return {
      id: student.id,
      name: student.name,
      registrationNo: student.registrationNo,
      className: student.className,
      month,
      source: invoice ? "invoice" : "class fee",
      phone: student.smsPhone || student.fatherMobile || null,
      lines,
      billed: invoice ? invoice.total : owingRow.owing,
      deposited: money(deposited),
      owing: owingRow.owing,
    };
  }

  async sendReminder(tenantId: string, studentId: string, body: Record<string, unknown>) {
    const detail = await this.defaulterDetail(tenantId, studentId, required(body.month, "Month"));
    if (!detail.phone) throw new BadRequestException("This student has no SMS phone.");
    const [institute] = await this.db.select({ name: institutes.name }).from(institutes).where(eq(institutes.tenantId, tenantId)).limit(1);
    const text = `Fee reminder for ${monthLabel(detail.month)}: ${detail.name} (ID ${detail.registrationNo}) owes ${detail.owing}. ${institute?.name ?? ""}`.trim();
    const [opted] = await this.db.select({ id: smsOptOuts.id }).from(smsOptOuts).where(and(eq(smsOptOuts.tenantId, tenantId), eq(smsOptOuts.phone, detail.phone))).limit(1);
    if (opted) {
      await this.db.insert(smsMessages).values({ tenantId, phone: detail.phone, body: text, kind: "reminder", status: "opted_out" });
      return { phone: detail.phone, body: text, status: "opted_out", balance: null };
    }
    const [account] = await this.db.select().from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1);
    const balance = account?.balance ?? 100;
    if (!account) await this.db.insert(smsAccounts).values({ tenantId });
    if (balance < 1) throw new BadRequestException("SMS balance is empty");
    await this.db.update(smsAccounts).set({ balance: balance - 1 }).where(eq(smsAccounts.tenantId, tenantId));
    await this.db.insert(smsMessages).values({ tenantId, phone: detail.phone, body: text, kind: "reminder", status: "not_sent" });
    return { phone: detail.phone, body: text, status: "not_sent", balance: balance - 1 };
  }

  async feeStructure(tenantId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const classRows = await this.db
      .select({ id: classes.id, name: classes.name, monthlyFee: classes.monthlyFee })
      .from(classes)
      .where(eq(classes.tenantId, tenantId))
      .orderBy(asc(classes.name));
    const particulars = await this.db.select().from(feeParticulars).where(eq(feeParticulars.tenantId, tenantId));
    const rows = classRows.map((item) => {
      const chosen = particulars
        .map((row) => ({ row, rank: this.classParticularRank(row, item.id, month) }))
        .filter((entry) => entry.rank >= 0)
        .sort((a, b) => b.rank - a.rank)[0]?.row;
      const lines = {
        monthlyFee: Number(item.monthlyFee),
        admission: Number(chosen?.admission ?? 0),
        registration: Number(chosen?.registration ?? 0),
        art: Number(chosen?.art ?? 0),
        transport: Number(chosen?.transport ?? 0),
        books: Number(chosen?.books ?? 0),
        uniform: Number(chosen?.uniform ?? 0),
        fine: Number(chosen?.fine ?? 0),
        others: Number(chosen?.others ?? 0),
      };
      const total = Object.values(lines).reduce((sum, value) => sum + value, 0);
      return {
        className: item.name,
        monthlyFee: money(lines.monthlyFee),
        admission: money(lines.admission),
        registration: money(lines.registration),
        art: money(lines.art),
        transport: money(lines.transport),
        books: money(lines.books),
        uniform: money(lines.uniform),
        fine: money(lines.fine),
        others: money(lines.others),
        total: money(total),
      };
    });
    return { month, rows };
  }

  async feeReport(tenantId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const people = await this.billableStudents(and(eq(students.tenantId, tenantId), eq(students.status, "active")));
    const payments = await this.db
      .select({ studentId: feePayments.studentId, total: feePayments.total, deposit: feePayments.deposit, discount: feePayments.discount })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tenantId), eq(feePayments.feeMonth, month)));
    const invoices = await this.db
      .select({ studentId: feeInvoices.studentId, total: feeInvoices.total, discount: feeInvoices.discount })
      .from(feeInvoices)
      .where(and(eq(feeInvoices.tenantId, tenantId), eq(feeInvoices.feeMonth, month)));
    const rows = [];
    for (const person of people) {
      const own = payments.filter((payment) => payment.studentId === person.id);
      const invoice = invoices.find((row) => row.studentId === person.id);
      const deposited = own.reduce((sum, payment) => sum + Number(payment.deposit), 0);
      let billed = 0;
      let discount = 0;
      let source = "structure";
      if (invoice) {
        billed = Number(invoice.total);
        discount = Number(invoice.discount);
        source = "invoice";
      } else if (own.length) {
        billed = own.reduce((sum, payment) => sum + Number(payment.total), 0);
        discount = own.reduce((sum, payment) => sum + Number(payment.discount), 0);
        source = "payment";
      } else {
        const lines = await this.resolveLines(tenantId, person, month);
        billed = lines.total;
        discount = lines.discount;
      }
      const owing = Math.round((billed - deposited) * 100) / 100;
      rows.push({
        registrationNo: person.registrationNo,
        name: person.name,
        className: person.className,
        source,
        discount: money(discount),
        billed: money(billed),
        deposited: money(deposited),
        owing: money(owing),
      });
    }
    const totals = rows.reduce(
      (sum, row) => ({
        discount: sum.discount + Number(row.discount),
        billed: sum.billed + Number(row.billed),
        deposited: sum.deposited + Number(row.deposited),
        owing: sum.owing + Number(row.owing),
      }),
      { discount: 0, billed: 0, deposited: 0, owing: 0 },
    );
    return {
      month,
      rows,
      totals: { discount: money(totals.discount), billed: money(totals.billed), deposited: money(totals.deposited), owing: money(totals.owing) },
    };
  }

  async salaryPreview(tenantId: string, employeeId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const employee = await this.findPayableEmployee(tenantId, employeeId);
    const [existing] = await this.db
      .select({ id: salaryPayments.id })
      .from(salaryPayments)
      .where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.employeeId, employee.id), eq(salaryPayments.salaryMonth, month)))
      .limit(1);
    return {
      id: employee.id,
      name: employee.name,
      staffRole: employee.staffRole,
      fixedSalary: employee.monthlySalary,
      month,
      alreadyAdded: Boolean(existing),
    };
  }

  async paySalary(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const month = monthKey(body.month);
    const preview = await this.salaryPreview(tenantId, required(body.employeeId, "Employee"), month);
    if (preview.alreadyAdded) {
      throw new ConflictException("Salary for this employee has already been added for the selected month.");
    }
    const fixed = amount(body.fixedSalary ?? preview.fixedSalary, "Fixed salary");
    const bonus = amount(body.bonus, "Bonus");
    const deduction = amount(body.deduction, "Deduction");
    const net = Math.max(0, Math.round((fixed + bonus - deduction) * 100) / 100);
    const head = await this.ensureHead(tenantId, "Salary", "expense");
    const description = `Employee Salary Payment ID:- ${preview.id}`;
    const payment = await this.db.transaction(async (tx) => {
      let statementEntryId: string | null = null;
      if (net > 0) {
        const [entry] = await tx
          .insert(statementEntries)
          .values({
            tenantId,
            headId: head.id,
            entryDate: required(body.date, "Payment date"),
            description,
            income: "0.00",
            expense: money(net),
            source: "salary",
          })
          .returning({ id: statementEntries.id });
        statementEntryId = entry.id;
      }
      const [payment] = await tx
        .insert(salaryPayments)
        .values({
          tenantId,
          employeeId: preview.id,
          statementEntryId,
          salaryMonth: month,
          paidOn: required(body.date, "Payment date"),
          fixedSalary: money(fixed),
          bonus: money(bonus),
          deduction: money(deduction),
          net: money(net),
        })
        .returning();
      return payment;
    });
    await this.audit.record(tenantId, actor, "salary_paid", `Salary paid to ${preview.name} for ${month}, net ${money(net)}.`);
    return payment;
  }

  async salarySheet(tenantId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const people = await this.db
      .select({ id: employees.id, name: employees.name, staffRole: employees.staffRole, monthlySalary: employees.monthlySalary })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active")))
      .orderBy(asc(employees.name));
    const payments = await this.db
      .select()
      .from(salaryPayments)
      .where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.salaryMonth, month)));
    const paidByEmployee = new Map(payments.map((row) => [row.employeeId, row]));
    const rows = people.map((person) => {
      const payment = paidByEmployee.get(person.id);
      if (!payment) {
        return { id: person.id, name: person.name, staffRole: person.staffRole, fixedSalary: person.monthlySalary, bonus: "0.00", deduction: "0.00", net: person.monthlySalary, status: "Not paid" };
      }
      return { id: person.id, name: person.name, staffRole: person.staffRole, fixedSalary: payment.fixedSalary, bonus: payment.bonus, deduction: payment.deduction, net: payment.net, status: "Paid" };
    });
    return { month, rows, totals: this.salaryTotals(rows) };
  }

  async salaryReport(tenantId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const rows = await this.db
      .select({
        id: salaryPayments.id,
        name: employees.name,
        staffRole: employees.staffRole,
        paidOn: salaryPayments.paidOn,
        bonus: salaryPayments.bonus,
        deduction: salaryPayments.deduction,
        net: salaryPayments.net,
      })
      .from(salaryPayments)
      .innerJoin(employees, eq(employees.id, salaryPayments.employeeId))
      .where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.salaryMonth, month)))
      .orderBy(asc(employees.name));
    return { month, rows, totals: this.salaryTotals(rows) };
  }

  async salarySlip(tenantId: string, employeeId: string) {
    const [employee] = await this.db
      .select({ id: employees.id, name: employees.name, staffRole: employees.staffRole })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId)))
      .limit(1);
    if (!employee) throw new NotFoundException("Employee not found or inactive.");
    const payments = await this.db
      .select()
      .from(salaryPayments)
      .where(and(eq(salaryPayments.tenantId, tenantId), eq(salaryPayments.employeeId, employeeId)))
      .orderBy(asc(salaryPayments.paidOn));
    return { employee, payments };
  }

  async deleteSalary(tenantId: string, id: string) {
    const [payment] = await this.db
      .select()
      .from(salaryPayments)
      .where(and(eq(salaryPayments.id, id), eq(salaryPayments.tenantId, tenantId)))
      .limit(1);
    if (!payment) throw new NotFoundException("Salary payment not found");
    await this.db.delete(salaryPayments).where(eq(salaryPayments.id, id));
    if (payment.statementEntryId) {
      await this.db.delete(statementEntries).where(eq(statementEntries.id, payment.statementEntryId));
    }
    return { ok: true };
  }

  private async findBillableStudent(tenantId: string, registration: string) {
    const [student] = await this.db
      .select({
        id: students.id,
        name: students.name,
        registrationNo: students.registrationNo,
        fatherName: students.fatherName,
        classId: students.classId,
        className: classes.name,
        monthlyFee: classes.monthlyFee,
        discountPercent: students.discountPercent,
        discountType: students.discountType,
        discountAmount: students.discountAmount,
        discountReason: students.discountReason,
        status: students.status,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(students.tenantId, tenantId), eq(students.registrationNo, registration.trim()), eq(students.status, "active")))
      .limit(1);
    if (!student) throw new NotFoundException("Student not found.");
    return student;
  }

  private async monthlyFeeAlreadyCharged(tenantId: string, studentId: string, month: string) {
    const [payment] = await this.db
      .select({ id: feePayments.id })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tenantId), eq(feePayments.studentId, studentId), eq(feePayments.feeMonth, month), sql`${feePayments.monthlyFee} > 0`))
      .limit(1);
    return Boolean(payment);
  }

  async listParticulars(tenantId: string) {
    return this.db.select().from(feeParticulars).where(eq(feeParticulars.tenantId, tenantId));
  }

  async addParticular(tenantId: string, body: Record<string, unknown>) {
    const scope = required(body.scope, "Scope");
    if (!["everyone", "class", "student"].includes(scope)) throw new BadRequestException("Choose who this particular applies to");
    const classId = scope === "class" ? required(body.classId, "Class") : null;
    const studentId = scope === "student" ? required(body.studentId, "Student") : null;
    const month = typeof body.month === "string" && body.month ? monthKey(body.month) : null;
    const [row] = await this.db
      .insert(feeParticulars)
      .values({
        tenantId,
        month,
        scope: scope as "everyone" | "class" | "student",
        classId,
        studentId,
        admission: money(amount(body.admission, "Admission")),
        registration: money(amount(body.registration, "Registration")),
        art: money(amount(body.art, "Art material")),
        transport: money(amount(body.transport, "Transport")),
        books: money(amount(body.books, "Books")),
        uniform: money(amount(body.uniform, "Uniform")),
        fine: money(amount(body.fine, "Fine")),
        others: money(amount(body.others, "Others")),
      })
      .returning();
    return row;
  }

  async resetParticulars(tenantId: string) {
    await this.db.delete(feeParticulars).where(eq(feeParticulars.tenantId, tenantId));
    return { ok: true };
  }

  async listBanks(tenantId: string) {
    const rows = await this.db.select().from(bankAccounts).where(eq(bankAccounts.tenantId, tenantId)).orderBy(asc(bankAccounts.name));
    return rows.map((row) => ({ id: row.id, name: row.name, branchAddress: row.branchAddress, accountNumber: row.accountNumber, instructions: row.instructions, logoData: row.logoData }));
  }

  async addBank(tenantId: string, body: Record<string, unknown>) {
    const [row] = await this.db
      .insert(bankAccounts)
      .values({
        tenantId,
        name: required(body.name, "Bank name"),
        branchAddress: required(body.branchAddress, "Branch address"),
        accountNumber: required(body.accountNumber, "Account number"),
        instructions: typeof body.instructions === "string" ? body.instructions.trim() : "",
        logoData: this.logo(body.logoData),
      })
      .returning({ id: bankAccounts.id, name: bankAccounts.name, accountNumber: bankAccounts.accountNumber });
    return row;
  }

  async updateBank(tenantId: string, id: string, body: Record<string, unknown>) {
    const [current] = await this.db.select().from(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.tenantId, tenantId))).limit(1);
    if (!current) throw new NotFoundException("Bank account not found");
    const logoData = typeof body.logoData === "string" && body.logoData.trim() ? this.logo(body.logoData) : current.logoData;
    const [row] = await this.db
      .update(bankAccounts)
      .set({
        name: required(body.name, "Bank name"),
        branchAddress: required(body.branchAddress, "Branch address"),
        accountNumber: required(body.accountNumber, "Account number"),
        instructions: typeof body.instructions === "string" ? body.instructions.trim() : "",
        logoData,
      })
      .where(eq(bankAccounts.id, id))
      .returning({ id: bankAccounts.id, name: bankAccounts.name, branchAddress: bankAccounts.branchAddress, accountNumber: bankAccounts.accountNumber, instructions: bankAccounts.instructions, logoData: bankAccounts.logoData });
    return row;
  }

  async deleteBank(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: bankAccounts.id }).from(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Bank account not found");
    await this.db.delete(bankAccounts).where(eq(bankAccounts.id, id));
    return { ok: true };
  }

  async generateInvoice(tenantId: string, body: Record<string, unknown>) {
    const student = await this.findBillableStudent(tenantId, required(body.registration, "Student"));
    const context = await this.invoiceContext(tenantId, body);
    try {
      return await this.insertInvoice(tenantId, student, context);
    } catch (error) {
      if (this.uniqueViolation(error)) throw new ConflictException("An invoice for this student and month already exists.");
      throw error;
    }
  }

  async generateClassInvoices(tenantId: string, body: Record<string, unknown>) {
    const classId = required(body.classId, "Class");
    const [klass] = await this.db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId))).limit(1);
    if (!klass) throw new NotFoundException("Class not found");
    const people = await this.billableStudents(and(eq(students.tenantId, tenantId), eq(students.classId, classId), eq(students.status, "active")));
    if (people.length === 0) throw new BadRequestException("This class has no active students.");
    return this.generateMany(tenantId, body, people);
  }

  async generateFamilyInvoices(tenantId: string, body: Record<string, unknown>) {
    const familyId = required(body.familyId, "Family");
    const [family] = await this.db.select({ id: families.id }).from(families).where(and(eq(families.id, familyId), eq(families.tenantId, tenantId))).limit(1);
    if (!family) throw new NotFoundException("Family not found");
    const people = await this.billableStudents(and(eq(students.tenantId, tenantId), eq(students.familyId, familyId), eq(students.status, "active")));
    if (people.length === 0) throw new BadRequestException("This family has no active students.");
    return this.generateMany(tenantId, body, people);
  }

  async familyPreview(tenantId: string, familyId: string, monthRaw: string) {
    const month = monthKey(monthRaw);
    const family = await this.requireFamily(tenantId, required(familyId, "Family"));
    const people = await this.billableStudents(and(eq(students.tenantId, tenantId), eq(students.familyId, family.id), eq(students.status, "active")));
    if (people.length === 0) throw new BadRequestException("This family has no active students.");
    const rows = [];
    for (const student of people) {
      const lines = await this.resolveLines(tenantId, student, month);
      rows.push({
        registrationNo: student.registrationNo,
        name: student.name,
        className: student.className,
        alreadyAdded: lines.alreadyAdded,
        total: money(lines.total),
      });
    }
    return { familyId: family.id, family: family.name, month, students: rows };
  }

  async collectFamily(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const month = monthKey(body.month);
    const date = required(body.date, "Date");
    const family = await this.requireFamily(tenantId, required(body.familyId, "Family"));
    const deposits = Array.isArray(body.deposits) ? body.deposits : [];
    const payments = [];
    for (const item of deposits) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const deposit = amount(row.deposit, "Deposit");
      if (deposit === 0) continue;
      payments.push(await this.collectFee(tenantId, { registration: row.registration, month, date, deposit: String(deposit) }, actor));
    }
    if (payments.length === 0) throw new BadRequestException("Enter a deposit.");
    return { family: family.name, count: payments.length, payments };
  }

  async listInvoices(tenantId: string) {
    const rows = await this.db
      .select({
        receiptNo: feeInvoices.receiptNo,
        feeMonth: feeInvoices.feeMonth,
        total: feeInvoices.total,
        studentId: feeInvoices.studentId,
        registrationNo: students.registrationNo,
        name: students.name,
        className: classes.name,
      })
      .from(feeInvoices)
      .innerJoin(students, eq(students.id, feeInvoices.studentId))
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(feeInvoices.tenantId, tenantId))
      .orderBy(asc(feeInvoices.feeMonth), asc(students.registrationNo));
    const result = [];
    for (const row of rows) {
      const paid = await this.deposited(tenantId, row.studentId, row.feeMonth);
      const owing = Math.round((Number(row.total) - paid) * 100) / 100;
      result.push({ receiptNo: row.receiptNo, registrationNo: row.registrationNo, name: row.name, className: row.className, month: row.feeMonth, total: row.total, deposited: money(paid), owing: money(owing) });
    }
    return result;
  }

  async scanInvoice(tenantId: string, code: string) {
    return this.invoiceByReceipt(tenantId, code);
  }

  async payScannedInvoice(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const invoice = await this.invoiceByReceipt(tenantId, required(body.code, "Receipt"));
    if (Number(invoice.owing) <= 0) throw new ConflictException("This invoice is already paid.");
    const deposit = amount(body.deposit, "Deposit");
    if (deposit <= 0) throw new BadRequestException("Enter a deposit.");
    if (deposit > Number(invoice.owing)) throw new BadRequestException("Deposit is more than the amount owing.");
    const payment = await this.collectFee(tenantId, { registration: invoice.registrationNo, month: invoice.month, date: required(body.date, "Date"), deposit: String(deposit) }, actor);
    return { receiptNo: invoice.receiptNo, name: invoice.name, month: invoice.month, total: invoice.total, deposit: payment.deposit, due: payment.due };
  }

  async carryForward(tenantId: string, body: Record<string, unknown>) {
    const month = monthKey(body.month);
    const studentId = required(body.studentId, "Student");
    const rows = await this.defaulters(tenantId, month);
    const row = rows.find((person) => person.id === studentId);
    if (!row) throw new BadRequestException("This student has nothing to carry forward.");
    const targetMonth = nextMonth(month);
    const [existing] = await this.db
      .select({ id: feeCarryForwards.id })
      .from(feeCarryForwards)
      .where(and(eq(feeCarryForwards.tenantId, tenantId), eq(feeCarryForwards.studentId, studentId), eq(feeCarryForwards.targetMonth, targetMonth)))
      .limit(1);
    if (existing) {
      await this.db.update(feeCarryForwards).set({ amount: row.owing }).where(eq(feeCarryForwards.id, existing.id));
    } else {
      await this.db.insert(feeCarryForwards).values({ tenantId, studentId, targetMonth, amount: row.owing });
    }
    return { targetMonth, amount: row.owing };
  }

  private async generateMany(
    tenantId: string,
    body: Record<string, unknown>,
    people: Awaited<ReturnType<FinanceService["billableStudents"]>>,
  ) {
    const context = await this.invoiceContext(tenantId, body);
    const created = [];
    const skipped: Array<{ registrationNo: string; name: string }> = [];
    for (const student of people) {
      try {
        created.push(await this.insertInvoice(tenantId, student, context));
      } catch (error) {
        if (this.uniqueViolation(error)) skipped.push({ registrationNo: student.registrationNo, name: student.name });
        else throw error;
      }
    }
    if (created.length === 0) throw new ConflictException("An invoice for this student and month already exists.");
    return { created, skipped };
  }

  private async invoiceContext(tenantId: string, body: Record<string, unknown>) {
    const banks = await this.listBanks(tenantId);
    if (banks.length === 0) throw new ConflictException("Add a bank account before generating a fee invoice.");
    const bank = banks.find((row) => row.id === required(body.bankId, "Bank"));
    if (!bank) throw new NotFoundException("Bank account not found");
    const month = monthKey(body.month);
    const dueDate = required(body.dueDate, "Due date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new BadRequestException("Choose a valid due date");
    const lateFine = amount(body.lateFine, "Late fine");
    const [institute] = await this.db.select({ name: institutes.name, phone: institutes.phone, logoUrl: institutes.logoUrl }).from(institutes).where(eq(institutes.tenantId, tenantId)).limit(1);
    return { bank, month, dueDate, lateFine, instituteName: institute?.name ?? "", institutePhone: institute?.phone ?? "", instituteLogo: institute?.logoUrl ?? null };
  }

  private async insertInvoice(
    tenantId: string,
    student: { id: string; classId: string; monthlyFee: string; discountPercent: string; discountType: string; discountAmount: string; discountReason: string; name: string; registrationNo: string; fatherName: string | null; className: string },
    context: Awaited<ReturnType<FinanceService["invoiceContext"]>>,
  ) {
    const lines = await this.resolveLines(tenantId, student, context.month);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [row] = await this.db
          .insert(feeInvoices)
          .values({
            tenantId,
            studentId: student.id,
            feeMonth: context.month,
            dueDate: context.dueDate,
            lateFine: money(context.lateFine),
            monthlyFee: money(lines.monthlyFee),
            admission: money(lines.admission),
            registration: money(lines.registration),
            art: money(lines.art),
            transport: money(lines.transport),
            books: money(lines.books),
            uniform: money(lines.uniform),
            fine: money(lines.fine),
            others: money(lines.others),
            previousBalance: money(lines.previousBalance),
            discount: money(lines.discount),
            total: money(lines.total),
            receiptNo: `INV-${randomBytes(4).toString("hex").toUpperCase()}`,
            bankName: context.bank.name,
            bankBranch: context.bank.branchAddress,
            accountNumber: context.bank.accountNumber,
            instructions: context.bank.instructions,
            issuedOn: today(),
          })
          .returning();
        return this.presentInvoice(row, student, context.instituteName, context.institutePhone, context.instituteLogo, context.lateFine);
      } catch (error) {
        const constraint = (error as { cause?: { constraint?: string }; constraint?: string }).cause?.constraint ?? (error as { constraint?: string }).constraint;
        if (constraint === "fee_invoice_receipt" && attempt < 2) continue;
        throw error;
      }
    }
    throw new ConflictException("Could not assign a receipt number.");
  }

  private async requireFamily(tenantId: string, familyId: string) {
    const [family] = await this.db.select({ id: families.id, name: families.name }).from(families).where(and(eq(families.id, familyId), eq(families.tenantId, tenantId))).limit(1);
    if (!family) throw new NotFoundException("Family not found");
    return family;
  }

  private async deposited(tenantId: string, studentId: string, month: string) {
    const [row] = await this.db
      .select({ deposit: sql<string>`coalesce(sum(${feePayments.deposit}), 0)` })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tenantId), eq(feePayments.studentId, studentId), eq(feePayments.feeMonth, month)));
    return Number(row?.deposit ?? 0);
  }

  private receiptCode(value: string) {
    const match = value.toUpperCase().match(/INV-[A-F0-9]{8}/);
    if (!match) throw new BadRequestException("Enter a receipt number or scan the invoice QR.");
    return match[0];
  }

  private async invoiceByReceipt(tenantId: string, raw: string) {
    const receiptNo = this.receiptCode(required(raw, "Receipt"));
    const [row] = await this.db
      .select({
        receiptNo: feeInvoices.receiptNo,
        feeMonth: feeInvoices.feeMonth,
        total: feeInvoices.total,
        studentId: feeInvoices.studentId,
        registrationNo: students.registrationNo,
        name: students.name,
        className: classes.name,
      })
      .from(feeInvoices)
      .innerJoin(students, eq(students.id, feeInvoices.studentId))
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(feeInvoices.tenantId, tenantId), eq(feeInvoices.receiptNo, receiptNo)))
      .limit(1);
    if (!row) throw new NotFoundException("No invoice matches that receipt.");
    const paid = await this.deposited(tenantId, row.studentId, row.feeMonth);
    const owing = Math.round((Number(row.total) - paid) * 100) / 100;
    return { receiptNo: row.receiptNo, registrationNo: row.registrationNo, name: row.name, className: row.className, month: row.feeMonth, total: row.total, deposited: money(paid), owing: money(Math.max(owing, 0)) };
  }

  private billableStudents(where: ReturnType<typeof and>) {
    return this.db
      .select({
        id: students.id,
        name: students.name,
        registrationNo: students.registrationNo,
        fatherName: students.fatherName,
        classId: students.classId,
        className: classes.name,
        monthlyFee: classes.monthlyFee,
        discountPercent: students.discountPercent,
        discountType: students.discountType,
        discountAmount: students.discountAmount,
        discountReason: students.discountReason,
        status: students.status,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(where)
      .orderBy(asc(students.registrationNo));
  }

  private uniqueViolation(error: unknown) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code === "23505" || (error as { code?: string }).code === "23505";
  }

  private presentInvoice(
    row: typeof feeInvoices.$inferSelect,
    student: { name: string; registrationNo: string; fatherName: string | null; className: string },
    instituteName: string,
    institutePhone: string,
    instituteLogo: string | null,
    lateFine: number,
  ) {
    const total = Number(row.total);
    return {
      id: row.id,
      instituteName,
      institutePhone,
      instituteLogo,
      student: student.name,
      fatherName: student.fatherName,
      className: student.className,
      registrationNo: student.registrationNo,
      receiptNo: row.receiptNo,
      month: row.feeMonth,
      issuedOn: row.issuedOn,
      dueDate: row.dueDate,
      lines: {
        monthlyFee: row.monthlyFee,
        admission: row.admission,
        registration: row.registration,
        art: row.art,
        transport: row.transport,
        books: row.books,
        uniform: row.uniform,
        fine: row.fine,
        others: row.others,
        previousBalance: row.previousBalance,
        discount: row.discount,
      },
      total: row.total,
      lateFine: money(lateFine),
      payableAfterDue: money(Math.round((total + lateFine) * 100) / 100),
      bank: { name: row.bankName, branch: row.bankBranch, accountNumber: row.accountNumber, instructions: row.instructions },
    };
  }

  private async resolveLines(
    tenantId: string,
    student: { id: string; classId: string; monthlyFee: string; discountPercent: string; discountType: string; discountAmount: string; discountReason: string },
    month: string,
  ) {
    const alreadyAdded = await this.monthlyFeeAlreadyCharged(tenantId, student.id, month);
    const rows = await this.db.select().from(feeParticulars).where(eq(feeParticulars.tenantId, tenantId));
    const ranked = rows
      .map((row) => ({ row, rank: this.particularRank(row, student, month) }))
      .filter((item) => item.rank >= 0)
      .sort((a, b) => b.rank - a.rank);
    const chosen = ranked[0]?.row;
    const [carry] = await this.db
      .select({ amount: feeCarryForwards.amount })
      .from(feeCarryForwards)
      .where(and(eq(feeCarryForwards.tenantId, tenantId), eq(feeCarryForwards.studentId, student.id), eq(feeCarryForwards.targetMonth, month)))
      .limit(1);
    const monthlyFee = alreadyAdded ? 0 : Number(student.monthlyFee);
    const admission = alreadyAdded ? 0 : Number(chosen?.admission ?? 0);
    const registration = alreadyAdded ? 0 : Number(chosen?.registration ?? 0);
    const art = alreadyAdded ? 0 : Number(chosen?.art ?? 0);
    const transport = alreadyAdded ? 0 : Number(chosen?.transport ?? 0);
    const books = alreadyAdded ? 0 : Number(chosen?.books ?? 0);
    const uniform = alreadyAdded ? 0 : Number(chosen?.uniform ?? 0);
    const fine = alreadyAdded ? 0 : Number(chosen?.fine ?? 0);
    const others = alreadyAdded ? 0 : Number(chosen?.others ?? 0);
    const previousBalance = Number(carry?.amount ?? 0);
    const subtotal = monthlyFee + admission + registration + art + transport + books + uniform + fine + others + previousBalance;
    const rawDiscount = alreadyAdded ? 0 : this.feeDiscount(student, monthlyFee);
    const discount = Math.min(rawDiscount, Math.max(subtotal, 0));
    const total = Math.round((subtotal - discount) * 100) / 100;
    return { alreadyAdded, monthlyFee, admission, registration, art, transport, books, uniform, fine, others, previousBalance, discount, discountReason: alreadyAdded || student.discountType !== "fixed" ? "" : student.discountReason, total };
  }

  private feeDiscount(student: { discountType: string; discountAmount: string; discountPercent: string }, monthlyFee: number) {
    if (student.discountType === "fixed") return Math.round(Number(student.discountAmount) * 100) / 100;
    return Math.round(monthlyFee * Number(student.discountPercent)) / 100;
  }

  private classParticularRank(row: typeof feeParticulars.$inferSelect, classId: string, month: string) {
    if (row.scope === "student") return -1;
    if (row.month && row.month !== month) return -1;
    const monthScore = row.month === month ? 2 : 1;
    const scopeScore = row.scope === "class" && row.classId === classId ? 20 : row.scope === "everyone" ? 10 : 0;
    return scopeScore === 0 ? -1 : scopeScore + monthScore;
  }

  private particularRank(
    row: typeof feeParticulars.$inferSelect,
    student: { id: string; classId: string },
    month: string,
  ) {
    if (row.month && row.month !== month) return -1;
    const monthScore = row.month === month ? 2 : 1;
    const scopeScore = row.scope === "student" && row.studentId === student.id ? 30 : row.scope === "class" && row.classId === student.classId ? 20 : row.scope === "everyone" ? 10 : 0;
    return scopeScore === 0 ? -1 : scopeScore + monthScore;
  }

  private logo(value: unknown) {
    const data = required(value, "Logo");
    const match = data.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new BadRequestException("Logo must be a JPG or PNG");
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > 500 * 1024) throw new BadRequestException("Logo must be 500 KB or smaller");
    return data;
  }

  private salaryTotals(rows: Array<{ bonus: string; deduction: string; net: string }>) {
    const sum = (key: "bonus" | "deduction" | "net") => money(rows.reduce((total, row) => total + Number(row[key]), 0));
    return { bonus: sum("bonus"), deduction: sum("deduction"), net: sum("net") };
  }

  private async findPayableEmployee(tenantId: string, employeeId: string) {
    const [employee] = await this.db
      .select({
        id: employees.id,
        name: employees.name,
        staffRole: employees.staffRole,
        monthlySalary: employees.monthlySalary,
        status: employees.status,
      })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.id, employeeId), eq(employees.status, "active")))
      .limit(1);
    if (!employee) throw new NotFoundException("Employee not found or inactive.");
    return employee;
  }

  private async requireHead(tenantId: string, id: string) {
    const [head] = await this.db
      .select()
      .from(accountHeads)
      .where(and(eq(accountHeads.id, id), eq(accountHeads.tenantId, tenantId)))
      .limit(1);
    if (!head) throw new BadRequestException("Choose an account head");
    return head;
  }

  private async ensureHead(tenantId: string, name: string, type: "income" | "expense") {
    const [existing] = await this.db
      .select()
      .from(accountHeads)
      .where(and(eq(accountHeads.tenantId, tenantId), eq(accountHeads.name, name), eq(accountHeads.type, type)))
      .limit(1);
    if (existing) return existing;
    const [created] = await this.db.insert(accountHeads).values({ tenantId, name, type }).returning();
    return created;
  }
}
