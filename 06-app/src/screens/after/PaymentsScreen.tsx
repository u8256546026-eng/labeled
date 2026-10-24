import type { Payment } from '../../domain/order';
import { rub } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { useApp } from '../../store/app';
import { Cards, Empty, H } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

const PILL: Record<Payment['state'], [string, 'live' | 'wait' | 'err']> = { empty: ['Ждёт оплаты', 'wait'], attached: ['Ждёт оплаты', 'wait'], review: ['На проверке', 'wait'], ok: ['Подтверждена', 'live'], fail: ['Не подтверждена', 'err'] };

/** W — платежи и чеки: все переводы по заказам со статусом проверки. Чек продавца появляется после подтверждения (adm04). */
export function PaymentsScreen() {
  const nav = useNav();
  const payments = Object.values(useApp((s) => s.payments));
  const title = (p: Payment) => `Заказ ${p.orderNum} · ${p.kind === 'delivery' ? 'доставка посылки ' + (p.parcel ?? '') : 'товары'}`;
  const sub = (p: Payment) => [p.note, p.sellerReceipt ? 'чек продавца' : ''].filter(Boolean).join(' · ') || undefined;
  const groups: [string, Payment[]][] = [
    ['Требуют действия', payments.filter((p) => p.state === 'empty' || p.state === 'attached' || p.state === 'fail')],
    ['На проверке', payments.filter((p) => p.state === 'review')],
    ['Подтверждены', payments.filter((p) => p.state === 'ok')],
  ];
  return (
    <Screen header={<Header title="Платежи и чеки" />}>
      {!payments.length ? <Empty minH={560} title="Платежей пока нет" text="Здесь появятся переводы по заказам и чеки продавца." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }]} /> : groups.map(([h, list]) => list.length > 0 && (
        <section key={h} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <H text={h} />
          <Cards rows={list.map((p) => ({ title: title(p), sub: sub(p), right: rub(p.sum), pill: PILL[p.state][0], pillTone: PILL[p.state][1], on: () => nav.go('/pay/' + p.id) }))} />
        </section>
      ))}
    </Screen>
  );
}
