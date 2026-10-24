import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { openDb } from '../src/db/client';
import { categories, products } from '../src/db/schema';
import { as, req, testApp } from './helpers';

// Расцветки одной модели (22 октября): продавец заводит цвета в одной вещи или объединяет вещи, заведённые по отдельности.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const anna = as(1001), owner = as(2001);
const pic = (n: string) => `https://example.test/${n}.png`;
const offer = (id: string, color: string, size: string, price = 10000, qty = 1) => ({ id, color, cond: 'Новое · бирки на месте', size, price, qty });
const item = (name: string, colors: { id: string; name: string; filter?: string; pics: string[] }[], offers: ReturnType<typeof offer>[], extra = {}) =>
  ({ id: 'new', isNew: true, name, brand: 'Nike', img: '', cat: 'Обувь', show: true, preorder: false, colors, offers, ...extra });
const product = async (id: string) => (await req(t.app, 'GET', '/api/products/' + encodeURIComponent(id), {})).json;
const admin = async (id: string) => (await req(t.app, 'GET', '/api/admin/items', owner)).json.find((x: { id: string }) => x.id === id);
const byColor = async (color: string) => (await req(t.app, 'GET', '/api/catalog?f=' + encodeURIComponent(JSON.stringify({ colors: [color] })), {})).json.items.map((x: { id: string }) => x.id);

describe('несколько расцветок в одной вещи', () => {
  test('покупатель видит оба цвета с их фото и размерами; фильтр находит вещь по каждому цвету', async () => {
    const r = await req(t.app, 'PUT', '/api/admin/items', owner, item('Кроссовки AF1', [{ id: 'cb', name: 'Чёрный', pics: [pic('b1'), pic('b2')] }, { id: 'cw', name: 'Белый', pics: [pic('w1')] }],
      [offer('o1', 'cb', '43'), offer('o2', 'cw', '42', 10450), offer('o3', 'cw', '44', 10450)]));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const p = await product(r.json.id);
    assert.deepEqual(p.colors.map((c: { name: string; filter: string }) => [c.name, c.filter]), [['Чёрный', 'black'], ['Белый', 'white']]);
    assert.deepEqual(p.colors[1].photos, [pic('w1')]);
    assert.deepEqual(p.offers.map((o: { color: string; size: string; img: string }) => [o.color, o.size, o.img]), [['cb', '43', pic('b1')], ['cw', '42', pic('w1')], ['cw', '44', pic('w1')]]);
    assert.ok((await byColor('white')).includes(r.json.id));
    assert.ok((await byColor('black')).includes(r.json.id));
    assert.ok(!(await byColor('red')).includes(r.json.id));
    const a = await admin(r.json.id);
    assert.deepEqual(a.colors.map((c: { name: string }) => c.name), ['Чёрный', 'Белый']);
    assert.deepEqual(a.offers.map((o: { color: string }) => o.color), ['cb', 'cw', 'cw']);
  });

  test('распроданная расцветка без «под заказ» не показывается; убранная расцветка пропадает с предложениями', async () => {
    const id = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Худи', [{ id: 'cg', name: 'Серый', pics: [pic('g')] }, { id: 'cn', name: 'Синий', pics: [pic('n')] }],
      [offer('o1', 'cg', 'M'), offer('o2', 'cn', 'L')]))).json.id;
    let a = await admin(id);
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...a, isNew: false, offers: a.offers.map((o: { color: string }) => (o.color === 'cn' ? { ...o, qty: 0 } : o)) })).status, 200);
    let p = await product(id);
    assert.deepEqual([p.colors.map((c: { name: string }) => c.name), p.colors[0].filter], [['Серый'], 'grey']);
    // С «под заказ» распроданный цвет остаётся — в нём можно оставить заявку.
    a = await admin(id);
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...a, isNew: false, preorder: true })).status, 200);
    p = await product(id);
    assert.deepEqual(Object.keys(p.preorder), ['cg', 'cn']);
    // Расцветку убрали из вещи — её предложения не всплывают ни у покупателя, ни в редакторе.
    a = await admin(id);
    const kept = { ...a, isNew: false, colors: a.colors.filter((c: { id: string }) => c.id === 'cg'), offers: a.offers.filter((o: { color: string }) => o.color === 'cg') };
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, kept)).status, 200);
    assert.deepEqual((await admin(id)).offers.map((o: { color: string }) => o.color), ['cg']);
    assert.deepEqual((await product(id)).colors.map((c: { id: string }) => c.id), ['cg']);
  });

  test('ошибки: цвет дважды, расцветка без фото, предложение без расцветки', async () => {
    const two = item('Т', [{ id: 'a', name: 'Белый', pics: [pic('a')] }, { id: 'b', name: 'Белый', pics: [pic('b')] }], [offer('o', 'a', 'M')]);
    assert.match((await req(t.app, 'PUT', '/api/admin/items', owner, two)).json.message ?? '', /дважды/);
    const nopic = item('Т', [{ id: 'a', name: 'Белый', pics: [pic('a')] }, { id: 'b', name: 'Чёрный', pics: [] }], [offer('o', 'a', 'M')]);
    assert.match((await req(t.app, 'PUT', '/api/admin/items', owner, nopic)).json.message ?? '', /фото расцветки «Чёрный»/);
    const lost = item('Т', [{ id: 'a', name: 'Белый', pics: [pic('a')] }], [offer('o', 'zz', 'M')]);
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, lost)).status, 400);
  });
});

