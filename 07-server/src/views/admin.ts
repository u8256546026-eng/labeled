// Виды для режима администратора — в формах из 06-app/src/mocks/admin.ts, которые уже используют экраны adm01–adm27.
import type { AdmClaim, AdmItem, AdmOrder, AdmPayment, AdmPhotoReport, AdmRequest } from '../../../06-app/src/mocks/admin';
import { STAGES } from '../../../06-app/src/admin/model';
import { avatarOf } from '../services/avatars';
import { deliveryText } from '../../../06-app/src/domain/order';
import { rub } from '../../../06-app/src/lib/format';
import type { claimMessages, claims, offers, products, users } from '../db/schema';
import type { FileStore } from '../files';
import { ruDate, ruTime } from '../http';
import type { OrderBundle, PaymentRow } from './order';

/** Сколько ждёт: «12 мин», «3 ч», «1 д». */
export function age(from: Date | null | undefined, now = new Date()): string {
  if (!from) return '0 мин';
  const m = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 60000));
  return m < 60 ? `${m} мин` : m < 1440 ? `${Math.floor(m / 60)} ч` : `${Math.floor(m / 1440)} д`;
}

/** «вчера в 19:02», «сегодня в 10:15», «3 октября в 9:40». */
export function when(d: Date, now = new Date()): string {
  const day = (x: Date) => x.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
  const y = new Date(now.getTime() - 86400000);
  const t = ruTime(d);
  return day(d) === day(now) ? `сегодня в ${t}` : day(d) === day(y) ? `вчера в ${t}` : `${ruDate(d)} в ${t}`;
}

export const STOCK_STAGES = ['Оформлен', 'Оплата подтверждена', 'Передано в CDEK', 'Доставлен'];
type UserRow = typeof users.$inferSelect;

const payText = (p: PaymentRow | undefined, fallback: string) => !p ? fallback
  : p.state === 'ok' ? 'Оплачено · ' + rub(p.amount) : p.state === 'review' ? 'На проверке · ' + rub(p.amount) : p.state === 'fail' ? 'Не подтверждена · ' + rub(p.amount) : 'Счёт выставлен · ' + rub(p.amount);

export function admPayment(p: PaymentRow, b: OrderBundle, parcelN: number | undefined, files: FileStore): AdmPayment {
  return {
    id: p.id, kind: p.kind, orderNum: b.o.num, orderLabel: b.o.num + (parcelN ? `, посылка ${parcelN}` : ''), amount: p.amount, buyerId: String(b.o.userId),
    when: p.sentAt ? when(p.sentAt).replace(/^./, (c) => c.toUpperCase()).replace(' в ', ', ') : '—', purpose: 'labeled ' + b.o.num + (parcelN ? '-' + parcelN : ''),
    receipt: files.url(p.receiptFileId), state: p.state === 'empty' ? 'review' : p.state, failWhy: p.failReason ?? undefined, failNote: p.failNote ?? undefined,
    sellerReceipt: p.sellerReceiptFileId ? { name: 'Чек продавца', preview: files.url(p.sellerReceiptFileId) } : undefined, age: age(p.sentAt ?? p.createdAt),
  };
}

