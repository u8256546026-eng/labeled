import { useNav } from '../../nav/useNav';
import { actions, useApp, type NotifPrefs } from '../../store/app';
import { requestBotMessages } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { H, Tog } from '../../ui/blocks';
import { ic } from '../../ui/icons';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';

/** AP — каналы и типы уведомлений. В приложении события видны всегда, в «Событиях» профиля. */
export function NotifScreen() {
  const nav = useNav();
  const toast = useToast();
  const n = useApp((s) => s.notif);
  const email = useApp((s) => s.email);
  const addr = useApp((s) => s.emailAddr);
  const flip = (k: keyof NotifPrefs) => () => actions.setNotif({ [k]: !n[k] });
  const toggleBot = async () => {
    if (n.bot) return actions.setNotif({ bot: false });
    // Боту нужно разрешение писать пользователю — системное окно Telegram (README, AE).
    if (await requestBotMessages()) actions.setNotif({ bot: true });
    else toast('Уведомления выключены');
  };
  return (
    <Screen header={<Header title="Уведомления" />}>
      <Tog rows={[{ ...ic('send'), label: 'Сообщения от бота labeled', sub: n.bot ? 'Приходят в чат с ботом в Telegram' : 'Выключены. Всё важное видно в «Событиях» профиля', on_: n.bot, act: toggleBot }]} />
      <H text="О чём сообщать" />
      <Tog rows={[
        { ...ic('check'), label: 'Заявки и решения продавца', sub: 'Подтверждение, изменение цены, отказ', on_: n.bot && n.req, dis: !n.bot, act: flip('req') },
        { ...ic('card'), label: 'Оплата', sub: 'Счёт, проверка перевода, чеки', on_: n.bot && n.pay, dis: !n.bot, act: flip('pay') },
        { ...ic('truck'), label: 'Доставка', sub: 'Склад, посылки, трек CDEK', on_: n.bot && n.ship, dis: !n.bot, act: flip('ship') },
        { ...ic('gift'), label: 'Баллы и приглашения', sub: 'Начисления и списания', on_: n.bot && n.pts, dis: !n.bot, act: flip('pts') },
        { ...ic('tag'), label: 'Новинки и скидки', sub: 'Не чаще раза в неделю', on_: n.bot && n.promo, dis: !n.bot, act: flip('promo') },
      ]} />
      <H text="Дублировать на почту" />
      <Tog rows={[{ ...ic('mail'), label: 'Почта', sub: email === 'ok' ? addr : 'Сначала подтвердите почту', on_: n.mail && email === 'ok', dis: email !== 'ok', act: flip('mail') }]} />
      {email !== 'ok' && <Btns items={[{ label: 'Подтвердить почту', kind: 'limeSoft', on: () => nav.go('/email') }]} />}
    </Screen>
  );
}
