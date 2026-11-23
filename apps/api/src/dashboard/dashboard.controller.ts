import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.dashboard.get(user);
  }

  @Patch()
  save(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.dashboard.saveView(user, body);
  }
}
