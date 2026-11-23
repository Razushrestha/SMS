ALTER TABLE "users" ADD COLUMN "verification_token_hash" text;
ALTER TABLE "users" ADD COLUMN "verification_expires_at" timestamp with time zone;
