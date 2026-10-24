import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { files } from '../src/db/schema';
import { rateLimiter } from '../src/limits';
import { purgeOrphanFiles } from '../src/services/cleanup';
import { as, req, testApp, upload } from './helpers';

/** Пределы покупателя и очистка непривязанных загрузок (аудит 2026-10-08, второй проход). */
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const anna = as(1001), elena = as(2006);
const upFile = (url: string, who: Record<string, string>) => { const up = upload(); return t.app.inject({ method: 'POST', url, headers: { ...who, ...up.headers }, payload: up.payload }); };
const fileCount = async () => (await t.db.select().from(files)).length;

describe('ограничение частоты', () => {
  test('сверх предела — 429 с объяснением; окно сдвигается', () => {
    let now = 0;
    const limit = rateLimiter(() => now);
    limit('a', 2, 1000); limit('a', 2, 1000);
    assert.throws(() => limit('a', 2, 1000), (e: { status: number; message: string }) => e.status === 429 && /попробуйте позже/.test(e.message));
    limit('b', 2, 1000); // другой ключ не затронут
    now = 1001;
    limit('a', 2, 1000);
  });
  test('загрузки покупателя ограничены по времени', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 61; i++) codes.push((await upFile('/api/files?kind=claim', elena)).statusCode);
    assert.deepEqual([...new Set(codes.slice(0, 60))], [200]);
    assert.equal(codes[60], 429);
  });
});

describe('чек к платежу', () => {
  test('чек к чужому платежу — 404, файл не сохраняется', async () => {
    const n = await fileCount();
    const r = await upFile('/api/payments/p-1044/receipt', anna); // заказ 1044 — Олега
    assert.equal(r.statusCode, 404, r.body);
    assert.equal(await fileCount(), n);
  });
});

describe('черновики и заявки на размер', () => {
  test('не больше 20 черновиков; правка существующего проходит', async () => {
    const form = { title: 'Ч', items: [], protect: false, ship: 'all', disc: 'none', dirty: false };
    const have = (await req(t.app, 'GET', '/api/link/drafts', anna)).json.length;
    for (let i = have; i < 20; i++) assert.equal((await req(t.app, 'PUT', `/api/link/drafts/x${i}`, anna, form)).status, 200);
    const over = await req(t.app, 'PUT', '/api/link/drafts/x-over', anna, form);
    assert.equal(over.status, 409);
    assert.match(over.json.message, /не больше 20/);
    assert.equal((await req(t.app, 'PUT', '/api/link/drafts/x19', anna, { ...form, title: 'Новое' })).status, 200);
    assert.equal((await req(t.app, 'PUT', '/api/link/drafts/x19', anna, { ...form, title: 'x'.repeat(70_000) })).status, 400);
  });
  test('фото позиции в черновике получает свежую ссылку; чужой файл — нет', async () => {
    const mine = (await upFile('/api/files?kind=link_item', anna)).json() as { id: string };
    const other = (await upFile('/api/files?kind=link_item', as(2003))).json() as { id: string };
    const form = { title: 'Фото', protect: false, ship: 'all', disc: 'none', dirty: false, items: [{ key: 'a', pic: { name: 'a', meta: '', fileId: mine.id, preview: 'old' } }, { key: 'b', pic: { name: 'b', meta: '', fileId: other.id, preview: 'old' } }] };
    await req(t.app, 'DELETE', '/api/link/drafts/x0', anna);
    assert.equal((await req(t.app, 'PUT', '/api/link/drafts/photo', anna, form)).status, 200);
    const d = (await req(t.app, 'GET', '/api/link/drafts', anna)).json.find((x: { id: string }) => x.id === 'photo');
    assert.match(d.form.items[0].pic.preview, new RegExp(`/files/${mine.id}\\?e=`));
    assert.equal(d.form.items[1].pic.preview, 'old');
  });
  test('повтор заявки на тот же размер возвращает прежнюю', async () => {
    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    // Размер из сетки вещи: вне сетки сервер заявку не примет.
    const body = { productId: p.id, color: 'Чёрный', size: p.sizeGrid[p.sizeGrid.length - 1] };
    const a = await req(t.app, 'POST', '/api/size-requests', anna, body);
    const b = await req(t.app, 'POST', '/api/size-requests', anna, body);
    assert.equal(a.status, 200, JSON.stringify(a.json));
    assert.equal(b.json.id, a.json.id);
  });
});

describe('очистка загрузок', () => {
  test('удаляются только старые загрузки покупателей без ссылок; файл исчезает с диска', async () => {
    const orphan = (await upFile('/api/files?kind=review', anna)).json() as { id: string };
    const inDraft = (await req(t.app, 'GET', '/api/link/drafts', anna)).json.find((x: { id: string }) => x.id === 'photo').form.items[0].pic.fileId as string;
    const claimFile = (await upFile('/api/files?kind=claim', as(2003))).json() as { id: string };
    const pay = (await req(t.app, 'GET', '/api/payments', anna)).json.find((x: { state: string }) => x.state === 'empty' || x.state === 'fail');
    assert.equal((await upFile(`/api/payments/${pay.id}/receipt`, anna)).statusCode, 200);
    const log = { info: () => {}, warn: () => {} } as never;
    const later = new Date(Date.now() + 8 * 86400_000);
    assert.equal(await purgeOrphanFiles({ db: t.db, config: t.config, log }), 0, 'свежие файлы не трогаются');
    const [fresh] = await t.db.select().from(files).where(eq(files.id, orphan.id));
    assert.ok(existsSync(join(t.config.uploadDir, fresh.path)));
    const removed = await purgeOrphanFiles({ db: t.db, config: t.config, log }, later);
    assert.ok(removed > 0);
    const left = new Set((await t.db.select({ id: files.id }).from(files)).map((f) => f.id));
    assert.ok(!left.has(orphan.id), 'непривязанный отзыв удалён');
    assert.ok(!existsSync(join(t.config.uploadDir, fresh.path)), 'файл удалён с диска');
    assert.ok(left.has(inDraft), 'файл из черновика остаётся');
    assert.ok(!left.has(claimFile.id), 'фото без обращения удалено');
    const receipts = (await t.db.select().from(files).where(eq(files.kind, 'receipt')));
    assert.ok(receipts.length > 0 && receipts.every((f) => left.has(f.id)), 'чеки платежей остаются');
  });
});
