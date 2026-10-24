import { buildApp } from './app';
import { loadConfig } from './config';
import { openDb } from './db/client';
import { seedDemo } from './db/seed';
import { refreshCbrRate } from './services/cbr';
import { purgeOrphanFiles } from './services/cleanup';
import { purgeJournal } from './services/journal';

const config = loadConfig();
const { db, close } = await openDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
if (process.env.SEED_DEMO === '1') await seedDemo(db);
await purgeJournal(db);
const app = await buildApp(db, config, { logger: true });
await app.listen({ port: config.port, host: config.host });

// Непривязанные загрузки покупателей — при запуске и раз в сутки. Сбой очистки не мешает работе API.
const cleanup = () => purgeOrphanFiles({ db, config, log: app.log }).catch((err) => app.log.warn({ err }, 'очистка загрузок'));
void cleanup();
setInterval(cleanup, 86400_000).unref();

// Курс юаня ЦБ — при запуске и каждый час. ЦБ публикует курс на следующий день заранее; сбой не мешает работе.
const cbr = () => refreshCbrRate({ db, log: app.log, url: config.cbrUrl }).catch((err) => app.log.warn({ err }, 'курс ЦБ'));
void cbr();
setInterval(cbr, 3600_000).unref();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => { await app.close(); await close(); process.exit(0); });
}
