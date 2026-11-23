import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

import type { SubscriptionSnapshot } from "../plan/subscription";

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  studentId: string | null;
  instituteName: string;
  subscription?: SubscriptionSnapshot | null;
  supportSession?: boolean;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
