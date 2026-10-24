import { Send, Star, User } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useOrders } from '../../api/useOrders';
import type { Payment } from '../../domain/order';
import { parcelDelivery, type Order } from '../../domain/orders';
import { num, plural, rub } from '../../lib/format';
import { useReviewsSummary } from '../../ui/ReviewsLine';
import { useNav } from '../../nav/useNav';
import { useApp } from '../../store/app';
import { Btns } from '../../ui/Btn';
import { Cards, H, Note, Skel } from '../../ui/blocks';
import { ic } from '../../ui/icons';
import { OrderCard } from '../../ui/orderBlocks';
import { Screen } from '../../ui/Screen';
import { StaffModeCard } from '../../admin/StaffModeCard';

type Attention = { key: string; title: string; meta: string; status: string; tone: Order['tone']; thumbs: string[]; to: string; step?: number; of?: number };

/** Заказы, где покупатель должен что-то сделать: оплатить товары или доставку, принять решение по заявке. */
function needsAction(orders: Order[], payments: Record<string, Payment>): Attention[] {
  const out: Attention[] = [];
  for (const o of orders) {
    if (o.stopped || o.group === 'done') continue;
    const pay = o.payId ? payments[o.payId] : undefined;
    if (o.awaitingPay && pay && (pay.state === 'empty' || pay.state === 'fail')) {
      out.push({ key: o.num, title: `Заказ ${o.num} · ${o.name}`, meta: pay.state === 'fail' ? 'Продавец не нашёл поступление по чеку' : 'Продавец подтвердил сумму — можно оплатить', status: o.status, tone: o.tone, thumbs: o.thumbs, to: '/order/' + o.num });
    } else if (o.listTone === 'err') {
      out.push({ key: o.num, title: o.listTitle ?? `${o.pre} ${o.num} · ${o.name}`, meta: o.listMeta, status: o.listStatus ?? o.status, tone: 'err', thumbs: o.thumbs, to: '/order/' + o.num });
    }
    o.parcels?.forEach((p, i) => {
      const pp = p.payId ? payments[p.payId] : undefined;
      const d = parcelDelivery(rub(pp?.sum ?? 0), pp, p.deliveryPaid);
      if (d.needPay) out.push({ key: o.num + '-' + i, title: `Заказ ${o.num} · ${p.title.split(' из ')[0].toLowerCase()}`, meta: `${p.stage} · доставка ${d.text}`, status: 'Оплатить доставку', tone: 'wait', thumbs: p.items.map((x) => x.img).slice(0, 2), to: '/order/' + o.num, step: o.stage + 1, of: o.kind === 'link' ? 5 : 4 });
    });
  }
  return out;
}

