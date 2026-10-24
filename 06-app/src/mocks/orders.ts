import type { Address, Payment, PickupPoint } from '../domain/order';
import { IMG } from './images';

export const addr0 = (): Address[] => [
  { id: 'a1', name: 'Анна Смирнова', phone: '+7 921 000-00-00', city: 'Санкт-Петербург', line: 'пр. Энгельса, 27, кв. 14' },
  { id: 'a2', name: 'Анна Смирнова', phone: '+7 921 000-00-00', city: 'Москва', line: 'ул. Правды, 8, офис 3' },
];

export const PICKUP_POINTS: PickupPoint[] = [
  { key: 'p1', kind: 'pvz', name: 'CDEK · Тверская, 15', sub: 'Москва · ежедневно 10:00–21:00 · есть примерочная' },
  { key: 'p2', kind: 'pvz', name: 'CDEK · Мясницкая, 24', sub: 'Москва · пн–сб 9:00–20:00 · есть примерочная' },
  { key: 'p3', kind: 'pvz', name: 'CDEK · Садовая-Спасская, 12', sub: 'Москва · ежедневно 10:00–22:00' },
  { key: 't1', kind: 'post', name: 'Постамат CDEK · Лесная, 5', sub: 'Москва · круглосуточно · до 15 кг' },
  { key: 't2', kind: 'post', name: 'Постамат CDEK · Новослободская, 20', sub: 'Москва · круглосуточно' },
];

/** Реквизиты для перевода — явные заглушки. Настоящие реквизиты магазина задаёт владелец в админке (adm21). */
export const REQUISITES = { bank: 'Заглушка Банк', recipient: 'ИП Заглушка', number: '0000 0000 0000 0000' };

/** Платежи покупателя (W). Доставка посылки 1 по заказу 1042 — «Оплата не подтверждена» (C). */
export const payments0 = (): Record<string, Payment> => {
  const list: Payment[] = [
    { id: 'p-1044', kind: 'goods', orderNum: '1044', orderLabel: '1044', sum: 24680, state: 'empty', note: 'Счёт от 19 сентября' },
    { id: 'p-1045', kind: 'goods', orderNum: '1045', orderLabel: '1045', sum: 9800, state: 'fail', note: '5 сентября · поступление не найдено', receipt: { name: 'Чек из банка.pdf', meta: 'Загружен 5 сентября' } },
    { id: 'p-1042-1', kind: 'delivery', orderNum: '1042', orderLabel: '1042 · посылка 1', parcel: 1, sum: 1850, state: 'fail', note: 'Счёт от 20 сентября · поступление не найдено', receipt: { name: 'Чек из банка.pdf', meta: 'Загружен 20 сентября' } },
    { id: 'p-1041', kind: 'goods', orderNum: '1041', orderLabel: '1041', sum: 14380, state: 'review', note: '6 сентября · чек загружен', receipt: { name: 'Чек из банка.pdf', meta: 'На проверке с 6 сентября' } },
    { id: 'p-1042-2', kind: 'delivery', orderNum: '1042', orderLabel: '1042 · посылка 2', parcel: 2, sum: 1200, state: 'ok', confirmedAt: '6 сентября', note: '6 сентября' },
    { id: 'p-1038', kind: 'goods', orderNum: '1038', orderLabel: '1038', sum: 18050, state: 'ok', confirmedAt: '1 сентября', note: '1 сентября · списано 250 баллов', sellerReceipt: { name: 'Чек продавца.pdf', date: '1 сентября', preview: IMG.receipt } },
    { id: 'p-1046', kind: 'goods', orderNum: '1046', orderLabel: '1046', sum: 15400, state: 'ok', confirmedAt: '10 августа', note: '10 августа', sellerReceipt: { name: 'Чек продавца.pdf', date: '10 августа', preview: IMG.receipt } },
  ];
  return Object.fromEntries(list.map((p) => [p.id, p]));
};
