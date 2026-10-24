import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, req, testApp, upload } from './helpers';

// Критерии «Проверка перед окончательным платежом» (scope v3, раздел 6), которые не покрыты другими файлами:
// доступ к чужим данным, повторные нажатия, границы ступеней, изменение вещи продавцом.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const anna = as(1001), maria = as(2003), owner = as(2001);
const upFile = (url: string, who: Record<string, string>) => { const u = upload(); return t.app.inject({ method: 'POST', url, headers: { ...who, ...u.headers }, payload: u.payload }); };
const notOk = (s: number) => s === 403 || s === 404;

describe('чужие данные: Мария обращается к данным Анны и наоборот', () => {
  test('заказы, оплаты, фотоотчёт, обращения, отзыв', async () => {
    assert.equal((await req(t.app, 'GET', '/api/orders/1042', maria)).status, 404);
    assert.ok(!(await req(t.app, 'GET', '/api/orders', maria)).json.some((o: { num: string }) => ['1041', '1042', '1045', '1047'].includes(o.num)));
    assert.ok(!(await req(t.app, 'GET', '/api/payments', maria)).json.some((p: { id: string }) => p.id.startsWith('p-104') && p.id !== 'p-1038'));
    for (const [m, url] of [['POST', '/api/orders/1041/cancel'], ['POST', '/api/orders/1042/received'], ['POST', '/api/orders/1047/accept'], ['GET', '/api/orders/1042/photo-report'], ['GET', '/api/orders/1040/photo-report']] as const) {
      assert.ok(notOk((await req(t.app, m, url, maria)).status), url);
    }
    assert.ok(notOk((await req(t.app, 'POST', '/api/payments/p-1041/transferred', maria)).status));
    assert.ok(notOk((await upFile('/api/payments/p-1041/receipt', maria)).statusCode));
    assert.equal((await req(t.app, 'GET', '/api/payments', anna)).json.find((p: { id: string }) => p.id === 'p-1041').state, 'review', 'оплата Анны не тронута');

    assert.ok(notOk((await req(t.app, 'GET', '/api/claims/1038', anna)).status));
    const claimId = (await req(t.app, 'GET', '/api/claims/1038', maria)).json.id;
    assert.ok(claimId, 'у Марии своё обращение открывается');
    assert.ok(notOk((await req(t.app, 'POST', `/api/claims/${claimId}/photos`, anna, { fileIds: [] })).status));
    assert.ok(notOk((await req(t.app, 'POST', `/api/claims/${claimId}/refund`, anna, { to: 'sbp', val: '+79210000000', bank: 'Т-Банк' })).status));
    assert.ok(notOk((await req(t.app, 'POST', '/api/claims', anna, { orderNum: '1038', reason: 0, text: 'чужой' })).status));
    assert.ok(notOk((await req(t.app, 'POST', '/api/reviews', anna, { orderNum: '1039', stars: 5, text: 'чужой', sign: 'anon' })).status));
  });

  test('адреса и черновики', async () => {
    const mine = (await req(t.app, 'GET', '/api/addresses', anna)).json as { id: string; line: string }[];
    const a = mine[0];
    await req(t.app, 'POST', '/api/addresses', maria, { id: String(a.id), name: 'Взлом', phone: '+70000000000', city: 'Москва', line: 'чужой адрес' });
    await req(t.app, 'DELETE', '/api/addresses/' + a.id, maria);
    const now = (await req(t.app, 'GET', '/api/addresses', anna)).json as { id: string; line: string }[];
    assert.equal(now.find((x) => x.id === a.id)?.line, a.line, 'адрес Анны не изменён и не удалён');

    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json.offers[0];
    const r = await req(t.app, 'POST', '/api/orders', maria, { lines: [{ offerId: p.id, qty: 1, price: p.price }], pointsOff: 0, delivery: { mode: 'courier', pvz: '', slot: 0 }, addressId: Number(a.id) });
    assert.ok(r.status >= 400, 'заказ на чужой адрес не оформляется');

    assert.equal((await req(t.app, 'PUT', '/api/link/drafts/d-anna', anna, { title: 'Мой черновик', items: [] })).status, 200);
    await req(t.app, 'PUT', '/api/link/drafts/d-anna', maria, { title: 'Чужой', items: [] });
    await req(t.app, 'DELETE', '/api/link/drafts/d-anna', maria);
    assert.equal((await req(t.app, 'PUT', '/api/link/drafts/d-anna', maria, { title: 'Чужой', items: [] })).status, 403);
    const drafts = (await req(t.app, 'GET', '/api/link/drafts', anna)).json as { id: string; form: { title: string } }[];
    assert.equal(drafts.find((d) => d.id === 'd-anna')?.form.title, 'Мой черновик');
    assert.ok(!(await req(t.app, 'GET', '/api/link/drafts', maria)).json.some((d: { id: string }) => d.id === 'd-anna'));
  });

  test('файлы: без подписи не открываются; чужой файл нельзя приложить', async () => {
    const f = (await upFile('/api/files?kind=claim', anna)).json() as { id: string; url: string };
    assert.equal((await t.app.inject({ method: 'GET', url: f.url.replace(/^https?:\/\/[^/]+/, '') })).statusCode, 200);
    assert.ok(notOk((await t.app.inject({ method: 'GET', url: '/files/' + f.id })).statusCode));
    const r = await req(t.app, 'POST', '/api/claims', maria, { orderNum: '1038', reason: 0, text: 'с чужим фото', fileIds: [f.id] });
    assert.ok(r.status >= 400, 'чужой файл в обращении: ' + r.status);
  });
});

