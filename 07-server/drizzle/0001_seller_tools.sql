ALTER TABLE "banners" ADD COLUMN "cta" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN "cat" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_reason" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_due" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "weight_g" integer;