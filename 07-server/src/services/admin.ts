import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { calcLink, type LinkItem, type Rates } from '../../../06-app/src/domain/linkOrder';
import { MAX_PARCELS, OWNER_ONLY, ROLES, SELLER_CANCEL, STAGES, TASK_KIND, type Perm, type Role, type Task } from '../../../06-app/src/admin/model';
import type { AdmItem, AdmSizeReq } from '../../../06-app/src/mocks/admin';
import { rub } from '../../../06-app/src/lib/format';
import { plural } from '../../../06-app/src/lib/format';
import type { StaffRow } from '../auth';
import {
  addresses, banners, categories, favorites, files, sizeRequests, claimMessages, claims, offers, orderHistory, orderItems, orders, parcels, payments, photoReports, pointsLedger, products, reviews, staff, staffInvites, users,
} from '../db/schema';
import { conflict, invalid, notFound, ruDate } from '../http';
import { admBuyer, admClaim, admItem, admOrder, admPayment, admPhotoReport, admRequest, age, COND_LABELS, STOCK_STAGES, when } from '../views/admin';
import { refreshCbrRate } from './cbr';
import { sizeGridOf, sizeLatin } from './catalog';
import { COLORS, colorFilter } from '../../../06-app/src/mocks/catalog';
import { REJECT_REASONS, type OrderRow } from '../views/order';
import { addEvent, getSetting, logAction, setSetting, type Ctx, type Requisites, type Tx } from './core';
import { loadBundles, releaseOrder, rewardReferrer } from './orders';
import { avatarOf } from './avatars';

/** Имя, Telegram и фото покупателя в ответах админки: экраны показывают их и без права «Покупатели». */
async function withBuyers<T extends { buyerId: string }>(db: Tx, list: T[]): Promise<(T & { buyerName: string; buyerHandle: string; buyerPhoto: string })[]> {
  const ids = [...new Set(list.map((x) => Number(x.buyerId)))];
  const us = ids.length ? await db.select({ id: users.id, name: users.name, username: users.username, photoUrl: users.photoUrl, avatarFileId: users.avatarFileId }).from(users).where(inArray(users.id, ids)) : [];
  return list.map((x) => { const u = us.find((y) => y.id === Number(x.buyerId)); return { ...x, buyerName: u?.name ?? 'Покупатель', buyerHandle: u?.username ? '@' + u.username : '', buyerPhoto: u ? avatarOf(u) : '' }; });
}
const withBuyer = async <T extends { buyerId: string }>(db: Tx, x: T) => (await withBuyers(db, [x]))[0];

const minutes = (a: string) => { const n = parseInt(a, 10) || 0; return /д/.test(a) ? n * 1440 : /ч/.test(a) ? n * 60 : n; };

async function bundleByNum(db: Tx, num: string, lock = false) {
  const q = db.select().from(orders).where(eq(orders.num, num));
  const [o] = lock ? await q.for('update') : await q;
  if (!o) throw notFound('order_not_found');
  const [b] = await loadBundles(db, [o]);
  return b;
}

// ───────────── очередь задач (adm02) ─────────────

/** Задачи, которые сейчас ждут действия, — по правам сотрудника. Сверху «давно ждёт», дальше по времени ожидания. */
export async function tasks(ctx: Ctx, s: StaffRow): Promise<Task[]> {
  const db = ctx.db;
  const out: Task[] = [];
  const name = (u: { name: string }) => u.name;
  const [pays, reqs, cls, reps, pcs, mod, refunds, sizes] = await Promise.all([
    db.select({ p: payments, o: orders, u: users, pc: parcels }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).innerJoin(users, eq(users.id, orders.userId)).leftJoin(parcels, eq(parcels.id, payments.parcelId)).where(eq(payments.state, 'review')),
    db.select({ o: orders, u: users }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(and(eq(orders.kind, 'link'), eq(orders.phase, 'review'))),
    db.select({ c: claims, o: orders, u: users }).from(claims).innerJoin(orders, eq(orders.id, claims.orderId)).innerJoin(users, eq(users.id, claims.userId)).where(isNull(claims.closedAt)),
    db.select({ r: photoReports, o: orders, u: users }).from(photoReports).innerJoin(orders, eq(orders.id, photoReports.orderId)).innerJoin(users, eq(users.id, orders.userId)).where(isNull(photoReports.sentAt)),
    db.select({ p: parcels, o: orders }).from(parcels).innerJoin(orders, eq(orders.id, parcels.orderId)).where(and(isNull(parcels.track), eq(parcels.state, 'На складе в России'))),
    db.select({ n: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.state, 'mod')),
    db.select({ o: orders, u: users }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(and(eq(orders.phase, 'cancelled'), sql`${orders.refundDue} > 0`, isNull(orders.refundedAt))),
    db.select({ r: sizeRequests, p: products }).from(sizeRequests).innerJoin(products, eq(products.id, sizeRequests.productId)).where(eq(sizeRequests.state, 'review')).orderBy(desc(sizeRequests.createdAt)),
  ]);
  for (const { p, o, u, pc } of pays) out.push({ id: 'pay-' + p.id, kind: 'pay', title: p.kind === 'goods' ? `Оплата товаров · заказ ${o.num}` : `Оплата доставки · ${o.num}, посылка ${pc?.n}`, sub: name(u) + (p.receiptFileId ? ' · чек приложен' : ' · перевод без чека'), amount: p.amount, age: age(p.sentAt), to: '/admin/pay/' + p.id });
  const reqItems = reqs.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, reqs.map((r) => r.o.id))) : [];
  for (const { o, u } of reqs) {
    const its = reqItems.filter((i) => i.orderId === o.id);
    const plats = [...new Set(its.map((i) => i.plat))].join(', ');
    out.push({ id: 'req-' + o.num, kind: 'req', title: `Заявка «${o.title}»`, sub: `${name(u)} · ${its.length} ${plural(its.length, 'позиция', 'позиции', 'позиций')} · ${plats}`, amount: o.total + o.pointsUsed + o.commDiscount, age: age(o.createdAt), to: '/admin/req/' + o.num });
  }
  for (const { c, o, u } of cls) out.push({ id: 'claim-' + c.id, kind: 'claim', title: 'Обращение по заказу ' + o.num, sub: `${name(u)} · «${c.topic}»`, age: age(c.createdAt), to: '/admin/claim/' + o.num });
  for (const { r, o, u } of reps) out.push({ id: 'photo-' + o.num, kind: 'photo', title: 'Фотоотчёт · заказ ' + o.num, sub: `${name(u)} · ${r.items.length} ${plural(r.items.length, 'вещь', 'вещи', 'вещей')} на ${r.place.replace(/^склад/, 'складе')}`, age: age(r.createdAt), to: '/admin/photo/' + o.num });
  for (const { p, o } of pcs) out.push({ id: `track-${o.num}-${p.n}`, kind: 'track', title: `Трек CDEK · ${o.num}, посылка ${p.n}`, sub: 'Посылка на складе в России, трека нет', age: age(p.waitingSince ?? p.createdAt), to: '/admin/order/' + o.num });
  for (const { o, u } of refunds) out.push({ id: 'refund-' + o.num, kind: 'refund', title: 'Вернуть оплату · заказ ' + o.num, sub: `${name(u)} · заказ отменён продавцом`, amount: o.refundDue, age: age(o.updatedAt), to: '/admin/order/' + o.num });
  if (sizes.length) {
    const list = sizes.slice(0, 3).map(({ r, p }) => `${p.name} ${r.size}`).join(', ') + (sizes.length > 3 ? ' и ещё ' + (sizes.length - 3) : '');
    out.push({ id: 'sizes', kind: 'size', title: 'Заявки на размер · ' + sizes.length, sub: list, age: age(sizes[sizes.length - 1].r.createdAt), to: '/admin/sizes' });
  }
  const n = Number(mod[0].n);
  if (n) out.push({ id: 'reviews', kind: 'review', title: 'Отзывы на модерации', sub: `${n} ${plural(n, 'новый отзыв', 'новых отзыва', 'новых отзывов')} о labeled`, age: '1 д', to: '/admin/reviews' });
  out.forEach((t) => { t.urgent = (t.kind === 'claim' || t.kind === 'track') && minutes(t.age) >= 720; });
  return out.filter((t) => s.perms.includes(TASK_KIND[t.kind].perm))
    .sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || minutes(a.age) - minutes(b.age));
}

