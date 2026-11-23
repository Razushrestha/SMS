ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'platform';--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'suspended', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "plan_name" text DEFAULT 'Core' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "status" "public"."subscription_status" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "expires_on" date;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
