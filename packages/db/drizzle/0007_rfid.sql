CREATE TYPE "public"."card_status" AS ENUM('active', 'lost', 'blocked', 'spare');--> statement-breakpoint
CREATE TYPE "public"."reader_direction" AS ENUM('in', 'out', 'both');--> statement-breakpoint
CREATE TYPE "public"."reader_location" AS ENUM('campus', 'gate', 'building', 'room', 'bus');--> statement-breakpoint
CREATE TYPE "public"."reader_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "rfid_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"uid" text NOT NULL,
	"student_id" uuid,
	"employee_id" uuid,
	"status" "card_status" DEFAULT 'spare' NOT NULL,
	"issued_on" date,
	"returned_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfid_readers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"serial" text NOT NULL,
	"secret_hash" text NOT NULL,
	"location" "reader_location" NOT NULL,
	"direction" "reader_direction" NOT NULL,
	"status" "reader_status" DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfid_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"day_start" text DEFAULT '09:00' NOT NULL,
	"cutoff_minutes" integer DEFAULT 15 NOT NULL,
	"notify_parents" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfid_taps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reader_id" uuid NOT NULL,
	"card_id" uuid,
	"uid" text NOT NULL,
	"tapped_at" timestamp with time zone NOT NULL,
	"direction" text NOT NULL,
	"result" text NOT NULL,
	"person_name" text
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "out_time" text;--> statement-breakpoint
ALTER TABLE "rfid_cards" ADD CONSTRAINT "rfid_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_cards" ADD CONSTRAINT "rfid_cards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_cards" ADD CONSTRAINT "rfid_cards_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_readers" ADD CONSTRAINT "rfid_readers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_settings" ADD CONSTRAINT "rfid_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_taps" ADD CONSTRAINT "rfid_taps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_taps" ADD CONSTRAINT "rfid_taps_reader_id_rfid_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."rfid_readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfid_taps" ADD CONSTRAINT "rfid_taps_card_id_rfid_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."rfid_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_uid_once" ON "rfid_cards" USING btree ("tenant_id","uid");--> statement-breakpoint
CREATE UNIQUE INDEX "reader_serial_once" ON "rfid_readers" USING btree ("serial");