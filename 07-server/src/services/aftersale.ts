import { and, desc, eq, isNull } from 'drizzle-orm';
import { CLAIM_REASONS, refundReady, type Claim, type Refund } from '../../../06-app/src/domain/claims';
import { claimMessages, claims, orders, photoReports, reviews, users } from '../db/schema';
import { conflict, invalid, notFound, ruDate } from '../http';
import { plural } from '../../../06-app/src/lib/format';
import { getSetting, type Ctx } from './core';

async function myOrder(ctx: Ctx, userId: number, num: string) {
  const [o] = await ctx.db.select().from(orders).where(and(eq(orders.num, num), eq(orders.userId, userId)));
  if (!o) throw notFound('order_not_found');
  return o;
}

/** Фотоотчёт со склада (V) — только отправленный сотрудником. */
export async function photoReport(ctx: Ctx, userId: number, num: string) {
  const o = await myOrder(ctx, userId, num);
  const [r] = await ctx.db.select().from(photoReports).where(eq(photoReports.orderId, o.id));
  if (!r?.sentAt) return null;
  return { place: r.place.charAt(0).toUpperCase() + r.place.slice(1), date: ruDate(r.sentAt), note: r.note, pics: r.items.flatMap((x) => x.fileIds).map((id) => ctx.files.url(id)!) };
}

type ClaimRow = typeof claims.$inferSelect;
export function claimView(c: ClaimRow, num: string): Claim {
  return {
    id: String(c.id), orderNum: num, reason: c.reason as Claim['reason'], text: c.text, photos: c.fileIds.length, sentAt: ruDate(c.createdAt),
    state: c.answer ? 'answer' : 'sent', answer: c.answer ?? undefined, refundSum: c.refundSum ?? undefined,
    refund: c.refund ? { to: c.refund.to, val: c.refund.val.replace(/\d(?=\d{4})/g, '•'), bank: c.refund.bank, state: c.refund.state } : undefined,
  };
}

export async function getClaim(ctx: Ctx, userId: number, num: string) {
  const o = await myOrder(ctx, userId, num);
  const [c] = await ctx.db.select().from(claims).where(eq(claims.orderId, o.id)).orderBy(desc(claims.createdAt)).limit(1);
  if (!c) return null;
  const msgs = await ctx.db.select().from(claimMessages).where(eq(claimMessages.claimId, c.id));
  return { ...claimView(c, num), answerText: c.answerText ?? undefined, messages: msgs.map((m) => ({ from: m.from, text: m.text, at: m.at.toISOString() })) };
}

/** Обращение (M): для брака, не той вещи и не того размера фото обязательно. Одно открытое обращение на заказ. */
export async function createClaim(ctx: Ctx, userId: number, input: { orderNum: string; reason: number; text: string; fileIds: string[] }) {
  const o = await myOrder(ctx, userId, input.orderNum);
  const R = CLAIM_REASONS[input.reason];
  if (!R) throw invalid('Выберите, что случилось');
  if (R.photo && !input.fileIds.length) throw invalid('Добавьте фото');
  if (input.reason === 4 && !input.text.trim()) throw invalid('Опишите проблему');
  if (input.fileIds.length > 5) throw invalid('До 5 фото');
  if (!(o.phase === 'active' || o.phase === 'done')) throw conflict('not_allowed');
  await ctx.files.assertOwn(input.fileIds, userId, 'claim');
  // Ищем именно открытое обращение (у заказа могут быть и закрытые) под блокировкой заказа: два нажатия подряд
  // не создадут два открытых обращения.
  const c = await ctx.db.transaction(async (tx) => {
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, o.id)).for('update');
    const [open] = await tx.select({ id: claims.id }).from(claims).where(and(eq(claims.orderId, o.id), isNull(claims.closedAt)));
    if (open) throw conflict('claim_exists', 'По заказу уже есть открытое обращение');
    const [row] = await tx.insert(claims).values({ orderId: o.id, userId, reason: input.reason, topic: R.label, text: input.text.trim(), fileIds: input.fileIds }).returning();
    if (input.text.trim()) await tx.insert(claimMessages).values({ claimId: row.id, from: 'buyer', text: input.text.trim() });
    return row;
  });
  return claimView(c, o.num);
}

/** Дополнительные фото по запросу продавца («Нужны фото»). */
export async function addClaimPhotos(ctx: Ctx, userId: number, claimId: number, fileIds: string[]) {
  const [c] = await ctx.db.select().from(claims).where(and(eq(claims.id, claimId), eq(claims.userId, userId)));
  if (!c) throw notFound();
  if (c.answer !== 'more') throw conflict('photos_not_requested');
  await ctx.files.assertOwn(fileIds, userId, 'claim');
  await ctx.db.update(claims).set({ fileIds: c.fileIds.concat(fileIds).slice(0, 10), answer: null, answerText: null }).where(eq(claims.id, c.id));
}

