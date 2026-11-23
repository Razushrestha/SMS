import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MessagesModule } from "../messages/messages.module";
import { RfidController, RfidIngestController } from "./rfid.controller";
import { RfidService } from "./rfid.service";

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [RfidController, RfidIngestController],
  providers: [RfidService],
})
export class RfidModule {}
