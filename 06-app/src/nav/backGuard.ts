import { useEffect } from 'react';

/** Перехват «назад»: экран может показать лист «Сохранить черновик?» вместо возврата. */
type Guard = () => boolean;
const guards: Guard[] = [];

export function runBackGuards(): boolean {
  for (let i = guards.length - 1; i >= 0; i--) if (guards[i]()) return true;
  return false;
}

export function useBackGuard(guard: Guard | null) {
  useEffect(() => {
    if (!guard) return;
    guards.push(guard);
    return () => { const i = guards.indexOf(guard); if (i >= 0) guards.splice(i, 1); };
  }, [guard]);
}
