import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, initData, req, testApp, upload } from './helpers';

let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const anna = as(1001);
const owner = as(2001);

describe('вход', () => {
  test('без Telegram — 401, поддельный initData — 401', async () => {
    assert.equal((await req(t.app, 'GET', '/api/me', {})).status, 401);
    assert.equal((await req(t.app, 'POST', '/api/session', { authorization: 'tma user=%7B%22id%22%3A1%7D&hash=00' })).json.error, 'bad_init_data');
  });
  test('новый покупатель — только с согласием (P); подпись initData проверяется токеном бота', async () => {
    const h = { authorization: initData({ id: 777, first_name: 'Вера', username: 'vera' }) };
    assert.equal((await req(t.app, 'POST', '/api/session', h, {})).json.error, 'consent_required');
    const s = await req(t.app, 'POST', '/api/session', h, { consent: true });
    assert.equal(s.status, 200);
    assert.equal(s.json.user.name, 'Вера');
    assert.equal(s.json.firstLogin, true);
    assert.equal(s.json.staff, null);
  });
  test('просроченный initData — 401', async () => {
    const h = { authorization: initData({ id: 777, first_name: 'Вера' }, undefined, new Date(Date.now() - 3 * 86400000)) };
    assert.equal((await req(t.app, 'GET', '/api/me', h)).status, 401);
  });
});

describe('каталог', () => {
  test('выдача, фильтр, карточка, поиск', async () => {
    const all = await req(t.app, 'GET', '/api/catalog', {});
    assert.equal(all.status, 200);
    assert.ok(all.json.total >= 12 && all.json.items.length === 12 && all.json.hasMore);
    const f = encodeURIComponent(JSON.stringify({ cats: ['tee'], sort: 'cheap' }));
    const tees = await req(t.app, 'GET', '/api/catalog?f=' + f, {});
    assert.ok(tees.json.items.every((i: { cat: string }) => i.cat === 'tee'));
    const p = await req(t.app, 'GET', '/api/products/tee', {});
    assert.equal(p.json.name, 'Футболка с принтом');
    assert.ok(p.json.offers.every((o: { stock: number }) => o.stock > 0));
    assert.ok((await req(t.app, 'GET', '/api/search?q=' + encodeURIComponent('футболка'), {})).json.length >= 2);
  });
});

describe('заказ из наличия', () => {
  let num = '';
  test('цена изменилась или вещь продана — 409; больше 30% баллами — 400', async () => {
    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    const o = p.offers[0];
    const addr = (await req(t.app, 'GET', '/api/addresses', anna)).json[0].id;
    const body = (x: object) => ({ lines: [{ offerId: o.id, qty: 1, price: o.price }], pointsOff: 0, delivery: { mode: 'pvz', pvz: 'p1', slot: 1 }, addressId: addr, ...x });
    assert.equal((await req(t.app, 'POST', '/api/orders', anna, body({ lines: [{ offerId: o.id, qty: 1, price: o.price - 1 }] }))).json.error, 'price_changed');
    assert.equal((await req(t.app, 'POST', '/api/orders', anna, body({ lines: [{ offerId: o.id, qty: 99, price: o.price }] }))).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/orders', anna, body({ pointsOff: o.price }))).status, 400);
    const ok = await req(t.app, 'POST', '/api/orders', anna, body({ pointsOff: 100 }));
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    num = ok.json.num;
    assert.ok(Number(num) >= 1048);
    assert.equal(ok.json.total, o.price - 100);
    assert.equal(ok.json.payId, 'p-' + num);
    const after = (await req(t.app, 'GET', '/api/products/tee', {})).json.offers.find((x: { id: string }) => x.id === o.id);
    assert.equal(after ? after.stock : 0, o.stock - 1);
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.points, 1140);
  });
  test('чек и «Перевёл» — на проверку; заказ ждёт подтверждения продавцом', async () => {
    const up = upload();
    const r = await t.app.inject({ method: 'POST', url: `/api/payments/p-${num}/receipt`, headers: { ...anna, ...up.headers }, payload: up.payload });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal((await req(t.app, 'POST', `/api/payments/p-${num}/transferred`, anna)).status, 200);
    const pays = (await req(t.app, 'GET', '/api/payments', anna)).json;
    assert.equal(pays.find((p: { id: string }) => p.id === 'p-' + num).state, 'review');
    const tasks = (await req(t.app, 'GET', '/api/admin/tasks', owner)).json;
    assert.ok(tasks.some((x: { id: string }) => x.id === 'pay-p-' + num));
  });
  test('продавец подтвердил — у покупателя «Оплата подтверждена»; повтор — 409', async () => {
    assert.equal((await req(t.app, 'POST', `/api/admin/payments/p-${num}/confirm`, owner)).status, 200);
    assert.equal((await req(t.app, 'POST', `/api/admin/payments/p-${num}/confirm`, owner)).json.error, 'already_checked');
    const o = (await req(t.app, 'GET', '/api/orders/' + num, anna)).json;
    assert.equal(o.status, 'Оплата подтверждена');
    const ev = (await req(t.app, 'GET', '/api/events', anna)).json;
    assert.ok(ev.items.some((e: { title: string }) => e.title === `Оплата заказа ${num} подтверждена`));
    assert.equal((await req(t.app, 'POST', `/api/orders/${num}/cancel`, anna)).json.result, 'requested');
  });
  test('отмена до оплаты возвращает вещи и баллы', async () => {
    const p = (await req(t.app, 'GET', '/api/products/bomber', {})).json;
    const o = p.offers[0];
    const addr = (await req(t.app, 'GET', '/api/addresses', anna)).json[0].id;
    const before = (await req(t.app, 'GET', '/api/me', anna)).json.user.points;
    const placed = (await req(t.app, 'POST', '/api/orders', anna, { lines: [{ offerId: o.id, qty: 1, price: o.price }], pointsOff: 200, delivery: { mode: 'courier', pvz: '', slot: 0 }, addressId: addr })).json;
    assert.equal((await req(t.app, 'POST', `/api/orders/${placed.num}/cancel`, anna)).json.result, 'cancelled');
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.points, before);
    const again = (await req(t.app, 'GET', '/api/products/bomber', {})).json.offers.find((x: { id: string }) => x.id === o.id);
    assert.equal(again.stock, o.stock);
  });
});

