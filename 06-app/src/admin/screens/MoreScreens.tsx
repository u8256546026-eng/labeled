import { live } from '../../api/client';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { num, plural, rub } from '../../lib/format';
import { SUMMARY, type AdmBuyer } from '../../mocks/admin';
import { useNav } from '../../nav/useNav';
import { tmaEnv } from '../../telegram/tma';
import { useToast } from '../../ui/Toast';
import { adminApi, adminLoad, useAdmin, useCan, type AdminState } from '../api';
import { useAction, useLoad } from '../hooks';
import { ROLES, type PillTone, type Role } from '../model';
import { AChips, AdminLoading, AEmpty, AH, AdminScreen, Ava, BtnRow, Field, KV, Rows, Search, Seg, Stats, type RowSpec } from '../ui';

/** adm17 — разделы по правам роли и возврат в режим покупателя. Журнал действий (adm33) — только владельцу. */
export function AdminMoreScreen() {
  const nav = useNav();
  const can = useCan();
  const me = useAdmin((s) => s.me);
  const mod = useAdmin((s) => s.reviews.filter((r) => r.state === 'mod').length);
  const staffN = useAdmin((s) => s.staff.length);
  // Счётчики в строках: отзывы на модерации и сотрудники — если есть права (ошибку загрузки не показываем).
  useLoad(() => Promise.all([can('reviews') ? adminLoad.reviews() : 0, can('staff') ? adminLoad.staff() : 0]).catch(() => 0), []);
  const rows: [boolean, RowSpec][] = [
    [can('summary'), { icon: 'chart', title: 'Сводка за день', sub: 'Заказы, оплаты, комиссия', on: () => nav.go('/admin/summary') }],
    [can('buyers'), { icon: 'users', title: 'Покупатели', sub: 'Поиск, заказы, баллы', on: () => nav.go('/admin/buyers') }],
    [can('reviews'), { icon: 'star', title: 'Отзывы', sub: 'Модерация отзывов о labeled', pill: mod ? `${mod} на модерации` : null, tone: 'wait', on: () => nav.go('/admin/reviews') }],
    [can('banners'), { icon: 'image', title: 'Баннеры и категории', sub: 'Главная и каталог', on: () => nav.go('/admin/banners') }],
    [can('prices'), { icon: 'calc', title: 'Курс, комиссия, услуги', sub: 'И реквизиты для перевода', on: () => nav.go('/admin/settings') }],
    [can('staff'), { icon: 'lock', title: 'Сотрудники и права', sub: `${staffN} ${plural(staffN, 'человек', 'человека', 'человек')}`, on: () => nav.go('/admin/staff') }],
    [can('staff') && me?.role === 'owner', { icon: 'receipt', title: 'Журнал действий', sub: 'Кто, что и когда сделал', on: () => nav.go('/admin/log') }],
  ];
  const allowed = rows.filter(([ok]) => ok).map(([, r]) => r);
  return (
    <AdminScreen title="Ещё" sub={me ? `${me.name} · ${ROLES[me.role].label}` : ''}>
      {allowed.length > 0 && <Rows items={allowed} />}
      <AH title="Режим" />
      <Rows items={[{ icon: 'swap', title: 'Перейти в режим покупателя', sub: 'Каталог, корзина и ваши заказы', on: () => nav.root('/profile') }]} />
      {(tmaEnv() === 'mock' && !live()) && me && (
        <>
          <AH title="Только в демо" sub="Посмотреть, что видит каждая роль" />
          <AChips label="Роль в демо" items={(Object.keys(ROLES) as Role[]).map((k) => ({ label: ROLES[k].label, on_: me.role === k, act: () => adminApi.setSession({ ...me, role: k, perms: null }) }))} />
        </>
      )}
    </AdminScreen>
  );
}

/** Что сейчас ждёт по покупателю: метка в списке (adm18). */
function waitingFor(s: AdminState, id: string): [string, PillTone] | null {
  if (s.payments.some((p) => p.buyerId === id && p.state === 'review')) return ['Оплата на проверке', 'wait'];
  if (s.requests.some((r) => r.buyerId === id && r.state === 'review')) return ['Заявка', 'live'];
  if (s.claims.some((c) => c.buyerId === id && !c.closed)) return ['Обращение', 'err'];
  return null;
}

