ALTER TABLE "students" ADD COLUMN "discount_type" text DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "discount_reason" text DEFAULT '' NOT NULL;