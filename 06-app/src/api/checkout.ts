import type { CheckoutLine, Delivery, PlacedOrder, Receipt } from '../domain/order';
import { PRODUCTS } from '../mocks/products';
import { ApiError, http, live, mock, upload } from './client';
import { productCache } from './catalog';

/** Демо-сценарии сервера: ?scenario=price — цена изменилась (A), ?scenario=sold — вещь продана (L), ?scenario=uploaderr. */
const scenario = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('scenario') : null);

let orderSeq = 1048;

export const checkoutApi = {
  /** Строка оформления для быстрой покупки одного предложения из карточки. */
  lineForOffer(offerId: string): CheckoutLine | null {
    for (const p of [...productCache.values(), ...PRODUCTS]) {
      const o = p.offers.find((x) => x.id === offerId);
      if (o) {
        const c = p.colors.find((x) => x.id === o.color)!;
        return { key: 'q-' + o.id, itemId: p.id, offerId: o.id, name: p.name, img: o.img, params: o.size ? `${c.name} / ${o.size}` : c.name, cond: o.cond, price: o.price, qty: 1 };
      }
    }
    return null;
  },

  /** Сервер сверяет цены и наличие на момент оформления. Вещи закрепляются за покупателем. */
  validate(lines: CheckoutLine[]): Promise<CheckoutLine[]> {
    if (live()) return http('POST', '/api/checkout/validate', { lines });
    return mock(() => {
      const s = scenario();
      const target = lines.find((l) => l.itemId === 'knit') ?? lines[lines.length - 1];
      return lines.map((l) => {
        if (l !== target) return l;
        if (s === 'price') return { ...l, newPrice: l.price + 500 };
        if (s === 'sold') return { ...l, sold: true };
        return l;
      });
    });
  },

  /** Создаёт заказ из наличия и платёж за товары. Оплата — переводом, после «Подтвердить заказ». */
  place(input: { lines: CheckoutLine[]; pointsOff: number; delivery: Delivery; addressId: string; key?: string }): Promise<PlacedOrder> {
    if (live()) return http('POST', '/api/orders', { lines: input.lines.map((l) => ({ offerId: l.offerId, qty: l.qty, price: l.price })), pointsOff: input.pointsOff, delivery: input.delivery, addressId: input.addressId, key: input.key });
    return mock(() => {
      const num = String(orderSeq++);
      const goods = input.lines.reduce((s, l) => s + l.price * l.qty, 0);
      return { num, lines: input.lines, goods, pointsOff: input.pointsOff, total: goods - input.pointsOff, payId: 'p-' + num, date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) };
    });
  },
};

const MAX_RECEIPT = 10 * 1024 * 1024;
const kb = (n: number) => (n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' КБ' : (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ');

export const paymentsApi = {
  /** Загрузка чека: скриншот или PDF из банка, до 10 МБ. */
  uploadReceipt(payId: string, file: File): Promise<Receipt> {
    if (live()) {
      if (file.size > MAX_RECEIPT) return Promise.reject(new ApiError('server', 'too_large'));
      // 'link' — скриншот позиции заказа по ссылке (AW): обычный файл, не чек.
      if (payId === 'link') return upload<{ id: string; name: string; url: string }>('/api/files?kind=link_item', file).then((f) => ({ name: f.name, meta: kb(file.size), preview: f.url, fileId: f.id }));
      return upload<Receipt>(`/api/payments/${encodeURIComponent(payId)}/receipt`, file);
    }
    if (scenario() === 'uploaderr' || file.size > MAX_RECEIPT || !(file.type.startsWith('image/') || file.type === 'application/pdf')) {
      return new Promise((_, reject) => setTimeout(() => reject(new ApiError('server', 'upload')), 400));
    }
    return mock(() => ({ name: file.name, meta: 'Добавлен только что · ' + kb(file.size), preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }), 500);
  },

  /** «Перевёл»: платёж уходит продавцу на ручную сверку. */
  markTransferred(payId: string): Promise<void> {
    if (live()) return http<void>('POST', `/api/payments/${encodeURIComponent(payId)}/transferred`).then(() => undefined);
    return mock(() => undefined);
  },
};
