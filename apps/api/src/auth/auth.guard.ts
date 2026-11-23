import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { institutes, sessions, tenantPlans, users, type Database } from "@nepatronix/db";
import { and, eq, gt } from "drizzle-orm";
import { Request } from "express";
import { DB } from "../db/db.module";
import { evaluateSubscription, subscriptionAllowsPath } from "../plan/subscription";
import { canCall } from "./roles";
import { getCachedAuth, setCachedAuth } from "./session-cache";
import { hashToken, SESSION_COOKIE, SUPPORT_COOKIE } from "./session";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException("Sign in required");

    const tokenHash = hashToken(token);
    const cached = getCachedAuth(tokenHash);
    if (cached) {
      if (!canCall(cached.user.role, request.method, request.path)) {
        throw new ForbiddenException("This role cannot open that page.");
      }
      if (cached.subscription?.blocked && !subscriptionAllowsPath(request.method, request.path)) {
        throw new ForbiddenException(cached.subscription.message || "This school's subscription is not active.");
      }
      const supportSession = request.cookies?.[SUPPORT_COOKIE] === "1";
      (request as Request & { user: typeof cached.user & { subscription: typeof cached.subscription; supportSession: boolean } }).user = {
        ...cached.user,
        subscription: cached.subscription,
        supportSession,
      };
      return true;
    }

    const [row] = await this.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        role: users.role,
        studentId: users.studentId,
        instituteName: institutes.name,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(institutes, eq(institutes.tenantId, users.tenantId))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!row) throw new UnauthorizedException("Sign in required");
    if (!canCall(row.role, request.method, request.path)) {
      throw new ForbiddenException("This role cannot open that page.");
    }

    let plan: { planName: string; status: string; expiresOn: string | null } | null = null;
    let subscription = null as ReturnType<typeof evaluateSubscription> | null;
    if (row.role !== "platform") {
      const [planRow] = await this.db
        .select({
          planName: tenantPlans.planName,
          status: tenantPlans.status,
          expiresOn: tenantPlans.expiresOn,
        })
        .from(tenantPlans)
        .where(eq(tenantPlans.tenantId, row.tenantId))
        .limit(1);
      plan = planRow
        ? {
            planName: planRow.planName,
            status: planRow.status,
            expiresOn: planRow.expiresOn,
          }
        : { planName: "Core", status: "trial", expiresOn: null };
      subscription = evaluateSubscription(plan);
      if (subscription.blocked && !subscriptionAllowsPath(request.method, request.path)) {
        throw new ForbiddenException(subscription.message || "This school's subscription is not active.");
      }
    }

    setCachedAuth(tokenHash, row, plan);

    const supportSession = request.cookies?.[SUPPORT_COOKIE] === "1";
    (request as Request & { user: typeof row & { subscription: typeof subscription; supportSession: boolean } }).user = {
      ...row,
      subscription,
      supportSession,
    };
    return true;
  }
}
