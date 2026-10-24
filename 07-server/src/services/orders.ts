import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { CheckoutLine, Delivery, PlacedOrder } from '../../../06-app/src/domain/order';
import { maxPoints } from '../../../06-app/src/domain/order';
import type { Order } from '../../../06-app/src/domain/orders';
import { calcLink, type LinkForm, type LinkItem, type Rates } from '../../../06-app/src/domain/linkOrder';
import {
  addresses, claims, files as filesT, linkDrafts, offers, orderHistory, orderItems, orderNumSeq, orders, parcels, payments, photoReports, pointsLedger, products, sizeRequests, users,
} from '../db/schema';
import { conflict, forbidden, invalid, notFound, ruDate } from '../http';
import { buyerOrderView, paymentView, type OrderBundle, type OrderRow } from '../views/order';
import { sizeGridOf, sizeLatin } from './catalog';
import { addEvent, getSetting, type Ctx, type Tx } from './core';

export const REFERRAL_REWARD = 250;

/** Заказы с позициями, историей, посылками, платежами, фотоотчётом и обращением — пачкой. */
export async function loadBundles(db: Tx, os: OrderRow[]): Promise<OrderBundle[]> {
  if (!os.length) return [];
  const ids = os.map((o) => o.id);
  const [items, hist, pcs, pays, reps, cls] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, ids)).orderBy(asc(orderItems.id)),
    db.select().from(orderHistory).where(inArray(orderHistory.orderId, ids)).orderBy(asc(orderHistory.at), asc(orderHistory.id)),
    db.select().from(parcels).where(inArray(parcels.orderId, ids)).orderBy(asc(parcels.n)),
    db.select().from(payments).where(inArray(payments.orderId, ids)),
    db.select().from(photoReports).where(inArray(photoReports.orderId, ids)),
    db.select().from(claims).where(inArray(claims.orderId, ids)),
  ]);
  return os.map((o) => ({
    o, items: items.filter((x) => x.orderId === o.id), history: hist.filter((x) => x.orderId === o.id), parcels: pcs.filter((x) => x.orderId === o.id),
    payments: pays.filter((x) => x.orderId === o.id), report: reps.find((x) => x.orderId === o.id), claim: cls.find((x) => x.orderId === o.id),
  }));
}

async function myOrder(db: Tx, userId: number, num: string, lock = false) {
  const q = db.select().from(orders).where(and(eq(orders.num, num), eq(orders.userId, userId)));
  const [o] = lock ? await q.for('update') : await q;
  if (!o) throw notFound('order_not_found');
  return o;
}

/** «Мои заказы»: заказы, заявки и заявки на размер, новые сверху. */
export async function listOrders(ctx: Ctx, userId: number): Promise<Order[]> {
  const os = await ctx.db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  const views = (await loadBundles(ctx.db, os)).map((b) => buyerOrderView(b, ctx.files));
  const reqs = await ctx.db.select({ r: sizeRequests, p: products }).from(sizeRequests).innerJoin(products, eq(products.id, sizeRequests.productId))
    .where(and(eq(sizeRequests.userId, userId), ne(sizeRequests.state, 'cancelled'))).orderBy(desc(sizeRequests.createdAt));
  const sizeViews: Order[] = reqs.map(({ r, p }) => ({
    num: 'pre-' + r.id, pre: 'Заявка', name: p.name.toLowerCase(), kind: 'stock', sizeRequest: true, title: 'Заявка на размер', sub: `${p.name} · ${r.size}`,
    listTitle: `Заявка на размер ${r.size} · ${p.name.toLowerCase()}`, listMeta: `${ruDate(r.createdAt)} · ${r.color} · размер ${r.size}`,
    group: r.state === 'rejected' ? 'done' : 'decision', thumbs: [p.colors[0]?.thumb ?? ''],
    status: r.state === 'offered' ? 'Есть предложение' : r.state === 'rejected' ? 'Размера не будет' : 'Ждёт подтверждения', tone: r.state === 'rejected' ? 'off' : r.state === 'offered' ? 'live' : 'wait', stage: 0,
    note: r.state === 'offered' ? (r.price ? `Продавец нашёл размер: ${r.price} ₽. Он появится в карточке вещи.` : 'Размер появился в карточке вещи. Успейте оформить, пока его не купили.') : r.state === 'rejected' ? 'Продавец не сможет привезти этот размер.' : 'Цену и возможность заказа подтвердит продавец.',
    acts: r.state === 'review' ? [{ label: 'Отменить заявку', kind: 'danger', sheet: 'cancel' }] : r.state === 'offered' ? [{ label: 'Открыть вещь', kind: 'primary', to: '/product/' + p.id }] : [],
  }));
  return [...sizeViews, ...views];
}

