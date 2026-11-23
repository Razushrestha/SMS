import { Inject, Injectable } from "@nestjs/common";
import { auditEvents, institutes, type Database } from "@nepatronix/db";
import { and, desc, eq, like } from "drizzle-orm";
import { DB } from "../db/db.module";

export type Actor = { id: string; name: string };

const labels: Record<string, string> = {
  fee_collected: "Fee collected",
  salary_paid: "Salary paid",
  attendance_edited: "Attendance edited",
  card_assigned: "Card assigned",
  location_exported: "Location history exported",
  location_deleted: "Location history deleted",
  platform_school_created: "School created",
  platform_subscription_updated: "Subscription updated",
  platform_school_suspended: "School suspended",
  platform_school_reactivated: "School reactivated",
  platform_school_archived: "School archived",
  platform_school_extended: "Subscription extended",
  platform_school_deleted: "School deleted",
  platform_sms_topup: "SMS topped up",
  platform_sms_bulk_topup: "Bulk SMS top-up",
  platform_admin_password_reset: "Admin password reset",
  platform_admin_invite: "Admin invite prepared",
  platform_support_login: "Support login issued",
};

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(tenantId: string, actor: Actor, action: string, detail: string) {
    const [row] = await this.db
      .insert(auditEvents)
      .values({ tenantId, actorId: actor.id, actorName: actor.name, action, detail })
      .returning({ id: auditEvents.id });
    return row;
  }

  async list(tenantId: string) {
    const rows = await this.db
      .select({
        id: auditEvents.id,
        actorName: auditEvents.actorName,
        action: auditEvents.action,
        detail: auditEvents.detail,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenantId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100);
    return rows.map((row) => ({ ...row, label: labels[row.action] ?? row.action }));
  }

  async listPlatform(limit = 40, tenantId?: string) {
    const filters = [like(auditEvents.action, "platform_%")];
    if (tenantId) filters.push(eq(auditEvents.tenantId, tenantId));
    const rows = await this.db
      .select({
        id: auditEvents.id,
        tenantId: auditEvents.tenantId,
        instituteName: institutes.name,
        actorName: auditEvents.actorName,
        action: auditEvents.action,
        detail: auditEvents.detail,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .innerJoin(institutes, eq(institutes.tenantId, auditEvents.tenantId))
      .where(and(...filters))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);
    return rows.map((row) => ({ ...row, label: labels[row.action] ?? row.action }));
  }
}
