import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { LearningService } from "./learning.service";

@Controller("learning")
@UseGuards(AuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get("settings")
  settings(@CurrentUser() user: AuthUser) {
    return this.learning.settings(user.tenantId);
  }

  @Patch("settings")
  updateSettings(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.learning.updateSettings(user.tenantId, body);
  }

  @Post("settings/reset")
  resetSettings(@CurrentUser() user: AuthUser) {
    return this.learning.resetSettings(user.tenantId);
  }

  @Get("homework")
  homework(
    @CurrentUser() user: AuthUser,
    @Query("date") date?: string,
    @Query("classId") classId?: string,
    @Query("teacherId") teacherId?: string,
  ) {
    return this.learning.listHomework(user.tenantId, date, classId, teacherId);
  }

  @Post("homework")
  createHomework(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.learning.createHomework(user.tenantId, body);
  }

  @Get("homework/:id/file")
  homeworkFile(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.homeworkFile(user.tenantId, id);
  }

  @Patch("homework/:id")
  updateHomework(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.learning.updateHomework(user.tenantId, id, body);
  }

  @Delete("homework/:id")
  deleteHomework(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.deleteHomework(user.tenantId, id);
  }

  @Get("exams")
  exams(@CurrentUser() user: AuthUser) {
    return this.learning.listExams(user.tenantId);
  }

  @Get("exams/schedule")
  schedule(@CurrentUser() user: AuthUser) {
    return this.learning.examSchedule(user.tenantId);
  }

  @Post("exams")
  createExam(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.learning.createExam(user.tenantId, body);
  }

  @Get("exams/recent")
  async recent(
    @CurrentUser() user: AuthUser,
    @Query("registration") registration: string,
    @Query("last") last?: string,
  ) {
    await this.learning.assertOwnRegistration(user, registration ?? "");
    return this.learning.recentResults(user.tenantId, registration ?? "", Number(last ?? 2));
  }

  @Patch("exams/:id")
  updateExam(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.learning.updateExam(user.tenantId, id, body);
  }

  @Delete("exams/:id")
  deleteExam(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.deleteExam(user.tenantId, id);
  }

  @Get("exams/:id/setup")
  examSetup(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.examSetup(user.tenantId, id);
  }

  @Post("exams/:id/setup")
  saveExamSetup(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.learning.saveExamSetup(user.tenantId, id, body);
  }

  @Get("exams/:id/marks")
  examMarks(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("classId") classId: string) {
    return this.learning.examMarkSheet(user.tenantId, id, classId ?? "");
  }

  @Post("exams/:id/marks")
  saveExamMarks(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.learning.saveExamMarks(user.tenantId, id, body);
  }

  @Delete("exams/:id/marks")
  deleteExamMarks(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("studentId") studentId?: string,
    @Query("subjectId") subjectId?: string,
  ) {
    return this.learning.deleteExamMarks(user.tenantId, id, studentId, subjectId);
  }

  @Get("exams/:id/result")
  async examResult(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("registration") registration: string) {
    await this.learning.assertOwnRegistration(user, registration ?? "");
    return this.learning.examResult(user.tenantId, id, registration ?? "");
  }

  @Get("exams/:id/sheet")
  resultSheet(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("classId") classId: string) {
    return this.learning.resultSheet(user.tenantId, id, classId ?? "");
  }

  @Get("exams/:id/datesheet")
  dateSheet(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.dateSheet(user.tenantId, id);
  }

  @Get("exams/:id/award")
  blankAward(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("classId") classId: string) {
    return this.learning.blankAward(user.tenantId, id, classId ?? "");
  }

  @Get("tests")
  testSheet(
    @CurrentUser() user: AuthUser,
    @Query("classId") classId: string,
    @Query("subjectId") subjectId: string,
    @Query("date") date: string,
  ) {
    return this.learning.testSheet(user.tenantId, classId ?? "", subjectId ?? "", date);
  }

  @Post("tests")
  saveTest(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.learning.saveTest(user.tenantId, body);
  }

  @Delete("tests")
  deleteTest(
    @CurrentUser() user: AuthUser,
    @Query("classId") classId: string,
    @Query("subjectId") subjectId: string,
    @Query("date") date: string,
  ) {
    return this.learning.deleteTest(user.tenantId, classId ?? "", subjectId ?? "", date);
  }

  @Get("tests/results")
  async testResults(
    @CurrentUser() user: AuthUser,
    @Query("classId") classId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("registration") registration?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if ((user.role === "student" || user.role === "parent") && registration) {
      await this.learning.assertOwnRegistration(user, registration);
    }
    return this.learning.testResults(user.tenantId, { classId, subjectId, registration, from, to });
  }

  @Get("tests/performance")
  testPerformance(@CurrentUser() user: AuthUser, @Query("classId") classId: string) {
    return this.learning.testPerformance(user.tenantId, classId ?? "");
  }

  @Get("progress")
  progress(@CurrentUser() user: AuthUser, @Query("classId") classId: string) {
    return this.learning.progressReport(user.tenantId, classId ?? "");
  }

  @Get("report-cards")
  async reportCard(@CurrentUser() user: AuthUser, @Query("registration") registration: string) {
    await this.learning.assertOwnRegistration(user, registration ?? "");
    return this.learning.reportCard(user.tenantId, registration ?? "");
  }

  @Post("letters/admission")
  admission(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    return this.learning.admissionLetter(user.tenantId, studentId, true);
  }

  @Get("letters/admission/:studentId")
  admissionReprint(@CurrentUser() user: AuthUser, @Param("studentId") studentId: string) {
    return this.learning.admissionLetterFor(user, studentId, false);
  }

  @Post("letters/job")
  job(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    return this.learning.jobLetter(user.tenantId, employeeId, true);
  }

  @Get("letters/job/:employeeId")
  jobReprint(@CurrentUser() user: AuthUser, @Param("employeeId") employeeId: string) {
    return this.learning.jobLetter(user.tenantId, employeeId, false);
  }

  @Get("certificate-templates")
  templates(@CurrentUser() user: AuthUser) {
    return this.learning.listTemplates(user.tenantId);
  }

  @Post("certificate-templates")
  createTemplate(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.learning.saveTemplate(user.tenantId, body);
  }

  @Patch("certificate-templates/:id")
  updateTemplate(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.learning.saveTemplate(user.tenantId, body, id);
  }

  @Delete("certificate-templates/:id")
  deleteTemplate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.deleteTemplate(user.tenantId, id);
  }

  @Get("certificates")
  certificates(@CurrentUser() user: AuthUser) {
    return this.learning.listCertificates(user.tenantId);
  }

  @Post("certificates")
  createCertificate(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.learning.createCertificate(user.tenantId, body);
  }

  @Get("certificates/:id")
  certificate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.certificatePrint(user.tenantId, id);
  }

  @Delete("certificates/:id")
  deleteCertificate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.learning.deleteCertificate(user.tenantId, id);
  }
}