/** adm18 — покупатели: поиск по имени, Telegram и телефону. */
export function AdminBuyersScreen() {
  const nav = useNav();
  const state = useAdmin((s) => s);
  const [q, setQ] = useState('');
  const L = useLoad(() => adminLoad.buyers(), []);
  if (!L.ready) return <AdminLoading title="Покупатели" error={L.error} retry={L.reload} />;
  const ql = q.trim().toLowerCase().replace(/^@/, '');
  const digits = q.replace(/\D/g, '');
  const list = state.buyers.filter((b) => !ql || b.name.toLowerCase().includes(ql) || b.handle.toLowerCase().includes(ql) || (digits.length >= 3 && b.phone.replace(/\D/g, '').includes(digits)));
  const sub = (b: AdmBuyer) => `${b.orders} ${plural(b.orders, 'заказ', 'заказа', 'заказов')} · ${b.pts ? `${num(b.pts)} ${plural(b.pts, 'балл', 'балла', 'баллов')}` : b.handle}`;
  return (
    <AdminScreen title="Покупатели" sub={`${state.buyers.length} ${plural(state.buyers.length, 'покупатель', 'покупателя', 'покупателей')}`}>
      <Search ph="Имя, @telegram или телефон" value={q} onChange={setQ} />
      {list.length === 0
        ? <AEmpty icon="users" title="Никого не нашли" text="Проверьте написание или ищите по @telegram." />
        : <Rows items={list.map((b) => { const w = b.waiting !== undefined ? b.waiting : waitingFor(state, b.id); return { ava: { photo: b.photo }, title: b.name, sub: sub(b), pill: w?.[0], tone: w?.[1], on: () => nav.go('/admin/buyer/' + b.id) }; })} />}
    </AdminScreen>
  );
}

/** adm19 — покупатель: данные, ручное начисление или списание баллов с причиной (видна в истории баллов, H). */
export function AdminBuyerScreen() {
  const { id = '' } = useParams();
  const nav = useNav();
  const can = useCan();
  const toast = useToast();
  const { busy, run } = useAction();
  const b = useAdmin((s) => s.buyers.find((x) => x.id === id));
  const orders = useAdmin((s) => s.orders);
  const [mode, setMode] = useState<'add' | 'sub'>('add');
  const [amt, setAmt] = useState('');
  const [why, setWhy] = useState('');
  const L = useLoad(() => Promise.all([adminLoad.buyer(id), can('orders') ? adminLoad.orders() : 0]), [id], { live: true });
  if (!L.ready) return <AdminLoading title="Покупатель" error={L.error} retry={L.reload} />;
  if (!b) return <AdminScreen title="Покупатель"><AEmpty icon="user" title="Покупатель не найден" text="Возможно, он удалил аккаунт." /></AdminScreen>;
  const n = parseInt(amt, 10) || 0;
  const over = mode === 'sub' && n > b.pts;
  const label = over ? 'Больше, чем на балансе' : (mode === 'add' ? 'Начислить' : 'Списать') + (n ? ` ${num(n)} ${plural(n, 'балл', 'балла', 'баллов')}` : '');
  const mine = orders.filter((o) => o.buyerId === b.id);
  return (
    <AdminScreen title={b.name} sub={`${b.handle} · ${b.since}`}>
      <Rows items={[{ ava: { photo: b.photo }, title: b.name, sub: b.handle !== '—' ? b.handle + ' · Telegram' : 'Telegram без @имени', copy: b.handle !== '—' ? b.handle : undefined }]} />
      <KV copy copyAs={{ 1: b.email.includes('@') ? b.email.split(' · ')[0] : '', 2: '' }} rows={[['Телефон', b.phone], ['Почта', b.email], ['Заказов', `${b.orders} на ${rub(b.spent)}`]]} />
      <AH title="Баллы" />
      <Stats items={[['Баланс', num(b.pts), true], ['За приглашения', num(b.invitePts)]]} />
      <Seg aria="Начислить или списать" items={[['add', 'Начислить'], ['sub', 'Списать']]} cur={mode} set={setMode} />
      <Field label="Сколько" value={amt} mode="numeric" suffix="баллов" onChange={(v) => setAmt(v.replace(/\D/g, '').slice(0, 6))} ph="0" />
      <Field label="Причина" value={why} onChange={setWhy} ph="Покупатель увидит её в истории баллов" />
      <BtnRow items={[{ label, kind: mode === 'add' ? 'primary' : 'danger', dis: busy || !n || !why.trim() || over, on: () => run(() => adminApi.adjustPoints(b.id, mode === 'add' ? n : -n, why.trim()), () => { setAmt(''); setWhy(''); toast(mode === 'add' ? 'Баллы начислены' : 'Баллы списаны'); }) }]} />
      {b.points.length > 0 && <Rows items={b.points.map((p) => ({ title: p.text, sub: p.date + ' · вручную', right: (p.delta > 0 ? '+' : '−') + num(Math.abs(p.delta)), chev: false }))} />}
      {can('orders') && mine.length > 0 && (
        <>
          <AH title="Заказы" />
          <Rows items={mine.map((o) => ({ title: `№${o.num} · ${o.what}`, right: rub(o.sum), pill: o.status, tone: o.tone, chev: false, on: () => nav.go('/admin/order/' + o.num) }))} />
        </>
      )}
    </AdminScreen>
  );
}

