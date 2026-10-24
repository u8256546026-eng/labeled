// API режима администратора. На моках состояние «сервера» живёт в adminDb, действия идут с задержкой.
// С сервером (VITE_API_URL) adminDb — кеш ответов: экраны загружают свой раздел (adminLoad), действия
// уходят на сервер и перечитывают раздел. Журнал действий (adm33) на моках пишет act, с сервером — сервер.
import { ApiError, MOCK_LATENCY, http, live, upload } from '../api/client';
import type { Rates } from '../domain/linkOrder';
import { calcLink, type LinkItem } from '../domain/linkOrder';
import { plural, rub } from '../lib/format';
import {
  ADMIN_BANNERS, ADMIN_BUYERS, ADMIN_CATS, ADMIN_CLAIMS, ADMIN_ITEMS, ADMIN_ORDERS, ADMIN_PAYMENTS, ADMIN_PHOTOS,
  ADMIN_LOG, ADMIN_REQUESTS, ADMIN_REVIEWS, ADMIN_SIZES, ADMIN_STAFF,
  type AdmBanner, type AdmBuyer, type AdmClaim, type AdmItem, type AdmOrder, type AdmPayment, type AdmPhotoReport, type AdmRequest, type AdmReview, type AdmSizeReq,
} from '../mocks/admin';
import { BANNERS } from '../mocks/catalog';
import { RATES } from '../mocks/link';
import { REQUISITES } from '../mocks/orders';
import { actions as buyerActions, appStore } from '../store/app';
import { createStore, useStore } from '../store/createStore';
import { IMG } from '../mocks/images';
import { MAX_PARCELS, OWNER_ONLY, ROLES, SELLER_CANCEL, STAGES, TASK_KIND, staffPerms, type LogEntry, type LogType, type Perm, type Role, type Staff, type Task } from './model';

export type Requisites = { bank: string; recipient: string; number: string };
export type Invite = { code: string; role: Role; link: string };

export type AdminState = {
  /** Сотрудник текущей сессии. null — покупатель, режима администратора у него нет. */
  me: Staff | null;
  payments: AdmPayment[];
  requests: AdmRequest[];
  orders: AdmOrder[];
  photos: AdmPhotoReport[];
  claims: AdmClaim[];
  items: AdmItem[];
  banners: AdmBanner[];
  sizes: AdmSizeReq[];
  cats: { id?: string; name: string; img?: string; n: number; on: boolean }[];
  buyers: AdmBuyer[];
  reviews: AdmReview[];
  staff: Staff[];
  invites: Invite[];
  /** Журнал действий (adm33), новые сверху. */
  journal: LogEntry[];
  /** С сервера: очередь задач уже по правам сотрудника и сводка по периодам. */
  tasks: Task[] | null;
  summary: Partial<Record<'day' | 'week' | 'month', Summary>>;
};

export type Summary = { sub: string; v: [number, number, number, number]; stages: Record<'req' | 'pay' | 'buy' | 'ship' | 'prob', number>; newReq: number };

const clone = <T,>(x: T): T => (live() ? ([] as unknown as T) : structuredClone(x));

export const adminDb = createStore<AdminState>({
  me: null,
  payments: clone(ADMIN_PAYMENTS),
  requests: clone(ADMIN_REQUESTS),
  orders: clone(ADMIN_ORDERS),
  photos: clone(ADMIN_PHOTOS),
  claims: clone(ADMIN_CLAIMS),
  items: clone(ADMIN_ITEMS),
  banners: clone(ADMIN_BANNERS),
  sizes: clone(ADMIN_SIZES),
  cats: clone(ADMIN_CATS),
  buyers: clone(ADMIN_BUYERS),
  reviews: clone(ADMIN_REVIEWS),
  staff: clone(ADMIN_STAFF),
  invites: [],
  journal: clone(ADMIN_LOG),
  tasks: null,
  summary: {},
});

export const useAdmin = <T,>(sel: (s: AdminState) => T) => useStore(adminDb, sel);

/** Права текущего сотрудника. */
export const myPerms = (s: AdminState): Perm[] => (s.me ? staffPerms(s.me) : []);
export const useCan = () => {
  const me = useAdmin((s) => s.me);
  return (p: Perm) => !!me && staffPerms(me).includes(p);
};

const offline = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('offline');

/** Запись журнала на моках: текст, объект и его экран. Тип — по праву действия, если не задан. */
type Log = { text: string; obj: string; to?: string; type?: LogType };
const PERM_LOG: Record<Perm, LogType> = { req: 'req', pay: 'pay', orders: 'orders', photo: 'stock', track: 'stock', claims: 'orders', catalog: 'catalog', banners: 'catalog', buyers: 'pay', reviews: 'catalog', prices: 'prices', staff: 'staff', summary: 'orders' };
const L = (text: string, obj: string, to?: string, type?: LogType): Log => ({ text, obj, to, type });
const ord = (num: string, text: string, to = '/admin/order/' + num, type?: LogType) => L(text, 'Заказ ' + num, to, type);
function payLog(id: string, text: (p: AdmPayment | undefined) => string) {
  const p = adminDb.get().payments.find((x) => x.id === id);
  return L(text(p), p ? 'Заказ ' + p.orderNum : 'Оплата', '/admin/pay/' + id);
}
const cny = (x: number) => x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Действие на «сервере»: задержка, проверка прав, изменение состояния и запись в журнал. */
function act<T>(perm: Perm | null, log: Log, fn: (s: AdminState) => Partial<AdminState> & { result?: T }): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const s = adminDb.get();
      if (offline()) return reject(new ApiError('offline'));
      if (perm && !(s.me && staffPerms(s.me).includes(perm))) return reject(new ApiError('server', 'forbidden'));
      let out: Partial<AdminState> & { result?: T };
      try { out = fn(s); } catch (e) { return reject(e); }
      const { result, ...patch } = out;
      const entry: LogEntry = { id: 'l' + Date.now() + Math.random().toString(36).slice(2, 5), at: new Date().toISOString(), who: s.me?.id ?? '', whoName: s.me?.name ?? '—', whoRole: s.me?.role ?? 'manager', type: log.type ?? (perm ? PERM_LOG[perm] : 'orders'), text: log.text, obj: log.obj, to: log.to };
      adminDb.set({ ...patch, journal: [entry, ...adminDb.get().journal] });
      resolve(result as T);
    }, MOCK_LATENCY);
  });
}

