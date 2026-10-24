import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { events, users } from '../src/db/schema';
import type { Letter } from '../src/services/mail';
import { as, req, testApp } from './helpers';

// Почта (AN): письмо уходит через ящик магазина, адрес сохраняется только после отправки, ссылка живёт 24 часа.
const sent: Letter[] = [];
let fail: Error | null = null;
const mailer = { async send(l: Letter) { if (fail) throw fail; sent.push(l); } };
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp({ mailer }); });
after(async () => { await t.close(); });

const anna = as(1001), ivan = as(2001);
const tokenOf = (l: Letter) => l.text.match(/token=([0-9a-f]{32})/)![1];
const page = (token: string) => t.app.inject({ method: 'GET', url: '/api/email/confirm?token=' + token });
const me = async (h: Record<string, string>) => (await req(t.app, 'GET', '/api/me', h)).json.user;
const userRow = async (tg: number) => (await t.db.select().from(users).where(eq(users.tgId, tg)))[0];
/** Письма о событиях уходят после ответа — ждём их. */
async function waitLetters(n: number) {
  for (let i = 0; i < 50 && sent.length < n; i++) await new Promise((r) => setTimeout(r, 20));
}

describe('подтверждение почты', () => {
  test('письмо со ссылкой уходит на указанный адрес; почта ждёт подтверждения', async () => {
    const r = await req(t.app, 'POST', '/api/email', anna, { address: ' Anna@Example.com ' });
    assert.equal(r.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'anna@example.com');
    assert.match(sent[0].subject, /Подтвердите почту/);
    assert.ok(sent[0].html.includes('http://api.test/api/email/confirm?token=' + tokenOf(sent[0])));
    assert.deepEqual([(await me(anna)).emailState, (await me(anna)).email], ['wait', 'anna@example.com']);
  });

  test('ссылка подтверждает почту, включает письма и открывает скидку; повторный переход — тоже «подтверждена»', async () => {
    const r = await page(tokenOf(sent[0]));
    assert.equal(r.statusCode, 200);
    assert.match(r.body, /Почта подтверждена/);
    const u = await me(anna);
    assert.deepEqual([u.emailState, u.notif.mail, u.firstDiscount], ['ok', true, true]);
    assert.equal((await page(tokenOf(sent[0]))).statusCode, 200);
  });

  test('чужая или битая ссылка — страница «не подходит», почта не меняется', async () => {
    for (const q of ['0'.repeat(32), 'abc', '<script>']) {
      const r = await t.app.inject({ method: 'GET', url: '/api/email/confirm?token=' + encodeURIComponent(q) });
      assert.equal(r.statusCode, 404);
      assert.match(r.body, /Ссылка не подходит/);
    }
    assert.equal((await t.app.inject({ method: 'GET', url: '/api/email/confirm' })).statusCode, 404);
  });

  test('ящик не принял письмо — 502, адрес не сохранён, приложение не скажет «отправлено»', async () => {
    fail = Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' });
    const r = await req(t.app, 'POST', '/api/email', ivan, { address: 'ivan@example.com' });
    fail = null;
    assert.equal(r.status, 502);
    assert.equal(r.json.error, 'mail_failed');
    const u = await me(ivan);
    assert.deepEqual([u.emailState, u.email], ['none', '']);
  });

  test('через 24 часа ссылка устарела: состояние «ошибка», страница 410; новое письмо — новая ссылка', async () => {
    assert.equal((await req(t.app, 'POST', '/api/email', ivan, { address: 'ivan@example.com' })).status, 200);
    const old = tokenOf(sent.at(-1)!);
    await t.db.update(users).set({ emailSentAt: new Date(Date.now() - 25 * 3600_000) }).where(eq(users.tgId, 2001));
    assert.equal((await me(ivan)).emailState, 'err');
    const r = await page(old);
    assert.equal(r.statusCode, 410);
    assert.match(r.body, /Ссылка устарела/);
    assert.equal((await me(ivan)).emailState, 'err');
    assert.equal((await req(t.app, 'POST', '/api/email', ivan, { address: 'ivan@example.com' })).status, 200);
    const fresh = tokenOf(sent.at(-1)!);
    assert.notEqual(fresh, old);
    assert.equal((await page(old)).statusCode, 404);
    assert.equal((await page(fresh)).statusCode, 200);
    assert.equal((await me(ivan)).emailState, 'ok');
  });

  test('отвязка стирает адрес и выключает письма; старая ссылка больше не подходит', async () => {
    const token = (await userRow(2001)).emailToken!;
    assert.equal((await req(t.app, 'DELETE', '/api/email', ivan)).status, 200);
    const u = await me(ivan);
    assert.deepEqual([u.emailState, u.email, u.notif.mail], ['none', '', false]);
    assert.equal((await page(token)).statusCode, 404);
  });
});

describe('письма о заказах', () => {
  test('событие покупателя с подтверждённой почтой приходит письмом с кнопкой на заказ', async () => {
    const a = await userRow(1001);
    await t.db.insert(events).values({ userId: a.id, kind: 'pay', channel: 'pay', title: 'Оплата подтверждена', sub: 'Заказ 1044', act: 'Открыть заказ', to: '/order/1044' });
    const n = sent.length;
    await req(t.app, 'PUT', '/api/me/notif', anna, {});
    await waitLetters(n + 1);
    const l = sent.at(-1)!;
    assert.deepEqual([l.to, l.subject], ['anna@example.com', 'Оплата подтверждена']);
    assert.ok(l.text.includes('Заказ 1044') && l.html.includes('startapp=order_1044'));
  });

  test('выключенная категория и выключенный канал «Почта» — письма нет', async () => {
    const a = await userRow(1001);
    await req(t.app, 'PUT', '/api/me/notif', anna, { ship: false });
    await t.db.insert(events).values({ userId: a.id, kind: 'ship', channel: 'ship', title: 'Посылка в пути', to: '/order/1044' });
    await req(t.app, 'PUT', '/api/me/notif', anna, { mail: false });
    await t.db.insert(events).values({ userId: a.id, kind: 'pay', channel: 'pay', title: 'Оплата на проверке', to: '/order/1044' });
    const n = sent.length;
    await req(t.app, 'PUT', '/api/me/notif', anna, {});
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(sent.length, n);
    // События отмечены: после включения канала старые письма не догоняют.
    await req(t.app, 'PUT', '/api/me/notif', anna, { mail: true, ship: true });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(sent.length, n);
  });

  test('без подтверждённой почты письма о событиях не уходят', async () => {
    const i = await userRow(2001);
    await t.db.insert(events).values({ userId: i.id, kind: 'pay', channel: 'pay', title: 'Оплата подтверждена', to: '/order/1' });
    const n = sent.length;
    await req(t.app, 'PUT', '/api/me/notif', ivan, { mail: true });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(sent.length, n);
    assert.equal((await me(ivan)).notif.mail, false);
  });
});

describe('без ящика магазина', () => {
  test('в продукте — 503 «отправка не подключена», адрес не сохраняется', async () => {
    const p = await testApp({ mailer: null, config: { production: true } });
    try {
      const r = await req(p.app, 'POST', '/api/email', anna, { address: 'anna@example.com' });
      assert.deepEqual([r.status, r.json.error], [503, 'mail_off']);
      assert.equal((await req(p.app, 'GET', '/api/me', anna)).json.user.emailState, 'none');
    } finally { await p.close(); }
  });
});
