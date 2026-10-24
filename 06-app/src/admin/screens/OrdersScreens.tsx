import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { plural, rub } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { Btn } from '../../ui/Btn';
import { useSheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { QUICK_REPLIES, type AdmClaim, type AdmOrder, type AdmParcel } from '../../mocks/admin';
import { adminApi, adminLoad, adminUploads, useAdmin, useCan } from '../api';
import { useAction, useLoad } from '../hooks';
import { CLAIM_DECISIONS, MAX_PARCELS, ORDER_GROUPS, SELLER_CANCEL, STAGES, type OrderGroup } from '../model';
import { AChips, AdminLoading, AEmpty, ANote, AH, AdminScreen, BtnRow, Field, KV, type KVRow, Knob, PhotoGrid, RadioList, Rows, Search, StepsV } from '../ui';
import { sized } from '../../lib/img';

const STOCK_STAGES = ['Оформлен', 'Оплата подтверждена', 'Передано в CDEK', 'Доставлен'];
const stagesOf = (o: AdmOrder) => (o.kind === 'stock' ? STOCK_STAGES : STAGES);

/** adm09 — все заказы: поиск по номеру и имени, чипсы этапов, «Проблемы». */
export function AdminOrdersScreen() {
  const nav = useNav();
  const loc = useLocation();
  const orders = useAdmin((s) => s.orders);
  const buyers = useAdmin((s) => s.buyers);
  const [q, setQ] = useState('');
  const [of, setOf] = useState<OrderGroup | 'all'>(() => (new URLSearchParams(loc.search).get('of') as OrderGroup | null) ?? 'all');
  const L = useLoad(() => adminLoad.orders(), [], { live: true });
  if (!L.ready) return <AdminLoading title="Заказы" error={L.error} retry={L.reload} />;
  const who = (o: AdmOrder) => buyers.find((b) => b.id === o.buyerId)?.name ?? '';
  const prob = orders.filter((o) => o.group === 'prob').length;
  const ql = q.trim().toLowerCase();
  const list = orders.filter((o) => (of === 'all' || o.group === of) && (!ql || o.num.includes(ql) || who(o).toLowerCase().includes(ql)));
  return (
    <AdminScreen title="Заказы" sub={`${orders.length} ${plural(orders.length, 'заказ', 'заказа', 'заказов')} · ${prob} с проблемой`}>
      <Search ph="Номер заказа или имя" value={q} onChange={setQ} />
      <AChips label="Этап заказа" items={ORDER_GROUPS.map(([g, label]) => ({ label, n: g === 'prob' ? prob : null, on_: of === g, act: () => setOf(g) }))} />
      {list.length === 0
        ? <AEmpty icon="box" title="Заказов нет" text="Измените фильтр или поисковый запрос." />
        : <Rows items={list.map((o) => ({ title: `№${o.num} · ${who(o)}`, sub: o.what, right: rub(o.sum), pill: o.status, tone: o.tone, chev: false, on: () => nav.go('/admin/order/' + o.num) }))} />}
    </AdminScreen>
  );
}

/**
 * Получатель и доставка — каждое значение своей строкой, чтобы копировать по отдельности:
 * «Пункт выдачи CDEK · Москва, Тверская, 15» → способ и адрес пункта.
 */
function shipRows(o: AdmOrder): KVRow[] {
  const s = o.ship!;
  const rows: KVRow[] = [['Получатель', s.who], ['Телефон', s.phone], ['Адрес', s.addr]];
  if (o.kind !== 'stock') return [...rows, ['Отправка', s.how]];
  const [how, ...rest] = s.how.split(' · ');
  const place = rest.join(' · ');
  return [...rows, ['Получение', how], ...(place ? [[/^Курьер/.test(how) ? 'Время' : /^Постамат/.test(how) ? 'Постамат' : 'Пункт выдачи', place] as KVRow] : [])];
}

const dec = (v: string) => { const t = v.replace(/\s/g, '').replace(',', '.'); return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : 0; };

/**
 * adm10 · adm11 · adm29 · adm30 · adm34 — заказ: оплаты, этапы, посылки и трек CDEK по каждой; разбиение на посылки
 * и счёт за доставку каждой после взвешивания; отмена продавцом. Смена этапа уходит покупателю.
 */
export function AdminOrderScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const can = useCan();
  const sheet = useSheet();
  const { busy, run } = useAction();
  const o = useAdmin((s) => s.orders.find((x) => x.num === num));
  const buyer = useAdmin((s) => s.buyers.find((b) => b.id === o?.buyerId));
  const [tracks, setTracks] = useState<Record<number, string>>({});
  const L = useLoad(() => adminLoad.order(num), [num], { live: true });
  if (!L.ready) return <AdminLoading title="Заказ" error={L.error} retry={L.reload} />;
  if (!o) return <AdminScreen title="Заказ"><AEmpty icon="box" title="Заказ не найден" text="Проверьте номер заказа." /></AdminScreen>;

  const labels = stagesOf(o);
  // Счёт за доставку (adm29): у заказа из-за границы, когда вещи на складе в Китае. Посылок ещё нет — будет посылка 1.
  const billable = can('pay') && o.kind === 'link' && !o.closed && o.stage >= 3;
  const toBill: { n: number | null; p?: AdmParcel }[] = !billable ? [] : o.parcels.length
    ? o.parcels.map((p, i) => ({ n: p.n ?? i + 1, p })).filter(({ p }) => !p.billed)
    : [{ n: null }];
  const billedNow = billable ? o.parcels.map((p, i) => ({ n: p.n ?? i + 1, p })).filter(({ p }) => p.billed && p.weight && !p.track) : [];
  const billSheet = (n: number | null, p?: AdmParcel) => sheet.open({
    title: 'Счёт за доставку', text: `Заказ ${o.num} · посылка ${n ?? 1}${p?.title.includes(' · ') ? ' · ' + p.title.split(' · ').slice(1).join(' · ') : ''}. Посылка взвешена на складе в Китае.`,
    body: <ShipBill num={o.num} n={n} />, btns: [],
  });
  // Разбиение на посылки (adm34): на складе в Китае, пока есть хотя бы две вещи вне посылок со счётом или треком.
  const lockedIds = new Set(o.parcels.filter((p) => p.billed || p.track).flatMap((p) => p.items ?? []));
  const splittable = can('orders') && o.kind === 'link' && !o.closed && o.stage === 3 && (o.items ?? []).filter((i) => !lockedIds.has(i.id)).length >= 2;
  const tracked = o.parcels.map((p, i) => ({ p, i })).filter(({ p }) => p.track);
  // Трек — когда посылка уехала со склада в Китае; до этого посылка видна строкой.
  const trackable = o.kind === 'stock' || o.stage >= 4;
  const waiting = o.parcels.map((p, i) => ({ p, i })).filter(({ p }) => !p.track);
  const sub = `${buyer?.name} · ${o.kind === 'link' ? 'по ссылке' : 'из наличия'}${o.parcels.length > 1 ? ` · ${o.parcels.length} ${plural(o.parcels.length, 'посылка', 'посылки', 'посылок')}` : ''}`;

  return (
    <AdminScreen title={'Заказ ' + o.num} sub={sub}
      bar={o.cancel ? [{ label: 'К заказам', kind: 'ghost', on: () => nav.root('/admin/orders') }]
        : o.stage < 0
        ? (can('req') ? [{ label: 'Открыть заявку', on: () => nav.go('/admin/req/' + o.num) }] : [])
        : [{ label: 'Сменить статус', dis: busy, on: () => sheet.open({ title: 'Сменить статус', text: `Заказ ${o.num} · сейчас «${labels[o.stage]}»`, body: <StatusForm o={o} />, btns: [] }) }]}>
      <KV title="Оплаты" rows={o.pays.map((r) => [r.label, r.value] as [string, string])} />
      {o.ship && <KV title="Получатель и доставка" copy copyAll rows={shipRows(o)} />}
      {o.stage < 0 ? (
        <ANote tone="wait" title="Заявка на проверке" text="Этапы появятся после одобрения заявки и оплаты товаров." />
      ) : (
        <>
          <AH title="Этапы" sub="Покупатель получает уведомление при каждой смене" />
          <StepsV labels={labels} cur={o.stage} dates={o.stageDates} />
        </>
      )}
      {o.parcels.length > 0 && <AH title="Посылки" />}
      {tracked.length > 0 && <Rows items={tracked.map(({ p }) => ({ icon: 'truck', title: p.title, sub: `${p.state} · трек ${p.track}`, pill: p.state === 'Выдано покупателю' ? 'Выдана' : 'В пути', tone: p.state === 'Выдано покупателю' ? 'live' : 'info', chev: false, copy: p.track }))} />}
      {waiting.map(({ p, i }) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {can('track') && trackable ? (
            <>
              <Field label={`Трек CDEK · ${p.title.split(' · ')[0].toLowerCase()}`} value={tracks[i] ?? ''} mode="numeric" ph="10 цифр" onChange={(v) => setTracks({ ...tracks, [i]: v })} />
              <BtnRow items={[{ label: 'Сохранить трек и уведомить', kind: 'info', dis: busy || (tracks[i] ?? '').replace(/\D/g, '').length < 10, on: () => run(() => adminApi.saveTrack(o.num, i, (tracks[i] ?? '').replace(/\D/g, '')), 'Трек отправлен покупателю') }]} />
            </>
          ) : <Rows items={[{ icon: trackable ? 'truck' : 'box', title: p.title, sub: p.state + (p.items?.length ? ` · ${p.items.length} ${plural(p.items.length, 'вещь', 'вещи', 'вещей')}` : '') + (trackable ? ' · трека пока нет' : ''), chev: false }]} />}
        </div>
      ))}
      {billedNow.map(({ n, p }) => <ANote key={'b' + n} tone="ok" title={`Счёт за доставку посылки ${n} выставлен`} text={`${o.pays.find((r) => r.label === 'Доставка посылки ' + n)?.value.replace(/^[^·]*· /, '') ?? ''} · ${p.weight} кг. Покупатель получил уведомление.`} />)}
      {toBill.length > 0 && <BtnRow items={toBill.map(({ n, p }) => ({ label: `Выставить счёт за доставку · посылка ${n ?? 1}`, kind: 'warn' as const, dis: busy, on: () => billSheet(n, p) }))} />}
      {splittable && <BtnRow items={[{ label: o.parcels.length > 1 ? `Посылки: ${o.parcels.length} · изменить` : 'Разбить на посылки', kind: 'info', dis: busy, on: () => nav.go(`/admin/order/${o.num}/split`) }]} />}
      {o.cancel && <ANote tone="err" title="Заказ отменён продавцом" text={SELLER_CANCEL[o.cancel.why] + (o.cancel.note ? '. ' + o.cancel.note : '') + '. Покупатель получил уведомление.'} />}
      {o.refundDue ? (o.refunded
        ? <ANote tone="ok" title="Оплата возвращена" text={rub(o.refundDue) + '. Покупатель получил уведомление.'} />
        : <>
          <ANote tone="wait" title={'Вернуть оплату ' + rub(o.refundDue)} text="По заказу были оплаты. Переведите деньги покупателю и отметьте возврат — покупатель получит уведомление." />
          {can('pay') && <BtnRow items={[{ label: 'Деньги возвращены', kind: 'warn', dis: busy, on: () => run(() => adminApi.markRefunded(o.num), 'Покупатель уведомлён') }]} />}
        </>) : null}
      {can('buyers') && buyer && (
        <>
          <AH title="Покупатель" />
          <Rows items={[{ ava: { photo: buyer.photo }, title: buyer.name, sub: [buyer.handle, buyer.phone].filter((x) => x && x !== '—').join(' · '), on: () => nav.go('/admin/buyer/' + buyer.id) }]} />
        </>
      )}
      {!o.closed && o.stage >= 0 && can('orders') && (
        <BtnRow items={[{ label: 'Отменить заказ', kind: 'danger', dis: busy, on: () => sheet.open({ title: 'Отменить заказ ' + o.num, text: 'Покупатель получит уведомление с причиной. Оплаченные суммы нужно вернуть: после отмены появится задача на возврат.', body: <CancelForm num={o.num} />, btns: [] }) }]} />
      )}
    </AdminScreen>
  );
}

