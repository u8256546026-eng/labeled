import type { FastifyBaseLogger } from 'fastify';
import { getSetting, setSetting, type Tx } from './core';

/** Курс ЦБ округляется до копеек всегда вверх (решение заказчика 7 октября): 12,732 → 12,74. */
export const cbrRound = (v: number) => Math.ceil(Math.round(v * 1e6) / 1e4) / 100;

/** Курс юаня и дата из XML_daily: { rate: 12.732, date: '09.10.2026' }; null — юаня в ответе нет. */
export function parseCny(xml: string): { rate: number; date: string } | null {
  const date = /<ValCurs[^>]*\bDate="(\d{2}\.\d{2}\.\d{4})"/.exec(xml)?.[1];
  const m = /<CharCode>CNY<\/CharCode>[\s\S]*?<Nominal>(\d+)<\/Nominal>[\s\S]*?<Value>([\d.,]+)<\/Value>/.exec(xml);
  if (!date || !m) return null;
  const rate = parseFloat(m[2].replace(',', '.')) / Number(m[1]);
  return rate > 0 && Number.isFinite(rate) ? { rate, date } : null;
}

export type CbrResult = 'updated' | 'same' | 'manual' | 'off' | 'failed';

/**
 * Подтянуть курс юаня с сайта ЦБ в настройку rates. Если владелец выключил автокурс — не трогаем.
 * Если ЦБ не ответил, остаётся последний сохранённый курс: приём заявок не останавливается.
 */
export async function refreshCbrRate(deps: { db: Tx; log: FastifyBaseLogger; url: string; fetch?: typeof fetch }): Promise<CbrResult> {
  if (!deps.url) return 'off';
  if ((await getSetting(deps.db, 'rates')).rateAuto === false) return 'manual';
  let got: { rate: number; date: string } | null;
  try {
    const res = await (deps.fetch ?? fetch)(deps.url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    got = parseCny(await res.text());
    if (!got) throw new Error('в ответе ЦБ нет курса юаня');
  } catch (err) {
    deps.log.warn({ err }, 'курс ЦБ не получен — расчёт по последнему сохранённому курсу');
    return 'failed';
  }
  const rate = cbrRound(got.rate);
  return deps.db.transaction(async (tx) => {
    const cur = await getSetting(tx, 'rates');
    if (cur.rateAuto === false) return 'manual';
    if (cur.rate === rate && cur.rateDate === got.date) return 'same';
    await setSetting(tx, 'rates', { ...cur, rate, rateDate: got.date });
    deps.log.info({ rate, date: got.date, prev: cur.rate }, 'курс ЦБ обновлён');
    return 'updated';
  });
}
