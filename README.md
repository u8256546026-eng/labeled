# labeled — Telegram Mini App магазина одежды

Покупательская часть и режим администратора в одном Mini App, плюс свой сервер.

- `06-app/` — приложение: React + TypeScript + Vite. Без `VITE_API_URL` работает на моках (демо: `?demo`, `?staff=owner`), с ним — с сервером. Подробности — `06-app/README.md`.
- `07-server/` — API: Node + Fastify + Postgres (Drizzle), тесты API в `07-server/test/`. Подробности — `07-server/README.md`, выкладка — `07-server/deploy/README.md`.

Адрес сервера, домены, бот и аккаунт поддержки заменены заглушками (`<IP сервера>`, `example.com`, `your_bot`, `your_support`). Секреты задаются переменными окружения и в репозитории не хранятся. README ссылаются на внутренние документы проекта (`01-project/`, `design_handoff_labeled_tma/` и т. п.) — в репозиторий они не входят.

Люди, телефоны и адреса в моках и тестах выдуманы; фото в моках загружаются с Unsplash.
