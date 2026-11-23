import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { institutes, sessions, users, type Database } from "@nepatronix/db";
import { and, eq, gt } from "drizzle-orm";
import { Request } from "express";
import { DB } from "../db/db.module";
import { loadSubscription, subscriptionAllowsPath } from "../plan/subscription";
import { canCall } from "./roles";
import { hashToken, SESSION_COOKIE, SUPPORT_COOKIE } from "./session";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException("Sign in required");

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
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!row) throw new UnauthorizedException("Sign in required");
    if (!canCall(row.role, request.method, request.path)) {
      throw new ForbiddenException("This role cannot open that page.");
    }

    const subscription = row.role === "platform" ? null : await loadSubscription(this.db, row.tenantId);
    if (subscription?.blocked && !subscriptionAllowsPath(request.method, request.path)) {
      throw new ForbiddenException(subscription.message || "This school's subscription is not active.");
    }

    const supportSession = request.cookies?.[SUPPORT_COOKIE] === "1";
    (request as Request & { user: typeof row & { subscription: typeof subscription; supportSession: boolean } }).user = {
      ...row,
      subscription,
      supportSession,
    };
    return true;
  }
}
