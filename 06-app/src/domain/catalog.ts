import { rub } from '../lib/format';
import type { CatalogItem, Product } from './types';

// Общие правила каталога для приложения и сервера: карточка выводится из модели товара, поиск — по словам.

/** Карточка каталога выводится из модели товара: цена «от», тег, цвета, размеры, состояния. */
export function toCatalogItem(p: Product): CatalogItem {
  const prices = p.offers.map((o) => o.price);
  const price = Math.min(...prices);
  const kinds = new Set(p.offers.map((o) => o.cond + ':' + o.price));
  const multi = kinds.size > 1;
  return {
    id: p.id, name: p.name, brand: p.brand, cat: p.cat, cats: p.cats ?? [p.cat],
    price, priceLabel: (multi ? 'от ' : '') + rub(price),
    img: p.colors[0].photos[0],
    multi, cond: multi ? undefined : p.offers[0].cond,
    colors: [...new Set(p.colors.map((c) => c.filter))],
    sizes: [...new Set(p.offers.map((o) => o.size).filter(Boolean))],
    conds: [...new Set(p.offers.map((o) => o.cond))],
    preorder: Object.values(p.preorder).some((l) => l.length > 0),
    added: p.added, pop: p.pop,
  };
}

/**
 * Карточки каталога: у модели в нескольких расцветках — отдельная карточка на каждый цвет в наличии
 * (своё фото, цена, размеры), карточка открывает товар в этом цвете. Расцветка без вещей в наличии карточки не получает.
 */
export function catalogCards(p: Product): CatalogItem[] {
  if (p.colors.length < 2) return [toCatalogItem(p)];
  return p.colors
    .map((c) => ({ c, offers: p.offers.filter((o) => o.color === c.id) }))
    .filter((x) => x.offers.length > 0)
    .map(({ c, offers }) => ({ ...toCatalogItem({ ...p, colors: [c], offers, preorder: { [c.id]: p.preorder[c.id] ?? [] } }), color: c.id }));
}

/** Путь карточки товара; у карточки расцветки — сразу в её цвете. */
export const productPath = (it: { id: string; color?: string }) => '/product/' + it.id + (it.color ? '?c=' + encodeURIComponent(it.color) : '');

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Поиск по словам названия и бренда с допуском окончаний («джинсы» находит «джинсовую»). Сначала новые. */
export function searchItems(items: CatalogItem[], q: string): CatalogItem[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const list = items.filter((it) => words.every((w) => norm(it.name + ' ' + it.brand).split(/[\s’']+/).some((t) => t.startsWith(w.slice(0, Math.max(3, w.length - 2))))));
  return list.slice().sort((a, b) => b.added - a.added);
}
