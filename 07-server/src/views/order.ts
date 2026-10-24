// Вид заказа для покупателя — в форме Order из приложения (06-app/src/domain/orders.ts), чтобы экраны
// «Мои заказы» и карточка заказа работали без переделки. Тексты — из макетов Buyer v15 / Flow v12.
import type { Payment } from '../../../06-app/src/domain/order';
import { type HistRow, type Order, type OrderAct, type Parcel, type Tone } from '../../../06-app/src/domain/orders';
import { rub, yuan } from '../../../06-app/src/lib/format';
import { SELLER_CANCEL } from '../../../06-app/src/admin/model';
import type { claims, orderHistory, orderItems, orders, parcels, payments, photoReports } from '../db/schema';
import { ruDate } from '../http';
import type { FileStore } from '../files';

export type OrderRow = typeof orders.$inferSelect;
export type ItemRow = typeof orderItems.$inferSelect;
export type HistoryRow = typeof orderHistory.$inferSelect;
export type ParcelRow = typeof parcels.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type ReportRow = typeof photoReports.$inferSelect;
export type ClaimRow = typeof claims.$inferSelect;

export type OrderBundle = { o: OrderRow; items: ItemRow[]; history: HistoryRow[]; parcels: ParcelRow[]; payments: PaymentRow[]; report?: ReportRow; claim?: ClaimRow };

/** Этап продавца (8 шагов, adm10) → точка на шкале покупателя из пяти групп (G5). */
export const linkCur = (stage: number) => [0, 0, 1, 1, 2, 3, 3, 4][Math.max(0, Math.min(7, stage))];
const LINK_STATUS = ['Ждёт оплаты', 'Оплачен', 'Выкуплен', 'На складе в Китае', 'Едет в Россию', 'На складе в России', 'Передан в CDEK', 'Получен'];
const LINK_NOTE = [
  'Продавец подтвердил сумму — можно оплатить.',
  'Оплата подтверждена. Продавец выкупит вещи и отправит их на склад в Китае.',
  'Продавец выкупил вещи, они едут на склад в Китае.',
  'Вещи выкуплены и лежат на складе. Дальше каждая посылка едет отдельно — доставку оплачиваете по каждой.',
  'Посылки едут в Россию.',
  'Посылки на складе в России. Скоро передадим их в CDEK.',
  'Посылки переданы в CDEK — следите за треком.',
  'Заказ получен.',
];
const STOCK_STATUS = ['Оформлен — ждёт оплаты', 'Оплата подтверждена', 'В пути к вам', 'Доставлен в пункт выдачи'];
const STOCK_NOTE = ['Оплатите товары переводом. Вещи закреплены за вами.', 'Оплата подтверждена. Продавец передаст заказ в CDEK.', 'Заказ из наличия — без китайского маршрута.', 'Проверьте вещь при получении и подтвердите получение.'];
export const REJECT_REASONS = ['Товара нет в наличии', 'Нельзя доставить в Россию', 'Ссылка не открывается', 'Другая причина'];

/** Платёж в форме приложения (W, C). «Перевёл» без проверки — review; чек без «Перевёл» — attached. */
export function paymentView(p: PaymentRow, o: Pick<OrderRow, 'num'>, parcelN: number | undefined, files: FileStore, receiptName?: string, sellerName?: string): Payment {
  const state = p.state === 'empty' && p.receiptFileId ? 'attached' : p.state;
  const note = p.state === 'ok' ? ruDate(p.checkedAt) : p.state === 'fail' ? `${ruDate(p.sentAt ?? p.createdAt)} · поступление не найдено` : p.state === 'review' ? `${ruDate(p.sentAt)} · чек загружен` : `Счёт от ${ruDate(p.createdAt)}`;
  return {
    id: p.id, kind: p.kind, orderNum: o.num, orderLabel: o.num + (parcelN ? ` · посылка ${parcelN}` : ''), parcel: parcelN, sum: p.amount, state, note,
    confirmedAt: p.checkedAt && p.state === 'ok' ? ruDate(p.checkedAt) : undefined,
    receipt: p.receiptFileId ? { name: receiptName ?? 'Чек', meta: p.state === 'review' ? `На проверке с ${ruDate(p.sentAt)}` : `Загружен ${ruDate(p.sentAt ?? p.createdAt)}`, preview: files.url(p.receiptFileId) } : undefined,
    sellerReceipt: p.sellerReceiptFileId ? { name: sellerName ?? 'Чек продавца.pdf', date: ruDate(p.checkedAt), preview: files.url(p.sellerReceiptFileId), url: files.url(p.sellerReceiptFileId) } : undefined,
  };
}

