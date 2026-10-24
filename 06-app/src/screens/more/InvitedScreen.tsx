import { useParams } from 'react-router-dom';
import { referralApi } from '../../api/content';
import { useApi } from '../../lib/useApi';
import { asset } from '../../mocks/images';
import { useNav } from '../../nav/useNav';
import { Screen } from '../../ui/Screen';

/** S — первый запуск по ссылке друга: кто пригласил, что получает каждый, вход или каталог. */
export function InvitedScreen() {
  const { ref = '' } = useParams();
  const nav = useNav();
  const q = useApi(() => referralApi.inviter(ref), [ref], 'ref:' + ref);
  const name = q.data?.name ?? 'Друг';
  const first = name.split(' ')[0];
  const perk = { display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 18, boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' } as const;
  return (
    <Screen bare bar={{ btns: [{ label: 'Каталог', kind: 'ghost', on: () => nav.root('/') }, { label: 'Войти через Telegram', kind: 'primary', on: () => nav.go('/auth?next=%2Fprofile') }] }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="top-fill" style={{ background: 'var(--lime)', borderRadius: '0 0 22px 22px', padding: 'calc(16px + var(--safe-top)) var(--px) 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div role="img" aria-label="labeled" style={{ width: 44, height: 20, flex: 'none', backgroundImage: `url(${asset('lbld-black.png')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name} · приглашение</div>
              <div aria-hidden style={{ width: 30, height: 30, flex: 'none', borderRadius: 999, background: 'var(--lb-ink)', color: 'var(--lb-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, boxShadow: '0 0 0 2px var(--lb-white)' }}>{first.charAt(0)}</div>
            </div>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--f-h1)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, textWrap: 'balance' }}>{first} {q.data ? 'пригласила вас в labeled' : 'приглашает вас в labeled'}</h1>
          <div style={{ fontSize: 'var(--f-small)', lineHeight: 1.45, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>Покупайте вещи из наличия или заказывайте с Poizon, Taobao и других площадок по ссылке.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, padding: '0 var(--px)' }}>
          <div style={{ ...perk, background: 'var(--lb-white)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1 }}>−50%</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>на комиссию</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>в вашем первом заказе</div>
          </div>
          <div style={{ ...perk, background: 'var(--lb-n-50)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1 }}>250 Б</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>получит {first}</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>когда ваш первый заказ выполнят</div>
          </div>
        </div>
        <div style={{ padding: '0 var(--px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--lb-ink-2)' }}>Как получить скидку</div>
          {['Войдите через Telegram', 'Привяжите и подтвердите почту', 'В первом заказе выберите «Скидка 50% на комиссию»'].map((t, i) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div aria-hidden style={{ width: 28, height: 28, flex: 'none', borderRadius: 9, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700 }}>{i + 1}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.35 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
