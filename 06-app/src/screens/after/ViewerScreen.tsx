import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { photoReportApi } from '../../api/afterSale';
import { catalogApi } from '../../api/catalog';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { sized } from '../../lib/img';

type Album = { title: string; caption: string; pics: string[] };

/** AG — фото на весь экран: счётчик, увеличение по нажатию, свайп и стрелки, миниатюры, закрытие. */
export function ViewerScreen() {
  const { kind = 'product', id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNav();
  const q = useApi<Album | null>(async () => {
    if (kind === 'report') {
      const r = await photoReportApi.get(id);
      return r && { title: 'Фотоотчёт · заказ ' + id, caption: `${r.place} · ${r.date}`, pics: r.pics };
    }
    const p = await catalogApi.product(id);
    if (!p) return null;
    const c = p.colors.find((x) => x.id === sp.get('c')) ?? p.colors[0];
    return { title: p.name, caption: c.name, pics: c.photos };
  }, [kind, id], `viewer:${kind}:${id}:${sp.get('c')}`);
  const [i, setI] = useState(() => Number(sp.get('i') ?? 0) || 0);
  const [zoom, setZoom] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const a = q.data;
  const n = a?.pics.length ?? 0;
  const go = (k: number) => { if (k >= 0 && k < n) { setI(k); setZoom(false); } };
  const round = (on: boolean, side: 'left' | 'right'): CSSProperties => ({ position: 'absolute', top: '46%', [side]: 12, transform: 'translateY(-50%)', width: 40, height: 40, padding: 0, border: 0, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lb-black-a55)', color: 'var(--lb-white)', cursor: on ? 'pointer' : 'default', opacity: on ? 1 : 0, pointerEvents: on ? 'auto' : 'none', transition: 'opacity 160ms ease' });

  return (
    <div className="screen" style={{ background: 'var(--lb-ink-deep)', color: 'var(--lb-white)', overflow: 'hidden' }}>
      <button type="button" aria-label={zoom ? 'Уменьшить фото' : 'Увеличить фото'} onClick={() => setZoom(!zoom)}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => { const s = start.current; start.current = null; if (!s || zoom) return; const dx = e.clientX - s.x; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) { e.preventDefault(); go(i + (dx < 0 ? 1 : -1)); } }}
        style={{ position: 'absolute', inset: 0, width: '100%', padding: 0, border: 0, overflow: 'hidden', background: 'var(--lb-ink)', cursor: zoom ? 'zoom-out' : 'zoom-in', touchAction: 'pan-y' }}>
        {a && <div role="img" aria-label={`${a.title}, фото ${i + 1}`} style={{ position: 'absolute', inset: 0, backgroundImage: `url(${a.pics[i]})`, backgroundSize: zoom ? '200%' : 'cover', backgroundPosition: 'center', transition: 'background-size 260ms cubic-bezier(.23,1,.32,1)' }} />}
      </button>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(12px + var(--safe-top)) var(--px) 12px', background: 'linear-gradient(var(--lb-ink-deep) 0%, var(--lb-black-a0) 100%)', pointerEvents: 'none' }}>
        <button type="button" aria-label="Закрыть" onClick={nav.back} className="pressable-xs" style={{ pointerEvents: 'auto', width: 44, height: 44, flex: 'none', border: 0, borderRadius: 999, background: 'var(--lb-white-a14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lb-white)', cursor: 'pointer' }}><X size={18} strokeWidth={2.2} aria-hidden /></button>
        <div aria-hidden style={{ flex: 1, display: 'flex', gap: 4 }}>
          {Array.from({ length: n }, (_, k) => <div key={k} style={{ flex: '1 1 0', height: 3, borderRadius: 999, background: k === i ? 'var(--lb-white)' : 'var(--lb-white-a25)', transition: 'background 200ms ease' }} />)}
        </div>
        <div style={{ flex: 'none', minWidth: 44, textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{n ? `${i + 1} / ${n}` : ''}</div>
      </div>
      <button type="button" aria-label="Предыдущее фото" aria-disabled={i === 0} onClick={() => go(i - 1)} style={round(i > 0, 'left')}><ChevronLeft size={18} strokeWidth={2.4} aria-hidden /></button>
      <button type="button" aria-label="Следующее фото" aria-disabled={i >= n - 1} onClick={() => go(i + 1)} style={round(i < n - 1, 'right')}><ChevronRight size={18} strokeWidth={2.4} aria-hidden /></button>
      {a && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: '44px var(--px) calc(24px + var(--safe-bottom))', background: 'linear-gradient(var(--lb-black-a0) 0%, var(--lb-ink-deep) 42%)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{a.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4, color: 'var(--lb-n-200)' }}>{a.caption}</div>
            </div>
            <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 999, background: 'var(--lb-white-a14)', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Search size={13} strokeWidth={2.4} aria-hidden /><span>{zoom ? 'Уменьшить' : 'Нажмите, чтобы увеличить'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {a.pics.map((p, k) => (
              <button key={p + k} type="button" aria-label={'Фото ' + (k + 1)} aria-pressed={k === i} onClick={() => go(k)} className="pressable-sm"
                style={{ width: 48, height: 60, padding: 0, border: 0, borderRadius: 10, cursor: 'pointer', backgroundImage: `url(${sized(p, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: k === i ? '0 0 0 2px var(--lime)' : 'inset 0 0 0 1px var(--lb-white-a14)', opacity: k === i ? 1 : 0.55, transition: 'opacity 160ms ease, box-shadow 160ms ease' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
