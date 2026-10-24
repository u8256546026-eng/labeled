import { Landmark } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { paymentsApi } from '../../api/checkout';
import type { Payment } from '../../domain/order';
import { copyText } from '../../lib/clipboard';
import { rub } from '../../lib/format';
import { ani } from '../../lib/motion';
import { REQUISITES } from '../../mocks/orders';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { haptic } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Empty, H, Note } from '../../ui/blocks';
import type { BarSpec } from '../../ui/BottomBar';
import { Upload } from '../../ui/commerce';
import { Photos } from '../../ui/orderBlocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { supportSheet } from '../../ui/support';
import { useToast } from '../../ui/Toast';

const ACCEPT = 'image/*,application/pdf';

/**
 * Общий компонент оплаты переводом (A, C, W): реквизиты с копированием, чек, «Перевёл».
 * Чек и «Перевёл» не делают заказ оплаченным — продавец сверяет поступление вручную.
 */
export function PayScreen() {
  const { id = '' } = useParams();
  const nav = useNav();
  const sheet = useSheet();
  const pay = useApp((s) => s.payments[id]);
  const [uploadErr, setUploadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastFile = useRef<File | null>(null);
  const block = useRef<HTMLDivElement>(null);

  // Статус оплаты: при смене состояния блок проявляется и поднимается на 6 px за 240 мс.
  const prev = useRef(pay?.state);
  useEffect(() => {
    if (pay && prev.current !== pay.state) ani(block.current, [{ opacity: 0.4, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240 });
    prev.current = pay?.state;
  }, [pay?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pay) return <Screen header={<Header title="Оплата переводом" />}><Empty minH={560} title="Платёж не найден" text="Откройте его из заказа или из «Платежей и чеков»." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }]} /></Screen>;

  const upload = (f: File) => {
    lastFile.current = f;
    setUploadErr(false);
    setBusy(true);
    paymentsApi.uploadReceipt(pay.id, f).then(
      (r) => { setBusy(false); actions.updatePayment(pay.id, { state: 'attached', receipt: r }); },
      () => { setBusy(false); haptic.error(); setUploadErr(true); },
    );
  };
  const transferred = () => {
    setBusy(true);
    paymentsApi.markTransferred(pay.id).then(() => {
      setBusy(false);
      actions.updatePayment(pay.id, { state: 'review', receipt: pay.receipt && { ...pay.receipt, meta: 'На проверке с ' + today() } });
      if (pay.fromCheckout) nav.root('/placed/' + pay.orderNum);
    }, () => setBusy(false));
  };
  const toOrder = () => nav.goOrBack('/order/' + pay.orderNum);

  let bar: BarSpec | undefined;
  let body: React.ReactNode;
  if (pay.state === 'empty' || pay.state === 'attached') {
    body = (
      <>
        <Upload accept={ACCEPT} title="Прикрепить чек" text="Скриншот или PDF из банка"
          file={pay.state === 'attached' ? pay.receipt : null}
          err={uploadErr ? 'Файл не загрузился — попробуйте ещё раз или выберите другой' : undefined}
          onPick={upload} onClear={() => actions.updatePayment(pay.id, { state: 'empty', receipt: undefined })}
          onRetry={() => lastFile.current && upload(lastFile.current)} />
        <Note tone="info" text="Чек и кнопка «Перевёл» сами по себе не делают заказ оплаченным: продавец сверяет поступление вручную." />
      </>
    );
    bar = { btns: [{ label: 'Перевёл', kind: 'primary', dis: pay.state !== 'attached' || busy, on: transferred }] };
  } else if (pay.state === 'review') {
    body = (
      <>
        <Note tone="wait" title="Оплата на проверке" text="Чек отправлен, продавец сверяет поступление. Повторно платёж создавать не нужно — при следующем открытии вы увидите текущий статус." />
        {pay.receipt && <Upload accept={ACCEPT} title="" text="" file={pay.receipt} onPick={upload} onClear={() => actions.updatePayment(pay.id, { state: 'empty', receipt: undefined })} />}
      </>
    );
    bar = { btns: [{ label: 'К заказу', kind: 'info', on: toOrder }] };
  } else if (pay.state === 'ok') {
    body = <Note tone="ok" title="Оплата подтверждена" text={pay.kind === 'delivery'
      ? `Доставка посылки ${pay.parcel ?? ''} оплачена. На другие посылки этот платёж не распространяется — их доставка оплачивается отдельно.`
      : `Оплата товаров подтверждена продавцом${pay.confirmedAt ? ' ' + pay.confirmedAt : ''}.`} />;
    if (pay.sellerReceipt) {
      const rc = pay.sellerReceipt;
      body = <>{body}<Photos title="Чек продавца" text={`${rc.name} · ${rc.date}`} pics={rc.preview ? [rc.preview] : []} /></>;
    }
    bar = { btns: [{ label: 'К заказу', kind: 'primary', on: toOrder }] };
  } else {
    body = (
      <>
        <Note tone="err" title="Оплата не подтверждена" text="Продавец не нашёл поступление по этому чеку. Проверьте сумму и назначение платежа или напишите в поддержку — статус заказа не изменился." />
        <Btns items={[
          { label: 'Прикрепить другой чек', kind: 'primary', on: () => actions.updatePayment(pay.id, { state: 'empty', receipt: undefined }) },
          { label: 'Написать в поддержку', kind: 'violet', on: () => sheet.open(supportSheet('order_' + pay.orderNum)) },
        ]} />
      </>
    );
  }

  return (
    <Screen header={<Header title="Оплата переводом" sub={pay.kind === 'delivery' ? 'Доставка посылки · заказ ' + pay.orderLabel : 'Товары · заказ ' + pay.orderLabel} />} bar={bar}>
      <PayBlock pay={pay} />
      <H text="Чек об оплате" />
      <div ref={block} data-anim="pay" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{body}</div>
    </Screen>
  );
}

