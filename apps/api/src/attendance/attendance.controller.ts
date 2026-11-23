import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { AttendanceService } from "./attendance.service";

@Controller("attendance")
@UseGuards(AuthGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get("own")
  own(@CurrentUser() user: AuthUser) {
    return this.attendance.own(user);
  }

  @Get("students")
  studentSheet(@CurrentUser() user: AuthUser, @Query("classId") classId: string, @Query("date") date: string) {
    return this.attendance.studentSheet(user.tenantId, classId ?? "", date);
  }

  @Post("students")
  saveStudents(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.attendance.saveStudentSheet(user.tenantId, user, body);
  }

  @Get("employees")
  employeeSheet(@CurrentUser() user: AuthUser, @Query("date") date: string) {
    return this.attendance.employeeSheet(user.tenantId, date);
  }

  @Post("employees")
  saveEmployees(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.attendance.saveEmployeeSheet(user.tenantId, user, body);
  }

  @Get("reports/students")
  studentReport(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("classId") classId?: string,
  ) {
    return this.attendance.studentReport(user.tenantId, from, to, classId);
  }

  @Get("reports/employees")
  employeeReport(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.attendance.employeeReport(user.tenantId, from, to);
  }

  @Get("reports/classes")
  classReport(@CurrentUser() user: AuthUser, @Query("date") date: string) {
    return this.attendance.classReport(user.tenantId, date);
  }

  @Get("monthly/students")
  monthlyStudents(@CurrentUser() user: AuthUser, @Query("classId") classId: string, @Query("month") month: string) {
    return this.attendance.monthlyStudents(user.tenantId, classId ?? "", month);
  }

  @Get("monthly/employees")
  monthlyEmployees(@CurrentUser() user: AuthUser, @Query("month") month: string) {
    return this.attendance.monthlyEmployees(user.tenantId, month);
  }
}
