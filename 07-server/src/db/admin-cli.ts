// Служебные команды для рабочей базы (без демо-данных):
//   node dist/admin-cli.js init                 — категории и стандартные баннеры главной, если их ещё нет;
//   node dist/admin-cli.js owner <tgId|@username> — сделать пользователя владельцем.
// Владелец должен один раз открыть Mini App и войти (P), чтобы появиться в базе.
import { eq, sql } from 'drizzle-orm';
import { CATEGORIES } from '../../../06-app/src/mocks/catalog';
import { loadConfig } from '../config';
import { openDb } from './client';
import { banners, categories, staff, users } from './schema';

const [cmd, arg] = process.argv.slice(2);
const config = loadConfig();
const { db, close } = await openDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });

try {
  if (cmd === 'init') {
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(categories);
    if (Number(c.n) === 0) {
      await db.insert(categories).values(CATEGORIES.map((x, i) => ({ id: x.id, name: x.name, img: x.img, sort: i })));
      console.log(`Категории: ${CATEGORIES.length}`);
    } else console.log('Категории уже есть — пропущено');
    const [b] = await db.select({ n: sql<number>`count(*)::int` }).from(banners);
    if (Number(b.n) === 0) {
      await db.insert(banners).values([
        { title: 'Заказать из-за границы', cta: 'Оформить заказ', target: 'link', sort: 0 },
        { title: '−50% на комиссию первого заказа', cta: 'Подробнее', target: 'email', sort: 1 },
        { title: '250 баллов за друга', cta: 'Пригласить друга', target: 'invite', sort: 2 },
      ]);
      console.log('Баннеры: 3');
    } else console.log('Баннеры уже есть — пропущено');
  } else if (cmd === 'owner' && arg) {
    const where = arg.startsWith('@') ? eq(users.username, arg.slice(1)) : eq(users.tgId, Number(arg));
    const [u] = await db.select().from(users).where(where);
    if (!u) {
      console.error('Пользователь не найден: пусть сначала откроет Mini App и войдёт.');
      process.exitCode = 1;
    } else {
      await db.insert(staff).values({ userId: u.id, role: 'owner' })
        .onConflictDoUpdate({ target: staff.userId, set: { role: 'owner', perms: null, removedAt: null } });
      console.log(`Владелец: ${u.name} (tg ${u.tgId})`);
    }
  } else {
    console.error('Команды: init | owner <tgId|@username>');
    process.exitCode = 1;
  }
} finally {
  await close();
}
