CREATE TABLE "custom_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"columns" jsonb NOT NULL,
	"filter" text DEFAULT 'all' NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_reports" ADD CONSTRAINT "custom_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_report_name" ON "custom_reports" USING btree ("tenant_id","name");