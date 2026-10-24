import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { barBottom, useShell } from './shellContext';
import { Btn, type BtnSpec } from './Btn';

export type BarSpec = { btns: BtnSpec[]; total?: string; totalLabel?: string };

/** Закреплённая нижняя панель с CTA (barWrap в Buyer v15): над навигацией или у края экрана. */
export function BottomBar({ bar }: { bar: BarSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  const { showNav, setBarH } = useShell();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight));
    ro.observe(el);
    setBarH(el.offsetHeight);
    return () => { ro.disconnect(); setBarH(0); };
  }, [setBarH]);

  const tight = !!bar.total && bar.btns.length > 1;
  return (
    <div ref={ref} style={{ position: 'absolute', left: 12, right: 12, bottom: `calc(${barBottom(showNav)}px + var(--safe-bottom))`, zIndex: 4, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--lb-white)', borderRadius: 24, padding: 8, boxShadow: '0 14px 30px -12px var(--lb-ink-a28), 0 2px 6px var(--lb-ink-a08), inset 0 0 0 1px var(--lb-ink-a06)' }}>
      {bar.total && (
        <div style={{ flex: '0 0 auto', minWidth: 86, paddingLeft: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--lb-ink-2)', whiteSpace: 'nowrap' }}>{bar.totalLabel ?? 'Итого'}</div>
          <div style={{ marginTop: 2, fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, whiteSpace: 'nowrap' }}>{bar.total}</div>
        </div>
      )}
      {bar.btns.map((b, i) => {
        const s: CSSProperties = tight
          ? { borderRadius: 999, minHeight: 48, flex: '0 1 auto', minWidth: 0, padding: '0 13px', whiteSpace: 'nowrap', fontSize: 13.5 }
          : { borderRadius: 999, minHeight: 48, flex: '1 1 0', minWidth: 0 };
        return <Btn key={i} kind={b.kind} dis={b.dis} onClick={b.on} style={s}>{b.label}</Btn>;
      })}
    </div>
  );
}
