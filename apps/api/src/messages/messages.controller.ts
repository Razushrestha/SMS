import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { MessagesService } from "./messages.service";

@Controller()
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("messages")
  chats(@CurrentUser() user: AuthUser, @Query("search") search?: string, @Query("archived") archived?: string) {
    return this.messages.listChats(user, search, archived === "1");
  }

  @Post("messages")
  createChat(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.messages.createChat(user.tenantId, user.id, user.name, body);
  }

  @Get("messages/:id")
  openChat(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.messages.openChat(user, id);
  }

  @Post("messages/:id")
  postMessage(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.messages.postMessage(user.tenantId, user.id, user.name, id, body);
  }

  @Get("messages/file/:messageId")
  file(@CurrentUser() user: AuthUser, @Param("messageId") messageId: string) {
    return this.messages.file(user.tenantId, messageId);
  }

  @Post("messages/:id/archive")
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.messages.archiveChat(user.tenantId, id);
  }

  @Delete("messages/:id")
  deleteChat(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.messages.deleteChat(user.tenantId, id);
  }

  @Get("meetings")
  meetings(@CurrentUser() user: AuthUser, @Query("filter") filter?: string) {
    return this.messages.listMeetings(user, filter);
  }

  @Post("meetings")
  createMeeting(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.messages.createMeeting(user.tenantId, user.id, user.name, body);
  }

  @Patch("meetings/:id")
  setActive(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { active?: boolean }) {
    return this.messages.setMeetingActive(user.tenantId, id, Boolean(body.active));
  }

  @Delete("meetings/:id")
  deleteMeeting(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.messages.deleteMeeting(user.tenantId, id);
  }

  @Get("meetings/room/:code")
  room(@CurrentUser() user: AuthUser, @Param("code") code: string) {
    return this.messages.room(user.tenantId, decodeURIComponent(code));
  }

  @Get("sms")
  sms(@CurrentUser() user: AuthUser) {
    return this.messages.smsHome(user.tenantId);
  }

  @Post("sms/setup")
  setup(@CurrentUser() user: AuthUser) {
    return this.messages.startSetup(user.tenantId);
  }

  @Post("sms/pair")
  pair(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.messages.pairHandset(user.tenantId, body);
  }

  @Post("sms/unpair")
  unpair(@CurrentUser() user: AuthUser) {
    return this.messages.unpairHandset(user.tenantId);
  }

  @Post("sms/templates")
  template(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.messages.saveTemplate(user.tenantId, body);
  }

  @Delete("sms/templates/:id")
  deleteTemplate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.messages.deleteTemplate(user.tenantId, id);
  }

  @Post("sms/opt-outs")
  optOut(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.messages.optOut(user.tenantId, body);
  }

  @Post("sms/test")
  testSms(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.messages.sendSms(user.tenantId, "test", body);
  }

  @Post("sms/branded")
  brandedSms(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.messages.sendSms(user.tenantId, "branded", body);
  }
}