const buyerName = (s: AdminState, id: string) => s.buyers.find((b) => b.id === id)?.name ?? 'Покупатель';
const today = () => new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const upd = <T,>(arr: T[], match: (x: T) => boolean, patch: (x: T) => Partial<T>): T[] => arr.map((x) => (match(x) ? { ...x, ...patch(x) } : x));

/** «12 мин», «3 ч», «1 д» → минуты: для «давно ждёт» и порядка очереди. */
export function ageMinutes(age: string): number {
  const n = parseInt(age, 10) || 0;
  return /д/.test(age) ? n * 1440 : /ч/.test(age) ? n * 60 : n;
}

/** Расчёт заявки по тем же правилам, что у покупателя (B): курс со ступенями, комиссия за штуку, услуги, защита. */
export function requestCalc(r: AdmRequest, rates: Rates = RATES) {
  const items: LinkItem[] = r.items.map((it, i) => ({ key: String(i), plat: it.plat as LinkItem['plat'], url: it.url, size: it.size, qty: it.qty, price: it.price, photo: it.photo, box: it.box }));
  return calcLink(rates, { items, protect: r.protect, disc: 'none' }, 0, false);
}

/**
 * Очередь задач (adm02) строится из состояния: оплаты на проверке, заявки без решения, открытые обращения,
 * неотправленные фотоотчёты, посылки без трека, отзывы на модерации. Сверху — «давно ждёт», дальше по времени ожидания.
 */
export function buildTasks(s: AdminState): Task[] {
  const out: Task[] = [];
  s.payments.filter((p) => p.state === 'review').forEach((p) => out.push({
    id: 'pay-' + p.id, kind: 'pay', title: (p.kind === 'goods' ? 'Оплата товаров · заказ ' : 'Оплата доставки · ') + p.orderLabel,
    sub: buyerName(s, p.buyerId) + (p.receipt ? ' · чек приложен' : ' · перевод без чека'), amount: p.amount, age: p.age, to: '/admin/pay/' + p.id,
  }));
  s.requests.filter((r) => r.state === 'review').forEach((r) => {
    const plats = [...new Set(r.items.map((i) => i.plat))].join(', ');
    out.push({ id: 'req-' + r.num, kind: 'req', title: `Заявка «${r.title}»`, sub: `${buyerName(s, r.buyerId)} · ${r.items.length} ${plural(r.items.length, 'позиция', 'позиции', 'позиций')} · ${plats}`, amount: requestCalc(r).total, age: r.age, to: '/admin/req/' + r.num });
  });
  s.claims.filter((c) => !c.closed).forEach((c) => out.push({ id: 'claim-' + c.orderNum, kind: 'claim', title: 'Обращение по заказу ' + c.orderNum, sub: `${buyerName(s, c.buyerId)} · «${c.topic}»`, age: c.age, to: '/admin/claim/' + c.orderNum }));
  s.photos.filter((p) => !p.sent).forEach((p) => out.push({ id: 'photo-' + p.orderNum, kind: 'photo', title: 'Фотоотчёт · заказ ' + p.orderNum, sub: `${buyerName(s, p.buyerId)} · ${p.items.length} ${plural(p.items.length, 'вещь', 'вещи', 'вещей')} на складе в Китае`, age: p.age, to: '/admin/photo/' + p.orderNum }));
  s.orders.forEach((o) => o.parcels.forEach((pc, i) => {
    if (!pc.track && pc.state === 'На складе в России') out.push({ id: `track-${o.num}-${i}`, kind: 'track', title: `Трек CDEK · ${o.num}, посылка ${i + 1}`, sub: 'Посылка на складе в России, трека нет', age: pc.age ?? '1 д', to: '/admin/order/' + o.num });
  }));
  s.orders.filter((o) => o.refundDue && !o.refunded).forEach((o) => out.push({ id: 'refund-' + o.num, kind: 'refund', title: 'Вернуть оплату · заказ ' + o.num, sub: `${buyerName(s, o.buyerId)} · заказ отменён продавцом`, amount: o.refundDue, age: '0 мин', to: '/admin/order/' + o.num }));
  const waitSizes = s.sizes.filter((x) => x.state === 'wait');
  if (waitSizes.length) out.push({ id: 'sizes', kind: 'size', title: 'Заявки на размер · ' + waitSizes.length, sub: waitSizes.slice(0, 3).map((x) => `${x.item} ${x.size}`).join(', ') + (waitSizes.length > 3 ? ' и ещё ' + (waitSizes.length - 3) : ''), age: '2 ч', to: '/admin/sizes' });
  const mod = s.reviews.filter((r) => r.state === 'mod').length;
  if (mod) out.push({ id: 'reviews', kind: 'review', title: 'Отзывы на модерации', sub: `${mod} ${plural(mod, 'новый отзыв', 'новых отзыва', 'новых отзывов')} о labeled`, age: '1 д', to: '/admin/reviews' });
  out.forEach((t) => { t.urgent = (t.kind === 'claim' || t.kind === 'track') && ageMinutes(t.age) >= 12 * 60; });
  return out.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || ageMinutes(a.age) - ageMinutes(b.age));
}

/** Задачи, которые видит сотрудник по своим правам. */
export const visibleTasks = (s: AdminState) => {
  if (live()) return s.tasks ?? [];
  const perms = myPerms(s);
  return buildTasks(s).filter((t) => perms.includes(TASK_KIND[t.kind].perm));
};