// ───────────── оплаты (adm04, adm05) ─────────────

export async function getPayment(ctx: Ctx, id: string) {
  const [p] = await ctx.db.select().from(payments).where(eq(payments.id, id));
  if (!p) throw notFound();
  const [o] = await ctx.db.select().from(orders).where(eq(orders.id, p.orderId));
  const [b] = await loadBundles(ctx.db, [o]);
  return withBuyer(ctx.db, admPayment(p, b, b.parcels.find((x) => x.id === p.parcelId)?.n, ctx.files));
}

async function lockReviewPayment(tx: Tx, id: string) {
  const [p] = await tx.select().from(payments).where(eq(payments.id, id)).for('update');
  if (!p) throw notFound();
  if (p.state !== 'review') throw conflict('already_checked', 'Оплату уже проверили');
  const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId)).for('update');
  return { p, o };
}

/**
 * Подтвердить поступление (adm04): заказ переходит к следующему этапу, покупатель получает уведомление.
 * Заказ уже отменён (продавец отменил, пока перевод ждал проверки): вещи и баллы возвращены, в работу
 * он не возвращается — полученная сумма добавляется к возврату и снова появляется задача «Вернуть оплату».
 */
export async function confirmPayment(ctx: Ctx, s: StaffRow, id: string) {
  await ctx.db.transaction(async (tx) => {
    const { p, o } = await lockReviewPayment(tx, id);
    await tx.update(payments).set({ state: 'ok', checkedAt: new Date(), checkedBy: s.id }).where(eq(payments.id, id));
    if (o.phase === 'cancelled' || o.phase === 'rejected') {
      await tx.update(orders).set({ refundDue: o.refundDue + p.amount, refundedAt: null, updatedAt: new Date() }).where(eq(orders.id, o.id));
      await tx.insert(orderHistory).values({ orderId: o.id, label: 'Оплата получена после отмены', note: `${rub(p.amount)} вернём`, staffId: s.id });
      await addEvent(tx, o.userId, { kind: 'pay', channel: 'pay', title: `Оплата по заказу ${o.num} получена`, sub: `Заказ отменён — вернём ${rub(p.amount)}.`, to: '/order/' + o.num });
      await logAction(tx, s.id, 'payment.confirm', id, { amount: p.amount, refundDue: o.refundDue + p.amount });
      return;
    }
    if (p.kind === 'goods') {
      await tx.update(orders).set({ phase: 'active', stage: 1, updatedAt: new Date() }).where(eq(orders.id, o.id));
      await tx.insert(orderHistory).values({ orderId: o.id, label: o.kind === 'stock' ? STOCK_STAGES[1] : STAGES[1], note: 'Оплата подтверждена продавцом', staffId: s.id });
    } else {
      const [pc] = await tx.select().from(parcels).where(eq(parcels.id, p.parcelId!));
      await tx.insert(orderHistory).values({ orderId: o.id, label: `Доставка посылки ${pc?.n} оплачена`, staffId: s.id });
    }
    await addEvent(tx, o.userId, { kind: 'pay', channel: 'pay', title: `Оплата заказа ${o.num} подтверждена`, sub: p.kind === 'goods' ? 'Продавец сверил поступление.' : 'Доставка посылки оплачена.', to: '/order/' + o.num });
    await logAction(tx, s.id, 'payment.confirm', id, { amount: p.amount });
  });
}

/** «Деньги не пришли» (adm05): причина уходит покупателю, он может перевести заново (C). */
export async function failPayment(ctx: Ctx, s: StaffRow, id: string, why: number, note: string) {
  if (!(why >= 0 && why <= 3)) throw invalid('Выберите причину');
  if (why === 3 && !note.trim()) throw invalid('Опишите причину');
  await ctx.db.transaction(async (tx) => {
    const { o } = await lockReviewPayment(tx, id);
    await tx.update(payments).set({ state: 'fail', checkedAt: new Date(), checkedBy: s.id, failReason: why, failNote: note.trim() || null }).where(eq(payments.id, id));
    await addEvent(tx, o.userId, { kind: 'err', channel: 'pay', title: `Оплата заказа ${o.num} не подтверждена`, sub: 'Продавец указал причину', act: 'Открыть платёж', to: '/order/' + o.num });
    await logAction(tx, s.id, 'payment.fail', id, { why, note });
  });
}

/** Чек продавца для покупателя (W) — после подтверждения оплаты. */
export async function setSellerReceipt(ctx: Ctx, s: StaffRow, id: string, fileId: string | null) {
  const r = await ctx.db.update(payments).set({ sellerReceiptFileId: fileId }).where(and(eq(payments.id, id), eq(payments.state, 'ok'))).returning();
  if (!r.length) throw conflict('not_confirmed');
  await logAction(ctx.db, s.id, fileId ? 'payment.receipt' : 'payment.receipt_remove', id);
}

// ───────────── заявки по ссылке (adm06–adm08) ─────────────

export async function getRequest(ctx: Ctx, num: string) {
  const b = await bundleByNum(ctx.db, num);
  if (b.o.kind !== 'link') throw notFound();
  const rates = (b.o.ratesSnapshot as Rates | null) ?? (await getSetting(ctx.db, 'rates'));
  return { ...(await withBuyer(ctx.db, admRequest(b, ctx.files))), calc: { goods: b.o.goods, comm: b.o.commission, serv: b.o.services, prot: b.o.protection, points: b.o.pointsUsed, commDiscount: b.o.commDiscount, total: b.o.total }, rates };
}

/** Одобрить и выставить счёт (adm06 → покупатель видит счёт). */
export async function approveRequest(ctx: Ctx, s: StaffRow, num: string) {
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (b.o.kind !== 'link' || b.o.phase !== 'review') throw conflict('not_in_review');
    await tx.update(orders).set({ phase: 'invoiced', stage: 0, updatedAt: new Date() }).where(eq(orders.id, b.o.id));
    await tx.insert(payments).values({ id: 'p-' + num, orderId: b.o.id, kind: 'goods', amount: b.o.total }).onConflictDoUpdate({ target: payments.id, set: { amount: b.o.total, state: 'empty' } });
    await tx.insert(orderHistory).values({ orderId: b.o.id, label: STAGES[0], note: 'Продавец проверил ссылки, наличие и цену', staffId: s.id });
    await addEvent(tx, b.o.userId, { kind: 'pay', channel: 'req', title: `Можно оплатить заказ ${num}`, sub: `Продавец подтвердил сумму ${b.o.total.toLocaleString('ru-RU')} ₽.`, act: 'Оплатить', to: '/order/' + num });
    await logAction(tx, s.id, 'request.approve', num);
  });
}

/** Пересчёт заявки по курсам на момент отправки: новая цена позиции меняет товары, комиссию и защиту. */
function recalc(o: OrderRow, items: { priceCny: number | null; qty: number; photo: boolean; box: boolean; removed: boolean }[], rates: Rates) {
  const li: LinkItem[] = items.filter((i) => !i.removed).map((i, k) => ({ key: String(k), plat: 'Poizon', url: '', size: '', qty: i.qty, price: i.priceCny ?? 0, photo: i.photo, box: i.box }));
  const c = calcLink(rates, { items: li, protect: o.protect, disc: 'none' }, 0, false);
  const pointsUsed = Math.min(o.pointsUsed, Math.floor((c.goods + c.comm) * rates.pointsShare));
  const commDiscount = o.commDiscount ? Math.round(c.comm * 0.5) : 0;
  return { goods: c.goods, commission: c.comm, services: c.serv, protection: c.prot, pointsUsed, commDiscount, total: c.goods + c.comm + c.serv + c.prot - pointsUsed - commDiscount };
}

