import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { rub } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { Btn } from '../../ui/Btn';
import { useSheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { adminApi, adminLoad, requisites, useAdmin } from '../api';
import { previewOf, useAction, useLoad } from '../hooks';
import { PAY_FAIL } from '../model';
import { AdminLoading, AEmpty, ANote, AdminScreen, Field, KV, PhotoGrid, RadioList } from '../ui';

/** adm04 · adm05 — проверка оплаты переводом: сверить с банком, подтвердить или «деньги не пришли». */
export function AdminPayScreen() {
  const { id = '' } = useParams();
  const nav = useNav();
  const sheet = useSheet();
  const { busy, run } = useAction();
  const p = useAdmin((s) => s.payments.find((x) => x.id === id));
  const buyer = useAdmin((s) => s.buyers.find((b) => b.id === p?.buyerId));
  const L = useLoad(() => adminLoad.payment(id), [id], { live: true });
  if (!L.ready) return <AdminLoading title="Оплата" error={L.error} retry={L.reload} />;
  if (!p) return <AdminScreen title="Оплата"><AEmpty icon="card" title="Оплата не найдена" text="Возможно, её уже проверил другой сотрудник." /></AdminScreen>;

  const R = requisites();
  const title = (p.kind === 'goods' ? 'Оплата товаров · ' : 'Оплата доставки · ') + p.orderLabel.replace(', ', ' · ');
  const openReceipt = () => sheet.open({ title: 'Чек от покупателя', body: <img src={p.receipt} alt="Чек от покупателя" style={{ display: 'block', width: '100%', marginTop: 12, borderRadius: 14 }} />, btns: [{ label: 'Закрыть', kind: 'ghost' }] });

  return (
    <AdminScreen title={title} sub={p.when}
      bar={p.state === 'review'
        ? [{ label: 'Подтвердить оплату', dis: busy, on: () => run(() => adminApi.confirmPayment(p.id), 'Оплата подтверждена') }, { label: 'Деньги не пришли', kind: 'danger', dis: busy, on: () => sheet.open({ title: 'Деньги не пришли', text: 'Покупатель увидит причину и сможет перевести заново.', body: <PayFail id={p.id} />, btns: [] }) }]
        : [{ label: 'К задачам', kind: 'ghost', on: () => nav.root('/admin') }]}>
      {p.state === 'ok' && <ANote tone="ok" title="Оплата подтверждена" text="Покупатель получил уведомление. Заказ перешёл к следующему этапу." />}
      {p.state === 'fail' && <ANote tone="err" title="Отмечено: деньги не пришли" text={PAY_FAIL[p.failWhy ?? 0] + (p.failNote ? '. ' + p.failNote : '') + '. Покупатель видит «Оплата не подтверждена» и может перевести заново.'} />}
      <KV copy copyAs={{ 5: R.number.replace(/\s/g, ''), 6: '', 7: String(p.amount) }} rows={[
        ['Покупатель', buyer?.name ?? ''], ['Telegram', buyer?.handle ?? '—'], ['Назначение', p.purpose],
        ['Банк', R.bank], ['Получатель перевода', R.recipient], ['Номер для перевода', R.number],
        ['Время перевода', p.when], ['К оплате', rub(p.amount), 'total'],
      ]} />
      {p.receipt
        ? <PhotoGrid title="Чек от покупателя" cnt="Приложен" cntTone="live" cols={1} ratio="4 / 3" items={[{ img: p.receipt, aria: 'Открыть чек', on: openReceipt }]} />
        : <ANote tone="n" title="Чек не приложен" text="Сверьте поступление по сумме, времени и назначению перевода." />}
      {p.state === 'ok' && (
        <PhotoGrid title="Чек для покупателя" sub="Фото или PDF. Покупатель увидит его в «Платежах и чеках»." accept="image/*,application/pdf"
          items={[p.sellerReceipt ? { img: p.sellerReceipt.preview ?? p.receipt, aria: 'Убрать чек', on: () => run(() => adminApi.attachSellerReceipt(p.id, null), 'Чек убран') } : { cap: 'Загрузить', aria: 'Загрузить чек' }]}
          onPick={(f) => run(() => adminApi.attachSellerReceipt(p.id, { name: f[0].name, preview: previewOf(f[0]), file: f[0] }), 'Чек загружен')} />
      )}
    </AdminScreen>
  );
}

function PayFail({ id }: { id: string }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const [why, setWhy] = useState(0);
  const [note, setNote] = useState('');
  const needNote = why === 3 && !note.trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Причина" items={PAY_FAIL.map((t, i) => ({ label: t, on_: why === i, act: () => setWhy(i) }))} />
      <Field label="Комментарий для покупателя" value={note} onChange={setNote} ph={why === 3 ? 'Обязательно для «Другой причины»' : 'Необязательно'} />
      <Btn kind="danger" dis={busy || needNote} onClick={() => run(() => adminApi.failPayment(id, why, note.trim()), () => { sheet.close(); toast('Покупатель уведомлён'); })}>Отправить покупателю</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}