const STOCK_STATUS = ['Оформлен', 'Оплата подтверждена', 'Передано в CDEK', 'Выдан'];
const linkGroup = (i: number): AdmOrder['group'] => (i <= 0 ? 'pay' : i <= 3 ? 'buy' : i <= 6 ? 'ship' : 'done');

export const adminApi = {
  /** Сессия сотрудника: сервер находит Telegram ID из initData в таблице сотрудников. */
  setSession(me: Staff | null) { adminDb.set({ me }); },

  confirmPayment: (id: string) => act('pay', payLog(id, (p) => `Подтверждена оплата ${p?.kind === 'delivery' ? 'доставки' : 'товаров'} · ${rub(p?.amount ?? 0)}`), (s) => {
    const p = s.payments.find((x) => x.id === id)!;
    buyerActions.updatePayment(id, { state: 'ok', confirmedAt: today() });
    return {
      payments: upd(s.payments, (x) => x.id === id, () => ({ state: 'ok' })),
      orders: upd(s.orders, (o) => o.num === p.orderNum, (o) => p.kind === 'goods'
        ? (o.kind === 'stock' ? { stage: 1, status: 'Оплата подтверждена', tone: 'live', group: 'buy', pays: [{ label: 'Товары', value: 'Оплачено · ' + rub(p.amount) }] } : { stage: Math.max(o.stage, 1), status: 'Товары оплачены', tone: 'live', group: 'buy' })
        : { pays: o.pays.map((r) => (r.label === 'Доставка посылки 1' ? { ...r, value: 'Оплачено · ' + rub(p.amount) } : r)) }),
    };
  }),

  failPayment: (id: string, why: number, note: string) => act('pay', payLog(id, () => 'Отмечено: деньги не пришли'), (s) => {
    const p = s.payments.find((x) => x.id === id)!;
    buyerActions.updatePayment(id, { state: 'fail' });
    return {
      payments: upd(s.payments, (x) => x.id === id, () => ({ state: 'fail', failWhy: why, failNote: note })),
      orders: upd(s.orders, (o) => o.num === p.orderNum, (o) => (p.kind === 'goods' ? { status: 'Оплата не подтверждена', tone: 'err', group: 'prob' } : { pays: o.pays.map((r) => (r.label === 'Доставка посылки 1' ? { ...r, value: 'Не подтверждена · ' + rub(p.amount) } : r)) })),
    };
  }),

  /** Чек продавца для покупателя: появится в «Платежах и чеках» (W) и в подтверждённой оплате. */
  attachSellerReceipt: (id: string, file: { name: string; preview?: string; file?: File } | null) => act('pay', payLog(id, () => (file ? 'Приложен чек продавца' : 'Убран чек продавца')), (s) => {
    buyerActions.updatePayment(id, { sellerReceipt: file ? { name: file.name, date: today(), preview: file.preview ?? IMG.receipt } : undefined });
    return { payments: upd(s.payments, (x) => x.id === id, () => ({ sellerReceipt: file ?? undefined })) };
  }),

  approveRequest: (num: string) => act('req', L('Заявка одобрена', 'Заявка ' + num, '/admin/req/' + num), (s) => ({
    requests: upd(s.requests, (r) => r.num === num, () => ({ state: 'ok' })),
    orders: upd(s.orders, (o) => o.num === num, () => ({ stage: 0, stageDates: [today()], status: 'Ждёт оплаты', tone: 'wait', group: 'pay', pays: [{ label: 'Товары', value: 'Счёт выставлен' }] })),
  })),

  changeRequestPrices: (num: string, prices: number[], comment: string) => act('req', L('Изменена цена в заявке', 'Заявка ' + num, '/admin/req/' + num), (s) => ({
    requests: upd(s.requests, (r) => r.num === num, (r) => ({ state: 'changed', old: r.old ?? r.items.map((i) => i.price), items: r.items.map((it, i) => ({ ...it, price: prices[i] })), comment })),
    orders: upd(s.orders, (o) => o.num === num, () => ({ status: 'Ждёт согласия покупателя', tone: 'wait' })),
  })),

  rejectRequest: (num: string, why: number, note: string) => act('req', L('Отказ по заявке', 'Заявка ' + num, '/admin/req/' + num), (s) => ({
    requests: upd(s.requests, (r) => r.num === num, () => ({ state: 'rejected', rejectWhy: why, rejectNote: note })),
    orders: upd(s.orders, (o) => o.num === num, () => ({ status: 'Отклонена', tone: 'n', group: 'done' })),
  })),

  /** Смена этапа (adm11). Уведомление покупателю — сообщение бота и событие в профиле (N). */
  setStage: (num: string, stage: number, notify: boolean) => act('orders', ord(num, `Сменён статус: «${adminDb.get().orders.find((o) => o.num === num)?.kind === 'stock' ? STOCK_STATUS[stage] : STAGES[stage]}»${notify ? '' : ' · без уведомления'}`), (s) => ({
    orders: upd(s.orders, (o) => o.num === num, (o) => {
      const dates = o.stageDates.slice();
      dates[stage] = dates[stage] || today();
      const status = o.kind === 'stock' ? STOCK_STATUS[stage] : STAGES[stage];
      return { stage, stageDates: dates, status, tone: o.kind === 'stock' ? (stage >= 3 ? 'live' : 'info') : stage >= 7 ? 'live' : stage >= 4 ? 'info' : 'violet', group: o.kind === 'stock' ? (stage >= 3 ? 'done' : stage >= 2 ? 'ship' : 'buy') : linkGroup(stage) };
    }),
  })),

  saveTrack: (num: string, parcel: number, track: string) => act('track', ord(num, `Добавлен трек CDEK · посылка ${parcel + 1}`), (s) => ({
    orders: upd(s.orders, (o) => o.num === num, (o) => ({ parcels: o.parcels.map((p, i) => (i === parcel ? { ...p, track, state: 'Передано в CDEK' } : p)) })),
  })),

  savePhotoPics: (num: string, item: number, pics: string[]) => act('photo', ord(num, 'Обновлены фото в фотоотчёте', '/admin/photo/' + num), (s) => ({
    photos: upd(s.photos, (p) => p.orderNum === num, (p) => ({ items: p.items.map((it, i) => (i === item ? { ...it, pics } : it)) })),
  })),

  sendPhotoReport: (num: string, note: string) => act('photo', ord(num, 'Отправлен фотоотчёт', '/admin/photo/' + num), (s) => ({
    photos: upd(s.photos, (p) => p.orderNum === num, () => ({ sent: true, note })),
  })),

  replyClaim: (num: string, text: string) => act('claims', ord(num, 'Ответ на обращение', '/admin/claim/' + num), (s) => ({
    claims: upd(s.claims, (c) => c.orderNum === num, (c) => ({ msgs: c.msgs.concat([{ from: 'admin', text, time: 'сейчас' }]) })),
  })),

  closeClaim: (num: string) => act('claims', ord(num, 'Обращение закрыто', '/admin/claim/' + num), (s) => ({
    claims: upd(s.claims, (c) => c.orderNum === num, () => ({ closed: true })),
  })),

  /** adm28: вернуть деньги (не больше оплаченного, только наличие), запросить фото или отказать с причиной. */
  decideClaim: (num: string, answer: 'ok' | 'more' | 'no', text: string, sum?: number) => act('claims', ord(num, `Решение по обращению: ${answer === 'ok' ? 'возврат ' + rub(sum ?? 0) : answer === 'more' ? 'нужны фото' : 'отказ'}`, '/admin/claim/' + num), (s) => {
    const c = s.claims.find((x) => x.orderNum === num)!;
    if (c.refundSent) throw new ApiError('server', 'refund_in_progress');
    if (answer === 'no' && !text.trim()) throw new ApiError('server', 'Укажите причину отказа');
    if (answer === 'ok' && (c.kind !== 'stock' || !sum || sum > c.paid)) throw new ApiError('server', 'Больше суммы заказа');
    return { claims: upd(s.claims, (x) => x.orderNum === num, () => ({ answer, answerText: text.trim() || undefined, refundSum: answer === 'ok' ? sum : undefined })) };
  }),

  /** adm29: счёт за доставку посылки после взвешивания. n = null — посылок нет, создаётся посылка 1. */
  billParcel: (num: string, n: number | null, weight: number, amount: number) => act('pay', ord(num, `Счёт за доставку · посылка ${n ?? 1}, ${weight.toFixed(1).replace('.', ',')} кг · ${rub(amount)}`), (s) => ({
    orders: upd(s.orders, (o) => o.num === num, (o) => {
      const w = weight.toFixed(1).replace('.', ',');
      const parcels = n == null && !o.parcels.length ? [{ n: 1, title: 'Посылка 1', state: 'На складе в Китае', billed: true, weight: w, items: (o.items ?? []).map((i) => i.id) }] : o.parcels.map((p, i) => ((p.n ?? i + 1) === n ? { ...p, billed: true, weight: w } : p));
      const pn = n ?? 1;
      const label = `Доставка посылки ${pn}`;
      const pays = o.pays.some((r) => r.label === label) ? o.pays.map((r) => (r.label === label ? { ...r, value: 'Счёт выставлен · ' + rub(amount) } : r)) : o.pays.concat([{ label, value: 'Счёт выставлен · ' + rub(amount) }]);
      return { parcels, pays };
    }),
  })),

  /** adm30: отмена продавцом. Если были оплаты — задача на возврат. */
  cancelOrder: (num: string, why: number, note: string) => act('orders', ord(num, `Заказ отменён: ${SELLER_CANCEL[why]}`), (s) => {
    if (why === SELLER_CANCEL.length - 1 && !note.trim()) throw new ApiError('server', 'Для «Другой причины» нужен комментарий');
    return {
      orders: upd(s.orders, (o) => o.num === num, (o) => {
        const paid = o.pays.filter((r) => r.value.startsWith('Оплачено')).reduce((n, r) => n + (parseInt(r.value.replace(/\D/g, ''), 10) || 0), 0);
        return { closed: true, cancel: { why, note: note.trim() }, refundDue: paid || undefined, refunded: false, status: paid ? 'Отменён · вернуть оплату' : 'Отменён', tone: paid ? 'err' : 'n', group: paid ? 'prob' : 'done' };
      }),
    };
  }),

  /**
   * adm34: состав посылок на складе в Китае — groups[k] — id вещей посылки k+1. Посылки со счётом или треком
   * не меняются; каждая новая посылка ждёт своего счёта за доставку (adm29) и трека.
   */
  splitParcels: (num: string, groups: string[][]) => act('orders', ord(num, `Заказ разбит на ${groups.length} ${plural(groups.length, 'посылку', 'посылки', 'посылок')}`, undefined, 'stock'), (s) => {
    const o = s.orders.find((x) => x.num === num)!;
    const live = (o.items ?? []).map((i) => i.id);
    const all = groups.flat();
    if (o.kind !== 'link' || o.closed || o.stage !== 3) throw new ApiError('server', 'not_in_warehouse');
    if (!groups.length || groups.length > Math.min(MAX_PARCELS, live.length) || groups.some((g) => !g.length)) throw new ApiError('server', 'Пустая посылка');
    if (all.length !== live.length || new Set(all).size !== all.length || all.some((id) => !live.includes(id))) throw new ApiError('server', 'Каждая вещь — ровно в одной посылке');
    const kept = o.parcels.filter((p) => p.billed || p.track);
    if (kept.some((p) => { const g = groups[(p.n ?? 1) - 1]; return !g || g.length !== (p.items ?? []).length || g.some((x) => !(p.items ?? []).includes(x)); })) throw new ApiError('server', 'parcel_locked');
    const parcels = groups.map((_, k) => kept.find((p) => p.n === k + 1) ?? o.parcels.find((p) => p.n === k + 1 && !p.billed && !p.track) ?? { n: k + 1, title: 'Посылка ' + (k + 1), state: 'На складе в Китае' })
      .map((p, k) => (p.billed || p.track ? p : { ...p, items: groups[k] }));
    const pay = (n: number) => o.pays.find((r) => r.label === 'Доставка посылки ' + n)?.value ?? 'Счёт после взвешивания';
    return { orders: upd(s.orders, (x) => x.num === num, () => ({ parcels, what: parcels.length > 1 ? `По ссылке · ${parcels.length} посылки` : o.what, pays: [o.pays[0], ...parcels.map((p) => ({ label: 'Доставка посылки ' + p.n, value: pay(p.n!) }))] })) };
  }),

  markRefunded: (num: string) => act('pay', ord(num, 'Оплата возвращена' + (adminDb.get().orders.find((o) => o.num === num)?.refundDue ? ' · ' + rub(adminDb.get().orders.find((o) => o.num === num)!.refundDue!) : '')), (s) => ({
    orders: upd(s.orders, (o) => o.num === num, () => ({ refunded: true, status: 'Отменён', tone: 'n', group: 'done' })),
  })),

  /** adm31: «Размер есть — уведомить» или «Отклонить заявку». */
  answerSize: (id: string, answer: 'yes' | 'no') => act('catalog', L(answer === 'yes' ? 'Покупатель уведомлён о размере' : 'Заявка на размер отклонена', 'Заявки на размер', '/admin/sizes'), (s) => ({
    sizes: upd(s.sizes, (x) => x.id === id, () => ({ state: answer })),
  })),

  saveItem: (item: AdmItem) => act('catalog', L(adminDb.get().items.some((x) => x.id === item.id) ? 'Вещь изменена' : 'Вещь добавлена в каталог', item.name, '/admin/item/' + item.id), (s) => {
    const exists = s.items.some((x) => x.id === item.id);
    return { items: exists ? s.items.map((x) => (x.id === item.id ? item : x)) : [item, ...s.items], result: item };
  }),

  /**
   * adm15: вещь fromId становится расцветками вещи id — переезжают её цвета с фото, предложения и заявки на размер,
   * отдельной вещью она пропадает (её карточка в каталоге остаётся карточкой расцветки). Одинаковый цвет в обеих вещах не объединяется — сначала сменить его у одной.
   */
  mergeItem: (id: string, fromId: string) => act('catalog', L('Вещи объединены', adminDb.get().items.find((x) => x.id === id)?.name ?? 'Вещь', '/admin/item/' + id), (s) => {
    const to = s.items.find((x) => x.id === id);
    const from = s.items.find((x) => x.id === fromId);
    if (!to || !from || to.id === from.id) throw new ApiError('server', 'not_found', 404);
    const same = from.colors.find((c) => to.colors.some((x) => x.name === c.name));
    if (same) { const t = `В обеих вещах есть цвет «${same.name}» — смените его у одной из них`; throw new ApiError('server', t, 409, t); }
    const cid = (c: string) => from.id + '-' + c;
    const merged: AdmItem = {
      ...to,
      colors: to.colors.concat(from.colors.map((c) => ({ ...c, id: cid(c.id) }))),
      offers: to.offers.concat(from.offers.map((o) => ({ ...o, id: from.id + '-' + o.id, color: cid(o.color) }))),
      preorderSizes: [...new Set([...(to.preorderSizes ?? []), ...(from.preorderSizes ?? [])])],
    };
    return {
      items: s.items.filter((x) => x.id !== fromId).map((x) => (x.id === id ? merged : x)),
      sizes: upd(s.sizes, (x) => x.productId === fromId, () => ({ productId: id, item: to.name })),
    };
  }),

  /** adm15: вещь продана или добавлена по ошибке — убрать совсем. Заказы с ней хранят свою копию и не меняются. */
  deleteItem: (id: string) => act('catalog', L('Вещь удалена из каталога', adminDb.get().items.find((x) => x.id === id)?.name ?? 'Вещь', '/admin/catalog'), (s) => ({ items: s.items.filter((x) => x.id !== id) })),

  setBanner: (i: number, on: boolean) => act('banners', L(on ? 'Баннер показан' : 'Баннер скрыт', adminDb.get().banners[i]?.title ?? 'Баннер', '/admin/banner/' + (adminDb.get().banners[i]?.id ?? i)), (s) => syncBanners(s.banners.map((b, k) => (k === i ? { ...b, on } : b)))),
  /** adm32: картинка, заголовок, кнопка и цель. i = null — новый баннер в конце карусели, сразу показан. */
  saveBanner: (i: number | null, b: BannerInput) => act('banners', L(i == null ? 'Баннер добавлен' : 'Баннер изменён', b.title, '/admin/banners'), (s) => {
    const row: AdmBanner = { ...(i == null ? { id: Date.now(), on: true } : s.banners[i]), title: b.title, cta: b.cta, target: b.target, cat: b.cat ?? undefined, img: b.img, sub: bannerSub(b, s) };
    return syncBanners(i == null ? s.banners.concat([row]) : s.banners.map((x, k) => (k === i ? row : x)));
  }),
  deleteBanner: (i: number) => act('banners', L('Баннер удалён', adminDb.get().banners[i]?.title ?? 'Баннер', '/admin/banners'), (s) => syncBanners(s.banners.filter((_, k) => k !== i))),
  setCategory: (i: number, on: boolean) => act('banners', L(on ? 'Категория показана' : 'Категория скрыта', adminDb.get().cats[i]?.name ?? 'Категория', '/admin/banners'), (s) => ({ cats: s.cats.map((c, k) => (k === i ? { ...c, on } : c)) })),
  /** Фото плитки категории в каталоге: квадрат, адрес загруженного файла. */
  setCategoryImg: (i: number, img: string) => act('banners', L('Изменено фото категории', adminDb.get().cats[i]?.name ?? 'Категория', '/admin/category/' + (adminDb.get().cats[i]?.id ?? i)), (s) => ({ cats: s.cats.map((c, k) => (k === i ? { ...c, img } : c)) })),
  addCategory: (name: string) => act('banners', L('Категория добавлена', name, '/admin/banners'), (s) => ({ cats: s.cats.concat([{ name, n: 0, on: true }]) })),

  /** Ручное начисление или списание баллов. Причина видна покупателю в истории баллов (H). */
  adjustPoints: (buyerId: string, delta: number, reason: string) => act('buyers', L(`${delta > 0 ? 'Начислено' : 'Списано'} ${Math.abs(delta)} ${plural(Math.abs(delta), 'балл', 'балла', 'баллов')}: ${reason}`, buyerName(adminDb.get(), buyerId), '/admin/buyer/' + buyerId), (s) => {
    const b = s.buyers.find((x) => x.id === buyerId)!;
    if (delta < 0 && b.pts + delta < 0) throw new ApiError('server', 'balance');
    // Демо: покупатель приложения — Анна Смирнова; её баланс в профиле меняется сразу.
    if (buyerId === 'b-anna') appStore.set((a) => ({ pts: a.pts + delta }));
    return { buyers: upd(s.buyers, (x) => x.id === buyerId, (x) => ({ pts: x.pts + delta, points: [{ text: reason, delta, date: today() }, ...x.points] })) };
  }),

  setReview: (id: string, state: AdmReview['state']) => act('reviews', L(state === 'pub' ? 'Отзыв опубликован' : 'Отзыв скрыт', 'Отзывы', '/admin/reviews'), (s) => ({ reviews: upd(s.reviews, (r) => r.id === id, () => ({ state })) })),

  /** Курс, ступени, услуги и реквизиты. Действуют для новых заявок; выставленные счета не пересчитываются. */
  saveSettings: (rates: Rates, req: Requisites) => act('prices', L(rates.rate !== RATES.rate ? `Изменён курс ЦБ: ${cny(RATES.rate)} → ${cny(rates.rate)} ₽` : 'Изменены цены или реквизиты', 'Курс и цены', '/admin/settings'), () => {
    Object.assign(RATES, structuredClone(rates));
    Object.assign(REQUISITES, req);
    return {};
  }),

  saveStaff: (id: string, role: Role, perms: Perm[] | null) => act('staff', L('Изменены права · ' + ROLES[role].label, adminDb.get().staff.find((x) => x.id === id)?.name.split(' ')[0] ?? 'Сотрудник', '/admin/member/' + id), (s) => ({
    staff: upd(s.staff, (x) => x.id === id, () => ({ role, perms: perms ? perms.filter((p) => !OWNER_ONLY.includes(p)) : null })),
  })),

  removeStaff: (id: string) => act('staff', L('Доступ сотрудника убран', adminDb.get().staff.find((x) => x.id === id)?.name.split(' ')[0] ?? 'Сотрудник', '/admin/staff'), (s) => ({ staff: s.staff.filter((x) => x.id !== id) })),

  /** Одноразовая ссылка на 24 часа. Сотрудник открывает её в Telegram — сервер добавляет его с выбранной ролью. */
  createInvite: (role: Role, link: (code: string) => string) => act('staff', L('Создано приглашение · ' + ROLES[role].label, 'Сотрудники', '/admin/staff'), (s) => {
    const code = Math.random().toString(36).slice(2, 6);
    const inv: Invite = { code, role, link: link('staff_' + code) };
    return { invites: [inv, ...s.invites], result: inv };
  }),
};

