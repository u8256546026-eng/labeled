import type { Address } from '../domain/order';
import { http, live, mock } from './client';
import { loginLive } from './session';

/**
 * Профиль и вход. Вход — только через Telegram: сервер проверяет подпись initData и создаёт сессию.
 * Пароля, СМС и отдельной регистрации нет. Согласие с офертой и политикой фиксируется при первом входе.
 */
export const profileApi = {
  login(_initDataRaw: string | undefined, consent: boolean): Promise<{ ok: true }> {
    if (live()) return loginLive(consent).then(() => ({ ok: true as const }));
    return mock(() => { if (!consent) throw new Error('consent'); return { ok: true as const }; });
  },
  logout(): Promise<void> { return mock(() => undefined); },
  /** Меняется только имя. Фото всегда берётся из Telegram. */
  updateName(name: string): Promise<string> { return live() ? http<{ name: string }>('PATCH', '/api/me', { name }).then((r) => r.name) : mock(() => name.trim()); },
  saveAddress(a: Address): Promise<Address> {
    if (!live()) return mock(() => a);
    return http<Address & { main: boolean }>('POST', '/api/addresses', { ...a, id: /^\d+$/.test(a.id) ? a.id : undefined }).then(({ main: _m, ...x }) => x);
  },
  deleteAddress(id: string): Promise<void> { return live() ? http<void>('DELETE', '/api/addresses/' + id).then(() => undefined) : mock(() => undefined); },
  /** Удаление аккаунта (O). Сервер откажет, если есть незавершённые заказы. */
  deleteAccount(): Promise<void> { return live() ? http<void>('DELETE', '/api/me').then(() => undefined) : mock(() => undefined); },
};

export const emailApi = {
  /** Письмо со ссылкой подтверждения. Скидка 50% на комиссию — после подтверждения. */
  send(address: string): Promise<{ address: string }> { return live() ? http('POST', '/api/email', { address }) : mock(() => ({ address })); },
  /** Только для демо: в продукте адрес подтверждается переходом по ссылке из письма. */
  confirmDemo(): Promise<void> { return mock(() => undefined); },
  unlink(): Promise<void> { return live() ? http<void>('DELETE', '/api/email').then(() => undefined) : mock(() => undefined); },
};

export type PointsEntry = { plus: boolean; title: string; date: string; amount: number };

export const pointsApi = {
  history(): Promise<PointsEntry[]> {
    if (live()) return http<{ history: PointsEntry[] }>('GET', '/api/points').then((r) => r.history);
    return mock(() => [
      { plus: true, title: 'Друг выполнил первый заказ', date: '12 августа', amount: 250 },
      { plus: false, title: 'Списание в заказе 1038', date: '1 сентября', amount: 250 },
    ]);
  },
};
