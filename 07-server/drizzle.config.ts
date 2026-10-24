import { defineConfig } from 'drizzle-kit';

// Миграции генерируются из src/db/schema.ts: npm run db:generate. Применяются при старте сервера.
export default defineConfig({ dialect: 'postgresql', schema: './src/db/schema.ts', out: './drizzle', casing: 'snake_case' });
