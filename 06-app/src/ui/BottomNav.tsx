import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { reducedMotion } from '../lib/motion';
import { useNav } from '../nav/useNav';
import { TAB_PATHS } from '../nav/routes';
import { cartCount, useApp } from '../store/app';
import { haptic } from '../telegram/tma';
import { IconCart, IconCatalog, IconLinkOrder, IconProfile } from './navIcons';

const LABELS = ['Каталог', 'Корзина', 'Заказ по ссылке', 'Профиль'];
/** Подписи под иконками (вариант А, 2026-10-10): «Заказ по ссылке» не помещается в колонку на 320 px. */
const SHORT = ['Каталог', 'Корзина', 'По ссылке', 'Профиль'];

/**
 * Нижняя навигация: белое «стекло», под активным разделом лаймовая подложка.
 * Подложка переезжает за 420 мс и на ходу чуть растягивается (как в Flow v12).
 * Иконка с подписью, размеры — как у панели админки (кнопка 54 px, подпись 11 px): высота панели 68 px.
 */
export function BottomNav({ active, badgeRef }: { active: number; badgeRef: React.RefObject<HTMLSpanElement | null> }) {
  const nav = useNav();
  const cart = useApp((s) => s.cart);
  const count = cartCount(cart);
  const prev = useRef(active);
  const [stretch, setStretch] = useState<{ s: number; phase: 'out' | 'back' }>({ s: 1, phase: 'back' });

  useEffect(() => {
    if (prev.current === active) return;
    const dist = Math.abs(active - prev.current);
    prev.current = active;
    if (reducedMotion()) return;
    setStretch({ s: 1 + Math.min(dist / 3, 1) * 0.13, phase: 'out' });
    const id = window.setTimeout(() => setStretch({ s: 1, phase: 'back' }), 175);
    return () => window.clearTimeout(id);
  }, [active]);

  const red = reducedMotion();
  const pill: CSSProperties = {
    position: 'absolute', top: 0, left: `calc(${active * 25}% + (25% - 64px) / 2)`,
    width: 64, height: 54, zIndex: 0, pointerEvents: 'none', borderRadius: 19,
    background: 'var(--lb-glass-lime)',
    boxShadow: 'inset 0 0 0 1px var(--lb-white-a60), inset 1.8px 3px 0 -2px var(--lb-white-a92), inset 0 3px 4px -2px var(--lb-ink-a14), 0 1px 4px var(--lb-ink-a10), 0 5px 14px -4px var(--lb-ink-a18)',
    transform: `scaleX(${stretch.s})`,
    transition: red
      ? 'left 130ms linear'
      : `left 420ms cubic-bezier(1,0,0.4,1), transform ${stretch.phase === 'out' ? '170ms cubic-bezier(.2,.85,.3,1)' : '300ms cubic-bezier(.25,.9,.3,1)'}`,
  };

  const btn = (i: number): CSSProperties => ({
    width: 64, height: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', zIndex: 1,
    border: 0, padding: 0, borderRadius: 19, font: 'inherit', cursor: 'pointer', background: 'transparent', color: 'var(--lb-ink)',
    ['--nav-behind' as string]: active === i ? 'var(--lime)' : 'var(--lb-white)',
    transition: 'transform 140ms cubic-bezier(.23,1,.32,1)',
  });

  const icons = [<IconCatalog />, <IconCart />, <IconLinkOrder />, <IconProfile />];

  return (
    <nav aria-label="Разделы" style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(16px + var(--safe-bottom))', zIndex: 3, background: 'var(--nav-bg)', border: '1px solid var(--lb-white-a72)', borderRadius: 26, boxShadow: '0 14px 30px -12px var(--lb-ink-a40), 0 2px 6px var(--lb-ink-a10), inset 0 1px 0 var(--lb-white-a92)', backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', padding: 6 }}>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'center', justifyItems: 'center' }}>
        <div aria-hidden style={pill} data-anim="nav-pill" />
        {icons.map((ic, i) => (
          <button key={i} type="button" className="pressable-xs"
            aria-label={i === 1 ? `Корзина, ${count} шт` : LABELS[i]}
            aria-current={active === i ? 'page' : undefined}
            onClick={() => { if (active === i) return; haptic.select(); nav.root(TAB_PATHS[i]); }}
            style={btn(i)}>
            <span style={{ position: 'relative', display: 'flex' }}>
              {ic}
              {i === 1 && count > 0 && (
                <span ref={badgeRef} data-anim="cart-badge" style={{ position: 'absolute', top: -7, right: -11, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: 'var(--lb-ink-2)', color: 'var(--lb-white)', fontSize: 10, fontWeight: 700, lineHeight: '17px', textAlign: 'center', boxShadow: '0 0 0 2px var(--nav-behind)' }}>{count}</span>
              )}
            </span>
            <span aria-hidden style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{SHORT[i]}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
