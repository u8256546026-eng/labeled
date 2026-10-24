import { and, eq, gt, isNull, or } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Rates } from '../../../06-app/src/domain/linkOrder';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { events, journal, settings, users } from '../db/schema';
import type { FileStore } from '../files';
import type { Limit } from '../limits';
import { eventLetter, permanentMailError, type Mailer } from './mail';

/** Окружение служб: база, настройки, файлы, журнал, ограничение частоты, почта. Передаётся в каждую службу. */
export type Ctx = { db: Db; config: Config; files: FileStore; log: FastifyBaseLogger; limit: Limit; mail: Mailer | null };
/** Транзакция или база — службы работают с обоими. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db;

export type Requisites = { bank: string; recipient: string; number: string };
export type SystemState = { maintenanceUntil: string | null; minVersion: string };
export type Legal = { effectiveFrom: string; docs: Record<string, { title: string; sub: string; body: string[] }> };

/** Значения по умолчанию — демо-параметры из макетов. Владелец меняет их в админке (adm21). */
export const DEFAULTS = {
  rates: {
    rate: 11.62,
    markup: [{ upTo: 1000, value: 0.7 }, { upTo: 3000, value: 0.65 }, { upTo: null, value: 0.6 }],
    commission: [{ upTo: 100, value: 300 }, { upTo: 2000, value: 500 }, { upTo: null, value: 1000 }],
    photo: 200, box: 200, protectPct: 1, pointsShare: 0.3,
  } satisfies Rates as Rates,
  requisites: { bank: 'Заглушка Банк', recipient: 'ИП Заглушка', number: '0000 0000 0000 0000' } as Requisites,
  system: { maintenanceUntil: null, minVersion: '0.0.0' } as SystemState,
  /** Оценки магазина на картах — вписываются вручную по настоящим карточкам; пусто — не показываем. */
  reviewsExternal: [] as { name: string; count: number; score: number; url: string }[],
  legal: {
    effectiveFrom: '1 октября 2026',
    docs: {
      offer: { title: 'Публичная оферта', sub: 'Условия продажи и оказания услуг', body: ['Здесь откроется полный текст. Текст предоставляет заказчик.'] },
      privacy: { title: 'Политика персональных данных', sub: 'Какие данные собираем и зачем', body: ['Здесь откроется полный текст. Текст предоставляет заказчик.'] },
    },
  } as Legal,
};
type SettingKey = keyof typeof DEFAULTS;

export async function getSetting<K extends SettingKey>(db: Tx, key: K): Promise<(typeof DEFAULTS)[K]> {
  const [r] = await db.select().from(settings).where(eq(settings.key, key));
  return (r?.value as (typeof DEFAULTS)[K]) ?? structuredClone(DEFAULTS[key]);
}

