import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { institutes, schoolPreferences, type Database } from "@nepatronix/db";
import { eq } from "drizzle-orm";
import { DB } from "../db/db.module";

export type InstituteInput = {
  name: string;
  targetLine: string;
  phone: string;
  website?: string;
  address: string;
  country: string;
  timezone?: string;
  dateFormat?: string;
  currency?: string;
  currencySymbol?: string;
  logoUrl?: string | null;
};

const dateFormats = ["d MMMM, yyyy", "yyyy-MM-dd", "dd/MM/yyyy"];

@Injectable()
export class InstituteService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(tenantId: string) {
    const [row] = await this.db.select().from(institutes).where(eq(institutes.tenantId, tenantId)).limit(1);
    if (!row) throw new NotFoundException("Institute not found");
    return { institute: row };
  }

  async update(tenantId: string, input: InstituteInput) {
    for (const [key, label] of [
      ["name", "Institute name"],
      ["targetLine", "Target line"],
      ["phone", "Phone"],
      ["address", "Address"],
      ["country", "Country"],
    ] as const) {
      if (!input[key] || input[key].trim().length === 0) {
        throw new BadRequestException(`${label} is required`);
      }
    }
    const dateFormat = input.dateFormat?.trim() || "d MMMM, yyyy";
    if (!dateFormats.includes(dateFormat)) throw new BadRequestException("Choose a date format");
    const logoUrl = input.logoUrl === null ? null : typeof input.logoUrl === "string" && input.logoUrl.trim() ? this.logo(input.logoUrl) : undefined;
    const [row] = await this.db
      .update(institutes)
      .set({
        name: input.name.trim(),
        targetLine: input.targetLine.trim(),
        phone: input.phone.trim(),
        website: input.website?.trim() || null,
        address: input.address.trim(),
        country: input.country.trim(),
        timezone: input.timezone?.trim() || "Asia/Kathmandu",
        dateFormat,
        currency: input.currency?.trim() || "USD",
        currencySymbol: input.currencySymbol?.trim() || "$",
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(institutes.tenantId, tenantId))
      .returning();
    return { institute: row };
  }

  async preferences(tenantId: string) {
    const [existing] = await this.db.select().from(schoolPreferences).where(eq(schoolPreferences.tenantId, tenantId)).limit(1);
    if (existing) return existing;
    const [created] = await this.db.insert(schoolPreferences).values({ tenantId }).returning();
    return created;
  }

  private logo(value: string) {
    const match = value.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new BadRequestException("Logo must be a JPG or PNG");
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > 500 * 1024) throw new BadRequestException("Logo must be 500 KB or smaller");
    return value;
  }

  async updatePreferences(tenantId: string, body: Record<string, unknown>) {
    await this.preferences(tenantId);
    const direction = body.direction === "rtl" ? "rtl" : "ltr";
    const sidebar = body.sidebar === "light" ? "light" : "dark";
    const headers = ["dark", "red", "dark-green", "green", "blue", "white"];
    const colors = ["teal", "blue", "red", "green", "amber"];
    const languages = ["English", "Nepali", "Hindi", "Urdu", "Arabic", "Bengali", "Chinese", "French", "Spanish", "Xhosa"];
    const header = headers.includes(String(body.header)) ? String(body.header) : "dark";
    const activeColor = colors.includes(String(body.activeColor)) ? String(body.activeColor) : "teal";
    const language = languages.includes(String(body.language)) ? String(body.language) : "English";
    const [row] = await this.db
      .update(schoolPreferences)
      .set({
        direction,
        sidebar,
        header,
        activeColor,
        language,
        studentRules: typeof body.studentRules === "string" ? body.studentRules.trim() : "",
        employeeRules: typeof body.employeeRules === "string" ? body.employeeRules.trim() : "",
      })
      .where(eq(schoolPreferences.tenantId, tenantId))
      .returning();
    return row;
  }

  async updateLanguage(tenantId: string, body: Record<string, unknown>) {
    await this.preferences(tenantId);
    const languages = ["English", "Nepali", "Hindi", "Urdu", "Arabic", "Bengali", "Chinese", "French", "Spanish", "Xhosa"];
    const language = String(body.language ?? "");
    if (!languages.includes(language)) throw new BadRequestException("Choose a language.");
    const [row] = await this.db.update(schoolPreferences).set({ language }).where(eq(schoolPreferences.tenantId, tenantId)).returning();
    return row;
  }

  async resetPreferences(tenantId: string) {
    const current = await this.preferences(tenantId);
    const [row] = await this.db
      .update(schoolPreferences)
      .set({ direction: "ltr", sidebar: "dark", header: "dark", activeColor: "teal", language: "English", studentRules: current.studentRules, employeeRules: current.employeeRules })
      .where(eq(schoolPreferences.tenantId, tenantId))
      .returning();
    return row;
  }
}