export type BannerInput = { title: string; cta: string; target: NonNullable<AdmBanner['target']>; cat?: string | null; img: string };
const BANNER_TO: Record<string, string> = { link: 'заказ по ссылке', email: 'подтверждение почты', invite: 'приглашение', catalog: 'каталог' };
function bannerSub(b: BannerInput, s: AdminState) {
  const cat = b.target === 'catalog' && b.cat ? s.cats.find((c) => (c.id ?? c.name) === b.cat)?.name : null;
  return `Кнопка «${b.cta}» → ${cat ? 'категория «' + cat + '»' : BANNER_TO[b.target]}`;
}
/** На моках главная покупателя берёт видимые баннеры из той же витрины, что редактирует админка. */
function syncBanners(banners: AdmBanner[]) {
  BANNERS.splice(0, BANNERS.length, ...banners.filter((b) => b.on).map((b, i) => ({ id: b.id ?? i + 1, title: b.title, cta: b.cta ?? '', target: b.target ?? 'link', cat: b.cat, img: b.img })));
  return { banners };
}

export const rates = () => RATES;
export const requisites = () => REQUISITES;

// ───────────── режим сервера ─────────────

const upsert = <T,>(arr: T[], x: T, key: (y: T) => string) => (arr.some((y) => key(y) === key(x)) ? arr.map((y) => (key(y) === key(x) ? x : y)) : [x, ...arr]);
type WithBuyer = { buyerId: string; buyerName?: string; buyerHandle?: string; buyerPhoto?: string };

