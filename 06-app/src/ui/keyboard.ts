import { useEffect, useState } from 'react';

/** Клавиатура открыта, пока в фокусе поле ввода: прячем нижнюю навигацию (кадр F). */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type)));
    let t: number | undefined;
    const onIn = (e: FocusEvent) => { if (isField(e.target)) { window.clearTimeout(t); setOpen(true); } };
    const onOut = (e: FocusEvent) => { if (isField(e.target)) t = window.setTimeout(() => setOpen(false), 80); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); window.clearTimeout(t); };
  }, []);
  return open;
}
