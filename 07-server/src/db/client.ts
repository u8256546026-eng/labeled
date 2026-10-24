import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

// Миграции лежат в 07-server/drizzle: из исходников это ../../drizzle, из собранного dist/main.js — ../drizzle.
const migrationsFolder = process.env.MIGRATIONS_DIR
  ?? ['../../drizzle', '../drizzle'].map((p) => fileURLToPath(new URL(p, import.meta.url))).find((p) => existsSync(p + '/meta/_journal.json'))!;

/**
 * База: DATABASE_URL — настоящий Postgres (продукт); иначе PGlite — тот же Postgres в процессе,
 * в папке PGLITE_DIR или в памяти (тесты, разработка без установленного Postgres).
 */
export async function openDb(opts: { url?: string; pgliteDir?: string }): Promise<{ db: Db; close: () => Promise<void> }> {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url, max: 10 });
    const db = drizzlePg(pool, { schema, casing: 'snake_case' });
    await migratePg(db, { migrationsFolder });
    return { db, close: () => pool.end() };
  }
  const client = new PGlite(opts.pgliteDir);
  const db = drizzlePglite(client, { schema, casing: 'snake_case' });
  await migratePglite(db, { migrationsFolder });
  return { db, close: () => client.close() };
}