/** Имена и фото покупателей из ответов — чтобы экраны находили их в buyers и без права «Покупатели». */
function ensureBuyers(list: WithBuyer[]) {
  const s = adminDb.get();
  // Фото покупателя меняется в Telegram — у уже известного покупателя обновляем его из свежего ответа.
  const photoOf = new Map(list.filter((x) => x.buyerPhoto).map((x) => [x.buyerId, x.buyerPhoto!]));
  let have = s.buyers;
  if (have.some((b) => photoOf.has(b.id) && b.photo !== photoOf.get(b.id))) have = have.map((b) => (photoOf.has(b.id) ? { ...b, photo: photoOf.get(b.id) } : b));
  const add = list.filter((x, i) => x.buyerName && !have.some((b) => b.id === x.buyerId) && list.findIndex((y) => y.buyerId === x.buyerId) === i)
    .map((x): AdmBuyer => ({ id: x.buyerId, name: x.buyerName!, handle: x.buyerHandle ?? '', photo: x.buyerPhoto, phone: '', email: '', since: '', orders: 0, spent: 0, pts: 0, invitePts: 0, points: [] }));
  if (add.length || have !== s.buyers) adminDb.set({ buyers: have.concat(add) });
}

/** id файлов фотоотчёта по их адресам: экран работает с адресами, сервер сохраняет id. */
const fileIds = new Map<string, string>();

