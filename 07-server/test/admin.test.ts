import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, initData, req, testApp, upload } from './helpers';

let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const anna = as(1001), maria = as(2003), elena = as(2006);
const owner = as(2001), manager = as(2011), stock = as(2012), content = as(2013);

describe('права ролей', () => {
  test('покупатель — 403; склад не подтверждает оплату и не видит курс; менеджер не видит сотрудников', async () => {
    assert.equal((await req(t.app, 'GET', '/api/admin/tasks', anna)).json.error, 'not_staff');
    assert.equal((await req(t.app, 'POST', '/api/admin/payments/p-1041/confirm', stock)).json.error, 'no_permission');
    assert.equal((await req(t.app, 'GET', '/api/admin/settings', stock)).status, 403);
    assert.equal((await req(t.app, 'GET', '/api/admin/staff', manager)).status, 403);
    assert.equal((await req(t.app, 'GET', '/api/admin/items', content)).status, 200);
  });
  test('очередь по правам: владелец — 8 задач, давние сверху; склад — только фотоотчёт и трек', async () => {
    const all = (await req(t.app, 'GET', '/api/admin/tasks', owner)).json;
    assert.equal(all.length, 8, JSON.stringify(all.map((x: { title: string }) => x.title)));
    assert.equal(all.find((x: { kind: string }) => x.kind === 'size').title, 'Заявки на размер · 3');
    assert.deepEqual(all.slice(0, 2).map((x: { kind: string }) => x.kind).sort(), ['claim', 'track']);
    const st = (await req(t.app, 'GET', '/api/admin/tasks', stock)).json;
    assert.deepEqual(st.map((x: { kind: string }) => x.kind).sort(), ['photo', 'track']);
  });
});

describe('оплата', () => {
  test('«Деньги не пришли» с «Другой причиной» без комментария — 400; с комментарием — покупатель видит отказ', async () => {
    assert.equal((await req(t.app, 'POST', '/api/admin/payments/p-1042-1/fail', owner, { why: 3, note: '' })).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/admin/payments/p-1042-1/fail', owner, { why: 3, note: 'Перевод с чужой карты' })).status, 200);
    const pays = (await req(t.app, 'GET', '/api/payments', anna)).json;
    assert.equal(pays.find((p: { id: string }) => p.id === 'p-1042-1').state, 'fail');
  });
  test('чек продавца — только после подтверждения; появляется у покупателя', async () => {
    const up = upload();
    const no = await t.app.inject({ method: 'POST', url: '/api/admin/payments/p-1044/seller-receipt', headers: { ...owner, ...up.headers }, payload: up.payload });
    assert.equal(no.statusCode, 409);
    await req(t.app, 'POST', '/api/admin/payments/p-1041/confirm', owner);
    const up2 = upload();
    const ok = await t.app.inject({ method: 'POST', url: '/api/admin/payments/p-1041/seller-receipt', headers: { ...owner, ...up2.headers }, payload: up2.payload });
    assert.equal(ok.statusCode, 200, ok.body);
    const p = (await req(t.app, 'GET', '/api/payments', anna)).json.find((x: { id: string }) => x.id === 'p-1041');
    assert.ok(p.sellerReceipt?.url?.includes('/files/'));
    const file = await t.app.inject({ method: 'GET', url: p.sellerReceipt.url.replace('http://api.test', '') });
    assert.equal(file.statusCode, 200);
    assert.equal((await t.app.inject({ method: 'GET', url: p.sellerReceipt.url.replace('http://api.test', '').replace(/s=[^&]+/, 's=bad') })).statusCode, 403);
  });
});

describe('этапы, трек, фотоотчёт', () => {
  test('фотоотчёт: без фото каждой вещи — 400; после отправки покупатель видит фото', async () => {
    assert.equal((await req(t.app, 'POST', '/api/admin/photo/1040/send', stock, {})).status, 400);
    const up = upload();
    const f = await t.app.inject({ method: 'POST', url: '/api/admin/photo/1040/upload', headers: { ...stock, ...up.headers }, payload: up.payload });
    assert.equal((await req(t.app, 'PUT', '/api/admin/photo/1040/items/1', stock, { fileIds: [f.json().id] })).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/admin/photo/1040/send', stock, { note: 'Бирки на месте' })).status, 200);
    const tasks = (await req(t.app, 'GET', '/api/admin/tasks', stock)).json;
    assert.ok(!tasks.some((x: { kind: string }) => x.kind === 'photo'));
  });
  test('трек короче 10 цифр — 400; сохранённый трек закрывает задачу', async () => {
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1042/parcels/2/track', stock, { track: '123' })).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1042/parcels/2/track', stock, { track: '10 234 567 891' })).status, 200);
    const o = (await req(t.app, 'GET', '/api/orders/1042', anna)).json;
    assert.equal(o.parcels[1].track, '10234567891');
  });
  test('смена этапа заказа из наличия → «Доставлен» → покупатель подтверждает получение', async () => {
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1038/stage', manager, { stage: 3, notify: true })).status, 200);
    const o = (await req(t.app, 'GET', '/api/orders/1038', maria)).json;
    assert.equal(o.receivable, true);
    assert.equal((await req(t.app, 'POST', '/api/orders/1038/received', maria)).status, 200);
    assert.equal((await req(t.app, 'GET', '/api/orders/1038', maria)).json.status, 'Получен');
  });
});

