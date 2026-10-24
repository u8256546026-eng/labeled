import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { offers } from '../src/db/schema';
import { setSetting } from '../src/services/core';
import { as, req, testApp } from './helpers';

// Перед запуском: в рабочей версии не должно быть выдуманных данных, а продавец должен видеть, куда отправлять заказ.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const anna = as(1001), owner = as(2001), dmitry = as(2005);

describe('отзывы без выдуманных оценок', () => {
  test('без настройки — только отзывы из приложения, ни Яндекс Карт, ни 2ГИС', async () => {
    const r = (await req(t.app, 'GET', '/api/reviews', {})).json;
    assert.deepEqual(r.rating.sources.map((s: { name: string }) => s.name), ['В приложении']);
    assert.ok(!JSON.stringify(r).includes('806') && !JSON.stringify(r).includes('yandex.ru/maps'));
    assert.equal(r.rating.total, r.items.length);
  });
  test('оценки с карт вписаны в настройку — показываются со ссылкой на карточку', async () => {
    await setSetting(t.db, 'reviewsExternal', [{ name: 'Яндекс Карты', count: 10, score: 4.5, url: 'https://yandex.ru/maps/org/labeled/1' }]);
    const r = (await req(t.app, 'GET', '/api/reviews', {})).json;
    const ya = r.rating.sources.find((s: { name: string }) => s.name === 'Яндекс Карты');
    assert.deepEqual([ya.meta, ya.url], ['10 оценок', 'https://yandex.ru/maps/org/labeled/1']);
    assert.ok(r.rating.count.startsWith('Средняя по всем источникам'));
    await setSetting(t.db, 'reviewsExternal', []);
  });
});

describe('фильтры из каталога', () => {
  test('бренды и размеры — из вещей; кириллическая «М» читается как M', async () => {
    const tee = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    await t.db.update(offers).set({ size: 'М' }).where(eq(offers.id, tee.offers[0].id));
    const f = (await req(t.app, 'GET', '/api/catalog/facets', {})).json;
    assert.ok(f.brands.length > 0 && f.brands.every((b: string) => b.trim()));
    assert.ok(f.sizes.includes('M') && !f.sizes.includes('М'));
    const xs = f.sizes.indexOf('XS'), m = f.sizes.indexOf('M');
    if (xs >= 0) assert.ok(xs < m, 'XS раньше M');
    const byM = (await req(t.app, 'GET', '/api/catalog?f=' + encodeURIComponent(JSON.stringify({ sizes: ['M'] })), {})).json;
    assert.ok(byM.items.some((i: { id: string }) => i.id === 'tee'));
  });
});

describe('продавец видит, куда отправлять', () => {
  test('заказ из наличия: без пункта выдачи — 400; пункт, получатель и адрес — в заказе админки', async () => {
    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    const o = p.offers[0];
    const addr = (await req(t.app, 'GET', '/api/addresses', anna)).json[0];
    const body = (pvz: string) => ({ lines: [{ offerId: o.id, qty: 1, price: o.price }], pointsOff: 0, delivery: { mode: 'pvz', pvz, slot: 1 }, addressId: addr.id });
    assert.equal((await req(t.app, 'POST', '/api/orders', anna, body('  '))).status, 400);
    const ok = await req(t.app, 'POST', '/api/orders', anna, body('Казань, ул. Баумана, 12 · KZN45'));
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const adm = (await req(t.app, 'GET', '/api/admin/orders/' + ok.json.num, owner)).json;
    assert.equal(adm.ship.how, 'Пункт выдачи CDEK · Казань, ул. Баумана, 12 · KZN45');
    assert.deepEqual([adm.ship.who, adm.ship.phone, adm.ship.addr], [addr.name, addr.phone, `${addr.city}, ${addr.line}`]);
  });
  test('заказ по ссылке: адрес сохраняется в заявке; чужой адрес — 400', async () => {
    const item = { key: 'a', plat: 'Poizon', url: 'poizon.com/product/1', size: 'M', qty: 1, price: 420, photo: false, box: false };
    const addr = (await req(t.app, 'GET', '/api/addresses', anna)).json[0];
    const foreign = (await req(t.app, 'GET', '/api/addresses', dmitry)).json[0];
    if (foreign) assert.equal((await req(t.app, 'POST', '/api/link', anna, { title: 'Чужой', items: [item], protect: false, ship: 'all', disc: 'none', addressId: foreign.id })).status, 400);
    const r = await req(t.app, 'POST', '/api/link', anna, { title: 'С адресом', items: [item], protect: false, ship: 'parts', disc: 'none', addressId: addr.id });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const adm = (await req(t.app, 'GET', '/api/admin/orders/' + r.json.num, owner)).json;
    assert.deepEqual([adm.ship.addr, adm.ship.how], [`${addr.city}, ${addr.line}`, 'Отправлять готовые частями']);
  });
});

describe('размер под заказ у вещи из админки', () => {
  test('сетка латиницей; серые размеры и распроданные — «под заказ»; размер вне сетки — 400', async () => {
    const item = {
      id: 'new-tee', isNew: true, name: 'Футболка теста', brand: 'Stussy', img: '', cat: 'Футболки', colors: [{ id: 'c1', name: 'Чёрный', pics: ['https://example.test/a.png'] }], show: true,
      preorder: true, preorderSizes: ['L', 'ХL'], offers: [{ id: 'o1', color: 'c1', cond: 'Новое с биркой', size: 'М', price: 3000, qty: 1 }],
    };
    const r = await req(t.app, 'PUT', '/api/admin/items', owner, item);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const p = (await req(t.app, 'GET', '/api/products/' + encodeURIComponent(r.json.id), {})).json;
    assert.deepEqual(p.sizeGrid, ['M', 'L', 'XL']);
    assert.deepEqual(p.offers.map((o: { size: string }) => o.size), ['M']);
    assert.deepEqual(Object.values(p.preorder)[0], ['M', 'L', 'XL']);
    const adm = (await req(t.app, 'GET', '/api/admin/items', owner)).json.find((x: { id: string }) => x.id === r.json.id);
    assert.deepEqual([adm.preorder, adm.preorderSizes], [true, ['L', 'XL']]);
    const ask = await req(t.app, 'POST', '/api/size-requests', anna, { productId: r.json.id, color: 'Чёрный', size: 'XL' });
    assert.equal(ask.status, 200, JSON.stringify(ask.json));
    assert.equal((await req(t.app, 'POST', '/api/size-requests', anna, { productId: r.json.id, color: 'Чёрный', size: '56' })).status, 400);
    // Выключили «под заказ» — серые размеры не заказываются.
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...adm, preorder: false, isNew: false })).status, 200);
    assert.deepEqual((await req(t.app, 'GET', '/api/products/' + encodeURIComponent(r.json.id), {})).json.preorder, {});
  });
});
