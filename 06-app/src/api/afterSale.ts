import type { Claim, ClaimReason, Refund } from '../domain/claims';
import { PHOTO_REPORTS, RATING, REVIEWS, type Review } from '../mocks/afterSale';
import { ApiError, http, live, mock, upload } from './client';

/** Загрузить фото и вернуть их id на сервере. */
const uploadAll = (kind: 'claim' | 'review', files: File[]) => Promise.all(files.map((f) => upload<{ id: string }>('/api/files?kind=' + kind, f).then((r) => r.id)));

const today = () => new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export const photoReportApi = {
  get(orderNum: string): Promise<{ place: string; date: string; pics: string[] } | null> { return live() ? http('GET', `/api/orders/${orderNum}/photo-report`) : mock(() => PHOTO_REPORTS[orderNum] ?? null); },
};

export const claimsApi = {
  /** Обращение по заказу с решением продавца (Y). null — обращения нет. */
  get(orderNum: string): Promise<Claim | null> {
    if (!live()) return mock(() => null);
    return http<Claim | null>('GET', `/api/claims/${orderNum}`).catch((e) => { if (e instanceof ApiError && e.status === 404) return null; throw e; });
  },
  create(input: { orderNum: string; reason: ClaimReason; text: string; photos: number; refundSum?: number; files?: File[] }): Promise<Claim> {
    if (live()) return uploadAll('claim', input.files ?? []).then((fileIds) => http<Claim>('POST', '/api/claims', { orderNum: input.orderNum, reason: input.reason, text: input.text, fileIds }));
    return mock(() => ({ ...input, id: input.orderNum + '-1', sentAt: today(), state: 'sent' as const }));
  },
  /** Дополнительные фото по запросу продавца. */
  addPhotos(id: string, n: number, files: File[] = []): Promise<number> {
    if (live()) return uploadAll('claim', files).then((fileIds) => http('POST', `/api/claims/${id}/photos`, { fileIds })).then(() => n);
    return mock(() => n);
  },
};

export const refundApi = {
  /** Реквизиты для возврата. Получатель — владелец аккаунта. */
  send(claimId: string, r: Refund): Promise<Refund> {
    if (live()) return http<Refund>('POST', `/api/claims/${claimId}/refund`, { to: r.to, val: r.val, bank: r.bank });
    return mock(() => ({ ...r, state: 'sent' as const }));
  },
};

export const reviewsApi = {
  /** Только опубликованные модератором отзывы (adm20) — и из приложения, и перенесённые с карт. */
  list(): Promise<{ rating: typeof RATING; items: Review[] }> {
    if (live()) return http('GET', '/api/reviews');
    return mock(() => ({ rating: RATING, items: REVIEWS.filter((r) => r.status === 'pub') }));
  },
  /** Отзыв покупателя уходит на модерацию и появляется после публикации. */
  submit(input: { orderNum: string; stars: number; text: string; photo: boolean; sign: 'short' | 'anon'; files?: File[] }): Promise<{ status: 'mod' }> {
    if (live()) return uploadAll('review', input.files ?? []).then((fileIds) => http('POST', '/api/reviews', { orderNum: input.orderNum, stars: input.stars, text: input.text, sign: input.sign, fileIds }));
    return mock(() => ({ status: 'mod' as const }));
  },
};
