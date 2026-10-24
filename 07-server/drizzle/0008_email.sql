-- Почта (services/mail.ts): время письма подтверждения — для срока ссылки; отметка письма о событии.
ALTER TABLE "users" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "mailed_at" timestamp with time zone;--> statement-breakpoint
-- События до подключения почты письмом не отправляем.
UPDATE "events" SET "mailed_at" = now();
