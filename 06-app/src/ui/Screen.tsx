import type { ReactNode } from 'react';
import { BottomBar, type BarSpec } from './BottomBar';
import { useShell } from './shellContext';

/**
 * Каркас экрана: прокручиваемая область, шапка, блоки с отступами и закреплённая панель.
 * bare — экран сам расставляет отступы (каталог, полноэкранные состояния).
 */
export function Screen({ header, children, bar, bare }: { header?: ReactNode; children: ReactNode; bar?: BarSpec; bare?: boolean }) {
  const { showNav } = useShell();
  const tail = (bar ? 90 : 0) + (showNav ? 100 : 24);
  return (
    <>
      <div className="screen" data-scroll>
        {header}
        {bare ? children : <div className="screen-body">{children}</div>}
        <div style={{ height: `calc(${tail}px + var(--safe-bottom))` }} />
      </div>
      {bar && <BottomBar bar={bar} />}
    </>
  );
}
