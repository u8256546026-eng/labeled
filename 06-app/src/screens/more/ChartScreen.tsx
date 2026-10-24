import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { catalogApi } from '../../api/catalog';
import { useApi } from '../../lib/useApi';
import { Btns } from '../../ui/Btn';
import { Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { sizeHelpSheet } from '../link/LinkScreen';

/** AU — размерная сетка продавца с увеличением. Если сетки нет, карточка сразу открывает помощь с размером. */
export function ChartScreen() {
  const { id = '' } = useParams();
  const sheet = useSheet();
  const p = useApi(() => catalogApi.product(id), [id], 'product:' + id);
  const q = { data: p.data === undefined ? undefined : p.data?.sizeChart ?? null };
  const [zoom, setZoom] = useState(1);
  const zb = { width: 40, height: 40, flex: 'none', border: 0, borderRadius: 12, background: 'var(--lb-n-150)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;
  return (
    <Screen header={<Header title="Размерная сетка" />}>
      {q.data === undefined ? <Skel n={2} /> : q.data && (
        <div style={{ borderRadius: 18, overflow: 'hidden', background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
          <div data-hs style={{ height: 330, overflow: 'auto', background: 'var(--lb-n-150)' }}>
            <div role="img" aria-label="Размерная сетка продавца" style={{ width: 600 * zoom, height: 760 * zoom, backgroundImage: `url(${q.data})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--line)' }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--lb-ink-2)' }}>Изображение загружено продавцом</div>
            <button type="button" aria-label="Уменьшить" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="pressable-xs" style={zb}><Minus size={17} strokeWidth={2.4} /></button>
            <button type="button" aria-label="Увеличить" onClick={() => setZoom((z) => Math.min(2, z + 0.25))} className="pressable-xs" style={zb}><Plus size={17} strokeWidth={2.4} /></button>
          </div>
        </div>
      )}
      <Btns items={[{ label: 'Помощь с размером в Telegram', kind: 'violet', on: () => sheet.open(sizeHelpSheet(p.data?.name)) }]} />
    </Screen>
  );
}
