// Отправка на сервер изменений, которые экран уже показал: избранное, настройки уведомлений, черновики.
import { ApiError } from './client';

/** Паузы между повторами при сбое сети; дальше — при появлении сети или следующем изменении по тому же ключу. */
const DELAYS = [2_000, 10_000, 30_000, 120_000];

const pending = new Map<string, () => Promise<unknown>>();
const running = new Set<string>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Отправить изменение по ключу («fav:<id>», «draft:<id>», «notif»). По ключу идёт один запрос за раз и только
 * последнее состояние: быстрые «включить — выключить» не обгоняют друг друга. Нет сети или ошибка сервера —
 * повтор с паузой; отказ 4xx (кроме 429) не повторяется — сервер не примет то же изменение.
 */
export function syncLater(key: string, send: () => Promise<unknown>) {
  pending.set(key, send);
  void pump(key);
}

async function pump(key: string) {
  if (running.has(key)) return;
  running.add(key);
  try {
    let tries = 0;
    while (pending.has(key)) {
      const send = pending.get(key)!;
      pending.delete(key);
      try {
        await send();
        tries = 0;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'server' && e.status >= 400 && e.status < 500 && e.status !== 429) {
          console.warn('[sync] сервер отклонил изменение', key, e.message);
          continue;
        }
        if (!pending.has(key)) pending.set(key, send);
        if (tries >= DELAYS.length) break;
        await sleep(DELAYS[tries++]);
      }
    }
  } finally {
    running.delete(key);
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => { for (const k of [...pending.keys()]) void pump(k); });
