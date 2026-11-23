CREATE TYPE "public"."person_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('principal', 'management_staff', 'teacher', 'accountant', 'store_manager', 'other');--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"monthly_fee" numeric(12, 2) NOT NULL,
	"teacher_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"joining_date" date NOT NULL,
	"staff_role" "staff_role" NOT NULL,
	"monthly_salary" numeric(12, 2) NOT NULL,
	"father_or_husband" text,
	"national_id" text,
	"education" text,
	"gender" text,
	"religion" text,
	"blood_group" text,
	"experience" text,
	"email" text,
	"date_of_birth" date,
	"address" text,
	"show_on_website" boolean DEFAULT false NOT NULL,
	"status" "person_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"registration_no" text NOT NULL,
	"name" text NOT NULL,
	"admission_date" date NOT NULL,
	"class_id" uuid NOT NULL,
	"family_id" uuid,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"status" "person_status" DEFAULT 'active' NOT NULL,
	"sms_phone" text,
	"date_of_birth" date,
	"gender" text,
	"identification_mark" text,
	"blood_group" text,
	"disease" text,
	"birth_id" text,
	"caste" text,
	"previous_school" text,
	"previous_id" text,
	"note" text,
	"orphan" text,
	"osc" text,
	"religion" text,
	"siblings" text,
	"address" text,
	"father_name" text,
	"father_education" text,
	"father_national_id" text,
	"father_mobile" text,
	"father_occupation" text,
	"father_profession" text,
	"father_income" text,
	"mother_name" text,
	"mother_education" text,
	"mother_national_id" text,
	"mother_mobile" text,
	"mother_occupation" text,
	"mother_profession" text,
	"mother_income" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"total_marks" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_employees_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classes_tenant_name" ON "classes" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "students_tenant_reg" ON "students" USING btree ("tenant_id","registration_no");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_class_name" ON "subjects" USING btree ("class_id","name");