import { ApiError, errorText, live } from '../../api/client';
import { useEffect, useRef, useState } from 'react';
import { emailApi } from '../../api/profile';
import { reloadMe } from '../../api/session';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { haptic, tmaEnv } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Note, P } from '../../ui/blocks';
import { Input } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** AN — почта: привязка, ожидание подтверждения, ошибка, подтверждена. */
export function EmailScreen() {
  const nav = useNav();
  const state = useApp((s) => s.email);
  const addr = useApp((s) => s.emailAddr);
  const [value, setValue] = useState(addr);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  // Отправка идёт до 20 с (ящик магазина): повторные нажатия не должны слать второе письмо и тратить предел 5 в час.
  const sending = useRef(false);
  const toast = useToast();
  const sheet = useSheet();
  const valid = EMAIL_RE.test(value.trim());

  // Ссылку покупатель открывает в почте, вне Mini App: пока ждём, перечитываем состояние при возврате и раз в 10 с.
  useEffect(() => {
    if (state !== 'wait' || !live()) return;
    const check = () => { if (document.visibilityState === 'visible') reloadMe().catch(() => {}); };
    const timer = setInterval(check, 10_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [state]);

  const send = (address: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    const done = () => { sending.current = false; setBusy(false); };
    emailApi.send(address).then(
      (r) => { done(); actions.setEmail('wait', r.address); },
      // Письмо не ушло — состояние не меняем: экран не должен говорить «отправлено».
      (e) => { done(); haptic.error(); toast(e instanceof ApiError && e.message.startsWith('mail_') && e.detail ? e.detail : errorText(e, 'Не получилось отправить письмо — попробуйте ещё раз'), 'error'); },
    );
  };

  // Отвязка стирает подтверждённый адрес — сначала спрашиваем, как при удалении адреса и выходе.
  const unlink = () => sheet.open({
    title: 'Отвязать почту?',
    text: `На ${addr} перестанут приходить письма о заказах. Скидка 50% на комиссию в первом заказе работает только с подтверждённой почтой — чтобы вернуть её, почту придётся подтвердить заново.`,
    btns: [
      { label: 'Отвязать', kind: 'danger', on: () => emailApi.unlink().then(
        () => { actions.setEmail('none', ''); setValue(''); toast('Почта отвязана'); nav.back(); },
        (e) => { haptic.error(); toast(errorText(e, 'Не получилось отвязать почту — попробуйте ещё раз'), 'error'); },
      ) },
      { label: 'Отмена', kind: 'ghost' },
    ],
  });

  if (state === 'none') {
    return (
      <Screen header={<Header title="Почта" />} bar={{ btns: [{ label: 'Отправить письмо', kind: 'primary', dis: !valid || busy, on: () => send(value.trim()) }] }}>
        <P>Почта нужна для скидки 50% на комиссию в первом заказе и как канал уведомлений.</P>
        <div onBlur={() => setTouched(true)}>
          <Input label="Адрес почты" value={value} onChange={setValue} ph="name@example.com" mode="email" err={touched && value && !valid ? 'Проверьте адрес почты' : undefined} />
        </div>
      </Screen>
    );
  }
  return (
    <Screen header={<Header title="Почта" />}>
      {state === 'wait' && (
        <>
          <Note tone="wait" title="Ждёт подтверждения" text={`Письмо отправлено на ${addr}. Подтвердите адрес по ссылке из письма.`} />
          <Btns items={[
            ...((tmaEnv() === 'mock' && !live()) ? [{ label: 'Подтвердить (демонстрация)', kind: 'primary' as const, on: () => emailApi.confirmDemo().then(() => { actions.setEmail('ok'); actions.setNotif({ mail: true }); haptic.success(); }) }] : []),
            { label: 'Отправить письмо ещё раз', kind: 'limeSoft', dis: busy, on: () => send(addr) },
            { label: 'Изменить адрес', kind: 'ghost', on: () => actions.setEmail('none') },
          ]} />
        </>
      )}
      {state === 'err' && (
        <>
          <Note tone="err" title="Почта не подтверждена" text={`Ссылка подтверждения для ${addr} истекла. Отправьте письмо заново.`} act={{ label: busy ? 'Отправляем…' : 'Отправить заново', on: () => send(addr) }} />
          <Btns items={[{ label: 'Изменить адрес', kind: 'ghost', on: () => actions.setEmail('none') }]} />
        </>
      )}
      {state === 'ok' && (
        <>
          <Note tone="ok" title="Почта подтверждена" text={`${addr} подтверждена. Скидка 50% на комиссию доступна в первом заказе.`} />
          <Btns items={[{ label: 'Отвязать почту', kind: 'danger', on: unlink }]} />
        </>
      )}
    </Screen>
  );
}
