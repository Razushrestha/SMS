ALTER TABLE "tenant_plans" ADD COLUMN "assistant_token_quota" integer DEFAULT 20000 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD COLUMN "assistant_tokens_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_plans" ADD COLUMN "assistant_period" text DEFAULT '' NOT NULL;