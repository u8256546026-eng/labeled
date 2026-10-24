import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ShowBanner } from '../../domain/types';
import { asset } from '../../mocks/images';
import { RATES } from '../../mocks/link';
import { numNbsp } from '../../lib/format';
import { sized } from '../../lib/img';
import { useDeskScroll } from '../../lib/useDeskScroll';

/**
 * Баннеры главной (7a) в порядке из админки. Три нарисованных баннера labeled остаются отдельными блоками —
 * их дизайн можно заменить, не задевая остальной экран. Баннер с картинкой (adm32) — заголовок и кнопка поверх фото.
 */
export function Banners({ banners, onOpen }: { banners: ShowBanner[]; onOpen: (b: ShowBanner) => void }) {
  // На ПК баннеры тянут мышью — как свайп пальцем.
  const rail = useDeskScroll<HTMLDivElement>({ paged: true });
  const [idx, setIdx] = useState(0);
  const n = banners.length;

  const step = () => {
    const el = rail.current;
    const first = el?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + 12 : 1;
  };
  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / step())));
    if (i !== idx) setIdx(i);
  };
  const goTo = (i: number) => {
    rail.current?.scrollTo({ left: i * step(), behavior: 'smooth' });
    setIdx(i);
  };
  if (!n) return null;

  return (
    <div style={{ padding: '16px 0 0' }}>
      <div ref={rail} data-hs onScroll={onScroll} aria-roledescription="карусель"
        style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 var(--px)', scrollSnapType: 'x mandatory', scrollPaddingLeft: 'var(--px)' }}>
        {banners.map((b) => <OneBanner key={b.id} b={b} onClick={() => onOpen(b)} />)}
      </div>
      {n > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0 0' }}>
          {/* Точка 6 px, зона нажатия вокруг неё — не меньше 22 × 30 px (листают баннеры в основном свайпом). */}
          {banners.map((b, i) => (
            <button key={b.id} type="button" aria-label={`Баннер ${i + 1} из ${n}`} aria-current={idx === i} onClick={() => goTo(i)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 30, padding: '0 2px', border: 0, background: 'none', cursor: 'pointer' }}>
              <span aria-hidden style={{ display: 'block', width: idx === i ? 18 : 6, height: 6, borderRadius: 999, background: idx === i ? 'var(--lb-ink)' : 'var(--lb-ink-a18)', transition: 'width 200ms cubic-bezier(.23,1,.32,1), background 200ms ease' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OneBanner({ b, onClick }: { b: ShowBanner; onClick: () => void }) {
  if (b.img) return <PhotoBanner b={b} onClick={onClick} />;
  if (b.target === 'link') return (
    <Banner bg="var(--lb-lime-deep)" onClick={onClick} textW="var(--ban1-textw)"
      art={<div role="img" aria-label="Посылка labeled с лаймовой лентой и биркой" style={{ position: 'absolute', inset: 0, backgroundImage: `url(${asset('banner-import-lime-v4.webp')})`, backgroundSize: 'var(--p-size)', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }} />}
      title="Заказать из-за границы" lines={['Доставка от 18 дней', `Комиссия ${RATES.commission.map((t) => numNbsp(String(t.value))).join(' / ')}\u00a0₽ за штуку — зависит от цены`]} cta="Оформить заказ" />
  );
  if (b.target === 'email') return (
    <Banner bg="var(--lb-n-150)" border onClick={onClick} textW="var(--ban23-textw)" art={<TicketArt />}
      title="−50% на комиссию первого заказа" lines={['После подтверждения почты', 'Скидка на комиссию, не на цену вещи']} cta="Подробнее" />
  );
  if (b.target === 'invite') return (
    <Banner bg="var(--lime)" onClick={onClick} textW="var(--ban23-textw)" art={<CardsArt />}
      title="250 баллов за друга" lines={['Один раз — после первого заказа друга', '1 балл = 1 ₽']} cta="Пригласить друга" />
  );
  return <Banner bg="var(--lb-n-150)" border onClick={onClick} textW="var(--ban23-textw)" art={null} title={b.title} lines={[]} cta={b.cta} />;
}

/**
 * Баннер из админки: картинка 1080 × 600 на всю плашку, затемнение слева для читаемости,
 * заголовок и лаймовая кнопка. Композиция — как у нарисованных баннеров; дизайн этого варианта не утверждён.
 */
/**
 * Затемнение баннера с фото: плотнее сверху слева, под заголовком, и сходит на нет к правому нижнему углу.
 * Белый заголовок до 40 знаков (3 строки) — контраст не ниже 4.5:1 даже на сплошь белой картинке
 * (проверка: scripts/check-banner-contrast.mjs). Кнопка лаймовая с тёмным текстом — от фото не зависит.
 */
const PHOTO_SCRIM = 'radial-gradient(ellipse 115% 95% at 0% 0%, rgba(11,11,11,.8) 0%, rgba(11,11,11,.7) 50%, rgba(11,11,11,.62) 68%, rgba(11,11,11,.45) 80%, rgba(11,11,11,.24) 90%, rgba(11,11,11,.08) 96%, rgba(11,11,11,0) 100%)';

function PhotoBanner({ b, onClick }: { b: ShowBanner; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="pressable"
      style={{ flex: '0 0 100%', minWidth: 0, minHeight: 'var(--ban-h)', scrollSnapAlign: 'start', textAlign: 'left', border: 0, borderRadius: 'var(--ban-r)', padding: 'var(--ban-pad)', position: 'relative', overflow: 'hidden', cursor: 'pointer', font: 'inherit', color: 'var(--lb-white)', backgroundColor: 'var(--lb-ink-2)', backgroundImage: `${PHOTO_SCRIM}, url(${sized(b.img, 960)})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ position: 'relative', maxWidth: 'var(--ban23-textw)', fontSize: 'var(--f-ban-title)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.07, textWrap: 'balance' }}>{b.title}</div>
      <div style={{ position: 'relative', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: 44, marginTop: 12, padding: '0 20px', borderRadius: 999, background: 'var(--lime)', color: 'var(--lb-ink)', fontSize: 'var(--f-cta)', fontWeight: 600, letterSpacing: '-0.01em' }}>{b.cta}</div>
    </button>
  );
}

function Banner({ bg, border, onClick, textW, art, title, lines, cta }: { bg: string; border?: boolean; onClick: () => void; textW: string; art: ReactNode; title: string; lines: string[]; cta: string }) {
  const s: CSSProperties = {
    flex: '0 0 100%', minWidth: 0, minHeight: 'var(--ban-h)', scrollSnapAlign: 'start', textAlign: 'left',
    background: bg, border: border ? '1px solid var(--lb-ink-a08)' : 0, borderRadius: 'var(--ban-r)', padding: 'var(--ban-pad)',
    position: 'relative', overflow: 'hidden', cursor: 'pointer', color: 'var(--lb-ink)', font: 'inherit',
  };
  return (
    <button type="button" onClick={onClick} className="pressable" style={s}>
      {art}
      <div style={{ position: 'relative', maxWidth: textW }}>
        <div style={{ fontSize: 'var(--f-ban-title)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.07 }}>{title}</div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lines.map((l) => <div key={l} style={{ fontSize: 'var(--f-cond)', lineHeight: 1.34, color: 'var(--lb-ink-2)' }}>{l}</div>)}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', height: 44, marginTop: 12, padding: '0 20px', borderRadius: 999, background: 'var(--lb-ink-2)', color: 'var(--lb-white)', fontSize: 'var(--f-cta)', fontWeight: 600, letterSpacing: '-0.01em' }}>{cta}</div>
      </div>
    </button>
  );
}

const Shadow = ({ id }: { id: string }) => (
  <defs><radialGradient id={id}><stop offset="0.35" stopColor="#000" stopOpacity="0.3" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
);

function TicketArt() {
  return (
    <div aria-hidden style={{ position: 'absolute', right: -2, bottom: 8, color: 'var(--lime)' }}>
      <svg viewBox="0 0 120 120" style={{ width: 'var(--v-size)', height: 'var(--v-size)', display: 'block' }}>
        <Shadow id="lbShTicket" />
        <ellipse cx="60" cy="100" rx="38" ry="8" fill="url(#lbShTicket)" />
        <g transform="rotate(-9 60 62)">
          <rect x="15" y="43" width="90" height="43" rx="10" fill="#000" opacity="0.2" />
          <rect x="15" y="37" width="90" height="43" rx="10" fill="currentColor" />
          <rect x="15" y="37" width="90" height="15" rx="10" fill="#fff" opacity="0.16" />
          <circle cx="15" cy="58" r="6.5" fill="#E8E8E5" />
          <circle cx="105" cy="58" r="6.5" fill="#E8E8E5" />
          <path d="M79 41.5v34" stroke="#E8E8E5" strokeWidth="1.8" strokeDasharray="4 4.5" strokeLinecap="round" />
          <text x="48" y="66" textAnchor="middle" fill="#111111" style={{ fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>−50%</text>
        </g>
      </svg>
    </div>
  );
}

function CardsArt() {
  return (
    <div aria-hidden style={{ position: 'absolute', right: -2, bottom: 8, color: 'var(--lb-ink)' }}>
      <svg viewBox="0 0 120 120" style={{ width: 'var(--v-size)', height: 'var(--v-size)', display: 'block' }}>
        <Shadow id="lbShCards" />
        <ellipse cx="60" cy="101" rx="36" ry="8" fill="url(#lbShCards)" />
        <g transform="rotate(12 78 62)">
          <path d="M70 38h20a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H62a7 7 0 0 1-7-7V53Z" fill="#000" opacity="0.22" />
          <path d="M70 32h20a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H62a7 7 0 0 1-7-7V47Z" fill="#FFFFFF" />
          <path d="M70 32 55 47h15Z" fill="#000" opacity="0.1" />
          <circle cx="66" cy="43" r="3.4" fill="#000" opacity="0.3" />
          <path d="M62 60h26M62 68h18" stroke="#000" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g transform="rotate(-13 40 60)">
          <path d="M38 36h20a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H30a7 7 0 0 1-7-7V51Z" fill="#000" opacity="0.24" />
          <path d="M38 30h20a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H30a7 7 0 0 1-7-7V45Z" fill="currentColor" />
          <path d="M38 30 23 45h15Z" fill="#000" opacity="0.13" />
          <circle cx="34" cy="41" r="3.4" fill="var(--lime)" />
          <text x="45" y="66" textAnchor="middle" fill="var(--lime)" style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em' }}>250</text>
        </g>
      </svg>
    </div>
  );
}