/** Изменить цену (adm07): покупатель видит старую и новую цену и причину (J); до согласия оплаты нет. */
export async function changeRequest(ctx: Ctx, s: StaffRow, num: string, prices: number[], comment: string, removed: boolean[] = []) {
  if (!comment.trim()) throw invalid('Укажите причину');
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (b.o.kind !== 'link' || b.o.phase !== 'review') throw conflict('not_in_review');
    if (prices.length !== b.items.length || prices.some((p, i) => !(p > 0) && !removed[i])) throw invalid('Цена каждой позиции — больше нуля');
    if (b.items.every((_, i) => removed[i])) throw invalid('Уберите не все позиции — иначе откажите по заявке');
    const next = b.items.map((it, i) => ({ ...it, oldPriceCny: it.priceCny, priceCny: removed[i] ? it.priceCny : Math.round(prices[i]), removed: !!removed[i] }));
    if (next.every((it, i) => it.priceCny === b.items[i].priceCny && !it.removed)) throw invalid('Измените цену хотя бы одной позиции');
    for (const it of next) await tx.update(orderItems).set({ priceCny: it.priceCny, oldPriceCny: it.oldPriceCny, removed: it.removed }).where(eq(orderItems.id, it.id));
    const sums = recalc(b.o, next, (b.o.ratesSnapshot as Rates) ?? (await getSetting(tx, 'rates')));
    const back = b.o.pointsUsed - sums.pointsUsed;
    if (back > 0) {
      await tx.update(users).set({ points: sql`${users.points} + ${back}` }).where(eq(users.id, b.o.userId));
      await tx.insert(pointsLedger).values({ userId: b.o.userId, delta: back, kind: 'refund', title: `Возврат баллов по заявке ${num}`, orderId: b.o.id });
    }
    await tx.update(orders).set({ ...sums, phase: 'changed', changeComment: comment.trim(), updatedAt: new Date() }).where(eq(orders.id, b.o.id));
    await tx.insert(orderHistory).values({ orderId: b.o.id, label: 'Продавец изменил заявку', note: comment.trim(), staffId: s.id });
    await addEvent(tx, b.o.userId, { kind: 'act', channel: 'req', title: `Продавец изменил заявку ${num}`, sub: comment.trim() + '. Без вашего согласия заказ не оформится.', act: 'Посмотреть изменения', to: '/order/' + num });
    await logAction(tx, s.id, 'request.change', num, { prices, removed, comment });
  });
}

/** Отказ по заявке (adm08): причина обязательна, баллы возвращаются. */
export async function rejectRequest(ctx: Ctx, s: StaffRow, num: string, why: number, note: string) {
  if (!(why >= 0 && why <= 3)) throw invalid('Выберите причину');
  if (why === 3 && !note.trim()) throw invalid('Опишите причину');
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (b.o.kind !== 'link' || b.o.phase !== 'review') throw conflict('not_in_review');
    await tx.update(orders).set({ phase: 'rejected', rejectReason: why, rejectNote: note.trim() || null, updatedAt: new Date() }).where(eq(orders.id, b.o.id));
    await tx.insert(orderHistory).values({ orderId: b.o.id, label: 'Отклонён', note: REJECT_REASONS[why], staffId: s.id });
    await releaseOrder(tx, b.o);
    await addEvent(tx, b.o.userId, { kind: 'err', channel: 'req', title: `Заявка ${num} отклонена`, sub: REJECT_REASONS[why], to: '/order/' + num });
    await logAction(tx, s.id, 'request.reject', num, { why, note });
  });
}

// ───────────── заказы (adm09–adm11) ─────────────

export async function listOrders(ctx: Ctx) {
  const os = await ctx.db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
  return withBuyers(ctx.db, (await loadBundles(ctx.db, os)).map((b) => admOrder(b, ctx.files)));
}

export async function getOrder(ctx: Ctx, num: string) {
  return withBuyer(ctx.db, admOrder(await bundleByNum(ctx.db, num), ctx.files));
}

/**
 * Смена этапа (adm11). Уведомление покупателю — по желанию сотрудника. На складе в Китае появляется
 * задача фотоотчёта (если покупатель его заказал), на складе в России посылки ждут трека.
 */
export async function setStage(ctx: Ctx, s: StaffRow, num: string, stage: number, notify: boolean) {
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    const o = b.o;
    const labels = o.kind === 'stock' ? STOCK_STAGES : STAGES;
    if (!(stage >= 1 && stage < labels.length)) throw invalid('Нет такого этапа');
    if (o.phase !== 'active') throw conflict('not_active', 'Этапы меняются после подтверждения оплаты');
    if (stage === o.stage) throw invalid('Этап не изменился');
    const final = o.kind === 'link' && stage === labels.length - 1;
    await tx.update(orders).set({ stage, ...(final ? { phase: 'done' as const, receivedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(orders.id, o.id));
    await tx.insert(orderHistory).values({ orderId: o.id, label: labels[stage], staffId: s.id });
    if (o.kind === 'link' && stage === 3 && !b.report && b.items.some((i) => i.photo)) {
      await tx.insert(photoReports).values({ orderId: o.id, items: b.items.filter((i) => i.photo && !i.removed).map((i) => ({ itemId: i.id, fileIds: [] })) });
    }
    if (o.kind === 'link' && stage === 5) {
      await tx.update(parcels).set({ state: 'На складе в России', waitingSince: new Date() }).where(and(eq(parcels.orderId, o.id), isNull(parcels.track)));
    }
    if (final) await rewardReferrer(tx, o.userId);
    if (notify) await addEvent(tx, o.userId, { kind: 'ship', channel: 'ship', title: `Заказ ${num}: ${labels[stage].toLowerCase()}`, sub: '', to: '/order/' + num });
    await logAction(tx, s.id, 'order.stage', num, { stage, label: labels[stage], notify });
  });
}

/** Посылка заказа с суммой доставки (после взвешивания) — появляется платёж «доставка посылки N». */
export async function addParcel(ctx: Ctx, s: StaffRow, num: string, input: { title: string; itemIds: number[]; deliveryAmount?: number }) {
  return ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (b.o.phase !== 'active') throw conflict('not_active');
    const n = b.parcels.length + 1;
    const [pc] = await tx.insert(parcels).values({ orderId: b.o.id, n, title: input.title.trim() || `Посылка ${n}`, state: b.o.kind === 'link' ? 'На складе в Китае' : 'Собирается', itemIds: input.itemIds }).returning();
    if (input.deliveryAmount && input.deliveryAmount > 0) {
      await tx.insert(payments).values({ id: `p-${num}-${n}`, orderId: b.o.id, parcelId: pc.id, kind: 'delivery', amount: Math.round(input.deliveryAmount) });
      await addEvent(tx, b.o.userId, { kind: 'pay', channel: 'pay', title: `Доставка по заказу ${num}`, sub: `Посылка ${n} · ${input.deliveryAmount.toLocaleString('ru-RU')} ₽ ждёт оплаты`, act: 'Оплатить', to: '/order/' + num });
    }
    await logAction(tx, s.id, 'parcel.add', num, input);
    return n;
  });
}

/** Трек CDEK посылки (adm10): только цифры, не короче 10; покупатель получает уведомление. */
export async function saveTrack(ctx: Ctx, s: StaffRow, num: string, parcelN: number, track: string) {
  const t = track.replace(/\D/g, '');
  if (t.length < 10) throw invalid('Трек CDEK — не меньше 10 цифр');
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    const pc = b.parcels.find((p) => p.n === parcelN);
    if (!pc) throw notFound('parcel_not_found');
    await tx.update(parcels).set({ track: t, state: 'Передано в CDEK' }).where(eq(parcels.id, pc.id));
    await addEvent(tx, b.o.userId, { kind: 'ship', channel: 'ship', title: `Заказ ${num} передан в CDEK`, sub: 'Трек доступен', to: '/order/' + num });
    await logAction(tx, s.id, 'parcel.track', `${num}/${parcelN}`, { track: t });
  });
}

/**
 * Счёт за доставку посылки (adm29) после взвешивания на складе в Китае: вес и сумма. Покупатель получает
 * платёж «доставка посылки N»; другие посылки не затрагиваются. parcelN = null — заказ ещё не разбит на посылки:
 * создаётся посылка 1 со всеми вещами.
 */