export async function getOrder(ctx: Ctx, userId: number, num: string): Promise<Order> {
  const o = await myOrder(ctx.db, userId, num);
  const [b] = await loadBundles(ctx.db, [o]);
  return buyerOrderView(b, ctx.files);
}

/** Платежи покупателя (W) — по всем его заказам. */
export async function listPayments(ctx: Ctx, userId: number) {
  const rows = await ctx.db.select({ p: payments, o: orders, pc: parcels }).from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId)).leftJoin(parcels, eq(parcels.id, payments.parcelId))
    .where(eq(orders.userId, userId)).orderBy(desc(payments.createdAt));
  const fileIds = rows.flatMap((r) => [r.p.receiptFileId, r.p.sellerReceiptFileId]).filter((x): x is string => !!x);
  const names = fileIds.length ? await ctx.db.select({ id: filesT.id, name: filesT.name }).from(filesT).where(inArray(filesT.id, fileIds)) : [];
  const nm = (id: string | null) => names.find((f) => f.id === id)?.name;
  return rows.map((r) => paymentView(r.p, r.o, r.pc?.n, ctx.files, nm(r.p.receiptFileId), nm(r.p.sellerReceiptFileId)));
}

// ───────────── оформление из наличия ─────────────

/** Сколько штук каждого предложения просят все строки вместе: одна вещь в двух строках не проходит проверку остатка дважды. */
const qtyByOffer = (lines: { offerId: string; qty: number }[]) => lines.reduce((m, l) => m.set(l.offerId, (m.get(l.offerId) ?? 0) + l.qty), new Map<string, number>());

/** Проверка корзины перед оформлением (A, L): новая цена или проданная вещь. */
export async function validateLines(db: Tx, lines: CheckoutLine[]): Promise<CheckoutLine[]> {
  if (!lines.length) return [];
  const need = qtyByOffer(lines);
  const os = (await db.select({ o: offers, visible: products.visible }).from(offers).innerJoin(products, eq(products.id, offers.productId)).where(inArray(offers.id, [...need.keys()])))
    .filter((r) => r.visible).map((r) => r.o);
  return lines.map((l) => {
    const o = os.find((x) => x.id === l.offerId);
    if (!o || o.stock < need.get(l.offerId)!) return { ...l, sold: true, newPrice: undefined };
    return o.price !== l.price ? { ...l, newPrice: o.price } : { ...l, newPrice: undefined, sold: undefined };
  });
}

/**
 * Заказ из наличия (A → C): вещи закрепляются за покупателем (остаток уменьшается), баллы списываются,
 * появляется платёж за товары. Цена и остаток сверяются под блокировкой: если что-то изменилось — 409.
 */
/** Заказ, уже оформленный этой попыткой (тот же ключ): вызывается после блокировки строки покупателя. */
async function replayed<T>(tx: Tx, userId: number, key: string | undefined): Promise<T | undefined> {
  if (!key) return undefined;
  const [o] = await tx.select({ r: orders.clientReply }).from(orders).where(and(eq(orders.userId, userId), eq(orders.clientKey, key)));
  return (o?.r ?? undefined) as T | undefined;
}