describe('объединение вещей в одну модель', () => {
  test('вторая вещь становится расцветкой: предложения, заявки и избранное переезжают, сама она пропадает', async () => {
    const black = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Nike Air Force 1 07', [{ id: 'c1', name: 'Чёрный', pics: [pic('b')] }], [offer('o1', 'c1', '43', 11450)], { preorder: true }))).json.id;
    const white = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Nike Air Force 1 07', [{ id: 'c1', name: 'Белый', pics: [pic('w')] }], [offer('o1', 'c1', '42', 10450), offer('o2', 'c1', '44', 10450)], { preorder: true, preorderSizes: ['43'] }))).json.id;
    const whiteOffers = (await product(white)).offers.map((o: { id: string }) => o.id);
    assert.equal((await req(t.app, 'PUT', '/api/favorites/' + encodeURIComponent(white), anna)).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/size-requests', anna, { productId: white, color: 'Белый', size: '43' })).status, 200);

    const m = await req(t.app, 'POST', `/api/admin/items/${encodeURIComponent(black)}/merge`, owner, { from: white });
    assert.equal(m.status, 200, JSON.stringify(m.json));
    const p = await product(black);
    assert.deepEqual(p.colors.map((c: { name: string; filter: string }) => [c.name, c.filter]), [['Чёрный', 'black'], ['Белый', 'white']]);
    assert.notEqual(p.colors[1].id, 'c1', 'у переехавшей расцветки свой id');
    const moved = p.offers.filter((o: { color: string }) => o.color === p.colors[1].id);
    assert.deepEqual(moved.map((o: { id: string }) => o.id).sort(), whiteOffers.sort(), 'id предложений сохранены — корзины и заказы не ломаются');
    assert.deepEqual(p.sizeGrid, ['42', '43', '44']);
    assert.equal((await req(t.app, 'GET', '/api/products/' + encodeURIComponent(white), {})).status, 404);
    assert.ok((await req(t.app, 'GET', '/api/favorites', anna)).json.some((x: { id: string }) => x.id === black));
    assert.ok((await req(t.app, 'GET', '/api/admin/sizes', owner)).json.some((x: { productId: string; color: string }) => x.productId === black && x.color === 'Белый'));
    const j = (await req(t.app, 'GET', '/api/admin/journal', owner)).json;
    assert.ok(j.some((x: { text: string }) => x.text === 'Объединена с «Nike Air Force 1 07»'));
  });

  test('одинаковый цвет в обеих вещах — 409 с подсказкой; вещь сама с собой — 400', async () => {
    const a = (await req(t.app, 'PUT', '/api/admin/items', owner, item('A', [{ id: 'c1', name: 'Чёрный', pics: [pic('a')] }], [offer('o', 'c1', 'M')]))).json.id;
    const b = (await req(t.app, 'PUT', '/api/admin/items', owner, item('B', [{ id: 'c1', name: 'Чёрный', pics: [pic('b')] }], [offer('o', 'c1', 'L')]))).json.id;
    const r = await req(t.app, 'POST', `/api/admin/items/${encodeURIComponent(a)}/merge`, owner, { from: b });
    assert.equal(r.status, 409);
    assert.match(r.json.message, /В обеих вещах есть цвет «Чёрный»/);
    assert.equal((await req(t.app, 'POST', `/api/admin/items/${encodeURIComponent(a)}/merge`, owner, { from: a })).status, 400);
  });
});

describe('карточки каталога по расцветкам', () => {
  type Card = { id: string; color?: string; img: string; price: number; colors: string[]; sizes: string[] };
  const cards = async (id: string, f = {}) => ((await req(t.app, 'GET', '/api/catalog?f=' + encodeURIComponent(JSON.stringify(f)), {})).json.items as Card[]).filter((x) => x.id === id);

  test('у каждого цвета своя карточка с фото, ценой и размерами; свой цвет находится фильтром, к которому его отнесли', async () => {
    const id = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Куртка M65', [{ id: 'cb', name: 'Чёрный', pics: [pic('k1')] }, { id: 'co', name: 'Оливковый', filter: 'green', pics: [pic('k2')] }],
      [offer('o1', 'cb', 'M', 9000), offer('o2', 'co', 'L', 9500)]))).json.id;
    const all = await cards(id);
    assert.deepEqual(all.map((c) => [c.color, c.img, c.price, c.colors, c.sizes]), [['cb', pic('k1'), 9000, ['black'], ['M']], ['co', pic('k2'), 9500, ['green'], ['L']]]);
    assert.deepEqual((await cards(id, { colors: ['green'] })).map((c) => c.color), ['co']);
    assert.deepEqual((await req(t.app, 'GET', '/api/search?q=' + encodeURIComponent('M65'), {})).json.map((c: Card) => c.color), ['cb', 'co']);
    // Избранное хранит модель — одна строка, не по карточке на цвет.
    assert.equal((await req(t.app, 'PUT', '/api/favorites/' + encodeURIComponent(id), anna)).status, 200);
    assert.equal((await req(t.app, 'GET', '/api/favorites', anna)).json.filter((x: { id: string }) => x.id === id).length, 1);
    // Админка видит цвет фильтра своего цвета; неизвестный цвет фильтра не принимается — остаётся прежний.
    const a = await admin(id);
    assert.deepEqual(a.colors.map((c: { name: string; filter: string }) => [c.name, c.filter]), [['Чёрный', 'black'], ['Оливковый', 'green']]);
    const bad = { ...a, isNew: false, colors: a.colors.map((c: { id: string }) => (c.id === 'co' ? { ...c, filter: 'pink' } : c)) };
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, bad)).status, 200);
    assert.equal((await product(id)).colors[1].filter, 'green');
  });

  test('объединённые вещи остаются в каталоге обе — карточками расцветок одной модели', async () => {
    const a = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Кеды Old Skool', [{ id: 'c1', name: 'Чёрный', pics: [pic('v1')] }], [offer('o1', 'c1', '42')]))).json.id;
    const b = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Кеды Old Skool', [{ id: 'c1', name: 'Синий', pics: [pic('v2')] }], [offer('o1', 'c1', '43')]))).json.id;
    assert.equal((await req(t.app, 'POST', `/api/admin/items/${encodeURIComponent(a)}/merge`, owner, { from: b })).status, 200);
    assert.deepEqual((await cards(a)).map((c) => [c.img, c.colors]), [[pic('v1'), ['black']], [pic('v2'), ['blue']]]);
    assert.deepEqual(await cards(b), []);
  });
});

