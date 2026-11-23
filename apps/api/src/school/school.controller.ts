import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { SchoolService } from "./school.service";

@Controller()
@UseGuards(AuthGuard)
export class SchoolController {
  constructor(private readonly school: SchoolService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthUser) {
    return this.school.summary(user.tenantId);
  }

  @Get("employees")
  employees(@CurrentUser() user: AuthUser) {
    return this.school.listEmployees(user.tenantId);
  }

  @Get("employees/report")
  employeeReport(@CurrentUser() user: AuthUser) {
    return this.school.employeeReport(user.tenantId);
  }

  @Get("employees/cards")
  staffCards(@CurrentUser() user: AuthUser) {
    return this.school.staffCards(user.tenantId);
  }

  @Post("employees")
  createEmployee(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.school.createEmployee(user.tenantId, body);
  }

  @Patch("employees/:id")
  updateEmployee(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.school.updateEmployee(user.tenantId, id, body);
  }

  @Delete("employees/:id")
  deleteEmployee(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.deleteEmployee(user.tenantId, id);
  }

  @Get("classes")
  classes(@CurrentUser() user: AuthUser) {
    return this.school.listClasses(user.tenantId);
  }

  @Post("classes")
  createClass(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.school.createClass(user.tenantId, body);
  }

  @Patch("classes/:id")
  updateClass(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.school.updateClass(user.tenantId, id, body);
  }

  @Delete("classes/:id")
  deleteClass(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.deleteClass(user.tenantId, id);
  }

  @Get("subjects")
  subjects(@CurrentUser() user: AuthUser, @Query("classId") classId: string) {
    return this.school.listSubjects(user.tenantId, classId);
  }

  @Post("subjects")
  addSubject(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.school.addSubject(user.tenantId, body);
  }

  @Delete("subjects/:id")
  deleteSubject(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.deleteSubject(user.tenantId, id);
  }

  @Get("families")
  families(@CurrentUser() user: AuthUser) {
    return this.school.listFamilies(user.tenantId);
  }

  @Post("families")
  createFamily(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.school.createFamily(user.tenantId, body);
  }

  @Patch("families/:id")
  updateFamily(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.school.updateFamily(user.tenantId, id, body);
  }

  @Delete("families/:id")
  deleteFamily(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.deleteFamily(user.tenantId, id);
  }

  @Get("students/meta")
  studentMeta(@CurrentUser() user: AuthUser) {
    return this.school.studentMeta(user.tenantId);
  }

  @Get("students/me")
  meStudent(@CurrentUser() user: AuthUser) {
    return this.school.meStudent(user);
  }

  @Get("students/children")
  children(@CurrentUser() user: AuthUser) {
    return this.school.listChildren(user);
  }

  @Get("students")
  students(@CurrentUser() user: AuthUser) {
    return this.school.listStudents(user.tenantId);
  }

  @Get("students/lookup")
  lookupStudents(@CurrentUser() user: AuthUser, @Query("q") q = "") {
    return this.school.lookupStudents(user.tenantId, q);
  }

  @Get("students/basic")
  basicList(@CurrentUser() user: AuthUser) {
    return this.school.basicList(user.tenantId);
  }

  @Get("students/contacts")
  contactReport(@CurrentUser() user: AuthUser) {
    return this.school.contactReport(user.tenantId);
  }

  @Get("students/info")
  infoReport(@CurrentUser() user: AuthUser) {
    return this.school.infoReport(user.tenantId);
  }

  @Get("students/promote")
  promotionList(@CurrentUser() user: AuthUser) {
    return this.school.promotionList(user.tenantId);
  }

  @Post("students/promote")
  promoteStudents(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.school.promoteStudents(user.tenantId, body);
  }

  @Get("students/:id")
  student(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.getStudent(user.tenantId, id);
  }

  @Get("students/:id/login")
  portalLogin(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.portalLogin(user.tenantId, id);
  }

  @Patch("students/:id/login")
  savePortalUsername(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.school.savePortalUsername(user.tenantId, id, body);
  }

  @Post("students/:id/login/reset")
  resetPortalPassword(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.resetPortalPassword(user.tenantId, id);
  }

  @Post("students/:id/login/sms")
  sendPortalSms(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.school.sendPortalSms(user.tenantId, id, body);
  }

  @Post("students")
  createStudent(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.school.createStudent(user.tenantId, body);
  }

  @Patch("students/:id")
  updateStudent(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.school.updateStudent(user.tenantId, id, body);
  }

  @Delete("students/:id")
  deleteStudent(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.school.deleteStudent(user.tenantId, id);
  }
}
