import { useOrders } from '../../api/useOrders';
import { orderDrafts } from '../../api/orders';
import type { Order } from '../../domain/orders';
import { plural } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { Empty, Note, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { GroupHead, OrderCard } from '../../ui/orderBlocks';
import { Screen } from '../../ui/Screen';

const GROUPS: [Order['group'], string][] = [['decision', 'Ждут решения'], ['active', 'В работе'], ['done', 'Завершённые']];

/** 7i · G · AY — «Мои заказы»: черновики, заявки на решении, заказы в работе и завершённые. */
export function OrdersScreen() {
  const nav = useNav();
  const q = useOrders();
  const drafts = orderDrafts();
  const orders = q.orders;

  const live = orders?.filter((o) => o.group !== 'done').length ?? 0;
  const done = orders?.filter((o) => o.group === 'done').length ?? 0;
  const header = (
    <Header title="Мои заказы">
      {orders && orders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'var(--lb-white-a72)' }}>
            <div aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--lb-ink)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>{live} {plural(live, 'заказ', 'заказа', 'заказов')} в работе</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: 'var(--lb-white-a45)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--lb-ink-2)' }}>{done} {plural(done, 'завершён', 'завершены', 'завершены')}</span>
          </div>
        </div>
      )}
    </Header>
  );

  if (q.error && !orders) return <Screen header={header}><Note tone="err" title="Нет соединения" text="Проверьте интернет и повторите. Черновики и введённые данные не пропадут." act={{ label: 'Повторить', on: q.reload }} /></Screen>;
  if (!orders) return <Screen header={header}><Skel n={2} /></Screen>;
  if (!orders.length && !drafts.length) {
    return <Screen header={header}><Empty minH={600} title="Заказов пока нет" text="Здесь появятся заявки, заказы и черновики — из каталога и из заказа по ссылке." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }, { label: 'Заказ по ссылке', kind: 'limeSoft', on: () => nav.root('/link') }]} /></Screen>;
  }

  return (
    <Screen header={header}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 2 }}>
        {drafts.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <GroupHead label="Черновики" n={drafts.length} on={false} />
            {drafts.map((d) => <OrderCard key={d.id} pre="" title={d.title} name={d.title} kind="" status="Черновик" meta={d.date} tone="off" thumbs={[]} onClick={() => nav.root('/link')} />)}
          </section>
        )}
        {GROUPS.map(([g, label]) => {
          const list = orders.filter((o) => o.group === g);
          if (!list.length) return null;
          return (
            <section key={g} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ marginBottom: 2 }}><GroupHead label={label} n={list.length} on={g !== 'done'} /></div>
              {list.map((o) => {
                const of = o.kind === 'link' ? 5 : 4;
                const dead = !!o.stopped;
                return (
                  <OrderCard key={o.num} pre={o.pre} num={/^\d+$/.test(o.num) ? o.num : undefined} name={o.name} kind={o.kind === 'link' ? 'Из-за границы' : 'Из наличия'}
                    title={o.listTitle} status={o.listStatus ?? o.status} meta={o.listMeta} tone={o.listTone ?? o.tone} thumbs={o.thumbs} dead={dead}
                    step={o.group === 'decision' ? undefined : Math.min(of, o.stage + 1)} of={o.group === 'decision' ? undefined : of}
                    onClick={() => nav.go('/order/' + o.num)} />
                );
              })}
            </section>
          );
        })}
      </div>
    </Screen>
  );
}