describe('обращение, возврат, отзыв', () => {
  test('возврат — только по одобренному обращению и только для наличия', async () => {
    const c = (await req(t.app, 'GET', '/api/claims/1038', maria)).json;
    assert.equal((await req(t.app, 'POST', `/api/claims/${c.id}/refund`, maria, { to: 'sbp', val: '+7 905 111-22-33', bank: 'Т-Банк' })).json.error, 'not_approved');
    assert.equal((await req(t.app, 'POST', '/api/admin/claims/1038/reply', owner, { text: 'Проверим и ответим сегодня' })).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/admin/claims/1038/decide', owner, { answer: 'ok', text: 'Вернём деньги', refundSum: 4990 })).status, 200);
    assert.equal((await req(t.app, 'POST', `/api/claims/${c.id}/refund`, maria, { to: 'sbp', val: '+7 905 111', bank: 'Т-Банк' })).status, 400);
    const r = await req(t.app, 'POST', `/api/claims/${c.id}/refund`, maria, { to: 'sbp', val: '+7 905 111-22-33', bank: 'Т-Банк' });
    assert.equal(r.status, 200);
    assert.ok(r.json.val.endsWith('2233') && r.json.val.includes('•'));
  });
  test('отзыв — только после получения, на модерацию; опубликованный виден в «Отзывах»', async () => {
    assert.equal((await req(t.app, 'POST', '/api/reviews', anna, { orderNum: '1042', stars: 5, text: 'x', sign: 'short' })).json.error, 'not_received');
    const r = await req(t.app, 'POST', '/api/reviews', maria, { orderNum: '1038', stars: 5, text: 'Всё отлично', sign: 'short' });
    assert.equal(r.json.status, 'mod');
    assert.equal((await req(t.app, 'POST', '/api/reviews', maria, { orderNum: '1038', stars: 4, text: 'ещё', sign: 'anon' })).json.error, 'review_exists');
    const list = (await req(t.app, 'GET', '/api/admin/reviews', content)).json;
    const mine = list.find((x: { who: string; text: string }) => x.text === 'Всё отлично');
    assert.equal(mine.who, 'Мария Л.');
    await req(t.app, 'PUT', `/api/admin/reviews/${mine.id}`, content, { state: 'pub' });
    assert.ok((await req(t.app, 'GET', '/api/reviews', {})).json.items.some((x: { text: string }) => x.text === 'Всё отлично'));
  });
});

describe('баллы и приглашение', () => {
  test('ручное начисление и списание: больше баланса — 409, причина в истории покупателя', async () => {
    const uid = (await req(t.app, 'GET', '/api/me', elena)).json.user.id;
    assert.equal((await req(t.app, 'POST', `/api/admin/buyers/${uid}/points`, owner, { delta: -99999, reason: 'x' })).json.error, 'balance');
    assert.equal((await req(t.app, 'POST', `/api/admin/buyers/${uid}/points`, owner, { delta: 250, reason: 'Компенсация за задержку' })).status, 200);
    const h = (await req(t.app, 'GET', '/api/points', elena)).json;
    assert.equal(h.balance, 2400);
    assert.equal(h.history[0].title, 'Компенсация за задержку');
  });
  test('друг по ссылке ref_: первый выполненный заказ даёт пригласившему 250 баллов один раз', async () => {
    const friend = { authorization: initData({ id: 5555, first_name: 'Дарья' }, 'ref_1001') };
    await req(t.app, 'POST', '/api/session', friend, { consent: true });
    const before = (await req(t.app, 'GET', '/api/me', anna)).json.user.points;
    await req(t.app, 'POST', '/api/addresses', friend, { name: 'Дарья', phone: '+7 900 000-11-22', city: 'Москва', line: 'Тверская, 1' });
    const addr = (await req(t.app, 'GET', '/api/addresses', friend)).json[0].id;
    const o = (await req(t.app, 'GET', '/api/products/jeans', {})).json.offers[0];
    const placed = (await req(t.app, 'POST', '/api/orders', friend, { lines: [{ offerId: o.id, qty: 1, price: o.price }], pointsOff: 0, delivery: { mode: 'pvz', pvz: 'p1', slot: 0 }, addressId: addr })).json;
    await req(t.app, 'POST', `/api/payments/${placed.payId}/transferred`, friend);
    await req(t.app, 'POST', `/api/admin/payments/${placed.payId}/confirm`, owner);
    await req(t.app, 'POST', `/api/admin/orders/${placed.num}/stage`, owner, { stage: 3, notify: false });
    await req(t.app, 'POST', `/api/orders/${placed.num}/received`, friend);
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.points, before + 250);
  });
});

