import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, req, testApp, upload } from './helpers';

type PNG_T = Parameters<typeof upload>[0];

/** Регрессии по аудиту 2026-10-08: каждая проверка падала до исправления. */
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const anna = as(1001), elena = as(2006), owner = as(2001);

const upFile = async (url: string, who: Record<string, string>) => {
  const up = upload();
  return t.app.inject({ method: 'POST', url, headers: { ...who, ...up.headers }, payload: up.payload });
};

describe('заказ из наличия', () => {
  test('одна вещь дважды в заказе — 409 sold, остаток не уходит в минус', async () => {
    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    const o = p.offers.find((x: { stock: number }) => x.stock === 1);
    const addr = (await req(t.app, 'GET', '/api/addresses', anna)).json[0].id;
    const line = { offerId: o.id, qty: 1, price: o.price };
    const r = await req(t.app, 'POST', '/api/orders', anna, { lines: [line, line], pointsOff: 0, delivery: { mode: 'pvz', pvz: 'p1', slot: 1 }, addressId: addr });
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.equal(r.json.error, 'sold');
    const after = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    assert.equal(after.offers.find((x: { id: string }) => x.id === o.id)?.stock, 1);
  });
  test('проверка корзины видит дубль той же вещи как проданную', async () => {
    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    const o = p.offers.find((x: { stock: number }) => x.stock === 1);
    const line = { key: 'a', itemId: 'tee', offerId: o.id, name: p.name, img: '', params: '', cond: o.cond, price: o.price, qty: 1 };
    const r = await req(t.app, 'POST', '/api/checkout/validate', anna, { lines: [line, { ...line, key: 'b' }] });
    assert.equal(r.status, 200);
    assert.ok(r.json.some((l: { sold?: boolean }) => l.sold), JSON.stringify(r.json));
  });
});