/** adm20 — отзывы: новые ждут модерации; опубликованные видны в «Отзывах о labeled» (AC), скрытые — нет. */
export function AdminReviewsScreen() {
  const { busy, run } = useAction();
  const reviews = useAdmin((s) => s.reviews);
  const [rf, setRf] = useState<'mod' | 'pub' | 'hid'>('mod');
  const L = useLoad(() => adminLoad.reviews(), []);
  if (!L.ready) return <AdminLoading title="Отзывы" error={L.error} retry={L.reload} />;
  const cnt = (k: string) => reviews.filter((r) => r.state === k).length;
  const list = reviews.filter((r) => r.state === rf);
  return (
    <AdminScreen title="Отзывы" sub={`${cnt('mod')} на модерации`}>
      <AChips label="Статус отзыва" items={([['mod', 'На модерации'], ['pub', 'Опубликованы'], ['hid', 'Скрытые']] as const).map(([k, label]) => ({ label, n: cnt(k), on_: rf === k, act: () => setRf(k) }))} />
      {list.length === 0 ? <AEmpty icon="star" title="Здесь пусто" text={rf === 'mod' ? 'Новые отзывы появятся здесь до публикации.' : 'Отзывов в этом списке нет.'} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((r) => (
              <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 18, background: 'var(--lb-white)', border: '1px solid var(--lb-ink-a08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div role="img" aria-label={`${r.stars} из 5`} style={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((k) => <svg key={k} width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ fill: k <= r.stars ? 'var(--lb-ink-2)' : 'var(--lb-n-200)' }}><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>)}
                  </div>
                  <Ava photo={r.photo} size={24} label={r.who} />
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.who}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--lb-ink-2)' }}>{r.when}</span>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty' }}>{r.text}</div>
                <div style={{ fontSize: 11.5, color: 'var(--lb-ink-2)' }}>{r.about}</div>
                <BtnRow cols={2} items={rf === 'mod'
                  ? [{ label: 'Опубликовать', kind: 'limeSoft', dis: busy, on: () => run(() => adminApi.setReview(r.id, 'pub'), 'Отзыв опубликован') }, { label: 'Скрыть', kind: 'danger', dis: busy, on: () => run(() => adminApi.setReview(r.id, 'hid'), 'Отзыв скрыт') }]
                  : rf === 'pub' ? [{ label: 'Скрыть', kind: 'danger', full: true, dis: busy, on: () => run(() => adminApi.setReview(r.id, 'hid'), 'Отзыв скрыт') }]
                    : [{ label: 'Опубликовать', kind: 'limeSoft', full: true, dis: busy, on: () => run(() => adminApi.setReview(r.id, 'pub'), 'Отзыв опубликован') }]} />
              </div>
            ))}
          </div>
        )}
    </AdminScreen>
  );
}

/** adm25 — сводка за день, неделю или месяц и заказы по этапам; этап открывает список с этим фильтром. */
export function AdminSummaryScreen() {
  const nav = useNav();
  const orders = useAdmin((s) => s.orders);
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const server = useAdmin((s) => s.summary[range]);
  const L = useLoad(() => adminLoad.summary(range), [range]);
  if (!L.ready && !server) return <AdminLoading title="Сводка" error={L.error} retry={L.reload} />;
  // С сервера — цифры периода и заказы по этапам; на моках — демо-цифры и заказы из adminDb.
  const S = server ?? SUMMARY[range];
  const cnt = (g: string) => (server ? server.stages[g as keyof typeof server.stages] : orders.filter((o) => o.group === g).length);
  return (
    <AdminScreen title="Сводка" sub={S.sub}>
      <Seg aria="Период" items={[['day', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц']]} cur={range} set={setRange} />
      <Stats items={[['Новые заказы', S.v[0], true], ['Оплачено', rub(S.v[1])], ['Комиссия', rub(S.v[2])], ['Новые покупатели', S.v[3]]]} />
      <AH title="Заказы по этапам" sub="Сейчас, без учёта периода" />
      <Rows items={([['req', 'Заявки на проверке', 'link'], ['pay', 'Ждут оплаты или проверки', 'card'], ['buy', 'Выкуп и склад', 'camera'], ['ship', 'В пути', 'truck'], ['prob', 'Проблемы', 'alert']] as const).map(([g, title, icon]) => ({ icon, title, right: cnt(g), on: () => nav.root('/admin/orders?of=' + g) }))} />
    </AdminScreen>
  );
}

