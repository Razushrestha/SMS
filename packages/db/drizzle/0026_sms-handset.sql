ALTER TABLE "sms_accounts" ADD COLUMN "pairing_token_hash" text;
ALTER TABLE "sms_accounts" ADD COLUMN "pairing_expires_at" timestamp with time zone;
ALTER TABLE "sms_accounts" ADD COLUMN "paired_at" timestamp with time zone;
ALTER TABLE "sms_accounts" ADD COLUMN "handset_name" text;