export async function billParcel(ctx: Ctx, s: StaffRow, num: string, parcelN: number | null, weightKg: number, amount: number) {
  if (!(weightKg > 0) || !(amount > 0)) throw invalid('Укажите вес и сумму');
  return ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (b.o.kind !== 'link' || b.o.phase !== 'active') throw conflict('not_active', 'Счёт за доставку — только у оплаченного заказа из-за границы');
    if (b.o.stage < 3) throw conflict('not_in_warehouse', 'Посылку взвешивают на складе в Китае');
    let pc = parcelN == null ? undefined : b.parcels.find((p) => p.n === parcelN);
    if (parcelN != null && !pc) throw notFound('parcel_not_found');
    if (!pc) {
      if (b.parcels.length) throw invalid('Выберите посылку');
      [pc] = await tx.insert(parcels).values({ orderId: b.o.id, n: 1, title: 'Посылка 1', state: 'На складе в Китае', itemIds: b.items.filter((i) => !i.removed).map((i) => i.id) }).returning();
    }
    if (b.payments.some((x) => x.parcelId === pc!.id)) throw conflict('already_billed', 'Счёт за эту посылку уже выставлен');
    const grams = Math.round(weightKg * 1000);
    await tx.update(parcels).set({ weightG: grams }).where(eq(parcels.id, pc.id));
    await tx.insert(payments).values({ id: `p-${num}-${pc.n}`, orderId: b.o.id, parcelId: pc.id, kind: 'delivery', amount: Math.round(amount) });
    await addEvent(tx, b.o.userId, { kind: 'pay', channel: 'pay', title: `Доставка по заказу ${num}`, sub: `Посылка ${pc.n} · ${rub(Math.round(amount))} ждёт оплаты`, act: 'Оплатить', to: '/order/' + num });
    await logAction(tx, s.id, 'parcel.bill', `${num}/${pc.n}`, { weightG: grams, amount: Math.round(amount) });
    return pc.n;
  });
}

/** Посылка со счётом за доставку или треком — состав не меняется. */
const parcelLocked = (b: { payments: { parcelId: number | null }[] }, pc: { id: number; track: string | null }) => !!pc.track || b.payments.some((x) => x.parcelId === pc.id);

/**
 * Разбиение на посылки (adm34) на складе в Китае: groups[k] — id вещей посылки k+1. До 4 посылок, пустых нет,
 * каждая вещь ровно в одной. Посылки со счётом или треком остаются как были; лишние свободные удаляются.
 * Дальше каждая посылка получает свой счёт (adm29) и трек.
 */
export async function splitParcels(ctx: Ctx, s: StaffRow, num: string, groups: number[][]) {
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (b.o.kind !== 'link' || b.o.phase !== 'active' || b.o.stage !== 3) throw conflict('not_in_warehouse', 'Разбить на посылки можно на этапе «На складе в Китае»');
    const live = b.items.filter((i) => !i.removed).map((i) => i.id);
    if (!groups.length || groups.length > Math.min(MAX_PARCELS, live.length)) throw invalid(`Посылок — от 1 до ${Math.min(MAX_PARCELS, live.length)}`);
    if (groups.some((g) => !g.length)) throw invalid('В каждой посылке должна быть хотя бы одна вещь');
    const all = groups.flat();
    if (all.length !== live.length || new Set(all).size !== all.length || all.some((id) => !live.includes(id))) throw invalid('Каждая вещь — ровно в одной посылке');
    const same = (a: number[], c: number[]) => a.length === c.length && a.every((x) => c.includes(x));
    for (const pc of b.parcels.filter((x) => parcelLocked(b, x))) {
      if (!groups[pc.n - 1] || !same(groups[pc.n - 1], pc.itemIds)) throw conflict('parcel_locked', `Посылка ${pc.n} уже со счётом или треком — её состав не меняется`);
    }
    for (const pc of b.parcels) {
      if (parcelLocked(b, pc)) continue;
      if (pc.n > groups.length) await tx.delete(parcels).where(eq(parcels.id, pc.id));
      else await tx.update(parcels).set({ itemIds: groups[pc.n - 1] }).where(eq(parcels.id, pc.id));
    }
    for (let n = 1; n <= groups.length; n++) {
      if (!b.parcels.some((x) => x.n === n)) await tx.insert(parcels).values({ orderId: b.o.id, n, title: `Посылка ${n}`, state: 'На складе в Китае', itemIds: groups[n - 1] });
    }
    await logAction(tx, s.id, 'parcel.split', num, { parcels: groups.length, groups });
  });
}

/**
 * Отмена продавцом (adm30): причина из списка уходит покупателю, вещи и баллы возвращаются.
 * Если по заказу были подтверждённые оплаты, появляется задача на возврат денег.
 */
export async function cancelOrder(ctx: Ctx, s: StaffRow, num: string, why: number, note: string) {
  if (!SELLER_CANCEL[why]) throw invalid('Нет такой причины');
  if (why === SELLER_CANCEL.length - 1 && !note.trim()) throw invalid('Для «Другой причины» нужен комментарий');
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (['cancelled', 'rejected', 'done'].includes(b.o.phase)) throw conflict('closed', 'Заказ уже закрыт');
    const paid = b.payments.filter((p) => p.state === 'ok').reduce((n, p) => n + p.amount, 0);
    const reason = SELLER_CANCEL[why] + (note.trim() ? '. ' + note.trim() : '');
    await tx.update(orders).set({ phase: 'cancelled', cancelReason: why, cancelNote: note.trim() || null, refundDue: paid, updatedAt: new Date() }).where(eq(orders.id, b.o.id));
    await tx.insert(orderHistory).values({ orderId: b.o.id, label: 'Отменён', note: reason, staffId: s.id });
    await releaseOrder(tx, b.o);
    await addEvent(tx, b.o.userId, { kind: 'err', channel: 'req', title: `Заказ ${num} отменён продавцом`, sub: reason + (paid ? ` Оплату ${rub(paid)} вернём.` : ''), to: '/order/' + num });
    await logAction(tx, s.id, 'order.cancel', num, { why, note, refundDue: paid });
  });
}

/** Деньги по отменённому заказу возвращены — задача на возврат закрывается, покупатель получает уведомление. */
export async function markRefunded(ctx: Ctx, s: StaffRow, num: string) {
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (b.o.phase !== 'cancelled' || !b.o.refundDue) throw conflict('nothing_to_refund');
    if (b.o.refundedAt) return;
    await tx.update(orders).set({ refundedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, b.o.id));
    await addEvent(tx, b.o.userId, { kind: 'pay', channel: 'pay', title: `Оплата по заказу ${num} возвращена`, sub: `${rub(b.o.refundDue)} — проверьте поступление в банке`, to: '/order/' + num });
    await logAction(tx, s.id, 'order.refunded', num, { sum: b.o.refundDue });
  });
}

// ───────────── фотоотчёт (adm12) ─────────────

export async function getPhotoReport(ctx: Ctx, num: string) {
  const b = await bundleByNum(ctx.db, num);
  if (!b.report) throw notFound('report_not_needed');
  return withBuyer(ctx.db, admPhotoReport(b, b.report, ctx.files));
}

export async function setReportPics(ctx: Ctx, s: StaffRow, num: string, itemIndex: number, fileIds: string[]) {
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (!b.report) throw notFound();
    if (b.report.sentAt) throw conflict('already_sent');
    const cur = b.report.items[itemIndex];
    if (!cur) throw notFound();
    // Только фото, загруженные для фотоотчёта, или уже стоящие в нём. Иначе по id чужого приватного файла
    // (чек, фото обращения) склад получил бы подписанную ссылку на него в ответе отчёта.
    const added = [...new Set(fileIds.filter((id) => !cur.fileIds.includes(id)))];
    if (added.length) {
      const ok = await tx.select({ id: files.id }).from(files).where(and(inArray(files.id, added), eq(files.kind, 'report')));
      if (ok.length !== added.length) throw invalid('Загрузите фото для отчёта');
    }
    const items = b.report.items.map((x, i) => (i === itemIndex ? { ...x, fileIds: fileIds.slice(0, 3) } : x));
    await tx.update(photoReports).set({ items }).where(eq(photoReports.id, b.report.id));
    await logAction(tx, s.id, 'report.pics', num, { itemIndex, n: fileIds.length });
  });
}

/** Отправить фотоотчёт: минимум одно фото на вещь. Покупатель видит его в заказе (V). */
export async function sendReport(ctx: Ctx, s: StaffRow, num: string, note: string) {
  await ctx.db.transaction(async (tx) => {
    const b = await bundleByNum(tx, num, true);
    if (!b.report) throw notFound();
    if (b.report.sentAt) throw conflict('already_sent');
    if (b.report.items.some((x) => !x.fileIds.length)) throw invalid('Добавьте фото каждой вещи');
    await tx.update(photoReports).set({ sentAt: new Date(), sentBy: s.id, note: note.trim() }).where(eq(photoReports.id, b.report.id));
    await addEvent(tx, b.o.userId, { kind: 'ship', channel: 'ship', title: `Фотоотчёт по заказу ${num}`, sub: 'Фото со склада в Китае готовы', act: 'Смотреть', to: '/photo/' + num });
    await logAction(tx, s.id, 'report.send', num);
  });
}

