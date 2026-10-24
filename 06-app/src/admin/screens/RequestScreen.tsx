import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { rateFor } from '../../domain/linkOrder';
import { plural, rub, yuan } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { openExternal } from '../../telegram/tma';
import { Btn } from '../../ui/Btn';
import { useSheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import type { AdmRequest } from '../../mocks/admin';
import { adminApi, adminLoad, rates, requestCalc, useAdmin } from '../api';
import { useAction, useLoad } from '../hooks';
import { REQ_REJECT } from '../model';
import { AdminLoading, AEmpty, ANote, AH, AdminScreen, Field, KV, RadioList, Rows } from '../ui';
import { sized } from '../../lib/img';

const rateText = (n: number) => n.toFixed(2).replace('.', ',') + ' ₽ за ¥';

/** adm06 · adm07 · adm08 — заявка по ссылке: позиции, расчёт по текущим настройкам, три решения. */
export function AdminRequestScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const sheet = useSheet();
  const { busy, run } = useAction();
  const r = useAdmin((s) => s.requests.find((x) => x.num === num));
  const buyer = useAdmin((s) => s.buyers.find((b) => b.id === r?.buyerId));
  const L = useLoad(() => adminLoad.request(num), [num], { live: true });
  if (!L.ready) return <AdminLoading title="Заявка" error={L.error} retry={L.reload} />;
  if (!r) return <AdminScreen title="Заявка"><AEmpty icon="link" title="Заявка не найдена" text="Возможно, покупатель её отменил." /></AdminScreen>;

  // С сервера — курс и суммы, зафиксированные в заявке; на моках — текущие настройки.
  const R = r.rates ?? rates();
  const c = r.calc ?? requestCalc(r, R);
  const cny = r.items.reduce((s, it) => s + it.price * it.qty, 0);
  const rateList = [...new Set(r.items.map((it) => rateFor(R, it.price).toFixed(2)))].map(Number);
  const plats = new Set(r.items.map((i) => i.plat)).size;

  return (
    <AdminScreen title={`Заявка «${r.title}»`} sub={`${buyer?.name} · ${buyer?.handle} · ${r.ago}`} barCols={2}
      bar={r.state === 'review'
        ? [{ label: 'Одобрить и выставить счёт', full: true, dis: busy, on: () => run(() => adminApi.approveRequest(r.num), 'Счёт отправлен покупателю') },
          { label: 'Изменить цену', kind: 'warn', dis: busy, on: () => sheet.open({ title: 'Изменить цену', text: 'Покупатель увидит новую цену и причину. Пока он не согласится, оплата недоступна.', body: <PriceForm r={r} />, btns: [] }) },
          { label: 'Отказать', kind: 'danger', dis: busy, on: () => sheet.open({ title: 'Отказать по заявке', text: 'Покупатель увидит причину в заявке.', body: <RejectForm num={r.num} />, btns: [] }) }]
        : [{ label: 'К задачам', kind: 'ghost', full: true, on: () => nav.root('/admin') }]}>
      {r.state === 'ok' && <ANote tone="ok" title="Заявка одобрена" text="Покупатель получил расчёт и счёт на оплату товаров." />}
      {r.state === 'changed' && <ANote tone="wait" title="Ждём согласия покупателя" text={`Новая цена отправлена${r.comment ? ': ' + r.comment : ''}. До согласия оплата недоступна.`} />}
      {r.state === 'rejected' && <ANote tone="err" title="Заявка отклонена" text={REQ_REJECT[r.rejectWhy ?? 0] + (r.rejectNote ? '. ' + r.rejectNote : '')} />}
      <AH title="Позиции" sub={`${r.items.length} ${plural(r.items.length, 'позиция', 'позиции', 'позиций')} · ${plats} ${plural(plats, 'площадка', 'площадки', 'площадок')}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 18, overflow: 'hidden', background: 'var(--lb-ink-a08)', border: '1px solid var(--lb-ink-a08)' }}>
        {r.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--lb-white)' }}>
            <div role="img" aria-label={it.name} style={{ width: 48, height: 48, flex: 'none', borderRadius: 12, backgroundColor: 'var(--lb-n-150)', backgroundImage: it.img ? `url(${sized(it.img, 240)})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, background: 'var(--lb-n-150)', fontSize: 11, fontWeight: 700 }}>{it.plat}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{it.name}</span>
              <span style={{ fontSize: 12, color: 'var(--lb-ink-2)' }}>{`${/^\d/.test(it.size) || it.size.length <= 3 ? 'Размер ' + it.size : it.size} · ${it.qty} шт${[it.photo && 'фотоотчёт', it.box && 'коробка'].filter(Boolean).length ? ' · ' + [it.photo && 'фотоотчёт', it.box && 'коробка'].filter(Boolean).join(', ') : ''}`}</span>
            </div>
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{yuan(it.price)}</span>
              {r.old && r.old[i] !== it.price && <span style={{ fontSize: 11.5, color: 'var(--lb-ink-2)', textDecoration: 'line-through', whiteSpace: 'nowrap' }}>{yuan(r.old[i])}</span>}
            </div>
          </div>
        ))}
      </div>
      <KV title="Расчёт" rows={[
        ['Расчётный курс', rateList.map((x) => x.toFixed(2).replace('.', ',')).join(' / ') + ' ₽ за ¥'],
        [`Товары · ${yuan(cny)}`, rub(c.goods)],
        ['Комиссия за штуку', rub(c.comm)],
        ['Фотоотчёт и коробка', rub(c.serv)],
        ...(r.protect ? [[`Защита ${R.protectPct}%`, rub(c.prot)] as [string, string]] : []),
        ['Итого покупателю', rub(c.total), 'total'],
      ]} />
      {rateList.length > 1 && <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lb-ink-2)', padding: '0 2px' }}>Надбавка к курсу зависит от цены одной вещи: {r.items.map((it) => `${it.name} — ${rateText(rateFor(R, it.price))}`).join(', ')}.</div>}
      <AH title="Ссылки" sub="Проверьте цену и наличие на площадке" />
      <Rows items={r.items.map((it) => ({ icon: 'link', title: `${it.plat} · ${it.name}`, sub: it.url, copy: it.url, on: () => openExternal(/^https?:/.test(it.url) ? it.url : 'https://' + it.url) }))} />
    </AdminScreen>
  );
}

