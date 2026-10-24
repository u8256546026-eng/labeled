CREATE SEQUENCE "public"."order_num_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1048 CACHE 1;--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"line" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"target" text NOT NULL,
	"sub" text DEFAULT '' NOT NULL,
	"img" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"img" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_id" integer NOT NULL,
	"from" text NOT NULL,
	"staff_id" integer,
	"text" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" bigint NOT NULL,
	"reason" integer NOT NULL,
	"topic" text NOT NULL,
	"text" text NOT NULL,
	"file_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"answer" text,
	"answer_text" text,
	"refund_sum" integer,
	"refund" jsonb,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"title" text NOT NULL,
	"sub" text DEFAULT '' NOT NULL,
	"act" text,
	"to" text NOT NULL,
	"read_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" bigint NOT NULL,
	"product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" bigint,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"path" text NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"action" text NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"form" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"color" text NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"cond" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"img" text DEFAULT '' NOT NULL,
	CONSTRAINT "stock_nonneg" CHECK ("offers"."stock" >= 0),
	CONSTRAINT "price_pos" CHECK ("offers"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"label" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"staff_id" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"offer_id" text,
	"name" text NOT NULL,
	"params" text DEFAULT '' NOT NULL,
	"img" text DEFAULT '' NOT NULL,
	"cond" text,
	"price" integer DEFAULT 0 NOT NULL,
	"qty" integer NOT NULL,
	"plat" text,
	"url" text,
	"size" text,
	"price_cny" integer,
	"old_price_cny" integer,
	"photo" boolean DEFAULT false NOT NULL,
	"box" boolean DEFAULT false NOT NULL,
	"pic_file_id" text,
	"removed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "qty_pos" CHECK ("order_items"."qty" >= 1)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"num" text NOT NULL,
	"user_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"phase" text NOT NULL,
	"stage" integer DEFAULT 0 NOT NULL,
	"address" jsonb,
	"delivery" jsonb,
	"goods" integer DEFAULT 0 NOT NULL,
	"commission" integer DEFAULT 0 NOT NULL,
	"services" integer DEFAULT 0 NOT NULL,
	"protection" integer DEFAULT 0 NOT NULL,
	"points_used" integer DEFAULT 0 NOT NULL,
	"comm_discount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"rates_snapshot" jsonb,
	"protect" boolean DEFAULT false NOT NULL,
	"ship_mode" text DEFAULT 'all' NOT NULL,
	"change_comment" text,
	"reject_reason" integer,
	"reject_note" text,
	"cancel_requested_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_num_unique" UNIQUE("num")
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"n" integer NOT NULL,
	"title" text NOT NULL,
	"state" text NOT NULL,
	"track" text,
	"item_ids" integer[] DEFAULT '{}'::int[] NOT NULL,
	"waiting_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"parcel_id" integer,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"state" text DEFAULT 'empty' NOT NULL,
	"receipt_file_id" text,
	"sent_at" timestamp with time zone,
	"checked_at" timestamp with time zone,
	"checked_by" integer,
	"fail_reason" integer,
	"fail_note" text,
	"seller_receipt_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amount_pos" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "photo_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"place" text DEFAULT 'склад в Китае' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_reports_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"delta" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"order_id" integer,
	"friend_id" bigint,
	"staff_id" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"category_id" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"size_grid" text[] DEFAULT '{}'::text[] NOT NULL,
	"colors" jsonb NOT NULL,
	"preorder" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"size_chart" text,
	"visible" boolean DEFAULT true NOT NULL,
	"preorder_allowed" boolean DEFAULT false NOT NULL,
	"pop" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"order_id" integer,
	"signature" text NOT NULL,
	"stars" integer NOT NULL,
	"text" text NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"file_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"state" text DEFAULT 'mod' NOT NULL,
	"reply" text,
	"moderated_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "stars_range" CHECK ("reviews"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "size_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"product_id" text NOT NULL,
	"color" text NOT NULL,
	"size" text NOT NULL,
	"state" text DEFAULT 'review' NOT NULL,
	"price" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"role" text NOT NULL,
	"perms" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "staff_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_invites" (
	"code" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"created_by" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by" bigint,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tg_id" bigint NOT NULL,
	"username" text,
	"tg_name" text NOT NULL,
	"name" text NOT NULL,
	"photo_url" text,
	"consent_at" timestamp with time zone,
	"email" text,
	"email_state" text DEFAULT 'none' NOT NULL,
	"email_token" text,
	"notif" jsonb DEFAULT '{"bot":true,"req":true,"pay":true,"ship":true,"pts":false,"promo":false,"mail":false}'::jsonb NOT NULL,
	"bot_allowed" boolean DEFAULT false NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"referrer_id" bigint,
	"first_discount_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_tg_id_unique" UNIQUE("tg_id"),
	CONSTRAINT "points_nonneg" CHECK ("users"."points" >= 0)
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_messages" ADD CONSTRAINT "claim_messages_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_drafts" ADD CONSTRAINT "link_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_reports" ADD CONSTRAINT "photo_reports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "size_requests" ADD CONSTRAINT "size_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "size_requests" ADD CONSTRAINT "size_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "claims_order" ON "claims" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "events_user" ON "events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "offers_product" ON "offers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_history_order" ON "order_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_user" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_phase" ON "orders" USING btree ("phase");--> statement-breakpoint
CREATE UNIQUE INDEX "parcels_order_n" ON "parcels" USING btree ("order_id","n");--> statement-breakpoint
CREATE INDEX "payments_state" ON "payments" USING btree ("state");--> statement-breakpoint
CREATE INDEX "points_user" ON "points_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "points_referral_once" ON "points_ledger" USING btree ("friend_id") WHERE kind = 'referral';