/**
 * adm34 — разбить на посылки: вещь переносится выбором посылки, до 4 посылок и не больше, чем вещей; пустую сохранить
 * нельзя. Посылка со счётом или треком заблокирована: её вещи остаются в ней, другие вещи в неё не переносятся.
 * После сохранения каждая посылка получает свой счёт за доставку (adm29) и свой трек.
 */
export function AdminSplitScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const toast = useToast();
  const { busy, run } = useAction();
  const o = useAdmin((s) => s.orders.find((x) => x.num === num));
  const L = useLoad(() => adminLoad.order(num), [num], { live: true });
  const [draft, setDraft] = useState<{ P: number; at: Record<string, number> } | null>(null);
  const title = 'Разбить на посылки';
  if (!L.ready) return <AdminLoading title={title} error={L.error} retry={L.reload} />;
  const items = o?.items ?? [];
  if (!o || o.kind !== 'link' || o.closed || o.stage !== 3 || items.length < 2) {
    return (
      <AdminScreen title={title} bar={[{ label: 'К заказу', kind: 'ghost', on: () => nav.back() }]}>
        <AEmpty icon="box" title="Сейчас разбить нельзя" text="Состав посылок меняют на этапе «На складе в Китае», когда в заказе больше одной вещи." />
      </AdminScreen>
    );
  }
  const locked = new Map(o.parcels.filter((p) => p.billed || p.track).map((p) => [p.n ?? 1, p.track ? 'трек' : 'счёт за доставку'] as const));
  const d = draft ?? {
    P: Math.max(1, o.parcels.length),
    at: Object.fromEntries(items.map((i) => [i.id, o.parcels.find((p) => p.items?.includes(i.id))?.n ?? 1])),
  };
  const ks = Array.from({ length: d.P }, (_, k) => k + 1);
  const cnt = (k: number) => items.filter((i) => d.at[i.id] === k).length;
  const empty = ks.filter((k) => !cnt(k));
  const moveTo = ks.filter((k) => k < d.P && !locked.has(k)).pop();
  const btns = [
    ...(d.P < Math.min(MAX_PARCELS, items.length) ? [{ label: 'Добавить посылку', kind: 'limeSoft' as const, on: () => setDraft({ ...d, P: d.P + 1 }) }] : []),
    ...(d.P > 1 && !locked.has(d.P) && moveTo ? [{ label: 'Удалить посылку ' + d.P, kind: 'danger' as const, on: () => setDraft({ P: d.P - 1, at: Object.fromEntries(Object.entries(d.at).map(([id, k]) => [id, k === d.P ? moveTo : k])) }) }] : []),
  ];
  const save = () => run(() => adminApi.splitParcels(o.num, ks.map((k) => items.filter((i) => d.at[i.id] === k).map((i) => i.id))), () => { nav.back(); toast('Покупатель увидит посылки в заказе'); });
  return (
    <AdminScreen title={title} sub={`Заказ ${o.num} · на складе в Китае`}
      bar={[{ label: empty.length ? 'Заполните все посылки' : `Сохранить · ${d.P} ${plural(d.P, 'посылка', 'посылки', 'посылок')}`, dis: busy || empty.length > 0, on: save }]}>
      <ANote tone="n" text="Распределите вещи по посылкам. Каждая посылка получит свой счёт за доставку и свой трек CDEK. После счёта или трека состав посылки менять нельзя." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => {
          const own = d.at[it.id];
          const fixed = locked.get(own);
          return (
            <div key={it.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div role="img" aria-label={it.name} style={{ width: 44, height: 44, flex: 'none', borderRadius: 12, backgroundColor: 'var(--lb-n-150)', backgroundImage: it.img ? `url(${sized(it.img, 240)})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{it.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--lb-ink-2)' }}>{fixed ? `${it.meta} · в посылке ${own}: ${fixed}` : it.meta}</span>
                </div>
              </div>
              <div role="radiogroup" aria-label={'Посылка для: ' + it.name} style={{ display: 'grid', gridTemplateColumns: `repeat(${d.P}, 1fr)`, gap: 4, padding: 4, borderRadius: 14, background: 'var(--lb-n-150)' }}>
                {ks.map((k) => {
                  const on = own === k;
                  const dis = !on && (!!fixed || locked.has(k));
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on} aria-disabled={dis || undefined} onClick={dis || on ? undefined : () => setDraft({ ...d, at: { ...d.at, [it.id]: k } })} className={dis ? undefined : 'pressable-sm'}
                      style={{ height: 40, minWidth: 0, padding: '0 2px', border: 0, borderRadius: 11, cursor: dis ? 'default' : 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: on ? 'var(--lime)' : 'transparent', color: dis ? 'var(--lb-mute)' : 'var(--lb-ink)', boxShadow: on ? '0 1px 3px var(--lb-ink-a14)' : 'none', transition: 'background 160ms ease' }}>Посылка {k}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <KV title="Итог" rows={ks.map((k) => [`Посылка ${k}${locked.has(k) ? ' · ' + locked.get(k) : ''}`, cnt(k) ? `${cnt(k)} ${plural(cnt(k), 'вещь', 'вещи', 'вещей')}` : 'Пусто', cnt(k) ? 'b' : 'err'] as [string, string, 'b' | 'err'])} />
      {empty.length > 0 && <ANote tone="err" title="Пустая посылка" text="В каждой посылке должна быть хотя бы одна вещь. Перенесите вещь или удалите посылку." />}
      {btns.length > 0 && <BtnRow cols={btns.length === 2 ? 2 : 1} items={btns} />}
    </AdminScreen>
  );
}

/** adm29 — вес и сумма доставки посылки. */
function ShipBill({ num, n }: { num: string; n: number | null }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const [w, setW] = useState('');
  const [amt, setAmt] = useState('');
  const sum = parseInt(amt, 10) || 0;
  const ok = dec(w) > 0 && sum > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <Field label="Вес посылки" value={w} mode="decimal" ph="0,0" suffix="кг" onChange={setW} />
      <Field label="Сумма к оплате" value={amt} mode="numeric" ph="0" suffix="₽" onChange={(v) => setAmt(v.replace(/\D/g, ''))} />
      <Btn kind="primary" dis={!ok || busy} onClick={() => run(() => adminApi.billParcel(num, n, dec(w), sum), () => { sheet.close(); toast('Счёт отправлен покупателю'); })}>{ok ? 'Выставить ' + rub(sum) : 'Укажите вес и сумму'}</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

/** adm30 — причина отмены уходит покупателю. «Другая причина» — только с комментарием. */
function CancelForm({ num }: { num: string }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const [why, setWhy] = useState(0);
  const [note, setNote] = useState('');
  const other = why === SELLER_CANCEL.length - 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Причина отмены" items={SELLER_CANCEL.map((t, i) => ({ label: t, on_: why === i, act: () => setWhy(i) }))} />
      <Field label="Комментарий для покупателя" value={note} onChange={setNote} ph={other ? 'Обязательно для «Другой причины»' : 'Необязательно'} />
      <Btn kind="danger" dis={busy || (other && !note.trim())} onClick={() => run(() => adminApi.cancelOrder(num, why, note.trim()), () => { sheet.close(); toast('Заказ отменён'); })}>Отменить заказ</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Не отменять</Btn>
    </div>
  );
}

function StatusForm({ o }: { o: AdmOrder }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const labels = stagesOf(o);
  const [pick, setPick] = useState(Math.min(o.stage + 1, labels.length - 1));
  const [notify, setNotify] = useState(true);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Этап" items={labels.map((t, i) => ({ label: t, sub: i < o.stage ? 'Пройден' : i === o.stage ? 'Текущий' : undefined, on_: pick === i, act: () => setPick(i) }))} />
      <button type="button" role="switch" aria-checked={notify} onClick={() => setNotify(!notify)} className="pressable"
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '10px 14px', border: 0, borderRadius: 14, background: 'var(--lb-n-50)', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)', font: 'inherit' }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Уведомить покупателя</span>
          <span style={{ fontSize: 11.5, color: 'var(--lb-ink-2)' }}>Сообщение от бота и событие в профиле</span>
        </span>
        <Knob on={notify} />
      </button>
      <Btn kind="primary" dis={busy || pick === o.stage} onClick={() => run(() => adminApi.setStage(o.num, pick, notify), () => { sheet.close(); toast(notify ? 'Статус изменён, покупатель уведомлён' : 'Статус изменён'); })}>Сохранить</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

/** adm12 — фотоотчёт со склада: минимум одно фото на вещь, иначе отправка недоступна. Нажатие на фото убирает его. */
export function AdminPhotoScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const { busy, run } = useAction();
  const r = useAdmin((s) => s.photos.find((x) => x.orderNum === num));
  const buyer = useAdmin((s) => s.buyers.find((b) => b.id === r?.buyerId));
  const [note, setNote] = useState('');
  const L = useLoad(() => adminLoad.photo(num), [num], { live: true });
  if (!L.ready) return <AdminLoading title="Фотоотчёт" error={L.error} retry={L.reload} />;
  if (!r) return <AdminScreen title="Фотоотчёт"><AEmpty icon="camera" title="Фотоотчёт не нужен" text="По этому заказу нет вещей на складе." /></AdminScreen>;
  const ready = r.items.every((it) => it.pics.length > 0);
  return (
    <AdminScreen title={'Фотоотчёт · заказ ' + r.orderNum} sub={`${buyer?.name} · ${r.place}`}
      bar={r.sent ? [{ label: 'К задачам', kind: 'ghost', on: () => nav.root('/admin') }]
        : [{ label: ready ? 'Отправить фотоотчёт' : 'Добавьте фото каждой вещи', dis: !ready || busy, on: () => run(() => adminApi.sendPhotoReport(r.orderNum, note.trim()), 'Фотоотчёт отправлен') }]}>
      {r.sent ? <ANote tone="ok" title="Фотоотчёт отправлен" text="Покупатель получил уведомление и видит фото в заказе." />
        : <ANote tone="n" text="Снимите каждую вещь целиком, бирку и детали. Минимум одно фото на вещь." />}
      {r.items.map((it, k) => {
        const n = it.pics.length;
        return (
          <PhotoGrid key={k} title={it.name} sub={it.meta} cnt={`${n} из 3`} cntTone={n ? 'live' : 'err'}
            items={[0, 1, 2].map((i) => (it.pics[i] ? { img: it.pics[i], aria: 'Убрать фото', on: r.sent ? undefined : () => run(() => adminApi.savePhotoPics(r.orderNum, k, it.pics.filter((_, j) => j !== i))) } : { cap: 'Фото' }))}
            onPick={r.sent ? undefined : (files) => run(async () => {
              const urls = (await Promise.all(files.slice(0, 3 - it.pics.length).map((f) => adminUploads.reportPhoto(r.orderNum, f)))).filter((x): x is string => !!x);
              await adminApi.savePhotoPics(r.orderNum, k, it.pics.concat(urls).slice(0, 3));
            })} />
        );
      })}
      {r.sent ? (r.note && <KV rows={[['Комментарий', r.note]]} />)
        : <Field label="Комментарий для покупателя" value={note} onChange={setNote} ph="Например: бирки на месте, коробка без вмятин" multi />}
    </AdminScreen>
  );
}

/** adm13 · adm28 — обращение покупателя: переписка, быстрые ответы, решение, закрытие. */
export function AdminClaimScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const { busy, run } = useAction();
  const sheet = useSheet();
  const c = useAdmin((s) => s.claims.find((x) => x.orderNum === num));
  const buyer = useAdmin((s) => s.buyers.find((b) => b.id === c?.buyerId));
  const [reply, setReply] = useState('');
  const L = useLoad(() => adminLoad.claim(num), [num], { live: true });
  if (!L.ready) return <AdminLoading title="Обращение" error={L.error} retry={L.reload} />;
  if (!c) return <AdminScreen title="Обращение"><AEmpty icon="msg" title="Обращение не найдено" text="Возможно, его уже закрыли." /></AdminScreen>;
  const first = buyer?.name.split(' ')[0] ?? 'Покупатель';
  const R = c.refund;
  return (
    <AdminScreen title={'Обращение · заказ ' + c.orderNum} sub={`${buyer?.name} · ${c.opened}`}
      bar={c.closed ? [{ label: 'К задачам', kind: 'ghost', on: () => nav.root('/admin') }]
        : [{ label: 'Отправить ответ', dis: busy || !reply.trim(), on: () => run(() => adminApi.replyClaim(c.orderNum, reply.trim()), () => setReply('')) },
          { label: 'Закрыть обращение', kind: 'ghost', dis: busy, on: () => run(() => adminApi.closeClaim(c.orderNum), 'Обращение закрыто') }]}>
      {c.closed && <ANote tone="ok" title="Обращение закрыто" text="Покупатель может открыть новое из заказа." />}
      <KV copy copyAs={{ 3: '' }} rows={[['Заказ', c.orderNum], ['Вещи', c.what], ['Трек CDEK', c.track], ['Этап', c.stage]]} />
      <AH title="Переписка" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {c.msgs.map((m, i) => {
          const me = m.from === 'admin';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: me ? 'var(--lb-ink-2)' : 'var(--lb-white)', color: me ? 'var(--lb-white)' : 'var(--lb-ink)', boxShadow: me ? 'none' : 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty' }}>{m.text}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: me ? 'var(--lb-white-a72)' : 'var(--lb-ink-2)' }}>{(me ? 'Вы · ' : first + ' · ') + m.time}</div>
              </div>
            </div>
          );
        })}
      </div>
      {!c.closed && (
        <>
          <AH title="Быстрые ответы" />
          <AChips label="Быстрые ответы" items={QUICK_REPLIES.map((t) => ({ label: t.length > 30 ? t.slice(0, 28) + '…' : t, on_: reply === t, act: () => setReply(t) }))} />
          <Field label="Ответ" value={reply} onChange={setReply} ph="Напишите покупателю" multi />
          {c.answer && <ANote tone={c.answer === 'ok' ? 'ok' : 'wait'} title={c.answer === 'ok' ? 'Решение: возврат ' + rub(c.refundSum ?? 0) : c.answer === 'more' ? 'Запрошены фото' : 'Решение: отказ'} text={(c.answerText ? c.answerText + '. ' : '') + 'Покупатель получил уведомление.'} />}
          {R ? (
            <KV title="Реквизиты для возврата" copy copyAs={{ 0: '', 1: R.to === 'card' ? R.val.replace(/\s/g, '') : R.val, 3: String(c.refundSum ?? 0) }} rows={[['Куда', R.to === 'card' ? 'На карту' : 'По номеру телефона'], [R.to === 'card' ? 'Номер карты' : 'Телефон', R.val, 'b'], ['Банк', R.bank], ['Сумма', rub(c.refundSum ?? 0), 'total']]} />
          ) : (
            <BtnRow items={[{ label: 'Принять решение', kind: 'warn', dis: busy, on: () => sheet.open({ title: 'Решение по обращению', text: `Заказ ${c.orderNum} · ${c.what} · оплачено ${rub(c.paid)}`, body: <ClaimDecide c={c} />, btns: [] }) }]} />
          )}
        </>
      )}
    </AdminScreen>
  );
}

/** adm28 — вернуть деньги (не больше оплаченного; вещи из-за границы не возвращаются), запросить фото или отказать с причиной. */
function ClaimDecide({ c }: { c: AdmClaim }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const refundOk = c.kind === 'stock' && c.paid > 0;
  const [dec, setDec] = useState<'ok' | 'more' | 'no'>(c.answer && (c.answer !== 'ok' || refundOk) ? c.answer : refundOk ? 'ok' : 'more');
  const [amt, setAmt] = useState(String(c.refundSum ?? c.paid));
  const [note, setNote] = useState('');
  const sum = parseInt(amt, 10) || 0;
  const over = sum > c.paid;
  const dis = (dec === 'ok' && (!sum || over)) || (dec === 'no' && !note.trim());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Решение по обращению" items={CLAIM_DECISIONS.map(([k, label, sub]) => ({ label, sub: k === 'ok' && !refundOk ? 'Вещи из-за границы не возвращаются' : sub, dis: k === 'ok' && !refundOk, on_: dec === k, act: () => setDec(k) }))} />
      {dec === 'ok' && <Field label="Сумма возврата" value={amt} mode="numeric" suffix="₽" onChange={(v) => setAmt(v.replace(/\D/g, ''))} />}
      <Field label={dec === 'no' ? 'Причина отказа' : 'Комментарий для покупателя'} value={note} onChange={setNote} ph={dec === 'no' ? 'Обязательно' : 'Необязательно'} />
      <Btn kind={dec === 'no' ? 'danger' : 'primary'} dis={busy || dis} onClick={() => run(() => adminApi.decideClaim(c.orderNum, dec, note.trim(), dec === 'ok' ? sum : undefined), () => { sheet.close(); toast('Покупатель уведомлён'); })}>
        {dec === 'ok' ? (over ? 'Больше суммы заказа' : 'Вернуть ' + (sum ? rub(sum) : '')) : dec === 'more' ? 'Запросить фото' : 'Отказать'}
      </Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