const plural = (n: number, a: string, b: string, c: string) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

/** Заказ или заявка покупателя: статус, шкала, история, посылки, суммы и действия по фазе и этапу. */
export function buyerOrderView(b: OrderBundle, files: FileStore): Order {
  const { o, items } = b;
  const live = items.filter((i) => !i.removed);
  const isLink = o.kind === 'link';
  const isRequest = isLink && (o.phase === 'review' || o.phase === 'changed' || o.phase === 'rejected');
  const pre = isRequest ? 'Заявка' : 'Заказ';
  const date = ruDate(o.createdAt);
  const goodsPay = b.payments.find((p) => p.kind === 'goods');
  const thumbs = (isLink ? items.map((i) => files.url(i.picFileId) ?? '') : items.map((i) => i.img)).filter(Boolean).slice(0, 3);
  const count = live.length;

  const history: HistRow[] = b.history.map((h, i) => ({ label: h.label, date: ruDate(h.at), state: i === b.history.length - 1 ? (o.phase === 'cancelled' || o.phase === 'rejected' ? 'stop' : 'current') : 'done' }));

  const base: Order = {
    num: o.num, pre, name: o.title, kind: o.kind, title: `${pre} ${o.num}`,
    sub: isLink ? `${o.title} · ${date}` : `Из наличия · ${date}`,
    listMeta: isLink ? `${date} · ${count} ${plural(count, 'позиция', 'позиции', 'позиций')}` : `${date} · из наличия`,
    group: 'active', thumbs, status: '', tone: 'live', note: '', stage: 0, history,
    items: live.map((i) => (isLink
      ? { name: `${i.plat ?? 'Свой вариант'} · ${yuan(i.priceCny ?? 0)} за штуку`, params: `${i.url ?? ''}\nРазмер ${i.size || '—'} · ${i.qty} шт`, price: '', img: files.url(i.picFileId) ?? '', serv: [i.photo ? 'фотоотчёт' : '', i.box ? 'коробка' : ''].filter(Boolean), tag: i.oldPriceCny != null && i.oldPriceCny !== i.priceCny ? 'цена изменена' : undefined }
      : { name: i.name, params: i.params, price: rub(i.price * i.qty), qty: i.qty + ' шт', img: i.img, tag: i.cond ?? undefined })),
  };

  const sumsRows = [
    ...(isLink ? [{ label: 'Товары по расчётному курсу', value: rub(o.goods) }, { label: 'Комиссия', value: rub(o.commission) }] : [{ label: 'Товары', value: rub(o.goods) }]),
    ...(o.services ? [{ label: 'Услуги', value: rub(o.services) }] : []),
    ...(o.protection ? [{ label: 'Защита от рисков', value: rub(o.protection) }] : []),
    ...(o.pointsUsed ? [{ label: 'Списание баллов', value: '−' + rub(o.pointsUsed) }] : []),
    ...(o.commDiscount ? [{ label: 'Скидка 50% на комиссию', value: '−' + rub(o.commDiscount) }] : []),
    { label: isRequest ? 'Итого' : 'К оплате', value: rub(o.total), total: true },
  ];

  const support: OrderAct = { label: 'Помощь', kind: 'violet', to: '/help' };
  const cancelAct: OrderAct = { label: isRequest ? 'Отменить заявку' : 'Отменить заказ', kind: 'danger', sheet: 'cancel' };
  const cancelSent = !!o.cancelRequestedAt;

  // Отменён или отклонён.
  if (o.phase === 'cancelled' || o.phase === 'rejected') {
    const rejected = o.phase === 'rejected';
    const bySeller = !rejected && o.cancelReason != null;
    const cancelNote = o.refundDue ? (o.refundedAt ? `Продавец вернул оплату ${rub(o.refundDue)} · ${ruDate(o.refundedAt)}.` : `Продавец вернёт оплату ${rub(o.refundDue)}.`)
      : goodsPay?.state === 'ok' ? 'Заказ отменён. Возврат оплаты — по обращению.' : 'Вещи не выкупались, оплаты не было.';
    return {
      ...base, group: 'done', status: rejected ? 'Отклонён' : 'Отменён', tone: rejected ? 'err' : 'off', stage: 0,
      listMeta: `${date} · ${rejected ? 'причина указана' : bySeller ? 'отменён продавцом' : 'отменён'}`,
      stopped: {
        label: rejected ? 'Заявка отклонена продавцом' : bySeller ? 'Заказ отменён продавцом' : 'Заказ отменён',
        reason: rejected ? `${REJECT_REASONS[o.rejectReason ?? 0]}${o.rejectNote ? '. ' + o.rejectNote : ''} · ${ruDate(o.updatedAt)}`
          : bySeller ? `${SELLER_CANCEL[o.cancelReason!]}${o.cancelNote ? '. ' + o.cancelNote : ''} · ${ruDate(o.updatedAt)}` : `Отменён · ${ruDate(o.updatedAt)}`,
      },
      note: rejected ? 'Заявку можно оформить заново. Оплата не запрашивалась.' : cancelNote,
      materials: { rows: [{ label: 'Оплата товаров', value: goodsPay?.state === 'ok' ? 'Оплачено' : 'Оплаты не было' }] },
      acts: rejected ? [{ label: 'Оформить заново', kind: 'primary', to: '/link', root: true }] : [support],
    };
  }

  // Заявка у продавца или изменена им.
  if (o.phase === 'review') {
    return {
      ...base, group: 'decision', status: 'Ждёт подтверждения', tone: 'wait', stage: 0, cancellable: !cancelSent,
      note: 'Продавец проверяет ссылки, наличие и цену. Оплаты до одобрения нет.',
      sums: { rows: sumsRows, note: 'Оплаты до одобрения продавца нет — сумму подтвердят и пришлют счёт.' },
      acts: cancelSent ? [] : [cancelAct],
    };
  }
  if (o.phase === 'changed') {
    const removed = items.filter((i) => i.removed);
    const changed = items.filter((i) => !i.removed && i.oldPriceCny != null && i.oldPriceCny !== i.priceCny);
    const what = [...removed.map((i) => `${i.name || i.plat} — позиция убрана`), ...changed.map((i) => `${i.name || i.plat}: ${yuan(i.oldPriceCny!)} → ${yuan(i.priceCny!)}`)].join('. ');
    return {
      ...base, group: 'decision', status: 'Нужно ваше решение', tone: 'wait', listStatus: 'Нужно решение', listTone: 'err', stage: 0,
      listMeta: `${date} · продавец изменил состав`,
      note: 'Продавец проверил заявку и изменил её. Без вашего согласия заказ не оформится и оплата не выставится.',
      alert: { title: 'Что изменилось', text: [o.changeComment, what].filter(Boolean).join('. ') + '.' },
      sums: { rows: sumsRows, note: 'Курс и комиссия пересчитаны по тем же правилам. Баллы и скидку можно применить при оплате.' },
      acts: [{ label: `Согласиться — ${rub(o.total)}`, kind: 'primary', pay: { id: 'p-' + o.num, kind: 'goods', orderNum: o.num, orderLabel: o.num, sum: o.total } }, cancelAct],
    };
  }

  // Счёт выставлен: статус оплаты выводит приложение из платежа (orderView).
  if (o.phase === 'invoiced') {
    return {
      ...base, status: isLink ? 'Оформлен — ждёт оплаты' : STOCK_STATUS[0], tone: 'wait', stage: 0,
      awaitingPay: true, payId: goodsPay?.id, cancellable: !cancelSent,
      note: isLink ? `Продавец подтвердил заявку и сумму ${rub(o.total)}. Оплатите товары переводом — после подтверждения оплаты начнётся выкуп.` : STOCK_NOTE[0],
      sums: { rows: sumsRows, note: isLink ? 'Доставка из-за границы оплачивается отдельно после поступления на склад в Китае.' : undefined },
      acts: [{ label: isLink ? 'Оплатить товары' : 'Открыть платёж', kind: isLink ? 'primary' : 'warn', to: '/pay/' + goodsPay?.id }, ...(cancelSent ? [] : [cancelAct])],
    };
  }

  // Оплачен и в пути: этапы, посылки, материалы.
  const parcelViews: Parcel[] = b.parcels.map((p) => {
    const pay = b.payments.find((x) => x.parcelId === p.id);
    const its = items.filter((i) => p.itemIds.includes(i.id));
    return {
      title: isLink ? `Посылка ${p.n} из ${b.parcels.length}` : 'Доставка', stage: p.state, cur: isLink ? linkCur(o.stage) : Math.min(o.stage, 3),
      items: (its.length ? its : live).map((i) => ({ name: isLink ? `${i.plat ?? ''} · ${i.size ?? ''}`.trim() : `${i.name} · ${i.params}`, img: isLink ? files.url(i.picFileId) ?? '' : i.img })),
      payId: pay?.id, track: p.track ?? undefined, deliveryPaid: isLink ? undefined : 'Оплачена при оформлении',
    };
  });
  const report = b.report?.sentAt ? b.report : undefined;
  const received = o.phase === 'done';
  const delivered = !isLink && o.stage >= 3;
  const acts: OrderAct[] = [];
  if (report) acts.push({ label: 'Смотреть фотоотчёт', kind: 'info', to: '/photo/' + o.num });
  if (delivered && !received) acts.push({ label: 'Всё в порядке, получил', kind: 'primary', recv: true });
  if ((delivered || received || (isLink && o.stage >= 7)) && !b.claim) acts.push({ label: 'Проблема с заказом', kind: 'dangerSoft', to: '/claim/' + o.num });
  const cancellable = !cancelSent && (isLink ? o.stage < 2 : o.stage < 2);
  if (cancellable) acts.push(cancelAct);
  if (!cancellable && !acts.length && !received) acts.push({ label: 'Отменить заказ', kind: 'off', dis: true });

  const status: string = received ? 'Получен' : isLink ? LINK_STATUS[o.stage] : STOCK_STATUS[Math.min(o.stage, 3)];
  const tone: Tone = received ? 'off' : 'live';
  return {
    ...base, group: received ? 'done' : 'active', status, tone,
    stage: isLink ? linkCur(o.stage) : Math.min(o.stage, 3),
    note: received ? 'Вы подтвердили получение. Заказ закрыт.' : isLink ? LINK_NOTE[o.stage] : STOCK_NOTE[Math.min(o.stage, 3)],
    receivable: delivered && !received, receivedAt: o.receivedAt ? ruDate(o.receivedAt) : undefined,
    alert: delivered && !received ? { title: 'Проверьте при получении', text: 'Если с вещью что-то не так, сообщите в течение 7 дней. После этого заказ закроется автоматически.' } : undefined,
    parcels: parcelViews.length ? parcelViews : undefined,
    parcelNote: isLink && parcelViews.length > 1 ? 'Оплата одной посылки не закрывает доставку другой.' : undefined,
    materials: {
      rows: [
        { label: 'Оплата товаров', value: goodsPay?.state === 'ok' ? `Подтверждена продавцом ${ruDate(goodsPay.checkedAt)}` : 'На проверке' },
        ...(o.pointsUsed ? [{ label: 'Списано баллов', value: rub(o.pointsUsed).replace(' ₽', '') }] : []),
        ...(isLink ? [{ label: 'Фотоотчёт со склада', value: report ? 'Готов' : items.some((i) => i.photo) ? 'Будет после склада в Китае' : 'Не выбран — платная услуга' }] : []),
      ],
      pics: report ? report.items.flatMap((x) => x.fileIds).slice(0, 4).map((id) => files.url(id) ?? '') : undefined,
    },
    acts, cancellable,
    footnote: !cancellable && !received ? (isLink ? 'Отмена доступна до выкупа — вещи уже выкуплены, поэтому кнопка выключена.' : 'Заказ уже передан в CDEK — отменить его нельзя.') : undefined,
  };
}