export function admRequest(b: OrderBundle, files: FileStore): AdmRequest {
  const o = b.o;
  const state: AdmRequest['state'] = o.phase === 'review' ? 'review' : o.phase === 'changed' ? 'changed' : o.phase === 'rejected' ? 'rejected' : 'ok';
  const changed = b.items.some((i) => i.oldPriceCny != null);
  return {
    num: o.num, title: o.title, buyerId: String(o.userId), ago: when(o.createdAt), age: age(o.createdAt), protect: o.protect, state,
    items: b.items.map((i) => ({ plat: i.plat ?? 'Свой вариант', name: i.name || (i.plat ?? '') + ' · ' + (i.url ?? '').replace(/^https?:\/\//, '').slice(0, 24), size: i.size ?? '', qty: i.qty, img: files.url(i.picFileId), url: i.url ?? '', price: i.priceCny ?? 0, photo: i.photo, box: i.box })),
    old: changed ? b.items.map((i) => i.oldPriceCny ?? i.priceCny ?? 0) : undefined, comment: o.changeComment ?? undefined,
    rejectWhy: o.rejectReason ?? undefined, rejectNote: o.rejectNote ?? undefined,
  };
}

/** Заказ в списке и карточке админки (adm09, adm10): статус и группа — по фазе, этапу, платежам и обращению. */
export function admOrder(b: OrderBundle, files?: FileStore): AdmOrder {
  const { o } = b;
  const goods = b.payments.find((p) => p.kind === 'goods');
  const openClaim = b.claim && !b.claim.closedAt;
  const labels = o.kind === 'stock' ? STOCK_STAGES : STAGES;
  let status = '', tone: AdmOrder['tone'] = 'wait', group: AdmOrder['group'] = 'pay';
  if (o.phase === 'review') { status = 'Заявка на проверке'; group = 'req'; }
  else if (o.phase === 'changed') { status = 'Ждёт согласия покупателя'; group = 'req'; }
  else if (o.phase === 'rejected') { status = 'Отклонена'; tone = 'n'; group = 'done'; }
  else if (o.phase === 'cancelled') {
    const owe = o.refundDue > 0 && !o.refundedAt;
    status = owe ? 'Отменён · вернуть оплату' : 'Отменён'; tone = owe ? 'err' : 'n'; group = owe ? 'prob' : 'done';
  }
  else if (o.phase === 'invoiced') {
    status = goods?.state === 'fail' ? 'Оплата не подтверждена' : goods?.state === 'review' ? 'Оплата на проверке' : 'Ждёт оплаты';
    tone = goods?.state === 'fail' ? 'err' : 'wait'; group = goods?.state === 'fail' ? 'prob' : 'pay';
  } else if (o.phase === 'done') { status = 'Выдан'; tone = 'live'; group = 'done'; }
  else {
    status = labels[o.stage];
    const stockShip = o.kind === 'stock' && o.stage >= 2, linkShip = o.kind === 'link' && o.stage >= 4;
    tone = stockShip || linkShip ? 'info' : 'violet'; group = stockShip || linkShip ? 'ship' : 'buy';
    if (b.parcels.some((p) => b.payments.some((x) => x.parcelId === p.id && x.state === 'review'))) { group = 'pay'; }
  }
  if (o.cancelRequestedAt && o.phase === 'active') { status = 'Просит отменить'; tone = 'err'; group = 'prob'; }
  if (openClaim && o.phase !== 'cancelled') { status = 'Открыто обращение'; tone = 'err'; group = 'prob'; }

  const dates: string[] = [];
  b.history.forEach((h) => { const i = labels.indexOf(h.label); if (i >= 0) dates[i] = ruDate(h.at); });
  const live = b.items.filter((i) => !i.removed);
  const what = o.kind === 'link'
    ? `По ссылке · ${b.parcels.length > 1 ? `${b.parcels.length} посылки` : `${live.length} ${live.length === 1 ? 'позиция' : live.length < 5 ? 'позиции' : 'позиций'}`}`
    : live[0]?.name + (live.length > 1 ? ` и ещё ${live.length - 1}` : '');
  return {
    ship: o.address || o.delivery ? {
      who: o.address?.name ?? '—', phone: o.address?.phone ?? '—', addr: o.address ? `${o.address.city}, ${o.address.line}` : 'Адрес не указан',
      how: o.kind === 'stock' ? deliveryText(o.delivery) || 'Способ получения не указан' : o.shipMode === 'parts' ? 'Отправлять готовые частями' : 'Дождаться всех товаров, одной посылкой',
    } : undefined,
    num: o.num, buyerId: String(o.userId), what, sum: o.total + o.pointsUsed, kind: o.kind, stage: o.phase === 'review' || o.phase === 'changed' || o.phase === 'rejected' ? -1 : o.stage, stageDates: dates,
    status, tone, group,
    pays: [
      { label: 'Товары', value: o.phase === 'review' || o.phase === 'changed' ? 'Счёт после одобрения' : payText(goods, 'Счёт выставлен') },
      ...b.parcels.map((p) => ({ label: `Доставка посылки ${p.n}`, value: payText(b.payments.find((x) => x.parcelId === p.id), 'Счёт после взвешивания') })),
    ],
    parcels: b.parcels.map((p) => ({
      n: p.n, title: p.title, track: p.track ?? undefined, state: p.state, age: age(p.waitingSince ?? p.createdAt),
      billed: b.payments.some((x) => x.parcelId === p.id), weight: p.weightG ? (p.weightG / 1000).toFixed(1).replace('.', ',') : undefined,
      items: p.itemIds.map(String),
    })),
    items: o.kind === 'link' ? live.map((i) => ({ id: String(i.id), name: i.name || i.plat || 'Вещь', meta: [i.size ? 'Размер ' + i.size : '', i.plat ?? ''].filter(Boolean).join(' · '), img: files?.url(i.picFileId) ?? undefined })) : undefined,
    closed: ['cancelled', 'rejected', 'done'].includes(o.phase),
    cancel: o.phase === 'cancelled' && o.cancelReason != null ? { why: o.cancelReason, note: o.cancelNote ?? '' } : undefined,
    refundDue: o.refundDue || undefined, refunded: !!o.refundedAt,
  };
}

export function admPhotoReport(b: OrderBundle, report: NonNullable<OrderBundle['report']>, files: FileStore): AdmPhotoReport {
  return {
    orderNum: b.o.num, buyerId: String(b.o.userId), place: report.place, note: report.note, sent: !!report.sentAt, age: age(report.createdAt),
    items: report.items.map((x) => {
      const it = b.items.find((i) => i.id === x.itemId);
      return { name: it?.name || `${it?.plat ?? ''} · ${it?.size ?? ''}`, meta: `Размер ${it?.size ?? '—'} · ${it?.plat ?? ''}`, pics: x.fileIds.map((id) => files.url(id)!), ids: x.fileIds };
    }),
  };
}

type ClaimRow = typeof claims.$inferSelect;
type MsgRow = typeof claimMessages.$inferSelect;
export function admClaim(c: ClaimRow, msgs: MsgRow[], b: OrderBundle): AdmClaim {
  const track = b.parcels.find((p) => p.track)?.track ?? '—';
  const labels = b.o.kind === 'stock' ? STOCK_STAGES : STAGES;
  return {
    orderNum: b.o.num, buyerId: String(b.o.userId), topic: c.topic, opened: 'открыто ' + when(c.createdAt), track, stage: labels[b.o.stage] ?? '—',
    what: b.items[0]?.name || 'по ссылке', closed: !!c.closedAt, age: age(c.createdAt), kind: b.o.kind,
    paid: b.payments.filter((p) => p.kind === 'goods' && p.state === 'ok').reduce((n, p) => n + p.amount, 0),
    answer: c.answer ?? undefined, answerText: c.answerText ?? undefined, refundSum: c.refundSum ?? undefined, refundSent: !!c.refund,
    msgs: msgs.map((m) => ({ from: m.from, text: m.text, time: when(m.at).replace(/^./, (x) => x.toUpperCase()).replace(' в ', ', ') })),
  };
}

/** Состояния предложения в админке ↔ состояние и заметка в каталоге. */
export const COND_LABELS: [string, 'новое' | 'как новое' | 'чуть уставшее', string][] = [
  ['Новое · бирки на месте', 'новое', 'Бирки на месте'], ['Новое · без бирок', 'новое', 'Без бирок'], ['Как новое', 'как новое', 'Надета один раз, следов носки нет'], ['Чуть уставшее', 'чуть уставшее', 'Есть следы носки, описаны в карточке'],
];
const condLabel = (cond: string, note: string) => COND_LABELS.find(([, c, n]) => c === cond && (c !== 'новое' || n === note))?.[0] ?? COND_LABELS.find(([, c]) => c === cond)![0];

export function admItem(p: typeof products.$inferSelect, os: (typeof offers.$inferSelect)[], catName: (id: string) => string): AdmItem {
  const c0 = p.colors[0];
  // Предложение без своей расцветки (старые данные) в редакторе не показываем — его не к чему отнести.
  const own = os.filter((o) => p.colors.some((c) => c.id === o.color));
  return {
    id: p.id, name: p.name, brand: p.brand, description: p.description, img: c0?.thumb ?? c0?.photos[0] ?? '', cat: catName(p.categoryId), cats: [...new Set([p.categoryId, ...p.extraCategories])].map(catName),
    colors: p.colors.map((c) => ({ id: c.id, name: c.name, filter: c.filter, pics: c.photos })),
    offers: own.map((o) => ({ id: o.id, color: o.color, cond: condLabel(o.cond, o.note), size: o.size, price: o.price, qty: o.stock })), show: p.visible, preorder: p.preorderAllowed,
    // Размеры сетки, у которых нет ни одного предложения, — поле «Размеры под заказ» в редакторе.
    preorderSizes: p.sizeGrid.filter((s) => !own.some((o) => o.size.trim().toUpperCase() === s.trim().toUpperCase())),
  };
}

export function admBuyer(u: UserRow, stats: { orders: number; spent: number; invitePts: number }, history: { text: string; delta: number; date: string }[]) {
  return {
    id: String(u.id), name: u.name, handle: u.username ? '@' + u.username : '—', photo: avatarOf(u), phone: '', email: u.email ? `${u.email} · ${u.emailState === 'ok' ? 'подтверждена' : 'не подтверждена'}` : 'не привязана',
    since: 'с ' + u.createdAt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).replace(/^(\S+)/, (m) => ({ 'январь': 'января', 'февраль': 'февраля', 'март': 'марта', 'апрель': 'апреля', 'май': 'мая', 'июнь': 'июня', 'июль': 'июля', 'август': 'августа', 'сентябрь': 'сентября', 'октябрь': 'октября', 'ноябрь': 'ноября', 'декабрь': 'декабря' } as Record<string, string>)[m] ?? m).replace(' г.', ''),
    orders: stats.orders, spent: stats.spent, pts: u.points, invitePts: stats.invitePts, points: history,
  };
}
