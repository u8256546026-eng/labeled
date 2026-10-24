import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { photoReportApi } from '../../api/afterSale';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { Empty, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { sized } from '../../lib/img';

/** V — фотоотчёт со склада. Фото загружает сотрудник в админке (adm12); покупатель смотрит и открывает на весь экран. */
export function PhotoReportScreen() {
  const { num = '' } = useParams();
  const nav = useNav();
  const q = useApi(() => photoReportApi.get(num), [num], 'report:' + num, { live: true });
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(1);
  const r = q.data;
  const ctl = { width: 44, height: 40, border: 0, background: 'transparent', color: 'var(--lb-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;
  const arrow = (side: 'left' | 'right') => ({ position: 'absolute', [side]: 10, top: '50%', marginTop: -22, width: 44, height: 44, border: 0, borderRadius: 999, background: 'var(--lb-white-a92)', color: 'var(--lb-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px var(--lb-black-a25)' }) as const;

  return (
    <Screen header={<Header title="Фотоотчёт" sub={`Заказ ${num}${r ? ' · ' + r.place.charAt(0).toLowerCase() + r.place.slice(1) : ''}`} />}
      bar={r ? { btns: [{ label: 'Проблема с заказом', kind: 'primary', on: () => nav.go('/claim/' + num) }] } : undefined}>
      {q.data === undefined ? <Skel n={2} /> : !r ? (
        <Empty minH={500} title="Фотоотчёта пока нет" text="Появится, когда вещи придут на склад в Китае" btns={[{ label: 'К заказу', kind: 'primary', on: nav.back }]} />
      ) : (
        <>
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: 'var(--lb-ink)' }}>
            <button type="button" aria-label="Открыть фото на весь экран" onClick={() => nav.go(`/viewer/report/${num}?i=${i}`)} data-hs
              style={{ display: 'flex', width: '100%', height: 400, overflow: 'auto', padding: 0, border: 0, background: 'transparent', cursor: 'zoom-in' }}>
              <div role="img" aria-label={`Фото ${i + 1} из ${r.pics.length}`} style={{ flex: 'none', margin: 'auto', width: `${100 * zoom}%`, height: 400 * zoom, backgroundImage: `url(${r.pics[i]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            </button>
            <div style={{ position: 'absolute', top: 12, left: 12, padding: '6px 10px', borderRadius: 999, background: 'var(--lb-ink-a65)', color: 'var(--lb-white)', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{i + 1} / {r.pics.length}</div>
            <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'center', borderRadius: 999, background: 'var(--lb-ink-a65)', color: 'var(--lb-white)' }}>
              <button type="button" aria-label="Уменьшить" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} style={ctl}><Minus size={16} strokeWidth={2.4} /></button>
              <div style={{ minWidth: 40, textAlign: 'center', fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</div>
              <button type="button" aria-label="Увеличить" onClick={() => setZoom((z) => Math.min(2, z + 0.25))} style={ctl}><Plus size={16} strokeWidth={2.4} /></button>
            </div>
            {i > 0 && <button type="button" aria-label="Предыдущее фото" onClick={() => { setI(i - 1); setZoom(1); }} className="pressable-xs" style={arrow('left')}><ChevronLeft size={20} strokeWidth={2.4} /></button>}
            {i < r.pics.length - 1 && <button type="button" aria-label="Следующее фото" onClick={() => { setI(i + 1); setZoom(1); }} className="pressable-xs" style={arrow('right')}><ChevronRight size={20} strokeWidth={2.4} /></button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {r.pics.map((p, k) => (
              <button key={p} type="button" aria-label={'Фото ' + (k + 1)} aria-pressed={k === i} onClick={() => { setI(k); setZoom(1); }}
                style={{ flex: '1 1 0', minWidth: 0, height: 72, padding: 0, border: 0, borderRadius: 12, cursor: 'pointer', backgroundImage: `url(${sized(p, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: k === i ? 'inset 0 0 0 2px var(--lb-ink), inset 0 0 0 4px var(--lb-white)' : 'inset 0 0 0 1px var(--lb-ink-a08)', opacity: k === i ? 1 : 0.6 }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 2px' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Фото {i + 1} из {r.pics.length}</div>
            <div style={{ fontSize: 12, color: 'var(--lb-ink-2)' }}>{r.place} · {r.date}</div>
          </div>
        </>
      )}
    </Screen>
  );
}
