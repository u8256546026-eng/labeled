-- Несколько категорий у вещи (22 октября, просьба заказчика): основная — category_id, остальные — здесь.
ALTER TABLE "products" ADD COLUMN "extra_categories" text[] DEFAULT '{}'::text[] NOT NULL;
