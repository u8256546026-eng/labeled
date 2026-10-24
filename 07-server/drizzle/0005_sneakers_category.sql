-- Категория «Кроссовки» (просьба заказчика 9 октября) — после «Штанов». Только в базе, где категории уже есть:
-- пустую базу заполняют seed или admin-cli init полным списком, где «Кроссовки» уже на месте.
WITH ins AS (
  INSERT INTO "categories" ("id", "name", "img", "sort")
  SELECT 'sneakers', 'Кроссовки', '', 3
  WHERE EXISTS (SELECT 1 FROM "categories") AND NOT EXISTS (SELECT 1 FROM "categories" WHERE "id" = 'sneakers' OR lower("name") = 'кроссовки')
  RETURNING "id"
)
UPDATE "categories" SET "sort" = "sort" + 1 WHERE "sort" >= 3 AND "id" <> 'sneakers' AND EXISTS (SELECT 1 FROM ins);