// ───────────── обращения (adm13) ─────────────

async function claimOf(db: Tx, num: string) {
  const b = await bundleByNum(db, num);
  const [c] = await db.select().from(claims).where(eq(claims.orderId, b.o.id)).orderBy(desc(claims.createdAt)).limit(1);
  if (!c) throw notFound('claim_not_found');
  return { b, c };
}

export async function getClaim(ctx: Ctx, num: string) {
  const { b, c } = await claimOf(ctx.db, num);
  const msgs = await ctx.db.select().from(claimMessages).where(eq(claimMessages.claimId, c.id)).orderBy(asc(claimMessages.at));
  return { ...(await withBuyer(ctx.db, admClaim(c, msgs, b))), reason: c.reason, answer: c.answer, refundSum: c.refundSum, refund: c.refund, photos: c.fileIds.map((id) => ctx.files.url(id)!) };
}

export async function replyClaim(ctx: Ctx, s: StaffRow, num: string, text: string) {
  if (!text.trim()) throw invalid('Напишите ответ');
  await ctx.db.transaction(async (tx) => {
    const { b, c } = await claimOf(tx, num);
    if (c.closedAt) throw conflict('closed');
    await tx.insert(claimMessages).values({ claimId: c.id, from: 'admin', staffId: s.id, text: text.trim() });
    await addEvent(tx, b.o.userId, { kind: 'act', channel: 'req', title: `Ответ по заказу ${num}`, sub: text.trim().slice(0, 120), act: 'Открыть', to: '/claim/' + num });
    await logAction(tx, s.id, 'claim.reply', num);
  });
}

/**
 * Решение по обращению (adm28 → Y): вернуть деньги (сумма не больше оплаченного, только вещи из наличия),
 * запросить фото или отказать с причиной. После того как покупатель прислал реквизиты, решение не меняется.
 */
export async function decideClaim(ctx: Ctx, s: StaffRow, num: string, answer: 'ok' | 'no' | 'more', text: string, refundSum?: number) {
  await ctx.db.transaction(async (tx) => {
    const { b, c } = await claimOf(tx, num);
    if (c.closedAt) throw conflict('closed');
    if (c.refund) throw conflict('refund_in_progress', 'Покупатель уже прислал реквизиты для возврата');
    if (answer === 'no' && !text.trim()) throw invalid('Укажите причину отказа');
    let sum: number | null = null;
    if (answer === 'ok') {
      if (b.o.kind !== 'stock') throw conflict('no_refund', 'Вещи из-за границы не возвращаются');
      const paid = b.payments.filter((p) => p.kind === 'goods' && p.state === 'ok').reduce((n, p) => n + p.amount, 0);
      sum = Math.round(refundSum ?? paid);
      if (!(sum > 0)) throw invalid('Укажите сумму возврата');
      if (sum > paid) throw invalid('Больше суммы заказа');
    }
    await tx.update(claims).set({ answer, answerText: text.trim() || null, refundSum: sum }).where(eq(claims.id, c.id));
    await addEvent(tx, b.o.userId, { kind: answer === 'no' ? 'err' : 'act', channel: 'req', title: `Решение по обращению · заказ ${num}`, sub: answer === 'ok' ? `Вернём ${rub(sum!)} — укажите реквизиты` : answer === 'no' ? 'Продавец отказал' : 'Продавец просит фото', act: 'Открыть', to: '/claim/' + num });
    await logAction(tx, s.id, 'claim.decide', num, { answer, refundSum: sum });
  });
}

export async function closeClaim(ctx: Ctx, s: StaffRow, num: string) {
  await ctx.db.transaction(async (tx) => {
    const { c } = await claimOf(tx, num);
    if (c.closedAt) return;
    await tx.update(claims).set({ closedAt: new Date(), refund: c.refund ? { ...c.refund, state: 'done' } : null }).where(eq(claims.id, c.id));
    await logAction(tx, s.id, 'claim.close', num);
  });
}

// ───────────── каталог (adm14–adm16) ─────────────

export async function listItems(ctx: Ctx): Promise<AdmItem[]> {
  const [ps, os, cs] = await Promise.all([ctx.db.select().from(products).orderBy(desc(products.createdAt)), ctx.db.select().from(offers), ctx.db.select().from(categories)]);
  return ps.map((p) => admItem(p, os.filter((o) => o.productId === p.id), (id) => cs.find((c) => c.id === id)?.name ?? id));
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 30);

/**
 * Сохранить вещь (adm15): название, бренд, категория, расцветки с фото и предложения по расцветкам.
 * Цвет фильтра каталога — по названию цвета из справочника, у своего цвета — выбранный продавцом. Предложения со статусом 0 не видны покупателям.
 * Новая вещь получает id из названия.
 */

export async function saveItem(ctx: Ctx, s: StaffRow, item: Omit<AdmItem, 'description'> & { description?: string; isNew?: boolean }) {
  const extra = (item.preorderSizes ?? []).map(sizeLatin).filter(Boolean);
  if (!item.name.trim()) throw invalid('Укажите название');
  if (!item.colors.length) throw invalid('Добавьте расцветку');
  const noPics = item.colors.find((c) => !c.pics.length);
  if (noPics) throw invalid(item.colors.length > 1 ? `Добавьте фото расцветки «${noPics.name}»` : 'Добавьте фото');
  const twice = item.colors.find((c, i) => item.colors.findIndex((x) => x.name.trim() === c.name.trim()) !== i);
  if (twice) throw invalid(`Цвет «${twice.name}» указан дважды`);
  if (new Set(item.colors.map((c) => c.id)).size !== item.colors.length) throw invalid('Повторяется расцветка');
  if (item.offers.some((o) => !item.colors.some((c) => c.id === o.color))) throw invalid('Предложение без расцветки');
  if (!item.offers.some((o) => o.price > 0)) throw invalid('Укажите цену');
  return ctx.db.transaction(async (tx) => {
    // Категории — по названиям, основная первой. Без поля cats (приложение до 22.10 из кеша Telegram) дополнительные не трогаем.
    const all = await tx.select().from(categories);
    const ids = [...new Set((item.cats?.length ? item.cats : [item.cat]).map((n) => all.find((c) => c.name === n)?.id))];
    if (ids.some((x) => !x)) throw invalid('Нет такой категории');
    const [exists] = item.isNew ? [] : await tx.select().from(products).where(eq(products.id, item.id));
    const main = ids[0]!;
    const extraCategories = item.cats ? (ids.slice(1) as string[]) : (exists?.extraCategories ?? []).filter((c) => c !== main);
    const id = exists ? exists.id : slug(item.name) + '-' + randomBytes(2).toString('hex');
    const colors = item.colors.map((c) => {
      const photos = c.pics.map((u) => ctx.files.url(u, true) ?? u);
      // Свой цвет («Оливковый») — цвет фильтра, к которому его отнёс продавец; без него (старые данные) — прежний.
      const own = COLORS.some((x) => x.id === c.filter) ? c.filter! : '';
      const filter = colorFilter(c.name) || own || exists?.colors.find((x) => x.id === c.id)?.filter || '';
      return { id: c.id, name: c.name.trim(), filter, thumb: photos[0], photos };
    });
    // Сетка — размеры предложений и «Размеры под заказ» (которых нет в наличии, но их можно запросить).
    // preorder пустой: под заказ доступны все размеры сетки без вещей в наличии (см. productView).
    const sizeGrid = sizeGridOf(extra, item.offers.filter((o) => o.price > 0).map((o) => o.size));
    // Без поля (приложение до 22.10 из кеша Telegram) описание не трогаем — иначе сохранение стёрло бы его.
    const description = item.description === undefined ? exists?.description ?? '' : item.description.trim();
    const vals = { name: item.name.trim(), brand: item.brand.trim(), description, categoryId: main, extraCategories, colors, visible: item.show, preorderAllowed: item.preorder, sizeGrid, preorder: {} };
    if (exists) await tx.update(products).set(vals).where(eq(products.id, id));
    else await tx.insert(products).values({ id, ...vals });
    const keep = item.offers.filter((o) => o.price > 0);
    const old = await tx.select().from(offers).where(eq(offers.productId, id));
    // Убранные в редакторе предложения (и предложения убранных расцветок) удаляются, как при «Удалить вещь»:
    // заказы хранят свою копию названия, цены и фото, корзина покажет такую вещь проданной.
    const gone = old.filter((x) => !keep.some((k) => k.id === x.id)).map((x) => x.id);
    if (gone.length) await tx.delete(offers).where(inArray(offers.id, gone));
    for (const o of keep) {
      const [, cond, note] = COND_LABELS.find(([l]) => l === o.cond) ?? COND_LABELS[0];
      const known = old.find((x) => x.id === o.id);
      const v = { productId: id, color: o.color, size: sizeLatin(o.size), cond, note, price: o.price, stock: Math.max(0, o.qty), img: colors.find((c) => c.id === o.color)!.thumb };
      if (known) await tx.update(offers).set(v).where(eq(offers.id, o.id));
      else await tx.insert(offers).values({ id: `${id}-${randomBytes(3).toString('hex')}`, ...v });
    }
    await logAction(tx, s.id, exists ? 'item.update' : 'item.create', id);
    return id;
  });
}

