-- Журнал действий (adm33) неизменяем: правка запрещена, удалить можно только запись старше 12 месяцев.
CREATE OR REPLACE FUNCTION journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'journal entries cannot be changed';
  END IF;
  IF OLD.at > now() - interval '12 months' THEN
    RAISE EXCEPTION 'journal entries are kept for 12 months';
  END IF;
  RETURN OLD;
END
$$;
--> statement-breakpoint
CREATE TRIGGER journal_guard BEFORE UPDATE OR DELETE ON journal FOR EACH ROW EXECUTE FUNCTION journal_guard();
--> statement-breakpoint
CREATE TRIGGER journal_no_truncate BEFORE TRUNCATE ON journal FOR EACH STATEMENT EXECUTE FUNCTION journal_guard();
