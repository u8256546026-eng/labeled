import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { profileApi } from '../../api/profile';
import { TAB_PATHS } from '../../nav/routes';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { haptic, retrieveInitDataRaw } from '../../telegram/tma';
import { Cards, H, Note } from '../../ui/blocks';
import { ic } from '../../ui/icons';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

/**
 * P — вход через Telegram. Пароля, СМС и регистрации нет: пользователь берётся из initData,
 * подлинность проверяет сервер. Согласие с офертой и политикой — один раз, при первом входе.
 */
export function AuthScreen() {
  const nav = useNav();
  const [sp] = useSearchParams();
  const next = sp.get('next');
  const me = useApp((s) => s.me);
  const consented = useApp((s) => s.consent);
  const [ok, setOk] = useState(consented);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const login = () => {
    setBusy(true); setErr(false);
    profileApi.login(retrieveInitDataRaw(), ok).then(() => {
      actions.login();
      haptic.success();
      if (next && (TAB_PATHS as readonly string[]).includes(next)) nav.root(next);
      else if (next) nav.replace(next);
      else nav.back();
    }, () => { setBusy(false); setErr(true); haptic.error(); });
  };

  return (
    <Screen header={<Header title="Вход" sub="Через Telegram, без пароля и СМС" />}
      bar={{ btns: [{ label: ok ? 'Войти через Telegram' : 'Примите условия, чтобы войти', kind: 'primary', dis: !ok || busy, on: login }] }}>
      {next && next !== '/profile' && <Note tone="info" title="Войдите, чтобы сохранить заказ" text="Всё введённое сохранено. После входа вернём к оформлению." />}
      {err && <Note tone="err" title="Не удалось войти" text="Telegram не передал данные. Закройте приложение и откройте его заново из чата с ботом." />}
      <H text="Вы войдёте как" />
      <Cards rows={[{ title: me.tgName, sub: (me.username ? '@' + me.username + ' · ' : '') + 'фото и имя из Telegram', img: me.photo }]} />
      <Cards rows={[
        { ...ic('orders'), title: 'Заказы и отслеживание', sub: 'Статусы, посылки, трек CDEK' },
        { ...ic('bell'), title: 'Уведомления от бота', sub: 'Оплата, доставка, ответы продавца' },
        { ...ic('gift'), title: 'Баллы и приглашения', sub: '250 баллов за каждого друга' },
      ]} />
      {!consented && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '4px 2px' }}>
          <button type="button" role="checkbox" aria-checked={ok} aria-label="Согласие с офертой и политикой данных" onClick={() => setOk(!ok)} className="pressable-xs"
            style={{ width: 24, height: 24, flex: 'none', marginTop: 1, padding: 0, border: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: ok ? 'var(--lime)' : 'var(--lb-white)', boxShadow: ok ? 'inset 0 0 0 1.5px var(--lb-ink)' : 'inset 0 0 0 1.5px var(--lb-ink-a28)', transition: 'background 160ms ease, box-shadow 160ms ease' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={{ opacity: ok ? 1 : 0, transform: ok ? 'scale(1)' : 'scale(.6)', transition: 'opacity 160ms ease, transform 200ms cubic-bezier(.23,1,.32,1)' }}><path d="m3.5 8.3 3 3 6-6.6" stroke="#111111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>
            <span>Принимаю </span>
            <button type="button" onClick={() => nav.go('/legal')} style={linkStyle}>условия оферты</button>
            <span> и даю согласие на обработку персональных данных по </span>
            <button type="button" onClick={() => nav.go('/legal')} style={linkStyle}>политике</button>
          </div>
        </div>
      )}
    </Screen>
  );
}

const linkStyle = { display: 'inline', padding: 0, border: 0, background: 'none', font: 'inherit', color: 'var(--lb-ink)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' } as const;
