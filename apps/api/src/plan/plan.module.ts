import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlanController } from "./plan.controller";
import { PlanService } from "./plan.service";

@Global()
@Module({
  imports: [AuthModule],
  controllers: [PlanController],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
