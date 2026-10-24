import { useCallback, useEffect, useRef, useState } from 'react';
import { useChanges } from '../api/changes';
import { errorText, live } from '../api/client';
import { useToast } from '../ui/Toast';

/**
 * Действие с запросом: кнопка выключена, пока ждём ответ; при ошибке — тост («Нет соединения»,
 * «Нет прав на это действие», объяснение сервера или «Не получилось сохранить»), состояние экрана не меняется.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(<T,>(p: () => Promise<T>, ok?: string | ((r: T) => void)) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    p().then(
      (r) => { if (typeof ok === 'string') toast(ok); else ok?.(r); },
      (e) => toast(errorText(e, 'Не получилось сохранить'), 'error'),
    ).finally(() => { lock.current = false; setBusy(false); });
  }, [toast]);
  return { busy, run };
}

/** Файл → адрес для предпросмотра. В продукте файл уходит на сервер, а приходит постоянная ссылка. */
export const previewOf = (f: File) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined);

/**
 * Загрузка раздела админки с сервера при открытии экрана. На моках данные уже в adminDb — сразу готово.
 * deps — когда перезагружать (номер заказа, период сводки). live — перечитывать по сигналу «заказы изменились»
 * (api/changes.ts); неудачное фоновое обновление оставляет экран как есть.
 */
export function useLoad(fn: () => Promise<unknown>, deps: unknown[], opts?: { live?: boolean }) {
  const [st, setSt] = useState<'ready' | 'loading' | 'error'>(live() ? 'loading' : 'ready');
  const [tick, setTick] = useState(0);
  const changed = useChanges();
  const rev = opts?.live ? changed : 0;
  const lastRev = useRef(rev);
  useEffect(() => {
    if (!live()) return;
    let on = true;
    const quiet = rev !== lastRev.current;
    lastRev.current = rev;
    setSt((x) => (x === 'ready' ? 'ready' : 'loading'));
    fn().then(() => { if (on) setSt('ready'); }, () => { if (on) setSt((x) => (quiet && x === 'ready' ? 'ready' : 'error')); });
    return () => { on = false; };
  }, [...deps, tick, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ready: st === 'ready', error: st === 'error', reload: () => setTick((t) => t + 1) };
}
