import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { PlanService } from "./plan.service";

@Controller("plan")
@UseGuards(AuthGuard)
export class PlanController {
  constructor(private readonly plan: PlanService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.plan.get(user.tenantId);
  }

  @Patch()
  save(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.plan.save(user.tenantId, body);
  }
}
