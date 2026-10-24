// Анимации из README: появление 140–280 мс с ease-out, исчезновение быстрее с ease-in, без пружин.
// При prefers-reduced-motion остаётся только смена прозрачности.

export const EASE_OUT = 'cubic-bezier(.23,1,.32,1)';

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function ani(el: Element | null | undefined, frames: Keyframe[], opt?: KeyframeAnimationOptions): Animation | null {
  if (!el || !(el as HTMLElement).animate) return null;
  const fr = reducedMotion() ? frames.map((f) => ({ opacity: f.opacity == null ? 1 : f.opacity })) : frames;
  return (el as HTMLElement).animate(fr, { duration: 200, easing: EASE_OUT, ...opt });
}

/** Чипс фильтра: сжатие до 0.85 с исчезновением за 140 мс, потом действие. */
export function chipOut(el: Element | null, then: () => void) {
  const a = ani(el, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' });
  if (!a) return then();
  setTimeout(() => { then(); requestAnimationFrame(() => a.cancel()); }, 140);
}

/** Счётчик корзины: 1 → 1.35 → 1 за 320 мс. */
export function bump(el: Element | null, scale = 1.35, duration = 320) {
  ani(el, [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration });
}