describe('повторные нажатия', () => {
  test('«Перевёл» дважды — одна задача; подтверждение дважды — 409', async () => {
    await upFile('/api/payments/p-1045/receipt', anna);
    assert.equal((await req(t.app, 'POST', '/api/payments/p-1045/transferred', anna)).status, 200);
    await req(t.app, 'POST', '/api/payments/p-1045/transferred', anna);
    const tasks = (await req(t.app, 'GET', '/api/admin/tasks', owner)).json as { id: string }[];
    assert.equal(tasks.filter((x) => x.id === 'pay-p-1045').length, 1);
    assert.equal((await req(t.app, 'POST', '/api/admin/payments/p-1045/confirm', owner)).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/admin/payments/p-1045/confirm', owner)).status, 409);
  });

  test('два одновременных заказа с баллами не списывают баллы больше баланса', async () => {
    const me = (await req(t.app, 'GET', '/api/me', anna)).json.user.points as number;
    const p = (await req(t.app, 'GET', '/api/products/bomber', {})).json.offers[0];
    const addr = (await req(t.app, 'GET', '/api/addresses', anna)).json[0].id;
    const pointsOff = Math.min(me, Math.floor(p.price * 0.3));
    const body = { lines: [{ offerId: p.id, qty: 1, price: p.price }], pointsOff, delivery: { mode: 'courier', pvz: '', slot: 0 }, addressId: Number(addr) };
    const rs = await Promise.all([req(t.app, 'POST', '/api/orders', anna, body), req(t.app, 'POST', '/api/orders', anna, body)]);
    const okN = rs.filter((r) => r.status === 200).length;
    const left = (await req(t.app, 'GET', '/api/me', anna)).json.user.points as number;
    assert.ok(left >= 0, 'баланс не уходит в минус');
    assert.equal(left, me - okN * pointsOff, 'списано ровно за оформленные заказы');
    for (const r of rs) if (r.status === 200) await req(t.app, 'POST', `/api/orders/${r.json.num}/cancel`, anna);
  });

  test('повтор оформления с тем же ключом (двойное нажатие, обрыв связи) — тот же заказ, баллы списаны один раз', async () => {
    const me = (await req(t.app, 'GET', '/api/me', anna)).json.user.points as number;
    const p = (await req(t.app, 'GET', '/api/products/bomber', {})).json.offers[0];
    const addr = (await req(t.app, 'GET', '/api/addresses', anna)).json[0].id;
    const body = { lines: [{ offerId: p.id, qty: 1, price: p.price }], pointsOff: 100, delivery: { mode: 'courier', pvz: '', slot: 0 }, addressId: Number(addr), key: 'try-stock-0001' };
    const [a, b] = await Promise.all([req(t.app, 'POST', '/api/orders', anna, body), req(t.app, 'POST', '/api/orders', anna, body)]);
    const c = await req(t.app, 'POST', '/api/orders', anna, body);
    assert.equal(a.status, 200); assert.deepEqual([b.json.num, c.json.num, c.json.payId], [a.json.num, a.json.num, a.json.payId]);
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.points, me - 100);
    assert.equal((await req(t.app, 'GET', '/api/products/bomber', {})).json.offers.find((x: { id: string }) => x.id === p.id)?.stock ?? 0, p.stock - 1, 'вещь закреплена один раз');
    await req(t.app, 'POST', `/api/orders/${a.json.num}/cancel`, anna);

    const item = { key: 'a', plat: 'Taobao', url: 'taobao.com/k', size: 'M', qty: 1, price: 150, photo: false, box: false };
    const lb = { title: 'Повтор', items: [item], protect: false, ship: 'all', disc: 'points', key: 'try-link-0001' };
    const pts = (await req(t.app, 'GET', '/api/me', anna)).json.user.points as number;
    const l1 = await req(t.app, 'POST', '/api/link', anna, lb), l2 = await req(t.app, 'POST', '/api/link', anna, lb);
    assert.equal(l2.json.num, l1.json.num);
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.points, pts - l1.json.calc.disc);
    assert.equal((await req(t.app, 'POST', '/api/orders', maria, { ...body, key: 'try-stock-0001', addressId: (await req(t.app, 'GET', '/api/addresses', maria)).json[0].id })).json.num === a.json.num, false, 'ключ другого покупателя не возвращает чужой заказ');
  });

  test('согласие с изменённой заявкой дважды — один счёт', async () => {
    const a = await req(t.app, 'POST', '/api/orders/1047/accept', anna);
    const b = await req(t.app, 'POST', '/api/orders/1047/accept', anna);
    assert.equal(a.status, 200);
    assert.ok(b.status === 409 || b.json.payId === a.json.payId);
    assert.equal((await req(t.app, 'GET', '/api/payments', anna)).json.filter((p: { orderNum: string }) => p.orderNum === '1047').length, 1);
  });
});

