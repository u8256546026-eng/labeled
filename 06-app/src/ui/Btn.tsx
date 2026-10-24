import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../lib/cx';

/** Цвет кнопки по смыслу действия (README, «Кнопки: цвет по смыслу»). */
import type { BtnKind } from '../domain/view';
export type { BtnKind };

export type BtnProps = {
  kind?: BtnKind;
  small?: boolean;
  inline?: boolean;
  grow?: boolean;
  dis?: boolean;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  ariaLabel?: string;
};

export function Btn({ kind = 'ghost', small, inline, grow, dis, onClick, children, style, className, ariaLabel }: BtnProps) {
  return (
    <button
      type="button"
      aria-disabled={dis ? 'true' : 'false'}
      aria-label={ariaLabel}
      onClick={dis ? undefined : onClick}
      className={cx('btn', `btn--${dis ? 'off' : kind}`, small && 'btn--small', inline && 'btn--inline', grow && 'btn--grow', className)}
      style={style}
    >
      {children}
    </button>
  );
}

export type BtnSpec = { label: string; kind?: BtnKind; dis?: boolean; on?: () => void };

/** Группа кнопок (bBtns): столбик или строка с равными кнопками. */
export function Btns({ items, row }: { items: BtnSpec[]; row?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: row ? 'row' : 'column', gap: 8 }}>
      {items.map((b, i) => (
        <Btn key={i} kind={b.kind} dis={b.dis} grow={row} onClick={b.on}>{b.label}</Btn>
      ))}
    </div>
  );
}
