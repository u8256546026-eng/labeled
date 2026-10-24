import { useLocation } from 'react-router-dom';
import { asset, IMG } from '../../mocks/images';
import { useNav } from '../../nav/useNav';
import { Screen } from '../../ui/Screen';

const KEY = 'labeled.onboarded';
export const onboarded = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
export const markOnboarded = () => { try { localStorage.setItem(KEY, '1'); } catch { /* приватный режим */ } };

const PAGES = [
  { img: asset('cat-tshirt.webp'), t: 'Вещи в наличии', x: 'Уже лежат на складе в России. Оформляете как в обычном магазине: корзина, перевод, доставка CDEK.', r: ['Каждая вещь — конкретный экземпляр с состоянием: новое, как новое, чуть уставшее', 'Цена и состояние видны до оформления'] },
  { img: asset('banner-import-lime-v4.webp'), t: 'Заказ по ссылке', x: 'Пришлите ссылку с Poizon или Taobao. Продавец проверит цену и наличие, платите только после одобрения.', r: ['Расчёт по курсу и комиссия видны сразу', 'Доставка из Китая оплачивается отдельно, по каждой посылке', 'Статус виден на каждом этапе: Китай, в Россию, по России'] },
  { img: IMG.receipt.replace('w=200&h=200', 'w=700&h=500'), t: 'Оплата переводом', x: 'Переводите по реквизитам и прикладываете чек. Продавец сверяет поступление вручную — до этого статус «Оплата на проверке».', r: ['Реквизиты копируются в одно касание', 'Все чеки хранятся в «Платежах и чеках»'] },
];

/**
 * AD — знакомство с сервисом при первом запуске без приглашения. Можно пропустить.
 * Каждая страница — свой шаг истории (?p=2): «Назад» на экране и в Telegram возвращает на предыдущую.
 */
export function OnboardingScreen() {
  const nav = useNav();
  const k = Math.min(Math.max(Number(new URLSearchParams(useLocation().search).get('p') ?? 1) - 1, 0), PAGES.length - 1) || 0;
  const p = PAGES[k];
  const finish = () => { markOnboarded(); nav.go('/push'); };
  const next = () => nav.go('/onboarding?p=' + (k + 2));
  const last = k === PAGES.length - 1;
  return (
    <Screen bare bar={{ btns: [
      k === 0 ? { label: 'Пропустить', kind: 'ghost', on: finish } : { label: 'Назад', kind: 'ghost', on: nav.back },
      last ? { label: 'Начать', kind: 'primary', on: finish } : { label: 'Далее', kind: 'primary', on: next },
    ] }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 'calc(26px + var(--safe-top)) var(--px) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div role="img" aria-label="labeled" style={{ width: 58, height: 26, backgroundImage: `url(${asset('lbld-black.png')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--lb-ink-2)' }}>{k + 1} из 3</div>
            {k === 1 && <button type="button" onClick={finish} style={{ border: 0, background: 'none', padding: '6px 0', font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--lb-ink)', cursor: 'pointer' }}>Пропустить</button>}
          </div>
        </div>
        <div aria-hidden key={k} data-anim="fade" style={{ height: 250, borderRadius: 22, backgroundColor: k === 1 ? 'var(--lb-lime-deep)' : 'var(--lb-n-150)', backgroundImage: `url(${p.img})`, backgroundSize: k === 1 ? 'auto 90%' : k === 0 ? 'auto 92%' : 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a06)', animation: 'lbFade 200ms ease-out both' }} />
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{p.t}</h1>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{p.x}</div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {p.r.map((t) => <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span aria-hidden style={{ width: 8, height: 8, flex: 'none', marginTop: 6, borderRadius: 999, background: 'var(--lb-ink)' }} /><span style={{ fontSize: 13, lineHeight: 1.45, textWrap: 'pretty' }}>{t}</span></li>)}
        </ul>
        <div aria-hidden style={{ display: 'flex', gap: 6, justifyContent: 'center', paddingTop: 6 }}>
          {PAGES.map((_, i) => <div key={i} style={{ width: i === k ? 22 : 7, height: 7, borderRadius: 999, background: i === k ? 'var(--lb-ink)' : 'var(--lb-n-200)', transition: 'width 220ms cubic-bezier(.23,1,.32,1)' }} />)}
        </div>
      </div>
    </Screen>
  );
}
