import { filt0, type Filter } from '../domain/filter';
import type { Cond, Offer, Product } from '../domain/types';
import type { Address, CheckoutLine, Delivery, Payment, PlacedOrder } from '../domain/order';
import type { OrderUserState } from '../domain/orders';
import type { Claim, Refund } from '../domain/claims';
import type { LinkDraft, LinkForm } from '../domain/linkOrder';
import type { LinkRequest } from '../api/link';
import { drafts0, link0 } from '../mocks/link';
import { addr0, payments0 } from '../mocks/orders';
import { cart0 } from '../mocks/user';
import { createStore, useStore } from './createStore';
import { live } from '../api/client';

export type CartLine = {
  key: string;
  itemId: string;
  offerId: string;
  name: string;
  img: string;
  params: string;
  cond: Cond;
  price: number;
  qty: number;
  max: number;
  single?: boolean;
  /** Вещь купили, пока она лежала в корзине. */
  gone?: boolean;
};

/** Заявка на отсутствующий размер (7p–7q). Цену и возможность заказа подтверждает продавец. */
export type Preorder = { id: string; itemId: string; name: string; color: string; size: string; thumb: string; createdAt: string };

/** Профиль из Telegram: фото и имя приходят из initData. Фото в приложении не меняется, имя можно. */
export type TgProfile = { id: number; username?: string; photo?: string; tgName: string };
export type NotifPrefs = { bot: boolean; req: boolean; pay: boolean; ship: boolean; pts: boolean; promo: boolean; mail: boolean };

export type AppState = {
  /** Покупатель вошёл: принял оферту и политику один раз при первом входе. */
  auth: boolean;
  consent: boolean;
  me: TgProfile;
  name: string;
  /** Адрес почты, если привязан. */
  emailAddr: string;
  notif: NotifPrefs;
  pts: number;
  filter: Filter;
  cart: CartLine[];
  favs: string[];
  preorders: Preorder[];
  addrs: Address[];
  /** Основной адрес — подставляется при оформлении. */
  addrSel: number;
  dlv: Delivery;
  /** Выбор баллов на проверке заказа — переживает переход к способу получения и адресам. */
  checkoutDisc: 'points' | 'none';
  payments: Record<string, Payment>;
  placed: Record<string, PlacedOrder>;
  /** Действия покупателя по заказам: запрошена отмена, подтверждено получение. */
  orderState: Record<string, OrderUserState>;
  /** Почта: скидка 50% на комиссию первого заказа после подтверждения. */
  email: 'none' | 'wait' | 'ok' | 'err';
  /** Форма заказа по ссылке — сохраняется при переходах между разделами. */
  link: LinkForm;
  linkDrafts: LinkDraft[];
  linkRequests: Record<string, LinkRequest>;
  eventsRead: boolean;
  /** Недавние поисковые запросы (AI). */
  recent: string[];
  /** Приглашение по ссылке друга: id пригласившего из start_param ref_<id>. */
  referrer?: string;
  /** Обращения по заказам (M, Y, Z), по номеру заказа. */
  claims: Record<string, Claim>;
  /** Отзывы, отправленные на модерацию, по номеру заказа. */
  reviewsSent: Record<string, 'mod'>;
};

const guestDemo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('guest');
/** С сервером состояние покупателя приходит после входа (api/session.ts); демо-данные — только на моках. */
const demo = !live();
const CART_KEY = 'lbd.cart';
const savedCart = (): CartLine[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? '[]');
    // Испорченная запись (не массив, строки без offerId) не должна ронять приложение при запуске.
    return Array.isArray(v) ? v.filter((l): l is CartLine => !!l && typeof l === 'object' && typeof l.offerId === 'string' && typeof l.qty === 'number') : [];
  } catch {
    return [];
  }
};
export const blankLink = (): LinkForm => ({ title: '', items: [], protect: false, ship: 'all', disc: 'none', dirty: false });

export const appStore = createStore<AppState>({
  auth: demo && !guestDemo,
  consent: demo && !guestDemo,
  me: { id: 1001, username: 'anna_smirnova', tgName: 'Анна Смирнова' },
  name: 'Анна Смирнова',
  emailAddr: '',
  notif: { bot: true, req: true, pay: true, ship: true, pts: false, promo: false, mail: false },
  pts: demo ? 1240 : 0,
  filter: filt0(),
  cart: demo ? cart0() : savedCart(),
  favs: demo ? ['bomber', 'knit', 'sold-cap'] : [],
  preorders: [],
  addrs: demo ? addr0() : [],
  addrSel: 0,
  dlv: { mode: 'pvz', pvz: '', slot: 1 },
  checkoutDisc: 'none',
  payments: demo ? payments0() : {},
  placed: {},
  orderState: {},
  email: 'none',
  link: demo ? link0() : blankLink(),
  linkDrafts: demo ? drafts0() : [],
  linkRequests: {},
  eventsRead: false,
  recent: ['бомбер', 'джинсы oversize', 'кроссовки 42'],
  claims: {},
  reviewsSent: {},
});

