import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { sql } from 'drizzle-orm';
import { journal } from '../src/db/schema';
import { purgeJournal } from '../src/services/journal';
import { as, req, testApp } from './helpers';

// adm33 — журнал действий, adm34 — разбиение заказа на посылки.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const owner = as(2001), manager = as(2011), stock = as(2012), dmitry = as(2005);

describe('adm33: журнал действий', () => {
  test('только владелец; запись с текстом, сотрудником и экраном объекта', async () => {
    assert.equal((await req(t.app, 'GET', '/api/admin/journal', manager)).status, 403);
    const r = await req(t.app, 'GET', '/api/admin/journal', owner);
    assert.equal(r.status, 200);
    const list = r.json as { who: string; whoName: string; whoRole: string; type: string; text: string; obj: string; to?: string; at: string }[];
    assert.ok(list.length >= 8);
    const stage = list.find((x) => x.text.includes('На складе в Китае'))!;
    assert.deepEqual([stage.whoName, stage.whoRole, stage.type, stage.obj, stage.to], ['Артём', 'stock', 'orders', 'Заказ 1040', '/admin/order/1040']);
    const rate = list.find((x) => x.type === 'prices')!;
    assert.equal(rate.text, 'Изменён курс ЦБ: 11,48 → 11,62 ₽');
    const times = list.map((x) => Date.parse(x.at));
    assert.deepEqual(times, times.slice().sort((a, b) => b - a), 'новые сверху');
  });

  test('фильтр по сотруднику и типу; новое действие сразу в журнале', async () => {
    const st = (await req(t.app, 'GET', '/api/admin/journal?type=stock', owner)).json as { type: string }[];
    assert.ok(st.length && st.every((x) => x.type === 'stock'));
    const liza = (await req(t.app, 'GET', '/api/admin/journal?who=4', owner)).json as { whoName: string }[];
    assert.ok(liza.length && liza.every((x) => x.whoName === 'Лиза'));
    assert.equal((await req(t.app, 'GET', '/api/admin/journal?type=nope', owner)).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/admin/payments/p-1041/confirm', manager)).status, 200);
    const top = (await req(t.app, 'GET', '/api/admin/journal', owner)).json[0];
    assert.deepEqual([top.whoName, top.whoRole, top.type, top.text.replace(/\s/g, ' '), top.obj, top.to], ['Ксения', 'manager', 'pay', 'Подтверждена оплата товаров · 14 380 ₽', 'Заказ 1041', '/admin/pay/p-1041']);
  });

  test('записи нельзя изменить или удалить; старше 12 месяцев удаляются', async () => {
    await assert.rejects(t.db.execute(sql`update journal set action = 'x'`));
    await assert.rejects(t.db.execute(sql`delete from journal`));
    await assert.rejects(t.db.execute(sql`truncate journal`));
    const before = (await t.db.select().from(journal)).length;
    await t.db.insert(journal).values({ staffId: 1, action: 'order.stage', target: '1040', at: new Date(Date.now() - 400 * 86400_000) });
    const old = (await req(t.app, 'GET', '/api/admin/journal', owner)).json as { at: string }[];
    assert.ok(old.every((x) => Date.now() - Date.parse(x.at) < 366 * 86400_000));
    await purgeJournal(t.db);
    assert.equal((await t.db.select().from(journal)).length, before);
  });
});

describe('adm34: разбиение на посылки', () => {
  const ids = async () => ((await req(t.app, 'GET', '/api/admin/orders/1040', owner)).json.items as { id: string }[]).map((x) => Number(x.id));
  const put = (who: Record<string, string>, groups: number[][], num = '1040') => req(t.app, 'PUT', `/api/admin/orders/${num}/parcels`, who, { groups });

  test('проверки: права, этап, пустая посылка, до 4, каждая вещь один раз', async () => {
    const [a, b] = await ids();
    assert.equal((await put(stock, [[a], [b]])).status, 200, 'склад ведёт заказы');
    assert.equal((await put(as(2013), [[a], [b]])).status, 403);
    assert.equal((await put(owner, [[a], []])).status, 400);
    assert.equal((await put(owner, [[a], [b], [a]])).status, 400, 'посылок не больше, чем вещей');
    assert.equal((await put(owner, [[a]])).status, 400, 'вещь без посылки');
    assert.equal((await put(owner, [[a, a], [b]])).status, 400);
    assert.equal((await put(owner, [[1], [2]], '1042')).status, 409, 'не на складе в Китае');
  });

  test('сохранение: покупатель видит посылки; посылку со счётом менять нельзя', async () => {
    const [a, b] = await ids();
    assert.equal((await put(manager, [[b], [a]])).status, 200);
    let o = (await req(t.app, 'GET', '/api/admin/orders/1040', owner)).json;
    assert.deepEqual(o.parcels.map((p: { items: string[] }) => p.items), [[String(b)], [String(a)]]);
    const buyer = (await req(t.app, 'GET', '/api/orders/1040', dmitry)).json;
    assert.deepEqual(buyer.parcels.map((p: { title: string }) => p.title), ['Посылка 1 из 2', 'Посылка 2 из 2']);

    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1040/parcels/1/bill', owner, { weight: 1.1, amount: 1700 })).status, 200);
    const r = await put(owner, [[a, b]]);
    assert.equal(r.status, 409); assert.equal(r.json.error, 'parcel_locked');
    assert.equal((await put(owner, [[b], [a]])).status, 200, 'заблокированная посылка без изменений — можно');
    o = (await req(t.app, 'GET', '/api/admin/orders/1040', owner)).json;
    assert.deepEqual(o.parcels.map((p: { billed: boolean }) => p.billed), [true, false]);

    const log = (await req(t.app, 'GET', '/api/admin/journal?type=stock', owner)).json[0];
    assert.deepEqual([log.text, log.obj], ['Заказ разбит на 2 посылки', 'Заказ 1040']);
  });
});
