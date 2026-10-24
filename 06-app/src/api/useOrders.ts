import { useMemo } from 'react';
import { orderView, type Order } from '../domain/orders';
import { useApi } from '../lib/useApi';
import { useApp } from '../store/app';
import { live } from './client';
import { ordersApi, sessionOrders } from './orders';

/** Все заказы покупателя с учётом платежей и его действий. null — ещё загружаются. */
export function useOrders(): { orders: Order[] | null; error: unknown; reload: () => void } {
  const q = useApi(() => ordersApi.list(), [], 'orders', { live: true });
  const payments = useApp((s) => s.payments);
  const orderState = useApp((s) => s.orderState);
  const placed = useApp((s) => s.placed);
  const preorders = useApp((s) => s.preorders);
  const linkRequests = useApp((s) => s.linkRequests);
  const orders = useMemo(() => (q.data
    ? [...(live() ? [] : sessionOrders({ placed, preorders, linkRequests })), ...q.data].map((o) => orderView(o, o.payId ? payments[o.payId] : undefined, orderState[o.num]))
    : null), [q.data, placed, preorders, linkRequests, payments, orderState]);
  return { orders, error: q.error, reload: q.reload };
}