export async function placeStockOrder(ctx: Ctx, userId: number, input: { lines: { offerId: string; qty: number; price: number }[]; pointsOff: number; delivery: Delivery; addressId: number; key?: string }): Promise<PlacedOrder> {
  if (!input.lines.length) throw invalid('Корзина пуста');
  return ctx.db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    const again = await replayed<PlacedOrder>(tx, userId, input.key);
    if (again) return again;
    const [addr] = await tx.select().from(addresses).where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)));
    if (!addr) throw invalid('Адрес не найден');
    // Пункт выдачи или постамат CDEK покупатель вписывает сам (адрес или код пункта) — продавец видит его в заказе.
    if (input.delivery.mode !== 'courier' && !input.delivery.pvz.trim()) throw invalid('Укажите пункт выдачи CDEK');
    const need = qtyByOffer(input.lines);
    // Блокируем в одном порядке (по id): два заказа с общими вещами иначе могли бы заблокировать друг друга.
    const os = await tx.select({ o: offers, p: products }).from(offers).innerJoin(products, eq(products.id, offers.productId)).where(inArray(offers.id, [...need.keys()])).orderBy(asc(offers.id)).for('update', { of: offers });
    const lines: CheckoutLine[] = [];
    for (const l of input.lines) {
      const row = os.find((x) => x.o.id === l.offerId);
      if (!row || !row.p.visible || row.o.stock < need.get(l.offerId)!) throw conflict('sold', 'Вещь уже купили');
      if (row.o.price !== l.price) throw conflict('price_changed', 'Цена изменилась');
      const color = row.p.colors.find((c) => c.id === row.o.color);
      lines.push({ key: row.o.id, itemId: row.p.id, offerId: row.o.id, name: row.p.name, img: row.o.img || color?.thumb || '', params: row.o.size ? `${color?.name ?? ''} / ${row.o.size}` : color?.name ?? '', cond: row.o.cond, price: row.o.price, qty: l.qty });
    }
    const goods = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const pointsOff = Math.max(0, Math.floor(input.pointsOff));
    if (pointsOff > maxPoints(u.points, goods)) throw invalid('Баллами можно оплатить до 30% стоимости товаров');
    for (const l of lines) await tx.update(offers).set({ stock: sql`${offers.stock} - ${l.qty}` }).where(eq(offers.id, l.offerId));
    const num = String((await tx.execute(sql`select nextval(${orderNumSeq.seqName}::regclass) as n`)).rows[0].n);
    const total = goods - pointsOff;
    const [o] = await tx.insert(orders).values({
      num, userId, kind: 'stock', title: lines[0].name + (lines.length > 1 ? ` и ещё ${lines.length - 1}` : ''), phase: 'invoiced', stage: 0,
      address: { name: addr.name, phone: addr.phone, city: addr.city, line: addr.line }, delivery: input.delivery, goods, pointsUsed: pointsOff, total,
    }).returning();
    await tx.insert(orderItems).values(lines.map((l) => ({ orderId: o.id, offerId: l.offerId, name: l.name, params: l.params, img: l.img, cond: l.cond, price: l.price, qty: l.qty })));
    await tx.insert(orderHistory).values({ orderId: o.id, label: 'Оформлен — ждёт оплаты', note: 'Вещи закреплены за покупателем' });
    const payId = 'p-' + num;
    await tx.insert(payments).values({ id: payId, orderId: o.id, kind: 'goods', amount: total });
    if (pointsOff) {
      await tx.update(users).set({ points: sql`${users.points} - ${pointsOff}` }).where(eq(users.id, userId));
      await tx.insert(pointsLedger).values({ userId, delta: -pointsOff, kind: 'order', title: `Списание в заказе ${num}`, orderId: o.id });
    }
    const reply: PlacedOrder = { num, lines, goods, pointsOff, total, payId, date: ruDate(o.createdAt) };
    if (input.key) await tx.update(orders).set({ clientKey: input.key, clientReply: reply }).where(eq(orders.id, o.id));
    return reply;
  });
}

