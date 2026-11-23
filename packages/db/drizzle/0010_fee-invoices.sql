CREATE TYPE "public"."fee_scope" AS ENUM('everyone', 'class', 'student');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"branch_address" text NOT NULL,
	"account_number" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"logo_data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_carry_forwards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"target_month" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"fee_month" text NOT NULL,
	"due_date" date NOT NULL,
	"late_fine" numeric(12, 2) DEFAULT '0' NOT NULL,
	"monthly_fee" numeric(12, 2) NOT NULL,
	"admission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"registration" numeric(12, 2) DEFAULT '0' NOT NULL,
	"art" numeric(12, 2) DEFAULT '0' NOT NULL,
	"transport" numeric(12, 2) DEFAULT '0' NOT NULL,
	"books" numeric(12, 2) DEFAULT '0' NOT NULL,
	"uniform" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fine" numeric(12, 2) DEFAULT '0' NOT NULL,
	"others" numeric(12, 2) DEFAULT '0' NOT NULL,
	"previous_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"bank_name" text NOT NULL,
	"bank_branch" text NOT NULL,
	"account_number" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"issued_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_particulars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"month" text,
	"scope" "fee_scope" NOT NULL,
	"class_id" uuid,
	"student_id" uuid,
	"admission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"registration" numeric(12, 2) DEFAULT '0' NOT NULL,
	"art" numeric(12, 2) DEFAULT '0' NOT NULL,
	"transport" numeric(12, 2) DEFAULT '0' NOT NULL,
	"books" numeric(12, 2) DEFAULT '0' NOT NULL,
	"uniform" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fine" numeric(12, 2) DEFAULT '0' NOT NULL,
	"others" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_carry_forwards" ADD CONSTRAINT "fee_carry_forwards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_carry_forwards" ADD CONSTRAINT "fee_carry_forwards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_particulars" ADD CONSTRAINT "fee_particulars_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_particulars" ADD CONSTRAINT "fee_particulars_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_particulars" ADD CONSTRAINT "fee_particulars_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_carry_once" ON "fee_carry_forwards" USING btree ("tenant_id","student_id","target_month");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_invoice_once" ON "fee_invoices" USING btree ("tenant_id","student_id","fee_month");