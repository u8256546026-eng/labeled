import { useState } from 'react';
import { catalogApi } from '../../api/catalog';
import { filt0, filtChips, toggleIn, type Filter, type FilterListKey } from '../../domain/filter';
import { plural } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { CATEGORIES, COLORS, CONDS, FILTER_DICT, PRICE_PRESETS, SORTS } from '../../mocks/catalog';
import { useNav } from '../../nav/useNav';
import { actions, appStore } from '../../store/app';
import { haptic } from '../../telegram/tma';
import { Chips, H, Range, Reasons, Tog } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

/**
 * U · BC — фильтры и сортировка. Выбор копится в черновике: кнопка снизу заранее считает вещи,
 * «Показать N вещей» применяет фильтр к каталогу, «назад» уходит без изменений.
 */
export function FiltersScreen() {
  const nav = useNav();
  const [F, setDraft] = useState<Filter>(() => appStore.get().filter);
  const [allBrands, setAllBrands] = useState(false);
  const facets = useApi(() => catalogApi.facets(F), [F]);

  const set = (p: Partial<Filter>) => setDraft((d) => ({ ...d, ...p }));
  const tgl = (key: FilterListKey, v: string) => () => { haptic.select(); setDraft((d) => ({ ...d, [key]: toggleIn(d[key], v) })); };
  const act = filtChips(F, FILTER_DICT).length;
  const n = facets.data?.total;
  // Бренды и размеры — из каталога; выбранные ранее остаются в списке, даже если таких вещей больше нет.
  const allB = [...new Set([...(facets.data?.brands ?? []), ...F.brands])];
  const sizes = [...new Set([...(facets.data?.sizes ?? []), ...F.sizes])];
  const brands = allBrands ? allB : allB.slice(0, 6);

  const showLabel = n == null ? 'Показать' : n ? `Показать ${n} ${plural(n, 'вещь', 'вещи', 'вещей')}` : 'Ничего не найдено';

  return (
    <Screen
      header={<Header title={'Фильтры' + (act ? ' · ' + act : '')} />}
      bar={{
        btns: [
          { label: 'Сбросить', kind: act || F.sort !== 'new' ? 'dangerSoft' : 'ghost', on: () => setDraft(filt0()) },
          { label: showLabel, kind: 'primary', dis: !n, on: () => { actions.setFilter(F); nav.back(); } },
        ],
      }}
    >
      <H text="Сортировка" />
      <Chips label="Сортировка" rows={SORTS.map((s) => ({ label: s.name, on_: F.sort === s.id, act: () => set({ sort: s.id }) }))} />

      <H text="Категория" sub="Можно выбрать несколько" />
      <Chips label="Категория" rows={CATEGORIES.map((c) => ({
        label: c.name,
        n: F.cats.includes(c.id) ? null : facets.data?.catCounts[c.id] ?? null,
        on_: F.cats.includes(c.id),
        act: tgl('cats', c.id),
      }))} />

      {sizes.length > 0 && <H text="Размер" />}
      {sizes.length > 0 && <Chips label="Размер" rows={sizes.map((z) => ({ label: z, on_: F.sizes.includes(z), act: tgl('sizes', z) }))} />}
      <Tog rows={[{ label: 'Показывать размеры под заказ', sub: 'Вещи, где нужного размера нет, но его можно заказать', on_: F.order, act: () => set({ order: !F.order }) }]} />

      <H text="Состояние" />
      <Reasons label="Состояние" multi rows={CONDS.map((c, i) => ({ label: c.name, sub: c.sub, wide: i === 2, on_: F.conds.includes(c.id), act: tgl('conds', c.id) }))} />

      <H text="Цена, ₽" />
      <Chips label="Быстрый выбор цены" rows={PRICE_PRESETS.map((r) => {
        const from = r.from ? String(r.from) : '', to = r.to ? String(r.to) : '';
        const on = F.from === from && F.to === to;
        return { label: r.name, on_: on, act: () => set(on ? { from: '', to: '' } : { from, to }) };
      })} />
      <Range rows={[
        { label: 'От', value: F.from, ph: '0', on: (v) => set({ from: v.replace(/\D/g, '') }) },
        { label: 'До', value: F.to, ph: 'Без ограничения', on: (v) => set({ to: v.replace(/\D/g, '') }) },
      ]} />

      <H text="Цвет" />
      <Chips label="Цвет" rows={COLORS.map((c) => ({ label: c.name, dot: c.hex, on_: F.colors.includes(c.id), act: tgl('colors', c.id) }))} />

      {allB.length > 0 && <H text="Бренд" />}
      {allB.length > 0 && <Chips label="Бренд" rows={brands.map((b) => ({ label: b, on_: F.brands.includes(b), act: tgl('brands', b) }))
        .concat(allB.length > 6 ? [{ label: allBrands ? 'Свернуть' : 'Ещё ' + (allB.length - 6), on_: false, act: () => setAllBrands(!allBrands) }] : [])} />}
    </Screen>
  );
}
