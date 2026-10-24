// Блоки режима администратора — по построителям Labeled Admin (H, Note, Rows, KV, Chips, Field, Form,
// Seg, Stats, Empty, Photos, Steps). Тёмная шапка, пристыкованная нижняя панель, своя навигация.
import { Check, ChevronLeft, Copy } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fileUrl } from '../api/client';
import { copyText } from '../lib/clipboard';
import { runBackGuards } from '../nav/backGuard';
import { useNav } from '../nav/useNav';
import { haptic, hasNativeBack } from '../telegram/tma';
import { Btn, type BtnKind } from '../ui/Btn';
import { useShell } from '../ui/shellContext';
import { useToast } from '../ui/Toast';
import type { AdminIcon, PillTone } from './model';
import { ROLES } from './model';
import { useAdmin } from './api';
import { useDeskScroll } from '../lib/useDeskScroll';
import { sized } from '../lib/img';

/** Переключатель сегментов — в отдельном файле: его использует и профиль покупателя (StaffModeCard). */
export { Seg } from './Seg';

/** Пути иконок из макета (IC в Labeled Admin): подложка, цвет, контур. */
export const IC: Record<AdminIcon, [string, string, string]> = {
  card: ['var(--lb-warn-soft)', 'var(--lb-warn-ink)', 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM2 10h20'],
  link: ['var(--lb-lime-soft)', 'var(--lb-ink)', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  msg: ['var(--lb-danger-soft)', 'var(--lb-danger)', 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  camera: ['var(--lb-violet-soft)', 'var(--lb-violet)', 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  truck: ['var(--lb-info-soft)', 'var(--lb-info)', 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14M7 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4M17 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
  star: ['var(--lb-n-150)', 'var(--lb-ink)', 'M11.53 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.91l5.16-.75a2.12 2.12 0 0 0 1.6-1.16z'],
  chart: ['var(--lb-lime-soft)', 'var(--lb-ink)', 'M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3'],
  users: ['var(--lb-info-soft)', 'var(--lb-info)', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'],
  user: ['var(--lb-n-150)', 'var(--lb-ink)', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  image: ['var(--lb-violet-soft)', 'var(--lb-violet)', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4M21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21'],
  calc: ['var(--lb-warn-soft)', 'var(--lb-warn-ink)', 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01'],
  lock: ['var(--lb-n-150)', 'var(--lb-ink)', 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM7 11V7a5 5 0 0 1 10 0v4'],
  swap: ['var(--lb-ink-2)', 'var(--lime)', 'M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4'],
  box: ['var(--lb-lime-soft)', 'var(--lb-ink)', 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zM12 22V12M3.29 7 12 12l8.71-5M7.5 4.27l9 5.15'],
  heart: ['var(--lb-danger-soft)', 'var(--lb-danger)', 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  receipt: ['var(--lb-n-150)', 'var(--lb-ink)', 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1ZM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11'],
  addr: ['var(--lb-warn-soft)', 'var(--lb-warn-ink)', 'M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0M12 7a3 3 0 1 0 0 6 3 3 0 1 0 0-6'],
  check: ['var(--lb-lime-soft)', 'var(--lb-ink)', 'M21.8 10A10 10 0 1 1 17 3.34M9 11l3 3L22 4'],
  info: ['var(--lb-n-150)', 'var(--lb-ink)', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 16v-4M12 8h.01'],
  alert: ['var(--lb-danger-soft)', 'var(--lb-danger)', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 8v4M12 16h.01'],
  clock: ['var(--lb-warn-soft)', 'var(--lb-warn-ink)', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l4 2'],
  tag: ['var(--lb-n-150)', 'var(--lb-ink)', 'M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42zM7.5 7.5h.01'],
  palette: ['var(--lb-n-150)', 'var(--lb-ink)', 'M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10.8C22 5.9 17.5 2 12 2ZM7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2M10.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2M15.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2'],
};

export function Path({ d, size = 20, sw = 2 }: { d: string; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

export function IconBox({ name, size = 40 }: { name: AdminIcon; size?: number }) {
  const [bg, fg, d] = IC[name];
  return (
    <div aria-hidden style={{ width: size, height: size, flex: 'none', borderRadius: size > 40 ? 16 : 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, color: fg }}>
      <Path d={d} size={size > 40 ? 24 : 20} />
    </div>
  );
}

const PILL: Record<PillTone, [string, string]> = {
  live: ['var(--lb-limedeep-a40)', 'var(--lb-ink)'], wait: ['var(--lb-warn-soft)', 'var(--lb-warn-ink)'], err: ['var(--lb-danger-soft)', 'var(--lb-danger)'],
  info: ['var(--lb-info-soft)', 'var(--lb-info)'], violet: ['var(--lb-violet-soft)', 'var(--lb-violet)'], n: ['var(--lb-n-150)', 'var(--lb-ink-2)'], lime: ['var(--lime)', 'var(--lb-ink)'],
};
export const pillStyle = (tone: PillTone = 'n'): CSSProperties => ({ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', height: 21, padding: '0 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', background: PILL[tone][0], color: PILL[tone][1] });
export const Pill = ({ tone, children }: { tone?: PillTone; children: ReactNode }) => <span style={pillStyle(tone)}>{children}</span>;

const box: CSSProperties = { borderRadius: 18, background: 'var(--lb-white)', border: '1px solid var(--lb-ink-a08)' };
const group: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 18, overflow: 'hidden', background: 'var(--lb-ink-a08)', border: '1px solid var(--lb-ink-a08)' };

/** Тёмная шапка: метка «Админ · роль» на разделе или «‹ Назад» на вложенном экране (вне Telegram). */
export function AdminHeader({ title, sub, btn }: { title: string; sub?: string; btn?: { label: string; on: () => void } }) {
  const nav = useNav();
  const me = useAdmin((s) => s.me);
  const backRow = nav.depth > 0 && !hasNativeBack();
  const showRow = nav.depth === 0 || backRow || !!btn;
  return (
    <div className="top-fill" style={{ background: 'var(--lb-ink-2)', borderRadius: '0 0 22px 22px', padding: `calc(8px + var(--safe-top)) var(--px) 18px` }}>
      {showRow ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
          {backRow && (
            <button type="button" aria-label={'Назад: ' + nav.backLabel} onClick={() => { if (!runBackGuards()) nav.back(); }} className="pressable-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 0, padding: '0 6px 0 0', border: 0, background: 'none', fontSize: 13, fontWeight: 600, color: 'var(--lb-white)', cursor: 'pointer' }}>
              <ChevronLeft size={17} strokeWidth={2.4} style={{ flex: 'none' }} aria-hidden />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nav.backLabel}</span>
            </button>
          )}
          {nav.depth === 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px 0 8px', borderRadius: 999, background: 'var(--lime)', color: 'var(--lb-ink)', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.01em' }}>
              <Path d={IC.lock[2]} size={14} sw={2.4} />
              <span>Админ · {me ? ROLES[me.role].label : '—'}</span>
            </span>
          )}
          <div style={{ flex: 1 }} />
          {btn && (
            <button type="button" onClick={btn.on} className="pressable-sm"
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px 0 10px', border: 0, borderRadius: 999, background: 'var(--lime)', color: 'var(--lb-ink)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <Path d="M12 5v14M5 12h14" size={14} sw={2.6} />
              <span>{btn.label}</span>
            </button>
          )}
        </div>
      ) : <div style={{ height: 10 }} />}
      <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--lb-white)', textWrap: 'pretty' }}>{title}</h1>
      {sub && <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.4, color: 'var(--lb-white-a72)', textWrap: 'pretty' }}>{sub}</div>}
    </div>
  );
}

export type ABtn = { label: string; kind?: BtnKind; dis?: boolean; on?: () => void; full?: boolean };

/** Нижняя панель действий: пристыкована к краю экрана или к навигации, как в макете. */
export function AdminBar({ btns, cols = 1 }: { btns: ABtn[]; cols?: 1 | 2 }) {
  const ref = useRef<HTMLDivElement>(null);
  const { showNav, setBarH } = useShell();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight));
    ro.observe(el);
    setBarH(el.offsetHeight);
    return () => { ro.disconnect(); setBarH(0); };
  }, [setBarH]);
  return (
    <div ref={ref} style={{ position: 'absolute', left: 0, right: 0, bottom: showNav ? 'calc(96px + var(--safe-bottom))' : 0, zIndex: 2, display: 'grid', gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr', gap: 8, padding: `12px var(--px) ${showNav ? '8px' : 'calc(24px + var(--safe-bottom))'}`, background: 'var(--lb-n-50)', boxShadow: '0 -1px 0 var(--lb-ink-a08)' }}>
      {btns.map((b, i) => <Btn key={i} kind={b.kind ?? 'primary'} dis={b.dis} onClick={b.on} style={{ minHeight: 48, fontSize: 14.5, fontWeight: 600, gridColumn: b.full ? '1 / -1' : undefined }}>{b.label}</Btn>)}
    </div>
  );
}

/** Экран админки: тёмная шапка, блоки с шагом 12 px, нижняя панель. */
export function AdminScreen({ title, sub, btn, bar, barCols, children }: { title: string; sub?: string; btn?: { label: string; on: () => void }; bar?: ABtn[]; barCols?: 1 | 2; children: ReactNode }) {
  const { showNav, barH } = useShell();
  const tail = (bar?.length ? barH : 0) + (showNav ? 112 : 24);
  return (
    <>
      <div className="screen" data-scroll>
        <AdminHeader title={title} sub={sub} btn={btn} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px var(--px) 0', minWidth: 0 }}>{children}</div>
        <div style={{ height: `calc(${tail}px + var(--safe-bottom))` }} />
      </div>
      {bar && bar.length > 0 && <AdminBar btns={bar} cols={barCols} />}
    </>
  );
}

export function AH({ title, sub, link, on }: { title: string; sub?: string; link?: string; on?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '8px 2px 0' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>
        {sub && <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{sub}</div>}
      </div>
      {link && (
        <button type="button" onClick={on} className="pressable-sm" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 32, padding: '0 2px', border: 0, background: 'none', fontSize: 12.5, fontWeight: 700, color: 'var(--lb-ink)', cursor: 'pointer' }}>
          <span>{link}</span><Path d="m9 6 6 6-6 6" size={14} sw={2.4} />
        </button>
      )}
    </div>
  );
}

export function Stats({ items }: { items: [string, string | number, boolean?][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
      {items.map(([label, value, lime], i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 16, background: lime ? 'var(--lime)' : 'var(--lb-white)', boxShadow: lime ? 'none' : 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--lb-ink-2)' }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function Search({ ph, value, onChange }: { ph: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 16px', borderRadius: 999, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a10)' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" style={{ flex: 'none' }} aria-hidden><circle cx="10.6" cy="10.6" r="7" /><path d="M15.8 15.8 21 21" /></svg>
      <input type="search" aria-label={ph} placeholder={ph} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, fontWeight: 500, color: 'var(--lb-ink)' }} />
    </div>
  );
}

export type AChip = { label: string; n?: number | null; on_: boolean; act: () => void };

/** Чипсы-фильтры: прокручиваются по горизонтали, выбранный — тёмный, число — в лаймовом кружке. */
export function AChips({ label, items }: { label: string; items: AChip[] }) {
  const rail = useDeskScroll<HTMLDivElement>();
  return (
    <div ref={rail} role="group" aria-label={label} style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 calc(-1 * var(--px))', padding: '0 var(--px)', scrollbarWidth: 'none' }}>
      {items.map((c, i) => (
        <button key={i} type="button" aria-pressed={c.on_} onClick={c.act} className="pressable-sm"
          style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: c.n != null ? '0 6px 0 14px' : '0 14px', border: 0, borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', background: c.on_ ? 'var(--lb-ink-2)' : 'var(--lb-white)', color: c.on_ ? 'var(--lb-white)' : 'var(--lb-ink)', boxShadow: c.on_ ? 'none' : 'inset 0 0 0 1px var(--lb-ink-a10)', transition: 'background 160ms ease' }}>
          <span>{c.label}</span>
          {c.n != null && <span style={{ minWidth: 24, height: 24, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: c.on_ ? 'var(--lime)' : 'var(--lb-n-150)', color: 'var(--lb-ink)' }}>{c.n}</span>}
        </button>
      ))}
    </div>
  );
}

export type RowSpec = {
  title: string; sub?: string; img?: string; icon?: AdminIcon; pill?: string | null; tone?: PillTone; right?: string | number; chev?: boolean; on?: () => void; danger?: boolean;
  /** Покупатель или сотрудник: круглая аватарка из Telegram, пока её нет — значок человека. */
  ava?: { photo?: string };
  /** Маленькая аватарка перед подписью — кто сделал (журнал действий). */
  subAva?: { photo?: string; name: string };
  /** Текст для копирования: без on — копирует касание строки, с on — отдельная кнопка справа. */
  copy?: string;
};

/** Скопировать с подтверждением: тост «Скопировано» и лёгкая вибрация. */
export function useCopy() {
  const toast = useToast();
  const [done, setDone] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const copy = (text: string) => copyText(text).then((ok) => {
    if (!ok) return toast('Не получилось скопировать', 'error');
    haptic.light();
    toast('Скопировано');
    setDone(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(null), 1600);
  });
  return { copy, done };
}

/** Значок «копировать»; после копирования на секунду — галочка. */
const CopyMark = ({ done }: { done: boolean }) => (
  <span aria-hidden style={{ flex: 'none', display: 'flex', color: done ? 'var(--lb-ink)' : 'var(--lb-mute)' }}>{done ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} strokeWidth={2} />}</span>
);

/** Круглая аватарка: под фото — значок человека, он виден, пока фото грузится или если его нет. */
export function Ava({ photo, size = 44, label }: { photo?: string; size?: number; label: string }) {
  const src = fileUrl(photo);
  return (
    <div role="img" aria-label={label} style={{ position: 'relative', width: size, height: size, flex: 'none', borderRadius: 999, overflow: 'hidden', background: IC.user[0], color: IC.user[1], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Path d={IC.user[2]} size={Math.round(size * 0.45)} sw={2} />
      {src && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
    </div>
  );
}

/** Список в одной карточке с волосяными разделителями (Rows). */
export function Rows({ items }: { items: RowSpec[] }) {
  const { copy, done } = useCopy();
  return (
    <div style={group}>
      {items.map((r, i) => {
        const tap = r.on ?? (r.copy ? () => void copy(r.copy!) : undefined);
        const Tag = tap ? 'button' : 'div';
        const side = r.on && r.copy;
        const row = (
          <Tag key={i} {...(tap ? { type: 'button' as const, onClick: tap, className: 'press-row', ...(!r.on && r.copy ? { 'aria-label': `${r.title}: ${r.copy}. Скопировать` } : {}) } : {})}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: side ? '10px 4px 10px 14px' : '10px 14px', border: 0, background: 'var(--lb-white)', textAlign: 'left', cursor: tap ? 'pointer' : 'default', color: 'var(--lb-ink)', font: 'inherit', minWidth: 0 }}>
            {r.ava && <Ava photo={r.ava.photo} label={r.title} />}
            {r.img && !r.ava && <div role="img" aria-label={r.title} style={{ width: 48, height: 48, flex: 'none', borderRadius: 12, backgroundColor: 'var(--lb-n-150)', backgroundImage: `url(${sized(r.img, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
            {r.icon && !r.img && !r.ava && <IconBox name={r.icon} />}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty', color: r.danger ? 'var(--lb-danger)' : 'var(--lb-ink)' }}>{r.title}</div>
              {r.sub && (r.subAva
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}><Ava photo={r.subAva.photo} size={18} label={r.subAva.name} /><span style={{ minWidth: 0, textWrap: 'pretty' }}>{r.sub}</span></div>
                : <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{r.sub}</div>)}
              {r.pill && <span style={pillStyle(r.tone)}>{r.pill}</span>}
            </div>
            {r.right != null && <div style={{ flex: 'none', fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{r.right}</div>}
            {!r.on && r.copy && <CopyMark done={done === r.copy} />}
            {r.on && !side && r.chev !== false && <span style={{ color: 'var(--lb-mute)', display: 'flex' }}><Path d="m9 6 6 6-6 6" size={16} sw={2.2} /></span>}
          </Tag>
        );
        if (!side) return row;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch', background: 'var(--lb-white)' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>{row}</div>
            <button type="button" aria-label={'Скопировать: ' + r.copy} onClick={() => void copy(r.copy!)} className="press-row"
              style={{ flex: 'none', width: 52, border: 0, background: 'var(--lb-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <CopyMark done={done === r.copy} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export type KVRow = [string, string, ('total' | 'b' | 'err')?];

/**
 * Пары «название — значение». copy — касание строки копирует значение (телефон, адрес, реквизиты);
 * copyAs — что именно копировать, если на экране значение подписано («Т-Банк · 0000…» → номер);
 * copyAll — кнопка «Скопировать всё» у заголовка: весь блок одним текстом (например, для накладной CDEK).
 */
export function KV({ rows, title, copy: canCopy, copyAs, copyAll }: { rows: KVRow[]; title?: string; copy?: boolean; copyAs?: Record<number, string>; copyAll?: boolean }) {
  const { copy, done } = useCopy();
  const all = rows.filter(([, v]) => v && v !== '—').map(([k, v]) => `${k}: ${v}`).join('\n');
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: canCopy ? 0 : 10, padding: canCopy ? '8px 14px' : 14 }}>
      {(title || copyAll) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, ...(canCopy ? { padding: '6px 0 4px' } : {}) }}>
          {title && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--lb-ink-2)' }}>{title}</div>}
          {copyAll && (
            <button type="button" onClick={() => void copy(all)} className="pressable-sm"
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', border: 0, borderRadius: 999, background: done === all ? 'var(--lime)' : 'var(--lb-n-150)', color: 'var(--lb-ink)', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 160ms ease' }}>
              {done === all ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}{done === all ? 'Скопировано' : 'Скопировать всё'}
            </button>
          )}
        </div>
      )}
      {rows.map(([k, v, m], i) => {
        const text = copyAs?.[i] ?? v;
        const can = canCopy && !!text && text !== '—';
        const style: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 12, ...(m === 'total' ? { borderTop: '1px solid var(--lb-ink-a08)', paddingTop: 10 } : {}) };
        const inner = (
          <>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{k}</span>
            <span style={{ flex: 'none', maxWidth: '62%', textAlign: 'right', fontSize: m === 'total' ? 18 : 13.5, fontWeight: m === 'total' || m === 'b' ? 700 : 600, letterSpacing: m === 'total' ? '-0.02em' : 0, color: m === 'err' ? 'var(--lb-danger)' : 'var(--lb-ink)', textWrap: 'pretty', overflowWrap: 'anywhere' }}>{v}</span>
          </>
        );
        if (!canCopy) return <div key={i} style={style}>{inner}</div>;
        return (
          <button key={i} type="button" disabled={!can} onClick={() => void copy(text)} aria-label={can ? `${k}: ${text}. Скопировать` : undefined} className={can ? 'press-row' : undefined}
            style={{ ...style, alignItems: 'center', width: '100%', minHeight: 44, padding: '8px 0', border: 0, background: 'transparent', font: 'inherit', textAlign: 'left', color: 'inherit', cursor: can ? 'pointer' : 'default' }}>
            {inner}
            <span style={{ width: 15, flex: 'none', display: 'flex' }}>{can && <CopyMark done={done === text} />}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ANote({ tone, title, text }: { tone: 'ok' | 'wait' | 'err' | 'n'; title?: string; text: string }) {
  const T = { ok: ['var(--lb-lime-soft)', 'var(--lb-ink)', 'check'], wait: ['var(--lb-warn-soft)', 'var(--lb-warn-ink)', 'clock'], err: ['var(--lb-danger-soft)', 'var(--lb-danger)', 'alert'], n: ['var(--lb-white)', 'var(--lb-ink)', 'info'] }[tone] as [string, string, AdminIcon];
  return (
    <div role={tone === 'err' ? 'alert' : undefined} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 16, background: T[0], color: T[1], boxShadow: tone === 'n' ? 'inset 0 0 0 1px var(--lb-ink-a08)' : 'none' }}>
      <span style={{ flex: 'none', marginTop: 1, display: 'flex' }}><Path d={IC[T[2]][2]} size={18} sw={2.2} /></span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {title && <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{title}</div>}
        <div style={{ fontSize: 12.5, lineHeight: 1.45, textWrap: 'pretty' }}>{text}</div>
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, ph, multi, suffix, mode = 'text', readOnly }: { label: string; value: string; onChange?: (v: string) => void; ph?: string; multi?: boolean; suffix?: string; mode?: 'text' | 'numeric' | 'decimal'; readOnly?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lb-ink-2)' }}>{label}</span>
      {multi ? (
        <textarea className="adm-field" value={value} placeholder={ph} onChange={(e) => onChange?.(e.target.value)} rows={3} readOnly={readOnly}
          style={{ width: '100%', minHeight: 96, padding: '12px 14px', border: 0, outline: 0, borderRadius: 14, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a10)', font: 'inherit', fontSize: 16, fontWeight: 500, lineHeight: 1.4, color: 'var(--lb-ink)', resize: 'none' }} />
      ) : (
        <div className="adm-field" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 14px', borderRadius: 14, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a10)' }}>
          <input type="text" inputMode={mode === 'text' ? undefined : mode} value={value} placeholder={ph} onChange={(e) => onChange?.(e.target.value)} readOnly={readOnly}
            style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 16, fontWeight: 500, color: 'var(--lb-ink)' }} />
          {suffix && <span style={{ flex: 'none', fontSize: 14, fontWeight: 600, color: 'var(--lb-ink-2)' }}>{suffix}</span>}
        </div>
      )}
    </label>
  );
}

export type FormRow = { label: string; sub?: string; value: string; onChange: (v: string) => void; suffix?: string; wide?: boolean };

/** Строки настроек с полем справа и единицей в сером хвосте (Form в adm21). */
export function Form({ rows }: { rows: FormRow[] }) {
  return (
    <div style={group}>
      {rows.map((r, i) => (
        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, padding: '8px 10px 8px 14px', background: 'var(--lb-white)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{r.label}</span>
            {r.sub && <span style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{r.sub}</span>}
          </div>
          <div className="adm-num" style={{ flex: 'none', display: 'flex', alignItems: 'stretch', height: 44, borderRadius: 12, overflow: 'hidden', background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1.5px var(--lb-ink-a14)' }}>
            <input type="text" inputMode={r.wide ? undefined : 'decimal'} aria-label={r.label} value={r.value} onChange={(e) => r.onChange(e.target.value)}
              style={{ width: r.wide ? 160 : 72, padding: '0 12px', border: 0, outline: 0, background: 'transparent', textAlign: r.wide ? 'left' : 'right', font: 'inherit', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: 'var(--lb-ink)' }} />
            {r.suffix && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, padding: '0 10px', background: 'var(--lb-n-100)', borderLeft: '1px solid var(--lb-ink-a08)', fontSize: 13.5, fontWeight: 700 }}>{r.suffix}</span>}
          </div>
        </label>
      ))}
    </div>
  );
}

export type TogRow = { label: string; sub?: string; on_: boolean; act: () => void };

export function TogList({ items }: { items: TogRow[] }) {
  return (
    <div style={group}>
      {items.map((r, i) => (
        <button key={i} type="button" role="switch" aria-checked={r.on_} onClick={r.act} className="press-row"
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '10px 14px', border: 0, background: 'var(--lb-white)', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)', font: 'inherit' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{r.label}</span>
            {r.sub && <span style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{r.sub}</span>}
          </div>
          <Knob on={r.on_} />
        </button>
      ))}
    </div>
  );
}

export const Knob = ({ on }: { on: boolean }) => (
  <span aria-hidden style={{ width: 44, height: 26, flex: 'none', borderRadius: 999, padding: 2, background: on ? 'var(--lb-ink-2)' : 'var(--lb-n-200)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background 160ms ease' }}>
    <span style={{ width: 22, height: 22, borderRadius: 999, background: on ? 'var(--lime)' : 'var(--lb-white)', boxShadow: '0 1px 3px var(--lb-black-a25)' }} />
  </span>
);

export type RadioItem = { label: string; sub?: string; on_: boolean; act: () => void; /** недоступный вариант: виден, но не выбирается */ dis?: boolean };

export function RadioList({ aria, items }: { aria: string; items: RadioItem[] }) {
  return (
    <div role="radiogroup" aria-label={aria} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((r, i) => (
        <button key={i} type="button" role="radio" aria-checked={r.on_} aria-disabled={r.dis || undefined} onClick={r.dis ? undefined : r.act} className={r.dis ? undefined : 'pressable'}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '10px 14px', border: 0, borderRadius: 14, textAlign: 'left', cursor: r.dis ? 'default' : 'pointer', color: r.dis ? 'var(--lb-mute)' : 'var(--lb-ink)', font: 'inherit', background: r.on_ ? 'var(--lb-lime-soft)' : r.dis ? 'var(--lb-n-50)' : 'var(--lb-white)', boxShadow: r.on_ ? 'inset 0 0 0 1.5px var(--lb-limedeep-a40)' : 'inset 0 0 0 1px var(--lb-ink-a10)', transition: 'background 160ms ease' }}>
          <span aria-hidden style={{ width: 20, height: 20, flex: 'none', borderRadius: 999, border: r.on_ ? '6px solid var(--lb-ink-2)' : '2px solid var(--lb-n-300)', background: 'var(--lb-white)', transition: 'border 160ms ease' }} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{r.label}</span>
            {r.sub && <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{r.sub}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}


export type PhotoItem = { img?: string; cap?: string; aria?: string; on?: () => void };

/**
 * Фото с подписью и счётчиком (Photos). Пустая ячейка — «+ Фото»: если задан onPick,
 * открывает выбор файла; заполненная — по нажатию убирается (on).
 */
export function PhotoGrid({ title, sub, cnt, cntTone, cols = 3, ratio = '1 / 1', items, onPick, accept = 'image/*' }: { title: string; sub?: string; cnt?: string; cntTone?: PillTone; cols?: number; ratio?: string; items: PhotoItem[]; onPick?: (files: File[]) => void; accept?: string }) {
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{title}</span>
        {cnt && <span style={pillStyle(cntTone)}>{cnt}</span>}
      </div>
      {sub && <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{sub}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 8 }}>
        {items.map((p, i) => p.img ? (
          <button key={i} type="button" aria-label={p.aria ?? 'Убрать фото'} onClick={p.on} className="pressable"
            style={{ aspectRatio: ratio, border: 0, padding: 0, borderRadius: 12, cursor: p.on ? 'pointer' : 'default', backgroundColor: 'var(--lb-n-150)', backgroundImage: `url(${sized(p.img, 480)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ) : onPick ? (
          <label key={i} className="pressable" aria-label={p.aria ?? 'Добавить фото'}
            style={{ aspectRatio: ratio, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1.5px dashed var(--lb-ink-a28)', borderRadius: 12, background: 'var(--lb-n-50)', color: 'var(--lb-ink)', cursor: 'pointer' }}>
            <Path d="M12 5v14M5 12h14" size={18} sw={2.4} />
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>{p.cap ?? 'Фото'}</span>
            <input type="file" accept={accept} multiple style={{ display: 'none' }} onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) onPick(f); }} />
          </label>
        ) : (
          <button key={i} type="button" aria-label={p.aria ?? 'Добавить фото'} onClick={p.on} className="pressable"
            style={{ aspectRatio: ratio, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1.5px dashed var(--lb-ink-a28)', borderRadius: 12, background: 'var(--lb-n-50)', color: 'var(--lb-ink)', cursor: 'pointer', font: 'inherit' }}>
            <Path d="M12 5v14M5 12h14" size={18} sw={2.4} />
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>{p.cap ?? 'Фото'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Этапы заказа вертикальной шкалой (Steps в adm10). */
export function StepsV({ labels, cur, dates }: { labels: string[]; cur: number; dates: string[] }) {
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', padding: '16px 14px 2px' }}>
      {labels.map((l, i) => {
        const done = i < cur, now = i === cur, last = i === labels.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flex: 'none' }}>
              <span style={now ? { width: 12, height: 12, borderRadius: 999, background: 'var(--lime)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a14), 0 0 0 4px var(--lb-lime-a35)', flex: 'none' }
                : { width: 10, height: 10, marginTop: 1, borderRadius: 999, background: done ? 'var(--lb-lime-deep)' : 'var(--lb-white)', border: done ? 0 : '2px solid var(--lb-n-200)', flex: 'none' }} />
              {!last && <span style={{ width: 2, flex: 1, minHeight: 18, margin: '4px 0', borderRadius: 2, background: done ? 'var(--lb-lime-deep)' : 'var(--lb-n-150)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, marginTop: -3, paddingBottom: 14 }}>
              <span style={{ fontSize: 13.5, fontWeight: now ? 700 : 600, color: done || now ? 'var(--lb-ink)' : 'var(--lb-ink-3)' }}>{l}</span>
              {dates[i] && i <= cur && <span style={{ fontSize: 11.5, color: 'var(--lb-ink-2)' }}>{dates[i]}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AEmpty({ icon, title, text }: { icon: AdminIcon; title: string; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '48px 16px' }}>
      <IconBox name={icon} size={56} />
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--lb-ink-2)', maxWidth: 290, textWrap: 'pretty' }}>{text}</div>
    </div>
  );
}

export function BtnRow({ items, cols = 1 }: { items: ABtn[]; cols?: 1 | 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr', gap: 8 }}>
      {items.map((b, i) => <Btn key={i} kind={b.kind ?? 'primary'} dis={b.dis} onClick={b.on} style={{ minHeight: 48, fontSize: 14.5, gridColumn: b.full ? '1 / -1' : undefined }}>{b.label}</Btn>)}
    </div>
  );
}

export const cardBox = box;

/** Раздел ещё грузится с сервера или не загрузился. */
export function AdminLoading({ title, error, retry }: { title: string; error?: boolean; retry?: () => void }) {
  return (
    <AdminScreen title={title}>
      {error
        ? <AEmpty icon="alert" title="Нет соединения" text="Проверьте интернет и повторите. Изменения не пропадут." />
        : [0, 1, 2].map((i) => <div key={i} data-anim="pulse" style={{ height: 76, borderRadius: 18, background: 'var(--lb-n-150)', animation: 'lbPulse 1.4s ease-in-out infinite' }} />)}
      {error && retry && <BtnRow items={[{ label: 'Повторить', on: retry }]} />}
    </AdminScreen>
  );
}
