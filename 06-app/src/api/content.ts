import type { CatalogItem } from '../domain/types';
import { ITEMS, MODELS } from '../mocks/catalog';
import { EVENTS, INVITERS, LEGAL, SOLD_ITEMS, type AppEvent } from '../mocks/content';
import { searchItems } from '../domain/catalog';
import { ApiError, http, live, mock } from './client';

/** 404 сервера → null (вещь, документ, пригласивший не найдены). */
const orNull = <T,>(p: Promise<T>): Promise<T | null> => p.catch((e) => { if (e instanceof ApiError && e.status === 404) return null; throw e; });

const scenario = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('scenario') : null);

export const eventsApi = {
  list(): Promise<AppEvent[]> { return live() ? http<{ items: AppEvent[] }>('GET', '/api/events').then((r) => r.items) : mock(() => EVENTS); },
  markAllRead(): Promise<void> { return live() ? http<void>('POST', '/api/events/read').then(() => undefined) : mock(() => undefined); },
};

export type LegalDocId = keyof typeof LEGAL.docs;
export const legalApi = {
  /** Дата вступления в силу и список документов. Тексты пока заглушки. */
  index(): Promise<{ effectiveFrom: string; docs: { id: LegalDocId; title: string; sub: string }[] }> {
    if (live()) return http('GET', '/api/legal');
    return mock(() => ({ effectiveFrom: LEGAL.effectiveFrom, docs: (Object.keys(LEGAL.docs) as LegalDocId[]).map((id) => ({ id, title: LEGAL.docs[id].title, sub: LEGAL.docs[id].sub })) }));
  },
  doc(id: string): Promise<{ title: string; effectiveFrom: string; body: string[] } | null> {
    if (live()) return orNull(http('GET', '/api/legal/' + encodeURIComponent(id)));
    return mock(() => { const d = LEGAL.docs[id as LegalDocId]; return d ? { title: d.title, effectiveFrom: LEGAL.effectiveFrom, body: d.body } : null; });
  },
};

export const searchApi = {
  /** Поиск по названию и бренду. Пустой запрос — весь каталог, сначала новые. ?scenario=searcherr — ошибка. */
  search(q: string): Promise<CatalogItem[]> {
    if (scenario() === 'searcherr') return new Promise((_, rej) => setTimeout(() => rej(new ApiError('server')), 300));
    if (live()) return http('GET', '/api/search?q=' + encodeURIComponent(q));
    return mock(() => searchItems(ITEMS, q), 300);
  },
};

export type FavItem = (CatalogItem & { sold?: false }) | { id: string; name: string; priceLabel: string; img: string; sold: true };
export const favApi = {
  /** Избранное: доступные вещи и снятые с продажи (с пометкой «продано»). */
  list(ids: string[]): Promise<FavItem[]> {
    if (live()) return http('GET', '/api/favorites');
    return mock(() => ids.map((id) => MODELS.find((x) => x.id === id) ?? (SOLD_ITEMS.find((x) => x.id === id) ? { ...SOLD_ITEMS.find((x) => x.id === id)!, sold: true as const } : null)).filter((x): x is FavItem => !!x));
  },
};

export const referralApi = {
  inviter(id: string): Promise<{ name: string } | null> { return live() ? orNull(http('GET', '/api/inviter/' + encodeURIComponent(id))) : mock(() => INVITERS[id] ?? null); },
};
