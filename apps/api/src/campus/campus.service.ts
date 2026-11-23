import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  accountHeads,
  behaviourRatings,
  classes,
  employees,
  observations,
  periods,
  productCategories,
  productTaxes,
  products,
  rooms,
  statementEntries,
  storeOrderLines,
  storeOrders,
  students,
  subjects,
  timetableSlots,
  type Database,
} from "@nepatronix/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { DB } from "../db/db.module";
import { affectiveTraits, domainOf, psychomotorTraits, weekdays } from "./traits";

function required(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${label} is required`);
  return value.trim();
}

function money(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

@Injectable()
export class CampusService {
  constructor(@Inject(DB) private readonly db: Database) {}

  periods(tenantId: string) {
    return this.db.select().from(periods).where(eq(periods.tenantId, tenantId)).orderBy(asc(periods.sortOrder), asc(periods.startsAt));
  }

  async addPeriod(tenantId: string, body: Record<string, unknown>) {
    const [row] = await this.db.insert(periods).values({
      tenantId,
      name: required(body.name, "Period"),
      startsAt: required(body.startsAt, "Start"),
      endsAt: required(body.endsAt, "End"),
      sortOrder: Number(body.sortOrder) || 1,
    }).returning();
    return row;
  }

  rooms(tenantId: string) {
    return this.db.select().from(rooms).where(eq(rooms.tenantId, tenantId)).orderBy(rooms.name);
  }

  async addRoom(tenantId: string, body: Record<string, unknown>) {
    const [row] = await this.db.insert(rooms).values({ tenantId, name: required(body.name, "Room") }).returning();
    return row;
  }

  async slots(tenantId: string) {
    return this.slotRows(tenantId);
  }

  async addSlot(tenantId: string, body: Record<string, unknown>) {
    const weekday = required(body.weekday, "Weekday");
    if (!weekdays.includes(weekday as (typeof weekdays)[number])) throw new BadRequestException("Choose a weekday");
    const periodId = required(body.periodId, "Period");
    const roomId = required(body.roomId, "Room");
    const classId = required(body.classId, "Class");
    const subjectId = required(body.subjectId, "Subject");
    const teacherId = required(body.teacherId, "Teacher");
    await this.requirePeriod(tenantId, periodId);
    await this.requireRoom(tenantId, roomId);
    const subject = await this.requireSubject(tenantId, subjectId);
    if (subject.classId !== classId) throw new BadRequestException("That subject is not on this class");
    await this.requireTeacher(tenantId, teacherId);
    const samePeriod = and(eq(timetableSlots.tenantId, tenantId), eq(timetableSlots.weekday, weekday), eq(timetableSlots.periodId, periodId));
    const [roomClash] = await this.db.select({ id: timetableSlots.id }).from(timetableSlots).where(and(samePeriod, eq(timetableSlots.roomId, roomId))).limit(1);
    if (roomClash) throw new ConflictException("This room is already booked for that period.");
    const [classClash] = await this.db.select({ id: timetableSlots.id }).from(timetableSlots).where(and(samePeriod, eq(timetableSlots.classId, classId))).limit(1);
    if (classClash) throw new ConflictException("This class is already booked for that period.");
    const [teacherClash] = await this.db.select({ id: timetableSlots.id }).from(timetableSlots).where(and(samePeriod, eq(timetableSlots.teacherId, teacherId))).limit(1);
    if (teacherClash) throw new ConflictException("This teacher is already booked for that period.");
    const [row] = await this.db.insert(timetableSlots).values({ tenantId, weekday, periodId, roomId, classId, subjectId, teacherId }).returning();
    return row;
  }

  async deleteSlot(tenantId: string, id: string) {
    await this.db.delete(timetableSlots).where(and(eq(timetableSlots.id, id), eq(timetableSlots.tenantId, tenantId)));
    return { ok: true };
  }

  async classTimetable(tenantId: string, classId: string) {
    const classroom = await this.requireClass(tenantId, classId);
    const rows = (await this.slotRows(tenantId)).filter((row) => row.classId === classId);
    return { name: classroom.name, slots: rows };
  }

  async teacherTimetable(tenantId: string, teacherId: string) {
    const teacher = await this.requireTeacher(tenantId, teacherId);
    const rows = (await this.slotRows(tenantId)).filter((row) => row.teacherId === teacherId);
    return { name: teacher.name, slots: rows };
  }

  behaviourCatalog() {
    return { affective: affectiveTraits, psychomotor: psychomotorTraits, scale: "1 to 5" };
  }

  async ratings(tenantId: string, studentId: string) {
    await this.requireStudent(tenantId, studentId);
    const rows = await this.db.select().from(behaviourRatings).where(and(eq(behaviourRatings.tenantId, tenantId), eq(behaviourRatings.studentId, studentId)));
    const notes = await this.db.select().from(observations).where(and(eq(observations.tenantId, tenantId), eq(observations.studentId, studentId))).orderBy(asc(observations.observedOn));
    return { ratings: rows, observations: notes };
  }

  async saveRatings(tenantId: string, body: Record<string, unknown>) {
    const studentId = required(body.studentId, "Student");
    await this.requireStudent(tenantId, studentId);
    const ratings = Array.isArray(body.ratings) ? body.ratings : [];
    for (const item of ratings) {
      if (!item || typeof item !== "object") continue;
      const trait = required((item as { trait?: unknown }).trait, "Trait");
      const domain = domainOf(trait);
      if (!domain) throw new BadRequestException("Choose a behaviour or skill from the list");
      const rating = Number((item as { rating?: unknown }).rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException("Rate each trait from 1 to 5");
      await this.db.insert(behaviourRatings).values({ tenantId, studentId, domain, trait, rating }).onConflictDoUpdate({
        target: [behaviourRatings.tenantId, behaviourRatings.studentId, behaviourRatings.trait],
        set: { rating, domain },
      });
    }
    return { ok: true };
  }

  async addObservation(tenantId: string, body: Record<string, unknown>) {
    const studentId = required(body.studentId, "Student");
    await this.requireStudent(tenantId, studentId);
    const [row] = await this.db.insert(observations).values({
      tenantId,
      studentId,
      note: required(body.note, "Observation"),
      observedOn: required(body.date, "Date"),
    }).returning();
    return row;
  }

  async behaviourReport(tenantId: string, classId: string, domain: "affective" | "psychomotor") {
    const classroom = await this.requireClass(tenantId, classId);
    const names = domain === "affective" ? affectiveTraits : psychomotorTraits;
    const people = await this.db.select({ id: students.id, name: students.name, registrationNo: students.registrationNo }).from(students).where(and(eq(students.tenantId, tenantId), eq(students.classId, classId), eq(students.status, "active"))).orderBy(students.name);
    const rows = await this.db.select().from(behaviourRatings).where(and(eq(behaviourRatings.tenantId, tenantId), eq(behaviourRatings.domain, domain)));
    return {
      className: classroom.name,
      traits: names,
      students: people.map((person) => {
        const mine = rows.filter((row) => row.studentId === person.id);
        const rated = mine.filter((row) => names.includes(row.trait));
        const percent = rated.length ? Math.round((rated.reduce((sum, row) => sum + row.rating, 0) / (rated.length * 5)) * 10000) / 100 : null;
        return {
          registrationNo: person.registrationNo,
          name: person.name,
          percent,
          traits: names.map((name) => mine.find((row) => row.trait === name)?.rating ?? null),
        };
      }),
    };
  }

  async storeHome(tenantId: string) {
    const categories = await this.db.select().from(productCategories).where(eq(productCategories.tenantId, tenantId)).orderBy(productCategories.name);
    const taxes = await this.db.select().from(productTaxes).where(eq(productTaxes.tenantId, tenantId)).orderBy(productTaxes.name);
    const catalog = await this.db.select().from(products).where(eq(products.tenantId, tenantId)).orderBy(products.name);
    const orders = await this.orders(tenantId);
    const units = orders.reduce((sum, order) => sum + order.quantity, 0);
    const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
    return {
      categories,
      taxes,
      products: catalog,
      orders,
      analytics: {
        orders: orders.length,
        revenue: money(revenue),
        units,
        lowStock: catalog.filter((product) => product.stock < 5).map((product) => ({ name: product.name, stock: product.stock })),
      },
    };
  }

  async addCategory(tenantId: string, body: Record<string, unknown>) {
    const [row] = await this.db.insert(productCategories).values({ tenantId, name: required(body.name, "Category") }).returning();
    return row;
  }

  async addTax(tenantId: string, body: Record<string, unknown>) {
    const percent = Number(body.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new BadRequestException("Tax percent must be from 0 to 100");
    const [row] = await this.db.insert(productTaxes).values({ tenantId, name: required(body.name, "Tax"), percent: money(percent) }).returning();
    return row;
  }

  async addProduct(tenantId: string, body: Record<string, unknown>) {
    const price = Number(body.price);
    const stock = Number(body.stock);
    if (!Number.isFinite(price) || price <= 0) throw new BadRequestException("Price must be greater than zero");
    if (!Number.isInteger(stock) || stock < 0) throw new BadRequestException("Stock must be a whole number");
    const categoryId = required(body.categoryId, "Category");
    await this.requireCategory(tenantId, categoryId);
    const taxId = typeof body.taxId === "string" && body.taxId ? body.taxId : null;
    if (taxId) await this.requireTax(tenantId, taxId);
    const [row] = await this.db.insert(products).values({ tenantId, categoryId, taxId, name: required(body.name, "Product"), price: money(price), stock }).returning();
    return row;
  }

  async createOrder(tenantId: string, body: Record<string, unknown>) {
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length) throw new BadRequestException("Add at least one product");
    const prepared: Array<{ product: { id: string; name: string; price: string; stock: number; taxId: string | null }; quantity: number; taxPercent: number; taxAmount: number; lineTotal: number }> = [];
    for (const line of lines) {
      if (!line || typeof line !== "object") throw new BadRequestException("Add at least one product");
      const productId = required((line as { productId?: unknown }).productId, "Product");
      const quantity = Number((line as { quantity?: unknown }).quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw new BadRequestException("Quantity must be at least 1");
      const product = await this.requireProduct(tenantId, productId);
      if (product.stock < quantity) throw new ConflictException(`${product.name} has ${product.stock} in stock`);
      const tax = product.taxId ? await this.requireTax(tenantId, product.taxId) : null;
      const taxPercent = tax ? Number(tax.percent) : 0;
      const net = Math.round(Number(product.price) * quantity * 100) / 100;
      const taxAmount = Math.round(net * taxPercent) / 100;
      prepared.push({ product, quantity, taxPercent, taxAmount, lineTotal: Math.round((net + taxAmount) * 100) / 100 });
    }
    const tax = prepared.reduce((sum, line) => sum + line.taxAmount, 0);
    const total = prepared.reduce((sum, line) => sum + line.lineTotal, 0);
    const soldOn = required(body.date, "Date");
    return this.db.transaction(async (tx) => {
      const [order] = await tx.insert(storeOrders).values({ tenantId, soldOn, total: money(total), tax: money(tax) }).returning();
      for (const line of prepared) {
        await tx.insert(storeOrderLines).values({
          orderId: order.id,
          productId: line.product.id,
          quantity: line.quantity,
          unitPrice: line.product.price,
          taxPercent: money(line.taxPercent),
          lineTotal: money(line.lineTotal),
        });
        await tx.update(products).set({ stock: line.product.stock - line.quantity }).where(eq(products.id, line.product.id));
      }
      const head = await this.ensureHead(tx, tenantId);
      const [entry] = await tx.insert(statementEntries).values({
        tenantId,
        headId: head.id,
        entryDate: soldOn,
        description: `Store sale ${order.id}`,
        income: money(total),
        expense: "0.00",
        source: "manual",
      }).returning();
      await tx.update(storeOrders).set({ statementEntryId: entry.id }).where(eq(storeOrders.id, order.id));
      return {
        id: order.id,
        soldOn,
        total: money(total),
        tax: money(tax),
        lines: prepared.map((line) => ({
          name: line.product.name,
          quantity: line.quantity,
          unitPrice: line.product.price,
          lineTotal: money(line.lineTotal),
        })),
      };
    });
  }

  async deleteOrder(tenantId: string, id: string) {
    const [order] = await this.db.select().from(storeOrders).where(and(eq(storeOrders.id, id), eq(storeOrders.tenantId, tenantId))).limit(1);
    if (!order) throw new NotFoundException("Order not found");
    const lines = await this.db.select().from(storeOrderLines).where(eq(storeOrderLines.orderId, id));
    await this.db.transaction(async (tx) => {
      for (const line of lines) {
        await tx.update(products).set({ stock: sql`${products.stock} + ${line.quantity}` }).where(eq(products.id, line.productId));
      }
      await tx.delete(storeOrders).where(eq(storeOrders.id, id));
      if (order.statementEntryId) {
        await tx.delete(statementEntries).where(and(eq(statementEntries.id, order.statementEntryId), eq(statementEntries.tenantId, tenantId)));
      }
    });
    return { ok: true };
  }

  private async orders(tenantId: string) {
    const rows = await this.db.select().from(storeOrders).where(eq(storeOrders.tenantId, tenantId)).orderBy(asc(storeOrders.soldOn));
    const lines = rows.length ? await this.db.select().from(storeOrderLines).where(inArray(storeOrderLines.orderId, rows.map((row) => row.id))) : [];
    return rows.map((order) => {
      const mine = lines.filter((line) => line.orderId === order.id);
      return { ...order, quantity: mine.reduce((sum, line) => sum + line.quantity, 0), lines: mine };
    });
  }

  private async slotRows(tenantId: string) {
    return this.db.select({
      id: timetableSlots.id,
      weekday: timetableSlots.weekday,
      periodId: timetableSlots.periodId,
      roomId: timetableSlots.roomId,
      classId: timetableSlots.classId,
      subjectId: timetableSlots.subjectId,
      teacherId: timetableSlots.teacherId,
      periodName: periods.name,
      startsAt: periods.startsAt,
      endsAt: periods.endsAt,
      roomName: rooms.name,
      className: classes.name,
      subjectName: subjects.name,
      teacherName: employees.name,
    }).from(timetableSlots)
      .innerJoin(periods, eq(periods.id, timetableSlots.periodId))
      .innerJoin(rooms, eq(rooms.id, timetableSlots.roomId))
      .innerJoin(classes, eq(classes.id, timetableSlots.classId))
      .innerJoin(subjects, eq(subjects.id, timetableSlots.subjectId))
      .innerJoin(employees, eq(employees.id, timetableSlots.teacherId))
      .where(eq(timetableSlots.tenantId, tenantId))
      .orderBy(periods.sortOrder);
  }

  private async ensureHead(tx: Pick<Database, "select" | "insert">, tenantId: string) {
    const [existing] = await tx.select().from(accountHeads).where(and(eq(accountHeads.tenantId, tenantId), eq(accountHeads.name, "Store Income"), eq(accountHeads.type, "income"))).limit(1);
    if (existing) return existing;
    const [created] = await tx.insert(accountHeads).values({ tenantId, name: "Store Income", type: "income" }).returning();
    return created;
  }

  private async requirePeriod(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: periods.id }).from(periods).where(and(eq(periods.id, id), eq(periods.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Period not found");
  }

  private async requireRoom(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, id), eq(rooms.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Room not found");
  }

  private async requireClass(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: classes.id, name: classes.name }).from(classes).where(and(eq(classes.id, id), eq(classes.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Class not found.");
    return row;
  }

  private async requireSubject(tenantId: string, id: string) {
    const [row] = await this.db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Subject not found");
    return row;
  }

  private async requireTeacher(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: employees.id, name: employees.name }).from(employees).where(and(eq(employees.id, id), eq(employees.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Teacher not found");
    return row;
  }

  private async requireStudent(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: students.id }).from(students).where(and(eq(students.id, id), eq(students.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Student not found.");
  }

  private async requireCategory(tenantId: string, id: string) {
    const [row] = await this.db.select({ id: productCategories.id }).from(productCategories).where(and(eq(productCategories.id, id), eq(productCategories.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Category not found");
  }

  private async requireTax(tenantId: string, id: string) {
    const [row] = await this.db.select().from(productTaxes).where(and(eq(productTaxes.id, id), eq(productTaxes.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Tax not found");
    return row;
  }

  private async requireProduct(tenantId: string, id: string) {
    const [row] = await this.db.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, tenantId))).limit(1);
    if (!row) throw new NotFoundException("Product not found");
    return row;
  }
}
