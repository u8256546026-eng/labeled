import { ArrowDownUp, ListFilter, Search, Star } from 'lucide-react';
import { useState } from 'react';
import { catalogApi } from '../../api/catalog';
import { productPath } from '../../domain/catalog';
import { dropChip, emptyText, filt0, filtChips, toggleIn, type Filter } from '../../domain/filter';
import type { CatalogItem } from '../../domain/types';
import { num } from '../../lib/format';
import { sized } from '../../lib/img';
import { useApi } from '../../lib/useApi';
import { useDeskScroll } from '../../lib/useDeskScroll';
import { BANNERS, CATEGORIES, FILTER_DICT, SORTS } from '../../mocks/catalog';
import type { ShowBanner } from '../../domain/types';
import { asset } from '../../mocks/images';
import { useNav } from '../../nav/useNav';
import { useRequireAuth } from '../../nav/useRequireAuth';
import { actions, appStore, useApp } from '../../store/app';
import { Empty, Note, RemovableChip, Skel } from '../../ui/blocks';
import { Screen } from '../../ui/Screen';
import { Tag } from '../../ui/Tag';
import { Banners } from './Banners';


/** 7a · 7r · BD · AF — главный экран: поиск, категории, баннеры, каталог с сортировкой и фильтрами. */
export function CatalogScreen() {
  const nav = useNav();
  const pts = useApp((s) => s.pts);
  const filter = useApp((s) => s.filter);
  // Номер страницы привязан к фильтру: новый фильтр — снова первая страница.
  const [paging, setPaging] = useState({ filter, page: 0 });
  const page = paging.filter === filter ? paging.page : 0;
  const q = useApi(() => catalogApi.list(filter, page), [filter, page], 'catalog:' + JSON.stringify(filter) + ':' + page);

  const needAuth = useRequireAuth();
  const setF = (f: Filter) => actions.setFilter(f);
  const openBanner = (b: ShowBanner) => {
    if (b.target === 'link') nav.root('/link');
    else if (b.target === 'email') needAuth('/email');
    else if (b.target === 'invite') needAuth('/invite');
    else setF({ ...filt0(), sort: filter.sort, cats: b.cat && CATEGORIES.some((c) => c.id === b.cat) ? [b.cat] : [] });
  };

  return (
    <Screen bare>
      <CatalogHeader pts={pts} onSearch={() => nav.go('/search')} onPoints={() => nav.go('/points')} />
      {!q.error && <CategoryRail filter={filter} onToggle={(id) => setF({ ...filter, cats: toggleIn(filter.cats, id) })} />}
      <Banners banners={BANNERS} onOpen={openBanner} />

      <div style={{ padding: '16px var(--px) 0' }}>
        {!q.error && <CatalogBar filter={filter} onFilters={() => nav.go('/filters')} onChange={setF} />}
        {q.error ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
            <Note tone="err" title="Нет соединения" text="Проверьте интернет и повторите. Черновики и введённые данные не пропадут." act={{ label: 'Повторить', on: q.reload }} />
            <Skel />
          </div>
        ) : !q.data ? (
          <div style={{ paddingTop: 4 }}><Skel /></div>
        ) : q.data.total === 0 ? (
          <Empty minH={360} title="Ничего не подходит" text={emptyText(filter, FILTER_DICT)}
            btns={[{ label: 'Сбросить фильтры', kind: 'primary', on: () => setF({ ...filt0(), sort: filter.sort }) }, { label: 'Заказ по ссылке', kind: 'limeSoft', on: () => nav.root('/link') }]} />
        ) : (
          <>
            <ProductGrid items={q.data.items} onOpen={(it) => nav.go(productPath(it))} />
            {q.data.hasMore && (
              <button type="button" onClick={() => setPaging({ filter, page: page + 1 })} className="pressable"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 48, marginTop: 20, border: 0, background: 'var(--neu)', borderRadius: 'var(--card-r)', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: q.loading ? 0.6 : 1 }}>
                Показать ещё
              </button>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}

function CatalogHeader({ pts, onSearch, onPoints }: { pts: number; onSearch: () => void; onPoints: () => void }) {
  return (
    <div className="top-fill" style={{ background: 'var(--lime)', borderRadius: '0 0 22px 22px', padding: 'calc(10px + var(--safe-top)) var(--px) 12px' }}>
      <button type="button" onClick={onSearch} className="pressable"
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 46, border: 0, background: 'var(--lb-white)', borderRadius: 999, padding: '0 16px', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08), 0 1px 2px var(--lb-black-a10), 0 8px 20px -12px var(--lb-black-a40)', cursor: 'pointer', textAlign: 'left' }}>
        <Search size={19} strokeWidth={2.3} color="#111111" style={{ flex: 'none' }} aria-hidden />
        <span style={{ fontSize: 15, color: 'var(--lb-ink-3)', letterSpacing: '-0.005em' }}>Искать на labeled</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 0 2px' }}>
        <div role="img" aria-label="labeled" style={{ width: 52, height: 23, flex: 'none', backgroundImage: `url(${asset('lbld-black.png')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'left center' }} />
        <div style={{ flex: 1 }} />
        {/* Пилюля 28 px, зона нажатия — 44 px по высоте (выходит за пилюлю, не сдвигая шапку). */}
        <button type="button" aria-label={'Баллы labeled: ' + pts} onClick={onPoints} className="pressable-sm"
          style={{ display: 'flex', alignItems: 'center', height: 44, margin: '-8px 0', padding: 0, border: 0, background: 'none', cursor: 'pointer', flex: 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 12px 0 10px', borderRadius: 999, background: 'var(--lb-ink-2)' }}>
            <Star size={14} strokeWidth={2.2} color="#C6FF00" aria-hidden />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--lb-white)' }}>{num(pts)}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function CategoryRail({ filter, onToggle }: { filter: Filter; onToggle: (id: string) => void }) {
  const rail = useDeskScroll<HTMLDivElement>();
  return (
    <div ref={rail} data-hs role="group" aria-label="Категории" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px var(--px) 0', scrollSnapType: 'x proximity', scrollPaddingInline: 'var(--px)' }}>
      {CATEGORIES.map((c) => {
        const sel = filter.cats.includes(c.id);
        return (
          <button key={c.id} type="button" aria-pressed={sel} onClick={() => onToggle(c.id)} className="pressable-sm"
            style={{ flex: '0 0 var(--tile)', width: 'var(--tile)', scrollSnapAlign: 'start', border: 0, padding: 0, background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 17, overflow: 'hidden', background: 'var(--lb-n-150)', boxShadow: sel ? 'inset 0 0 0 2px var(--lb-ink)' : 'inset 0 0 0 1px var(--lb-ink-a08)', transition: 'box-shadow 190ms ease' }}>
              {c.img
                ? <div role="img" aria-label={c.name} style={{ width: '100%', height: '100%', backgroundImage: `url(${sized(c.img, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                : <div aria-hidden style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--lb-ink-2)' }}>{c.name.charAt(0)}</div>}
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.25, textAlign: 'center', minHeight: 28, fontWeight: sel ? 700 : 500, color: sel ? 'var(--lb-ink)' : 'var(--lb-ink-2)', letterSpacing: '-0.005em' }}>{c.name}</div>
          </button>
        );
      })}
    </div>
  );
}

