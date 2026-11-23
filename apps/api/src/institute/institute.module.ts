import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InstituteController } from "./institute.controller";
import { InstituteService } from "./institute.service";

@Module({
  imports: [AuthModule],
  controllers: [InstituteController],
  providers: [InstituteService],
})
export class InstituteModule {}