describe('расчёт и каталог', () => {
  const link = (price: number) => req(t.app, 'POST', '/api/link', maria, { title: 'Граница', items: [{ key: 'a', plat: 'Taobao', url: 'taobao.com/b', size: 'M', qty: 1, price, photo: false, box: false }], protect: false, ship: 'all', disc: 'none' });
  test('граница ступени входит в нижнюю ступень: надбавка и комиссия', async () => {
    // Курс 11,62; надбавка 0,70 до 1000 ¥ включительно, дальше 0,65; комиссия 300 ₽ до 100 ¥, 500 ₽ до 2000 ¥.
    assert.deepEqual([(await link(1000)).json.calc.goods, (await link(1000)).json.calc.comm], [12320, 500]);
    assert.equal((await link(1001)).json.calc.goods, Math.round(1001 * (11.62 + 0.65)));
    assert.equal((await link(100)).json.calc.comm, 300);
    assert.equal((await link(101)).json.calc.comm, 500);
  });

  test('продавец меняет вещь — покупатель сразу видит новую цену и наличие', async () => {
    const item = (await req(t.app, 'GET', '/api/admin/items', owner)).json.find((x: { id: string }) => x.id === 'tee');
    const changed = { ...item, offers: item.offers.map((o: { price: number; qty: number }, i: number) => (i === 0 ? { ...o, price: o.price + 10, qty: 7 } : o)) };
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...changed, isNew: false })).status, 200);
    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    const o = p.offers.find((x: { price: number }) => x.price === item.offers[0].price + 10);
    assert.ok(o, 'новая цена у покупателя');
    assert.equal(o.stock, 7);
  });
});
