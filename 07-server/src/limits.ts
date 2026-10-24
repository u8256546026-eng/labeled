import { HttpError } from './http';

/**
 * Ограничение частоты действий по ключу (обычно «действие:покупатель») в памяти процесса: сервер работает
 * одним процессом (служба labeled), общее хранилище не нужно. После перезапуска счётчики обнуляются.
 */
export type Limit = (key: string, max: number, windowMs: number) => void;

export function rateLimiter(now: () => number = Date.now): Limit {
  const hits = new Map<string, number[]>();
  let sweptAt = now();
  return (key, max, windowMs) => {
    const t = now();
    // Раз в час выбрасываем ключи без свежих событий, чтобы карта не росла без предела.
    if (t - sweptAt > 3600_000) {
      for (const [k, list] of hits) if (!list.length || list[list.length - 1] < t - 86400_000) hits.delete(k);
      sweptAt = t;
    }
    const list = (hits.get(key) ?? []).filter((x) => x > t - windowMs);
    if (list.length >= max) {
      hits.set(key, list);
      throw new HttpError(429, 'too_many', 'Слишком много запросов — попробуйте позже');
    }
    list.push(t);
    hits.set(key, list);
  };
}

const HOUR = 3600_000;

/** Пределы для покупателя: с запасом для живого человека, но без бесконечной загрузки файлов и заявок. */
export const LIMITS = {
  upload: [60, HOUR],
  order: [30, HOUR],
  draft: [120, HOUR],
  sizeRequest: [20, 24 * HOUR],
  email: [5, HOUR],
} as const satisfies Record<string, readonly [number, number]>;
