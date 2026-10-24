import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { events, files, staff, users } from '../src/db/schema';
import { flushNotifications, type Ctx } from '../src/services/core';
import { as, initData, req, testApp, upload } from './helpers';

// Аудит 22 октября: каждая находка — тест, который падал до исправления.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const owner = as(2001), maria = as(2003), anna = as(1001), stock = as(2012);
const upFile = (url: string, who: Record<string, string>) => { const up = upload(); return t.app.inject({ method: 'POST', url, headers: { ...who, ...up.headers }, payload: up.payload }); };

describe('приглашение сотрудника', () => {
  test('владелец открыл свою же ссылку-приглашение — остаётся владельцем, приглашение не сгорает', async () => {
    const inv = (await req(t.app, 'POST', '/api/admin/staff/invites', owner, { role: 'stock' })).json;
    const r = await req(t.app, 'POST', '/api/session', { authorization: initData({ id: 2001, first_name: 'Иван' }, 'staff_' + inv.code) }, { consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.staff.role, 'owner');
    // Ссылка осталась рабочей для того, кому её отправят.
    const other = await req(t.app, 'POST', '/api/session', { authorization: initData({ id: 4001, first_name: 'Пётр' }, 'staff_' + inv.code) }, { consent: true });
    assert.equal(other.json.staff?.role, 'stock');
  });
});

describe('удаление аккаунта', () => {
  test('фото профиля удаляется с сервера вместе с личными данными', async () => {
    assert.equal((await req(t.app, 'POST', '/api/session', as(4002), { consent: true })).status, 200);
    const [u] = await t.db.select().from(users).where(eq(users.tgId, 4002));
    const id = '00000000-0000-4000-8000-000000004002';
    mkdirSync(t.config.uploadDir, { recursive: true });
    writeFileSync(join(t.config.uploadDir, id), Buffer.from([0xff, 0xd8, 0xff]));
    await t.db.insert(files).values({ id, ownerUserId: u.id, kind: 'avatar', name: 'avatar.jpg', mime: 'image/jpeg', size: 3, path: id, public: true });
    await t.db.update(users).set({ avatarFileId: id }).where(eq(users.id, u.id));
    assert.equal((await t.app.inject({ method: 'GET', url: '/files/' + id })).statusCode, 200);
    assert.equal((await req(t.app, 'DELETE', '/api/me', as(4002))).status, 200);
    assert.equal((await t.app.inject({ method: 'GET', url: '/files/' + id })).statusCode, 404);
    const [gone] = await t.db.select().from(users).where(eq(users.id, u.id));
    assert.equal(gone.avatarFileId, null);
  });
});

describe('сообщения бота', () => {
  test('после разрешения писать бот не присылает старые события пачкой — только за последний час', async () => {
    const [u] = await t.db.select().from(users).where(eq(users.tgId, 1001));
    await t.db.update(users).set({ botAllowed: true, notif: { ...u.notif, bot: true } }).where(eq(users.id, u.id));
    await t.db.update(events).set({ notifiedAt: new Date() }).where(eq(events.userId, u.id));
    await t.db.insert(events).values([
      { userId: u.id, kind: 'pay', channel: 'pay', title: 'Старое', sub: '', to: '/order/1042', at: new Date(Date.now() - 3 * 86400_000) },
      { userId: u.id, kind: 'pay', channel: 'pay', title: 'Свежее', sub: '', to: '/order/1042' },
    ]);
    const sent: string[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => { sent.push(JSON.parse(init!.body!).text); return new Response('{}', { status: 200 }); }) as typeof fetch;
    try {
      const log = { warn() {}, info() {}, error() {} } as unknown as Ctx['log'];
      await flushNotifications({ db: t.db, config: { ...t.config, botMessages: true }, log, mail: null } as unknown as Ctx, u.id);
    } finally { globalThis.fetch = real; }
    assert.deepEqual(sent, ['Свежее']);
    // Старое отмечено и не уйдёт при следующем проходе.
    const left = await t.db.select().from(events).where(eq(events.userId, u.id));
    assert.ok(left.every((e) => e.notifiedAt));
  });
});

describe('обращения и возврат', () => {
  let claimId = '';
  test('реквизиты возврата не меняются после закрытого обращения', async () => {
    claimId = (await req(t.app, 'GET', '/api/claims/1038', maria)).json.id;
    assert.equal((await req(t.app, 'POST', '/api/admin/claims/1038/decide', owner, { answer: 'ok' })).status, 200);
    const body = { to: 'sbp', val: '+7 999 123-45-67', bank: 'Т-Банк' };
    assert.equal((await req(t.app, 'POST', `/api/claims/${claimId}/refund`, maria, body)).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/admin/claims/1038/close', owner)).status, 200);
    const again = await req(t.app, 'POST', `/api/claims/${claimId}/refund`, maria, { ...body, val: '+7 900 000-00-00' });
    assert.equal(again.status, 409);
    assert.equal((await req(t.app, 'GET', '/api/admin/claims/1038', owner)).json.refund.state, 'done');
  });
  test('после закрытого обращения можно открыть новое, но только одно', async () => {
    const c = { orderNum: '1038', reason: 4, text: 'Вопрос по заказу' };
    assert.equal((await req(t.app, 'POST', '/api/claims', maria, c)).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/claims', maria, c)).status, 409);
  });
});

describe('фотоотчёт', () => {
  test('в фотоотчёт нельзя вставить чужой приватный файл (фото обращения, чек) — иначе склад получил бы на него ссылку', async () => {
    const f = await upFile('/api/files?kind=claim', anna);
    assert.equal(f.statusCode, 200, f.body);
    const r = await req(t.app, 'PUT', '/api/admin/photo/1040/items/1', stock, { fileIds: [f.json().id] });
    assert.equal(r.status, 400);
    // Своё фото склада подходит, прежние фото отчёта остаются.
    const mine = (await upFile('/api/admin/photo/1040/upload', stock)).json();
    assert.equal((await req(t.app, 'PUT', '/api/admin/photo/1040/items/1', stock, { fileIds: [mine.id] })).status, 200);
    const cur = (await req(t.app, 'GET', '/api/admin/photo/1040', stock)).json;
    assert.equal((await req(t.app, 'PUT', '/api/admin/photo/1040/items/0', stock, { fileIds: cur.items[0].ids ?? [] })).status, 200);
  });
});

describe('ввод покупателя и продавца', () => {
  test('заявка на размер — только в цвете вещи', async () => {
    const p = (await req(t.app, 'GET', '/api/products/tee', {})).json;
    const size = p.sizeGrid[p.sizeGrid.length - 1];
    assert.equal((await req(t.app, 'POST', '/api/size-requests', anna, { productId: 'tee', color: 'Фиолетовый', size })).status, 400);
    assert.equal((await req(t.app, 'POST', '/api/size-requests', anna, { productId: 'tee', color: p.colors[0].name, size })).status, 200);
  });
  test('категория с уже существующим названием не добавляется молча', async () => {
    const before = (await req(t.app, 'GET', '/api/admin/showcase', owner)).json.cats.length;
    const r = await req(t.app, 'POST', '/api/admin/categories', owner, { name: 'обувь' });
    assert.equal(r.status, 409);
    assert.equal((await req(t.app, 'GET', '/api/admin/showcase', owner)).json.cats.length, before);
  });
  test('по tg id без входа видно только имя пригласившего, без фамилии', async () => {
    const r = await req(t.app, 'GET', '/api/inviter/1001', {});
    assert.deepEqual(r.json, { name: 'Анна' });
  });
});

describe('сотрудники', () => {
  test('владелец не может удалить свой аккаунт — магазин не останется без владельца', async () => {
    const r = await req(t.app, 'DELETE', '/api/me', owner);
    assert.equal(r.status, 409);
    assert.equal((await req(t.app, 'GET', '/api/me', owner)).json.staff.role, 'owner');
  });
  test('у владельца после всех проверок роль владельца', async () => {
    const rows = await t.db.select().from(staff);
    assert.ok(rows.some((s) => s.role === 'owner' && !s.removedAt));
  });
});
