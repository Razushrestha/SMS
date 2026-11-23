import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { assertRateLimit, clientIp } from "../common/rate-limit";
import { RfidService } from "./rfid.service";

@Controller("rfid")
@UseGuards(AuthGuard)
export class RfidController {
  constructor(private readonly rfid: RfidService) {}

  @Get()
  home(@CurrentUser() user: AuthUser) {
    return this.rfid.home(user.tenantId);
  }

  @Post("readers")
  addReader(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.rfid.addReader(user.tenantId, body);
  }

  @Patch("readers/:id")
  setReader(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { status?: string }) {
    return this.rfid.setReader(user.tenantId, id, body.status === "disabled" ? "disabled" : "active");
  }

  @Post("cards")
  addCard(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.rfid.addCard(user.tenantId, body, user);
  }

  @Post("cards/:id/block")
  block(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.rfid.blockCard(user.tenantId, id);
  }

  @Post("cards/:id/replace")
  replace(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.rfid.replaceCard(user.tenantId, id, body, user);
  }

  @Delete("cards/:id")
  removeCard(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.rfid.removeCard(user.tenantId, id);
  }

  @Get("student")
  student(@CurrentUser() user: AuthUser, @Query("studentId") studentId: string) {
    return this.rfid.personView(user.tenantId, studentId);
  }

  @Patch("settings")
  settings(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.rfid.saveSettings(user.tenantId, body);
  }

  @Post("cutoff")
  cutoff(@CurrentUser() user: AuthUser) {
    return this.rfid.applyCutoff(user.tenantId);
  }
}

@Controller("rfid")
export class RfidIngestController {
  constructor(private readonly rfid: RfidService) {}

  @Post("ingest")
  ingest(@Req() request: Request, @Body() body: Record<string, unknown>) {
    assertRateLimit(`rfid-ingest:${clientIp(request)}`, 120, 60_000);
    return this.rfid.ingest(body);
  }
}