describe('несколько категорий у вещи', () => {
  test('вещь видна в каждой выбранной категории; скрытая категория её не показывает; старое приложение без cats их не стирает', async () => {
    const ids = async (cats: string[]) => (await req(t.app, 'GET', '/api/catalog?f=' + encodeURIComponent(JSON.stringify({ cats })), {})).json.items.map((x: { id: string }) => x.id);
    const r = await req(t.app, 'PUT', '/api/admin/items', owner, item('Худи Champion', [{ id: 'c1', name: 'Серый', pics: [pic('ch')] }], [offer('o', 'c1', 'M')], { cat: 'Верх', cats: ['Верх', 'Футболки'] }));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const id = r.json.id;
    assert.ok((await ids(['top'])).includes(id));
    assert.ok((await ids(['tee'])).includes(id));
    assert.ok(!(await ids(['pants'])).includes(id));
    const a = await admin(id);
    assert.deepEqual([a.cat, a.cats], ['Верх', ['Верх', 'Футболки']]);
    const sc = (await req(t.app, 'GET', '/api/admin/showcase', owner)).json.cats as { id: string; n: number }[];
    assert.ok(sc.find((c) => c.id === 'tee')!.n >= 1);
    // Скрыли «Футболки» — вещь остаётся в «Верхе», фильтр «Футболки» её не находит.
    assert.equal((await req(t.app, 'PUT', '/api/admin/categories/tee', owner, { on: false })).status, 200);
    assert.ok(!(await ids(['tee'])).includes(id));
    assert.ok((await ids(['top'])).includes(id));
    assert.equal((await req(t.app, 'PUT', '/api/admin/categories/tee', owner, { on: true })).status, 200);
    // Приложение из кеша Telegram шлёт только cat — дополнительные категории сохраняются.
    const { cats: _, ...old } = a;
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...old, isNew: false })).status, 200);
    assert.deepEqual((await admin(id)).cats, ['Верх', 'Футболки']);
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...a, isNew: false, cats: ['Верх', 'Нет такой'] })).status, 400);
  });
});