describe('настройки и сотрудники', () => {
  test('новая надбавка меняет курс покупателя; границы не по возрастанию — 400', async () => {
    const cur = (await req(t.app, 'GET', '/api/admin/settings', owner)).json;
    const bad = { ...cur.rates, markup: [{ upTo: 3000, value: 0.7 }, { upTo: 1000, value: 0.65 }, { upTo: null, value: 0.6 }] };
    assert.equal((await req(t.app, 'PUT', '/api/admin/settings', owner, { rates: bad, requisites: cur.requisites })).status, 400);
    const good = { ...cur.rates, markup: [{ upTo: 1000, value: 0.8 }, ...cur.rates.markup.slice(1)] };
    assert.equal((await req(t.app, 'PUT', '/api/admin/settings', owner, { rates: good, requisites: { bank: 'Т-Банк', recipient: 'ИП Иванов', number: '+7 900 000-00-00' } })).status, 200);
    assert.equal((await req(t.app, 'GET', '/api/rates', {})).json.markup[0].value, 0.8);
    assert.equal((await req(t.app, 'GET', '/api/requisites', {})).json.bank, 'Т-Банк');
  });
  test('приглашение сотрудника: вход по staff_<код> даёт роль; ссылка одноразовая', async () => {
    const inv = (await req(t.app, 'POST', '/api/admin/staff/invites', owner, { role: 'stock' })).json;
    assert.ok(inv.link.includes('startapp=staff_' + inv.code));
    const s = await req(t.app, 'POST', '/api/session', { authorization: initData({ id: 6666, first_name: 'Пётр' }, 'staff_' + inv.code) }, { consent: true });
    assert.equal(s.json.staff.role, 'stock');
    const again = await req(t.app, 'POST', '/api/session', { authorization: initData({ id: 6667, first_name: 'Кто-то' }, 'staff_' + inv.code) }, { consent: true });
    assert.equal(again.json.staff, null);
    const staffList = (await req(t.app, 'GET', '/api/admin/staff', owner)).json;
    const petr = staffList.find((x: { name: string }) => x.name === 'Пётр');
    assert.equal((await req(t.app, 'PUT', `/api/admin/staff/${petr.id}`, owner, { role: 'stock', perms: ['photo', 'track', 'prices'] })).status, 200);
    const after = (await req(t.app, 'GET', '/api/admin/staff', owner)).json.find((x: { name: string }) => x.name === 'Пётр');
    assert.deepEqual(after.perms, ['photo', 'track']);
    const ownerRow = staffList.find((x: { me: boolean }) => x.me);
    assert.equal((await req(t.app, 'DELETE', `/api/admin/staff/${ownerRow.id}`, owner)).json.error, 'owner');
  });
  test('сводка', async () => {
    const s = (await req(t.app, 'GET', '/api/admin/summary?range=week', manager)).json;
    assert.equal(s.v.length, 4);
    assert.ok(s.stages.prob >= 0);
  });
});

describe('фото покупателя в админке', () => {
  test('в списке покупателей, карточке и заказе — фото из Telegram', async () => {
    const list = (await req(t.app, 'GET', '/api/admin/buyers', owner)).json as { id: string; handle: string; photo: string }[];
    const a = list.find((b) => b.handle === '@anna_smirnova')!;
    assert.match(a.photo, /^https:/);
    assert.equal((await req(t.app, 'GET', '/api/admin/buyers/' + a.id, owner)).json.photo, a.photo);
    assert.equal((await req(t.app, 'GET', '/api/admin/orders/1041', manager)).json.buyerPhoto, a.photo);
  });
});

describe('удаление вещи', () => {
  test('склад не удаляет; владелец удаляет — вещь, заявки на размер и избранное пропадают, заказ и журнал остаются', async () => {
    assert.equal((await req(t.app, 'PUT', '/api/favorites/chinos', elena)).status, 200);
    assert.equal((await req(t.app, 'DELETE', '/api/admin/items/chinos', stock)).status, 403);
    assert.equal((await req(t.app, 'DELETE', '/api/admin/items/chinos', owner)).status, 200);
    assert.ok(!(await req(t.app, 'GET', '/api/admin/items', owner)).json.some((x: { id: string }) => x.id === 'chinos'));
    assert.equal((await req(t.app, 'GET', '/api/products/chinos', {})).status, 404);
    assert.ok(!(await req(t.app, 'GET', '/api/admin/sizes', owner)).json.some((x: { item: string }) => x.item === 'Брюки чинос'));
    assert.ok(!JSON.stringify((await req(t.app, 'GET', '/api/favorites', elena)).json).includes('chinos'));
    assert.ok(JSON.stringify((await req(t.app, 'GET', '/api/admin/orders/1038', owner)).json).includes('Брюки чинос'));
    const log = (await req(t.app, 'GET', '/api/admin/journal', owner)).json as { text: string; obj: string }[];
    assert.ok(log.some((x) => x.text === 'Вещь удалена из каталога' && x.obj === 'Брюки чинос'));
    assert.equal((await req(t.app, 'DELETE', '/api/admin/items/chinos', owner)).status, 404);
  });
});
