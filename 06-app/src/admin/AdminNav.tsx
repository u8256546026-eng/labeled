import { useEffect } from 'react';
import { live } from '../api/client';
import { useNav } from '../nav/useNav';
import { haptic } from '../telegram/tma';
import { adminLoad, useAdmin, visibleTasks } from './api';
import { staffPerms, type Perm } from './model';
import { Path } from './ui';

/** Разделы нижней панели админки (navItems в Labeled Admin): «Заказы» и «Каталог» — по правам роли. */
export const ADMIN_TABS: { path: string; label: string; perm: Perm | null; d: string }[] = [
  { path: '/admin', label: 'Задачи', perm: null, d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { path: '/admin/orders', label: 'Заказы', perm: 'orders', d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zM12 22V12M3.29 7 12 12l8.71-5' },
  { path: '/admin/catalog', label: 'Каталог', perm: 'catalog', d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
  { path: '/admin/more', label: 'Ещё', perm: null, d: 'M4 6h16M4 12h16M4 18h10' },
];

export function AdminNav({ active }: { active: string }) {
  const nav = useNav();
  const me = useAdmin((s) => s.me);
  const perms = me ? staffPerms(me) : [];
  const tasks = useAdmin((s) => visibleTasks(s).length);
  // С сервера очередь грузится сразу: счётчик на «Задачах» виден в любом разделе.
  useEffect(() => { if (live()) adminLoad.tasks().catch(() => {}); }, []);
  const items = ADMIN_TABS.filter((t) => !t.perm || perms.includes(t.perm));
  return (
    <nav aria-label="Разделы администратора" style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(16px + var(--safe-bottom))', zIndex: 3, background: 'var(--nav-bg)', border: '1px solid var(--lb-white-a72)', borderRadius: 26, boxShadow: '0 14px 30px -12px var(--lb-ink-a40), 0 2px 6px var(--lb-ink-a10), inset 0 1px 0 var(--lb-white-a92)', backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', padding: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 4 }}>
        {items.map((t) => {
          const on = t.path === active;
          return (
            <button key={t.path} type="button" aria-label={t.label} aria-current={on ? 'page' : undefined} className="pressable-xs"
              onClick={() => { if (on) return; haptic.select(); nav.root(t.path); }}
              style={{ height: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 0, borderRadius: 20, cursor: 'pointer', background: on ? 'var(--lime)' : 'transparent', color: 'var(--lb-ink)', transition: 'background 160ms ease', font: 'inherit' }}>
              <span style={{ position: 'relative', display: 'flex' }}>
                <Path d={t.d} size={22} sw={2.1} />
                {t.path === '/admin' && tasks > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--lb-danger)', color: 'var(--lb-white)', fontSize: 11, fontWeight: 700 }}>{tasks}</span>
                )}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em' }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
