/** Ошибка API с кодом для приложения: login_required, forbidden, not_found, conflict, invalid… */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const notFound = (what = 'not_found') => new HttpError(404, what);
export const forbidden = (what = 'forbidden') => new HttpError(403, what);
export const conflict = (what: string, message?: string) => new HttpError(409, what, message);
export const invalid = (message: string) => new HttpError(400, 'invalid', message);

/** Числовой id из пути (/claims/:id, /banners/:id …). Не число — 404, а не ошибка базы и 500. */
export const pathInt = (v: string | undefined): number => {
  if (!v || !/^\d{1,15}$/.test(v)) throw notFound();
  return Number(v);
};

/** Дата для подписей в интерфейсе: «6 октября». */
export const ruDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }) : '');
export const ruTime = (d: Date | string) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
