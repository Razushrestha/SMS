import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(AuthGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("schools")
  list() {
    return this.platform.listSchools();
  }

  @Get("activity")
  activity(@Query("tenantId") tenantId?: string) {
    return this.platform.recentActivity(typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : undefined);
  }

  @Post("schools")
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.platform.createSchool(body, { id: user.id, name: user.name });
  }

  @Get("schools/:tenantId")
  one(@Param("tenantId") tenantId: string) {
    return this.platform.getSchool(tenantId);
  }

  @Patch("schools/:tenantId")
  save(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string, @Body() body: Record<string, unknown>) {
    return this.platform.updateSchool(tenantId, body, { id: user.id, name: user.name });
  }

  @Post("schools/:tenantId/status")
  status(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string, @Body() body: Record<string, unknown>) {
    return this.platform.setSchoolStatus(tenantId, body, { id: user.id, name: user.name });
  }

  @Post("schools/:tenantId/extend")
  extend(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string, @Body() body: Record<string, unknown>) {
    return this.platform.extendSchool(tenantId, body, { id: user.id, name: user.name });
  }

  @Delete("schools/:tenantId")
  remove(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string) {
    return this.platform.deleteSchool(tenantId, { id: user.id, name: user.name });
  }

  @Post("schools/:tenantId/sms-topup")
  topUp(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string, @Body() body: Record<string, unknown>) {
    return this.platform.topUpSms(tenantId, body, { id: user.id, name: user.name });
  }

  @Post("sms-topup")
  bulkTopUp(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.platform.bulkTopUpSms(body, { id: user.id, name: user.name });
  }

  @Post("schools/:tenantId/reset-admin-password")
  resetPassword(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string, @Body() body: Record<string, unknown>) {
    return this.platform.resetAdminPassword(tenantId, body, { id: user.id, name: user.name });
  }

  @Post("schools/:tenantId/support-login")
  supportLogin(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string) {
    return this.platform.createSupportLogin(tenantId, { id: user.id, name: user.name });
  }

  @Post("schools/:tenantId/invite")
  invite(@CurrentUser() user: AuthUser, @Param("tenantId") tenantId: string, @Body() body: Record<string, unknown>) {
    return this.platform.createAdminInvite(tenantId, body, { id: user.id, name: user.name });
  }
}
