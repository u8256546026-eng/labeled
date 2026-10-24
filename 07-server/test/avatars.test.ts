import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { files, users } from '../src/db/schema';
import { fileStore } from '../src/files';
import { backfillAvatars, refreshAvatar } from '../src/services/avatars';
import { as, req, testApp } from './helpers';

// Аватарки на своём сервере: Telegram подменён функцией fetch, сеть не нужна.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');
const owner = as(2001), anna = as(1001);

/** Telegram: photos — есть ли фото; ok — отвечает ли вообще. calls — какие методы вызваны. */
function fakeTelegram(state: { photos: boolean; ok: boolean }) {
  const calls: string[] = [];
  const f = (async (url: string | URL) => {
    const u = String(url);
    calls.push(u.replace(/^.*\/(bot[^/]+\/)?/, ''));
    const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });
    if (!state.ok) return json({ ok: false });
    if (u.endsWith('/getUserProfilePhotos')) return json({ ok: true, result: { total_count: state.photos ? 1 : 0, photos: state.photos ? [[{ file_id: 's', width: 160 }, { file_id: 'b', width: 640 }]] : [] } });
    if (u.endsWith('/getFile')) return json({ ok: true, result: { file_path: 'photos/file_1.jpg' } });
    if (u.includes('/file/bot')) return new Response(JPEG);
    return new Response('', { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

const ctx = () => ({ db: t.db, config: t.config, files: fileStore(t.db, t.config), log: { warn: () => {}, info: () => {}, error: () => {} } as never, limit: () => {}, mail: null });
const annaRow = async () => (await t.db.select().from(users).where(eq(users.tgId, 1001)))[0];

describe('аватарки', () => {
  test('без бота (тесты, разработка) ничего не делает', async () => {
    await refreshAvatar(ctx(), (await annaRow()).id);
    assert.equal((await annaRow()).avatarCheckedAt, null);
  });

  test('фото из Telegram сохраняется у нас и отдаётся везде с нашего адреса', async () => {
    const tg = fakeTelegram({ photos: true, ok: true });
    await refreshAvatar(ctx(), (await annaRow()).id, { fetch: tg.f });
    const a = await annaRow();
    assert.ok(a.avatarFileId);
    assert.deepEqual(tg.calls, ['getUserProfilePhotos', 'getFile', 'file_1.jpg']);
    const path = '/files/' + a.avatarFileId;
    const file = await t.app.inject({ method: 'GET', url: path });
    assert.equal(file.statusCode, 200);
    assert.equal(file.headers['content-type'], 'image/jpeg');
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.photo, path);
    const buyers = (await req(t.app, 'GET', '/api/admin/buyers', owner)).json as { handle: string; photo: string }[];
    assert.equal(buyers.find((b) => b.handle === '@anna_smirnova')!.photo, path);
    assert.equal((await req(t.app, 'GET', '/api/admin/orders/1041', owner)).json.buyerPhoto, path);
  });

  test('в течение суток Telegram не спрашиваем', async () => {
    const tg = fakeTelegram({ photos: true, ok: true });
    await refreshAvatar(ctx(), (await annaRow()).id, { fetch: tg.f });
    assert.deepEqual(tg.calls, []);
  });

  test('Telegram недоступен — прежняя аватарка остаётся', async () => {
    const before = (await annaRow()).avatarFileId;
    await refreshAvatar(ctx(), (await annaRow()).id, { fetch: fakeTelegram({ photos: true, ok: false }).f, force: true });
    assert.equal((await annaRow()).avatarFileId, before);
  });

  test('фото убрали — аватарка и файл удаляются, приложение покажет ссылку Telegram или значок', async () => {
    const old = (await annaRow()).avatarFileId!;
    await refreshAvatar(ctx(), (await annaRow()).id, { fetch: fakeTelegram({ photos: false, ok: true }).f, force: true });
    const a = await annaRow();
    assert.equal(a.avatarFileId, null);
    assert.equal((await t.db.select().from(files).where(eq(files.id, old))).length, 0);
    assert.equal((await req(t.app, 'GET', '/api/me', anna)).json.user.photo, a.photoUrl ?? undefined);
  });

  test('после запуска подтягиваются аватарки сотрудников — видны в списке и журнале', async () => {
    const tg = fakeTelegram({ photos: true, ok: true });
    await backfillAvatars(ctx(), { fetch: tg.f, pauseMs: 0 });
    const staff = (await req(t.app, 'GET', '/api/admin/staff', owner)).json as { photo: string }[];
    assert.ok(staff.length && staff.every((s) => s.photo.startsWith('/files/')));
    await req(t.app, 'POST', '/api/admin/orders/1038/stage', owner, { stage: 3, notify: false });
    const log = (await req(t.app, 'GET', '/api/admin/journal', owner)).json as { items?: { whoPhoto: string }[] } | { whoPhoto: string }[];
    const items = Array.isArray(log) ? log : log.items ?? [];
    assert.ok(items.length && items[0].whoPhoto.startsWith('/files/'));
  });
});
