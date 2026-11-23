import { randomBytes } from "crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { classes, employees, institutes, parentStudents, products, sessions, statementEntries, storeOrderLines, storeOrders, students, supportLoginTokens, tenants, users, type Database } from "@nepatronix/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { DB } from "../db/db.module";
import { type AuthUser } from "./current-user.decorator";
import { loadSubscription } from "../plan/subscription";
import { loginRoles } from "./roles";
import { hashPassword, hashToken, newSessionToken, sessionExpiry, verifyPassword } from "./session";

export type RegisterInput = {
  instituteName: string;
  targetLine: string;
  phone: string;
  address: string;
  country: string;
  website?: string;
  adminName: string;
  email: string;
  password: string;
};

const required: Array<[keyof RegisterInput, string]> = [
  ["instituteName", "Institute name"],
  ["targetLine", "Target line"],
  ["phone", "Phone"],
  ["address", "Address"],
  ["country", "Country"],
  ["adminName", "Your name"],
  ["email", "Email"],
  ["password", "Password"],
];

@Injectable()
export class AuthService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async register(input: RegisterInput) {
    this.assertRegister(input);
    const email = input.email.trim().toLowerCase();
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new ConflictException("An account with this email already exists");

    return this.db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({}).returning({ id: tenants.id });
      await tx.insert(institutes).values({
        tenantId: tenant.id,
        name: input.instituteName.trim(),
        targetLine: input.targetLine.trim(),
        phone: input.phone.trim(),
        address: input.address.trim(),
        country: input.country.trim(),
        website: input.website?.trim() || null,
      });
      const [user] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          name: input.adminName.trim(),
          email,
          passwordHash: hashPassword(input.password),
          role: "admin",
        })
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role, tenantId: users.tenantId });
      const session = await this.openSession(tx, user.id);
      return { user, token: session.token, expiresAt: session.expiresAt };
    });
  }

  async login(emailRaw: string, password: string) {
    const identifier = emailRaw.trim();
    if (!identifier.includes("@")) return this.portalLogin(identifier, password);
    const email = identifier.toLowerCase();
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Email or password is incorrect");
    }
    if (user.role !== "platform") await this.assertActiveSubscription(user.tenantId);
    const session = await this.openSession(this.db, user.id);
    const { passwordHash: _password, ...safe } = user;
    return { user: safe, token: session.token, expiresAt: session.expiresAt };
  }

  private async portalLogin(usernameRaw: string, password: string) {
    const username = usernameRaw.trim().toLowerCase();
    if (!username) throw new UnauthorizedException("Email or password is incorrect");

    const studentMatches = await this.db.select().from(students).where(sql`lower(${students.portalUsername}) = ${username}`);
    if (studentMatches.length === 1) {
      const student = studentMatches[0];
      if (!student.portalPasswordHash || !verifyPassword(password, student.portalPasswordHash)) {
        throw new UnauthorizedException("Email or password is incorrect");
      }
      return this.openPortalUser({
        tenantId: student.tenantId,
        name: student.name,
        role: "student",
        email: `${username}.${student.id.slice(0, 8)}@students.nepatronix.local`,
        studentId: student.id,
      });
    }

    const employeeMatches = await this.db.select().from(employees).where(sql`lower(${employees.portalUsername}) = ${username}`);
    if (employeeMatches.length === 1) {
      const employee = employeeMatches[0];
      if (!employee.portalPasswordHash || !verifyPassword(password, employee.portalPasswordHash)) {
        throw new UnauthorizedException("Email or password is incorrect");
      }
      return this.openPortalUser({
        tenantId: employee.tenantId,
        name: employee.name,
        role: this.staffLoginRole(employee.staffRole),
        email: `${username}.${employee.id.slice(0, 8)}@employees.nepatronix.local`,
        studentId: null,
      });
    }

    throw new UnauthorizedException("Email or password is incorrect");
  }

  private staffLoginRole(staffRole: string) {
    if (staffRole === "principal") return "principal" as const;
    if (staffRole === "teacher") return "teacher" as const;
    if (staffRole === "accountant") return "accountant" as const;
    if (staffRole === "store_manager") return "store_manager" as const;
    return "employee" as const;
  }

  private async openPortalUser(person: {
    tenantId: string;
    name: string;
    role: (typeof loginRoles)[number];
    email: string;
    studentId: string | null;
  }) {
    let [user] = person.studentId
      ? await this.db
          .select({ id: users.id, name: users.name, email: users.email, role: users.role, tenantId: users.tenantId })
          .from(users)
          .where(eq(users.studentId, person.studentId))
          .limit(1)
      : await this.db
          .select({ id: users.id, name: users.name, email: users.email, role: users.role, tenantId: users.tenantId })
          .from(users)
          .where(eq(users.email, person.email))
          .limit(1);
    if (!user) {
      [user] = await this.db
        .insert(users)
        .values({
          tenantId: person.tenantId,
          name: person.name,
          email: person.email,
          passwordHash: hashPassword(randomBytes(24).toString("hex")),
          role: person.role,
          studentId: person.studentId,
          emailVerified: true,
        })
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role, tenantId: users.tenantId });
    } else {
      const patch: { name?: string; role?: (typeof loginRoles)[number]; emailVerified?: boolean } = {};
      if (user.name !== person.name) patch.name = person.name;
      if (user.role !== person.role) patch.role = person.role;
      patch.emailVerified = true;
      if (Object.keys(patch).length) {
        await this.db.update(users).set(patch).where(eq(users.id, user.id));
        user = { ...user, ...patch };
      }
    }
    await this.assertActiveSubscription(person.tenantId);
    const session = await this.openSession(this.db, user.id);
    return { user, token: session.token, expiresAt: session.expiresAt };
  }

  private async assertActiveSubscription(tenantId: string) {
    const subscription = await loadSubscription(this.db, tenantId);
    if (subscription.blocked) {
      throw new ForbiddenException(subscription.message || "This school's subscription is not active.");
    }
  }

  async consumeSupportLogin(tokenRaw: string) {
    const token = tokenRaw.trim();
    if (!token) throw new BadRequestException("Support token is required.");
    const [row] = await this.db
      .select({
        id: supportLoginTokens.id,
        userId: supportLoginTokens.userId,
        expiresAt: supportLoginTokens.expiresAt,
        usedAt: supportLoginTokens.usedAt,
      })
      .from(supportLoginTokens)
      .where(eq(supportLoginTokens.tokenHash, hashToken(token)))
      .limit(1);
    if (!row) throw new UnauthorizedException("This support link is invalid.");
    if (row.usedAt) throw new UnauthorizedException("This support link was already used.");
    if (row.expiresAt.getTime() < Date.now()) throw new UnauthorizedException("This support link has expired.");

    await this.db.update(supportLoginTokens).set({ usedAt: new Date() }).where(eq(supportLoginTokens.id, row.id));

    const [user] = await this.db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    if (!user) throw new UnauthorizedException("This support link is invalid.");

    const session = await this.openSession(this.db, user.id);
    return { user, token: session.token, expiresAt: session.expiresAt };
  }

  async listLogins(tenantId: string) {
    const rows = await this.db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), isNull(users.studentId)))
      .orderBy(users.name);
    const links = await this.db
      .select({ userId: parentStudents.userId, id: students.id, name: students.name })
      .from(parentStudents)
      .innerJoin(students, eq(students.id, parentStudents.studentId))
      .where(eq(students.tenantId, tenantId));
    return rows.map((row) => ({
      ...row,
      children: links.filter((link) => link.userId === row.id).map((link) => ({ id: link.id, name: link.name })),
    }));
  }

  async createLogin(tenantId: string, body: Record<string, unknown>) {
    const name = this.requiredText(body.name, "Name");
    const email = this.requiredText(body.email, "Email").toLowerCase();
    const role = this.requiredRole(body.role);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException("Enter a valid email");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const password = [...randomBytes(12)].map((byte) => alphabet[byte % alphabet.length]).join("");
    try {
      const [row] = await this.db
        .insert(users)
        .values({ tenantId, name, email, passwordHash: hashPassword(password), role })
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
      return { ...row, password, passwordNote: "This password is shown once and is not stored." };
    } catch (error) {
      const cause = (error as { cause?: { code?: string }; code?: string }).cause;
      if (cause?.code === "23505" || (error as { code?: string }).code === "23505") {
        throw new ConflictException("That email is already used.");
      }
      throw error;
    }
  }

  async updateLoginRole(tenantId: string, actorId: string, id: string, body: Record<string, unknown>) {
    if (actorId === id) throw new BadRequestException("You cannot change your own role.");
    const role = this.requiredRole(body.role);
    const [row] = await this.db
      .update(users)
      .set({ role })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({ id: users.id, role: users.role });
    if (!row) throw new NotFoundException("Login not found");
    return row;
  }

  async saveChildren(tenantId: string, id: string, body: Record<string, unknown>) {
    const [login] = await this.db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId))).limit(1);
    if (!login) throw new NotFoundException("Login not found");
    if (login.role !== "parent") throw new BadRequestException("Link children to a parent login.");
    if (!Array.isArray(body.studentIds) || body.studentIds.some((item) => typeof item !== "string")) {
      throw new BadRequestException("Choose the children for this parent.");
    }
    const studentIds = [...new Set(body.studentIds as string[])];
    if (studentIds.length) {
      const found = await this.db.select({ id: students.id }).from(students).where(and(eq(students.tenantId, tenantId), inArray(students.id, studentIds)));
      if (found.length !== studentIds.length) throw new BadRequestException("Choose a student at this institute.");
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(parentStudents).where(eq(parentStudents.userId, id));
      if (studentIds.length) await tx.insert(parentStudents).values(studentIds.map((studentId) => ({ userId: id, studentId })));
    });
    return { ok: true };
  }

  async deleteLogin(tenantId: string, actorId: string, id: string) {
    if (actorId === id) throw new BadRequestException("You cannot delete your own login.");
    const [row] = await this.db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({ id: users.id });
    if (!row) throw new NotFoundException("Login not found");
    return { ok: true };
  }

  async logout(token: string | undefined) {
    if (!token) return;
    const { hashToken } = await import("./session");
    const { invalidateSessionToken } = await import("./session-cache");
    const tokenHash = hashToken(token);
    invalidateSessionToken(tokenHash);
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async updateAccount(user: AuthUser, body: Record<string, unknown>) {
    const current = await this.passwordRow(user.id);
    let email = user.email;
    const nextEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : email;
    const nextPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (nextEmail !== email || nextPassword.trim().length > 0) {
      if (!verifyPassword(String(body.currentPassword ?? ""), current.passwordHash)) {
        throw new UnauthorizedException("The password does not match.");
      }
    }
    if (nextEmail !== email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new BadRequestException("Enter a valid email");
      try {
        await this.db.update(users).set({ email: nextEmail, emailVerified: false, verificationTokenHash: null, verificationExpiresAt: null }).where(eq(users.id, user.id));
        email = nextEmail;
      } catch (error) {
        const cause = (error as { cause?: { code?: string }; code?: string }).cause;
        if (cause?.code === "23505" || (error as { code?: string }).code === "23505") throw new ConflictException("That email is already used.");
        throw error;
      }
    }
    if (nextPassword.trim().length > 0) {
      if (nextPassword.trim().length < 8) throw new BadRequestException("Use at least 8 characters.");
      await this.db.update(users).set({ passwordHash: hashPassword(nextPassword.trim()) }).where(eq(users.id, user.id));
    }
    if (nextEmail !== user.email || nextPassword.trim().length > 0) {
      const { invalidateSessionsForUser } = await import("./session-cache");
      invalidateSessionsForUser(user.id);
    }
    if (user.role === "admin") {
      const institute: { timezone?: string; currency?: string; currencySymbol?: string } = {};
      if (typeof body.timezone === "string" && body.timezone.trim()) institute.timezone = body.timezone.trim();
      if (typeof body.currency === "string" && body.currency.trim()) institute.currency = body.currency.trim();
      if (typeof body.currencySymbol === "string" && body.currencySymbol.trim()) institute.currencySymbol = body.currencySymbol.trim();
      if (Object.keys(institute).length) {
        await this.db.update(institutes).set(institute).where(eq(institutes.tenantId, user.tenantId));
      }
    }
    return { ok: true, email };
  }

  async sendVerification(user: AuthUser) {
    const [row] = await this.db.select({ emailVerified: users.emailVerified }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!row) throw new UnauthorizedException("Sign in required");
    if (row.emailVerified) return { verified: true, message: "This email is already verified." };
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.db.update(users).set({ verificationTokenHash: hashToken(token), verificationExpiresAt: expiresAt }).where(eq(users.id, user.id));
    return { verified: false, code: token, message: "No mail gateway is connected. Use this code once." };
  }

  async confirmVerification(user: AuthUser, body: Record<string, unknown>) {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) throw new BadRequestException("Enter the verification code.");
    const [row] = await this.db
      .select({ emailVerified: users.emailVerified, verificationTokenHash: users.verificationTokenHash, verificationExpiresAt: users.verificationExpiresAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!row) throw new UnauthorizedException("Sign in required");
    if (row.emailVerified) return { verified: true, message: "This email is already verified." };
    if (!row.verificationTokenHash || !row.verificationExpiresAt || row.verificationExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This verification code has expired.");
    }
    if (row.verificationTokenHash !== hashToken(code)) throw new BadRequestException("This verification code was not accepted.");
    await this.db.update(users).set({ emailVerified: true, verificationTokenHash: null, verificationExpiresAt: null }).where(eq(users.id, user.id));
    return { verified: true, message: "Email verified." };
  }

  async deleteAccount(user: AuthUser, body: Record<string, unknown>) {
    if (user.role !== "admin") throw new ForbiddenException("Only an admin can delete the account.");
    const [institute] = await this.db.select({ name: institutes.name }).from(institutes).where(eq(institutes.tenantId, user.tenantId)).limit(1);
    const typed = this.requiredText(body.instituteName, "Institute name");
    if (!institute || typed !== institute.name) throw new BadRequestException("Type the institute name to confirm.");
    const current = await this.passwordRow(user.id);
    if (!verifyPassword(String(body.password ?? ""), current.passwordHash)) throw new UnauthorizedException("The password does not match.");
    await this.db.transaction(async (tx) => {
      await tx.delete(classes).where(eq(classes.tenantId, user.tenantId));
      const orders = await tx.select({ id: storeOrders.id }).from(storeOrders).where(eq(storeOrders.tenantId, user.tenantId));
      if (orders.length) await tx.delete(storeOrderLines).where(inArray(storeOrderLines.orderId, orders.map((order) => order.id)));
      await tx.delete(products).where(eq(products.tenantId, user.tenantId));
      await tx.delete(statementEntries).where(eq(statementEntries.tenantId, user.tenantId));
      await tx.delete(tenants).where(eq(tenants.id, user.tenantId));
    });
    return { ok: true };
  }

  private async passwordRow(id: string) {
    const [row] = await this.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw new UnauthorizedException("Sign in required");
    return row;
  }

  private async openSession(tx: Pick<Database, "insert">, userId: string) {
    const { token, tokenHash } = newSessionToken();
    const expiresAt = sessionExpiry();
    await tx.insert(sessions).values({ userId, tokenHash, expiresAt });
    return { token, expiresAt };
  }

  private requiredText(value: unknown, label: string) {
    if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${label} is required`);
    return value.trim();
  }

  private requiredRole(value: unknown) {
    const role = this.requiredText(value, "Role");
    if (!loginRoles.includes(role as (typeof loginRoles)[number])) throw new BadRequestException("Choose a role");
    return role as (typeof loginRoles)[number];
  }

  private assertRegister(input: RegisterInput) {
    for (const [key, label] of required) {
      const value = input[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new BadRequestException(`${label} is required`);
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw new BadRequestException("Enter a valid email");
    }
    if (input.password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
  }
}
