/** Переключатель сегментов (роли, периоды, «Покупатель | Админ»). */
export function Seg<K extends string>({ aria, items, cur, set, dark }: { aria: string; items: [K, string][]; cur: K; set: (k: K) => void; dark?: boolean }) {
  return (
    <div role="radiogroup" aria-label={aria} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 4, padding: 4, borderRadius: 14, background: dark ? 'var(--lb-white-a14)' : 'var(--lb-n-150)' }}>
      {items.map(([k, label]) => {
        const on = cur === k;
        return (
          <button key={k} type="button" role="radio" aria-checked={on} onClick={() => set(k)} className="pressable-sm"
            style={{ height: 40, border: 0, borderRadius: 11, cursor: 'pointer', font: 'inherit', fontSize: 13.5, fontWeight: 700, background: on ? 'var(--lime)' : 'transparent', color: on ? 'var(--lb-ink)' : dark ? 'var(--lb-white)' : 'var(--lb-ink)', boxShadow: on && !dark ? '0 1px 3px var(--lb-ink-a14)' : 'none', transition: 'background 160ms ease' }}>{label}</button>
        );
      })}
    </div>
  );
}
