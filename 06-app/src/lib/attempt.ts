import { useRef } from 'react';

/**
 * Попытка отправки (оформление заказа, заявка по ссылке): ключ для сервера и блокировка второго нажатия.
 * Сервер на повтор с тем же ключом возвращает уже созданный заказ — двойное нажатие или повтор после обрыва
 * связи не создают второй заказ и не списывают баллы дважды. Блокировка срабатывает сразу, до перерисовки кнопки.
 */
export function useAttempt() {
  const r = useRef({ key: newKey(), busy: false });
  return {
    key: () => r.current.key,
    /** false — отправка уже идёт. */
    start: () => (r.current.busy ? false : (r.current.busy = true)),
    /** Ошибка: можно нажать снова с тем же ключом. */
    fail: () => { r.current.busy = false; },
  };
}

const newKey = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
