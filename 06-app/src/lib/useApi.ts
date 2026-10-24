import { useCallback, useEffect, useRef, useState } from 'react';
import { useChanges } from '../api/changes';

export type ApiState<T> = { data: T | undefined; loading: boolean; error: unknown; reload: () => void };

/** Последние ответы по ключу: при возврате на экран данные видны сразу, и прокрутка восстанавливается точно. */
const cache = new Map<string, unknown>();

/**
 * Запрос к API-слою. Пока идёт перезагрузка, прежние данные остаются на экране.
 * cacheKey — показать сохранённый ответ сразу и обновить его в фоне.
 * live — перечитывать по сигналу «заказы изменились» (api/changes.ts): тихо, без загрузки и без ошибки на экране.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[], cacheKey?: string, opts?: { live?: boolean }): ApiState<T> {
  const [data, setData] = useState<T | undefined>(() => (cacheKey ? (cache.get(cacheKey) as T | undefined) : undefined));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  const changed = useChanges();
  const rev = opts?.live ? changed : 0;
  const lastRev = useRef(rev);

  useEffect(() => {
    const my = ++seq.current;
    const quiet = rev !== lastRev.current;
    lastRev.current = rev;
    if (!quiet) {
      if (cacheKey && cache.has(cacheKey)) setData(cache.get(cacheKey) as T);
      setLoading(true);
      setError(null);
    }
    fn().then(
      (d) => { if (my === seq.current) { if (cacheKey) cache.set(cacheKey, d); setData(d); setError(null); setLoading(false); } },
      (e) => { if (my === seq.current) { if (!quiet) setError(e); setLoading(false); } },
    );
  }, [...deps, tick, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
