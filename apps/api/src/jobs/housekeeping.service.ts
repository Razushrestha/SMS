import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { auditEvents, sessions, supportLoginTokens, type Database } from "@nepatronix/db";
import { and, lt, sql } from "drizzle-orm";
import { DB } from "../db/db.module";
import { JOB_QUEUE, JobQueue } from "./job-queue";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const AUDIT_DAYS = 180;

@Injectable()
export class HousekeepingService implements OnModuleInit, OnModuleDestroy {
  private boot?: ReturnType<typeof setTimeout>;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  onModuleInit() {
    const schedule = () => this.jobs.enqueue("housekeeping", "housekeeping", () => this.sweep());
    this.boot = setTimeout(schedule, 15_000);
    this.timer = setInterval(schedule, SIX_HOURS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.boot) clearTimeout(this.boot);
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    const now = new Date();
    const auditCutoff = new Date(now.getTime() - AUDIT_DAYS * 24 * 60 * 60 * 1000);
    await this.db.delete(sessions).where(lt(sessions.expiresAt, now));
    await this.db.delete(supportLoginTokens).where(lt(supportLoginTokens.expiresAt, now));
    await this.db.delete(auditEvents).where(and(lt(auditEvents.createdAt, auditCutoff), sql`${auditEvents.action} not like 'platform_%'`));
  }
}