export async function setSetting<K extends SettingKey>(db: Tx, key: K, value: (typeof DEFAULTS)[K]) {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Запись в журнал действий сотрудника. Пишется в той же транзакции, что и само действие. */
export async function logAction(db: Tx, staffId: number, action: string, target = '', payload?: unknown) {
  await db.insert(journal).values({ staffId, action, target, payload: payload ?? null });
}

export type EventInput = { kind: 'act' | 'pay' | 'ship' | 'err' | 'pts'; channel: 'req' | 'pay' | 'ship' | 'pts' | 'promo'; title: string; sub?: string; act?: string; to: string };

/** Событие покупателя (N). Сообщение бота уходит после транзакции — см. flushNotifications. */
export async function addEvent(db: Tx, userId: number, e: EventInput) {
  await db.insert(events).values({ userId, kind: e.kind, channel: e.channel, title: e.title, sub: e.sub ?? '', act: e.act ?? null, to: e.to });
}

/** Последний запущенный проход рассылки по каждому покупателю. */
const sending = new Map<number, Promise<void>>();

/**
 * Разослать неотправленные события ботом и на почту. Бот — если покупатель разрешил сообщения (AE) и включил
 * эту категорию (AP); почта — если адрес подтверждён и включён канал «Почта». Без BOT_TOKEN и без ящика
 * магазина ничего не отправляется — события всё равно видны в «Событиях».
 *
 * Рассылка запускается после каждого изменяющего запроса, поэтому проходы по одному покупателю идут
 * строго друг за другом: параллельный проход прочитал бы те же неотправленные события и отправил их второй раз.
 * Ошибки только пишутся в журнал — вызывающему не нужно их ловить.
 */
export function flushNotifications(ctx: Ctx, userId: number): Promise<void> {
  const next = (sending.get(userId) ?? Promise.resolve())
    .then(() => sendPending(ctx, userId))
    .catch((err) => ctx.log.warn({ err }, 'уведомления'));
  sending.set(userId, next);
  void next.then(() => { if (sending.get(userId) === next) sending.delete(userId); });
  return next;
}

type UserRow = typeof users.$inferSelect;
type EventRow = typeof events.$inferSelect;
const HOUR = 3600_000;

/** Кнопка сообщения: открыть Mini App на заказе события или на главной. */
const appLink = (config: Config, e: EventRow) => {
  const start = e.to.startsWith('/order/') ? 'order_' + e.to.slice(7) : '';
  return config.botLink + (start ? '?startapp=' + start : '');
};

async function sendPending(ctx: Ctx, userId: number) {
  const [u] = await ctx.db.select().from(users).where(eq(users.id, userId));
  if (!u) return;
  await sendBot(ctx, u);
  await sendMail(ctx, u);
}

async function sendBot(ctx: Ctx, u: UserRow) {
  const { db, config, log } = ctx;
  if (!config.botMessages) return;
  if (!u.botAllowed || !u.notif.bot) return;
  const list = await db.select().from(events).where(and(eq(events.userId, u.id), isNull(events.notifiedAt)));
  const done = (id: number) => db.update(events).set({ notifiedAt: new Date() }).where(eq(events.id, id));
  // Как у писем: только события последнего часа. Пока бот не мог писать (не разрешён, выключен), события копятся;
  // после разрешения покупатель получил бы их все разом — устаревшие отмечаем без отправки, они есть в «Событиях».
  const fresh = Date.now() - HOUR;
  for (const e of list) {
    const prefs = u.notif as Record<string, boolean>;
    if (e.at.getTime() < fresh || (e.channel !== 'promo' && prefs[e.channel] === false)) { await done(e.id); continue; }
    try {
      const res = await fetch(`${config.telegramApi}/bot${config.botToken}/sendMessage`, {
        method: 'POST', signal: AbortSignal.timeout(8000), headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: u.tgId, text: e.title + (e.sub ? '\n' + e.sub : ''),
          reply_markup: { inline_keyboard: [[{ text: e.act ?? 'Открыть', url: appLink(config, e) }]] },
        }),
      });
      if (res.ok) await done(e.id);
      // 403 — покупатель остановил бота, 400 — чат не найден: повтор не поможет, событие остаётся в «Событиях».
      else if (res.status === 403 || res.status === 400) { await done(e.id); log.warn({ status: res.status }, 'бот не может написать покупателю'); }
      else log.warn({ status: res.status }, 'бот не отправил сообщение');
    } catch (err) {
      log.warn({ err }, 'бот недоступен');
    }
  }
}

/**
 * Письма о событиях за последний час. Событие, которое не нужно отправлять (почта не подтверждена, канал или
 * категория выключены), сразу отмечается — иначе после включения почты пришли бы старые письма.
 */
async function sendMail(ctx: Ctx, u: UserRow) {
  const { db, config, log, mail } = ctx;
  if (!mail) return;
  const list = await db.select().from(events).where(and(eq(events.userId, u.id), isNull(events.mailedAt), gt(events.at, new Date(Date.now() - HOUR))));
  const done = (id: number) => db.update(events).set({ mailedAt: new Date() }).where(eq(events.id, id));
  const on = u.emailState === 'ok' && !!u.email && u.notif.mail && !u.deletedAt;
  const prefs = u.notif as Record<string, boolean>;
  for (const e of list) {
    if (!on || prefs[e.channel] === false) { await done(e.id); continue; }
    try {
      await mail.send(eventLetter(config, u.email!, e.title, e.sub, { label: e.act ?? 'Открыть в labeled', url: appLink(config, e) }));
      await done(e.id);
    } catch (err) {
      if (permanentMailError(err)) await done(e.id);
      log.warn({ code: (err as { responseCode?: number }).responseCode }, 'письмо о событии не отправлено');
    }
  }
}

/** Разослать неотправленные сообщения бота и письма за последний час — после каждого изменяющего запроса. */
export async function flushPending(ctx: Ctx) {
  const bot = ctx.config.botMessages, mail = !!ctx.mail;
  if (!bot && !mail) return;
  const unsent = bot && mail ? or(isNull(events.notifiedAt), isNull(events.mailedAt)) : bot ? isNull(events.notifiedAt) : isNull(events.mailedAt);
  const rows = await ctx.db.selectDistinct({ u: events.userId }).from(events).where(and(unsent, gt(events.at, new Date(Date.now() - HOUR))));
  for (const r of rows) await flushNotifications(ctx, r.u);
}
