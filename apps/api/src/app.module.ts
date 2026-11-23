import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { DbModule } from "./db/db.module";
import { InstituteModule } from "./institute/institute.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AuditModule } from "./audit/audit.module";
import { PlanModule } from "./plan/plan.module";
import { PlatformModule } from "./platform/platform.module";
import { LearningModule } from "./learning/learning.module";
import { MessagesModule } from "./messages/messages.module";
import { CampusModule } from "./campus/campus.module";
import { FinanceModule } from "./finance/finance.module";
import { GpsModule } from "./gps/gps.module";
import { RfidModule } from "./rfid/rfid.module";
import { ReportsModule } from "./reports/reports.module";
import { AssistantModule } from "./assistant/assistant.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { SchoolModule } from "./school/school.module";
import { JobsModule } from "./jobs/jobs.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    DbModule,
    JobsModule,
    HealthModule,
    AuthModule,
    AuditModule,
    PlanModule,
    PlatformModule,
    InstituteModule,
    SchoolModule,
    FinanceModule,
    AttendanceModule,
    LearningModule,
    MessagesModule,
    CampusModule,
    RfidModule,
    GpsModule,
    ReportsModule,
    AssistantModule,
    DashboardModule,
  ],
})
export class AppModule {}
