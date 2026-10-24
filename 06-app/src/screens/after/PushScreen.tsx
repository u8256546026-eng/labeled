import { useState } from 'react';
import { asset } from '../../mocks/images';
import { useNav } from '../../nav/useNav';
import { actions } from '../../store/app';
import { requestBotMessages } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Note, P } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

const PUSHES = [
  { when: 'сейчас', title: 'Можно оплатить доставку', body: 'Заказ 1042 · посылка 1 на складе в Китае', bg: 'var(--lb-white-a92)' },
  { when: '2 ч назад', title: 'Оплата подтверждена', body: 'Заказ 1041 · продавец сверил чек', bg: 'var(--lb-white-a80)' },
  { when: 'вчера', title: 'Передано в CDEK', body: 'Заказ 1038 · появился трек', bg: 'var(--lb-white-a60)' },
];

/**
 * AE — разрешение на уведомления. В Telegram системного окна push нет: «Включить» запрашивает
 * у Telegram право боту писать пользователю (requestWriteAccess).
 */
export function PushScreen() {
  const nav = useNav();
  const [st, setSt] = useState<'ask' | 'on' | 'denied'>('ask');
  const enable = async () => { const ok = await requestBotMessages(); actions.setNotif({ bot: ok }); setSt(ok ? 'on' : 'denied'); };
  const done = () => nav.root('/');
  if (st !== 'ask') {
    return (
      <Screen header={<Header title="Уведомления" />} bar={{ btns: [{ label: 'Продолжить', kind: 'primary', on: done }] }}>
        {st === 'on'
          ? <Note tone="ok" title="Уведомления включены" text="Каналы и типы событий можно изменить в настройках." />
          : <Note tone="wait" title="Уведомления выключены" text="Статусы заказов всё равно видны в «Событиях» в профиле. Включить сообщения от бота можно в настройках уведомлений." />}
        <Btns items={[{ label: 'Настроить уведомления', kind: 'limeSoft', on: () => nav.go('/notif') }]} />
      </Screen>
    );
  }
  return (
    <Screen bare bar={{ btns: [{ label: 'Не сейчас', kind: 'ghost', on: done }, { label: 'Включить', kind: 'primary', on: enable }] }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="top-fill" style={{ background: 'var(--lime)', borderRadius: '0 0 28px 28px', padding: 'calc(20px + var(--safe-top)) var(--px) 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div role="img" aria-label="labeled" style={{ width: 58, height: 26, marginBottom: 8, backgroundImage: `url(${asset('lbld-black.png')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }} />
          {PUSHES.map((p) => (
            <div key={p.title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 18, background: p.bg, boxShadow: '0 8px 20px -14px var(--lb-ink-a40), inset 0 0 0 1px var(--lb-ink-a06)' }}>
              <div aria-hidden style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: 'var(--lb-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 22, height: 10, backgroundImage: `url(${asset('lbld-black.png')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', filter: 'invert(1)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--lb-ink-2)' }}><span style={{ fontWeight: 600 }}>labeled</span><span>{p.when}</span></div>
                <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ marginTop: 1, fontSize: 12, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{p.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 var(--px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.08, textWrap: 'balance' }}>Не пропустите оплату и доставку</h1>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>Напишем, когда продавец подтвердит чек, посылка приедет на склад или появится трек. Только о ваших заказах, без рассылок.</div>
        </div>
        <div style={{ padding: '0 var(--px)' }}><P>Скидки и подборки приходят, только если включить их отдельно в настройках.</P></div>
      </div>
    </Screen>
  );
}
