-- Картинки категорий из комплекта приложения переведены из PNG (~300 КБ) в WebP (~5 КБ), каталог на телефоне грузился долго.
-- Меняем только свои /assets/cat-*.png; фото, загруженные сотрудником через админку (/files/…), не трогаем.
UPDATE "categories" SET "img" = regexp_replace("img", '^(.*/assets/cat-[a-z0-9-]+)\.png$', '\1.webp') WHERE "img" ~ '/assets/cat-[a-z0-9-]+\.png$';
