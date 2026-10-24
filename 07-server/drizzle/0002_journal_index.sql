CREATE INDEX "journal_at" ON "journal" USING btree ("at");--> statement-breakpoint
CREATE INDEX "journal_staff" ON "journal" USING btree ("staff_id","at");