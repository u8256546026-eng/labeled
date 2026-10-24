import { useRef, useState } from 'react';
import { copyText } from '../../lib/clipboard';
import { useNav } from '../../nav/useNav';
import { useApp } from '../../store/app';
import { appLink, haptic, shareLink } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Note, P } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';

/** AS — личная ссылка-приглашение через start_param, отправка в Telegram, условия награды. */
export function InviteScreen() {
  const nav = useNav();
  const toast = useToast();
  const me = useApp((s) => s.me);
  const email = useApp((s) => s.email);
  const [copied, setCopied] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const url = appLink('ref_' + me.id);
  const shown = url.replace(/^https:\/\//, '');
  const copy = () => copyText(url).then((ok) => {
    if (!ok) return;
    haptic.light(); setCopied(true); toast('Скопировано');
    window.clearTimeout(t.current); t.current = window.setTimeout(() => setCopied(false), 1800);
  });
  return (
    <Screen header={<Header title="Пригласить друга" />}>
      <P>250 баллов приходят один раз — после первого выполненного заказа друга, а не после перехода по ссылке или первого входа.</P>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lb-ink-2)' }}>Ваша ссылка</div>
          <div style={{ marginTop: 4, fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word' }}>{shown}</div>
        </div>
        <button type="button" aria-label="Скопировать: Ваша ссылка" onClick={copy} className="pressable-sm"
          style={{ flex: 'none', minHeight: 38, padding: '0 12px', border: 0, borderRadius: 12, background: copied ? 'var(--lime)' : 'var(--lb-n-150)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 160ms ease' }}>{copied ? 'Скопировано' : 'Копировать'}</button>
      </div>
      <Btns items={[
        { label: 'Отправить в Telegram', kind: 'primary', on: () => shareLink(url, 'Покупаю одежду в labeled. По этой ссылке скидка 50% на комиссию в первом заказе') },
        { label: 'Условия скидки первого заказа', kind: 'violet', on: () => nav.go('/points') },
      ]} />
      {email === 'ok'
        ? <Note tone="ok" title="Первый заказ" text="Почта подтверждена — скидка 50% на комиссию доступна в первом заказе." />
        : <Note tone="wait" title="Первый заказ" text="Скидка 50% на комиссию в первом заказе включается после привязки и подтверждения почты." act={{ label: 'Привязать почту', on: () => nav.go('/email') }} />}
    </Screen>
  );
}