/** Вернуть закреплённые вещи и баллы при отмене до оплаты или по решению продавца. */
export async function releaseOrder(tx: Tx, o: OrderRow) {
  if (o.kind === 'stock') {
    const its = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    for (const i of its) if (i.offerId) await tx.update(offers).set({ stock: sql`${offers.stock} + ${i.qty}` }).where(eq(offers.id, i.offerId));
  }
  if (o.pointsUsed) {
    await tx.update(users).set({ points: sql`${users.points} + ${o.pointsUsed}` }).where(eq(users.id, o.userId));
    await tx.insert(pointsLedger).values({ userId: o.userId, delta: o.pointsUsed, kind: 'refund', title: `Возврат баллов по заказу ${o.num}`, orderId: o.id });
  }
}

/**
 * Отмена покупателем (AZ). До оплаты — сразу: вещи и баллы возвращаются. После оплаты и до выкупа/отправки —
 * запрос продавцу (обращение), решение и возврат денег — в админке.
 */
export async function cancelOrder(ctx: Ctx, userId: number, num: string): Promise<'cancelled' | 'requested'> {
  if (num.startsWith('pre-')) {
    const id = Number(num.slice(4));
    const r = await ctx.db.update(sizeRequests).set({ state: 'cancelled' }).where(and(eq(sizeRequests.id, id), eq(sizeRequests.userId, userId), eq(sizeRequests.state, 'review'))).returning();
    if (!r.length) throw conflict('not_cancellable');
    return 'cancelled';
  }
  return ctx.db.transaction(async (tx) => {
    const o = await myOrder(tx, userId, num, true);
    if (['review', 'changed', 'invoiced'].includes(o.phase)) {
      const [pay] = await tx.select().from(payments).where(and(eq(payments.orderId, o.id), eq(payments.kind, 'goods')));
      if (pay?.state === 'review') throw conflict('payment_in_review', 'Оплата на проверке — отмена через обращение');
      await tx.update(orders).set({ phase: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, o.id));
      await tx.insert(orderHistory).values({ orderId: o.id, label: 'Отменён', note: 'Отменён покупателем' });
      await releaseOrder(tx, o);
      return 'cancelled' as const;
    }
    if (o.phase === 'active' && o.stage < 2 && !o.cancelRequestedAt) {
      await tx.update(orders).set({ cancelRequestedAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, o.id));
      await tx.insert(orderHistory).values({ orderId: o.id, label: 'Покупатель просит отменить', note: 'Ждёт решения продавца' });
      return 'requested' as const;
    }
    throw conflict('not_cancellable', 'Заказ уже нельзя отменить');
  });
}

/** «Всё в порядке, получил» (AA). Первый выполненный заказ друга приносит пригласившему 250 баллов — один раз. */
export async function confirmReceipt(ctx: Ctx, userId: number, num: string) {
  return ctx.db.transaction(async (tx) => {
    const o = await myOrder(tx, userId, num, true);
    const ready = o.phase === 'active' && (o.kind === 'stock' ? o.stage >= 3 : o.stage >= 6);
    if (!ready) throw conflict('not_delivered');
    await tx.update(orders).set({ phase: 'done', receivedAt: new Date(), stage: o.kind === 'stock' ? 3 : 7, updatedAt: new Date() }).where(eq(orders.id, o.id));
    await tx.insert(orderHistory).values({ orderId: o.id, label: 'Получен', note: 'Покупатель подтвердил получение' });
    await rewardReferrer(tx, userId);
  });
}

export async function rewardReferrer(tx: Tx, userId: number) {
  const [u] = await tx.select().from(users).where(eq(users.id, userId));
  if (!u?.referrerId) return;
  const done = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.userId, userId), eq(orders.phase, 'done')));
  if (Number(done[0].n) !== 1) return;
  const ins = await tx.insert(pointsLedger).values({ userId: u.referrerId, delta: REFERRAL_REWARD, kind: 'referral', title: 'Друг выполнил первый заказ', friendId: userId }).onConflictDoNothing().returning();
  if (!ins.length) return;
  await tx.update(users).set({ points: sql`${users.points} + ${REFERRAL_REWARD}` }).where(eq(users.id, u.referrerId));
  await addEvent(tx, u.referrerId, { kind: 'pts', channel: 'pts', title: `+${REFERRAL_REWARD} баллов`, sub: 'Друг выполнил первый заказ', to: '/points' });
}

