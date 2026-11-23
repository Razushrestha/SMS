import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { ReportsService } from "./reports.service";

@Controller("custom-reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("catalog")
  catalog() {
    return this.reports.catalog();
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reports.list(user.tenantId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.reports.save(user.tenantId, body);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.reports.save(user.tenantId, body, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.reports.remove(user.tenantId, id);
  }

  @Get(":id/run")
  run(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.reports.run(user.tenantId, id);
  }

  @Get(":id/export")
  export(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.reports.export(user.tenantId, id);
  }
}
