import { AlertCircle, Check } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ani } from '../lib/motion';
import { barBottom, useShell } from './shellContext';

/** ok — действие выполнено (галочка), error — не получилось (знак ошибки, дольше на экране). */
export type ToastTone = 'ok' | 'error';
type ToastFn = (text: string, tone?: ToastTone) => void;
const ToastContext = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastContext);

type T = { text: string; tone: ToastTone; k: number; out: boolean };

/** Сколько тост на экране: подтверждение читается сразу, ошибку с объяснением — дольше. */
const SHOW_MS: Record<ToastTone, number> = { ok: 1800, error: 4000 };

/**
 * Тост: тёмная пилюля над нижней навигацией. Появление 200 мс, показ 1,8 с (ошибка — 4 с), исчезновение 160 мс.
 * Область объявлений для экранного диктора живёт постоянно — иначе текст, появившийся вместе с ней, не зачитывается.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const k = useRef(0);

  const toast = useCallback<ToastFn>((text, tone = 'ok') => {
    k.current += 1;
    const key = k.current;
    setT({ text, tone, k: key, out: false });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT((cur) => (cur && cur.k === key ? { ...cur, out: true } : cur)), SHOW_MS[tone]);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastHost t={t} onGone={(key) => setT((cur) => (cur && cur.k === key ? null : cur))} />
    </ToastContext.Provider>
  );
}

function ToastHost({ t, onGone }: { t: T | null; onGone: (k: number) => void }) {
  const { showNav, barH } = useShell();
  const bottom = barH ? barBottom(showNav) + barH + 12 : showNav ? 112 : 32;
  return (
    <div role="status" aria-live="polite" aria-atomic="true"
      style={{ position: 'absolute', left: 'var(--px)', right: 'var(--px)', bottom: `calc(${bottom}px + var(--safe-bottom))`, zIndex: 7, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      {t && <ToastView key={t.k} text={t.text} tone={t.tone} out={t.out} onGone={() => onGone(t.k)} />}
    </div>
  );
}

function ToastView({ text, tone, out, onGone }: { text: string; tone: ToastTone; out: boolean; onGone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!out) return;
    const a = ani(ref.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    const id = window.setTimeout(onGone, a ? 160 : 0);
    return () => window.clearTimeout(id);
  }, [out, onGone]);
  const err = tone === 'error';
  return (
    <div ref={ref} data-anim="toast" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%', minHeight: 40, padding: '9px 16px 9px 12px', borderRadius: 20, background: 'var(--lb-ink-2)', color: 'var(--lb-white)', fontSize: 13, fontWeight: 600, lineHeight: 1.35, textWrap: 'pretty', boxShadow: '0 12px 28px -14px var(--lb-black-a55)', animation: 'lbToastIn 200ms cubic-bezier(.23,1,.32,1) both' }}>
      {err
        ? <AlertCircle size={16} strokeWidth={2.4} color="var(--lb-danger-on-dark)" style={{ flex: 'none' }} aria-hidden />
        : <Check size={16} strokeWidth={2.6} color="var(--lime)" style={{ flex: 'none' }} aria-hidden />}
      <span>{err && <span className="sr-only">Ошибка: </span>}{text}</span>
    </div>
  );
}
