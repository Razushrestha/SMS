import { Global, Module } from "@nestjs/common";
import { HousekeepingService } from "./housekeeping.service";
import { JOB_QUEUE, JobQueue } from "./job-queue";

@Global()
@Module({
  providers: [
    {
      provide: JOB_QUEUE,
      useFactory: () => new JobQueue(1),
    },
    HousekeepingService,
  ],
  exports: [JOB_QUEUE],
})
export class JobsModule {}
