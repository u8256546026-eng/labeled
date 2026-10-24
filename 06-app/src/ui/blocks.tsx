// Повторяющиеся блоки экранов. Имена и стили — по построителям bH, bP, bNote, bEmpty, bChips,
// bTog, bReasons, bRange, bCards, bSkel из Buyer v15.
import { Check, ChevronRight, Clock } from 'lucide-react';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { chipOut } from '../lib/motion';
import { sized } from '../lib/img';
import { Btn, type BtnSpec } from './Btn';

export function H({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="h-block">
      <h2 className="h-block__title" style={{ margin: 0 }}>{text}</h2>
      {sub && <div className="h-block__sub">{sub}</div>}
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <div className="p-block">{children}</div>;
}

type Tone = 'ok' | 'info' | 'wait' | 'err';
const TONE: Record<Tone, { bg: string; ring: string; ic: string }> = {
  ok: { bg: 'var(--lb-lime-soft)', ring: 'var(--lb-olive-a25)', ic: 'var(--lime)' },
  info: { bg: 'var(--lb-white)', ring: 'var(--lb-ink-a08)', ic: 'var(--lb-n-150)' },
  wait: { bg: 'var(--lb-warn-tint)', ring: 'var(--lb-amber-a22)', ic: 'var(--lb-warn-line)' },
  err: { bg: 'var(--lb-danger-soft)', ring: 'var(--lb-danger-a25)', ic: 'var(--lb-danger)' },
};

export function Note({ tone, title, text, act }: { tone: Tone; title?: string; text: string; act?: { label: string; on: () => void } }) {
  const T = TONE[tone];
  const icon = tone === 'ok' ? <Check size={13} strokeWidth={3} color="#111111" />
    : tone === 'err' ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round"><path d="M12 6.5v7.2" /><path d="M12 17.4v.1" /></svg>
    : tone === 'wait' ? <Clock size={13} strokeWidth={2.6} color="#111111" />
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.6" strokeLinecap="round"><path d="M12 10.6v7" /><path d="M12 6.4v.1" /></svg>;
  return (
    <div role={tone === 'err' ? 'alert' : undefined} style={{ padding: 12, borderRadius: 17, background: T.bg, boxShadow: `inset 0 0 0 1px ${T.ring}` }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div aria-hidden style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.ic }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{title}</div>}
          <div style={{ marginTop: title ? 4 : 0, fontSize: 12.5, lineHeight: 1.45, textWrap: 'pretty' }}>{text}</div>
          {act && (
            <button type="button" onClick={act.on} className="pressable-sm"
              style={{ marginTop: 10, minHeight: 40, padding: '0 16px', border: 0, borderRadius: 12, background: 'var(--lb-ink-2)', color: 'var(--lb-white)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{act.label}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Empty({ title, text, btns = [], minH = 600 }: { title: string; text: string; btns?: BtnSpec[]; minH?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: minH, padding: '0 18px 20px' }}>
      <div aria-hidden style={{ width: 74, height: 74, borderRadius: 24, background: 'var(--lb-n-150)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.9 20.6 7.5v9L12 21.1 3.4 16.5v-9Z" /><path d="M3.4 7.5 12 12.1l8.6-4.6M12 12.1v9" /></svg>
      </div>
      <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.45, color: 'var(--lb-ink-2)', maxWidth: 270, textWrap: 'pretty' }}>{text}</div>
      {btns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 18 }}>
          {btns.map((b, i) => <Btn key={i} kind={b.kind} dis={b.dis} onClick={b.on}>{b.label}</Btn>)}
        </div>
      )}
    </div>
  );
}

export function Skel({ n = 4 }: { n?: number }) {
  return (
    <div className="skel-grid" data-anim="pulse" role="status" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: n }, (_, i) => (
        <div key={i}><div className="skel-grid__img" /><div className="skel-grid__l1" /><div className="skel-grid__l2" /></div>
      ))}
    </div>
  );
}

export type ChipSpec = { label: string; on_: boolean; act: () => void; dot?: string; n?: number | null };

export function Chips({ label, rows }: { label: string; rows: ChipSpec[] }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {rows.map((r, i) => (
        <button key={i} type="button" aria-pressed={r.on_} onClick={r.act} className="pressable"
          style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 16px', border: 0, borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--lb-ink)', background: r.on_ ? 'var(--lime)' : 'var(--lb-white)', boxShadow: r.on_ ? 'none' : 'inset 0 0 0 1px var(--lb-ink-a14)', transition: 'background 160ms ease, box-shadow 160ms ease' }}>
          {r.dot && <span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, background: r.dot, boxShadow: 'inset 0 0 0 1px var(--lb-ink-a14)', flex: 'none' }} />}
          <span>{r.label}</span>
          {r.n != null && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--lb-ink-3)' }}>{r.n}</span>}
        </button>
      ))}
    </div>
  );
}

export type TogSpec = { label: string; sub?: string; on_: boolean; act: () => void; dis?: boolean; icon?: ReactNode; iconBg?: string; iconFg?: string };