describe('описание вещи (adm15)', () => {
  test('продавец пишет описание — покупатель видит его; сохранение без поля (старое приложение) описание не стирает', async () => {
    const id = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Худи с описанием', [{ id: 'c1', name: 'Серый', pics: [pic('h')] }], [offer('o', 'c1', 'L')], { description: '  Плотный футер.\nНа модели L.  ' }))).json.id;
    assert.equal((await product(id)).description, 'Плотный футер.\nНа модели L.');
    const a = await admin(id);
    assert.equal(a.description, 'Плотный футер.\nНа модели L.');
    const { description: _, ...old } = a;
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...old, isNew: false, brand: 'Nike' })).status, 200);
    assert.equal((await product(id)).description, 'Плотный футер.\nНа модели L.');
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...a, isNew: false, description: 'x'.repeat(2001) })).status, 400);
  });
});

describe('удаление предложения (adm15)', () => {
  test('убранное в редакторе предложение не возвращается после сохранения строкой «нет в наличии»', async () => {
    const id = (await req(t.app, 'PUT', '/api/admin/items', owner, item('Рубашка', [{ id: 'c1', name: 'Белый', pics: [pic('s')] }], [offer('o1', 'c1', 'M'), offer('o2', 'c1', 'L')]))).json.id;
    const a = await admin(id);
    assert.equal((await req(t.app, 'PUT', '/api/admin/items', owner, { ...a, isNew: false, offers: a.offers.slice(0, 1) })).status, 200);
    assert.deepEqual((await admin(id)).offers.map((o: { size: string }) => o.size), ['M']);
    assert.deepEqual((await product(id)).offers.map((o: { size: string }) => o.size), ['M']);
  });
});

describe('миграция 0009: цвет фильтра по названию', () => {
  test('белая вещь из админки перестаёт числиться чёрной; неизвестные названия не трогаются', async () => {
    const { db, close } = await openDb({});
    await db.insert(categories).values({ id: 'sneakers', name: 'Обувь', sort: 0 });
    const c = (id: string, name: string) => ({ id, name, filter: 'black', thumb: '', photos: [] });
    await db.insert(products).values({ id: 'af1', name: 'AF1', brand: 'Nike', categoryId: 'sneakers', colors: [c('c1', 'Белый'), c('c2', 'Кирпичный'), c('c3', 'Серый принт')] });
    await db.execute(sql.raw(readFileSync(new URL('../drizzle/0009_color_filter.sql', import.meta.url), 'utf8')));
    const [p] = await db.select().from(products).where(eq(products.id, 'af1'));
    assert.deepEqual(p.colors.map((x) => [x.id, x.filter]), [['c1', 'white'], ['c2', 'red'], ['c3', 'black']]);
    await close();
  });
});