/** Покупатель согласился с изменённой заявкой (J): выставляется счёт на новую сумму. */
export async function acceptChange(ctx: Ctx, userId: number, num: string) {
  return ctx.db.transaction(async (tx) => {
    const o = await myOrder(tx, userId, num, true);
    if (o.phase !== 'changed') throw conflict('not_changed');
    await tx.update(orders).set({ phase: 'invoiced', updatedAt: new Date() }).where(eq(orders.id, o.id));
    await tx.insert(orderHistory).values({ orderId: o.id, label: 'Оформлен — ждёт оплаты', note: 'Покупатель согласился с изменениями' });
    await tx.insert(payments).values({ id: 'p-' + o.num, orderId: o.id, kind: 'goods', amount: o.total }).onConflictDoUpdate({ target: payments.id, set: { amount: o.total, state: 'empty' } });
    return 'p-' + o.num;
  });
}

// ───────────── оплата переводом ─────────────

async function myPayment(tx: Tx, userId: number, payId: string) {
  const [r] = await tx.select({ p: payments, o: orders }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(eq(payments.id, payId)).for('update', { of: payments });
  if (!r || r.o.userId !== userId) throw notFound('payment_not_found');
  return r;
}

/** Чек меняется, пока платёж не ушёл на проверку и не подтверждён. */
const receiptLocked = (p: { state: string }) => p.state === 'ok' || p.state === 'review';

/** Проверка до загрузки файла: платёж покупателя и чек к нему ещё можно приложить. */
export async function receiptAllowed(ctx: Ctx, userId: number, payId: string) {
  const [r] = await ctx.db.select({ p: payments, o: orders }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(eq(payments.id, payId));
  if (!r || r.o.userId !== userId) throw notFound('payment_not_found');
  if (receiptLocked(r.p)) throw conflict('payment_locked');
}

/** Чек к платежу (C): фото или PDF до 10 МБ. После подтверждения менять нельзя. */
export async function attachReceipt(ctx: Ctx, userId: number, payId: string, fileId: string) {
  return ctx.db.transaction(async (tx) => {
    const { p } = await myPayment(tx, userId, payId);
    if (receiptLocked(p)) throw conflict('payment_locked');
    await tx.update(payments).set({ receiptFileId: fileId }).where(eq(payments.id, payId));
  });
}

/** «Перевёл» (C → K): платёж уходит на ручную проверку сотруднику. Это не подтверждение оплаты. */
export async function markTransferred(ctx: Ctx, userId: number, payId: string) {
  return ctx.db.transaction(async (tx) => {
    const { p, o } = await myPayment(tx, userId, payId);
    if (p.state === 'ok') throw conflict('already_paid');
    if (p.state === 'review') return;
    if (o.phase === 'cancelled') throw conflict('order_cancelled');
    await tx.update(payments).set({ state: 'review', sentAt: new Date() }).where(eq(payments.id, payId));
    if (p.kind === 'goods') await tx.insert(orderHistory).values({ orderId: o.id, label: 'Оплата на проверке', note: 'Чек получен, продавец сверяет поступление' });
  });
}

// ───────────── заказ по ссылке ─────────────

export type LinkInput = Pick<LinkForm, 'title' | 'protect' | 'ship' | 'disc'> & { items: (Omit<LinkItem, 'pic'> & { picFileId?: string | null })[]; draftId?: string; key?: string; addressId?: number };

/** Скидку 50% на комиссию даёт подтверждённая почта — один раз, в первом заказе, не вместе с баллами. */
async function commDiscountAllowed(tx: Tx, userId: number) {
  const [u] = await tx.select().from(users).where(eq(users.id, userId));
  if (!u || u.emailState !== 'ok' || u.firstDiscountUsed) return false;
  const prev = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.userId, userId), ne(orders.phase, 'cancelled'), ne(orders.phase, 'rejected')));
  return Number(prev[0].n) === 0;
}

export async function linkRates(ctx: Ctx): Promise<Rates> {
  return getSetting(ctx.db, 'rates');
}

