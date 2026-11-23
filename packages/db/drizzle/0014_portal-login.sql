ALTER TABLE "employees" ADD COLUMN "portal_username" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "portal_password_hash" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "portal_username" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "portal_password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_portal_username" ON "employees" USING btree ("tenant_id","portal_username");--> statement-breakpoint
CREATE UNIQUE INDEX "students_portal_username" ON "students" USING btree ("tenant_id","portal_username");