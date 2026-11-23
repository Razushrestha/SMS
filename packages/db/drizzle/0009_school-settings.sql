CREATE TABLE "school_preferences" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"direction" text DEFAULT 'ltr' NOT NULL,
	"sidebar" text DEFAULT 'dark' NOT NULL,
	"header" text DEFAULT 'dark' NOT NULL,
	"active_color" text DEFAULT 'teal' NOT NULL,
	"language" text DEFAULT 'English' NOT NULL,
	"student_rules" text DEFAULT '' NOT NULL,
	"employee_rules" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grading_settings" ADD COLUMN "bands" jsonb;--> statement-breakpoint
ALTER TABLE "school_preferences" ADD CONSTRAINT "school_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;