export const useApp = <T,>(sel: (s: AppState) => T) => useStore(appStore, sel);

// Корзина живёт на устройстве: с сервером она переживает перезапуск Mini App.
if (!demo) {
  let last = appStore.get().cart;
  appStore.subscribe(() => {
    const c = appStore.get().cart;
    if (c !== last) { last = c; try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch { /* приватный режим */ } }
  });
}

/**
 * Изменения, которые экраны делают локально, а сервер должен узнать: уведомления, избранное, черновики.
 * Заполняет api/live.ts в режиме сервера; на моках пусто.
 */
export const remote: {
  notif?: (p: Partial<NotifPrefs>) => void;
  fav?: (id: string, on: boolean) => void;
  draft?: (d: LinkDraft) => void;
} = {};

export const cartCount = (cart: CartLine[]) => cart.filter((r) => !r.gone).reduce((n, r) => n + r.qty, 0);

export const actions = {
  setFilter: (filter: Filter) => appStore.set({ filter }),

  toggleFav: (id: string): boolean => {
    const on = !appStore.get().favs.includes(id);
    appStore.set((s) => ({ favs: on ? s.favs.concat([id]) : s.favs.filter((x) => x !== id) }));
    remote.fav?.(id, on);
    return on;
  },

  /** Кладёт конкретное предложение в корзину. Одно и то же предложение не дублируется, а увеличивает количество до остатка. */
  addToCart: (p: Product, o: Offer): boolean => {
    const cart = appStore.get().cart;
    const line = cart.find((r) => r.offerId === o.id && !r.gone);
    if (line && line.qty >= line.max) return false;
    const color = p.colors.find((c) => c.id === o.color)!;
    appStore.set({
      cart: line
        ? cart.map((r) => (r === line ? { ...r, qty: r.qty + 1 } : r))
        : cart.concat([{ key: 'n' + Date.now(), itemId: p.id, offerId: o.id, name: p.name, img: o.img, params: o.size ? `${color.name} / ${o.size}` : color.name, cond: o.cond, price: o.price, qty: 1, max: o.stock, single: o.stock === 1 }]),
    });
    return true;
  },

  addPreorder: (p: Preorder) => appStore.set((s) => ({ preorders: [p].concat(s.preorders) })),

  setCartQty: (key: string, qty: number) => appStore.set((s) => ({ cart: s.cart.map((r) => (r.key === key ? { ...r, qty: Math.max(1, Math.min(r.max, qty)) } : r)) })),
  removeCartLine: (key: string) => appStore.set((s) => ({ cart: s.cart.filter((r) => r.key !== key) })),
  /** Цена позиции в корзине обновлена после проверки заказа. */
  repriceCartLine: (offerId: string, price: number) => appStore.set((s) => ({ cart: s.cart.map((r) => (r.offerId === offerId ? { ...r, price } : r)) })),
  removeCartOffer: (offerId: string) => appStore.set((s) => ({ cart: s.cart.filter((r) => r.offerId !== offerId) })),

  setDelivery: (dlv: Delivery) => appStore.set({ dlv }),
  setCheckoutDisc: (checkoutDisc: 'points' | 'none') => appStore.set({ checkoutDisc }),
  setAddress: (i: number) => appStore.set({ addrSel: i }),

  /** Заказ создан: вещи уходят из корзины, появляется платёж за товары, баллы списываются. */
  orderPlaced: (o: PlacedOrder, fromCart: CheckoutLine[]) => appStore.set((s) => ({
    placed: { ...s.placed, [o.num]: o },
    pts: s.pts - o.pointsOff,
    checkoutDisc: 'none',
    cart: s.cart.filter((r) => !fromCart.some((l) => l.offerId === r.offerId)),
    payments: { ...s.payments, [o.payId]: { id: o.payId, kind: 'goods', orderNum: o.num, orderLabel: o.num, sum: o.total, state: 'empty', fromCheckout: true } },
  })),
  /** Изменение формы заявки помечает её несохранённой. */
  setLink: (patch: Partial<LinkForm>) => appStore.set((s) => ({ link: { ...s.link, ...patch, dirty: patch.dirty ?? true } })),
  saveLinkDraft: () => appStore.set((s) => {
    const id = s.link.draftId ?? 'd' + Date.now();
    const draft: LinkDraft = { id, date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }), form: { ...s.link, draftId: id, dirty: false } };
    remote.draft?.(draft);
    return { link: draft.form, linkDrafts: [draft, ...s.linkDrafts.filter((d) => d.id !== id)] };
  }),
  openLinkDraft: (id: string) => appStore.set((s) => { const d = s.linkDrafts.find((x) => x.id === id); return d ? { link: { ...d.form, dirty: false } } : {}; }),
  linkSubmitted: (r: LinkRequest, emptyForm: LinkForm) => appStore.set((s) => ({
    linkRequests: { ...s.linkRequests, [r.num]: r },
    linkDrafts: s.linkDrafts.filter((d) => d.id !== r.form.draftId),
    link: emptyForm,
    pts: r.form.disc === 'points' ? s.pts - r.calc.disc : s.pts,
  })),
  /** Профиль из initData. Имя меняется только если покупатель ещё не переименовался. */
  setTelegramUser: (me: TgProfile) => appStore.set((s) => ({ me, name: s.name === s.me.tgName ? me.tgName : s.name })),
  login: () => appStore.set({ auth: true, consent: true }),
  logout: () => appStore.set({ auth: false }),
  setName: (name: string) => appStore.set({ name }),
  setEmail: (email: AppState['email'], emailAddr?: string) => appStore.set((s) => ({ email, emailAddr: emailAddr ?? s.emailAddr, notif: email === 'ok' ? s.notif : { ...s.notif, mail: false } })),
  setNotif: (p: Partial<NotifPrefs>) => { appStore.set((s) => ({ notif: { ...s.notif, ...p } })); remote.notif?.(p); },
  saveAddress: (a: Address) => appStore.set((s) => {
    const i = s.addrs.findIndex((x) => x.id === a.id);
    const addrs = i >= 0 ? s.addrs.map((x) => (x.id === a.id ? a : x)) : s.addrs.concat([a]);
    return { addrs, addrSel: i >= 0 ? s.addrSel : addrs.length - 1 };
  }),
  deleteAddress: (id: string) => appStore.set((s) => {
    const sel = s.addrs[s.addrSel]?.id;
    const addrs = s.addrs.filter((x) => x.id !== id);
    const keep = addrs.findIndex((x) => x.id === sel);
    return { addrs, addrSel: keep >= 0 ? keep : 0 };
  }),
  markEventsRead: () => appStore.set({ eventsRead: true }),
  clearFavs: () => { appStore.get().favs.forEach((id) => remote.fav?.(id, false)); appStore.set({ favs: [] }); },
  pushRecent: (q: string) => appStore.set((s) => ({ recent: [q, ...s.recent.filter((x) => x !== q)].slice(0, 5) })),
  setReferrer: (id: string) => appStore.set({ referrer: id }),
  saveClaim: (c: Claim) => appStore.set((s) => ({ claims: { ...s.claims, [c.orderNum]: c } })),
  updateClaim: (orderNum: string, patch: Partial<Claim>) => appStore.set((s) => ({ claims: { ...s.claims, [orderNum]: { ...s.claims[orderNum], ...patch } } })),
  setRefund: (orderNum: string, r: Refund) => appStore.set((s) => ({ claims: { ...s.claims, [orderNum]: { ...s.claims[orderNum], refund: r } } })),
  reviewSent: (orderNum: string) => appStore.set((s) => ({ reviewsSent: { ...s.reviewsSent, [orderNum]: 'mod' } })),
  setOrderState: (num: string, patch: OrderUserState) => appStore.set((s) => ({ orderState: { ...s.orderState, [num]: { ...s.orderState[num], ...patch } } })),
  /** Счёт по заявке появляется, когда покупатель согласился с суммой продавца. */
  ensurePayment: (p: Omit<Payment, 'state'>) => appStore.set((s) => (s.payments[p.id] ? {} : { payments: { ...s.payments, [p.id]: { ...p, state: 'empty' } } })),
  updatePayment: (id: string, patch: Partial<Payment>) => appStore.set((s) => ({ payments: { ...s.payments, [id]: { ...s.payments[id], ...patch } } })),
};