/**
 * Объединить вещи (adm15): вещь fromId — та же модель, заведённая отдельно в другом цвете, — становится расцветками вещи id.
 * Переезжают цвета с фото, предложения (id сохраняются — на них ссылаются корзины и заказы), заявки на размер и избранное;
 * сама вещь fromId удаляется. Одинаковые названия цветов не объединяются: продавец сначала меняет цвет у одной из вещей.
 */
export async function mergeItem(ctx: Ctx, s: StaffRow, id: string, fromId: string) {
  if (id === fromId) throw invalid('Выберите другую вещь');
  await ctx.db.transaction(async (tx) => {
    const ps = await tx.select().from(products).where(inArray(products.id, [id, fromId])).orderBy(asc(products.id)).for('update');
    const to = ps.find((p) => p.id === id);
    const from = ps.find((p) => p.id === fromId);
    if (!to || !from) throw notFound();
    const same = from.colors.find((c) => to.colors.some((x) => x.name.trim() === c.name.trim()));
    if (same) throw conflict('same_color', `В обеих вещах есть цвет «${same.name}» — смените его у одной из них`);
    // id расцветок уникальны только внутри вещи (у обеих обычно c1) — переезжающим даём новые.
    const ids = new Map(from.colors.map((c) => [c.id, 'c' + randomBytes(3).toString('hex')]));
    const preorder = { ...to.preorder, ...Object.fromEntries(Object.entries(from.preorder).filter(([c]) => ids.has(c)).map(([c, l]) => [ids.get(c)!, l])) };
    await tx.update(products).set({
      colors: to.colors.concat(from.colors.map((c) => ({ ...c, id: ids.get(c.id)! }))),
      sizeGrid: sizeGridOf(to.sizeGrid, from.sizeGrid), preorder,
      preorderAllowed: to.preorderAllowed || from.preorderAllowed,
    }).where(eq(products.id, id));
    for (const o of await tx.select().from(offers).where(eq(offers.productId, fromId))) {
      // Предложения без расцветки у прежней вещи (убранные, остаток 0) — к её первой расцветке.
      await tx.update(offers).set({ productId: id, color: ids.get(o.color) ?? ids.get(from.colors[0]?.id ?? '') ?? o.color }).where(eq(offers.id, o.id));
    }
    await tx.update(sizeRequests).set({ productId: id }).where(eq(sizeRequests.productId, fromId));
    await tx.execute(sql`INSERT INTO ${favorites} (user_id, product_id, created_at) SELECT user_id, ${id}, created_at FROM ${favorites} WHERE product_id = ${fromId} ON CONFLICT DO NOTHING`);
    await tx.delete(favorites).where(eq(favorites.productId, fromId));
    await tx.delete(products).where(eq(products.id, fromId));
    await logAction(tx, s.id, 'item.merge', id, { name: from.name });
  });
}

/**
 * Удалить вещь (adm15): продана целиком или добавлена по ошибке. Предложения удаляются вместе с ней,
 * заявки на размер и избранное покупателей по этой вещи — тоже. Заказы хранят свою копию названия, фото и цены,
 * поэтому история заказов не меняется; файлы фото остаются — на них ссылаются позиции заказов.
 */
export async function deleteItem(ctx: Ctx, s: StaffRow, id: string) {
  await ctx.db.transaction(async (tx) => {
    const [p] = await tx.select({ name: products.name }).from(products).where(eq(products.id, id)).for('update');
    if (!p) throw notFound();
    await tx.delete(sizeRequests).where(eq(sizeRequests.productId, id));
    await tx.delete(favorites).where(eq(favorites.productId, id));
    await tx.delete(products).where(eq(products.id, id));
    await logAction(tx, s.id, 'item.delete', id, { name: p.name });
  });
}

export async function showcase(ctx: Ctx) {
  const [bs, cs, ps] = await Promise.all([ctx.db.select().from(banners).orderBy(asc(banners.sort)), ctx.db.select().from(categories).orderBy(asc(categories.sort)), ctx.db.select({ c: products.categoryId, extra: products.extraCategories }).from(products)]);
  const btn: Record<string, string> = { link: 'Оформить заказ', email: 'Подробнее', invite: 'Пригласить друга', catalog: 'Смотреть' };
  const to: Record<string, string> = { link: 'заказ по ссылке', email: 'подтверждение почты', invite: 'приглашение', catalog: 'каталог' };
  return {
    banners: bs.map((b) => {
      const cta = b.cta || btn[b.target] || '';
      const where = b.target === 'catalog' && b.cat ? 'категория «' + (cs.find((c) => c.id === b.cat)?.name ?? b.cat) + '»' : to[b.target] ?? '';
      return { id: b.id, title: b.title, sub: `Кнопка «${cta}» → ${where}`, on: b.visible, img: b.img ?? undefined, cta, target: b.target, cat: b.cat ?? undefined };
    }),
    cats: cs.map((c) => ({ id: c.id, name: c.name, img: c.img || undefined, n: ps.filter((x) => x.c === c.id || x.extra.includes(c.id)).length, on: c.visible })),
  };
}

export async function setBanner(ctx: Ctx, s: StaffRow, id: number, on: boolean) {
  await ctx.db.update(banners).set({ visible: on }).where(eq(banners.id, id));
  await logAction(ctx.db, s.id, on ? 'banner.show' : 'banner.hide', String(id));
}

export type BannerInput = { title: string; cta: string; target: 'link' | 'catalog' | 'email' | 'invite'; cat?: string | null; img: string };

/**
 * Баннер (adm32): картинка 1080 × 600 без текста, заголовок до 40 символов, текст кнопки и куда она ведёт.
 * Без картинки, заголовка и кнопки не сохраняется. Новый баннер — в конце карусели, сразу показан.
 */
export async function saveBanner(ctx: Ctx, s: StaffRow, id: number | null, b: BannerInput) {
  if (!b.img || !b.title.trim() || !b.cta.trim()) throw invalid('Добавьте картинку, заголовок и кнопку');
  if (b.target === 'catalog' && b.cat) {
    const [c] = await ctx.db.select().from(categories).where(eq(categories.id, b.cat));
    if (!c) throw invalid('Нет такой категории');
  }
  const row = { title: b.title.trim(), cta: b.cta.trim(), target: b.target, cat: b.target === 'catalog' ? b.cat ?? null : null, img: b.img, sub: '' };
  if (id == null) {
    const max = (await ctx.db.select({ m: sql<number>`coalesce(max(sort),0)::int` }).from(banners))[0].m;
    const [r] = await ctx.db.insert(banners).values({ ...row, visible: true, sort: Number(max) + 1 }).returning();
    await logAction(ctx.db, s.id, 'banner.add', String(r.id), { title: row.title });
    return r.id;
  }
  const r = await ctx.db.update(banners).set(row).where(eq(banners.id, id)).returning();
  if (!r.length) throw notFound();
  await logAction(ctx.db, s.id, 'banner.save', String(id), { title: row.title });
  return id;
}

export async function deleteBanner(ctx: Ctx, s: StaffRow, id: number) {
  const r = await ctx.db.delete(banners).where(eq(banners.id, id)).returning();
  if (!r.length) throw notFound();
  await logAction(ctx.db, s.id, 'banner.delete', String(id), { title: r[0].title });
}

// ───────────── заявки на размер (adm31) ─────────────

const SIZE_STATE: Record<string, AdmSizeReq['state']> = { review: 'wait', offered: 'yes', rejected: 'no' };

