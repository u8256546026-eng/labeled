import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ani } from '../lib/motion';
import { Btn, type BtnKind } from './Btn';

export type SheetBtn = { label: string; kind?: BtnKind; dis?: boolean; on?: () => void; /** не закрывать лист после нажатия */ stay?: boolean };
export type SheetSpec = {
  /** Над заголовком — например, значок успеха. */
  top?: ReactNode;
  title: string;
  text?: string;
  quote?: string;
  body?: ReactNode;
  btns: SheetBtn[];
};

type SheetApi = { open: (s: SheetSpec) => void; close: () => void; isOpen: boolean };
const SheetContext = createContext<SheetApi>({ open: () => {}, close: () => {}, isOpen: false });
export const useSheet = () => useContext(SheetContext);

/** Лист снизу: затемнение 200 мс, лист выезжает за 280 мс. Закрытие — быстрее, с ease-in. */
export function SheetProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<SheetSpec | null>(null);
  const [closing, setClosing] = useState(false);

  const open = useCallback((s: SheetSpec) => { setClosing(false); setSpec(s); }, []);
  const close = useCallback(() => setClosing(true), []);

  return (
    <SheetContext.Provider value={{ open, close, isOpen: !!spec && !closing }}>
      {children}
      {spec && <SheetView spec={spec} closing={closing} onClose={close} onGone={() => { setSpec(null); setClosing(false); }} />}
    </SheetContext.Provider>
  );
}

function SheetView({ spec, closing, onClose, onGone }: { spec: SheetSpec; closing: boolean; onClose: () => void; onGone: () => void }) {
  const overlay = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  // Фокус: при открытии — в лист (диктор зачитывает заголовок), Tab не уходит под затемнение,
  // Esc закрывает, после закрытия фокус возвращается на кнопку, которая открыла лист.
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null;
    sheet.current?.focus({ preventScroll: true });
    return () => { if (from && from.isConnected) from.focus({ preventScroll: true }); };
  }, []);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !sheet.current) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === sheet.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  };
  useEffect(() => {
    if (!closing) return;
    ani(overlay.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    const a = ani(sheet.current, [{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    const id = window.setTimeout(onGone, a ? 200 : 0);
    return () => window.clearTimeout(id);
  }, [closing, onGone]);

  return (
    <div ref={overlay} data-anim="fade" onKeyDown={onKeyDown} style={{ position: 'absolute', inset: 0, zIndex: 6, background: 'var(--lb-ink-a40)', display: 'flex', alignItems: 'flex-end', animation: 'lbFade 200ms ease-out both' }}>
      <button type="button" aria-label="Закрыть" tabIndex={-1} onClick={onClose} style={{ position: 'absolute', inset: 0, border: 0, background: 'transparent', cursor: 'default' }} />
      <div ref={sheet} role="dialog" aria-modal="true" aria-label={spec.title} data-anim="sheet" tabIndex={-1}
        style={{ position: 'relative', outline: 'none', width: '100%', maxHeight: '88%', overflowY: 'auto', overscrollBehavior: 'none', background: 'var(--lb-white)', borderRadius: '24px 24px 0 0', padding: '20px var(--px) calc(24px + var(--safe-bottom))', boxShadow: '0 -18px 40px -20px var(--lb-ink-a55)', animation: 'lbSheetUp 280ms cubic-bezier(.32,.72,0,1) both' }}>
        <div aria-hidden style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--lb-n-200)', margin: '-6px auto 14px' }} />
        {spec.top}
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.03em', textWrap: 'pretty' }}>{spec.title}</h2>
        {spec.text && <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.45, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{spec.text}</div>}
        {spec.quote && <div style={{ marginTop: 12, padding: 12, borderRadius: 15, background: 'var(--lb-n-150)', fontSize: 12.5, lineHeight: 1.45, textWrap: 'pretty' }}>{spec.quote}</div>}
        {spec.body}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {spec.btns.map((b, i) => (
            <Btn key={i} kind={b.kind} dis={b.dis} onClick={() => { b.on?.(); if (!b.stay) onClose(); }}>{b.label}</Btn>
          ))}
        </div>
      </div>
    </div>
  );
}