export function Tog({ rows }: { rows: TogSpec[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => (
        <button key={i} type="button" role="switch" aria-checked={r.on_} aria-disabled={r.dis ? 'true' : 'false'} onClick={r.dis ? undefined : r.act} className="pressable" style={{ ...cardStyle(), alignItems: 'center', cursor: r.dis ? 'default' : 'pointer' }}>
          {r.icon && (
            <div aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.dis ? 'var(--lb-n-100)' : r.iconBg, color: r.dis ? 'var(--lb-mute)' : r.iconFg }}>{r.icon}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, color: r.dis ? 'var(--lb-mute)' : 'var(--lb-ink)' }}>{r.label}</div>
            {r.sub && <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{r.sub}</div>}
          </div>
          <div style={{ width: 48, height: 28, flex: 'none', borderRadius: 999, padding: 4, display: 'flex', justifyContent: r.on_ ? 'flex-end' : 'flex-start', background: r.dis ? 'var(--lb-n-150)' : r.on_ ? 'var(--lb-ink-2)' : 'var(--lb-n-200)', transition: 'background 190ms ease' }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--lb-white)', boxShadow: '0 1px 3px var(--lb-black-a25)' }} />
          </div>
        </button>
      ))}
    </div>
  );
}

export type ReasonSpec = { label: string; sub: string; on_: boolean; act: () => void; wide?: boolean };

/** Плитки выбора в две колонки (bReasons): состояние вещи, причина обращения. */
export function Reasons({ label, rows, multi }: { label: string; rows: ReasonSpec[]; multi?: boolean }) {
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
      {rows.map((r, i) => (
        <button key={i} type="button" {...(multi ? { 'aria-pressed': r.on_ } : { role: 'radio', 'aria-checked': r.on_ })} onClick={r.act} className="pressable"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minHeight: 76, padding: 12, border: 0, borderRadius: 16, textAlign: 'left', cursor: 'pointer', gridColumn: r.wide ? '1 / -1' : 'auto', minWidth: 0, background: r.on_ ? 'var(--lime)' : 'var(--lb-white)', boxShadow: r.on_ ? 'inset 0 0 0 1.5px var(--lb-ink)' : 'inset 0 0 0 1px var(--lb-ink-a10)', transition: 'background 160ms ease, box-shadow 160ms ease' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, color: 'var(--lb-ink)' }}>{r.label}</span>
          <span style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.35, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{r.sub}</span>
        </button>
      ))}
    </div>
  );
}

export type RangeSpec = { label: string; value: string; ph: string; on: (v: string) => void };

export function Range({ rows }: { rows: RangeSpec[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
      {rows.map((r, i) => (
        <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', borderRadius: 16, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', cursor: 'text' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lb-ink-2)' }}>{r.label}</span>
          <input type="text" inputMode="numeric" value={r.value} placeholder={r.ph} onChange={(e) => r.on(e.target.value)}
            style={{ width: '100%', minWidth: 0, border: 0, outline: 'none', padding: 0, background: 'transparent', font: 'inherit', fontSize: 16, fontWeight: 700, color: 'var(--lb-ink)' }} />
        </label>
      ))}
    </div>
  );
}

export const cardStyle = (sel = false): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: 12, border: 0, borderRadius: 17,
  background: 'var(--lb-white)', boxShadow: sel ? 'inset 0 0 0 2px var(--lb-ink)' : 'inset 0 0 0 1px var(--lb-ink-a08)', cursor: 'pointer', color: 'var(--lb-ink)',
});

export type CardSpec = {
  title: string; sub?: string; on?: () => void; chev?: boolean; icon?: ReactNode; iconBg?: string; iconFg?: string; right?: string;
  /** Плашка над заголовком. */
  pill?: string; pillTone?: 'live' | 'wait' | 'err' | 'n';
  /** Аватар или фото вместо иконки. */
  img?: string; danger?: boolean;
};

const PILL = { live: ['var(--lb-limedeep-a40)', 'var(--lb-ink)'], wait: ['var(--lb-warn-soft)', 'var(--lb-ink)'], err: ['var(--lb-danger-soft)', 'var(--lb-danger)'], n: ['var(--lb-n-150)', 'var(--lb-ink)'] } as const;

export function Cards({ rows }: { rows: CardSpec[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => {
        const Tag = r.on ? 'button' : 'div';
        return (
          <Tag key={i} {...(r.on ? { type: 'button' as const, onClick: r.on, className: 'pressable' } : {})} style={{ ...cardStyle(), cursor: r.on ? 'pointer' : 'default', alignItems: r.img ? 'flex-start' : 'center' }}>
            {r.img && <div aria-hidden style={{ width: 46, height: 46, flex: 'none', borderRadius: 13, backgroundColor: 'var(--lb-n-150)', backgroundImage: `url(${sized(r.img, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
            {r.icon && !r.img && <div aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.iconBg, color: r.iconFg }}>{r.icon}</div>}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {r.pill && <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', height: 21, padding: '0 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: PILL[r.pillTone ?? 'n'][0], color: PILL[r.pillTone ?? 'n'][1] }}>{r.pill}</div>}
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty', color: r.danger ? 'var(--lb-danger)' : 'var(--lb-ink)' }}>{r.title}</div>
              {r.sub && <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{r.sub}</div>}
            </div>
            {r.right && <div style={{ flex: 'none', fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{r.right}</div>}
            {r.chev !== false && r.on && <ChevronRight size={17} strokeWidth={2.4} color="var(--lb-ink-3)" style={{ flex: 'none', alignSelf: 'center' }} aria-hidden />}
          </Tag>
        );
      })}
    </div>
  );
}

/** Чипс активного фильтра с крестиком: появляется за 180 мс, при снятии сжимается за 140 мс. */
export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} type="button" data-anim="chip" aria-label={'Убрать фильтр ' + label} onClick={() => chipOut(ref.current, onRemove)} className="pressable-sm"
      style={{ animation: 'lbChipIn 180ms cubic-bezier(.23,1,.32,1) both', display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px 0 12px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--lb-white)', color: 'var(--ink)', fontSize: 'var(--f-small)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none' }}>
      <span>{label}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M5 5l14 14M19 5 5 19" /></svg>
    </button>
  );
}
