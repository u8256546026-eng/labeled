import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { getSetting } from '../src/services/core';
import { cbrRound, parseCny, refreshCbrRate } from '../src/services/cbr';
import { as, req, testApp } from './helpers';

// Автокурс ЦБ (ответы заказчика 7 октября): курс юаня с сайта ЦБ, округление вверх до копеек,
// при сбое — последний сохранённый курс; владелец может перейти на ручной курс.
let t: Awaited<ReturnType<typeof testApp>>;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

const owner = as(2001);
const XML = (value: string, date = '09.10.2026', nominal = 1) =>
  `<?xml version="1.0" encoding="windows-1251"?><ValCurs Date="${date}" name="Foreign Currency Market"><Valute ID="R01010"><NumCode>036</NumCode><CharCode>AUD</CharCode><Nominal>1</Nominal><Name>A</Name><Value>59,4163</Value></Valute>` +
  `<Valute ID="R01375"><NumCode>156</NumCode><CharCode>CNY</CharCode><Nominal>${nominal}</Nominal><Name>Ю</Name><Value>${value}</Value><VunitRate>${value}</VunitRate></Valute></ValCurs>`;
const fake = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch;
const run = (f: typeof fetch) => refreshCbrRate({ db: t.db, log: t.app.log, url: 'http://cbr.test', fetch: f });

describe('курс ЦБ', () => {
  test('округление вверх до копеек', () => {
    assert.equal(cbrRound(12.732), 12.74);
    assert.equal(cbrRound(12.73), 12.73);
    assert.equal(cbrRound(12.7301), 12.74);
    assert.equal(cbrRound(11.62), 11.62);
  });
  test('разбор XML_daily: курс за 1 ¥ с учётом номинала и дата', () => {
    assert.deepEqual(parseCny(XML('12,7320')), { rate: 12.732, date: '09.10.2026' });
    assert.equal(parseCny(XML('127,32', '09.10.2026', 10))!.rate, 12.732);
    assert.equal(parseCny('<ValCurs Date="09.10.2026"></ValCurs>'), null);
  });
  test('курс попадает в расчёт покупателя', async () => {
    assert.equal(await run(fake(XML('12,7320'))), 'updated');
    const r = (await req(t.app, 'GET', '/api/rates', {})).json;
    assert.equal(r.rate, 12.74);
    assert.equal(r.rateDate, '09.10.2026');
    assert.equal(await run(fake(XML('12,7320'))), 'same');
  });
  test('ЦБ не ответил или ответил без юаня — остаётся последний курс', async () => {
    assert.equal(await run(fake('', 503)), 'failed');
    assert.equal(await run(fake('<html>maintenance</html>')), 'failed');
    assert.equal(await run((async () => { throw new Error('timeout'); }) as unknown as typeof fetch), 'failed');
    assert.equal((await getSetting(t.db, 'rates')).rate, 12.74);
  });
  test('при автокурсе курс из формы настроек не перезаписывает курс ЦБ', async () => {
    const cur = (await req(t.app, 'GET', '/api/admin/settings', owner)).json;
    assert.equal((await req(t.app, 'PUT', '/api/admin/settings', owner, { rates: { ...cur.rates, rate: 99 }, requisites: cur.requisites })).status, 200);
    assert.equal((await getSetting(t.db, 'rates')).rate, 12.74);
  });
  test('ручной курс: владелец задаёт сам, автообновление его не трогает', async () => {
    const cur = (await req(t.app, 'GET', '/api/admin/settings', owner)).json;
    assert.equal((await req(t.app, 'PUT', '/api/admin/settings', owner, { rates: { ...cur.rates, rate: 13.1, rateAuto: false }, requisites: cur.requisites })).status, 200);
    assert.equal(await run(fake(XML('12,9000', '10.10.2026'))), 'manual');
    const r = (await req(t.app, 'GET', '/api/rates', {})).json;
    assert.deepEqual([r.rate, r.rateAuto, r.rateDate], [13.1, false, undefined]);
    // Обратно на автокурс: курс снова ведёт сервер.
    assert.equal((await req(t.app, 'PUT', '/api/admin/settings', owner, { rates: { ...r, rateAuto: true }, requisites: cur.requisites })).status, 200);
    assert.equal(await run(fake(XML('12,9000', '10.10.2026'))), 'updated');
    assert.equal((await getSetting(t.db, 'rates')).rate, 12.9);
  });
});