function today() {
  return new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** Сумма, реквизиты и назначение с копированием в одно касание. */
function PayBlock({ pay }: { pay: Payment }) {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const purpose = pay.kind === 'delivery' ? `Доставка посылки ${pay.parcel ?? ''} по заказу ${pay.orderNum}` : 'Оплата товаров по заказу ' + pay.orderNum;
  const copy = (key: string, text: string) => {
    copyText(text).then((ok) => {
      if (!ok) return;
      haptic.light();
      setCopied(key);
      toast('Скопировано');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1800);
    });
  };
  const pill = (done: boolean, onDark: boolean): CSSProperties => ({ flex: 'none', minHeight: 40, padding: '0 14px', border: 0, borderRadius: 999, background: done || onDark ? 'var(--lime)' : 'var(--lb-ink-2)', color: done || onDark ? 'var(--lb-ink)' : 'var(--lb-white)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 160ms ease' });
  const amount = rub(pay.sum);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ padding: '16px 16px 14px', borderRadius: 20, background: 'var(--lb-ink-2)', color: 'var(--lb-white)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>{pay.kind === 'delivery' ? 'Оплата доставки посылки' : 'Оплата товаров'}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 999, background: 'var(--lb-white-a14)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Заказ {pay.orderLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500 }}>Сумма к переводу</div>
            <div style={{ marginTop: 4, fontSize: 32, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, whiteSpace: 'nowrap' }}>{amount}</div>
          </div>
          <button type="button" aria-label="Скопировать сумму" onClick={() => copy('amt', String(pay.sum))} className="pressable-sm" style={pill(copied === 'amt', true)}>{copied === 'amt' ? 'Скопировано' : 'Копировать'}</button>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lb-white-a14)', fontSize: 11.5, lineHeight: 1.4 }}>Переводите точную сумму — продавец сверяет её с чеком.</div>
      </div>

      <div style={{ padding: 14, borderRadius: 20, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'var(--lb-n-150)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Landmark size={20} strokeWidth={2} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{REQUISITES.bank}</div>
            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--lb-ink-2)' }}>Перевод по номеру · получатель {REQUISITES.recipient}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '12px 12px 12px 14px', borderRadius: 15, background: 'var(--lb-n-50)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 700, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{REQUISITES.number}</div>
          <button type="button" aria-label="Скопировать номер для перевода" onClick={() => copy('num', REQUISITES.number.replace(/\s/g, ''))} className="pressable-sm" style={pill(copied === 'num', false)}>{copied === 'num' ? 'Скопировано' : 'Копировать'}</button>
        </div>
      </div>

      <button type="button" aria-label="Скопировать назначение платежа" onClick={() => copy('pur', purpose)} className="pressable"
        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', padding: '12px 14px', border: '1.5px dashed var(--lb-ink-a28)', borderRadius: 18, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lb-ink-2)' }}>Комментарий к переводу</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, lineHeight: 1.35, textWrap: 'pretty' }}>{purpose}</div>
        </div>
        <div style={{ flex: 'none', alignSelf: 'center', height: 28, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 999, background: copied === 'pur' ? 'var(--lime)' : 'var(--lb-n-150)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{copied === 'pur' ? 'Скопировано' : 'Копировать'}</div>
      </button>
    </div>
  );
}
