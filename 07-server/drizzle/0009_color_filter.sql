-- Цвет фильтра у расцветок (22 октября): админка записывала всем вещам «black», поэтому белая вещь не находилась фильтром «Белый».
-- Теперь цвет фильтра — по названию цвета из справочника (06-app/src/mocks/catalog.ts, COLORS и colorFilter). Неизвестные названия не трогаем.
UPDATE "products" SET "colors" = (
  SELECT jsonb_agg(c || jsonb_build_object('filter', CASE btrim(c->>'name')
    WHEN 'Чёрный' THEN 'black' WHEN 'Белый' THEN 'white' WHEN 'Молочный' THEN 'white' WHEN 'Серый' THEN 'grey'
    WHEN 'Бежевый' THEN 'beige' WHEN 'Коричневый' THEN 'brown' WHEN 'Синий' THEN 'blue'
    WHEN 'Красный' THEN 'red' WHEN 'Кирпичный' THEN 'red' WHEN 'Зелёный' THEN 'green'
    ELSE c->>'filter' END) ORDER BY n)
  FROM jsonb_array_elements("colors") WITH ORDINALITY AS t(c, n)
) WHERE jsonb_array_length("colors") > 0;
