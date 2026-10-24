import { History, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { searchApi } from '../../api/content';
import { productPath } from '../../domain/catalog';
import { plural } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { Empty, Note, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { ProductGrid } from '../catalog/CatalogScreen';

/** AI · AJ — поиск по названию и бренду: недавние запросы, счётчик, сетка, загрузка, ошибка, пустая выдача. */
export function SearchScreen() {
  const nav = useNav();
  const recent = useApp((s) => s.recent);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = window.setTimeout(() => setQ(text.trim()), 250); return () => window.clearTimeout(t); }, [text]);
  useEffect(() => { if (q.length >= 3) actions.pushRecent(q.toLowerCase()); }, [q]);
  const r = useApi(() => searchApi.search(q), [q]);
  const set = (v: string) => { setText(v); setQ(v.trim()); };
  const n = r.data?.length ?? 0;
  const busy = r.loading && (!r.data || q !== text.trim());

  return (
    <Screen header={<Header title="Поиск" />}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 6px 0 16px', borderRadius: 999, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a10), 0 6px 16px -12px var(--lb-black-a40)' }}>
        <Search size={19} strokeWidth={2.3} style={{ flex: 'none' }} aria-hidden />
        <input ref={input} type="search" autoFocus aria-label="Поиск по каталогу" value={text} placeholder="Искать на labeled" onChange={(e) => setText(e.target.value)} enterKeyHint="search"
          onKeyDown={(e) => { if (e.key === 'Enter') input.current?.blur(); }}
          style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--lb-ink)', fontSize: 16, fontWeight: 500 }} />
        {text && <button type="button" aria-label="Очистить запрос" onClick={() => { set(''); input.current?.focus(); }} className="pressable-xs" style={{ width: 34, height: 34, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 999, background: 'var(--lb-n-150)', cursor: 'pointer' }}><X size={12} strokeWidth={3} aria-hidden /></button>}
      </div>
      {!text && recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--lb-ink-2)' }}>Недавние</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recent.map((x) => (
              <button key={x} type="button" onClick={() => set(x)} className="pressable-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px 0 10px', border: 0, borderRadius: 999, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a10)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <History size={14} strokeWidth={2.2} color="var(--lb-ink-3)" aria-hidden /><span>{x}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {r.error ? (
        <Note tone="err" title="Ошибка запроса" text="Не удалось загрузить результаты. Проверьте связь и повторите." act={{ label: 'Повторить', on: r.reload }} />
      ) : busy ? <Skel /> : r.data && (n === 0 ? (
        <Empty minH={360} title="Ничего не нашлось" text={`По запросу «${q}» вещей нет. Попробуйте другое слово или оформите заказ по ссылке.`}
          btns={[{ label: 'Сбросить запрос', kind: 'ghost', on: () => set('') }, { label: 'Заказать по ссылке', kind: 'primary', on: () => nav.root('/link') }]} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 2px' }}>
            <div role="status" style={{ fontSize: 13, fontWeight: 600 }}>{q ? `Нашли ${n} ${plural(n, 'вещь', 'вещи', 'вещей')}` : `Весь каталог · ${n} ${plural(n, 'вещь', 'вещи', 'вещей')}`}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 10px', borderRadius: 999, background: 'var(--lb-lime-soft)', fontSize: 11.5, fontWeight: 700 }}>{q ? 'По названию и бренду' : 'Сначала новые'}</div>
          </div>
          <ProductGrid items={r.data} onOpen={(it) => nav.go(productPath(it))} />
        </>
      ))}
    </Screen>
  );
}