const NEXT_SORT: Record<Filter['sort'], Filter['sort']> = { new: 'cheap', cheap: 'exp', exp: 'new', pop: 'new' };

/** 7r — закреплённая строка «Каталог · сортировка · фильтры» и чипсы активных фильтров. */
function CatalogBar({ filter, onFilters, onChange }: { filter: Filter; onFilters: () => void; onChange: (f: Filter) => void }) {
  const chips = filtChips(filter, FILTER_DICT);
  const n = chips.length;
  const chipRail = useDeskScroll<HTMLDivElement>();
  const sortName = SORTS.find((s) => s.id === filter.sort)!.short;
  return (
    <div style={{ position: 'sticky', top: 'var(--safe-top)', zIndex: 3, margin: '0 calc(var(--px) * -1)', padding: '8px var(--px)', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 'var(--f-sec)', fontWeight: 600, letterSpacing: '-0.025em' }}>Каталог</h2>
        <button type="button" onClick={() => onChange({ ...filter, sort: NEXT_SORT[filter.sort] })} aria-label={`Сортировка: ${sortName.toLowerCase()}. Нажмите, чтобы сменить`} className="pressable-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: 0, borderRadius: 999, background: 'var(--neu)', color: 'var(--ink)', fontSize: 'var(--f-small)', fontWeight: 600, cursor: 'pointer', flex: 'none' }}>
          <ArrowDownUp size={14} strokeWidth={2.2} aria-hidden />
          <span>{sortName}</span>
        </button>
        <button type="button" onClick={onFilters} aria-label={n ? 'Фильтры, выбрано ' + n : 'Фильтры'} className="pressable-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: n ? '0 6px 0 12px' : '0 12px', border: 0, borderRadius: 999, background: n ? 'var(--dark)' : 'var(--neu)', color: n ? 'var(--lb-white)' : 'var(--ink)', fontSize: 'var(--f-small)', fontWeight: 600, cursor: 'pointer', flex: 'none' }}>
          <ListFilter size={14} strokeWidth={2.2} aria-hidden />
          <span>Фильтры</span>
          {n > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--lime)', color: 'var(--lb-ink)', fontSize: 11, fontWeight: 700 }}>{n}</span>}
        </button>
      </div>
      {n > 0 && (
        <div ref={chipRail} data-hs style={{ display: 'flex', gap: 6, margin: '8px calc(var(--px) * -1) 0', padding: '0 var(--px)', overflowX: 'auto' }}>
          {chips.map((c) => (
            <RemovableChip key={c.key + (c.val ?? '')} label={c.label} onRemove={() => onChange(dropChip(appStore.get().filter, c))} />
          ))}
          {n > 1 && (
            <button type="button" onClick={() => onChange({ ...filt0(), sort: filter.sort })}
              style={{ display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 8px', border: 0, background: 'none', color: 'var(--ink)', fontSize: 'var(--f-small)', fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none' }}>Сбросить всё</button>
          )}
        </div>
      )}
    </div>
  );
}

export function ProductGrid({ items, onOpen }: { items: CatalogItem[]; onOpen: (it: CatalogItem) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', columnGap: 'var(--col-gap)', rowGap: 20, alignItems: 'start', paddingTop: 4 }}>
      {items.map((it, i) => (
        <button key={it.id + ':' + (it.color ?? '')} type="button" onClick={() => onOpen(it)} className="pressable"
          style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }}>
          <div style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: 'var(--card-r)', overflow: 'hidden', background: 'var(--neu)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            {/* <img>, а не фон: карточки ниже экрана грузятся при прокрутке; первые две строки — сразу. */}
            {it.img && <img src={sized(it.img, 480)} alt={it.name} loading={i < 4 ? 'eager' : 'lazy'} decoding="async" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, display: 'flex' }}>
              {it.multi ? <Tag cond="service" text="несколько предложений" service onPhoto /> : <Tag cond={it.cond!} onPhoto />}
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 'var(--f-price)', fontWeight: 700, letterSpacing: '-0.02em' }}>{it.priceLabel}</div>
          <div style={{ marginTop: 4, height: 36, fontSize: 'var(--f-name)', fontWeight: 600, lineHeight: '18px', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{it.name}</div>
        </button>
      ))}
    </div>
  );
}