/** E · AK — профиль гостя и после входа. Фото и имя — из Telegram; фото в приложении не меняется. */
export function ProfileScreen() {
  const nav = useNav();
  const reviews = useReviewsSummary();
  const auth = useApp((s) => s.auth);
  const me = useApp((s) => s.me);
  const name = useApp((s) => s.name);
  const pts = useApp((s) => s.pts);
  const addrs = useApp((s) => s.addrs.length);
  const email = useApp((s) => s.email);
  const favs = useApp((s) => s.favs.length);
  const eventsRead = useApp((s) => s.eventsRead);
  const payments = useApp((s) => s.payments);
  const { orders } = useOrders();
  const toAuth = (next: string) => nav.go('/auth?next=' + encodeURIComponent(next));

  const active = orders?.filter((o) => o.group === 'active').length ?? 0;
  const attention = orders ? needsAction(orders, payments).slice(0, 3) : null;

  const statBtn = (dark: boolean): CSSProperties => ({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0, padding: 12, border: 0, borderRadius: 16, background: dark ? 'var(--lb-ink-2)' : 'var(--lb-white-a72)', textAlign: 'left', cursor: 'pointer', color: dark ? 'var(--lb-white)' : 'var(--lb-ink)' });

  const header = (
    <div className="top-fill" style={{ background: 'var(--lime)', borderRadius: '0 0 22px 22px', padding: 'calc(18px + var(--safe-top)) var(--px) 18px' }}>
      <h1 style={{ margin: 0, fontSize: 'var(--f-h1)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>Профиль</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        {auth ? (
          <button type="button" aria-label="Изменить имя" onClick={() => nav.go('/profile/edit')} className="pressable-sm"
            style={{ position: 'relative', overflow: 'hidden', width: 60, height: 60, flex: 'none', padding: 0, border: 0, borderRadius: 999, cursor: 'pointer', backgroundColor: 'var(--lb-n-150)', boxShadow: '0 0 0 3px var(--lb-white-a72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Значок под фото: виден, пока фото грузится или если оно не загрузилось. */}
            <User size={28} aria-hidden />
            {me.photo && <span aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url("${me.photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
          </button>
        ) : (
          <div aria-hidden style={{ width: 60, height: 60, flex: 'none', borderRadius: 999, background: 'var(--lb-white-a60)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={28} fill="#111111" /></div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2, textWrap: 'pretty' }}>{auth ? name : 'Вы не вошли'}</div>
          <div style={{ marginTop: 4, fontSize: 'var(--f-small)', lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>{auth ? (me.username ? '@' + me.username : 'Вход через Telegram') : 'Войдите, чтобы сохранять заказы, адреса и баллы'}</div>
        </div>
        {auth && <button type="button" onClick={() => nav.go('/profile/edit')} className="pressable-sm" style={{ flex: 'none', height: 36, padding: '0 12px', border: 0, borderRadius: 999, background: 'var(--lb-white-a72)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Изменить</button>}
      </div>
      {auth ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 6, marginTop: 16 }}>
          <button type="button" aria-label={'Баллы labeled: ' + pts} onClick={() => nav.go('/points')} className="pressable-sm" style={statBtn(true)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Star size={13} strokeWidth={2.4} color="#C6FF00" aria-hidden />
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>{num(pts)}</span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>баллов · 1 Б = 1 ₽</span>
          </button>
          <button type="button" onClick={() => nav.go('/orders')} className="pressable-sm" style={statBtn(false)}>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em' }}>{orders ? active : '…'}</span>
            <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>в работе</span>
          </button>
          <button type="button" onClick={() => nav.go('/addresses')} className="pressable-sm" style={statBtn(false)}>
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em' }}>{addrs}</span>
            <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{plural(addrs, 'адрес', 'адреса', 'адресов')}</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={() => toAuth('/profile')} className="pressable" style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, border: 0, borderRadius: 999, background: 'var(--lb-ink-2)', color: 'var(--lb-white)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Send size={18} strokeWidth={2.1} color="#C6FF00" aria-hidden /><span>Войти через Telegram</span>
          </button>
        </div>
      )}
    </div>
  );

  if (!auth) {
    return (
      <Screen header={header}>
        <H text="После входа" sub="Каталог открыт и без входа. Эти разделы привязаны к аккаунту." />
        <Cards rows={[
          { ...ic('orders'), title: 'Мои заказы', sub: 'Заявки, заказы из наличия и по ссылке, черновики', pill: 'Нужен вход', on: () => toAuth('/orders') },
          { ...ic('addr'), title: 'Адреса', sub: 'Подставляются при оформлении', pill: 'Нужен вход', on: () => toAuth('/addresses') },
          { ...ic('gift'), title: 'Баллы и приглашение друга', sub: '250 баллов после первого выполненного заказа друга', pill: 'Нужен вход', on: () => toAuth('/points') },
        ]} />
        <H text="Доступно сейчас" />
        <Cards rows={[
          { ...ic('star'), title: 'Отзывы о labeled', sub: reviews ? `${reviews.score} · ${reviews.count}` : 'Отзывы покупателей', on: () => nav.go('/reviews') },
          { ...ic('help'), title: 'Помощь и поддержка', sub: 'Вопросы и чат в Telegram', on: () => nav.go('/help') },
        ]} />
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <StaffModeCard />
      {attention === null ? <Skel n={2} /> : attention.length > 0 && (
        <>
          <H text="Требуют внимания" />
          {attention.map((a) => <OrderCard key={a.key} pre="" name="" kind="" title={a.title} status={a.status} meta={a.meta} tone={a.tone} thumbs={a.thumbs} step={a.step} of={a.of} onClick={() => nav.go(a.to)} />)}
        </>
      )}
      <Btns items={[{ label: 'Все заказы', kind: 'info', on: () => nav.go('/orders') }]} />
      {email !== 'ok' && <Note tone="info" title="−50% на комиссию" text="Привяжите и подтвердите почту — в первом заказе будет скидка 50% на комиссию." act={{ label: 'Привязать почту', on: () => nav.go('/email') }} />}
      <H text="Аккаунт" />
      <Cards rows={[
        { ...ic('bell'), title: 'События', sub: 'Изменения заявок, оплат и доставки', pill: eventsRead ? undefined : '2 новых', pillTone: 'live', on: () => nav.go('/inbox') },
        { ...ic('heart'), title: 'Избранное', sub: `${favs} ${plural(favs, 'вещь', 'вещи', 'вещей')}`, on: () => nav.go('/fav') },
        { ...ic('receipt'), title: 'Платежи и чеки', sub: 'Переводы по заказам и их проверка', on: () => nav.go('/payments') },
        { ...ic('addr'), title: 'Адреса', sub: `${addrs} ${plural(addrs, 'сохранённый', 'сохранённых', 'сохранённых')} · выбор при оформлении`, on: () => nav.go('/addresses') },
        { ...ic('gift'), title: 'Пригласить друга', sub: '250 баллов после первого выполненного заказа друга', on: () => nav.go('/invite') },
        { ...ic('gear'), title: 'Настройки', sub: 'Почта и уведомления', on: () => nav.go('/settings') },
        { ...ic('help'), title: 'Помощь и поддержка', sub: 'Вопросы и чат в Telegram', on: () => nav.go('/help') },
      ]} />
    </Screen>
  );
}