export async function listSizes(ctx: Ctx): Promise<AdmSizeReq[]> {
  const rows = await ctx.db.select({ r: sizeRequests, p: products, u: users }).from(sizeRequests).innerJoin(products, eq(products.id, sizeRequests.productId)).innerJoin(users, eq(users.id, sizeRequests.userId))
    .where(ne(sizeRequests.state, 'cancelled')).orderBy(desc(sizeRequests.createdAt)).limit(200);
  return rows.map(({ r, p, u }) => ({
    id: String(r.id), item: p.name, productId: p.id, size: r.size, color: r.color, who: u.name,
    when: when(r.createdAt).replace(/^./, (c) => c.toUpperCase()), img: p.colors.find((c) => c.name === r.color)?.thumb ?? p.colors[0]?.thumb ?? '', state: SIZE_STATE[r.state] ?? 'wait',
  }));
}

/** «Размер есть — уведомить» (сообщение бота со ссылкой на карточку) или «Отклонить заявку». */
export async function answerSize(ctx: Ctx, s: StaffRow, id: number, answer: 'yes' | 'no') {
  await ctx.db.transaction(async (tx) => {
    const [row] = await tx.select({ r: sizeRequests, p: products }).from(sizeRequests).innerJoin(products, eq(products.id, sizeRequests.productId)).where(eq(sizeRequests.id, id)).for('update');
    if (!row) throw notFound();
    if (row.r.state !== 'review') throw conflict('answered', 'Заявку уже обработали');
    await tx.update(sizeRequests).set({ state: answer === 'yes' ? 'offered' : 'rejected' }).where(eq(sizeRequests.id, id));
    await addEvent(tx, row.r.userId, answer === 'yes'
      ? { kind: 'act', channel: 'req', title: `Размер ${row.r.size} появился`, sub: `${row.p.name} · ${row.r.color}. Успейте оформить, пока его не купили.`, act: 'Открыть вещь', to: '/product/' + row.p.id }
      : { kind: 'err', channel: 'req', title: `Размера ${row.r.size} не будет`, sub: `${row.p.name} · продавец не сможет привезти этот размер`, to: '/order/pre-' + id });
    await logAction(tx, s.id, answer === 'yes' ? 'size.notify' : 'size.reject', String(id));
  });
}

export async function setCategory(ctx: Ctx, s: StaffRow, id: string, on: boolean) {
  await ctx.db.update(categories).set({ visible: on }).where(eq(categories.id, id));
  await logAction(ctx.db, s.id, on ? 'category.show' : 'category.hide', id);
}
/** Фото плитки категории в каталоге — только файл, загруженный через /categories/upload (наш публичный адрес). */
export async function setCategoryImg(ctx: Ctx, s: StaffRow, id: string, img: string) {
  const m = img.startsWith(ctx.config.publicUrl + '/files/') ? /^[\w-]+$/.exec(img.slice(ctx.config.publicUrl.length + 7)) : null;
  if (!m) throw invalid('Загрузите фото категории');
  const [f] = await ctx.db.select().from(files).where(eq(files.id, m[0]));
  if (!f || !f.public || !f.mime.startsWith('image/')) throw invalid('Загрузите фото категории');
  const r = await ctx.db.update(categories).set({ img }).where(eq(categories.id, id)).returning();
  if (!r.length) throw notFound();
  await logAction(ctx.db, s.id, 'category.photo', id);
}
export async function addCategory(ctx: Ctx, s: StaffRow, name: string) {
  if (!name.trim()) throw invalid('Укажите название');
  // Название — ключ категории в карточке вещи (adm15): второе «Обувь» сделало бы выбор неоднозначным.
  const [dup] = await ctx.db.select({ id: categories.id }).from(categories).where(sql`lower(${categories.name}) = lower(${name.trim()})`);
  if (dup) throw conflict('category_exists', 'Такая категория уже есть');
  const max = (await ctx.db.select({ m: sql<number>`coalesce(max(sort),0)::int` }).from(categories))[0].m;
  const id = slug(name) || 'cat-' + randomBytes(2).toString('hex');
  const made = await ctx.db.insert(categories).values({ id, name: name.trim(), sort: Number(max) + 1 }).onConflictDoNothing().returning();
  if (!made.length) throw conflict('category_exists', 'Такая категория уже есть');
  await logAction(ctx.db, s.id, 'category.add', id);
}

// ───────────── покупатели и баллы (adm18, adm19) ─────────────

export async function listBuyers(ctx: Ctx) {
  const us = await ctx.db.select().from(users).where(isNull(users.deletedAt)).orderBy(desc(users.createdAt)).limit(500);
  const staffIds = new Set((await ctx.db.select({ u: staff.userId }).from(staff).where(isNull(staff.removedAt))).map((x) => x.u));
  // Сотрудники без заказов — не покупатели: в списке не показываем.
  return (await buyerViews(ctx.db, us)).filter((b) => !(staffIds.has(Number(b.id)) && b.orders === 0));
}

export async function buyer(ctx: Ctx, id: number) {
  const [u] = await ctx.db.select().from(users).where(eq(users.id, id));
  if (!u) throw notFound();
  return (await buyerViews(ctx.db, [u]))[0];
}

/** Карточки покупателей (adm18, adm19) пачкой: одинаковое число запросов к базе для одного и для 500 покупателей. */
async function buyerViews(db: Tx, us: (typeof users.$inferSelect)[]) {
  if (!us.length) return [];
  const ids = us.map((u) => u.id);
  const [os, inv, manual, addr, waitPay, waitReq, waitClaim] = await Promise.all([
    db.select().from(orders).where(and(inArray(orders.userId, ids), ne(orders.phase, 'cancelled'), ne(orders.phase, 'rejected'))),
    db.select({ u: pointsLedger.userId, s: sql<number>`coalesce(sum(delta),0)::int` }).from(pointsLedger).where(and(inArray(pointsLedger.userId, ids), eq(pointsLedger.kind, 'referral'))).groupBy(pointsLedger.userId),
    db.select().from(pointsLedger).where(and(inArray(pointsLedger.userId, ids), eq(pointsLedger.kind, 'manual'))).orderBy(desc(pointsLedger.at)),
    db.select().from(addresses).where(inArray(addresses.userId, ids)).orderBy(desc(addresses.isMain), asc(addresses.id)),
    db.select({ u: orders.userId, n: sql<number>`count(*)::int` }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(and(inArray(orders.userId, ids), eq(payments.state, 'review'))).groupBy(orders.userId),
    db.select({ u: orders.userId, n: sql<number>`count(*)::int` }).from(orders).where(and(inArray(orders.userId, ids), eq(orders.phase, 'review'))).groupBy(orders.userId),
    db.select({ u: claims.userId, n: sql<number>`count(*)::int` }).from(claims).where(and(inArray(claims.userId, ids), isNull(claims.closedAt))).groupBy(claims.userId),
  ]);
  const count = (rows: { u: number; n: number }[], id: number) => Number(rows.find((r) => r.u === id)?.n ?? 0);
  return us.map((u) => {
    const mine = os.filter((o) => o.userId === u.id);
    const v = admBuyer(u, { orders: mine.length, spent: mine.reduce((s2, o) => s2 + o.total + o.pointsUsed, 0), invitePts: Number(inv.find((r) => r.u === u.id)?.s ?? 0) },
      manual.filter((m) => m.userId === u.id).map((m) => ({ text: m.title, delta: m.delta, date: ruDate(m.at) })));
    const waiting: [string, 'wait' | 'live' | 'err'] | null = count(waitPay, u.id) ? ['Оплата на проверке', 'wait'] : count(waitReq, u.id) ? ['Заявка', 'live'] : count(waitClaim, u.id) ? ['Обращение', 'err'] : null;
    return { ...v, phone: addr.find((a) => a.userId === u.id)?.phone ?? '—', waiting };
  });
}

/** Ручное начисление или списание (adm19); причина видна покупателю в истории баллов. */
export async function adjustPoints(ctx: Ctx, s: StaffRow, userId: number, delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) throw invalid('Количество баллов');
  if (!reason.trim()) throw invalid('Укажите причину');
  await ctx.db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!u) throw notFound();
    if (u.points + delta < 0) throw conflict('balance', 'Больше, чем на балансе');
    await tx.update(users).set({ points: u.points + delta }).where(eq(users.id, userId));
    await tx.insert(pointsLedger).values({ userId, delta, kind: 'manual', title: reason.trim(), staffId: s.id });
    await addEvent(tx, userId, { kind: 'pts', channel: 'pts', title: `${delta > 0 ? '+' : '−'}${Math.abs(delta)} баллов`, sub: reason.trim(), to: '/points' });
    await logAction(tx, s.id, delta > 0 ? 'points.add' : 'points.sub', String(userId), { delta, reason });
  });
}

