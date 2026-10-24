ALTER TABLE "orders" ADD COLUMN "client_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "client_reply" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_client_key" ON "orders" USING btree ("user_id","client_key");