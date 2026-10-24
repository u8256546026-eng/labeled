import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNav } from '../nav/useNav';
import { runBackGuards } from '../nav/backGuard';
import { hasNativeBack } from '../telegram/tma';

export type HdrBtn = { label: string; on: () => void; icon?: ReactNode };
export type HeaderTab = { key: string; label: string };

/**
 * Лаймовая шапка экрана (hdrWrap в Buyer v15). Строка «‹ Назад» показывается только вне Telegram —
 * в Telegram её заменяет нативная BackButton.
 */
export function Header({ title, sub, btn, tabs, tab, onTab, children }: { title: string; sub?: string; btn?: HdrBtn; tabs?: HeaderTab[]; tab?: string; onTab?: (k: string) => void; children?: ReactNode }) {
  const nav = useNav();
  const backRow = !hasNativeBack() && nav.depth > 0;
  const inlineBtn = btn && !backRow;
  return (
    <div className="top-fill" style={{ background: 'var(--lime)', borderRadius: '0 0 22px 22px', padding: `calc(${backRow ? 6 : 18}px + var(--safe-top)) var(--px) ${tabs ? 14 : 17}px` }}>
      {backRow && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
          <button type="button" aria-label={'Назад: ' + nav.backLabel} onClick={() => { if (!runBackGuards()) nav.back(); }} className="pressable-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 0, padding: '0 6px 0 0', border: 0, background: 'none', fontSize: 'var(--f-small)', fontWeight: 600, color: 'var(--lb-ink)', cursor: 'pointer' }}>
            <ChevronLeft size={17} strokeWidth={2.4} style={{ flex: 'none' }} aria-hidden />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nav.backLabel}</span>
          </button>
          <div style={{ flex: 1 }} />
          {btn && <HeaderButton btn={btn} withIcon={false} />}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 'var(--f-h1)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--lb-ink)', textWrap: 'pretty' }}>{title}</h1>
        {inlineBtn && <HeaderButton btn={btn} withIcon />}
      </div>
      {sub && <div style={{ marginTop: 6, fontSize: 'var(--f-small)', lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>{sub}</div>}
      {children}
      {tabs && (
        <div role="tablist" style={{ display: 'flex', gap: 4, marginTop: 12, padding: 4, background: 'var(--lb-white-a45)', borderRadius: 999 }}>
          {tabs.map((t) => {
            const on = t.key === tab;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onTab?.(t.key)} className="pressable"
                style={{ flex: '1 1 0', minHeight: 40, border: 0, borderRadius: 999, background: on ? 'var(--lb-white)' : 'transparent', color: 'var(--lb-ink)', fontSize: 13.5, fontWeight: on ? 700 : 500, cursor: 'pointer', boxShadow: on ? '0 1px 3px var(--lb-ink-a14)' : 'none', transition: 'background 170ms ease' }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HeaderButton({ btn, withIcon }: { btn: HdrBtn; withIcon: boolean }) {
  return (
    <button type="button" onClick={btn.on} className="pressable-sm"
      style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', border: 0, borderRadius: 999, background: 'var(--lb-ink-2)', color: 'var(--lb-white)', fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em', whiteSpace: 'nowrap', cursor: 'pointer' }}>
      {withIcon && btn.icon}
      <span>{btn.label}</span>
    </button>
  );
}
