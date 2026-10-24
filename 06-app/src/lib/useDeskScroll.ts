import { useMemo } from 'react';

export type DeskRef<T> = ((el: T | null) => (() => void) | undefined) & { current: T | null };

/**
 * Горизонтальная лента на ПК (Telegram Desktop): мышью можно тянуть, колесо листает её вбок.
 * На телефоне ничего не меняется — лента листается пальцем. Трекпад с прокруткой вбок работает как обычно.
 *
 * `paged` — для каруселей со слайдом на всю ширину (баннеры, фото товара): после перетаскивания
 * лента доезжает до соседнего слайда, а не возвращается к прежнему; вертикальное колесо не перехватывается,
 * чтобы над крупным баннером продолжала прокручиваться страница.
 */
export function useDeskScroll<T extends HTMLElement>({ paged = false }: { paged?: boolean } = {}): DeskRef<T> {
  // Ref-функция: подключается, когда бы лента ни появилась (баннеры приходят после загрузки), `.current` — сам элемент.
  return useMemo(() => {
    const ref = ((el: T | null) => {
      ref.current = el;
      if (!el) return;
      const off = attach(el, paged);
      return () => { off(); ref.current = null; };
    }) as DeskRef<T>;
    ref.current = null;
    return ref;
  }, [paged]);
}

function attach(el: HTMLElement, paged: boolean) {
  const onWheel = (e: WheelEvent) => {
    if (paged || e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const max = el.scrollWidth - el.clientWidth;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    // На краю ленты колесо снова прокручивает страницу.
    if (max <= 0 || (dy < 0 && el.scrollLeft <= 0) || (dy > 0 && el.scrollLeft >= max - 1)) return;
    e.preventDefault();
    el.scrollLeft += dy;
  };

  // Точки остановки слайдов — от левого края первого.
  const stops = () => {
    const kids = Array.from(el.children) as HTMLElement[];
    const base = kids[0]?.offsetLeft ?? 0;
    const max = el.scrollWidth - el.clientWidth;
    return kids.map((k) => Math.min(max, k.offsetLeft - base));
  };
  const nearest = (xs: number[], x: number) => xs.reduce((best, v, i) => (Math.abs(v - x) < Math.abs(xs[best] - x) ? i : best), 0);

  // Привязку к слайдам возвращаем, только когда лента доехала: иначе браузер дёрнет её к ближайшему слайду на полпути.
  let snap: string | null = null;
  let target: number | null = null;
  let restore = 0;
  const restoreSnap = () => {
    clearTimeout(restore);
    el.removeEventListener('scrollend', onEnd);
    if (snap !== null) el.style.scrollSnapType = snap;
    snap = null;
    target = null;
  };
  const onEnd = () => {
    if (target === null || Math.abs(el.scrollLeft - target) < 2) restoreSnap();
  };

  let drag: { x: number; left: number; moved: boolean } | null = null;
  let swallowClick = false;
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    restoreSnap();
    drag = { x: e.clientX, left: el.scrollLeft, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      snap ??= el.style.scrollSnapType;
      el.style.scrollSnapType = 'none';
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = drag.left - dx;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    el.style.cursor = '';
    el.style.userSelect = '';
    // Отпускание после перетаскивания — не нажатие на плитку.
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (!paged) { restoreSnap(); return; }
    // Сдвиг дальше 40 px — переход к соседнему слайду в сторону жеста.
    const xs = stops();
    const from = nearest(xs, d.left);
    const dx = e.clientX - d.x;
    const to = Math.max(0, Math.min(xs.length - 1, Math.abs(dx) > 40 ? from + (dx < 0 ? 1 : -1) : from));
    target = xs[to];
    el.addEventListener('scrollend', onEnd);
    restore = window.setTimeout(restoreSnap, 900);
    el.scrollTo({ left: target, behavior: 'smooth' });
  };
  const onClick = (e: MouseEvent) => {
    if (swallowClick) { e.preventDefault(); e.stopPropagation(); }
  };

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('click', onClick, true);
  return () => {
    clearTimeout(restore);
    el.removeEventListener('scrollend', onEnd);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('click', onClick, true);
  };
}
