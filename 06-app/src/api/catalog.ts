import { applyFilt, type Filter } from '../domain/filter';
import type { CatalogItem, Page, Product } from '../domain/types';
import { BRANDS, CATEGORIES, ITEMS, SIZES } from '../mocks/catalog';
import { PRODUCTS } from '../mocks/products';
import { ApiError, http, live, mock } from './client';

/** Модели, загруженные с сервера: быстрая покупка из карточки берёт предложение отсюда. */
export const productCache = new Map<string, Product>();

export const PAGE_SIZE = 12;

export const catalogApi = {
  /** Выдача каталога с фильтром и сортировкой, постранично. */
  list(filter: Filter, page = 0): Promise<Page<CatalogItem>> {
    if (live()) return http('GET', `/api/catalog?page=${page}&f=${encodeURIComponent(JSON.stringify(filter))}`);
    return mock(() => {
      const all = applyFilt(ITEMS, filter);
      const items = all.slice(0, (page + 1) * PAGE_SIZE);
      return { items, total: all.length, hasMore: items.length < all.length };
    });
  },

  /** Сколько вещей даст фильтр и сколько добавит каждая невыбранная категория (экран U). */
  /** Сколько вещей подходит, счётчики категорий и бренды с размерами, которые реально есть в каталоге. */
  facets(filter: Filter): Promise<{ total: number; catCounts: Record<string, number>; brands: string[]; sizes: string[] }> {
    if (live()) return http('GET', '/api/catalog/facets?f=' + encodeURIComponent(JSON.stringify(filter)));
    return mock(() => {
      const catCounts: Record<string, number> = {};
      CATEGORIES.forEach((c) => {
        if (!filter.cats.includes(c.id)) catCounts[c.id] = applyFilt(ITEMS, { ...filter, cats: filter.cats.concat([c.id]) }).length;
      });
      return { total: applyFilt(ITEMS, filter).length, catCounts, brands: BRANDS, sizes: SIZES };
    }, 0);
  },

  /** Модель товара для карточки: расцветки, фото, предложения, размеры под заказ. null — вещь снята с продажи. */
  product(id: string): Promise<Product | null> {
    if (live()) {
      return http<Product>('GET', '/api/products/' + encodeURIComponent(id)).then((p) => { productCache.set(p.id, p); return p; },
        (e) => { if (e instanceof ApiError && e.status === 404) return null; throw e; });
    }
    return mock(() => PRODUCTS.find((x) => x.id === id) ?? null);
  },
};
