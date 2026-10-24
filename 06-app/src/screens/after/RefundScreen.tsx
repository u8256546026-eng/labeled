import { live } from '../../api/client';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { refundApi } from '../../api/afterSale';
import { useOrders } from '../../api/useOrders';
import { REFUND_BANKS, refundNumberComplete, refundReady, type Refund } from '../../domain/claims';
import { rub } from '../../lib/format';
import { IMG } from '../../mocks/images';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { haptic, tmaEnv } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Chips, Empty, H, Note, Skel } from '../../ui/blocks';
import { Input, Sum } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Photos, StatusCard } from '../../ui/orderBlocks';
import { Screen } from '../../ui/Screen';

/** Маска: карта — 0000 0000 0000 0000, телефон — +7 900 000-00-00. */
function mask(to: Refund['to'], v: string): string {
  const d = v.replace(/\D/g, '');
  if (to === 'card') return d.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  const p = (d.startsWith('8') ? '7' + d.slice(1) : d.startsWith('7') ? d : '7' + d).slice(0, 11);
  const r = p.slice(1);
  return '+7' + (r ? ' ' + r.slice(0, 3) : '') + (r.length > 3 ? ' ' + r.slice(3, 6) : '') + (r.length > 6 ? '-' + r.slice(6, 8) : '') + (r.length > 8 ? '-' + r.slice(8, 10) : '');
}

/**
 * Z — возврат денег по одобренному обращению. Только для вещей из наличия.
 * Банк — из списка или вручную через «Другой». «Отправить реквизиты» — когда номер полный и банк выбран.
 */
export function RefundScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const { orders } = useOrders();
  const claim = useApp((s) => s.claims[num]);
  const name = useApp((s) => s.name);
  const [r, setR] = useState<Refund>(() => claim?.refund ?? { to: 'sbp', val: '', bank: '', state: 'form' });
  const [other, setOther] = useState(() => !!r.bank && !REFUND_BANKS.includes(r.bank));
  const [busy, setBusy] = useState(false);
  const o = orders?.find((x) => x.num === num);
  if (!orders) return <Screen header={<Header title="Возврат денег" />}><Skel n={2} /></Screen>;
  if (!o || !claim || claim.answer !== 'ok' || o.kind !== 'stock' || !claim.refundSum) {
    return <Screen header={<Header title="Возврат денег" />}><Empty minH={500} title="Возврат недоступен" text="Вещи из-за границы выкупаются под вас и не возвращаются" btns={[{ label: 'К заказу', kind: 'primary', on: () => nav.go('/order/' + num) }]} /></Screen>;
  }
  const saved = claim.refund;
  const state = saved?.state ?? 'form';
  const sum = claim.refundSum;
  const item = o.items?.[0];
  const set = (p: Partial<Refund>) => setR((x) => ({ ...x, ...p }));
  const cur = state === 'form' ? 1 : state === 'sent' ? 2 : 3;
  const digits = (saved?.val ?? r.val).replace(/\D/g, '');

  let bar;
  if (state === 'form') {
    const label = refundReady(r) ? 'Отправить реквизиты' : !refundNumberComplete(r) ? (r.to === 'card' ? 'Введите номер карты' : 'Введите телефон') : 'Выберите банк';
    bar = { btns: [{ label, kind: 'primary' as const, dis: !refundReady(r) || busy, on: () => { setBusy(true); refundApi.send(claim.id, r).then((x) => { actions.setRefund(num, x); setBusy(false); haptic.success(); }, () => setBusy(false)); } }] };
  }

  return (
    <Screen header={<Header title="Возврат денег" sub={`Заказ ${num} · обращение ${claim.id}`} />} bar={bar}>
      <StatusCard
        title={state === 'form' ? 'Ждём реквизиты' : state === 'sent' ? 'Продавец готовит перевод' : 'Возврат отправлен'}
        note={state === 'form' ? `Возврат одобрен ${claim.sentAt}. Укажите, куда перевести деньги.` : state === 'sent' ? 'Реквизиты получены. Продавец переведёт деньги и приложит чек.' : 'Продавец перевёл деньги и приложил чек.'}
        labels={['Одобрен', 'Реквизиты', 'Перевод', 'Получен']} cur={cur} tone={state === 'done' ? 'live' : 'wait'} />
      <Sum rows={[{ label: item ? `${item.name} · ${item.params}` : o.name, value: rub(sum) }, { label: 'К возврату', value: rub(sum), total: true }]} note="Возвращается стоимость товара." />
      {state === 'form' && (
        <>
          <H text="Куда вернуть" sub={`Получатель — владелец аккаунта, ${name}`} />
          <Chips label="Способ возврата" rows={([['sbp', 'По номеру телефона'], ['card', 'На карту']] as const).map(([k, l]) => ({ label: l, on_: r.to === k, act: () => set({ to: k, val: '' }) }))} />
          <Input label={r.to === 'card' ? 'Номер карты' : 'Телефон для перевода'} value={r.val} mode={r.to === 'card' ? 'numeric' : 'tel'} ph={r.to === 'card' ? '0000 0000 0000 0000' : '+7 900 000-00-00'} onChange={(v) => set({ val: mask(r.to, v) })} />
          <H text="Банк получателя" sub={r.to === 'card' ? 'Банк, выпустивший карту' : 'Куда придёт перевод по СБП'} />
          <Chips label="Банк получателя" rows={REFUND_BANKS.map((b) => ({ label: b, on_: r.bank === b && !other, act: () => { setOther(false); set({ bank: b }); } }))
            .concat([{ label: 'Другой', on_: other, act: () => { setOther(true); set({ bank: '' }); } }])} />
          {other && <Input label="Название банка" value={r.bank} ph="Например: Совкомбанк" onChange={(v) => set({ bank: v })} />}
        </>
      )}
      {state === 'sent' && saved && (
        <>
          <Sum rows={[
            { label: 'Куда', value: saved.to === 'card' ? 'Карта •••• ' + digits.slice(-4) : 'Перевод по телефону · •• ' + digits.slice(-4) },
            { label: 'Банк', value: saved.bank },
            { label: 'Получатель', value: name },
          ]} />
          <Btns items={[
            ...((tmaEnv() === 'mock' && !live()) ? [{ label: 'Показать: продавец перевёл', kind: 'limeSoft' as const, on: () => actions.setRefund(num, { ...saved, state: 'done' }) }] : []),
            { label: 'Изменить реквизиты', kind: 'warn', on: () => { setR({ ...saved, state: 'form' }); actions.setRefund(num, { ...saved, state: 'form' }); } },
          ]} />
        </>
      )}
      {state === 'done' && (
        <>
          {/* Чека за возврат у продавца нет (он только отмечает перевод) — картинку-пример из макета показываем лишь в демо. */}
          <Note tone="ok" title={rub(sum) + ' отправлены'} text="Продавец отметил перевод. Проверьте поступление в банке." />
          {!live() && <Photos title="Чек продавца" text="1 файл" pics={[IMG.receipt]} />}
          <Btns items={[{ label: 'Деньги не пришли', kind: 'dangerSoft', on: () => nav.go('/help') }, { label: 'Платежи и чеки', kind: 'warn', on: () => nav.go('/payments') }]} row />
        </>
      )}
    </Screen>
  );
}
