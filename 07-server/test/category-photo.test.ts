import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, req, testApp, upload } from './helpers';

// Фото плитки категории в каталоге меняет сотрудник с правом «Баннеры и категории».
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const owner = as(2001), buyer = as(1001);

describe('фото категории', () => {
  test('загрузка → сохранение → плитка в каталоге и запись в журнале', async () => {
    const u = upload();
    const up = await t.app.inject({ method: 'POST', url: '/api/admin/categories/upload', payload: u.payload, headers: { ...u.headers, ...owner } });
    assert.equal(up.statusCode, 200);
    const { url } = up.json() as { url: string };
    assert.ok(url.startsWith('http://api.test/files/'));
    assert.equal((await req(t.app, 'PATCH', '/api/admin/categories/tee', owner, { img: url })).status, 200);
    const show = (await req(t.app, 'GET', '/api/showcase', {})).json;
    assert.equal(show.categories.find((c: { id: string }) => c.id === 'tee').img, url);
    const adm = (await req(t.app, 'GET', '/api/admin/showcase', owner)).json;
    assert.equal(adm.cats.find((c: { id: string }) => c.id === 'tee').img, url);
    const log = (await req(t.app, 'GET', '/api/admin/journal', owner)).json as { text: string; obj: string; to?: string }[];
    assert.deepEqual([log[0].text, log[0].obj, log[0].to], ['Изменено фото категории', 'Футболки', '/admin/category/tee']);
  });
  test('чужой адрес, несуществующий файл, нет категории, нет прав', async () => {
    assert.equal((await req(t.app, 'PATCH', '/api/admin/categories/tee', owner, { img: 'https://evil.example/x.png' })).status, 400);
    assert.equal((await req(t.app, 'PATCH', '/api/admin/categories/tee', owner, { img: 'http://api.test/files/00000000-0000-0000-0000-000000000000' })).status, 400);
    const u = upload();
    const { url } = (await t.app.inject({ method: 'POST', url: '/api/admin/categories/upload', payload: u.payload, headers: { ...u.headers, ...owner } })).json() as { url: string };
    assert.equal((await req(t.app, 'PATCH', '/api/admin/categories/nope', owner, { img: url })).status, 404);
    assert.equal((await req(t.app, 'PATCH', '/api/admin/categories/tee', buyer, { img: url })).status, 403);
  });
});
