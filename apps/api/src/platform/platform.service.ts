import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import {
  auditEvents,
  classes,
  employees,
  institutes,
  rfidCards,
  rfidReaders,
  smsAccounts,
  students,
  supportLoginTokens,
  tenantPlans,
  tenants,
  users,
  vehicles,
  type Database,
} from "@nepatronix/db";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { AuditService, type Actor } from "../audit/audit.service";
import { DB } from "../db/db.module";
import { hashPassword, hashToken } from "../auth/session";
import { evaluateSubscription, isNearQuota } from "../plan/subscription";

const STATUSES = ["trial", "active", "past_due", "suspended", "cancelled"] as const;

@Injectable()
export class PlatformService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensurePlatformAdmin();
  }

  recentActivity(tenantId?: string) {
    return this.audit.listPlatform(tenantId ? 80 : 40, tenantId);
  }

  async listSchools() {
    const rows = await this.db
      .select({
        tenantId: tenants.id,
        createdAt: tenants.createdAt,
        instituteName: institutes.name,
        phone: institutes.phone,
        country: institutes.country,
        planName: tenantPlans.planName,
        status: tenantPlans.status,
        expiresOn: tenantPlans.expiresOn,
        notes: tenantPlans.notes,
        readerQuota: tenantPlans.readerQuota,
        cardQuota: tenantPlans.cardQuota,
        vehicleQuota: tenantPlans.vehicleQuota,
        assistantTokenQuota: tenantPlans.assistantTokenQuota,
        updatedAt: tenantPlans.updatedAt,
      })
      .from(tenants)
      .innerJoin(institutes, eq(institutes.tenantId, tenants.id))
      .leftJoin(tenantPlans, eq(tenantPlans.tenantId, tenants.id))
      .where(sql`lower(${institutes.name}) <> 'nepatronix ops'`)
      .orderBy(desc(tenants.createdAt));

    const [adminRows, classRows, staffRows, inviteRows] = await Promise.all([
      this.db.select({ tenantId: users.tenantId }).from(users).where(eq(users.role, "admin")),
      this.db.select({ tenantId: classes.tenantId, value: count() }).from(classes).groupBy(classes.tenantId),
      this.db.select({ tenantId: employees.tenantId, value: count() }).from(employees).groupBy(employees.tenantId),
      this.db
        .select({ tenantId: auditEvents.tenantId })
        .from(auditEvents)
        .where(eq(auditEvents.action, "platform_admin_invite"))
        .groupBy(auditEvents.tenantId),
    ]);
    const hasAdmin = new Set(adminRows.map((row) => row.tenantId));
    const classMap = new Map(classRows.map((row) => [row.tenantId, Number(row.value)]));
    const staffMap = new Map(staffRows.map((row) => [row.tenantId, Number(row.value)]));
    const inviteSet = new Set(inviteRows.map((row) => row.tenantId));

    const result = [];
    for (const row of rows) {
      const usage = await this.usage(row.tenantId);
      const plan = row.planName
        ? row
        : {
            ...row,
            planName: "Core",
            status: "trial" as const,
            expiresOn: null,
            notes: null,
            readerQuota: 5,
            cardQuota: 100,
            vehicleQuota: 5,
            assistantTokenQuota: 20000,
            updatedAt: row.createdAt,
          };
      const subscription = evaluateSubscription({
        planName: plan.planName,
        status: plan.status ?? "trial",
        expiresOn: plan.expiresOn,
      });
      const nearQuota = isNearQuota({
        readers: usage.readers,
        readerQuota: plan.readerQuota,
        cards: usage.cards,
        cardQuota: plan.cardQuota,
        vehicles: usage.vehicles,
        vehicleQuota: plan.vehicleQuota,
        smsBalance: usage.smsBalance,
      });
      const archived = (plan.status ?? "trial") === "cancelled";
      const onboarding = this.buildOnboarding({
        admin: hasAdmin.has(plan.tenantId),
        invite: inviteSet.has(plan.tenantId),
        classes: classMap.get(plan.tenantId) ?? 0,
        employees: staffMap.get(plan.tenantId) ?? 0,
        students: usage.students,
        readers: usage.readers,
        cards: usage.cards,
        vehicles: usage.vehicles,
        smsBalance: usage.smsBalance,
        health: subscription.health,
        archived,
      });
      result.push({
        tenantId: plan.tenantId,
        createdAt: plan.createdAt,
        instituteName: plan.instituteName,
        phone: plan.phone,
        country: plan.country,
        planName: plan.planName,
        status: plan.status,
        expiresOn: plan.expiresOn,
        notes: plan.notes,
        readerQuota: plan.readerQuota,
        cardQuota: plan.cardQuota,
        vehicleQuota: plan.vehicleQuota,
        assistantTokenQuota: plan.assistantTokenQuota,
        updatedAt: plan.updatedAt,
        ...usage,
        health: subscription.health,
        nearQuota,
        archived,
        attention: !archived && this.needsAttention(subscription.health, nearQuota),
        onboarding: {
          completed: onboarding.completed,
          total: onboarding.total,
          percent: onboarding.percent,
          complete: onboarding.complete,
        },
      });
    }
    return { schools: result, totals: this.totals(result) };
  }

  async getSchool(tenantId: string) {
    const list = await this.listSchools();
    const school = list.schools.find((row) => row.tenantId === tenantId);
    if (!school) throw new NotFoundException("School not found");
    const [admin] = await this.db
      .select({ id: users.id, name: users.name, email: users.email, emailVerified: users.emailVerified })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")))
      .orderBy(users.createdAt)
      .limit(1);
    const onboarding = await this.onboardingDetail(tenantId, {
      admin: Boolean(admin),
      students: school.students,
      readers: school.readers,
      cards: school.cards,
      vehicles: school.vehicles,
      smsBalance: school.smsBalance,
      health: school.health,
      archived: school.archived,
    });
    return { ...school, admin: admin ?? null, onboarding };
  }

  async updateSchool(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    await this.requireSchool(tenantId);
    const [current] = await this.db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, tenantId)).limit(1);
    const plan = current ?? (await this.ensurePlan(tenantId));

    const planName = typeof body.planName === "string" && body.planName.trim() ? body.planName.trim() : plan.planName;
    const status = this.status(body.status, plan.status);
    const expiresOn = this.dateOrNull(body.expiresOn, plan.expiresOn);
    const notes = body.notes === undefined ? plan.notes : typeof body.notes === "string" ? body.notes.trim() || null : null;
    const readerQuota = this.quota(body.readerQuota, "Reader quota", plan.readerQuota);
    const cardQuota = this.quota(body.cardQuota, "Card quota", plan.cardQuota);
    const vehicleQuota = this.quota(body.vehicleQuota, "Vehicle quota", plan.vehicleQuota);
    const assistantTokenQuota = this.quota(body.assistantTokenQuota, "Assistant token quota", plan.assistantTokenQuota);

    await this.db
      .update(tenantPlans)
      .set({
        planName,
        status,
        expiresOn,
        notes,
        readerQuota,
        cardQuota,
        vehicleQuota,
        assistantTokenQuota,
        updatedAt: new Date(),
      })
      .where(eq(tenantPlans.tenantId, tenantId));

    await this.audit.record(
      tenantId,
      actor,
      "platform_subscription_updated",
      `Plan ${planName}, status ${status}${expiresOn ? `, expires ${expiresOn}` : ""}; quotas readers ${readerQuota}, cards ${cardQuota}, vehicles ${vehicleQuota}, tokens ${assistantTokenQuota}.`,
    );

    return this.getSchool(tenantId);
  }

  async setSchoolStatus(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const school = await this.requireSchool(tenantId);
    const [current] = await this.db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, tenantId)).limit(1);
    const plan = current ?? (await this.ensurePlan(tenantId));
    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
    if (action !== "suspend" && action !== "reactivate" && action !== "archive") {
      throw new BadRequestException("Action must be suspend, reactivate, or archive.");
    }

    const today = new Date().toISOString().slice(0, 10);
    if (action === "suspend") {
      if (plan.status === "suspended") throw new BadRequestException("This school is already suspended.");
      if (plan.status === "cancelled") throw new BadRequestException("Archived schools must be reactivated before suspending.");
      await this.db
        .update(tenantPlans)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(tenantPlans.tenantId, tenantId));
      await this.audit.record(tenantId, actor, "platform_school_suspended", `Suspended ${school.name}.`);
      return this.getSchool(tenantId);
    }

    if (action === "archive") {
      if (plan.status === "cancelled") throw new BadRequestException("This school is already archived.");
      await this.db
        .update(tenantPlans)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(tenantPlans.tenantId, tenantId));
      await this.audit.record(tenantId, actor, "platform_school_archived", `Archived ${school.name}.`);
      return this.getSchool(tenantId);
    }

    let expiresOn = plan.expiresOn;
    if (!expiresOn || expiresOn < today) {
      const next = new Date();
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      expiresOn = next.toISOString().slice(0, 10);
    }
    await this.db
      .update(tenantPlans)
      .set({ status: "active", expiresOn, updatedAt: new Date() })
      .where(eq(tenantPlans.tenantId, tenantId));
    await this.audit.record(
      tenantId,
      actor,
      "platform_school_reactivated",
      `Reactivated ${school.name} through ${expiresOn}.`,
    );
    return this.getSchool(tenantId);
  }

  async extendSchool(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const school = await this.requireSchool(tenantId);
    const [current] = await this.db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, tenantId)).limit(1);
    const plan = current ?? (await this.ensurePlan(tenantId));
    if (plan.status === "cancelled") {
      throw new BadRequestException("Reactivate this archived school before extending.");
    }
    if (plan.status === "suspended") {
      throw new BadRequestException("Reactivate this suspended school before extending.");
    }

    const days = Number(body.days);
    if (![30, 365].includes(days)) throw new BadRequestException("Extend by 30 or 365 days.");

    const today = new Date().toISOString().slice(0, 10);
    const base = plan.expiresOn && plan.expiresOn > today ? plan.expiresOn : today;
    const next = new Date(`${base}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    const expiresOn = next.toISOString().slice(0, 10);
    const status = days === 365 ? ("active" as const) : plan.status;

    await this.db
      .update(tenantPlans)
      .set({ status, expiresOn, updatedAt: new Date() })
      .where(eq(tenantPlans.tenantId, tenantId));

    await this.audit.record(
      tenantId,
      actor,
      "platform_school_extended",
      `Extended ${school.name} by ${days} days to ${expiresOn} (status ${status}).`,
    );
    return this.getSchool(tenantId);
  }

  async deleteSchool(tenantId: string, actor: Actor) {
    const school = await this.requireSchool(tenantId);
    const usage = await this.usage(tenantId);
    if (usage.students > 0) {
      throw new BadRequestException("Only empty schools (no students) can be deleted. Archive instead.");
    }
    if (usage.readers > 0 || usage.vehicles > 0 || usage.cards > 0) {
      throw new BadRequestException("Remove RFID and GPS devices before deleting this empty school.");
    }

    const [ops] = await this.db
      .select({ tenantId: institutes.tenantId })
      .from(institutes)
      .where(sql`lower(${institutes.name}) = 'nepatronix ops'`)
      .limit(1);
    if (ops) {
      await this.audit.record(ops.tenantId, actor, "platform_school_deleted", `Deleted empty school ${school.name} (${tenantId}).`);
    }
    await this.db.delete(tenants).where(eq(tenants.id, tenantId));
    return { ok: true, tenantId, instituteName: school.name };
  }

  async createSchool(body: Record<string, unknown>, actor: Actor) {
    const instituteName = this.required(body.instituteName, "Institute name");
    const targetLine = this.required(body.targetLine, "Target line");
    const phone = this.required(body.phone, "Phone");
    const address = this.required(body.address, "Address");
    const country = this.required(body.country, "Country");
    const adminName = this.required(body.adminName, "Admin name");
    const email = this.required(body.adminEmail, "Admin email").toLowerCase();
    const password = this.required(body.adminPassword, "Admin password");
    if (!email.includes("@")) throw new BadRequestException("Admin email must be an email address.");
    if (password.length < 6) throw new BadRequestException("Admin password must be at least 6 characters.");

    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new ConflictException("An account with this email already exists");

    const planName = typeof body.planName === "string" && body.planName.trim() ? body.planName.trim() : "Core";
    const status = this.status(body.status, "trial");
    const expiresOn = this.dateOrNull(body.expiresOn, null);
    const smsBalance = this.credits(body.smsBalance, 100);
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

    const tenantId = await this.db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({}).returning({ id: tenants.id });
      await tx.insert(institutes).values({
        tenantId: tenant.id,
        name: instituteName,
        targetLine,
        phone,
        address,
        country,
        website: typeof body.website === "string" && body.website.trim() ? body.website.trim() : null,
      });
      await tx.insert(tenantPlans).values({
        tenantId: tenant.id,
        planName,
        status,
        expiresOn,
        notes,
        updatedAt: new Date(),
      });
      await tx.insert(smsAccounts).values({ tenantId: tenant.id, balance: smsBalance });
      await tx.insert(users).values({
        tenantId: tenant.id,
        name: adminName,
        email,
        passwordHash: hashPassword(password),
        role: "admin",
        emailVerified: true,
      });
      return tenant.id;
    });

    await this.audit.record(
      tenantId,
      actor,
      "platform_school_created",
      `Created ${instituteName} with admin ${email}; plan ${planName}/${status}; SMS ${smsBalance}.`,
    );

    const school = await this.getSchool(tenantId);
    const invite = this.buildInvite({
      instituteName,
      adminName,
      email,
      password,
    });
    await this.audit.record(tenantId, actor, "platform_admin_invite", `Prepared welcome invite for ${email}.`);
    return { ...school, invite };
  }

  async createAdminInvite(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    const school = await this.requireSchool(tenantId);
    const [admin] = await this.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")))
      .orderBy(users.createdAt)
      .limit(1);
    if (!admin) throw new NotFoundException("School admin not found");

    let password: string | null = null;
    const reset = body.resetPassword === true || body.resetPassword === "true";
    if (reset) {
      password =
        typeof body.password === "string" && body.password.trim()
          ? body.password.trim()
          : randomBytes(4).toString("hex") + "A1";
      if (password.length < 6) throw new BadRequestException("Password must be at least 6 characters.");
      await this.db
        .update(users)
        .set({ passwordHash: hashPassword(password), emailVerified: true })
        .where(eq(users.id, admin.id));
      await this.audit.record(tenantId, actor, "platform_admin_password_reset", `Reset password for admin ${admin.email} via invite.`);
    }

    const invite = this.buildInvite({
      instituteName: school.name,
      adminName: admin.name,
      email: admin.email,
      password,
    });
    await this.audit.record(tenantId, actor, "platform_admin_invite", `Prepared welcome invite for ${admin.email}.`);
    return {
      ...invite,
      admin: { id: admin.id, name: admin.name, email: admin.email },
      passwordReset: Boolean(password),
    };
  }

  async topUpSms(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    await this.requireSchool(tenantId);
    const amount = this.credits(body.amount, 0);
    if (amount < 1) throw new BadRequestException("Top-up amount must be at least 1.");

    const [account] = await this.db.select().from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1);
    const before = account?.balance ?? 0;
    if (!account) {
      await this.db.insert(smsAccounts).values({ tenantId, balance: amount });
    } else {
      await this.db.update(smsAccounts).set({ balance: account.balance + amount }).where(eq(smsAccounts.tenantId, tenantId));
    }

    await this.audit.record(
      tenantId,
      actor,
      "platform_sms_topup",
      `Added ${amount} SMS credits (${before} → ${before + amount}).`,
    );

    return this.getSchool(tenantId);
  }

  async bulkTopUpSms(body: Record<string, unknown>, actor: Actor) {
    const amount = this.credits(body.amount, 0);
    if (amount < 1) throw new BadRequestException("Top-up amount must be at least 1.");

    const rawIds = Array.isArray(body.tenantIds) ? body.tenantIds : [];
    const tenantIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim()))];
    if (!tenantIds.length) throw new BadRequestException("Select at least one school.");
    if (tenantIds.length > 50) throw new BadRequestException("Bulk top-up is limited to 50 schools at a time.");

    const results: Array<{
      tenantId: string;
      instituteName?: string;
      ok: boolean;
      smsBalance?: number;
      error?: string;
    }> = [];

    for (const tenantId of tenantIds) {
      try {
        const [plan] = await this.db.select({ status: tenantPlans.status }).from(tenantPlans).where(eq(tenantPlans.tenantId, tenantId)).limit(1);
        if (plan?.status === "cancelled") {
          throw new BadRequestException("Archived schools cannot receive SMS credits.");
        }
        const school = await this.topUpSms(tenantId, { amount }, actor);
        results.push({ tenantId, instituteName: school.instituteName, ok: true, smsBalance: school.smsBalance });
      } catch (err) {
        results.push({
          tenantId,
          ok: false,
          error: err instanceof Error ? err.message : "Could not top up",
        });
      }
    }

    const updated = results.filter((row) => row.ok).length;
    const failed = results.length - updated;
    const [ops] = await this.db
      .select({ tenantId: institutes.tenantId })
      .from(institutes)
      .where(sql`lower(${institutes.name}) = 'nepatronix ops'`)
      .limit(1);
    if (ops) {
      await this.audit.record(
        ops.tenantId,
        actor,
        "platform_sms_bulk_topup",
        `Bulk added ${amount} SMS credits to ${updated} school(s)${failed ? `, ${failed} failed` : ""}.`,
      );
    }

    return { amount, updated, failed, results };
  }

  async createSupportLogin(tenantId: string, actor: Actor) {
    await this.requireSchool(tenantId);
    const [admin] = await this.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")))
      .orderBy(users.createdAt)
      .limit(1);
    if (!admin) throw new NotFoundException("School admin not found");

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.db.insert(supportLoginTokens).values({
      tenantId,
      userId: admin.id,
      createdById: actor.id,
      tokenHash: hashToken(token),
      expiresAt,
    });

    await this.audit.record(
      tenantId,
      actor,
      "platform_support_login",
      `Issued 15-minute support login for ${admin.email}.`,
    );

    const webOrigin = (process.env.WEB_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
    return {
      token,
      expiresAt,
      admin: { id: admin.id, name: admin.name, email: admin.email },
      url: `${webOrigin}/login/support?token=${token}`,
    };
  }

  async resetAdminPassword(tenantId: string, body: Record<string, unknown>, actor: Actor) {
    await this.requireSchool(tenantId);
    const password = this.required(body.password, "Password");
    if (password.length < 6) throw new BadRequestException("Password must be at least 6 characters.");

    const [admin] = await this.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")))
      .orderBy(users.createdAt)
      .limit(1);
    if (!admin) throw new NotFoundException("School admin not found");

    await this.db
      .update(users)
      .set({ passwordHash: hashPassword(password), emailVerified: true })
      .where(eq(users.id, admin.id));

    await this.audit.record(
      tenantId,
      actor,
      "platform_admin_password_reset",
      `Reset password for admin ${admin.email}.`,
    );

    return {
      ok: true,
      admin: { id: admin.id, name: admin.name, email: admin.email },
      message: "Admin password updated.",
    };
  }

  private async ensurePlatformAdmin() {
    const email = (process.env.PLATFORM_ADMIN_EMAIL ?? "platform@nepatronix.test").trim().toLowerCase();
    const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "platform-pass-1";
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await this.db.update(users).set({ role: "platform", name: "Platform Admin" }).where(eq(users.id, existing.id));
      return;
    }

    const [ops] = await this.db
      .select({ tenantId: institutes.tenantId })
      .from(institutes)
      .where(sql`lower(${institutes.name}) = 'nepatronix ops'`)
      .limit(1);
    if (ops) {
      await this.db.insert(users).values({
        tenantId: ops.tenantId,
        name: "Platform Admin",
        email,
        passwordHash: hashPassword(password),
        role: "platform",
        emailVerified: true,
      });
      return;
    }

    await this.db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({}).returning();
      await tx.insert(institutes).values({
        tenantId: tenant.id,
        name: "NEPATRONIX Ops",
        targetLine: "Platform control",
        phone: "0000000000",
        address: "Platform",
        country: "Nepal",
      });
      await tx.insert(tenantPlans).values({
        tenantId: tenant.id,
        planName: "Platform",
        status: "active",
        notes: "Internal platform tenant",
      });
      await tx.insert(users).values({
        tenantId: tenant.id,
        name: "Platform Admin",
        email,
        passwordHash: hashPassword(password),
        role: "platform",
        emailVerified: true,
      });
    });
  }

  private webOrigin() {
    return (process.env.WEB_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
  }

  private buildInvite(input: { instituteName: string; adminName: string; email: string; password?: string | null }) {
    const loginUrl = `${this.webOrigin()}/login`;
    const passwordLine = input.password
      ? `Temporary password: ${input.password}\nPlease change this after you sign in.`
      : "Use the password you already have, or ask NEPATRONIX if you need a reset.";
    const subject = `Your NEPATRONIX login for ${input.instituteName}`;
    const body = [
      `Hello ${input.adminName},`,
      "",
      `Your school admin account for ${input.instituteName} is ready on NEPATRONIX SMS.`,
      "",
      `Sign in: ${loginUrl}`,
      `Email: ${input.email}`,
      passwordLine,
      "",
      "If anything looks wrong, reply to this message or contact NEPATRONIX support.",
      "",
      "— NEPATRONIX",
    ].join("\n");
    return {
      to: input.email,
      subject,
      body,
      loginUrl,
      passwordIncluded: Boolean(input.password),
      mailto: `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    };
  }

  private async requireSchool(tenantId: string) {
    const [row] = await this.db
      .select({ tenantId: institutes.tenantId, name: institutes.name })
      .from(institutes)
      .where(eq(institutes.tenantId, tenantId))
      .limit(1);
    if (!row || row.name.toLowerCase() === "nepatronix ops") throw new NotFoundException("School not found");
    return row;
  }

  private async ensurePlan(tenantId: string) {
    const [created] = await this.db.insert(tenantPlans).values({ tenantId }).returning();
    return created;
  }

  private async usage(tenantId: string) {
    const [[readers], [cards], [fleet], [pupil], [sms]] = await Promise.all([
      this.db.select({ value: count() }).from(rfidReaders).where(eq(rfidReaders.tenantId, tenantId)),
      this.db.select({ value: count() }).from(rfidCards).where(and(eq(rfidCards.tenantId, tenantId), ne(rfidCards.status, "blocked"))),
      this.db.select({ value: count() }).from(vehicles).where(eq(vehicles.tenantId, tenantId)),
      this.db.select({ value: count() }).from(students).where(eq(students.tenantId, tenantId)),
      this.db.select({ balance: smsAccounts.balance }).from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1),
    ]);
    return {
      readers: Number(readers?.value ?? 0),
      cards: Number(cards?.value ?? 0),
      vehicles: Number(fleet?.value ?? 0),
      students: Number(pupil?.value ?? 0),
      smsBalance: sms?.balance ?? 0,
    };
  }

  private async onboardingDetail(
    tenantId: string,
    input: {
      admin: boolean;
      students: number;
      readers: number;
      cards: number;
      vehicles: number;
      smsBalance: number;
      health: string;
      archived: boolean;
    },
  ) {
    const [[classCount], [staffCount], [invite]] = await Promise.all([
      this.db.select({ value: count() }).from(classes).where(eq(classes.tenantId, tenantId)),
      this.db.select({ value: count() }).from(employees).where(eq(employees.tenantId, tenantId)),
      this.db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(and(eq(auditEvents.tenantId, tenantId), eq(auditEvents.action, "platform_admin_invite")))
        .limit(1),
    ]);
    return this.buildOnboarding({
      ...input,
      invite: Boolean(invite),
      classes: Number(classCount?.value ?? 0),
      employees: Number(staffCount?.value ?? 0),
    });
  }

  private buildOnboarding(input: {
    admin: boolean;
    invite: boolean;
    classes: number;
    employees: number;
    students: number;
    readers: number;
    cards: number;
    vehicles: number;
    smsBalance: number;
    health: string;
    archived: boolean;
  }) {
    const steps = [
      { id: "admin", label: "School admin account ready", done: input.admin },
      { id: "invite", label: "Welcome invite prepared", done: input.invite },
      {
        id: "subscription",
        label: "Subscription usable (not blocked)",
        done: !input.archived && !["suspended", "cancelled", "expired"].includes(input.health),
      },
      { id: "sms", label: "SMS credits available", done: input.smsBalance > 0 },
      { id: "classes", label: "At least one class", done: input.classes > 0 },
      { id: "employees", label: "At least one employee", done: input.employees > 0 },
      { id: "students", label: "At least one student", done: input.students > 0 },
      { id: "rfid", label: "RFID reader or card configured", done: input.readers > 0 || input.cards > 0 },
      { id: "gps", label: "GPS vehicle configured", done: input.vehicles > 0 },
    ];
    const completed = steps.filter((step) => step.done).length;
    return {
      completed,
      total: steps.length,
      percent: Math.round((completed / steps.length) * 100),
      complete: completed === steps.length,
      steps,
    };
  }

  private needsAttention(health: string, nearQuota: boolean) {
    return ["past_due", "suspended", "cancelled", "expired", "expiring"].includes(health) || nearQuota;
  }

  private totals(
    rows: Array<{
      status: string | null;
      health: string;
      attention?: boolean;
      archived?: boolean;
      onboarding?: { complete: boolean };
    }>,
  ) {
    const live = rows.filter((row) => !row.archived);
    return {
      schools: live.length,
      active: live.filter((row) => row.status === "active").length,
      trial: live.filter((row) => row.status === "trial").length,
      attention: live.filter((row) => row.attention).length,
      onboarding: live.filter((row) => row.onboarding && !row.onboarding.complete).length,
      archived: rows.filter((row) => row.archived).length,
    };
  }

  private status(value: unknown, fallback: (typeof STATUSES)[number]) {
    if (value === undefined || value === "") return fallback;
    if (typeof value !== "string" || !STATUSES.includes(value as (typeof STATUSES)[number])) {
      throw new BadRequestException("Status must be trial, active, past_due, suspended, or cancelled.");
    }
    return value as (typeof STATUSES)[number];
  }

  private dateOrNull(value: unknown, fallback: string | null) {
    if (value === undefined) return fallback;
    if (value === null || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException("Expiry date must be YYYY-MM-DD.");
    }
    return value;
  }

  private quota(value: unknown, label: string, fallback: number) {
    if (value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) throw new BadRequestException(`${label} must be a whole number.`);
    return number;
  }

  private credits(value: unknown, fallback: number) {
    if (value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) throw new BadRequestException("Credits must be a whole number.");
    return number;
  }

  private required(value: unknown, label: string) {
    if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${label} is required.`);
    return value.trim();
  }
}
