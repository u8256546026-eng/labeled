import type { Order } from '../domain/orders';
import { G4 } from '../domain/orders';
import { plural, rub, yuan } from '../lib/format';
import { DRAFTS, ORDERS } from '../mocks/ordersData';
import { appStore, type AppState, type Preorder } from '../store/app';
import { http, live, mock } from './client';

/** ?scenario=noorders — демо нового покупателя без заказов и черновиков (AY). */
const noOrders = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('scenario') === 'noorders';

export const ordersApi = {
  /** Заявка продавцу на размер, которого нет в наличии. Ответ продавца придёт позже (G, «Мои заказы»). */
  createPreorder(input: { itemId: string; name: string; color: string; size: string; thumb: string }): Promise<Preorder> {
    if (live()) return http('POST', '/api/size-requests', { productId: input.itemId, color: input.color, size: input.size });
    return mock(() => ({ ...input, id: 'pre-' + Date.now(), createdAt: new Date().toISOString() }));
  },

  /** Заказы и заявки покупателя. В моках это заказы прототипа; новые заказы приходят из состояния ниже. */
  list(): Promise<Order[]> {
    if (live()) return http('GET', '/api/orders');
    return mock(() => (noOrders() ? [] : ORDERS));
  },

  /** Отмена (AZ): до оплаты — сразу, после — запрос продавцу. На моках решает экран. */
  cancel(num: string): Promise<'cancelled' | 'requested'> {
    return live() ? http<{ result: 'cancelled' | 'requested' }>('POST', `/api/orders/${num}/cancel`).then((r) => r.result) : mock(() => 'requested' as const);
  },
  /** «Всё в порядке, получил» (AA). */
  received(num: string): Promise<void> {
    return live() ? http<void>('POST', `/api/orders/${num}/received`).then(() => undefined) : mock(() => undefined);
  },
  /** Согласие с изменённой заявкой (J): сервер выставляет счёт. */
  accept(num: string): Promise<void> {
    return live() ? http<void>('POST', `/api/orders/${num}/accept`).then(() => undefined) : mock(() => undefined);
  },
};

/** Черновики заказа по ссылке в списке заказов. */
export const orderDrafts = () => (live() ? appStore.get().linkDrafts.map((d) => ({ id: d.id, title: d.form.title || 'Без названия', date: d.date })) : noOrders() ? [] : DRAFTS);

/** Заказы, созданные в этой сессии: оформленные из наличия и заявки на размер. С бэкендом придут из list(). */
export function sessionOrders(s: Pick<AppState, 'placed' | 'preorders' | 'linkRequests'>): Order[] {
  const placed: Order[] = Object.values(s.placed).map((o) => {
    const first = o.lines[0];
    const more = o.lines.length - 1;
    return {
      num: o.num, pre: 'Заказ', name: first.name + (more > 0 ? ` и ещё ${more}` : ''), kind: 'stock', title: 'Заказ ' + o.num, sub: 'Из наличия · ' + o.date,
      listMeta: `${o.date} · из наличия`, group: 'active', thumbs: o.lines.slice(0, 3).map((l) => l.img),
      status: 'Оформлен — ждёт оплаты', tone: 'wait', stage: 0, awaitingPay: true, payId: o.payId, cancellable: true,
      note: 'Оплатите товары переводом. Вещи закреплены за вами.',
      items: o.lines.map((l) => ({ name: l.name, params: l.params, price: rub(l.price * l.qty), qty: l.qty + ' шт', img: l.img, tag: l.cond })),
      acts: [{ label: 'Открыть платёж', kind: 'warn', to: '/pay/' + o.payId }, { label: 'Отменить заказ', kind: 'danger', sheet: 'cancel' }],
    };
  });
  const pre: Order[] = s.preorders.map((p) => ({
    num: p.id, pre: 'Заявка', name: p.name.toLowerCase(), kind: 'stock', sizeRequest: true, title: 'Заявка на размер', sub: `${p.name} · ${p.size}`,
    listTitle: `Заявка на размер ${p.size} · ${p.name.toLowerCase()}`,
    listMeta: new Date(p.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' · ' + p.color + ' · размер ' + p.size,
    group: 'decision', thumbs: [p.thumb], status: 'Ждёт подтверждения', tone: 'wait', stage: 0,
    note: 'Цену и возможность заказа подтвердит продавец.',
    acts: [{ label: 'Отменить заявку', kind: 'danger', sheet: 'cancel' }],
  }));
  const link: Order[] = Object.values(s.linkRequests).map((r) => ({
    num: r.num, pre: 'Заявка', name: r.title || 'Без названия', kind: 'link', title: 'Заявка ' + r.num, sub: `${r.title || 'Без названия'} · ${r.date}`,
    listMeta: `${r.date} · ${r.form.items.length} ${plural(r.form.items.length, 'позиция', 'позиции', 'позиций')}`, group: 'decision',
    thumbs: r.form.items.map((it) => it.pic?.preview).filter((x): x is string => !!x).slice(0, 3),
    status: 'Ждёт подтверждения', tone: 'wait', stage: 0, cancellable: true,
    note: 'Продавец проверяет ссылки, наличие и цену. Оплаты до одобрения нет.',
    history: [{ label: 'Ждёт подтверждения', date: r.date, state: 'current' }, { label: 'Оформлен — ждёт оплаты', state: 'future' }],
    items: r.form.items.map((it) => ({ name: `${it.plat || 'Свой вариант'} · ${yuan(it.price)} за штуку`, params: `${it.url}\nРазмер ${it.size || '—'} · ${it.qty} шт`, price: '', img: it.pic?.preview ?? '', serv: [it.photo ? 'фотоотчёт' : '', it.box ? 'коробка' : ''].filter(Boolean) })),
    sums: { rows: [{ label: 'Итого', value: rub(r.calc.total), total: true }], note: 'Оплаты до одобрения продавца нет — сумму подтвердят и пришлют счёт.' },
    acts: [{ label: 'Отменить заявку', kind: 'danger', sheet: 'cancel' }],
  }));
  return [...link, ...pre, ...placed];
}

export const STOCK_STEPS = G4;
