import { useParams } from 'react-router-dom';
import { useOrders } from '../../api/useOrders';
import { ordersApi } from '../../api/orders';
import { live } from '../../api/client';
import { reloadMe, reloadPayments } from '../../api/session';
import { useToast } from '../../ui/Toast';
import { G4, G5, parcelDelivery, type OrderAct } from '../../domain/orders';
import { rub } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { appLink, haptic, openExternal, shareLink } from '../../telegram/tma';
import { Btns, type BtnSpec } from '../../ui/Btn';
import { Empty, H, Note, P, Skel } from '../../ui/blocks';
import { Items, Sum } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { HistBox, Materials, ParcelCard, Photos, StatusCard, Stars } from '../../ui/orderBlocks';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { supportSheet } from '../../ui/support';

const cdekUrl = (track: string) => 'https://www.cdek.ru/ru/tracking?order_id=' + track.replace(/\D/g, '');

/** 7j–7n · D · J · AA · AZ — карточка заказа: точный статус, история, посылки, оплаты и действия. */
export function OrderScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const sheet = useSheet();
  const { orders, reload } = useOrders();
  const toast = useToast();
  const payments = useApp((s) => s.payments);
  const us = useApp((s) => s.orderState[num]);
  const claim = useApp((s) => s.claims[num]);
  const reviewSent = useApp((s) => !!s.reviewsSent[num]);
  const o = orders?.find((x) => x.num === num);
  if (!o) {
    if (!orders) return <Screen header={<Header title="Заказ" />}><Skel n={2} /></Screen>;
    return <Screen header={<Header title="Заказ" />}><Empty minH={560} title="Заказ не найден" text="Он появится в «Моих заказах» в профиле." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }]} /></Screen>;
  }
  const labels = o.kind === 'link' ? G5 : G4;
  const cancelSent = us?.cancel === 'sent';

  const openCancel = () => sheet.open({
    title: 'Отменить заказ?',
    text: 'Импорт можно отменить до выкупа, заказ из наличия — до получения. Отправим обращение продавцу: порядок возврата денег, сроки и удержания ещё уточняются, поэтому автоматический возврат мы не обещаем и сумму не называем.',
    btns: [{ label: 'Отправить обращение', kind: 'danger', on: () => {
      // С сервером: до оплаты заказ отменяется сразу, после — уходит запрос продавцу.
      ordersApi.cancel(o.num).then((r) => {
        if (r === 'requested') actions.setOrderState(o.num, { cancel: 'sent' });
        haptic.success();
        if (live()) { reload(); void reloadMe(); }
      }, () => { haptic.error(); toast('Не получилось — попробуйте ещё раз', 'error'); });
    } }, { label: 'Не отменять', kind: 'ghost' }],
  });
  const act = (a: OrderAct): BtnSpec => {
    if ('dis' in a) return { label: a.label, kind: 'off', dis: true };
    if ('sheet' in a) return { label: a.label, kind: a.kind, on: a.sheet === 'cancel' ? openCancel : () => sheet.open(supportSheet('order_' + o.num)) };
    if ('pay' in a) return { label: a.label, kind: a.kind, on: () => {
      // Согласие с изменённой заявкой (J): сервер выставляет счёт, потом открываем оплату.
      ordersApi.accept(o.num).then(async () => {
        if (live()) { await reloadPayments(); reload(); } else actions.ensurePayment(a.pay);
        nav.go('/pay/' + a.pay.id);
      }, () => toast('Не получилось — попробуйте ещё раз', 'error'));
    } };
    if ('recv' in a) return { label: a.label, kind: a.kind, on: () => {
      ordersApi.received(o.num).then(() => { actions.setOrderState(o.num, { recv: 'ok' }); haptic.success(); if (live()) reload(); }, () => toast('Не получилось — попробуйте ещё раз', 'error'));
    } };
    return { label: a.label, kind: a.kind, on: () => (a.root ? nav.root(a.to) : nav.go(a.to)) };
  };
  const acts = (o.acts ?? []).filter((a) => !(cancelSent && 'sheet' in a && a.sheet === 'cancel')).map(act);

  return (
    <Screen header={<Header title={o.title} sub={o.sub} btn={/^\d+$/.test(o.num) ? { label: 'Поделиться', on: () => shareLink(appLink('order_' + o.num), `Заказ ${o.num} в labeled · ${o.status}`) } : undefined} />}>
      {o.sizeRequest
        ? <Note tone={o.tone === 'live' ? 'ok' : 'wait'} title={o.tone === 'live' ? 'Продавец подтвердил' : o.status} text={o.note} />
        : <StatusCard title={o.status} note={o.note} labels={labels} cur={Math.min(o.stage, labels.length)} tone={o.tone} stop={o.stopped} />}
      {/* Изменения продавца — над позициями (J); «Проверьте при получении» — под вещью (AA). */}
      {o.alert && !o.receivable && <Note tone="err" title={o.alert.title} text={o.alert.text} />}
      {o.history && <HistBox rows={o.history} />}
      {o.items && <Items rows={o.items.map((it, i) => ({ key: String(i), ...it }))} />}
      {o.alert && o.receivable && <Note tone="wait" title={o.alert.title} text={o.alert.text} />}
      {o.sums && <Sum rows={o.sums.rows} note={o.sums.note} />}
      {o.parcels?.map((p) => {
        const pay = p.payId ? payments[p.payId] : undefined;
        const d = parcelDelivery(rub(pay?.sum ?? 0), pay, p.deliveryPaid);
        const rows = [{ label: 'Доставка', value: d.text }].concat(p.track ? [{ label: 'Трек', value: p.track }] : []);
        const actBtn = d.needPay && p.payId
          ? { label: 'Оплатить доставку', kind: 'primary' as const, on: () => nav.go('/pay/' + p.payId) }
          : p.track ? { label: 'Отследить в CDEK', kind: 'info' as const, on: () => openExternal(cdekUrl(p.track!)) } : undefined;
        return <ParcelCard key={p.title} title={p.title} stage={p.stage} labels={labels} cur={p.cur} items={p.items} rows={rows} act={actBtn} />;
      })}
      {o.parcelNote && <div style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--lb-lime-soft)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', fontSize: 'var(--f-small)', lineHeight: 1.45, color: 'var(--lb-ink-2)' }}>{o.parcelNote}</div>}
      {o.photos && <Photos {...o.photos} />}
      {o.materials && <Materials title={o.kind === 'link' || o.parcels ? 'Оплата и материалы' : 'Оплата'} rows={o.materials.rows} pics={o.materials.pics} />}
      {claim && (
        <Note tone={claim.state === 'sent' ? 'wait' : claim.answer === 'no' ? 'err' : claim.answer === 'more' ? 'wait' : 'ok'}
          title={claim.state === 'sent' ? 'Обращение на рассмотрении' : 'Ответ по обращению ' + claim.id}
          text={claim.state === 'sent' ? `Обращение ${claim.id} отправлено ${claim.sentAt}. Продавец ответит в приложении.` : claim.answer === 'no' ? 'Продавец не признал брак.' : claim.answer === 'more' ? 'Продавец просит ещё фото.' : claim.refundSum && o.kind === 'stock' ? `Возврат ${rub(claim.refundSum)} одобрен.` : 'Обращение одобрено.'}
          act={{ label: 'Открыть', on: () => nav.go('/claim/' + o.num) }} />
      )}
      {o.receivable === false && us?.recv === 'ok' && !reviewSent && (
        <>
          <H text="Как вам покупка?" sub="Отзыв увидят другие покупатели с отметкой «Покупка подтверждена»" />
          <Stars value={0} onPick={(n) => nav.go(`/review/${o.num}?stars=${n}`)} />
        </>
      )}
      {acts.length > 0 && <Btns items={acts} />}
      {o.footnote && !cancelSent && <P>{o.footnote}</P>}
      {cancelSent && <Note tone="wait" title="Отмена на рассмотрении" text="Обращение по отмене отправлено. Продавец ответит в приложении. Порядок и сроки возврата денег уточняются — сумму мы не называем." />}
    </Screen>
  );
}
