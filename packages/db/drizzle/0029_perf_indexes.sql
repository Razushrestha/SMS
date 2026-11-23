CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tenant_role_idx" ON "users" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_tenant_id_idx" ON "students" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_tenant_id_idx" ON "employees" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_tenant_date_idx" ON "attendance_records" USING btree ("tenant_id","attendance_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_payments_tenant_paid_idx" ON "fee_payments" USING btree ("tenant_id","paid_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_payments_tenant_student_idx" ON "fee_payments" USING btree ("tenant_id","student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfid_taps_tenant_tapped_idx" ON "rfid_taps" USING btree ("tenant_id","tapped_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_points_tenant_device_idx" ON "location_points" USING btree ("tenant_id","device_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_points_vehicle_device_idx" ON "location_points" USING btree ("vehicle_id","device_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_tenant_action_idx" ON "audit_events" USING btree ("tenant_id","action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_tenant_created_idx" ON "audit_events" USING btree ("tenant_id","created_at");
