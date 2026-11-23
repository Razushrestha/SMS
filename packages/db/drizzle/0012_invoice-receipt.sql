ALTER TABLE "fee_invoices" ADD COLUMN "receipt_no" text;--> statement-breakpoint
UPDATE "fee_invoices" SET "receipt_no" = 'INV-' || upper(substr(replace("id"::text, '-', ''), 1, 8)) WHERE "receipt_no" IS NULL;--> statement-breakpoint
ALTER TABLE "fee_invoices" ALTER COLUMN "receipt_no" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_invoice_receipt" ON "fee_invoices" USING btree ("tenant_id","receipt_no");
