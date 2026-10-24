// Блоки оформления и заказов: bItems, bSum, bSteps, bFields, bRadio, bInput, bUpload из Buyer v15.
import { Check, ChevronRight, Plus } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Btn, type BtnKind } from './Btn';
import { sized } from '../lib/img';
import { cardStyle } from './blocks';
import { tagStyle } from './Tag';

const ERR_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#C2341D" aria-hidden><path d="M12 3.4 22 20.6H2Z" /><path d="M12 9.6v4.6" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="17.6" r="1.2" fill="#FFFFFF" /></svg>
);

export type ItemRow = {
  key: string; name: string; params: string; price: string; img?: string; qty?: string;
  tag?: string; sold?: boolean; serv?: string[];
  acts?: { label: string; kind?: BtnKind; on: () => void }[];
};

export function Items({ rows }: { rows: ItemRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ padding: 12, borderRadius: 18, background: 'var(--lb-white)', boxShadow: r.sold ? 'inset 0 0 0 1.5px var(--lb-danger-a50)' : 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div role="img" aria-label={r.name} style={{ width: 64, height: 64, flex: 'none', borderRadius: 13, backgroundColor: 'var(--lb-n-150)', backgroundImage: r.img ? `url(${sized(r.img, 240)})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', filter: r.sold ? 'grayscale(1) opacity(.55)' : 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty' }}>{r.name}</div>
              <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{r.params}</div>
              {(r.tag || r.sold) && (
                <div style={{ marginTop: 8 }}>
                  <span style={r.sold ? { display: 'inline-flex', alignItems: 'center', height: 21, padding: '0 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: 'var(--lb-danger-soft)', color: 'var(--lb-danger)' } : tagStyle(r.tag!)}>{r.sold ? 'продано' : r.tag}</span>
                </div>
              )}
              {r.serv && r.serv.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {r.serv.map((t) => <span key={t} style={tagStyle('service', { service: true })}>{t}</span>)}
                </div>
              )}
            </div>
            <div style={{ flex: 'none', textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{r.price}</div>
              {r.qty && <div style={{ marginTop: 4, fontSize: 11.5, whiteSpace: 'nowrap' }}>{r.qty}</div>}
            </div>
          </div>
          {r.acts && r.acts.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {r.acts.map((a) => <Btn key={a.label} kind={a.kind} small grow onClick={a.on}>{a.label}</Btn>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import type { SumRow } from '../domain/view';
export type { SumRow };

export function Sum({ rows, note }: { rows: SumRow[]; note?: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between', paddingTop: r.total ? 9 : 0, borderTop: r.total ? '1px solid var(--lb-ink-a10)' : 'none' }}>
          <div style={{ flex: '1 1 0', minWidth: 0, fontSize: r.total ? 13 : 12, fontWeight: r.total ? 700 : 500, lineHeight: 1.35, color: r.total ? 'var(--lb-ink)' : 'var(--lb-ink-2)', textWrap: 'pretty' }}>{r.label}</div>
          <div style={r.total ? { fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em', whiteSpace: 'nowrap' } : { flex: '0 1 auto', maxWidth: '58%', fontSize: 13, fontWeight: 600, textAlign: 'right', lineHeight: 1.35 }}>{r.value}</div>
        </div>
      ))}
      {note && <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{note}</div>}
    </div>
  );
}

/** Размер подписи этапа. Меньше не делаем: 9.8 px на телефоне не читались. */
const STAGE_PX = 11;

/**
 * Подписи всех этапов помещаются в колонки читаемым размером? Слова переносятся по пробелам,
 * поэтому сравниваем самое длинное слово с шириной колонки (Manrope, текущий — полужирный).
 */
function useStagesFit(labels: string[], cur: number) {
  const ref = useRef<HTMLOListElement>(null);
  const [fit, setFit] = useState(true);
  const key = labels.join('|') + cur;
  useLayoutEffect(() => {
    const el = ref.current;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!el || !ctx) return;
    const fam = getComputedStyle(el).fontFamily;
    const check = () => {
      const col = el.clientWidth / labels.length - 2;
      const need = Math.max(...labels.map((l, i) => {
        ctx.font = `${i === cur ? 700 : 500} ${STAGE_PX}px ${fam}`;
        return Math.max(...l.split(' ').map((w) => ctx.measureText(w).width));
      }));
      setFit(need <= col);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    void document.fonts?.ready.then(check);
    return () => ro.disconnect();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, fit };
}

/**
 * Горизонтальная полоса этапов: пройденные — лайм, текущий — точка с ореолом.
 * Если подписи всех этапов не помещаются (телефоны уже ~430 px), видна только подпись текущего —
 * крупнее, под его точкой; остальные остаются в списке для экранного диктора.
 */
export function Steps({ labels, cur, stopped, bare }: { labels: string[]; cur: number; stopped?: boolean; bare?: boolean }) {
  const { ref, fit } = useStagesFit(labels, cur);
  const pass = stopped ? 'var(--lb-n-300)' : 'var(--lime)';
  const idle = 'var(--lb-n-200)';
  const line = (on: boolean, hidden: boolean): CSSProperties => ({ flex: '1 1 0', height: 3, background: on ? pass : idle, visibility: hidden ? 'hidden' : 'visible' });
  const last = labels.length - 1;
  const body = (
    <ol ref={ref} aria-label="Этапы" style={{ display: 'flex', alignItems: 'flex-start', margin: 0, padding: 0, listStyle: 'none' }}>
      {labels.map((l, i) => {
        const done = i < cur, now = i === cur;
        // Компактно: подпись текущего этапа не переносится и у края прижимается к краю, а не выходит за карточку.
        const solo: CSSProperties = { marginTop: 9, fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, whiteSpace: 'nowrap', color: 'var(--lb-ink)',
          alignSelf: i === 0 ? 'flex-start' : i === last ? 'flex-end' : 'center' };
        return (
          <li key={l} aria-current={now ? 'step' : undefined} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: 19 }}>
              <div style={line(done || now, i === 0)} />
              <div style={now
                ? { width: 13, height: 13, borderRadius: 999, flex: 'none', background: stopped ? 'var(--lb-mute)' : pass, boxShadow: `0 0 0 2.5px var(--lb-white), 0 0 0 5.5px ${stopped ? 'var(--lb-ink-a14)' : 'var(--lb-lime-a35)'}` }
                : { width: 9, height: 9, borderRadius: 999, flex: 'none', background: done ? pass : idle }} />
              <div style={line(i < cur, i === last)} />
            </div>
            {fit
              ? <div style={{ marginTop: 10, fontSize: STAGE_PX, lineHeight: 1.25, textAlign: 'center', hyphens: 'none', overflowWrap: 'normal', fontWeight: now ? 700 : 500, color: done || now ? 'var(--lb-ink)' : 'var(--lb-ink-2)', padding: '0 1px' }}>{l}</div>
              : now
                ? <div style={solo}>{l}<span className="sr-only">, этап {i + 1} из {labels.length}</span></div>
                : <span className="sr-only">{l}</span>}
          </li>
        );
      })}
    </ol>
  );
  if (bare) return body;
  return <div style={{ padding: '14px 12px', borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>{body}</div>;
}

export type FieldRow = { label: string; value?: string; ph: string; on: () => void; err?: string };

/** Строка выбора, открывающая отдельный экран (способ получения, адрес). */
export function Fields({ rows }: { rows: FieldRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <button type="button" onClick={r.on} className="pressable" style={{ ...cardStyle(), boxShadow: r.err ? 'inset 0 0 0 1.5px var(--lb-danger-a50)' : 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--lb-ink-2)' }}>{r.label}</div>
              <div style={{ marginTop: 4, fontSize: 13.5, fontWeight: r.value ? 600 : 500, lineHeight: 1.35, color: r.value ? 'var(--lb-ink)' : 'var(--lb-ink-3)', textWrap: 'pretty' }}>{r.value || r.ph}</div>
            </div>
            <ChevronRight size={17} strokeWidth={2.4} color="var(--lb-ink-3)" style={{ flex: 'none' }} aria-hidden />
          </button>
          {r.err && <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 0 4px' }}>{ERR_ICON}<div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--lb-danger)' }}>{r.err}</div></div>}
        </div>
      ))}
    </div>
  );
}

export type RadioRow = { label: string; sub?: string; right?: string; on_: boolean; act: () => void; dis?: boolean };

export function Radio({ label, rows }: { label: string; rows: RadioRow[] }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <button key={r.label} type="button" role="radio" aria-checked={r.on_} aria-disabled={r.dis ? 'true' : 'false'} onClick={r.dis ? undefined : r.act} className={r.dis ? undefined : 'pressable'}
          style={{ ...cardStyle(), alignItems: 'flex-start', background: r.dis ? 'var(--lb-n-50)' : 'var(--lb-white)', boxShadow: r.on_ ? 'inset 0 0 0 2px var(--lime)' : 'inset 0 0 0 1px var(--lb-ink-a08)', cursor: r.dis ? 'default' : 'pointer' }}>
          <div style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.on_ ? 'var(--lime)' : 'var(--lb-white)', boxShadow: r.on_ ? 'none' : 'inset 0 0 0 1.5px var(--lb-ink-a28)', transition: 'background 160ms ease' }}>
            <Check size={11} strokeWidth={3.4} aria-hidden style={{ opacity: r.on_ ? 1 : 0, transition: 'opacity 140ms ease' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, color: r.dis ? 'var(--lb-mute)' : 'var(--lb-ink)', textWrap: 'pretty' }}>{r.label}</div>
            {r.sub && <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{r.sub}</div>}
          </div>
          {r.right && <div style={{ flex: 'none', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: r.dis ? 'var(--lb-mute)' : 'var(--lb-ink)' }}>{r.right}</div>}
        </button>
      ))}
    </div>
  );
}

export function Input({ label, value, onChange, ph, mode = 'text', err, hint, max }: { label: string; value: string; onChange: (v: string) => void; ph?: string; mode?: 'text' | 'numeric' | 'tel' | 'email' | 'url'; err?: string; hint?: string; max?: number }) {
  const id = useId();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 0 6px 4px' }}>
        <label htmlFor={id} style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--lb-ink-2)' }}>{label}</label>
        {max != null && <div style={{ flex: 'none', fontSize: 11, fontWeight: 600, color: value.length >= max ? 'var(--lb-danger)' : 'var(--lb-ink-2)' }}>{value.length} / {max}</div>}
      </div>
      <input id={id} type="text" inputMode={mode} value={value} placeholder={ph} maxLength={max} aria-invalid={!!err} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', minHeight: 50, padding: '0 14px', border: 0, borderRadius: 15, background: 'var(--lb-white)', color: 'var(--lb-ink)', fontSize: 16, fontWeight: 500, boxShadow: err ? 'inset 0 0 0 1.5px var(--lb-danger-a50)' : 'inset 0 0 0 1px var(--lb-ink-a10)' }} />
      {err && <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 0 4px' }}>{ERR_ICON}<div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--lb-danger)' }}>{err}</div></div>}
      {hint && <div style={{ margin: '6px 0 0 4px', fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>{hint}</div>}
    </div>
  );
}

export type UploadFile = { name: string; meta: string; preview?: string };

/** Прикрепление чека или фото. Выбор файла — нативный, через скрытый input. */
export function Upload({ file, title, text, err, accept, onPick, onClear, onRetry, max }: { file?: UploadFile | null; title: string; text: string; err?: string; accept: string; onPick: (f: File, all: File[]) => void; onClear: () => void; onRetry?: () => void; /** Несколько файлов за раз, не больше max. */ max?: number }) {
  const id = useId();
  const input = <input id={id} type="file" accept={accept} multiple={!!max && max > 1} hidden onChange={(e) => { const all = Array.from(e.target.files ?? []).slice(0, max ?? 1); if (all[0]) onPick(all[0], all); e.target.value = ''; }} />;
  return (
    <div style={{ padding: 12, borderRadius: 18, background: 'var(--lb-white)', boxShadow: err ? 'inset 0 0 0 1.5px var(--lb-danger-a50)' : 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
      {input}
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div role="img" aria-label={file.name} style={{ width: 46, height: 46, flex: 'none', borderRadius: 13, backgroundColor: 'var(--lb-n-150)', backgroundImage: file.preview ? `url(${file.preview})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
            <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--lb-ink-2)' }}>{file.meta}</div>
          </div>
          <button type="button" onClick={onClear} className="pressable-sm" style={{ flex: 'none', minHeight: 40, padding: '0 14px', border: 0, borderRadius: 12, background: 'var(--lb-n-150)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Заменить</button>
        </div>
      ) : (
        <label htmlFor={id} className="pressable" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <div aria-hidden style={{ width: 46, height: 46, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: 'var(--lb-n-150)' }}><Plus size={20} strokeWidth={2.2} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
            <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>{text}</div>
          </div>
        </label>
      )}
      {err && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {ERR_ICON}
          <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, color: 'var(--lb-danger)' }}>{err}</div>
          {onRetry && <button type="button" onClick={onRetry} className="pressable-sm" style={{ flex: 'none', minHeight: 36, padding: '0 12px', border: 0, borderRadius: 11, background: 'var(--lb-ink-2)', color: 'var(--lb-white)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ещё раз</button>}
        </div>
      )}
    </div>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>;
}
