import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { asc, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { openDb } from '../src/db/client';
import { categories } from '../src/db/schema';
import { as, testApp, upload } from './helpers';

// Каталог на телефоне грузился долго: карточки тянули оригиналы фото по 0,3–0,6 МБ. /files/:id?w= отдаёт WebP нужной ширины.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const owner = as(2001), anna = as(1001);

/** Фото как с телефона: 928×1152 JPEG почти без сжатия, с шумом, чтобы не сжималось в ничто. */
async function phonePhoto() {
  const noise = Buffer.alloc(928 * 1152 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
  return Buffer.from(await sharp(noise, { raw: { width: 928, height: 1152, channels: 3 } }).jpeg({ quality: 97 }).toBuffer());
}

describe('уменьшенные копии фото', () => {
  test('фото товара: ?w=480 — WebP шириной 480 и в разы легче, кеш на год; повтор берёт копию с диска', async () => {
    const orig = await phonePhoto();
    const u = upload(orig, 'photo.jpg', 'image/jpeg');
    const up = await t.app.inject({ method: 'POST', url: '/api/admin/categories/upload', payload: u.payload, headers: { ...u.headers, ...owner } });
    const path = new URL((up.json() as { url: string }).url).pathname;

    const full = await t.app.inject({ method: 'GET', url: path });
    assert.equal(full.headers['content-type'], 'image/jpeg');
    assert.equal(full.headers['cache-control'], 'public, max-age=31536000, immutable');

    const small = await t.app.inject({ method: 'GET', url: path + '?w=480' });
    assert.equal(small.statusCode, 200);
    assert.equal(small.headers['content-type'], 'image/webp');
    assert.equal(small.headers['cache-control'], 'public, max-age=31536000, immutable');
    const meta = await sharp(small.rawPayload).metadata();
    assert.deepEqual([meta.format, meta.width], ['webp', 480]);
    assert.ok(small.rawPayload.length * 4 < orig.length, `${small.rawPayload.length} против ${orig.length}`);
    assert.ok(existsSync(join(t.config.uploadDir, 'w', path.split('/').pop() + '-480.webp')));
    assert.deepEqual((await t.app.inject({ method: 'GET', url: path + '?w=480' })).rawPayload, small.rawPayload);

    // Меньшую картинку не растягиваем; ширину вне списка не делаем — отдаём оригинал.
    assert.equal((await sharp((await t.app.inject({ method: 'GET', url: path + '?w=960' })).rawPayload).metadata()).width, 928);
    const odd = await t.app.inject({ method: 'GET', url: path + '?w=333' });
    assert.equal(odd.headers['content-type'], 'image/jpeg');
  });

  test('приватный файл: без подписи 403 и с w; с подписью — копия, кеш короткий', async () => {
    const u = upload(await phonePhoto(), 'claim.jpg', 'image/jpeg');
    const f = (await t.app.inject({ method: 'POST', url: '/api/files?kind=claim', payload: u.payload, headers: { ...u.headers, ...anna } })).json() as { id: string; url: string };
    assert.equal((await t.app.inject({ method: 'GET', url: `/files/${f.id}?w=240` })).statusCode, 403);
    const r = await t.app.inject({ method: 'GET', url: new URL(f.url).pathname + new URL(f.url).search + '&w=240' });
    assert.equal(r.headers['content-type'], 'image/webp');
    assert.equal(r.headers['cache-control'], 'private, max-age=3600');
  });

  test('HEIC, который sharp не читает, отдаётся оригиналом', async () => {
    const heic = Buffer.from(Buffer.concat([Buffer.from('00000018', 'hex'), Buffer.from('ftypheic'), Buffer.alloc(64)]));
    const u = upload(heic, 'x.heic', 'image/heic');
    const f = (await t.app.inject({ method: 'POST', url: '/api/files?kind=claim', payload: u.payload, headers: { ...u.headers, ...anna } })).json() as { url: string };
    const r = await t.app.inject({ method: 'GET', url: new URL(f.url).pathname + new URL(f.url).search + '&w=480' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers['content-type'], 'image/heic');
  });
});

describe('миграция 0011: картинки категорий в WebP', () => {
  test('свои /assets/cat-*.png → .webp; загруженные фото и чужие адреса не трогаются', async () => {
    const { db, close } = await openDb({});
    await db.insert(categories).values([
      { id: 'tee', name: 'Футболки', img: '/assets/cat-tshirt.png', sort: 0 },
      { id: 'top', name: 'Верх', img: '/app/assets/cat-sweatshirt.png', sort: 1 },
      { id: 'bags', name: 'Сумки', img: 'https://images.unsplash.com/photo-1?w=220', sort: 2 },
      { id: 'acc', name: 'Аксессуары', img: 'https://x.test/files/00000000-0000-0000-0000-000000000000', sort: 3 },
      { id: 'under', name: 'Нижнее бельё', img: '', sort: 4 },
    ]);
    await db.execute(sql.raw(readFileSync(new URL('../drizzle/0011_category_webp.sql', import.meta.url), 'utf8')));
    const rows = await db.select().from(categories).orderBy(asc(categories.sort));
    assert.deepEqual(rows.map((r) => r.img), ['/assets/cat-tshirt.webp', '/app/assets/cat-sweatshirt.webp', 'https://images.unsplash.com/photo-1?w=220', 'https://x.test/files/00000000-0000-0000-0000-000000000000', '']);
    await close();
  });
});