/**
 * Заявка по ссылке (B → AX). Расчёт повторяется на сервере по текущим настройкам; цифры из приложения
 * не принимаются. Баллы списываются сразу и возвращаются при отказе или отмене.
 */
export async function submitLink(ctx: Ctx, userId: number, input: LinkInput) {
  if (!input.items.length) throw invalid('Добавьте товар');
  if (input.title.length > 16) throw invalid('Название — до 16 символов');
  for (const it of input.items) {
    if (!it.url.trim() || !(it.price > 0) || !(it.qty >= 1)) throw invalid('Заполните ссылку, цену и количество');
  }
  await ctx.files.assertOwn(input.items.flatMap((it) => (it.picFileId ? [it.picFileId] : [])), userId, 'link_item');
  return ctx.db.transaction(async (tx) => {
    const rates = await getSetting(tx, 'rates');
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    const again = await replayed<{ num: string; title: string; calc: unknown; date: string }>(tx, userId, input.key);
    if (again) return again;
    // Адрес получения — снимок на момент заявки: покупатель может потом изменить или удалить адрес в профиле.
    const [addr] = input.addressId == null ? [] : await tx.select().from(addresses).where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)));
    if (input.addressId != null && !addr) throw invalid('Адрес не найден');
    const commOk = await commDiscountAllowed(tx, userId);
    if (input.disc === 'comm' && !commOk) throw invalid('Скидка на комиссию недоступна');
    const items: LinkItem[] = input.items.map((it, i) => ({ ...it, key: String(i), plat: it.plat || 'Свой вариант', pic: null }));
    const calc = calcLink(rates, { items, protect: input.protect, disc: input.disc }, u.points, commOk);
    const num = String((await tx.execute(sql`select nextval(${orderNumSeq.seqName}::regclass) as n`)).rows[0].n);
    const pointsUsed = input.disc === 'points' ? calc.disc : 0;
    const [o] = await tx.insert(orders).values({
      num, userId, kind: 'link', title: input.title.trim() || 'Без названия', phase: 'review',
      goods: calc.goods, commission: calc.comm, services: calc.serv, protection: calc.prot, pointsUsed, commDiscount: input.disc === 'comm' ? calc.disc : 0, total: calc.total,
      ratesSnapshot: rates, protect: input.protect, shipMode: input.ship,
      address: addr ? { name: addr.name, phone: addr.phone, city: addr.city, line: addr.line } : null,
    }).returning();
    await tx.insert(orderItems).values(input.items.map((it) => ({
      orderId: o.id, name: '', plat: it.plat || 'Свой вариант', url: it.url.trim(), size: it.size.trim(), qty: it.qty, priceCny: Math.round(it.price), photo: it.photo, box: it.box, picFileId: it.picFileId ?? null,
    })));
    await tx.insert(orderHistory).values({ orderId: o.id, label: 'Ждёт подтверждения', note: 'Заявка ушла продавцу' });
    if (pointsUsed) {
      await tx.update(users).set({ points: sql`${users.points} - ${pointsUsed}` }).where(eq(users.id, userId));
      await tx.insert(pointsLedger).values({ userId, delta: -pointsUsed, kind: 'order', title: `Списание в заявке ${num}`, orderId: o.id });
    }
    if (input.disc === 'comm') await tx.update(users).set({ firstDiscountUsed: true }).where(eq(users.id, userId));
    if (input.draftId) await tx.delete(linkDrafts).where(and(eq(linkDrafts.id, input.draftId), eq(linkDrafts.userId, userId)));
    const reply = { num, title: o.title, calc, date: ruDate(o.createdAt) };
    if (input.key) await tx.update(orders).set({ clientKey: input.key, clientReply: reply }).where(eq(orders.id, o.id));
    return reply;
  });
}

