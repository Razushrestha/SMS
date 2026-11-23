import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { Database } from "@nepatronix/db";
import { sql } from "drizzle-orm";
import { DB } from "../db/db.module";

@Controller()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Liveness — process is up (no DB). */
  @Get("health")
  health() {
    return { ok: true, service: "nepatronix-api" };
  }

  /** Readiness — Postgres accepts queries. */
  @Get("ready")
  async ready() {
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, database: "up" };
    } catch {
      throw new ServiceUnavailableException({ ok: false, database: "down" });
    }
  }
}
