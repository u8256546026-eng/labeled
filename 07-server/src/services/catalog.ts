import { asc, eq } from 'drizzle-orm';
import { catalogCards, searchItems } from '../../../06-app/src/domain/catalog';
import { applyFilt, type Filter } from '../../../06-app/src/domain/filter';
import type { CatalogItem, Category, Cond, Page, Product } from '../../../06-app/src/domain/types';
import { banners, categories, offers, products } from '../db/schema';
import type { Tx } from './core';

export const PAGE_SIZE = 12;

type ProductRow = typeof products.$inferSelect;
type OfferRow = typeof offers.$inferSelect;

/** Модель товара для карточки. Предложения с остатком 0 скрыты; без предложений вещь не продаётся. */
export function productView(p: ProductRow, os: OfferRow[]): Product {
  // Сохранённая сетка (включает распроданные размеры) плюс то, что сейчас в наличии; удалённые предложения не всплывают.
  const live = os.filter((o) => o.stock > 0);
  const grid = sizeGridOf(p.sizeGrid, live.map((o) => o.size));
  // Распроданная расцветка без «под заказ» не показывается: выбрать в ней нечего. Обложка каталога — первая из оставшихся.
  const shown = p.preorderAllowed ? p.colors : p.colors.filter((c) => live.some((o) => o.color === c.id));
  const colors = shown.length ? shown : p.colors;
  return {
    id: p.id, name: p.name, brand: p.brand, cat: p.categoryId, cats: [...new Set([p.categoryId, ...p.extraCategories])], description: p.description,
    sizeGrid: grid, colors,
    offers: live.filter((o) => colors.some((c) => c.id === o.color)).map((o) => ({ id: o.id, color: o.color, size: sizeLatin(o.size), cond: o.cond as Cond, price: o.price, note: o.note, img: o.img, stock: o.stock })),
    // «Размер под заказ»: заданный список по цветам (демо-данные) или, если его нет, — все размеры сетки.
    // Кнопка «Под заказ» появляется только у размера без вещей в наличии.
    preorder: !p.preorderAllowed ? {}
      : Object.values(p.preorder).some((l) => l.length) ? Object.fromEntries(Object.entries(p.preorder).map(([c, l]) => [c, l.map(sizeLatin)]))
      : Object.fromEntries(colors.map((c) => [c.id, grid])),
    sizeChart: p.sizeChart ?? undefined,
    added: p.createdAt.getTime(), pop: p.pop,
  };
}

/**
 * Все продаваемые модели: видимые, хотя бы с одной видимой категорией и хотя бы одним предложением в наличии.
 * Скрытые категории из списка вещи убираются — фильтр по ним её не находит.
 */
export async function sellableProducts(db: Tx): Promise<Product[]> {
  const [ps, os, cs] = await Promise.all([db.select().from(products), db.select().from(offers), db.select().from(categories)]);
  const hiddenCats = new Set(cs.filter((c) => !c.visible).map((c) => c.id));
  return ps
    .filter((p) => p.visible)
    .map((p) => productView(p, os.filter((o) => o.productId === p.id)))
    .map((p) => ({ ...p, cats: p.cats!.filter((c) => !hiddenCats.has(c)) }))
    .filter((p) => p.offers.length > 0 && p.cats.length > 0);
}

export async function catalogItems(db: Tx): Promise<CatalogItem[]> {
  return (await sellableProducts(db)).flatMap(catalogCards);
}

export async function catalogPage(db: Tx, filter: Filter, page: number): Promise<Page<CatalogItem>> {
  const all = applyFilt(await catalogItems(db), filter);
  const items = all.slice(0, (page + 1) * PAGE_SIZE);
  return { items, total: all.length, hasMore: items.length < all.length };
}