/** Реквизиты для возврата (Z) — только по одобренному обращению и только для заказа из наличия. */
export async function sendRefund(ctx: Ctx, userId: number, claimId: number, r: Pick<Refund, 'to' | 'val' | 'bank'>) {
  const [row] = await ctx.db.select({ c: claims, o: orders }).from(claims).innerJoin(orders, eq(orders.id, claims.orderId)).where(and(eq(claims.id, claimId), eq(claims.userId, userId)));
  if (!row) throw notFound();
  if (row.o.kind !== 'stock') throw conflict('refund_unavailable', 'Вещи из-за границы выкупаются под вас и не возвращаются');
  if (row.c.answer !== 'ok') throw conflict('not_approved');
  // Возврат выполнен и обращение закрыто — реквизиты больше не меняются (иначе статус «отправлено» вернулся бы).
  if (row.c.closedAt || row.c.refund?.state === 'done') throw conflict('claim_closed', 'Обращение закрыто — возврат уже выполнен');
  if (!refundReady({ ...r, state: 'form' })) throw invalid('Укажите номер полностью и банк');
  const refund = { to: r.to, val: r.val.replace(/\D/g, ''), bank: r.bank.trim(), state: 'sent' as const };
  await ctx.db.update(claims).set({ refund }).where(eq(claims.id, claimId));
  return { ...refund, val: refund.val.replace(/\d(?=\d{4})/g, '•') };
}

// ───────────── отзывы ─────────────

/** Подпись отзыва: «Анна С.» или «Покупатель labeled». */
export const signature = (name: string, sign: 'short' | 'anon') => {
  if (sign === 'anon') return 'Покупатель labeled';
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first;
};

/** Отзыв о покупке (AB): только после получения, один на заказ, публикуется после модерации (adm20). */
export async function submitReview(ctx: Ctx, userId: number, input: { orderNum: string; stars: number; text: string; fileIds: string[]; sign: 'short' | 'anon' }) {
  const o = await myOrder(ctx, userId, input.orderNum);
  if (o.phase !== 'done') throw conflict('not_received');
  if (!(input.stars >= 1 && input.stars <= 5)) throw invalid('Поставьте оценку');
  if (input.text.length > 600) throw invalid('До 600 символов');
  await ctx.files.assertOwn(input.fileIds.slice(0, 5), userId, 'review');
  const [u] = await ctx.db.select().from(users).where(eq(users.id, userId));
  const ins = await ctx.db.insert(reviews).values({ userId, orderId: o.id, signature: signature(u.name, input.sign), stars: input.stars, text: input.text.trim(), about: `Заказ ${o.num} · ${o.kind === 'link' ? 'по ссылке' : 'из наличия'}`, fileIds: input.fileIds.slice(0, 5) }).onConflictDoNothing().returning();
  if (!ins.length) throw conflict('review_exists');
  return { status: 'mod' as const };
}

const ocenok = (n: number) => `${n} ${plural(n, 'оценка', 'оценки', 'оценок')}`;

/**
 * «Отзывы о labeled» (AC): только опубликованные модератором. Оценки с Яндекс Карт и 2ГИС — настройка reviewsExternal,
 * её вписывают вручную по настоящим карточкам магазина; пока пусто — показываем только отзывы из приложения.
 */
export async function publicReviews(ctx: Ctx) {
  const list = await ctx.db.select().from(reviews).where(eq(reviews.state, 'pub')).orderBy(desc(reviews.createdAt));
  const ext = (await getSetting(ctx.db, 'reviewsExternal')).filter((e) => e.count > 0 && e.score > 0);
  const appN = list.length, appAvg = appN ? list.reduce((s, r) => s + r.stars, 0) / appN : 0;
  const total = appN + ext.reduce((s, e) => s + e.count, 0);
  const avg = total ? (appAvg * appN + ext.reduce((s, e) => s + e.score * e.count, 0)) / total : 0;
  const bars = [5, 4, 3, 2, 1].map((n) => ({ n, c: list.filter((r) => r.stars === n).length }));
  const fmt = (x: number) => x.toFixed(1).replace('.', ',');
  return {
    rating: {
      total, score: total ? fmt(avg) : '—',
      count: !total ? 'Пока нет оценок' : ext.length ? `Средняя по всем источникам · ${ocenok(total)}` : ocenok(total),
      bars,
      sources: [{ name: 'В приложении', meta: `${appN} ${plural(appN, 'отзыв', 'отзыва', 'отзывов')} · только после получения заказа`, score: appN ? fmt(appAvg) : '—' },
        ...ext.map((e) => ({ name: e.name, meta: ocenok(e.count), score: fmt(e.score), url: e.url }))],
    },
    items: list.map((r) => ({ id: String(r.id), name: r.signature, date: ruDate(r.createdAt), stars: r.stars, kind: 'app' as const, badge: 'Покупка подтверждена · ' + r.about.replace(/^Заказ \d+ · /, ''), text: r.text, pics: r.fileIds.map((id) => ctx.files.url(id)!), reply: r.reply ?? undefined, status: 'pub' as const })),
  };
}
