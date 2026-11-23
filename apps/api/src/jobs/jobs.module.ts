import { Global, Module } from "@nestjs/common";
import { JOB_QUEUE, JobQueue } from "./job-queue";

@Global()
@Module({
  providers: [
    {
      provide: JOB_QUEUE,
      useFactory: () => new JobQueue(1),
    },
  ],
  exports: [JOB_QUEUE],
})
export class JobsModule {}