type DraftForm = { items?: ({ pic?: { fileId?: unknown; preview?: string } | null } | null)[] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Черновики заявки (B). Ссылка на фото позиции подписана на сутки, поэтому при чтении подписывается заново —
 * только для своих файлов позиции заявки: черновик хранит форму как прислало приложение.
 */
export async function listDrafts(ctx: Ctx, userId: number) {
  const rows = await ctx.db.select().from(linkDrafts).where(eq(linkDrafts.userId, userId)).orderBy(desc(linkDrafts.updatedAt));
  const fileIdOf = (it: NonNullable<DraftForm['items']>[number]) => (typeof it?.pic?.fileId === 'string' && UUID.test(it.pic.fileId) ? it.pic.fileId : null);
  const ids = rows.flatMap((d) => ((d.form as DraftForm)?.items ?? []).map(fileIdOf)).filter((x): x is string => !!x);
  const own = new Set(ids.length ? (await ctx.db.select({ id: filesT.id }).from(filesT).where(and(inArray(filesT.id, [...new Set(ids)]), eq(filesT.ownerUserId, userId), eq(filesT.kind, 'link_item')))).map((f) => f.id) : []);
  return rows.map((d) => {
    const form = d.form as DraftForm;
    const items = Array.isArray(form?.items) ? form.items.map((it) => { const id = fileIdOf(it); return id && own.has(id) ? { ...it, pic: { ...it!.pic, preview: ctx.files.url(id) } } : it; }) : form?.items;
    return { id: d.id, date: ruDate(d.updatedAt), form: { ...form, items } };
  });
}

const DRAFTS_MAX = 20;
const DRAFT_MAX_BYTES = 64 * 1024;

export async function saveDraft(ctx: Ctx, userId: number, id: string, form: unknown) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) throw invalid('Черновик не сохранён');
  if (JSON.stringify(form).length > DRAFT_MAX_BYTES) throw invalid('Черновик слишком большой');
  const [d] = await ctx.db.select().from(linkDrafts).where(eq(linkDrafts.id, id));
  if (d && d.userId !== userId) throw forbidden();
  if (!d) {
    const [{ n }] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(linkDrafts).where(eq(linkDrafts.userId, userId));
    if (Number(n) >= DRAFTS_MAX) throw conflict('too_many_drafts', `Черновиков — не больше ${DRAFTS_MAX}. Удалите ненужные`);
  }
  await ctx.db.insert(linkDrafts).values({ id, userId, form }).onConflictDoUpdate({ target: linkDrafts.id, set: { form, updatedAt: new Date() }, where: eq(linkDrafts.userId, userId) });
}
export async function deleteDraft(ctx: Ctx, userId: number, id: string) {
  await ctx.db.delete(linkDrafts).where(and(eq(linkDrafts.id, id), eq(linkDrafts.userId, userId)));
}

/** Заявка на отсутствующий размер (7p → 7q). */
export async function createSizeRequest(ctx: Ctx, userId: number, input: { productId: string; color: string; size: string }) {
  const [p] = await ctx.db.select().from(products).where(eq(products.id, input.productId));
  if (!p || !p.visible || !p.preorderAllowed) throw invalid('Для этой вещи нельзя заказать размер');
  // Цвет — из расцветок вещи: продавец видит его в заявке и ищет именно эту расцветку.
  if (!p.colors.some((c) => c.name === input.color)) throw invalid('Выберите цвет вещи');
  const size = sizeLatin(input.size);
  if (!sizeGridOf(p.sizeGrid).includes(size)) throw invalid('Этого размера нет в сетке вещи');
  input = { ...input, size };
  // Повтор той же заявки, пока продавец не ответил, возвращает уже созданную — без второй задачи в админке.
  const [open] = await ctx.db.select().from(sizeRequests).where(and(eq(sizeRequests.userId, userId), eq(sizeRequests.productId, p.id), eq(sizeRequests.color, input.color), eq(sizeRequests.size, input.size), eq(sizeRequests.state, 'review')));
  const [r] = open ? [open] : await ctx.db.insert(sizeRequests).values({ userId, productId: p.id, color: input.color, size: input.size }).returning();
  return { id: 'pre-' + r.id, itemId: p.id, name: p.name, color: input.color, size: input.size, thumb: p.colors[0]?.thumb ?? '', createdAt: r.createdAt.toISOString() };
}
