import { live } from '../../api/client';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { claimsApi, photoReportApi } from '../../api/afterSale';
import { useOrders } from '../../api/useOrders';
import { CLAIM_REASONS, type ClaimAnswer, type ClaimReason } from '../../domain/claims';
import { rub } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { haptic, tmaEnv } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Chips, Empty, H, Note, P, Reasons, Skel } from '../../ui/blocks';
import { Input, Items, Upload } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Photos, Timeline } from '../../ui/orderBlocks';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { supportSheet } from '../../ui/support';

const priceOf = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;

/**
 * M · Y — проблема с заказом: форма обращения, затем ответ продавца из админки (adm13):
 * одобрено (для вещей из наличия — возврат денег, Z), отказ с фото продавца, запрос дополнительных фото.
 */
export function ClaimScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const sheet = useSheet();
  const { orders } = useOrders();
  const claim = useApp((s) => s.claims[num]);
  const report = useApi(() => photoReportApi.get(num), [num], 'report:' + num, { live: true });
  const [reason, setReason] = useState<ClaimReason | null>(null);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [more, setMore] = useState(0);
  const [moreFiles, setMoreFiles] = useState<File[]>([]);
  // С сервером обращение и решение продавца приходят из API.
  useEffect(() => { if (live()) claimsApi.get(num).then((c) => { if (c) actions.saveClaim(c); }, () => {}); }, [num]);
  const [busy, setBusy] = useState(false);

  const o = orders?.find((x) => x.num === num);
  if (!orders) return <Screen header={<Header title="Проблема с заказом" />}><Skel n={2} /></Screen>;
  if (!o) return <Screen header={<Header title="Проблема с заказом" />}><Empty minH={500} title="Заказ не найден" text="Откройте обращение из карточки заказа." btns={[{ label: 'Мои заказы', kind: 'primary', on: () => nav.go('/orders') }]} /></Screen>;
  const item = o.items?.[0];
  const stock = o.kind === 'stock';

  // ---- форма (M) ----
  if (!claim) {
    const needPhoto = reason != null && CLAIM_REASONS[reason].photo;
    const send = () => {
      if (reason == null) return;
      setBusy(true);
      claimsApi.create({ orderNum: num, reason, text, photos, files, refundSum: item ? priceOf(item.price) : undefined }).then((c) => { actions.saveClaim(c); haptic.success(); }, () => setBusy(false));
    };
    return (
      <Screen header={<Header title="Проблема с заказом" sub={`Заказ ${num} · ${o.name}`} />}
        bar={{ btns: [{ label: reason == null ? 'Выберите причину' : needPhoto && !photos ? 'Добавьте фото' : 'Отправить обращение', kind: 'primary', dis: reason == null || (needPhoto && !photos) || busy, on: send }] }}>
        {item && <Items rows={[{ key: 'i', name: item.name, params: o.receivedAt ? `${item.params} · получен ${o.receivedAt}` : item.params, price: item.price, img: item.img }]} />}
        <H text="Что случилось" />
        <Reasons label="Что случилось" rows={CLAIM_REASONS.map((r, i) => ({ label: r.label, sub: r.sub, wide: 'wide' in r && r.wide, on_: reason === i, act: () => setReason(i as ClaimReason) }))} />
        <Input label="Опишите проблему" value={text} ph="Что не так и когда заметили" onChange={setText} />
        <H text="Фото" sub={reason == null ? 'Для брака и ошибки с вещью — обязательно' : needPhoto ? 'Обязательно: вещь, бирка и упаковка' : 'По желанию'} />
        <Upload accept="image/*" max={5} title="Добавить фото" text="До 5 снимков" file={photos ? { name: `${photos} фото`, meta: 'Добавлены только что' } : null}
          onPick={(_f, all) => { setPhotos(all.length); setFiles(all); }} onClear={() => { setPhotos(0); setFiles([]); }} />
        <P>Продавец ответит в приложении.{stock ? '' : ' Вещи, заказанные из-за границы, вернуть нельзя.'}</P>
      </Screen>
    );
  }

  // ---- отправлено ----
  if (claim.state === 'sent') {
    return (
      <Screen header={<Header title="Проблема с заказом" sub={`Заказ ${num} · ${o.name}`} />} bar={{ btns: [{ label: 'К заказу', kind: 'primary', on: () => nav.goOrBack('/order/' + num) }] }}>
        <Note tone="ok" title={`Обращение ${claim.id} отправлено`} text="Обращение ушло продавцу вместе с фото и номером заказа. Ответ придёт в приложении и в подключённые каналы." />
        {!stock && <P>Вещи из-за границы не возвращаются. Продавец проверит обращение и предложит решение.</P>}
        {(tmaEnv() === 'mock' && !live()) && <Btns items={[{ label: 'Показать ответ продавца', kind: 'limeSoft', on: () => actions.updateClaim(num, { state: 'answer', answer: 'ok' }) }]} />}
      </Screen>
    );
  }

  // ---- ответ продавца (Y) ----
  const A: ClaimAnswer = claim.answer ?? 'ok';
  const refundable = A === 'ok' && stock && !!claim.refundSum;
  return (
    <Screen header={<Header title="Проблема с заказом" sub={`Обращение ${claim.id} · ${o.name}`} />}
      bar={refundable ? { btns: [{ label: claim.refund ? 'Возврат денег' : 'Указать реквизиты для возврата', kind: 'primary', on: () => nav.go('/refund/' + num) }] }
        : A === 'more' ? { btns: [{ label: more ? 'Отправить фото' : 'Добавьте фото', kind: 'primary', dis: !more, on: () => claimsApi.addPhotos(claim.id, more, moreFiles).then((n) => actions.updateClaim(num, { state: 'sent', morePhotos: n, answer: undefined })) }] } : undefined}>
      {(tmaEnv() === 'mock' && !live()) && <Chips label="Вариант ответа" rows={([['ok', 'Одобрено'], ['no', 'Отказ'], ['more', 'Нужны фото']] as const).map(([k, l]) => ({ label: l, on_: A === k, act: () => actions.updateClaim(num, { answer: k }) }))} />}
      <Timeline rows={[
        { label: 'Обращение отправлено', date: claim.sentAt, state: 'done' },
        { label: 'На рассмотрении', date: claim.sentAt, state: 'done' },
        { label: A === 'more' ? 'Нужны данные от вас' : 'Решение продавца', date: claim.sentAt, state: 'current' },
        ...(refundable ? [{ label: 'Возврат денег', state: 'future' as const }] : []),
      ]} />
      {A === 'ok' && (
        <Note tone="ok" title="Обращение одобрено" text={stock && claim.refundSum
          ? `Продавец проверил фото и признал брак. Решение — вернуть ${rub(claim.refundSum)} за «${item?.name ?? o.name}».`
          : 'Продавец проверил фото и признал брак. Решение и следующие шаги — в ответе продавца.'} />
      )}
      {A === 'ok' && stock && <P>Нужно ли отправлять вещь обратно, продавец пишет в решении.</P>}
      {A === 'no' && (
        <>
          <Note tone="err" title="Отказ по обращению" text="На фото со склада вещь целая. Продавец считает, что дефект появился при носке, и не признаёт это браком." />
          {report.data && <Photos title="Фото продавца" text={`${report.data.place} · ${report.data.date}`} pics={report.data.pics.slice(0, 1)} />}
          <Btns items={[
            ...(report.data ? [{ label: 'Смотреть фотоотчёт', kind: 'info' as const, on: () => nav.go('/photo/' + num) }] : []),
            { label: 'Не согласен — в поддержку', kind: 'violet', on: () => sheet.open(supportSheet('claim_' + num)) },
          ]} />
        </>
      )}
      {A === 'more' && (
        <>
          <Note tone="wait" title="Нужны ещё фото" text="Пришлите фото дефекта сбоку и бирки крупным планом при дневном свете. Без них продавец не примет решение." />
          <Upload accept="image/*" max={5} title="Добавить фото" text="До 5 снимков" file={more ? { name: `${more} фото`, meta: 'Добавлены только что' } : null} onPick={(_f, all) => { setMore(all.length); setMoreFiles(all); }} onClear={() => { setMore(0); setMoreFiles([]); }} />
        </>
      )}
    </Screen>
  );
}
