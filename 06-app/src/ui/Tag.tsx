import type { CSSProperties } from 'react';

/**
 * Тег состояния вещи. «новое» — лайм, «как новое» — светлый лайм, остальное — нейтральный.
 * service — служебный тег сводной цены «несколько предложений».
 */
export function tagStyle(cond: string, o: { service?: boolean; onPhoto?: boolean; big?: boolean } = {}): CSSProperties {
  const lime = cond === 'новое' && !o.service;
  const soft = cond === 'как новое' && !o.service;
  const ring = lime ? '' : 'inset 0 0 0 1px var(--lb-ink-a10)';
  const photo = o.onPhoto ? '0 3px 10px -5px var(--lb-ink-a65)' : '';
  return {
    display: 'inline-flex', alignItems: 'center',
    height: o.big ? 26 : 22, padding: o.big ? '0 11px' : '0 9px', borderRadius: 999,
    fontSize: 'var(--f-tag)', fontWeight: 600, letterSpacing: '-0.005em', whiteSpace: 'nowrap',
    background: lime ? 'var(--lime)' : soft ? 'var(--lb-lime-soft)' : 'var(--lb-n-150)',
    color: o.service ? 'var(--lb-ink-2)' : 'var(--lb-ink)',
    maxWidth: o.onPhoto ? '100%' : undefined,
    overflow: o.onPhoto ? 'hidden' : undefined,
    textOverflow: o.onPhoto ? 'ellipsis' : undefined,
    boxShadow: [ring, photo].filter(Boolean).join(', ') || 'none',
    transition: 'background 180ms ease',
  };
}

export function Tag({ cond, text, service, onPhoto, big }: { cond: string; text?: string; service?: boolean; onPhoto?: boolean; big?: boolean }) {
  return <span style={tagStyle(cond, { service, onPhoto, big })}>{text ?? cond}</span>;
}
