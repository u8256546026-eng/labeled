import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, req, testApp } from './helpers';

// Живое обновление заказов (live.ts): настоящий поток по HTTP, изменения — через inject того же приложения.
let t: Awaited<ReturnType<typeof testApp>>;
let base = '';
before(async () => { t = await testApp(); base = await t.app.listen({ port: 0, host: '127.0.0.1' }); });
after(async () => { await t.close(); });

const anna = as(1001), maria = as(2003), owner = as(2001);

/** Открыть поток и копить полученные сигналы. */
async function listen(headers: Record<string, string>) {
  const ctl = new AbortController();
  const res = await fetch(base + '/api/live', { headers, signal: ctl.signal });
  const got: string[] = [];
  if (res.ok) {
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    void (async () => { try { for (;;) { const { done, value } = await reader.read(); if (done) break; got.push(...dec.decode(value).split('\n').filter((l) => l.startsWith('data:'))); } } catch { /* закрыт */ } })();
  }
  return { res, got, close: () => ctl.abort() };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('живое обновление заказов', () => {
  test('без входа — 401', async () => {
    assert.equal((await fetch(base + '/api/live')).status, 401);
  });

  test('поток event-stream без буфера nginx', async () => {
    const a = await listen(anna);
    assert.equal(a.res.status, 200);
    assert.match(a.res.headers.get('content-type') ?? '', /text\/event-stream/);
    assert.equal(a.res.headers.get('x-accel-buffering'), 'no');
    a.close();
  });

  test('избранное не шлёт сигнал; действие покупателя — ему и сотрудникам, не другому покупателю', async () => {
    const [a, m, o] = await Promise.all([listen(anna), listen(maria), listen(owner)]);
    await wait(50);
    await req(t.app, 'PUT', '/api/favorites/bomber', anna);
    await wait(350);
    assert.deepEqual([a.got.length, m.got.length, o.got.length], [0, 0, 0]);
    assert.equal((await req(t.app, 'POST', '/api/orders/1045/cancel', anna)).json.result, 'cancelled'); // заказ Анны до оплаты
    await wait(350);
    assert.deepEqual([a.got, m.got, o.got], [['data: orders'], [], ['data: orders']]);
    [a, m, o].forEach((x) => x.close());
  });

  test('действие сотрудника доходит до покупателей; сигналы за 200 мс склеиваются', async () => {
    const [a, m] = await Promise.all([listen(anna), listen(maria)]);
    await wait(50);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1042/parcels/2/track', owner, { track: '10 234 567 891' })).status, 200);
    assert.equal((await req(t.app, 'POST', '/api/admin/orders/1038/stage', owner, { stage: 3, notify: false })).status, 200);
    await wait(350);
    assert.deepEqual([a.got, m.got], [['data: orders'], ['data: orders']]);
    [a, m].forEach((x) => x.close());
  });

  test('закрытый поток убирается из подписок', async () => {
    const a = await listen(anna);
    a.close();
    await wait(100);
    await req(t.app, 'POST', '/api/admin/orders/1038/stage', owner, { stage: 3, notify: false });
    await wait(300);
    assert.deepEqual(a.got, []);
  });
});
