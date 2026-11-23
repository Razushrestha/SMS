CREATE TYPE "public"."account_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."entry_source" AS ENUM('manual', 'fee', 'salary');--> statement-breakpoint
CREATE TABLE "account_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"statement_entry_id" uuid,
	"fee_month" text NOT NULL,
	"paid_on" date NOT NULL,
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
	"deposit" numeric(12, 2) NOT NULL,
	"due" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"statement_entry_id" uuid,
	"salary_month" text NOT NULL,
	"paid_on" date NOT NULL,
	"fixed_salary" numeric(12, 2) NOT NULL,
	"bonus" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"head_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"income" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expense" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reference" text DEFAULT 'by Admin' NOT NULL,
	"source" "entry_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_heads" ADD CONSTRAINT "account_heads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_statement_entry_id_statement_entries_id_fk" FOREIGN KEY ("statement_entry_id") REFERENCES "public"."statement_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_statement_entry_id_statement_entries_id_fk" FOREIGN KEY ("statement_entry_id") REFERENCES "public"."statement_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_entries" ADD CONSTRAINT "statement_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_entries" ADD CONSTRAINT "statement_entries_head_id_account_heads_id_fk" FOREIGN KEY ("head_id") REFERENCES "public"."account_heads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "salary_employee_month" ON "salary_payments" USING btree ("tenant_id","employee_id","salary_month");