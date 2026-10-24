import { ApiError, errorText } from '../../api/client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkoutApi } from '../../api/checkout';
import { deliveryText, maxPoints, pvzText, type CheckoutLine } from '../../domain/order';
import { num, plural, rub } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { useAttempt } from '../../lib/attempt';
import { useNav } from '../../nav/useNav';
import { actions, appStore, useApp } from '../../store/app';
import { haptic } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Empty, H, Note, P, Skel } from '../../ui/blocks';
import { Fields, Items, Radio, Sum } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';

/**
 * A · L — проверка заказа из наличия. Сервер сверяет цены и наличие: изменившуюся цену покупатель
 * принимает или убирает вещь, проданную — убирает. Пока это не решено, подтверждение недоступно.
 * ?offer=<id> — быстрая покупка одного предложения из карточки (BE).
 */
export function CheckoutScreen() {
  const nav = useNav();
  const toast = useToast();
  const [sp] = useSearchParams();
  const offerId = sp.get('offer');
  const fromCart = !offerId;
  const source = useMemo<CheckoutLine[]>(() => {
    if (offerId) { const l = checkoutApi.lineForOffer(offerId); return l ? [l] : []; }
    return appStore.get().cart.filter((r) => !r.gone).map((r) => ({ key: r.key, itemId: r.itemId, offerId: r.offerId, name: r.name, img: r.img, params: r.params, cond: r.cond, price: r.price, qty: r.qty }));
  }, [offerId]);
  const q = useApi(() => checkoutApi.validate(source), [source]);
  const [lines, setLines] = useState<CheckoutLine[] | null>(null);
  useEffect(() => { if (q.data) setLines(q.data); }, [q.data]);

  const pts = useApp((s) => s.pts);
  const addrs = useApp((s) => s.addrs);
  const addrSel = useApp((s) => s.addrSel);
  const dlv = useApp((s) => s.dlv);
  const disc = useApp((s) => s.checkoutDisc);
  const setDisc = actions.setCheckoutDisc;
  const [placing, setPlacing] = useState(false);
  const attempt = useAttempt();

  const header = <Header title="Проверка заказа" sub="Из наличия" />;
  if (q.error && !lines) return <Screen header={header}><Note tone="err" title="Нет соединения" text="Проверьте интернет и повторите. Черновики и введённые данные не пропадут." act={{ label: 'Повторить', on: q.reload }} /></Screen>;
  if (!lines) return <Screen header={header}><Skel n={2} /></Screen>;
  if (!lines.length) {
    return <Screen header={header}><Empty minH={560} title="Корзина пустая" text="Добавьте вещь из каталога или оформите заказ по ссылке на зарубежную площадку." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }, { label: 'Заказ по ссылке', kind: 'limeSoft', on: () => nav.root('/link') }]} /></Screen>;
  }

  const changed = lines.filter((l) => l.newPrice != null);
  const sold = lines.filter((l) => l.sold);
  const live = lines.filter((l) => !l.sold);
  const goods = live.reduce((s, l) => s + l.price * l.qty, 0);
  const maxPts = maxPoints(pts, goods);
  const pointsOff = disc === 'points' ? maxPts : 0;
  const total = goods - pointsOff;

  const accept = (l: CheckoutLine) => {
    setLines((ls) => ls!.map((x) => (x === l ? { ...x, price: x.newPrice!, newPrice: undefined } : x)));
    if (fromCart) actions.repriceCartLine(l.offerId, l.newPrice!);
  };
  const remove = (l: CheckoutLine) => {
    setLines((ls) => ls!.filter((x) => x !== l));
    if (fromCart) actions.removeCartOffer(l.offerId);
  };
  const confirm = () => {
    if (!attempt.start()) return;
    setPlacing(true);
    checkoutApi.place({ lines: live, pointsOff, delivery: dlv, addressId: addrs[addrSel]?.id ?? '', key: attempt.key() }).then(
      (o) => { actions.orderPlaced(o, fromCart ? live : []); haptic.success(); nav.replace('/pay/' + o.payId); },
      (e) => {
        attempt.fail(); setPlacing(false); haptic.error();
        // Цена изменилась или вещь купили, пока покупатель оформлял — сверяем заново (A, L).
        if (e instanceof ApiError && e.status === 409) { q.reload(); toast('Цена или наличие изменились — проверьте заказ', 'error'); } else toast(errorText(e, 'Не получилось оформить заказ — попробуйте ещё раз'), 'error');
      },
    );
  };

  const a = addrs[addrSel];
  // Пункт выдачи не выбран (пусто или код из старой демо-версии) — оформить нельзя, продавцу некуда отправлять.
  const dlvOk = dlv.mode === 'courier' || !!pvzText(dlv);
  const dText = dlvOk ? deliveryText(dlv) : '';
  const ordered = lines.slice().sort((x, y) => Number(!!y.sold) - Number(!!x.sold));

  // Кнопка говорит, чего не хватает: без способа получения или адреса ведёт к выбору, при изменениях — подсказывает.
  const cta = changed.length > 0 ? { label: 'Проверьте новую цену', dis: true }
    : sold.length > 0 ? { label: 'Уберите недоступные вещи', dis: true }
    : !dlvOk ? { label: 'Выбрать получение', on: () => nav.go('/delivery') }
    : !a ? { label: 'Выбрать адрес', on: () => nav.go('/addresses') }
    : { label: placing ? 'Оформляем…' : 'Подтвердить заказ', dis: placing, on: confirm };

  return (
    <Screen header={header} bar={{ total: rub(total), totalLabel: 'К оплате', btns: [{ kind: 'primary', ...cta }] }}>
      {changed.map((l) => (
        <div key={'chg' + l.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Note tone="err" title="Цена изменилась до подтверждения" text={`${l.name} — цена изменилась с ${rub(l.price)} на ${rub(l.newPrice!)}, продавец обновил вещь. Проверьте заказ: замену вещи мы не делаем.`} act={{ label: 'Принять новую цену', on: () => accept(l) }} />
          <Btns items={[{ label: 'Убрать вещь из заказа', kind: 'dangerSoft', on: () => remove(l) }]} />
        </div>
      ))}
      {sold.length > 0 && (
        <Note tone="err" title={`${sold.length} ${plural(sold.length, 'вещь', 'вещи', 'вещей')} больше ${sold.length === 1 ? 'недоступна' : 'недоступны'}`} text={`Уберите ${sold.length === 1 ? 'её' : 'их'} из заказа, чтобы продолжить. Остальные вещи остаются за вами.`} />
      )}

      <H text="Вещи" sub="Конкретные экземпляры, состояние и количество зафиксированы за вами на время оформления." />
      <Items rows={ordered.map((l) => l.sold
        ? { key: l.key, name: l.name, params: l.params + ' · купили, пока вы оформляли', price: rub(l.price * l.qty), qty: l.qty + ' шт', img: l.img, sold: true,
            acts: [{ label: 'Убрать из заказа', kind: 'primary', on: () => remove(l) }, { label: 'Похожие', kind: 'limeSoft', on: () => nav.root('/') }] }
        : { key: l.key, name: l.name, params: l.params + ' · ' + l.cond, price: rub(l.price * l.qty), qty: l.qty + ' шт', img: l.img, tag: l.cond })} />

      <H text="Получение" />
      <Fields rows={[{ label: 'Способ получения', value: dText, ph: 'Выберите пункт или курьера', on: () => nav.go('/delivery') }]} />

      <H text="Получатель и адрес" />
      <Fields rows={[
        { label: 'Получатель', value: a ? a.name + ' · ' + a.phone : '', ph: 'Выберите адрес', on: () => nav.go('/addresses') },
        { label: 'Адрес получения', value: a ? a.city + ', ' + a.line : '', ph: 'Выберите адрес', on: () => nav.go('/addresses') },
      ]} />

      <H text="Баллы" />
      <Radio label="Баллы" rows={[
        { label: 'Списать баллы', sub: `Доступно ${num(pts)} Б, списываем до 30% стоимости товаров`, right: '−' + rub(maxPts), on_: disc === 'points', act: () => setDisc('points'), dis: maxPts === 0 },
        { label: 'Не списывать', sub: 'Баллы останутся на балансе', on_: disc === 'none', act: () => setDisc('none') },
      ]} />

      <Sum rows={[
        { label: 'Товары', value: rub(goods) },
        { label: 'Списание баллов', value: pointsOff ? '−' + rub(pointsOff) : '—' },
        { label: 'Доставка по России', value: 'Считается после подтверждения' },
        { label: 'К оплате сейчас', value: rub(total), total: true },
      ]} />
      <P>Подтверждая заказ, вы принимаете условия оферты и политику обработки персональных данных.</P>
      <Btns items={[{ label: 'Документы', kind: 'violet', on: () => nav.go('/legal') }]} />
    </Screen>
  );
}
