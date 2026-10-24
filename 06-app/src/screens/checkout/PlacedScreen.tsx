import { useParams } from 'react-router-dom';
import { rub } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { useApp } from '../../store/app';
import { Empty, Note } from '../../ui/blocks';
import { Items, Steps, Sum, type SumRow } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

/** K — заказ из наличия оформлен: оплата на проверке, вещи закреплены. Стек сброшен, «назад» нет. */
export function PlacedScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const o = useApp((s) => s.placed[num]);
  if (!o) return <Screen header={<Header title="Заказ оформлен" />}><Empty minH={560} title="Заказ не найден" text="Он появится в «Моих заказах» в профиле." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }]} /></Screen>;
  return (
    <Screen header={<Header title={`Заказ ${o.num} оформлен`} />}
      bar={{ btns: [{ label: 'В каталог', kind: 'ghost', on: () => nav.root('/') }, { label: 'К заказу', kind: 'primary', on: () => nav.reset(['/profile', '/orders', '/order/' + o.num]) }] }}>
      <Note tone="wait" title="Оплата на проверке" text="Чек отправлен. Продавец сверит поступление вручную — после подтверждения заказ передадут в CDEK. Вещи закреплены за вами." />
      <Steps labels={['Оформлен', 'Оплата подтверждена', 'Передано в CDEK', 'Доставлен']} cur={1} />
      <Items rows={o.lines.map((l) => ({ key: l.key, name: l.name, params: l.params, price: rub(l.price * l.qty), qty: l.qty + ' шт', img: l.img, tag: l.cond }))} />
      <Sum rows={([{ label: 'Товары', value: rub(o.goods) }] as SumRow[])
        .concat(o.pointsOff ? [{ label: 'Списание баллов', value: '−' + rub(o.pointsOff) }] : [])
        .concat([{ label: 'Переведено', value: rub(o.total), total: true }])} />
    </Screen>
  );
}
