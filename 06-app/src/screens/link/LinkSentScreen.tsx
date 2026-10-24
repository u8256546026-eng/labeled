import { useParams } from 'react-router-dom';
import { plural, rub } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { useApp } from '../../store/app';
import { Empty, Note } from '../../ui/blocks';
import { Steps } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { OrderCard } from '../../ui/orderBlocks';
import { Screen } from '../../ui/Screen';

/** AX — заявка по ссылке отправлена: оплаты до одобрения нет, переход к заявке. */
export function LinkSentScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const r = useApp((s) => s.linkRequests[num]);
  if (!r) return <Screen header={<Header title="Заявка отправлена" />}><Empty minH={560} title="Заявка не найдена" text="Она появится в «Моих заказах» в профиле." btns={[{ label: 'Заказ по ссылке', kind: 'primary', on: () => nav.root('/link') }]} /></Screen>;
  const n = r.form.items.length;
  const open = () => nav.reset(['/profile', '/orders', '/order/' + r.num]);
  return (
    <Screen header={<Header title="Заявка отправлена" />} bar={{ btns: [{ label: 'Перейти к заявке', kind: 'primary', on: open }] }}>
      <Note tone="ok" title="Ждёт подтверждения" text={`Заявка ${r.num} «${r.title}» ушла на проверку. Оплаты до одобрения продавца нет — сумму подтвердят и пришлют счёт.`} />
      <Steps labels={['Заявка', 'Подтверждение', 'Оплата', 'Выкуп', 'Доставка']} cur={1} />
      <OrderCard pre="" title={`Заявка ${r.num} · ${r.title}`} name="" kind="" status="Ждёт подтверждения" tone="wait" thumbs={r.form.items.map((it) => it.pic?.preview).filter((x): x is string => !!x)}
        meta={`${n} ${plural(n, 'позиция', 'позиции', 'позиций')} · ${rub(r.calc.total)}`} onClick={open} />
    </Screen>
  );
}
