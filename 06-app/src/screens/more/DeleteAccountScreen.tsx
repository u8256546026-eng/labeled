import { errorText } from '../../api/client';
import { profileApi } from '../../api/profile';
import { useToast } from '../../ui/Toast';
import { useState } from 'react';
import { useOrders } from '../../api/useOrders';
import { num, plural } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { H, Note, Skel } from '../../ui/blocks';
import { Radio, Sum } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';

/** O — удаление аккаунта. Удалить нельзя, пока есть незавершённые заказы и заявки. */
export function DeleteAccountScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const toast = useToast();
  const addrs = useApp((s) => s.addrs.length);
  const pts = useApp((s) => s.pts);
  const { orders } = useOrders();
  const [ok, setOk] = useState(false);
  const open = orders?.filter((o) => o.group !== 'done' && !o.stopped) ?? null;
  const blocked = !open || open.length > 0;

  const confirm = () => sheet.open({
    title: 'Удалить аккаунт навсегда?', text: 'Вход через Telegram после удаления создаст новый пустой аккаунт.',
    btns: [{ label: 'Удалить', kind: 'danger', on: () => profileApi.deleteAccount().then(() => { actions.logout(); nav.root('/profile'); }, (e) => toast(errorText(e, 'Не получилось удалить — проверьте незавершённые заказы'), 'error')) }, { label: 'Отмена', kind: 'ghost' }],
  });

  return (
    <Screen header={<Header title="Удаление аккаунта" />} bar={{ btns: [{ label: 'Удалить аккаунт', kind: 'danger', dis: blocked || !ok, on: confirm }] }}>
      <H text="Что удалится" sub="Восстановить аккаунт и данные после удаления нельзя." />
      <Sum rows={[
        { label: 'Профиль', value: 'имя, почта' },
        { label: 'Адреса доставки', value: addrs + ' шт' },
        { label: 'Черновики заявок', value: 'все' },
        { label: 'Вход через Telegram и почту', value: 'отвяжется' },
        { label: 'Баллы', value: num(pts) + ' — сгорят', total: true },
      ]} />
      <H text="Заказы в работе" />
      {!open ? <Skel n={1} /> : open.length > 0 ? (
        <Note tone="wait" title={`${open.length} ${plural(open.length, 'заказ ещё не завершён', 'заказа ещё не завершены', 'заказов ещё не завершены')}`}
          text={`${open.map((o) => (/^\d+$/.test(o.num) ? o.num : o.title)).join(', ')}. Удалить аккаунт можно, когда все заказы и заявки завершатся.`}
          act={{ label: 'Мои заказы', on: () => nav.go('/orders') }} />
      ) : (
        <Note tone="ok" title="Незавершённых заказов нет" text="Аккаунт можно удалить." />
      )}
      <Radio label="Подтверждение" rows={[{ label: 'Понимаю, что баллы сгорят и аккаунт не восстановить', on_: ok, act: () => setOk(!ok), dis: blocked }]} />
    </Screen>
  );
}