// ───────────── отзывы (adm20) ─────────────

export async function listReviews(ctx: Ctx) {
  const rows = await ctx.db.select({ r: reviews, u: { photoUrl: users.photoUrl, avatarFileId: users.avatarFileId } }).from(reviews).leftJoin(users, eq(users.id, reviews.userId)).orderBy(desc(reviews.createdAt));
  return rows.map(({ r, u }) => ({ id: String(r.id), who: r.signature, photo: u ? avatarOf(u) : '', stars: r.stars, when: ruDate(r.createdAt), text: r.text, about: r.about, state: r.state }));
}
export async function setReview(ctx: Ctx, s: StaffRow, id: number, state: 'pub' | 'hid') {
  const r = await ctx.db.update(reviews).set({ state, moderatedBy: s.id }).where(eq(reviews.id, id)).returning();
  if (!r.length) throw notFound();
  await logAction(ctx.db, s.id, state === 'pub' ? 'review.publish' : 'review.hide', String(id));
}

// ───────────── настройки (adm21) ─────────────

export async function getPrices(ctx: Ctx) {
  return { rates: await getSetting(ctx.db, 'rates'), requisites: await getSetting(ctx.db, 'requisites') };
}

const asc2 = (t: { upTo: number | null }[]) => t.every((x, i) => (i === t.length - 1 ? x.upTo === null : x.upTo !== null && x.upTo > 0 && (i === 0 || x.upTo > (t[i - 1].upTo ?? 0))));

/** Курс, ступени, услуги и реквизиты. Действуют для новых заявок; выставленные счета не пересчитываются. */
export async function savePrices(ctx: Ctx, s: StaffRow, rates: Rates, req: Requisites) {
  const auto = rates.rateAuto !== false;
  if (!(auto || rates.rate > 0) || !asc2(rates.markup) || !asc2(rates.commission)) throw invalid('Проверьте курс и границы ступеней');
  if ([...rates.markup, ...rates.commission].some((t) => !(t.value >= 0)) || !(rates.protectPct >= 0 && rates.protectPct <= 100) || !(rates.photo >= 0) || !(rates.box >= 0)) throw invalid('Проверьте значения');
  if (!req.bank.trim() || !req.recipient.trim() || req.number.replace(/\D/g, '').length < 10) throw invalid('Проверьте реквизиты');
  // При автокурсе курс ЦБ не берём из формы: его ведёт сервер (services/cbr.ts).
  const wasAuto = await ctx.db.transaction(async (tx) => {
    const cur = await getSetting(tx, 'rates');
    const next: Rates = auto
      ? { ...rates, rate: cur.rate, rateDate: cur.rateDate, rateAuto: true, pointsShare: cur.pointsShare }
      : { ...rates, rateDate: undefined, rateAuto: false, pointsShare: cur.pointsShare };
    await setSetting(tx, 'rates', next);
    await setSetting(tx, 'requisites', { bank: req.bank.trim(), recipient: req.recipient.trim(), number: req.number.trim() });
    await logAction(tx, s.id, 'settings.prices', '', { rates: next, req, prevRate: cur.rate });
    return cur.rateAuto !== false;
  });
  // Автокурс только что включили — сразу подтягиваем свежий курс ЦБ.
  if (auto && !wasAuto) void refreshCbrRate({ db: ctx.db, log: ctx.log, url: ctx.config.cbrUrl }).catch(() => {});
}

// ───────────── сотрудники (adm22–adm24) ─────────────

export async function listStaff(ctx: Ctx, me: StaffRow) {
  const rows = await ctx.db.select({ s: staff, u: users }).from(staff).innerJoin(users, eq(users.id, staff.userId)).where(isNull(staff.removedAt)).orderBy(asc(staff.id));
  return rows.map(({ s, u }) => ({ id: String(s.id), name: u.name, handle: u.username ? '@' + u.username : '—', photo: avatarOf(u), role: s.role as Role, since: 'с ' + ruDate(s.createdAt), perms: (s.perms as Perm[] | null) ?? null, me: s.id === me.id }));
}

export async function saveStaff(ctx: Ctx, me: StaffRow, id: number, role: Role, perms: Perm[] | null) {
  if (role === 'owner' || !ROLES[role]) throw invalid('Роль');
  await ctx.db.transaction(async (tx) => {
    const [t] = await tx.select().from(staff).where(eq(staff.id, id));
    if (!t || t.removedAt) throw notFound();
    if (t.role === 'owner') throw conflict('owner');
    await tx.update(staff).set({ role, perms: perms ? perms.filter((p) => !OWNER_ONLY.includes(p)) : null }).where(eq(staff.id, id));
    await logAction(tx, me.id, 'staff.update', String(id), { role, perms });
  });
}

export async function removeStaff(ctx: Ctx, me: StaffRow, id: number) {
  await ctx.db.transaction(async (tx) => {
    const [t] = await tx.select().from(staff).where(eq(staff.id, id));
    if (!t) throw notFound();
    if (t.role === 'owner') throw conflict('owner', 'Владельца нельзя убрать');
    await tx.update(staff).set({ removedAt: new Date() }).where(eq(staff.id, id));
    await logAction(tx, me.id, 'staff.remove', String(id));
  });
}

/** Одноразовая ссылка на 24 часа: t.me/<бот>/app?startapp=staff_<код>. Привязка — при входе по ней. */
export async function createInvite(ctx: Ctx, me: StaffRow, role: Role) {
  if (role === 'owner' || !ROLES[role]) throw invalid('Роль');
  const code = randomBytes(5).toString('hex');
  await ctx.db.insert(staffInvites).values({ code, role: role as 'manager', createdBy: me.id, expiresAt: new Date(Date.now() + 86400000) });
  await logAction(ctx.db, me.id, 'staff.invite', code, { role });
  return { code, role, link: `${ctx.config.botLink}?startapp=staff_${code}` };
}

// ───────────── сводка (adm25) ─────────────

/** Москва — UTC+3 круглый год. Сводка считает дни по Москве, как и даты в интерфейсе, а не по поясу сервера. */
const MSK = 3 * 3600_000;

/** Начало периода сводки: сегодня, последние 7 дней или текущий месяц — с полуночи по Москве. */
export function summaryFrom(range: 'day' | 'week' | 'month', now = new Date()) {
  const d = new Date(now.getTime() + MSK);
  d.setUTCHours(0, 0, 0, 0);
  if (range === 'week') d.setUTCDate(d.getUTCDate() - 6);
  if (range === 'month') d.setUTCDate(1);
  return new Date(d.getTime() - MSK);
}

export async function summary(ctx: Ctx, range: 'day' | 'week' | 'month') {
  const from = summaryFrom(range);
  const [newOrders, paid, comm, newBuyers, all] = await Promise.all([
    ctx.db.select({ n: sql<number>`count(*)::int` }).from(orders).where(gte(orders.createdAt, from)),
    ctx.db.select({ s: sql<number>`coalesce(sum(amount),0)::int` }).from(payments).where(and(eq(payments.state, 'ok'), gte(payments.checkedAt, from))),
    ctx.db.select({ s: sql<number>`coalesce(sum(${orders.commission} - ${orders.commDiscount}),0)::int` }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(and(eq(payments.state, 'ok'), eq(payments.kind, 'goods'), gte(payments.checkedAt, from))),
    ctx.db.select({ n: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, from)),
    listOrders(ctx),
  ]);
  const cnt = (g: string) => all.filter((o) => o.group === g).length;
  return {
    sub: range === 'day' ? 'Сегодня, ' + ruDate(new Date()) : range === 'week' ? `${ruDate(from)} — ${ruDate(new Date())}` : new Date().toLocaleDateString('ru-RU', { month: 'long', timeZone: 'Europe/Moscow' }).replace(/^./, (c) => c.toUpperCase()),
    v: [Number(newOrders[0].n), Number(paid[0].s), Number(comm[0].s), Number(newBuyers[0].n)] as [number, number, number, number],
    stages: { req: cnt('req'), pay: cnt('pay'), buy: cnt('buy'), ship: cnt('ship'), prob: cnt('prob') },
    newReq: (await ctx.db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.kind, 'link'), gte(orders.createdAt, from))))[0].n,
  };
}

