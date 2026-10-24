// Живое обновление заказов: поток /api/live (07-server/src/live.ts). Сигнал «orders» — что-то изменилось
// в заказах, оплатах, заявках или обращениях; открытые экраны тихо перечитывают свои данные (useApi и useLoad
// с live). Без потока данные обновятся при возврате в приложение — тот же сигнал даёт visibilitychange.
import { createStore, useStore } from '../store/createStore';
import { appStore } from '../store/app';
import { live, openStream } from './client';
import { reloadMe, reloadPayments } from './session';

const changes = createStore({ rev: 0 });

/** Номер последнего изменения: добавляется в зависимости загрузки, чтобы экран перечитал данные. */
export const useChanges = () => useStore(changes, (s) => s.rev);

let refreshAt = 0;
/** Перечитать: платежи и баллы покупателя живут в общем состоянии, остальное — у экранов по номеру изменения. */
function bump() {
  refreshAt = Date.now();
  changes.set((s) => ({ rev: s.rev + 1 }));
  if (appStore.get().auth) { reloadPayments().catch(() => {}); reloadMe().catch(() => {}); }
}

let started = false;
let ctl: AbortController | null = null;
let retryMs = 2000;
let timer: ReturnType<typeof setTimeout> | undefined;

async function connect(catchUp: boolean) {
  ctl?.abort();
  const my = (ctl = new AbortController());
  clearTimeout(timer);
  try {
    const res = await openStream('/api/live', my.signal);
    // 401 — вход устарел, 404 — сервер без живого обновления: повтор не поможет, обновится при возврате в приложение.
    if (res.status === 401 || res.status === 403 || res.status === 404) return;
    if (!res.ok || !res.body) throw new Error('stream');
    if (catchUp) bump(); // пока потока не было, сигналы могли пройти мимо
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      retryMs = 2000;
      buf += dec.decode(value, { stream: true });
      const blocks = buf.split('\n\n');
      buf = blocks.pop() ?? '';
      if (blocks.some((b) => b.split('\n').some((l) => l.startsWith('data:')))) bump();
    }
  } catch { /* обрыв сети или abort */ }
  if (my !== ctl || my.signal.aborted || document.hidden) return;
  timer = setTimeout(() => void connect(true), retryMs);
  retryMs = Math.min(retryMs * 2, 30_000);
}

/** Запустить после входа (hydrate). Повторный вызов ничего не делает. */
export function startChanges() {
  if (!live() || started || typeof document === 'undefined') return;
  started = true;
  void connect(false);
  // Свёрнутое приложение не держит соединение; при возврате — сразу свежие данные и новый поток.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ctl?.abort(); clearTimeout(timer); return; }
    if (Date.now() - refreshAt > 1000) bump();
    retryMs = 2000;
    void connect(false);
  });
}
