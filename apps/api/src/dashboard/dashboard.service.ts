import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  attendanceRecords,
  classTestMarks,
  classTests,
  classes,
  employees,
  examMarks,
  examSubjects,
  exams,
  families,
  feeInvoices,
  feePayments,
  gpsAlerts,
  gpsSettings,
  institutes,
  rfidCards,
  rfidReaders,
  rfidTaps,
  routeAssignments,
  routeStops,
  salaryPayments,
  smsAccounts,
  statementEntries,
  students,
  subjects,
  tenantPlans,
  users,
  vehicles,
  type Database,
} from "@nepatronix/db";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import type { AuthUser } from "../auth/current-user.decorator";
import { linkedStudentIds } from "../auth/children";
import { canOpen } from "../auth/roles";
import { DB } from "../db/db.module";
import { evaluateSubscription, isNearQuota, nearQuotaMessage } from "../plan/subscription";

type MonthBar = { label: string; income: string; expense: string };

@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(user: AuthUser) {
    const institute = await this.institute(user.tenantId);
    const today = this.today(institute.timezone);
    const period = today.slice(0, 7);
    const monthStart = `${period}-01`;
    const monthEnd = this.monthEnd(period);
    const [viewRow] = await this.db.select({ dashboardView: users.dashboardView }).from(users).where(eq(users.id, user.id)).limit(1);
    const view = viewRow?.dashboardView === "new" ? "new" : "classic";
    const seeStudents = canOpen(user.role, "/admin/students");
    const money = canOpen(user.role, "/admin/accounts");
    const linked = user.role === "parent" ? await linkedStudentIds(this.db, user) : null;
    const employeePortal = await this.employeePortal(user, institute, today, period);
    if (employeePortal) {
      return {
        view,
        today,
        dateLabel: this.dateLabel(today, institute.dateFormat),
        greeting: `Welcome ${employeePortal.name} at ${employeePortal.roleLabel} Portal.`,
        symbol: institute.currencySymbol,
        weather: null,
        students: { allTime: 0, thisMonth: 0, active: 0 },
        employees: { allTime: 0, thisMonth: 0, active: 0 },
        revenue: null,
        profit: null,
        fees: null,
        months: null,
        classStrength: [],
        absentToday: 0,
        presentStaff: 0,
        admissions: { count: 0, names: [] },
        birthdays: { count: 0, names: [] },
        demographics: { boys: 0, girls: 0, boysPercent: 0, girlsPercent: 0 },
        progress: { studentsPresent: 0, studentsTotal: 0, staffPresent: 0, staffTotal: 0, feesPercent: null },
        alerts: null,
        cardAlerts: null,
        smsGateway: null,
        employeePortal,
      };
    }

    const studentPortal = await this.studentPortal(user, institute, today, period);
    if (studentPortal) {
      return {
        view,
        today,
        dateLabel: this.dateLabel(today, institute.dateFormat),
        greeting: `Welcome ${studentPortal.name} at Student Portal.`,
        symbol: institute.currencySymbol,
        weather: null,
        students: { allTime: 0, thisMonth: 0, active: 0 },
        employees: { allTime: 0, thisMonth: 0, active: 0 },
        revenue: null,
        profit: null,
        fees: null,
        months: null,
        classStrength: [],
        absentToday: 0,
        presentStaff: 0,
        admissions: { count: 0, names: [] },
        birthdays: { count: 0, names: [] },
        demographics: { boys: 0, girls: 0, boysPercent: 0, girlsPercent: 0 },
        progress: { studentsPresent: 0, studentsTotal: 0, staffPresent: 0, staffTotal: 0, feesPercent: null },
        alerts: null,
        cardAlerts: null,
        smsGateway: null,
        studentPortal,
      };
    }

    const parentPortal = await this.parentPortal(user, institute, today, period);
    if (parentPortal) {
      return {
        view,
        today,
        dateLabel: this.dateLabel(today, institute.dateFormat),
        greeting: `Welcome ${parentPortal.name} at Parent Portal.`,
        symbol: institute.currencySymbol,
        weather: null,
        students: { allTime: 0, thisMonth: 0, active: 0 },
        employees: { allTime: 0, thisMonth: 0, active: 0 },
        revenue: null,
        profit: null,
        fees: null,
        months: null,
        classStrength: [],
        absentToday: 0,
        presentStaff: 0,
        admissions: { count: 0, names: [] },
        birthdays: { count: 0, names: [] },
        demographics: { boys: 0, girls: 0, boysPercent: 0, girlsPercent: 0 },
        progress: { studentsPresent: 0, studentsTotal: 0, staffPresent: 0, staffTotal: 0, feesPercent: null },
        alerts: null,
        cardAlerts: null,
        smsGateway: null,
        parentPortal,
      };
    }

    const people = await this.db
      .select({
        id: students.id,
        name: students.name,
        status: students.status,
        admissionDate: students.admissionDate,
        dateOfBirth: students.dateOfBirth,
        gender: students.gender,
        className: classes.name,
        monthlyFee: classes.monthlyFee,
        discountType: students.discountType,
        discountPercent: students.discountPercent,
        discountAmount: students.discountAmount,
        fatherName: students.fatherName,
        motherName: students.motherName,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .where(eq(students.tenantId, user.tenantId));
    const staff = await this.db
      .select({ id: employees.id, joiningDate: employees.joiningDate, status: employees.status, dateOfBirth: employees.dateOfBirth })
      .from(employees)
      .where(eq(employees.tenantId, user.tenantId));
    const attendance = await this.db
      .select({ studentId: attendanceRecords.studentId, employeeId: attendanceRecords.employeeId, status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, user.tenantId), eq(attendanceRecords.attendanceDate, today)));
    const visiblePeople = linked ? people.filter((person) => linked.has(person.id)) : people;
    const namedPeople = seeStudents ? visiblePeople : [];

    const active = visiblePeople.filter((person) => person.status === "active");
    const admissions = namedPeople.filter((person) => person.admissionDate >= monthStart && person.admissionDate <= monthEnd);
    const birthdays = namedPeople.filter((person) => person.dateOfBirth?.slice(5) === today.slice(5));
    const classMap = new Map<string, number>();
    for (const person of active) classMap.set(person.className, (classMap.get(person.className) ?? 0) + 1);
    const boys = active.filter((person) => person.gender === "male").length;
    const girls = active.filter((person) => person.gender === "female").length;
    const known = boys + girls;
    const presentStudents = attendance.filter((row) => row.studentId && row.status === "present" && (!linked || linked.has(row.studentId))).length;
    const absentStudents = attendance.filter((row) => row.studentId && row.status === "absent" && (!linked || linked.has(row.studentId))).length;
    const presentStaff = attendance.filter((row) => row.employeeId && row.status === "present").length;
    const activeStaff = staff.filter((person) => person.status === "active").length;
    const staffThisMonth = staff.filter((person) => person.joiningDate >= monthStart && person.joiningDate <= monthEnd).length;

    let fees: { estimation: string; collections: string; remainings: string; percent: number } | null = null;
    let revenue: { allTime: string; thisMonth: string } | null = null;
    let profit: { allTime: string; thisMonth: string } | null = null;
    let months: MonthBar[] | null = null;
    if (money) {
      const billed = await this.feeMonth(user.tenantId, period, active);
      fees = billed;
      const entries = await this.db
        .select({ entryDate: statementEntries.entryDate, income: statementEntries.income, expense: statementEntries.expense })
        .from(statementEntries)
        .where(eq(statementEntries.tenantId, user.tenantId));
      const allIncome = entries.reduce((sum, row) => sum + Number(row.income), 0);
      const allExpense = entries.reduce((sum, row) => sum + Number(row.expense), 0);
      const monthEntries = entries.filter((row) => row.entryDate >= monthStart && row.entryDate <= monthEnd);
      const monthIncome = monthEntries.reduce((sum, row) => sum + Number(row.income), 0);
      const monthExpense = monthEntries.reduce((sum, row) => sum + Number(row.expense), 0);
      revenue = { allTime: allIncome.toFixed(2), thisMonth: monthIncome.toFixed(2) };
      profit = { allTime: (allIncome - allExpense).toFixed(2), thisMonth: (monthIncome - monthExpense).toFixed(2) };
      const start = this.addMonths(period, -5);
      months = [];
      for (let index = 0; index < 6; index += 1) {
        const label = this.addMonths(start, index);
        const rows = entries.filter((row) => row.entryDate.startsWith(label));
        months.push({
          label,
          income: rows.reduce((sum, row) => sum + Number(row.income), 0).toFixed(2),
          expense: rows.reduce((sum, row) => sum + Number(row.expense), 0).toFixed(2),
        });
      }
    }

    const weather = await this.weather(institute.address, institute.country);
    return {
      view,
      today,
      dateLabel: this.dateLabel(today, institute.dateFormat),
      greeting: `${this.hello(institute.timezone)}, ${user.name}`,
      symbol: institute.currencySymbol,
      weather,
      students: { allTime: people.length, thisMonth: people.filter((person) => person.admissionDate >= monthStart && person.admissionDate <= monthEnd).length, active: active.length },
      employees: { allTime: staff.length, thisMonth: staffThisMonth, active: activeStaff },
      revenue,
      profit,
      fees,
      months,
      classStrength: [...classMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
      absentToday: absentStudents,
      presentStaff,
      admissions: { count: seeStudents ? admissions.length : people.filter((person) => person.admissionDate >= monthStart && person.admissionDate <= monthEnd).length, names: admissions.map((person) => person.name) },
      birthdays: { count: birthdays.length, names: birthdays.map((person) => person.name) },
      demographics: { boys, girls, boysPercent: this.share(boys, known), girlsPercent: this.share(girls, known) },
      progress: {
        studentsPresent: presentStudents,
        studentsTotal: active.length,
        staffPresent: presentStaff,
        staffTotal: activeStaff,
        feesPercent: fees?.percent ?? null,
      },
      alerts: await this.transportAlerts(user, linked),
      cardAlerts: await this.cardAlerts(user),
      smsGateway: await this.smsGateway(user),
      subscription: await this.subscriptionCard(user),
    };
  }

  private async subscriptionCard(user: AuthUser) {
    if (!canOpen(user.role, "/admin/plan")) return null;
    const [plan] = await this.db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, user.tenantId)).limit(1);
    const [sms] = await this.db.select({ balance: smsAccounts.balance }).from(smsAccounts).where(eq(smsAccounts.tenantId, user.tenantId)).limit(1);
    const [[readers], [cards], [fleet]] = await Promise.all([
      this.db.select({ value: count() }).from(rfidReaders).where(eq(rfidReaders.tenantId, user.tenantId)),
      this.db.select({ value: count() }).from(rfidCards).where(and(eq(rfidCards.tenantId, user.tenantId), ne(rfidCards.status, "blocked"))),
      this.db.select({ value: count() }).from(vehicles).where(eq(vehicles.tenantId, user.tenantId)),
    ]);
    const snapshot = evaluateSubscription({
      planName: plan?.planName,
      status: plan?.status ?? "trial",
      expiresOn: plan?.expiresOn ?? null,
    });
    const usage = {
      readers: Number(readers?.value ?? 0),
      readerQuota: plan?.readerQuota ?? 5,
      cards: Number(cards?.value ?? 0),
      cardQuota: plan?.cardQuota ?? 100,
      vehicles: Number(fleet?.value ?? 0),
      vehicleQuota: plan?.vehicleQuota ?? 5,
      smsBalance: sms?.balance ?? 0,
    };
    return {
      ...snapshot,
      ...usage,
      nearQuota: isNearQuota(usage),
      nearQuotaMessage: nearQuotaMessage(usage),
    };
  }

  private async smsGateway(user: AuthUser) {
    if (!canOpen(user.role, "/admin/sms")) return null;
    const [account] = await this.db
      .select({ pairedAt: smsAccounts.pairedAt, handsetName: smsAccounts.handsetName, balance: smsAccounts.balance })
      .from(smsAccounts)
      .where(eq(smsAccounts.tenantId, user.tenantId))
      .limit(1);
    return {
      connected: Boolean(account?.pairedAt),
      handset: account?.handsetName ?? null,
      balance: account?.balance ?? 0,
    };
  }

  async saveView(user: AuthUser, body: Record<string, unknown>) {
    const view = body.view === "classic" || body.view === "new" ? body.view : "";
    if (!view) throw new BadRequestException("Choose Classic or New.");
    await this.db.update(users).set({ dashboardView: view }).where(eq(users.id, user.id));
    return this.get(user);
  }

  private async transportAlerts(user: AuthUser, linked: Set<string> | null) {
    if (!canOpen(user.role, "/admin/gps")) return null;
    const [settings] = await this.db.select({ notifySms: gpsSettings.notifySms }).from(gpsSettings).where(eq(gpsSettings.tenantId, user.tenantId)).limit(1);
    const rows = await this.db
      .select({ id: gpsAlerts.id, kind: gpsAlerts.kind, message: gpsAlerts.message })
      .from(gpsAlerts)
      .where(eq(gpsAlerts.tenantId, user.tenantId))
      .orderBy(desc(gpsAlerts.createdAt))
      .limit(20);
    if (user.role === "parent") {
      const stops = await this.parentStopNames(user.tenantId, linked ?? new Set());
      return {
        scope: "parent" as const,
        parentSms: false,
        items: rows.filter((row) => row.kind === "arrival" && stops.some((stop) => row.message.includes(stop))).slice(0, 5),
      };
    }
    return { scope: "transport" as const, parentSms: Boolean(settings?.notifySms), items: rows.slice(0, 5) };
  }

  private async cardAlerts(user: AuthUser) {
    if (!canOpen(user.role, "/admin/rfid")) return null;
    const rows = await this.db
      .select({
        id: rfidTaps.id,
        uid: rfidTaps.uid,
        result: rfidTaps.result,
        personName: rfidTaps.personName,
        readerName: rfidReaders.name,
      })
      .from(rfidTaps)
      .innerJoin(rfidReaders, eq(rfidReaders.id, rfidTaps.readerId))
      .where(and(eq(rfidTaps.tenantId, user.tenantId), inArray(rfidTaps.result, ["blocked", "lost"])))
      .orderBy(desc(rfidTaps.tappedAt))
      .limit(5);
    return {
      items: rows.map((row) => ({
        id: row.id,
        message: row.personName
          ? `${row.result === "lost" ? "Lost" : "Blocked"} card for ${row.personName} tapped at ${row.readerName}.`
          : `${row.result === "lost" ? "Lost" : "Blocked"} card ${row.uid} tapped at ${row.readerName}.`,
      })),
    };
  }

  private async parentStopNames(tenantId: string, studentIds: Set<string>) {
    if (!studentIds.size) return [];
    const assigned = await this.db.select({ studentId: routeAssignments.studentId, stopId: routeAssignments.stopId }).from(routeAssignments).where(eq(routeAssignments.tenantId, tenantId));
    const stops = await this.db.select({ id: routeStops.id, name: routeStops.name }).from(routeStops).where(eq(routeStops.tenantId, tenantId));
    const names = new Map(stops.map((stop) => [stop.id, stop.name]));
    return assigned.filter((row) => studentIds.has(row.studentId)).map((row) => names.get(row.stopId)).filter((name): name is string => Boolean(name));
  }

  private async feeMonth(
    tenantId: string,
    period: string,
    active: Array<{ id: string; monthlyFee: string; discountType: string; discountPercent: string; discountAmount: string }>,
  ) {
    const payments = await this.db
      .select({ studentId: feePayments.studentId, total: feePayments.total, deposit: feePayments.deposit })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tenantId), eq(feePayments.feeMonth, period)));
    const invoices = await this.db
      .select({ studentId: feeInvoices.studentId, total: feeInvoices.total })
      .from(feeInvoices)
      .where(and(eq(feeInvoices.tenantId, tenantId), eq(feeInvoices.feeMonth, period)));
    let estimation = 0;
    let collections = 0;
    for (const person of active) {
      const own = payments.filter((payment) => payment.studentId === person.id);
      const invoice = invoices.find((row) => row.studentId === person.id);
      const monthly = Number(person.monthlyFee);
      const discount = person.discountType === "fixed" ? Number(person.discountAmount) : Math.round(monthly * Number(person.discountPercent)) / 100;
      const expected = Math.max(0, Math.round((monthly - discount) * 100) / 100);
      const billed = invoice ? Number(invoice.total) : own.length ? own.reduce((sum, payment) => sum + Number(payment.total), 0) : expected;
      estimation += billed;
      collections += own.reduce((sum, payment) => sum + Number(payment.deposit), 0);
    }
    estimation = Math.round(estimation * 100) / 100;
    collections = Math.round(collections * 100) / 100;
    const remainings = Math.max(0, Math.round((estimation - collections) * 100) / 100);
    return { estimation: estimation.toFixed(2), collections: collections.toFixed(2), remainings: remainings.toFixed(2), percent: this.share(collections, estimation) };
  }

  private async portalStudentRows(tenantId: string, ids?: Set<string>) {
    const rows = await this.db
      .select({
        id: students.id,
        name: students.name,
        registrationNo: students.registrationNo,
        photoUrl: students.photoUrl,
        address: students.address,
        gender: students.gender,
        religion: students.religion,
        bloodGroup: students.bloodGroup,
        dateOfBirth: students.dateOfBirth,
        admissionDate: students.admissionDate,
        identificationMark: students.identificationMark,
        disease: students.disease,
        birthId: students.birthId,
        caste: students.caste,
        previousSchool: students.previousSchool,
        previousId: students.previousId,
        note: students.note,
        orphan: students.orphan,
        osc: students.osc,
        siblings: students.siblings,
        discountType: students.discountType,
        discountPercent: students.discountPercent,
        discountAmount: students.discountAmount,
        fatherName: students.fatherName,
        motherName: students.motherName,
        portalUsername: students.portalUsername,
        className: classes.name,
        monthlyFee: classes.monthlyFee,
        familyName: families.name,
      })
      .from(students)
      .innerJoin(classes, eq(classes.id, students.classId))
      .leftJoin(families, eq(families.id, students.familyId))
      .where(eq(students.tenantId, tenantId));
    if (!ids) return rows;
    return rows.filter((row) => ids.has(row.id));
  }

  private async studentCard(
    tenantId: string,
    person: Awaited<ReturnType<DashboardService["portalStudentRows"]>>[number],
    institute: { name: string; targetLine: string; timezone: string; dateFormat: string; currencySymbol: string },
    today: string,
    period: string,
  ) {
    const monthStart = `${period}-01`;
    const monthEnd = this.monthEnd(period);
    const yesterday = this.addDays(today, -1);
    const marks = await this.db
      .select({ attendanceDate: attendanceRecords.attendanceDate, status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.studentId, person.id)));
    const monthMarks = marks.filter((row) => row.attendanceDate >= monthStart && row.attendanceDate <= monthEnd);
    const presents = monthMarks.filter((row) => row.status === "present").length;
    const leaves = monthMarks.filter((row) => row.status === "leave").length;
    const absents = monthMarks.filter((row) => row.status === "absent").length;
    const markedDays = presents + leaves + absents;
    const overallMarks = marks.filter((row) => row.status === "present" || row.status === "leave" || row.status === "absent");
    const overallPresent = overallMarks.filter((row) => row.status === "present").length;
    const todayMark = marks.find((row) => row.attendanceDate === today)?.status ?? null;
    const yesterdayMark = marks.find((row) => row.attendanceDate === yesterday)?.status ?? null;

    const [payment] = await this.db
      .select({ deposit: feePayments.deposit, paidOn: feePayments.paidOn, feeMonth: feePayments.feeMonth, due: feePayments.due })
      .from(feePayments)
      .where(and(eq(feePayments.tenantId, tenantId), eq(feePayments.studentId, person.id)))
      .orderBy(desc(feePayments.paidOn))
      .limit(1);
    const monthPaid = payment?.feeMonth === period;
    const [invoice] = await this.db
      .select({ total: feeInvoices.total })
      .from(feeInvoices)
      .where(and(eq(feeInvoices.tenantId, tenantId), eq(feeInvoices.studentId, person.id), eq(feeInvoices.feeMonth, period)))
      .limit(1);

    const monthly = Number(person.monthlyFee);
    const discount =
      person.discountType === "fixed"
        ? Number(person.discountAmount)
        : Math.round(monthly * Number(person.discountPercent)) / 100;
    const estimated = Math.max(0, Math.round((monthly - discount) * 100) / 100);
    const discountLabel =
      person.discountType === "fixed"
        ? `${institute.currencySymbol} ${Number(person.discountAmount).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
        : `${Number(person.discountPercent)} %`;

    const classTestRows = await this.db
      .select({
        date: classTests.testDate,
        total: classTests.totalMarks,
        obtained: classTestMarks.obtained,
        subjectName: subjects.name,
      })
      .from(classTestMarks)
      .innerJoin(classTests, eq(classTests.id, classTestMarks.testId))
      .innerJoin(subjects, eq(subjects.id, classTests.subjectId))
      .where(and(eq(classTests.tenantId, tenantId), eq(classTestMarks.studentId, person.id)))
      .orderBy(desc(classTests.testDate))
      .limit(8);

    const examRows = await this.db
      .select({
        examName: exams.name,
        obtained: examMarks.obtained,
        total: examSubjects.totalMarks,
        subjectName: subjects.name,
      })
      .from(examMarks)
      .innerJoin(exams, eq(exams.id, examMarks.examId))
      .innerJoin(subjects, eq(subjects.id, examMarks.subjectId))
      .leftJoin(
        examSubjects,
        and(eq(examSubjects.examId, examMarks.examId), eq(examSubjects.subjectId, examMarks.subjectId)),
      )
      .where(and(eq(examMarks.tenantId, tenantId), eq(examMarks.studentId, person.id)))
      .orderBy(desc(exams.startDate))
      .limit(8);

    const feeReminder = monthPaid
      ? null
      : {
          estimated: estimated.toFixed(2),
          symbol: institute.currencySymbol,
          message: `This Month Fee is Not Paid Yet. Your estimated fee of This Month is ${institute.currencySymbol} ${estimated.toLocaleString("en-US", { maximumFractionDigits: 0 })}. Please Pay your fee before due date.`,
        };

    return {
      id: person.id,
      name: person.name,
      photoUrl: person.photoUrl,
      registrationNo: person.registrationNo || this.registrationNo(person.id),
      admissionDate: this.dateLabel(person.admissionDate, institute.dateFormat),
      className: person.className,
      familyName: person.familyName ?? "",
      discountLabel,
      dateOfBirth: person.dateOfBirth ? this.dateLabel(person.dateOfBirth, institute.dateFormat) : "",
      gender: person.gender ?? "",
      identificationMark: person.identificationMark ?? "",
      bloodGroup: person.bloodGroup ?? "",
      disease: person.disease ?? "",
      birthId: person.birthId ?? "",
      caste: person.caste ?? "",
      previousSchool: person.previousSchool ?? "",
      previousId: person.previousId ?? "",
      note: person.note ?? "",
      orphan: person.orphan ?? "",
      osc: person.osc ?? "",
      religion: person.religion ?? "",
      siblings: person.siblings ?? "0",
      fatherName: person.fatherName ?? "",
      motherName: person.motherName ?? "",
      address: person.address ?? "",
      instituteName: institute.name,
      targetLine: institute.targetLine,
      attendance: {
        overallPercent: this.share(overallPresent, overallMarks.length || 0),
        monthPercent: this.share(presents, markedDays || 0),
        monthLabel: this.monthShort(period),
        today: todayMark,
        yesterday: yesterdayMark,
        presents,
        leaves,
        absents,
      },
      classTests: classTestRows.map((row) => ({
        subjectName: row.subjectName,
        date: this.dateLabel(row.date, institute.dateFormat),
        obtained: row.obtained,
        total: row.total,
      })),
      examinations: examRows.map((row) => ({
        examName: row.examName,
        subjectName: row.subjectName,
        obtained: String(row.obtained ?? ""),
        total: String(row.total ?? ""),
      })),
      fees: {
        monthly: estimated.toFixed(2),
        paidThisMonth: Boolean(monthPaid),
        due: payment?.due ?? invoice?.total ?? "0",
        latest: payment
          ? { deposit: payment.deposit, paidOn: this.dateLabel(payment.paidOn, institute.dateFormat), feeMonth: payment.feeMonth }
          : null,
        records: payment
          ? [{ deposit: payment.deposit, paidOn: this.dateLabel(payment.paidOn, institute.dateFormat), feeMonth: payment.feeMonth }]
          : [],
      },
      feeReminder,
    };
  }

  private async studentPortal(user: AuthUser, institute: { name: string; targetLine: string; timezone: string; dateFormat: string; currencySymbol: string }, today: string, period: string) {
    if (user.role !== "student") return null;
    const rows = await this.portalStudentRows(user.tenantId);
    const person =
      (user.studentId ? rows.find((row) => row.id === user.studentId) : undefined) ??
      rows.find((row) => {
        if (!row.portalUsername) return false;
        const prefix = `${row.portalUsername.toLowerCase()}.`;
        return user.email.toLowerCase().startsWith(prefix) && user.email.toLowerCase().includes("@students.");
      }) ??
      rows.find((row) => row.name.toLowerCase() === user.name.toLowerCase());
    if (!person) return null;
    return this.studentCard(user.tenantId, person, institute, today, period);
  }

  private async parentPortal(user: AuthUser, institute: { name: string; targetLine: string; timezone: string; dateFormat: string; currencySymbol: string }, today: string, period: string) {
    if (user.role !== "parent") return null;
    const linked = await linkedStudentIds(this.db, user);
    const rows = await this.portalStudentRows(user.tenantId, linked);
    const children = [];
    for (const person of rows) {
      children.push(await this.studentCard(user.tenantId, person, institute, today, period));
    }
    const unpaid = children.find((child) => child.feeReminder);
    return {
      name: user.name,
      instituteName: institute.name,
      targetLine: institute.targetLine,
      children,
      feeReminder: unpaid?.feeReminder
        ? {
            ...unpaid.feeReminder,
            message: `${unpaid.name}: ${unpaid.feeReminder.message}`,
          }
        : null,
    };
  }

  private async employeePortal(user: AuthUser, institute: { name: string; targetLine: string; timezone: string; dateFormat: string; currencySymbol: string }, today: string, period: string) {
    const staffRoles = new Set(["principal", "teacher", "accountant", "store_manager", "employee"]);
    if (!staffRoles.has(user.role)) return null;
    const staff = await this.db
      .select({
        id: employees.id,
        name: employees.name,
        phone: employees.phone,
        joiningDate: employees.joiningDate,
        staffRole: employees.staffRole,
        monthlySalary: employees.monthlySalary,
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
        photoUrl: employees.photoUrl,
        portalUsername: employees.portalUsername,
      })
      .from(employees)
      .where(eq(employees.tenantId, user.tenantId));
    const person = staff.find((row) => {
      if (!row.portalUsername) return false;
      const prefix = `${row.portalUsername.toLowerCase()}.`;
      return user.email.toLowerCase().startsWith(prefix) && user.email.toLowerCase().includes("@employees.");
    }) ?? staff.find((row) => row.name.toLowerCase() === user.name.toLowerCase());
    if (!person) return null;

    const monthStart = `${period}-01`;
    const monthEnd = this.monthEnd(period);
    const yesterday = this.addDays(today, -1);
    const marks = await this.db
      .select({ attendanceDate: attendanceRecords.attendanceDate, status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, user.tenantId), eq(attendanceRecords.employeeId, person.id)));
    const monthMarks = marks.filter((row) => row.attendanceDate >= monthStart && row.attendanceDate <= monthEnd);
    const presents = monthMarks.filter((row) => row.status === "present").length;
    const leaves = monthMarks.filter((row) => row.status === "leave").length;
    const absents = monthMarks.filter((row) => row.status === "absent").length;
    const markedDays = presents + leaves + absents;
    const overallMarks = marks.filter((row) => row.status === "present" || row.status === "leave" || row.status === "absent");
    const overallPresent = overallMarks.filter((row) => row.status === "present").length;
    const todayMark = marks.find((row) => row.attendanceDate === today)?.status ?? null;
    const yesterdayMark = marks.find((row) => row.attendanceDate === yesterday)?.status ?? null;
    const [payment] = await this.db
      .select({ net: salaryPayments.net, paidOn: salaryPayments.paidOn, salaryMonth: salaryPayments.salaryMonth })
      .from(salaryPayments)
      .where(and(eq(salaryPayments.tenantId, user.tenantId), eq(salaryPayments.employeeId, person.id)))
      .orderBy(desc(salaryPayments.paidOn))
      .limit(1);
    const monthPaid = payment?.salaryMonth === period;

    return {
      name: person.name,
      photoUrl: person.photoUrl,
      registrationNo: this.registrationNo(person.id),
      roleLabel: this.staffLabel(person.staffRole),
      monthlySalary: person.monthlySalary,
      fatherOrHusband: person.fatherOrHusband ?? "",
      phone: person.phone,
      email: person.email ?? "",
      address: person.address ?? "",
      nationalId: person.nationalId ?? "",
      education: person.education ?? "",
      gender: person.gender ?? "",
      religion: person.religion ?? "",
      bloodGroup: person.bloodGroup ?? "",
      dateOfBirth: person.dateOfBirth ? this.dateLabel(person.dateOfBirth, institute.dateFormat) : "",
      joiningDate: this.dateLabel(person.joiningDate, institute.dateFormat),
      experience: person.experience ?? "",
      instituteName: institute.name,
      targetLine: institute.targetLine,
      attendance: {
        overallPercent: this.share(overallPresent, overallMarks.length || 0),
        monthPercent: this.share(presents, markedDays || 0),
        monthLabel: this.monthShort(period),
        today: todayMark,
        yesterday: yesterdayMark,
        presents,
        leaves,
        absents,
      },
      salary: {
        current: person.monthlySalary,
        receivedThisMonth: Boolean(monthPaid),
        latest: payment
          ? { net: payment.net, paidOn: this.dateLabel(payment.paidOn, institute.dateFormat), salaryMonth: payment.salaryMonth }
          : null,
      },
    };
  }

  private registrationNo(id: string) {
    const value = Number.parseInt(id.replace(/-/g, "").slice(0, 8), 16);
    return String((Number.isFinite(value) ? value % 900000 : 100000) + 100000);
  }

  private staffLabel(role: string) {
    return role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private monthShort(period: string) {
    const [year, month] = period.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  private addDays(day: string, count: number) {
    const [year, month, date] = day.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, date + count));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  }

  private async institute(tenantId: string) {
    const [row] = await this.db
      .select({
        name: institutes.name,
        targetLine: institutes.targetLine,
        address: institutes.address,
        country: institutes.country,
        timezone: institutes.timezone,
        dateFormat: institutes.dateFormat,
        currencySymbol: institutes.currencySymbol,
      })
      .from(institutes)
      .where(eq(institutes.tenantId, tenantId))
      .limit(1);
    return {
      name: row?.name ?? "Your Institute Name Here",
      targetLine: row?.targetLine ?? "Your targetline goes here",
      address: row?.address ?? "",
      country: row?.country ?? "",
      timezone: row?.timezone || "Asia/Kathmandu",
      dateFormat: row?.dateFormat || "d MMMM, yyyy",
      currencySymbol: row?.currencySymbol || "$",
    };
  }

  private async weather(address: string, country: string) {
    const place = await this.place(address, country);
    if (!place) return null;
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        current?: {
          temperature_2m?: number;
          apparent_temperature?: number;
          relative_humidity_2m?: number;
          wind_speed_10m?: number;
          weather_code?: number;
        };
      };
      if (typeof body.current?.temperature_2m !== "number") return null;
      return {
        place: place.name,
        temperature: `${Math.round(body.current.temperature_2m)}°C`,
        summary: this.sky(body.current.weather_code ?? -1),
        feels: typeof body.current.apparent_temperature === "number" ? `Feels ${Math.round(body.current.apparent_temperature)}°` : null,
        humidity: typeof body.current.relative_humidity_2m === "number" ? `${Math.round(body.current.relative_humidity_2m)}%` : null,
        wind: typeof body.current.wind_speed_10m === "number" ? `${Math.round(body.current.wind_speed_10m)} km/h` : null,
      };
    } catch {
      return null;
    }
  }

  private async place(address: string, country: string) {
    for (const query of [address, country]) {
      const name = query.trim();
      if (!name) continue;
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`, { signal: AbortSignal.timeout(2500) });
        if (!response.ok) continue;
        const body = (await response.json()) as { results?: Array<{ name: string; latitude: number; longitude: number }> };
        const found = body.results?.[0];
        if (found) return found;
      } catch {
        return null;
      }
    }
    return null;
  }

  private sky(code: number) {
    if (code === 0) return "Clear";
    if (code <= 3) return "Cloudy";
    if (code === 45 || code === 48) return "Fog";
    if (code <= 57) return "Drizzle";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Showers";
    if (code >= 95) return "Thunder";
    return "Weather";
  }

  private today(timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  private hello(timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const hour = Number(parts.find((item) => item.type === "hour")?.value ?? "0");
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  private dateLabel(today: string, format: string) {
    const [year, month, day] = today.split("-");
    if (format === "yyyy-MM-dd") return today;
    if (format === "dd/MM/yyyy") return `${day}/${month}/${year}`;
    const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
    return `${Number(day)} ${monthName}, ${year}`;
  }

  private share(part: number, whole: number) {
    if (whole <= 0) return 0;
    return Math.round((part / whole) * 1000) / 10;
  }

  private addMonths(period: string, count: number) {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + count, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private monthEnd(period: string) {
    const [year, month] = period.split("-").map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${period}-${String(last).padStart(2, "0")}`;
  }
}