/** Сколько вещей даст фильтр и сколько добавит каждая невыбранная категория (U). */
export async function catalogFacets(db: Tx, filter: Filter) {
  const items = await catalogItems(db);
  const cats = await visibleCategories(db);
  const catCounts: Record<string, number> = {};
  cats.forEach((c) => { if (!filter.cats.includes(c.id)) catCounts[c.id] = applyFilt(items, { ...filter, cats: filter.cats.concat([c.id]) }).length; });
  // Бренды и размеры — те, что есть в каталоге сейчас, а не демо-список: иначе фильтр предлагает несуществующее.
  const brands = [...new Set(items.map((i) => i.brand.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const sizes = [...new Set(items.flatMap((i) => i.sizes))].sort(sizeOrder);
  return { total: applyFilt(items, filter).length, catCounts, brands, sizes };
}

/** Размер с кириллическими буквами-двойниками («М», «ХL») — латиницей, иначе фильтр по «M» эту вещь не найдёт. */
export const sizeLatin = (s: string) => {
  const x = s.trim();
  // Только буквенные размеры (XS…XXL), где кириллица прячется под латиницу; «42», «One size», «Один» не трогаем.
  return /^[XxSsMmLlХхМм]{1,4}$/.test(x) ? x.replace(/[Хх]/g, 'X').replace(/[Мм]/g, 'M').toUpperCase() : x;
};

/** Сетка размеров: сохранённая плюс размеры предложений, латиницей, без повторов, по порядку XS…XXL. */
export function sizeGridOf(grid: string[], offerSizes: string[] = []): string[] {
  return [...new Set([...grid, ...offerSizes].map(sizeLatin).filter(Boolean))].sort(sizeOrder);
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
/** XS, S, M, L, XL… по порядку, числовые (42, 44) — по возрастанию, остальное — по алфавиту в конце. */
export function sizeOrder(a: string, b: string) {
  const r = (x: string) => { const i = SIZE_ORDER.indexOf(x.toUpperCase()); return i >= 0 ? i : /^\d/.test(x) ? 100 + parseFloat(x) : 10_000; };
  return r(a) - r(b) || a.localeCompare(b, 'ru');
}

export async function productById(db: Tx, id: string): Promise<Product | null> {
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p || !p.visible) return null;
  const v = productView(p, await db.select().from(offers).where(eq(offers.productId, id)));
  return v.offers.length ? v : null;
}

export async function search(db: Tx, q: string) {
  return searchItems(await catalogItems(db), q);
}

export async function visibleCategories(db: Tx): Promise<Category[]> {
  return (await db.select().from(categories).where(eq(categories.visible, true)).orderBy(asc(categories.sort))).map((c) => ({ id: c.id, name: c.name, img: c.img }));
}

export async function visibleBanners(db: Tx) {
  return (await db.select().from(banners).where(eq(banners.visible, true)).orderBy(asc(banners.sort))).map((b) => ({ id: b.id, title: b.title, target: b.target, img: b.img, cta: b.cta, cat: b.cat }));
}

/** Фильтр из строки запроса: ?f=<json Filter>. Неизвестные поля отбрасываются. */
export function parseFilter(raw: unknown): Filter {
  const base: Filter = { sort: 'new', cats: [], sizes: [], conds: [], colors: [], brands: [], from: '', to: '', order: false };
  if (typeof raw !== 'string' || !raw) return base;
  try {
    const f = JSON.parse(raw) as Partial<Filter>;
    const arr = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string').slice(0, 50) : []);
    return {
      sort: (['new', 'cheap', 'exp', 'pop'] as const).includes(f.sort as Filter['sort']) ? (f.sort as Filter['sort']) : 'new',
      cats: arr(f.cats), sizes: arr(f.sizes), conds: arr(f.conds), colors: arr(f.colors), brands: arr(f.brands),
      from: String(f.from ?? '').replace(/\D/g, '').slice(0, 9), to: String(f.to ?? '').replace(/\D/g, '').slice(0, 9), order: !!f.order,
    };
  } catch {
    return base;
  }
}