/** Загрузка разделов админки с сервера в adminDb. На моках не нужна. */
export const adminLoad = {
  tasks: async () => { adminDb.set({ tasks: await http<Task[]>('GET', '/api/admin/tasks') }); },
  payment: async (id: string) => { const p = await http<AdmPayment>('GET', '/api/admin/payments/' + encodeURIComponent(id)); ensureBuyers([p]); adminDb.set((s) => ({ payments: upsert(s.payments, p, (x) => x.id) })); },
  request: async (num: string) => {
    const r = await http<AdmRequest & { rates: Rates }>('GET', '/api/admin/requests/' + num);
    ensureBuyers([r]);
    adminDb.set((s) => ({ requests: upsert(s.requests, r, (x) => x.num) }));
  },
  orders: async () => { const os = await http<AdmOrder[]>('GET', '/api/admin/orders'); ensureBuyers(os); adminDb.set({ orders: os }); },
  order: async (num: string) => { const o = await http<AdmOrder>('GET', '/api/admin/orders/' + num); ensureBuyers([o]); adminDb.set((s) => ({ orders: upsert(s.orders, o, (x) => x.num) })); },
  photo: async (num: string) => {
    const r = await http<AdmPhotoReport>('GET', '/api/admin/photo/' + num);
    r.items.forEach((it) => it.pics.forEach((u, i) => { if (it.ids?.[i]) fileIds.set(u, it.ids[i]); }));
    ensureBuyers([r]);
    adminDb.set((s) => ({ photos: upsert(s.photos, r, (x) => x.orderNum) }));
  },
  claim: async (num: string) => { const c = await http<AdmClaim>('GET', '/api/admin/claims/' + num); ensureBuyers([c]); adminDb.set((s) => ({ claims: upsert(s.claims, c, (x) => x.orderNum) })); },
  items: async () => { adminDb.set({ items: await http<AdmItem[]>('GET', '/api/admin/items') }); },
  showcase: async () => { const r = await http<{ banners: AdminState['banners']; cats: AdminState['cats'] }>('GET', '/api/admin/showcase'); adminDb.set({ banners: r.banners, cats: r.cats }); },
  sizes: async () => { adminDb.set({ sizes: await http<AdmSizeReq[]>('GET', '/api/admin/sizes') }); },
  buyers: async () => { adminDb.set({ buyers: await http<AdmBuyer[]>('GET', '/api/admin/buyers') }); },
  buyer: async (id: string) => { const b = await http<AdmBuyer>('GET', '/api/admin/buyers/' + id); adminDb.set((s) => ({ buyers: upsert(s.buyers, b, (x) => x.id) })); },
  reviews: async () => { adminDb.set({ reviews: await http<AdmReview[]>('GET', '/api/admin/reviews') }); },
  settings: async () => { const r = await http<{ rates: Rates; requisites: Requisites }>('GET', '/api/admin/settings'); Object.assign(RATES, r.rates); Object.assign(REQUISITES, r.requisites); },
  staff: async () => { adminDb.set({ staff: await http<Staff[]>('GET', '/api/admin/staff') }); },
  /** Журнал (adm33): фильтр по сотруднику и типу — на сервере. */
  journal: async (who: string, type: LogType | 'all') => {
    const q = new URLSearchParams({ ...(who !== 'all' ? { who } : {}), ...(type !== 'all' ? { type } : {}) }).toString();
    adminDb.set({ journal: await http<LogEntry[]>('GET', '/api/admin/journal' + (q ? '?' + q : '')) });
  },
  summary: async (range: 'day' | 'week' | 'month') => { const r = await http<Summary>('GET', '/api/admin/summary?range=' + range); adminDb.set((s) => ({ summary: { ...s.summary, [range]: r } })); },
};

