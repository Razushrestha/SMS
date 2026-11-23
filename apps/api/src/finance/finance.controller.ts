import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { FinanceService } from "./finance.service";

@Controller()
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("account-heads")
  heads(@CurrentUser() user: AuthUser) {
    return this.finance.listHeads(user.tenantId);
  }

  @Post("account-heads")
  createHead(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.createHead(user.tenantId, body);
  }

  @Delete("account-heads/:id")
  deleteHead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.finance.deleteHead(user.tenantId, id);
  }

  @Post("statement")
  addManual(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.addManual(user.tenantId, body);
  }

  @Get("statement")
  statement(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.finance.statement(user.tenantId, from, to);
  }

  @Get("statement/report")
  accountsReport(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.finance.accountsReport(user.tenantId, from, to);
  }

  @Delete("statement/:id")
  deleteEntry(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.finance.deleteEntry(user.tenantId, id);
  }

  @Get("fees/preview")
  feePreview(@CurrentUser() user: AuthUser, @Query("registration") registration: string, @Query("month") month: string) {
    return this.finance.feePreview(user.tenantId, registration ?? "", month);
  }

  @Post("fees")
  collectFee(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.collectFee(user.tenantId, body, user);
  }

  @Get("fees/slip")
  feeSlip(@CurrentUser() user: AuthUser, @Query("registration") registration: string, @Query("month") month: string) {
    return this.finance.feeSlip(user, registration ?? "", month);
  }

  @Get("fees/structure")
  structure(@CurrentUser() user: AuthUser, @Query("month") month: string) {
    return this.finance.feeStructure(user.tenantId, month);
  }

  @Get("fees/report")
  report(@CurrentUser() user: AuthUser, @Query("month") month: string) {
    return this.finance.feeReport(user.tenantId, month);
  }

  @Get("fees/defaulters")
  defaulters(@CurrentUser() user: AuthUser, @Query("month") month: string) {
    return this.finance.defaulters(user.tenantId, month);
  }

  @Get("fees/defaulters/:studentId")
  defaulter(@CurrentUser() user: AuthUser, @Param("studentId") studentId: string, @Query("month") month: string) {
    return this.finance.defaulterDetail(user.tenantId, studentId, month);
  }

  @Post("fees/defaulters/:studentId/remind")
  remind(@CurrentUser() user: AuthUser, @Param("studentId") studentId: string, @Body() body: Record<string, unknown>) {
    return this.finance.sendReminder(user.tenantId, studentId, body);
  }

  @Post("fees/carry")
  carry(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.carryForward(user.tenantId, body);
  }

  @Get("fees/particulars")
  particulars(@CurrentUser() user: AuthUser) {
    return this.finance.listParticulars(user.tenantId);
  }

  @Post("fees/particulars")
  addParticular(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.addParticular(user.tenantId, body);
  }

  @Post("fees/particulars/reset")
  resetParticulars(@CurrentUser() user: AuthUser) {
    return this.finance.resetParticulars(user.tenantId);
  }

  @Get("fees/banks")
  banks(@CurrentUser() user: AuthUser) {
    return this.finance.listBanks(user.tenantId);
  }

  @Post("fees/banks")
  addBank(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.addBank(user.tenantId, body);
  }

  @Patch("fees/banks/:id")
  updateBank(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.finance.updateBank(user.tenantId, id, body);
  }

  @Delete("fees/banks/:id")
  deleteBank(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.finance.deleteBank(user.tenantId, id);
  }

  @Post("fees/invoices")
  invoice(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.generateInvoice(user.tenantId, body);
  }

  @Post("fees/invoices/class")
  classInvoices(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.generateClassInvoices(user.tenantId, body);
  }

  @Post("fees/invoices/family")
  familyInvoices(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.generateFamilyInvoices(user.tenantId, body);
  }

  @Get("fees/invoices")
  invoices(@CurrentUser() user: AuthUser) {
    return this.finance.listInvoices(user.tenantId);
  }

  @Get("fees/family")
  familyPreview(@CurrentUser() user: AuthUser, @Query("familyId") familyId: string, @Query("month") month: string) {
    return this.finance.familyPreview(user.tenantId, familyId ?? "", month);
  }

  @Post("fees/family")
  collectFamily(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.collectFamily(user.tenantId, body, user);
  }

  @Get("fees/scan")
  scan(@CurrentUser() user: AuthUser, @Query("code") code: string) {
    return this.finance.scanInvoice(user.tenantId, code ?? "");
  }

  @Post("fees/scan")
  payScan(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.payScannedInvoice(user.tenantId, body, user);
  }

  @Delete("fees/:id")
  deleteFee(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.finance.deleteFee(user.tenantId, id);
  }

  @Get("salary/sheet")
  salarySheet(@CurrentUser() user: AuthUser, @Query("month") month: string) {
    return this.finance.salarySheet(user.tenantId, month);
  }

  @Get("salary/report")
  salaryReport(@CurrentUser() user: AuthUser, @Query("month") month: string) {
    return this.finance.salaryReport(user.tenantId, month);
  }

  @Get("salary/preview")
  salaryPreview(@CurrentUser() user: AuthUser, @Query("employeeId") employeeId: string, @Query("month") month: string) {
    return this.finance.salaryPreview(user.tenantId, employeeId ?? "", month);
  }

  @Post("salary")
  paySalary(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.finance.paySalary(user.tenantId, body, user);
  }

  @Get("salary/slip")
  salarySlip(@CurrentUser() user: AuthUser, @Query("employeeId") employeeId: string) {
    return this.finance.salarySlip(user.tenantId, employeeId ?? "");
  }

  @Delete("salary/:id")
  deleteSalary(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.finance.deleteSalary(user.tenantId, id);
  }
}