function PriceForm({ r }: { r: AdmRequest }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const [prices, setPrices] = useState(r.items.map((it) => String(it.price)));
  const [why, setWhy] = useState('');
  const nums = prices.map((p) => parseInt(p.replace(/\D/g, ''), 10) || 0);
  const changed = nums.some((n, i) => n !== r.items[i].price);
  const ok = changed && why.trim() && nums.every((n) => n > 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      {r.items.map((it, i) => <Field key={i} label={it.name} value={prices[i]} mode="numeric" suffix="¥" onChange={(v) => setPrices(prices.map((x, k) => (k === i ? v.replace(/\D/g, '') : x)))} />)}
      <Field label="Причина" value={why} onChange={setWhy} ph="Например: цена на площадке выросла" />
      <Btn kind="primary" dis={busy || !ok} onClick={() => run(() => adminApi.changeRequestPrices(r.num, nums, why.trim()), () => { sheet.close(); toast('Отправлено покупателю'); })}>{changed ? 'Отправить на согласование' : 'Измените цену позиции'}</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

function RejectForm({ num }: { num: string }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const [why, setWhy] = useState(0);
  const [note, setNote] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Причина отказа" items={REQ_REJECT.map((t, i) => ({ label: t, on_: why === i, act: () => setWhy(i) }))} />
      <Field label="Комментарий" value={note} onChange={setNote} ph={why === 3 ? 'Обязательно для «Другой причины»' : 'Необязательно'} />
      <Btn kind="danger" dis={busy || (why === 3 && !note.trim())} onClick={() => run(() => adminApi.rejectRequest(num, why, note.trim()), () => { sheet.close(); toast('Покупатель уведомлён'); })}>Отказать</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

