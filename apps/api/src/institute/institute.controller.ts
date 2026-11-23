import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { InstituteService, type InstituteInput } from "./institute.service";

@Controller("institute")
@UseGuards(AuthGuard)
export class InstituteController {
  constructor(private readonly institute: InstituteService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.institute.get(user.tenantId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: InstituteInput) {
    return this.institute.update(user.tenantId, body);
  }

  @Get("preferences")
  preferences(@CurrentUser() user: AuthUser) {
    return this.institute.preferences(user.tenantId);
  }

  @Patch("preferences")
  updatePreferences(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.institute.updatePreferences(user.tenantId, body);
  }

  @Patch("language")
  updateLanguage(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.institute.updateLanguage(user.tenantId, body);
  }

  @Post("preferences/reset")
  resetPreferences(@CurrentUser() user: AuthUser) {
    return this.institute.resetPreferences(user.tenantId);
  }
}