describe('оплата отменённого заказа', () => {
  test('подтверждение перевода после отмены продавцом не возвращает заказ в работу — появляется возврат', async () => {
    await upFile('/api/payments/p-1045/receipt', anna);
    assert.equal((await req(t.app, 'POST', '/api/payments/p-1045/transferred', anna)).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1045/cancel', owner, { why: 0 })).status, 200);
    const c = await req(t.app, 'POST', '/api/admin/payments/p-1045/confirm', owner);
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const o = (await req(t.app, 'GET', '/api/admin/orders/1045', owner)).json;
    const mine = (await req(t.app, 'GET', '/api/orders/1045', anna)).json;
    assert.notEqual(mine.group, 'active', JSON.stringify(mine));
    const tasks = (await req(t.app, 'GET', '/api/admin/tasks', owner)).json as { id: string; amount?: number }[];
    const refund = tasks.find((x) => x.id === 'refund-1045');
    assert.ok(refund, 'нет задачи на возврат: ' + JSON.stringify(o));
    assert.equal(refund.amount, 9800);
  });
});

describe('чужие файлы', () => {
  test('нельзя приложить к отзыву или обращению файл другого покупателя', async () => {
    const f = (await upFile('/api/files?kind=claim', anna)).json() as { id: string };
    const claim = (fileIds: string[]) => req(t.app, 'POST', '/api/claims', elena, { orderNum: '1039', reason: 0, text: 'Шов разошёлся', fileIds });
    const r = await claim([f.id]);
    assert.equal(r.status, 400, JSON.stringify(r.json));
    const review = (await upFile('/api/files?kind=review', elena)).json() as { id: string };
    assert.equal((await claim([review.id])).status, 400, 'файл отзыва не подходит к обращению');
    const own = (await upFile('/api/files?kind=claim', elena)).json() as { id: string };
    const ok = await claim([own.id]);
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
  });
});

describe('ввод', () => {
  test('нечисловой id в пути — 400/404, а не 500', async () => {
    for (const [m, u, who] of [['DELETE', '/api/addresses/abc', anna], ['POST', '/api/claims/abc/photos', anna], ['GET', '/api/admin/buyers/abc', owner], ['POST', '/api/orders/1045/cancel', as(Number.NaN)]] as const) {
      const r = await req(t.app, m, u, who, m === 'POST' ? {} : undefined);
      assert.ok(r.status < 500, `${m} ${u}: ${r.status} ${JSON.stringify(r.json)}`);
    }
  });
});

describe('сообщения бота', () => {
  test('параллельные рассылки не отправляют событие дважды; отказ 403 не повторяется', async () => {
    const { createServer } = await import('node:http');
    const { eq } = await import('drizzle-orm');
    const { events, users } = await import('../src/db/schema');
    const { flushNotifications, flushPending } = await import('../src/services/core');
    const { fileStore } = await import('../src/files');
    const sent: number[] = [];
    let status = 200;
    const srv = createServer((rq, rs) => {
      let b = '';
      rq.on('data', (c) => { b += c; });
      rq.on('end', () => setTimeout(() => { sent.push(JSON.parse(b).chat_id); rs.writeHead(status, { 'content-type': 'application/json' }).end('{}'); }, 50));
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    try {
      const port = (srv.address() as { port: number }).port;
      const config = { ...t.config, botMessages: true, telegramApi: `http://127.0.0.1:${port}` };
      const log = { warn: () => {}, info: () => {}, error: () => {} } as never;
      const ctx = { db: t.db, config, files: fileStore(t.db, config), log, limit: () => {}, mail: null };
      const [u] = await t.db.insert(users).values({ tgId: 55501, tgName: 'Бот', name: 'Бот', notif: { bot: true, req: true, pay: true, ship: true, pts: true, promo: false, mail: false }, botAllowed: true }).returning();
      await t.db.update(events).set({ notifiedAt: new Date() }); // чужие события демо-данных не мешают подсчёту
      await t.db.insert(events).values({ userId: u.id, kind: 'pts', channel: 'pts', title: '+250 баллов', to: '/points' });
      await Promise.all([flushNotifications(ctx, u.id), flushPending(ctx), flushNotifications(ctx, u.id)]);
      assert.deepEqual(sent, [55501]);

      status = 403;
      const [e] = await t.db.insert(events).values({ userId: u.id, kind: 'pay', channel: 'pay', title: 'Оплата', to: '/order/1' }).returning();
      await flushNotifications(ctx, u.id);
      await flushNotifications(ctx, u.id);
      assert.equal(sent.length, 3 - 1, 'после 403 событие больше не отправляется');
      assert.ok((await t.db.select().from(events).where(eq(events.id, e.id)))[0].notifiedAt);
    } finally {
      srv.close();
    }
  });
});

describe('настройки входа', () => {
  test('x-dev-user выключен в production и при заданном BOT_TOKEN; срок initData не отключается нулём', async () => {
    const { loadConfig } = await import('../src/config');
    assert.equal(loadConfig({} as NodeJS.ProcessEnv).devAuth, true);
    assert.equal(loadConfig({ BOT_TOKEN: 'x' } as NodeJS.ProcessEnv).devAuth, false);
    assert.equal(loadConfig({ BOT_TOKEN: 'x', DEV_AUTH: '1' } as NodeJS.ProcessEnv).devAuth, true);
    assert.equal(loadConfig({ DEV_AUTH: '0' } as NodeJS.ProcessEnv).devAuth, false);
    const prod = { NODE_ENV: 'production', BOT_TOKEN: 'x', DATABASE_URL: 'postgres://x', FILE_SECRET: 'y', DEV_AUTH: '1' } as NodeJS.ProcessEnv;
    assert.equal(loadConfig(prod).devAuth, false);
    assert.equal(loadConfig({ ...prod, INIT_DATA_TTL: '0' }).initDataTtl, 86400);
    assert.equal(loadConfig({ ...prod, INIT_DATA_TTL: '3600' }).initDataTtl, 3600);
  });
});

describe('сводка adm25', () => {
  test('период начинается с полуночи по Москве при любом поясе сервера', async () => {
    const { summaryFrom } = await import('../src/services/admin');
    const now = new Date('2026-10-08T22:30:00Z'); // в Москве уже 9 октября, 01:30
    assert.equal(summaryFrom('day', now).toISOString(), '2026-10-08T21:00:00.000Z');
    assert.equal(summaryFrom('week', now).toISOString(), '2026-10-02T21:00:00.000Z');
    assert.equal(summaryFrom('month', now).toISOString(), '2026-09-30T21:00:00.000Z');
  });
});

describe('загрузка файлов', () => {
  test('HEIC принимается, видео MP4 под видом фото — нет; файл отдаётся с nosniff', async () => {
    const box = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftyp' + brand), Buffer.alloc(16)]);
    const send = (buf: Buffer) => { const up = upload(buf as PNG_T, 'x.heic', 'image/heic'); return t.app.inject({ method: 'POST', url: '/api/files?kind=claim', headers: { ...anna, ...up.headers }, payload: up.payload }); };
    const heic = await send(box('heic'));
    assert.equal(heic.statusCode, 200, heic.body);
    assert.equal((await send(box('isom'))).statusCode, 400);
    const file = await t.app.inject({ method: 'GET', url: (heic.json() as { url: string }).url.replace('http://api.test', '') });
    assert.equal(file.headers['x-content-type-options'], 'nosniff');
  });
});