describe('заказ по ссылке', () => {
  test('расчёт на сервере; одобрение → счёт; изменение → «Нужно решение» → согласие', async () => {
    const item = { key: 'a', plat: 'Poizon', url: 'poizon.com/product/1', size: 'M', qty: 2, price: 420, photo: true, box: false };
    const r = await req(t.app, 'POST', '/api/link', anna, { title: 'Тест', items: [item], protect: false, ship: 'all', disc: 'none' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    // 420 ¥ × 2 × (11,62 + 0,70) = 10 349; комиссия 500 × 2; фотоотчёт 200 × 2.
    assert.equal(r.json.calc.goods, 10349);
    assert.equal(r.json.calc.total, 10349 + 1000 + 400);
    const num = r.json.num;
    assert.equal((await req(t.app, 'GET', '/api/orders/' + num, anna)).json.status, 'Ждёт подтверждения');
    assert.equal((await req(t.app, 'POST', `/api/admin/requests/${num}/change`, owner, { prices: [500], comment: 'Цена выросла' })).status, 200);
    const j = (await req(t.app, 'GET', '/api/orders/' + num, anna)).json;
    assert.equal(j.listStatus, 'Нужно решение');
    assert.ok(j.alert.text.includes('420 ¥ → 500 ¥') || j.alert.text.includes('Цена выросла'));
    assert.equal((await req(t.app, 'POST', `/api/orders/${num}/accept`, anna)).json.payId, 'p-' + num);
    const o = (await req(t.app, 'GET', '/api/orders/' + num, anna)).json;
    assert.equal(o.awaitingPay, true);
  });
  test('скидка на комиссию без подтверждённой почты — 400; отказ возвращает баллы', async () => {
    const item = { key: 'a', plat: 'Taobao', url: 'taobao.com/1', size: 'L', qty: 1, price: 150, photo: false, box: false };
    assert.equal((await req(t.app, 'POST', '/api/link', anna, { title: 'Скидка', items: [item], protect: false, ship: 'all', disc: 'comm' })).status, 400);
    const pts0 = (await req(t.app, 'GET', '/api/me', anna)).json.user.points;
    const r = (await req(t.app, 'POST', '/api/link', anna, { title: 'Баллы', items: [item], protect: true, ship: 'all', disc: 'points' })).json;
    assert.ok(r.calc.disc > 0);
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.points, pts0 - r.calc.disc);
    assert.equal((await req(t.app, 'POST', `/api/admin/requests/${r.num}/reject`, owner, { why: 3, note: '' })).status, 400);
    assert.equal((await req(t.app, 'POST', `/api/admin/requests/${r.num}/reject`, owner, { why: 0 })).status, 200);
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.points, pts0);
    assert.equal((await req(t.app, 'GET', '/api/orders/' + r.num, anna)).json.status, 'Отклонён');
  });
});

describe('профиль', () => {
  test('адреса, имя, избранное, удаление с открытыми заказами — 409', async () => {
    assert.equal((await req(t.app, 'POST', '/api/addresses', anna, { name: 'Анна', phone: '+7 900 123-45-67', city: 'Казань', line: 'ул. Баумана, 1' })).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/addresses', anna, { name: 'Анна', phone: '+7 900', city: 'Казань', line: 'x' })).status, 400);
    assert.equal((await req(t.app, 'PATCH', '/api/me', anna, { name: '  Анна  С. ' })).json.name, 'Анна С.');
    await req(t.app, 'PUT', '/api/favorites/bomber', anna);
    assert.ok((await req(t.app, 'GET', '/api/favorites', anna)).json.some((f: { id: string }) => f.id === 'bomber'));
    assert.equal((await req(t.app, 'DELETE', '/api/me', anna)).json.error, 'open_orders');
  });
});
