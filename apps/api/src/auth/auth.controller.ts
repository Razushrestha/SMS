import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthGuard } from "./auth.guard";
import { AuthService, type RegisterInput } from "./auth.service";
import { CurrentUser, type AuthUser } from "./current-user.decorator";
import { SESSION_COOKIE, SUPPORT_COOKIE } from "./session";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: RegisterInput, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(body);
    this.setCookie(response, result.token, result.expiresAt);
    return { user: result.user };
  }

  @Post("login")
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body.email ?? "", body.password ?? "");
    this.setCookie(response, result.token, result.expiresAt);
    response.clearCookie(SUPPORT_COOKIE, { path: "/" });
    return { user: result.user };
  }

  @Post("support-login")
  async supportLogin(@Body() body: { token?: string }, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.consumeSupportLogin(body.token ?? "");
    this.setCookie(response, result.token, result.expiresAt);
    response.cookie(SUPPORT_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      expires: result.expiresAt,
      path: "/",
    });
    return { user: { ...result.user, supportSession: true } };
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.[SESSION_COOKIE]);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    response.clearCookie(SUPPORT_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Get("users")
  @UseGuards(AuthGuard)
  users(@CurrentUser() user: AuthUser) {
    return this.auth.listLogins(user.tenantId);
  }

  @Post("users")
  @UseGuards(AuthGuard)
  createUser(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.auth.createLogin(user.tenantId, body);
  }

  @Patch("users/:id")
  @UseGuards(AuthGuard)
  updateUser(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.auth.updateLoginRole(user.tenantId, user.id, id, body);
  }

  @Patch("users/:id/children")
  @UseGuards(AuthGuard)
  saveChildren(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.auth.saveChildren(user.tenantId, id, body);
  }

  @Delete("users/:id")
  @UseGuards(AuthGuard)
  deleteUser(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.auth.deleteLogin(user.tenantId, user.id, id);
  }

  @Post("verification")
  @UseGuards(AuthGuard)
  sendVerification(@CurrentUser() user: AuthUser) {
    return this.auth.sendVerification(user);
  }

  @Post("verify")
  @UseGuards(AuthGuard)
  confirmVerification(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.auth.confirmVerification(user, body);
  }

  @Patch("account")
  @UseGuards(AuthGuard)
  updateAccount(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.auth.updateAccount(user, body);
  }

  @Delete("account")
  @UseGuards(AuthGuard)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.deleteAccount(user, body);
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  }

  private setCookie(response: Response, token: string, expires: Date) {
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      expires,
      path: "/",
    });
  }
}
