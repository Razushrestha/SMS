import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { CampusService } from "./campus.service";

@Controller()
@UseGuards(AuthGuard)
export class CampusController {
  constructor(private readonly campus: CampusService) {}

  @Get("timetable/periods")
  periods(@CurrentUser() user: AuthUser) {
    return this.campus.periods(user.tenantId);
  }

  @Post("timetable/periods")
  addPeriod(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.addPeriod(user.tenantId, body);
  }

  @Get("timetable/rooms")
  rooms(@CurrentUser() user: AuthUser) {
    return this.campus.rooms(user.tenantId);
  }

  @Post("timetable/rooms")
  addRoom(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.addRoom(user.tenantId, body);
  }

  @Get("timetable/slots")
  slots(@CurrentUser() user: AuthUser) {
    return this.campus.slots(user.tenantId);
  }

  @Post("timetable/slots")
  addSlot(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.addSlot(user.tenantId, body);
  }

  @Delete("timetable/slots/:id")
  deleteSlot(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.campus.deleteSlot(user.tenantId, id);
  }

  @Get("timetable/class/:classId")
  classTimetable(@CurrentUser() user: AuthUser, @Param("classId") classId: string) {
    return this.campus.classTimetable(user.tenantId, classId);
  }

  @Get("timetable/teacher/:teacherId")
  teacherTimetable(@CurrentUser() user: AuthUser, @Param("teacherId") teacherId: string) {
    return this.campus.teacherTimetable(user.tenantId, teacherId);
  }

  @Get("behaviour/catalog")
  catalog() {
    return this.campus.behaviourCatalog();
  }

  @Get("behaviour")
  ratings(@CurrentUser() user: AuthUser, @Query("studentId") studentId: string) {
    return this.campus.ratings(user.tenantId, studentId);
  }

  @Post("behaviour")
  saveRatings(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.saveRatings(user.tenantId, body);
  }

  @Post("behaviour/observations")
  observation(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.addObservation(user.tenantId, body);
  }

  @Get("behaviour/report")
  report(@CurrentUser() user: AuthUser, @Query("classId") classId: string, @Query("domain") domain: string) {
    return this.campus.behaviourReport(user.tenantId, classId, domain === "psychomotor" ? "psychomotor" : "affective");
  }

  @Get("store")
  store(@CurrentUser() user: AuthUser) {
    return this.campus.storeHome(user.tenantId);
  }

  @Post("store/categories")
  category(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.addCategory(user.tenantId, body);
  }

  @Post("store/taxes")
  tax(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.addTax(user.tenantId, body);
  }

  @Post("store/products")
  product(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.addProduct(user.tenantId, body);
  }

  @Post("store/orders")
  order(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.campus.createOrder(user.tenantId, body);
  }

  @Delete("store/orders/:id")
  deleteOrder(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.campus.deleteOrder(user.tenantId, id);
  }
}
