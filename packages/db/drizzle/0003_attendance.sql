CREATE TYPE "public"."attendance_source" AS ENUM('manual', 'rfid');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'leave', 'absent');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid,
	"employee_id" uuid,
	"attendance_date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"source" "attendance_source" DEFAULT 'manual' NOT NULL,
	"marked_time" text DEFAULT '-' NOT NULL,
	"edited_manually" boolean DEFAULT false NOT NULL,
	"edited_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_student_day" ON "attendance_records" USING btree ("tenant_id","student_id","attendance_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_employee_day" ON "attendance_records" USING btree ("tenant_id","employee_id","attendance_date");