// Блоки заказа: bStatus, bHistBox, bParcel, bMat, bPhotos, bStars из Buyer v15 и карточка списка из Flow v12 (vOrders).
import { Check, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { useDeskScroll } from '../lib/useDeskScroll';
import { sized } from '../lib/img';
import type { HistRow, Tone } from '../domain/orders';
import { Btn, type BtnKind } from './Btn';
import { Steps } from './commerce';

const DOT: Record<Tone | 'stopped', CSSProperties> = {
  live: { background: 'var(--lime)', boxShadow: '0 0 0 3px var(--lb-lime-a35)' },
  wait: { background: 'var(--lb-warn)', boxShadow: '0 0 0 3px var(--lb-amber-a22)' },
  err: { background: 'var(--lb-danger)', boxShadow: '0 0 0 3px var(--lb-danger-a16)' },
  off: { background: 'var(--lime)', boxShadow: '0 0 0 3px var(--lb-lime-a35)' },
  stopped: { background: 'var(--lb-n-300)', boxShadow: 'none' },
};

/** Точный статус текстом над полосой этапов. */
export function StatusCard({ title, note, labels, cur, tone, stop }: { title: string; note: string; labels: string[]; cur: number; tone: Tone; stop?: { label: string; reason: string } }) {
  return (
    <section aria-label="Статус" style={{ padding: '16px 14px', border: '1px solid var(--line)', borderRadius: 18, background: 'var(--lb-white)', boxShadow: '0 10px 24px -18px var(--lb-ink-a55)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div aria-hidden style={{ width: 10, height: 10, flex: 'none', borderRadius: 999, ...DOT[stop ? 'stopped' : tone] }} />
        <div style={{ fontSize: 17.5, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.25 }}>{title}</div>
      </div>
      {note && <div style={{ marginTop: 8, fontSize: 'var(--f-small)', lineHeight: 1.45, color: 'var(--ink2)', textWrap: 'pretty' }}>{note}</div>}
      <div style={{ marginTop: 18 }}><Steps labels={labels} cur={cur} stopped={!!stop} bare /></div>
      {stop && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--lb-n-150)', fontSize: 'var(--f-small)', lineHeight: 1.45 }}>
          <div style={{ fontWeight: 600 }}>{stop.label}</div>
          <div style={{ marginTop: 4, color: 'var(--lb-ink-2)' }}>{stop.reason}</div>
        </div>
      )}
    </section>
  );
}

const MSG: Record<string, string> = {
  'Ждёт подтверждения': 'Продавец проверил ссылки, наличие и цену',
  'Оформлен — ждёт оплаты': 'Сумма подтверждена, выставлен счёт',
  'Оплата на проверке': 'Чек получен, продавец сверял поступление',
  'Оплачен': 'Оплата подтверждена продавцом',
  'Едет на склад': 'Продавец выкупил вещи, они едут на склад',
  'На складе в Китае': 'Вещи на складе. Посылки едут отдельно, доставку оплачиваете по каждой',
  'Едет в Россию': 'Посылка отправлена со склада в Китае',
  'Таможня': 'Посылка проходит таможенное оформление',
  'Едет на склад России': 'Посылка едет на склад в России',
  'Передано в CDEK': 'Появится трек для отслеживания',
  'В пути к вам': 'CDEK везёт посылку по адресу получения',
  'Доставлен': 'Посылка получена',
};
const GROUP: Record<string, string> = { 'Ждёт подтверждения': 'Оформление', 'Едет на склад': 'Китай', 'Едет в Россию': 'В Россию', 'Передано в CDEK': 'По России' };

/** Раскрываемая история: все бизнес-статусы с датами, сгруппированные по этапам. */
export function HistBox({ rows, defaultOpen = false }: { rows: HistRow[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const grouped = rows.length > 4;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 18, background: 'var(--lb-white)', overflow: 'hidden' }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', minHeight: 52, padding: '0 14px', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>История заказа</span>
        <ChevronDown size={18} strokeWidth={2.2} color="var(--lb-ink-3)" aria-hidden style={{ flex: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms cubic-bezier(.23,1,.32,1)' }} />
      </button>
      {open && (
        <ol style={{ listStyle: 'none', margin: 0, padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r, i) => {
            const cur = r.state === 'current', done = r.state === 'done', fut = r.state === 'future', stop = r.state === 'stop';
            const g = grouped ? GROUP[r.label] : undefined;
            const msg = !fut && MSG[r.label] ? (cur && r.date ? 'С ' + r.date + '. ' : '') + MSG[r.label] : '';
            return (
              <li key={r.label + i} aria-current={cur ? 'step' : undefined}>
                {g && <div style={{ margin: i === 0 ? '2px 4px 6px' : '10px 4px 6px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: fut ? 'var(--lb-ink-3)' : 'var(--lb-ink)' }}>{g}</div>}
                <div style={cur ? { display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 14, background: 'var(--lb-lime-soft)', boxShadow: 'inset 0 0 0 1px var(--lb-olive-a25)' } : { display: 'flex', alignItems: 'flex-start', gap: 12, padding: fut ? '6px 4px' : '8px 4px' }}>
                  <div aria-hidden style={{ width: 26, height: 26, flex: 'none', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cur ? 'var(--lb-ink)' : done ? 'var(--lime)' : stop ? 'var(--lb-n-300)' : 'var(--lb-n-50)', boxShadow: fut ? 'inset 0 0 0 1px var(--lb-ink-a10)' : 'none' }}>
                    {done && <Check size={13} strokeWidth={3.2} />}
                    {cur && <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--lime)' }} />}
                    {fut && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--lb-ink-3)' }}>{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0, fontSize: cur ? 14 : 12.5, lineHeight: 1.35, marginTop: cur ? 3 : 5, fontWeight: cur ? 700 : fut ? 500 : 600, color: fut ? 'var(--lb-ink-3)' : 'var(--lb-ink)' }}>{r.label}</div>
                      <div style={{ flex: 'none', fontSize: 11.5, fontWeight: cur ? 700 : 500, color: 'var(--lb-ink-2)', whiteSpace: 'nowrap', marginTop: cur ? 4 : 5 }}>{cur ? 'сейчас' : r.date ?? ''}</div>
                    </div>
                    {msg && <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, color: cur ? 'var(--lb-ink)' : 'var(--lb-ink-2)', textWrap: 'pretty' }}>{msg}</div>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Посылка: свой прогресс, состав, доставка, трек и действие. */
export function ParcelCard({ title, stage, labels, cur, items, rows, act }: { title: string; stage: string; labels: string[]; cur: number; items: { name: string; img: string }[]; rows: { label: string; value: string }[]; act?: { label: string; kind: BtnKind; on: () => void } }) {
  return (
    <section aria-label={title} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 18, background: 'var(--lb-white)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 'var(--f-small)', fontWeight: 600, color: 'var(--lb-ink-2)', textAlign: 'right' }}>{stage}</div>
      </div>
      <div style={{ marginTop: 14 }}><Steps labels={labels} cur={cur} bare /></div>
      <div style={{ height: 1, background: 'var(--lb-ink-a08)', margin: '14px 0 12px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => (
          <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div role="img" aria-label={it.name} style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, backgroundColor: 'var(--lb-n-150)', backgroundImage: `url(${sized(it.img, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--f-small)', lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{it.name}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, fontSize: 'var(--f-small)' }}>
            <span style={{ flex: 'none' }}>{r.label}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{r.value}</span>
          </div>
        ))}
      </div>
      {act && <Btn kind={act.kind} onClick={act.on} style={{ marginTop: 12, minHeight: 46 }}>{act.label}</Btn>}
    </section>
  );
}

export function Materials({ title, rows, pics }: { title: string; rows: { label: string; value: string }[]; pics?: string[] }) {
  return (
    <section aria-label={title} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 18, background: 'var(--lb-white)' }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 'var(--f-small)', flex: 'none' }}>{r.label}</span>
            <span style={{ fontSize: 'var(--f-small)', fontWeight: 600, lineHeight: 1.4, textAlign: 'right' }}>{r.value}</span>
          </div>
        ))}
      </div>
      {pics && pics.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {pics.map((p) => <div key={p} role="img" aria-label="Фото выкупа" style={{ width: 56, height: 56, flex: 'none', borderRadius: 12, backgroundImage: `url(${sized(p, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />)}
        </div>
      )}
    </section>
  );
}

export function Photos({ title, text, pics }: { title: string; text: string; pics: string[] }) {
  const rail = useDeskScroll<HTMLDivElement>();
  return (
    <section aria-label={title} style={{ padding: 14, borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>{text}</div>
      <div ref={rail} data-hs style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
        {pics.map((p) => <div key={p} role="img" aria-label={title} style={{ width: 64, height: 64, flex: 'none', borderRadius: 13, backgroundImage: `url(${sized(p, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />)}
      </div>
    </section>
  );
}

const STAR = 'M11.1 3.6c.37-.75 1.43-.75 1.8 0l2.06 4.18 4.61.67c.82.12 1.15 1.13.56 1.71l-3.34 3.25.79 4.59c.14.82-.72 1.44-1.45 1.06L12 16.9l-4.13 2.17c-.73.38-1.59-.24-1.45-1.06l.79-4.59-3.34-3.25c-.6-.58-.27-1.59.55-1.71l4.62-.67 2.06-4.18Z';
const CAPTION = ['Выберите оценку', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];

/** Оценка звёздами (bStars). */
export function Stars({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12, borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
      <div role="radiogroup" aria-label="Оценка" style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={n + ' из 5'} onClick={() => onPick(n)} className="pressable-xs"
            style={{ width: 48, height: 48, padding: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden><path d={STAR} style={{ fill: n <= value ? 'var(--lb-ink)' : 'var(--lb-n-200)', transition: 'fill 160ms ease' }} /></svg>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lb-ink-2)' }}>{CAPTION[value]}</div>
    </div>
  );
}

const TONE: Record<Tone, { fill: string; ink: string; dot: string; bar: string; card: string; line: string }> = {
  live: { fill: 'var(--lb-limedeep-a40)', ink: 'var(--lb-ink)', dot: 'var(--lime)', bar: 'var(--lime)', card: 'var(--lb-lime-tint)', line: 'var(--lb-olive-a25)' },
  wait: { fill: 'var(--lb-warn-soft)', ink: 'var(--lb-warn-ink)', dot: 'var(--lb-warn)', bar: 'var(--lb-warn)', card: 'var(--lb-warn-tint)', line: 'var(--lb-amber-a22)' },
  err: { fill: 'var(--lb-danger-soft)', ink: 'var(--lb-danger)', dot: 'var(--lb-danger)', bar: 'var(--lb-danger)', card: 'var(--lb-white)', line: 'var(--lb-danger-a25)' },
  off: { fill: 'var(--lb-n-150)', ink: 'var(--lb-ink)', dot: 'var(--lb-n-300)', bar: 'var(--lb-n-200)', card: 'var(--lb-n-50)', line: 'var(--line)' },
};

/** Карточка заказа в «Моих заказах» (Flow 7i): миниатюры, точный статус, номер, сводка и полоса этапов. */
export function OrderCard({ pre, num, name, kind, title, status, meta, tone, thumbs, step, of, dead, onClick }: {
  pre: string; num?: string; name: string; kind: string; title?: string; status: string; meta: string; tone: Tone; thumbs: string[]; step?: number; of?: number; dead?: boolean; onClick: () => void;
}) {
  const T = TONE[tone];
  return (
    <button type="button" onClick={onClick} className="pressable"
      style={{ display: 'block', width: '100%', padding: 12, border: '1px solid ' + T.line, borderRadius: 16, background: T.card, cursor: 'pointer', textAlign: 'left', color: 'var(--lb-ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flex: 'none' }}>
          {thumbs.length ? thumbs.map((src, i) => (
            <div key={src + i} aria-hidden style={{ width: 42, height: 42, borderRadius: 11, flex: 'none', backgroundImage: `url(${sized(src, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center', marginLeft: i ? -13 : 0, boxShadow: '0 0 0 2px var(--lb-white), inset 0 0 0 1px var(--lb-ink-a10)', filter: dead ? 'grayscale(1) opacity(.6)' : 'none' }} />
          )) : (
            <div aria-hidden style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lb-lime-soft)' }}><Link2 size={18} strokeWidth={2} /></div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: T.fill, maxWidth: '100%' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, flex: 'none', background: T.dot }} />
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: T.ink }}>{status}</span>
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 'var(--f-small)', lineHeight: 1.35 }}>{title ?? [pre + (num ? ' ' + num : ''), name, kind].filter(Boolean).join(' · ')}</div>
          <div style={{ marginTop: 2, fontSize: 'var(--f-small)', lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{meta}</div>
        </div>
        <ChevronRight size={18} strokeWidth={2.2} color="var(--lb-ink-3)" style={{ flex: 'none' }} aria-hidden />
      </div>
      {of != null && step != null && !dead && (
        <div aria-hidden style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {Array.from({ length: of }, (_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i < step ? T.bar : 'var(--lb-ink-a08)' }} />)}
        </div>
      )}
    </button>
  );
}

/** Заголовок группы в «Моих заказах»: метка, линия и число. */
export function GroupHead({ label, n, on }: { label: string; n: number; on: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div aria-hidden style={{ width: 7, height: 7, borderRadius: 999, flex: 'none', background: on ? 'var(--lime)' : 'var(--lb-n-200)' }} />
      <h2 style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--lb-ink-2)' }}>{label}</h2>
      <div aria-hidden style={{ height: 1, flex: 1, background: on ? 'var(--lb-olive-a25)' : 'var(--line)' }} />
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', flex: 'none', padding: '2px 8px', borderRadius: 999, background: on ? 'var(--lb-lime-a35)' : 'var(--lb-n-150)', color: on ? 'var(--lb-ink)' : 'var(--lb-ink-2)' }}>{n}</div>
    </div>
  );
}

/** Вертикальная лента этапов (bHist): пройденные — лайм, текущий — в лаймовой плашке. */
export function Timeline({ rows }: { rows: HistRow[] }) {
  const lime = 'var(--lime)', idle = 'var(--lb-n-150)';
  const reached = (s?: HistRow['state']) => s === 'done' || s === 'current';
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: '14px 14px 10px', borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
      {rows.map((h, i) => {
        const cur = h.state === 'current', done = h.state === 'done', fut = h.state === 'future';
        return (
          <li key={h.label + i} aria-current={cur ? 'step' : undefined} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div aria-hidden style={{ width: 14, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 2, height: cur ? 14 : 6, flex: 'none', background: i === 0 ? 'transparent' : reached(h.state) ? lime : idle }} />
              <div style={cur ? { width: 12, height: 12, flex: 'none', borderRadius: 999, background: lime, boxShadow: 'inset 0 0 0 1px var(--lb-ink-a14), 0 0 0 4px var(--lb-lime-a35)' }
                : done ? { width: 10, height: 10, flex: 'none', borderRadius: 999, background: lime, boxShadow: 'inset 0 0 0 1px var(--lb-ink-a14)' }
                : { width: 8, height: 8, flex: 'none', borderRadius: 999, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 2px var(--lb-n-200)' }} />
              <div style={{ width: 2, flex: '1 1 auto', minHeight: 6, background: i === rows.length - 1 ? 'transparent' : reached(rows[i + 1]?.state) ? lime : idle }} />
            </div>
            <div style={cur ? { flex: 1, minWidth: 0, margin: '4px 0 8px', padding: '10px 12px', borderRadius: 14, background: 'var(--lb-lime-soft)', boxShadow: 'inset 0 0 0 1px var(--lb-olive-a25)' }
              : { flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: fut ? '2px 0 7px' : '1px 0 8px' }}>
              <div style={{ fontSize: cur ? 14 : fut ? 12 : 12.5, lineHeight: 1.35, fontWeight: cur ? 700 : fut ? 500 : 600, color: fut ? 'var(--lb-ink-3)' : 'var(--lb-ink)', letterSpacing: cur ? '-0.015em' : 0 }}>{h.label}</div>
              {(h.date || cur) && <div style={cur ? { marginTop: 4, fontSize: 11.5, fontWeight: 600 } : { flex: 'none', fontSize: 11.5, color: 'var(--lb-ink-2)', whiteSpace: 'nowrap' }}>{cur ? (h.date ? 'Сейчас · с ' + h.date : 'Сейчас') : h.date}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
