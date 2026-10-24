import { numNbsp } from '../lib/format';
import type { CatalogItem } from './types';

/** Модель фильтра из README («Фильтры (U, BC, BD, 7r) — главное»). */
export type Filter = {
  sort: 'new' | 'cheap' | 'exp' | 'pop';
  cats: string[];
  sizes: string[];
  conds: string[];
  colors: string[];
  brands: string[];
  from: string;
  to: string;
  order: boolean;
};

export type FilterListKey = 'cats' | 'sizes' | 'conds' | 'colors' | 'brands';
export type FilterChip = { key: FilterListKey | 'price' | 'order'; val?: string; label: string };

export const filt0 = (): Filter => ({ sort: 'new', cats: [], sizes: [], conds: [], colors: [], brands: [], from: '', to: '', order: false });

const toNum = (v: string) => parseInt(String(v || '').replace(/\D/g, ''), 10) || 0;

/** Внутри группы — ИЛИ, между группами — И. Пустая группа не ограничивает. */
export function applyFilt(list: CatalogItem[], F: Filter): CatalogItem[] {
  const from = toNum(F.from), to = toNum(F.to);
  let r = list.filter((it) =>
    (!F.cats.length || it.cats.some((c) => F.cats.includes(c))) &&
    (!F.sizes.length || it.sizes.some((x) => F.sizes.includes(x))) &&
    (!F.conds.length || it.conds.some((x) => F.conds.includes(x))) &&
    (!F.colors.length || it.colors.some((c) => F.colors.includes(c))) &&
    (!F.brands.length || F.brands.includes(it.brand)) &&
    (!from || it.price >= from) && (!to || it.price <= to) &&
    (!F.order || !!it.preorder));
  if (F.sort === 'cheap') r = r.slice().sort((a, b) => a.price - b.price);
  if (F.sort === 'exp') r = r.slice().sort((a, b) => b.price - a.price);
  if (F.sort === 'new') r = r.slice().sort((a, b) => b.added - a.added);
  if (F.sort === 'pop') r = r.slice().sort((a, b) => b.pop - a.pop);
  return r;
}

type Named = { id: string; name: string };

/** Чипсы активных фильтров. Сортировка фильтром не считается. */
export function filtChips(F: Filter, dict: { cats: Named[]; conds: Named[]; colors: Named[] }): FilterChip[] {
  const nm = (arr: Named[], k: string) => (arr.find((x) => x.id === k) || { name: k }).name;
  const out: FilterChip[] = [];
  F.cats.forEach((k) => out.push({ key: 'cats', val: k, label: nm(dict.cats, k) }));
  F.sizes.forEach((k) => out.push({ key: 'sizes', val: k, label: 'Размер ' + k }));
  F.conds.forEach((k) => out.push({ key: 'conds', val: k, label: nm(dict.conds, k) }));
  F.colors.forEach((k) => out.push({ key: 'colors', val: k, label: nm(dict.colors, k) }));
  F.brands.forEach((k) => out.push({ key: 'brands', val: k, label: k }));
  if (F.from || F.to) {
    out.push({ key: 'price', label: (F.from ? 'от ' + numNbsp(F.from) : '') + (F.from && F.to ? ' ' : '') + (F.to ? 'до ' + numNbsp(F.to) : '') + ' ₽' });
  }
  if (F.order) out.push({ key: 'order', label: 'Можно под заказ' });
  return out;
}

/** Текст пустой выдачи (AF): «Вещей размера L в состоянии «новое» дешевле 3 000 ₽ сейчас нет». */
export function emptyText(F: Filter, dict: { cats: Named[]; conds: Named[]; colors: Named[] }): string {
  const nm = (arr: Named[], k: string) => (arr.find((x) => x.id === k) || { name: k }).name;
  const q = (arr: string[]) => arr.map((x) => '«' + x + '»').join(', ');
  const low = (arr: Named[], ks: string[]) => ks.map((k) => nm(arr, k).toLowerCase());
  const parts: string[] = [];
  if (F.cats.length) parts.push((F.cats.length > 1 ? 'в категориях ' : 'в категории ') + q(F.cats.map((k) => nm(dict.cats, k))));
  if (F.sizes.length) parts.push((F.sizes.length > 1 ? 'размеров ' : 'размера ') + F.sizes.join(', '));
  if (F.conds.length) parts.push((F.conds.length > 1 ? 'в состояниях ' : 'в состоянии ') + q(low(dict.conds, F.conds)));
  if (F.colors.length) parts.push((F.colors.length > 1 ? 'цветов ' : 'цвета ') + q(low(dict.colors, F.colors)));
  if (F.brands.length) parts.push((F.brands.length > 1 ? 'брендов ' : 'бренда ') + F.brands.join(', '));
  if (F.from && F.to) parts.push('от ' + numNbsp(F.from) + ' до ' + numNbsp(F.to) + '\u00A0₽');
  else if (F.to) parts.push('дешевле ' + numNbsp(F.to) + '\u00A0₽');
  else if (F.from) parts.push('от ' + numNbsp(F.from) + '\u00A0₽');
  if (F.order) parts.push('под заказ');
  const head = parts.length ? 'Вещей ' + parts.join(' ') + ' сейчас нет. ' : '';
  return head + 'Уберите один из фильтров или закажите нужную вещь по ссылке.';
}

export function dropChip(F: Filter, c: FilterChip): Filter {
  const n: Filter = { ...F };
  if (c.key === 'price') { n.from = ''; n.to = ''; }
  else if (c.key === 'order') n.order = false;
  else n[c.key] = F[c.key].filter((x) => x !== c.val);
  return n;
}

export const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat([v]));
