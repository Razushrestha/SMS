CREATE TABLE "tenant_plans" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"reader_quota" integer DEFAULT 5 NOT NULL,
	"card_quota" integer DEFAULT 100 NOT NULL,
	"vehicle_quota" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD CONSTRAINT "tenant_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;