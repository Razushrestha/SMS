import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { AssistantService } from "./assistant.service";

@Controller("assistant")
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.assistant.status(user.tenantId);
  }

  @Post("ask")
  ask(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.assistant.ask(user, body);
  }
}
