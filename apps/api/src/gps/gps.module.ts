import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GpsController, GpsIngestController } from "./gps.controller";
import { GpsService } from "./gps.service";

@Module({
  imports: [AuthModule],
  controllers: [GpsController, GpsIngestController],
  providers: [GpsService],
})
export class GpsModule {}
