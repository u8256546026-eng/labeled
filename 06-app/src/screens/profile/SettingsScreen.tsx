import { profileApi } from '../../api/profile';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { Cards, H } from '../../ui/blocks';
import { ic } from '../../ui/icons';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';

/** AM — настройки: почта, уведомления, выход, удаление. Пароля и подключения Telegram нет: вход и так через Telegram. */
export function SettingsScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const me = useApp((s) => s.me);
  const name = useApp((s) => s.name);
  const email = useApp((s) => s.email);
  const addr = useApp((s) => s.emailAddr);
  const PILL = { ok: ['Подтверждена', 'live'], none: ['Не привязана', 'wait'], err: ['Ошибка', 'err'], wait: ['Ждёт подтверждения', 'wait'] } as const;

  const logout = () => sheet.open({
    title: 'Выйти из аккаунта?', text: 'Заказы останутся в аккаунте — вход через Telegram вернёт к ним.',
    btns: [{ label: 'Выйти', kind: 'danger', on: () => profileApi.logout().then(() => { actions.logout(); nav.root('/profile'); }) }, { label: 'Отмена', kind: 'ghost' }],
  });

  return (
    <Screen header={<Header title="Настройки" />}>
      <Cards rows={[{ title: name, sub: 'Вход через Telegram' + (me.username ? ' · @' + me.username : ''), img: me.photo, on: () => nav.go('/profile/edit') }]} />
      <H text="Связь" />
      <Cards rows={[
        { ...ic('mail'), title: 'Почта', sub: email === 'ok' || email === 'wait' ? addr : email === 'err' ? 'Не удалось подтвердить' : 'Скидка 50% на комиссию в первом заказе', pill: PILL[email][0], pillTone: PILL[email][1], on: () => nav.go('/email') },
        { ...ic('bell'), title: 'Уведомления', sub: 'Заявки, оплата и доставка · в Telegram', on: () => nav.go('/notif') },
      ]} />
      <H text="Аккаунт" />
      <Cards rows={[
        { ...ic('logout'), title: 'Выйти', sub: 'Заказы и баллы останутся в аккаунте', chev: false, on: logout },
        { ...ic('trash'), title: 'Удалить аккаунт', sub: 'Навсегда, вместе с адресами и баллами', danger: true, on: () => nav.go('/delete-account') },
      ]} />
    </Screen>
  );
}
