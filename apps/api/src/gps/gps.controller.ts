import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { assertRateLimit, clientIp } from "../common/rate-limit";
import { GpsService } from "./gps.service";

@Controller("gps")
@UseGuards(AuthGuard)
export class GpsController {
  constructor(private readonly gps: GpsService) {}

  @Get("export")
  exportHistory(@CurrentUser() user: AuthUser) {
    return this.gps.exportHistory(user.tenantId, user);
  }

  @Delete("locations")
  deleteHistory(@CurrentUser() user: AuthUser) {
    return this.gps.deleteHistory(user);
  }

  @Get()
  home(@CurrentUser() user: AuthUser) {
    return this.gps.home(user.tenantId);
  }

  @Patch("settings")
  parentSms(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.saveParentSms(user, body);
  }

  @Post("vehicles")
  addVehicle(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.addVehicle(user.tenantId, body);
  }

  @Post("routes")
  addRoute(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.addRoute(user.tenantId, body);
  }

  @Post("stops")
  addStop(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.addStop(user.tenantId, body);
  }

  @Patch("routes/:id/stops")
  reorderStops(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.gps.reorderStops(user.tenantId, id, body);
  }

  @Patch("stops/:id")
  placeStop(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.gps.placeStop(user.tenantId, id, body);
  }

  @Post("assignments")
  assign(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.assignStudent(user.tenantId, body);
  }

  @Post("trips")
  addTrip(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.addTrip(user.tenantId, body);
  }

  @Post("trips/:id/start")
  start(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.gps.startTrip(user.tenantId, id);
  }

  @Post("trips/:id/end")
  end(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.gps.endTrip(user.tenantId, id);
  }

  @Get("trips/:id/points")
  points(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.gps.points(user.tenantId, id);
  }

  @Get("parent")
  parent(@CurrentUser() user: AuthUser, @Query("studentId") studentId: string) {
    return this.gps.parentView(user, studentId);
  }

  @Get("driver")
  driver(@CurrentUser() user: AuthUser) {
    return this.gps.driverBoard(user);
  }

  @Post("driver/start")
  driverStart(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.driverStart(user, body);
  }

  @Post("driver/end")
  driverEnd(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.driverEnd(user, body);
  }

  @Post("driver/location")
  driverLocation(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.driverPoint(user, body);
  }

  @Post("driver/sos")
  driverSos(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.gps.driverSos(user, body);
  }
}

@Controller("gps")
export class GpsIngestController {
  constructor(private readonly gps: GpsService) {}

  @Post("points")
  point(@Req() request: Request, @Body() body: Record<string, unknown>) {
    assertRateLimit(`gps-ingest:${clientIp(request)}`, 120, 60_000);
    return this.gps.ingest(body);
  }

  @Post("sos")
  sos(@Req() request: Request, @Body() body: Record<string, unknown>) {
    assertRateLimit(`gps-sos:${clientIp(request)}`, 30, 60_000);
    return this.gps.sos(body);
  }
}
