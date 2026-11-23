import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { gpsSettings, institutes, rfidCards, rfidReaders, smsAccounts, tenantPlans, vehicles, type Database } from "@nepatronix/db";
import { and, count, eq, ne } from "drizzle-orm";
import { DB } from "../db/db.module";
import { evaluateSubscription, isNearQuota, nearQuotaMessage } from "./subscription";

@Injectable()
export class PlanService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(tenantId: string) {
    const plan = await this.ensure(tenantId);
    const [readers, cards, fleet, sms, gps] = await Promise.all([
      this.used(rfidReaders, tenantId),
      this.cardsInUse(tenantId),
      this.used(vehicles, tenantId),
      this.balance(tenantId),
      this.retention(tenantId),
    ]);
    const period = await this.period(tenantId);
    const subscription = evaluateSubscription({
      planName: plan.planName,
      status: plan.status,
      expiresOn: plan.expiresOn,
    });
    const usage = {
      readers,
      readerQuota: plan.readerQuota,
      cards,
      cardQuota: plan.cardQuota,
      vehicles: fleet,
      vehicleQuota: plan.vehicleQuota,
      smsBalance: sms,
    };
    return {
      name: subscription.planName,
      status: subscription.status,
      expiresOn: subscription.expiresOn,
      notes: plan.notes,
      health: subscription.health,
      blocked: subscription.blocked,
      message: subscription.message,
      nearQuota: isNearQuota(usage),
      nearQuotaMessage: nearQuotaMessage(usage),
      addons: ["RFID", "GPS", "SMS"],
      ...usage,
      retentionDays: gps,
      assistantTokenQuota: plan.assistantTokenQuota,
      assistantTokensUsed: plan.assistantPeriod === period ? plan.assistantTokensUsed : 0,
      assistantPeriod: period,
    };
  }

  async save(tenantId: string, body: Record<string, unknown>) {
    if (
      body.readerQuota !== undefined ||
      body.cardQuota !== undefined ||
      body.vehicleQuota !== undefined ||
      body.assistantTokenQuota !== undefined ||
      body.status !== undefined ||
      body.planName !== undefined
    ) {
      throw new BadRequestException("Plan quotas and subscription status are managed by NEPATRONIX Platform.");
    }
    const retentionDays = Number(body.retentionDays);
    if (!Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 365) {
      throw new BadRequestException("Keep location history from 7 to 365 days.");
    }
    await this.db.update(gpsSettings).set({ retentionDays }).where(eq(gpsSettings.tenantId, tenantId));
    return this.get(tenantId);
  }

  async assertReader(tenantId: string) {
    const plan = await this.get(tenantId);
    if (plan.readers >= plan.readerQuota) throw new ConflictException("The RFID reader quota is full.");
  }

  async assertCard(tenantId: string) {
    const plan = await this.get(tenantId);
    if (plan.cards >= plan.cardQuota) throw new ConflictException("The RFID card quota is full.");
  }

  async assertVehicle(tenantId: string) {
    const plan = await this.get(tenantId);
    if (plan.vehicles >= plan.vehicleQuota) throw new ConflictException("The GPS vehicle quota is full.");
  }

  private async ensure(tenantId: string) {
    const [row] = await this.db.select().from(tenantPlans).where(eq(tenantPlans.tenantId, tenantId)).limit(1);
    if (row) return row;
    const [created] = await this.db.insert(tenantPlans).values({ tenantId }).returning();
    return created;
  }

  private async cardsInUse(tenantId: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(rfidCards)
      .where(and(eq(rfidCards.tenantId, tenantId), ne(rfidCards.status, "blocked")));
    return Number(row?.value ?? 0);
  }

  private async used(table: typeof rfidReaders | typeof vehicles, tenantId: string) {
    const [row] = await this.db.select({ value: count() }).from(table).where(eq(table.tenantId, tenantId));
    return Number(row?.value ?? 0);
  }

  private async balance(tenantId: string) {
    const [row] = await this.db.select({ balance: smsAccounts.balance }).from(smsAccounts).where(eq(smsAccounts.tenantId, tenantId)).limit(1);
    return row?.balance ?? 0;
  }

  private async retention(tenantId: string) {
    const [row] = await this.db.select().from(gpsSettings).where(eq(gpsSettings.tenantId, tenantId)).limit(1);
    if (row) return row.retentionDays;
    const [created] = await this.db.insert(gpsSettings).values({ tenantId }).returning();
    return created.retentionDays;
  }

  private async period(tenantId: string) {
    const [institute] = await this.db.select({ timezone: institutes.timezone }).from(institutes).where(eq(institutes.tenantId, tenantId)).limit(1);
    const timeZone = institute?.timezone || "Asia/Kathmandu";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}`;
  }
}