const post = (path: string, body?: unknown) => http<unknown>('POST', '/api/admin' + path, body ?? {});
const after = (...loads: Promise<unknown>[]) => Promise.all(loads).then(() => undefined);

/** Те же действия, что на моках, — через сервер. Подменяют методы adminApi при VITE_API_URL. */
const liveApi: Partial<typeof adminApi> = {
  confirmPayment: async (id) => { await post(`/payments/${id}/confirm`); await after(adminLoad.payment(id), adminLoad.tasks()); },
  failPayment: async (id, why, note) => { await post(`/payments/${id}/fail`, { why, note }); await after(adminLoad.payment(id), adminLoad.tasks()); },
  attachSellerReceipt: async (id, f) => {
    if (f?.file) await upload(`/api/admin/payments/${id}/seller-receipt`, f.file);
    else await http('DELETE', `/api/admin/payments/${id}/seller-receipt`);
    await adminLoad.payment(id);
  },
  approveRequest: async (num) => { await post(`/requests/${num}/approve`); await after(adminLoad.request(num), adminLoad.tasks()); },
  changeRequestPrices: async (num, prices, comment) => { await post(`/requests/${num}/change`, { prices, comment }); await after(adminLoad.request(num), adminLoad.tasks()); },
  rejectRequest: async (num, why, note) => { await post(`/requests/${num}/reject`, { why, note }); await after(adminLoad.request(num), adminLoad.tasks()); },
  setStage: async (num, stage, notify) => { await post(`/orders/${num}/stage`, { stage, notify }); await after(adminLoad.order(num), adminLoad.tasks()); },
  saveTrack: async (num, parcel, track) => { await post(`/orders/${num}/parcels/${parcel + 1}/track`, { track }); await after(adminLoad.order(num), adminLoad.tasks()); },
  savePhotoPics: async (num, item, pics) => { await http('PUT', `/api/admin/photo/${num}/items/${item}`, { fileIds: pics.map((u) => fileIds.get(u) ?? u) }); await adminLoad.photo(num); },
  sendPhotoReport: async (num, note) => { await post(`/photo/${num}/send`, { note }); await after(adminLoad.photo(num), adminLoad.tasks()); },
  replyClaim: async (num, text) => { await post(`/claims/${num}/reply`, { text }); await adminLoad.claim(num); },
  closeClaim: async (num) => { await post(`/claims/${num}/close`); await after(adminLoad.claim(num), adminLoad.tasks()); },
  decideClaim: async (num, answer, text, refundSum) => { await post(`/claims/${num}/decide`, { answer, text, refundSum }); await after(adminLoad.claim(num), adminLoad.tasks()); },
  billParcel: async (num, n, weight, amount) => { await post(`/orders/${num}/parcels/${n ?? 0}/bill`, { weight, amount }); await adminLoad.order(num); },
  splitParcels: async (num, groups) => { await http('PUT', `/api/admin/orders/${num}/parcels`, { groups: groups.map((g) => g.map(Number)) }); await adminLoad.order(num); },
  cancelOrder: async (num, why, note) => { await post(`/orders/${num}/cancel`, { why, note }); await after(adminLoad.order(num), adminLoad.tasks()); },
  markRefunded: async (num) => { await post(`/orders/${num}/refunded`); await after(adminLoad.order(num), adminLoad.tasks()); },
  answerSize: async (id, answer) => { await post(`/sizes/${id}`, { answer }); await after(adminLoad.sizes(), adminLoad.tasks()); },
  saveItem: async (item) => {
    const isNew = !adminDb.get().items.some((x) => x.id === item.id);
    await http('PUT', '/api/admin/items', { ...item, isNew });
    await adminLoad.items();
    return item;
  },
  mergeItem: async (id, fromId) => { await post(`/items/${encodeURIComponent(id)}/merge`, { from: fromId }); await after(adminLoad.items(), adminLoad.sizes()); },
  deleteItem: async (id) => { await http('DELETE', `/api/admin/items/${encodeURIComponent(id)}`); adminDb.set({ items: adminDb.get().items.filter((x) => x.id !== id) }); },
  setBanner: async (i, on) => { await http('PUT', `/api/admin/banners/${adminDb.get().banners[i].id}`, { on }); await adminLoad.showcase(); },
  saveBanner: async (i, b) => {
    const id = i == null ? null : adminDb.get().banners[i].id;
    await http(id == null ? 'POST' : 'PATCH', '/api/admin/banners' + (id == null ? '' : '/' + id), b);
    await adminLoad.showcase();
  },
  deleteBanner: async (i) => { await http('DELETE', `/api/admin/banners/${adminDb.get().banners[i].id}`); await adminLoad.showcase(); },
  setCategory: async (i, on) => { await http('PUT', `/api/admin/categories/${adminDb.get().cats[i].id}`, { on }); await adminLoad.showcase(); },
  setCategoryImg: async (i, img) => { await http('PATCH', `/api/admin/categories/${adminDb.get().cats[i].id}`, { img }); await adminLoad.showcase(); },
  addCategory: async (name) => { await post('/categories', { name }); await adminLoad.showcase(); },
  adjustPoints: async (buyerId, delta, reason) => { await post(`/buyers/${buyerId}/points`, { delta, reason }); await adminLoad.buyer(buyerId); },
  setReview: async (id, state) => { await http('PUT', `/api/admin/reviews/${id}`, { state }); await after(adminLoad.reviews(), adminLoad.tasks()); },
  saveSettings: async (r, req) => { await http('PUT', '/api/admin/settings', { rates: r, requisites: req }); await adminLoad.settings(); },
  saveStaff: async (id, role, perms) => { await http('PUT', `/api/admin/staff/${id}`, { role, perms }); await adminLoad.staff(); },
  removeStaff: async (id) => { await http('DELETE', `/api/admin/staff/${id}`); await adminLoad.staff(); },
  createInvite: (role) => http<Invite>('POST', '/api/admin/staff/invites', { role }),
};
if (live()) Object.assign(adminApi, liveApi);

/** Фото для отчёта или вещи: на моках — адрес для предпросмотра, с сервером — загруженный файл. */
export const adminUploads = {
  reportPhoto: async (num: string, f: File): Promise<string | undefined> => {
    if (!live()) return f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
    const r = await upload<{ id: string; url: string }>(`/api/admin/photo/${num}/upload`, f);
    fileIds.set(r.url, r.id);
    return r.url;
  },
  bannerPhoto: async (f: File): Promise<string | undefined> => {
    if (!live()) return f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
    return (await upload<{ id: string; url: string }>('/api/admin/banners/upload', f)).url;
  },
  categoryPhoto: async (f: File): Promise<string | undefined> => {
    if (!live()) return f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
    return (await upload<{ id: string; url: string }>('/api/admin/categories/upload', f)).url;
  },
  itemPhoto: async (f: File): Promise<string | undefined> => {
    if (!live()) return f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
    return (await upload<{ id: string; url: string }>('/api/admin/items/upload', f)).url;
  },
};
