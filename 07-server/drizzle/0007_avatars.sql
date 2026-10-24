-- Аватарки на своём сервере (services/avatars.ts): файл аватарки и время последней проверки в Telegram.
ALTER TABLE "users" ADD COLUMN "avatar_file_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_checked_at" timestamp with time zone;