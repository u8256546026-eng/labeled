import type { Cond } from './types';

export type Address = { id: string; name: string; phone: string; city: string; line: string };

/** Способ получения заказа из наличия (X): пункт выдачи, постамат или курьер CDEK. */
export type Delivery = { mode: 'pvz' | 'post' | 'courier'; pvz: string; slot: number };
export type PickupPoint = { key: string; kind: 'pvz' | 'post'; name: string; sub: string };
export const SLOTS = ['10:00–14:00', '14:00–18:00', '18:00–22:00'];

/** Пункт выдачи из старой демо-версии («p1», «t1») — не настоящий адрес, считаем невыбранным. */
export const pvzText = (d: Delivery) => (/^[pt]\d$/.test(d.pvz) ? '' : d.pvz.trim());

/** «Пункт выдачи CDEK · Москва, Тверская 15» / «Курьер CDEK · 14:00–18:00» — для покупателя и продавца. */
export function deliveryText(d: Delivery | null | undefined): string {
  if (!d) return '';
  if (d.mode === 'courier') return 'Курьер CDEK · ' + (SLOTS[d.slot] ?? '');
  const p = pvzText(d);
  return (d.mode === 'post' ? 'Постамат CDEK' : 'Пункт выдачи CDEK') + (p ? ' · ' + p : '');
}

/**
 * Платёж переводом. «Перевёл» и чек не делают заказ оплаченным —
 * продавец сверяет поступление вручную (review → ok | fail).
 */
export type PayState = 'empty' | 'attached' | 'review' | 'ok' | 'fail';
/** Чек или файл. fileId — id файла на сервере (скриншот позиции заказа по ссылке). */
export type Receipt = { name: string; meta: string; preview?: string; fileId?: string };
export type Payment = {
  id: string;
  kind: 'goods' | 'delivery';
  /** Номер заказа для подписи: «1042 · посылка 1». */
  orderLabel: string;
  orderNum: string;
  /** Номер посылки для оплаты доставки. */
  parcel?: number;
  sum: number;
  /** Когда продавец подтвердил поступление. */
  confirmedAt?: string;
  /** Подпись в «Платежах и чеках» (W): дата и пояснение. */
  note?: string;
  /** Чек для покупателя — загружает сотрудник после подтверждения оплаты (adm04). */
  sellerReceipt?: { name: string; date: string; preview?: string; url?: string };
  state: PayState;
  receipt?: Receipt;
  /** Оплата оформлена из проверки заказа — после «Перевёл» показываем «Заказ оформлен» (K). */
  fromCheckout?: boolean;
};

/** Позиция оформления из наличия: конкретное предложение с ценой на момент проверки. */
export type CheckoutLine = {
  key: string; itemId: string; offerId: string; name: string; img: string; params: string; cond: Cond;
  price: number; qty: number;
  /** Сервер сообщил новую цену — покупатель должен принять её или убрать вещь. */
  newPrice?: number;
  /** Вещь купили, пока покупатель оформлял. */
  sold?: boolean;
};

export type PlacedOrder = { num: string; lines: CheckoutLine[]; goods: number; pointsOff: number; total: number; payId: string; date: string };

/** До 30% стоимости товаров можно оплатить баллами (1 балл = 1 ₽). */
export const maxPoints = (pts: number, goods: number) => Math.min(pts, Math.floor(goods * 0.3));
