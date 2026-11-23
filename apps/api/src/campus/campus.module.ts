import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CampusController } from "./campus.controller";
import { CampusService } from "./campus.service";

@Module({
  imports: [AuthModule],
  controllers: [CampusController],
  providers: [CampusService],
})
export class CampusModule {}
