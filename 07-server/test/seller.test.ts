import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, req, testApp, upload } from './helpers';

// Экраны продавца adm28–adm32: решение по обращению, счёт за доставку, отмена продавцом, заявки на размер, баннер.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const maria = as(2003);
const owner = as(2001), manager = as(2011), stock = as(2012), content = as(2013);

describe('adm28–adm32', () => {
  test('adm28: отказ без причины — 400; возврат больше оплаченного — 400; «Нужны фото» сохраняется', async () => {
    const c = (await req(t.app, 'GET', '/api/admin/claims/1038', owner)).json;
    assert.equal(c.kind, 'stock'); assert.equal(c.paid, 4990);
    assert.equal((await req(t.app, 'POST', '/api/admin/claims/1038/decide', owner, { answer: 'no', text: ' ' })).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/admin/claims/1038/decide', owner, { answer: 'ok', refundSum: 5000 })).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/admin/claims/1038/decide', owner, { answer: 'more', text: 'Пришлите фото бирки' })).status, 200);
    assert.equal((await req(t.app, 'GET', '/api/admin/claims/1038', owner)).json.answer, 'more');
  });

  test('adm29: счёт за доставку — только на складе в Китае; создаёт посылку и платёж покупателя, второй раз — 409', async () => {
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1040/parcels/0/bill', stock, { weight: 1.4, amount: 2310 })).status, 403);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1038/parcels/1/bill', owner, { weight: 1, amount: 500 })).status, 409);
    const r = await req(t.app, 'POST', '/api/admin/orders/1040/parcels/0/bill', manager, { weight: 1.4, amount: 2310 });
    assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.n, 1);
    const o = (await req(t.app, 'GET', '/api/admin/orders/1040', owner)).json;
    assert.deepEqual([o.parcels[0].billed, o.parcels[0].weight], [true, '1,4']);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1040/parcels/1/bill', owner, { weight: 1.4, amount: 2310 })).status, 409);
    const dmitry = as(2005);
    const pay = (await req(t.app, 'GET', '/api/payments', dmitry)).json.find((x: { id: string }) => x.id === 'p-1040-1');
    assert.equal(pay?.sum ?? pay?.amount, 2310);
  });

  test('adm30: «Другая причина» без комментария — 400; отмена оплаченного заказа — задача на возврат, покупатель видит причину', async () => {
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1044/cancel', owner, { why: 3, note: '' })).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1038/cancel', owner, { why: 0 })).status, 200);
    let o = (await req(t.app, 'GET', '/api/admin/orders/1038', owner)).json;
    assert.deepEqual([o.status, o.refundDue, o.closed], ['Отменён · вернуть оплату', 4990, true]);
    const tasks = (await req(t.app, 'GET', '/api/admin/tasks', manager)).json;
    assert.ok(tasks.some((x: { kind: string; amount: number }) => x.kind === 'refund' && x.amount === 4990));
    const b = (await req(t.app, 'GET', '/api/orders/1038', maria)).json;
    assert.equal(b.stopped.label, 'Заказ отменён продавцом');
    assert.ok(b.stopped.reason.startsWith('Товар закончился у продавца'));
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1038/cancel', owner, { why: 0 })).status, 409);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1038/refunded', owner)).status, 200);
    o = (await req(t.app, 'GET', '/api/admin/orders/1038', owner)).json;
    assert.deepEqual([o.status, o.refunded], ['Отменён', true]);
    assert.ok(!(await req(t.app, 'GET', '/api/admin/tasks', manager)).json.some((x: { kind: string }) => x.kind === 'refund'));
  });

  test('adm31: «Размер есть» — покупатель видит вещь, задача уменьшается; повторный ответ — 409', async () => {
    assert.equal((await req(t.app, 'GET', '/api/admin/sizes', manager)).status, 403);
    const list = (await req(t.app, 'GET', '/api/admin/sizes', content)).json;
    assert.equal(list.length, 3);
    const oleg = list.find((x: { who: string }) => x.who === 'Олег Петров');
    assert.equal((await req(t.app, 'POST', `/api/admin/sizes/${oleg.id}`, content, { answer: 'yes' })).status, 200);
    assert.equal((await req(t.app, 'POST', `/api/admin/sizes/${oleg.id}`, content, { answer: 'no' })).status, 409);
    const mine = (await req(t.app, 'GET', '/api/orders', as(2004))).json.find((x: { num: string }) => x.num === 'pre-' + oleg.id);
    assert.equal(mine.status, 'Есть предложение');
    assert.equal(mine.acts[0].to, '/product/tee');
    assert.equal((await req(t.app, 'GET', '/api/admin/tasks', content)).json.find((x: { kind: string }) => x.kind === 'size').title, 'Заявки на размер · 2');
  });

  test('adm32: без картинки — 400; новый баннер с картинкой виден на главной; скрытый и удалённый — нет', async () => {
    assert.equal((await req(t.app, 'POST', '/api/admin/banners', content, { title: 'Новая коллекция', cta: 'Смотреть', target: 'catalog', img: '' })).status, 400);
    const up = upload();
    const f = await t.app.inject({ method: 'POST', url: '/api/admin/banners/upload', headers: { ...content, ...up.headers }, payload: up.payload });
    assert.equal(f.statusCode, 200, f.body);
    const r = await req(t.app, 'POST', '/api/admin/banners', content, { title: 'Новая коллекция', cta: 'Смотреть', target: 'catalog', cat: 'tee', img: f.json().url });
    assert.equal(r.status, 200);
    let pub = (await req(t.app, 'GET', '/api/showcase', {})).json.banners;
    const b = pub.find((x: { id: number }) => x.id === r.json.id);
    assert.deepEqual([b.cta, b.cat, b.target], ['Смотреть', 'tee', 'catalog']);
    const sc = (await req(t.app, 'GET', '/api/admin/showcase', content)).json.banners.find((x: { id: number }) => x.id === r.json.id);
    assert.equal(sc.sub, 'Кнопка «Смотреть» → категория «Футболки»');
    assert.equal((await req(t.app, 'PUT', `/api/admin/banners/${r.json.id}`, content, { on: false })).status, 200);
    pub = (await req(t.app, 'GET', '/api/showcase', {})).json.banners;
    assert.ok(!pub.some((x: { id: number }) => x.id === r.json.id));
    assert.equal((await req(t.app, 'DELETE', `/api/admin/banners/${r.json.id}`, content)).status, 200);
    assert.equal((await req(t.app, 'DELETE', `/api/admin/banners/${r.json.id}`, content)).status, 404);
  });
});

