import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routeMeta } from './routes';

/** Состояние записи истории: глубина стека и подпись для кнопки «назад». */
export type NavState = { depth: number; backLabel?: string; /** Путь экрана, с которого пришли. */ fromPath?: string };

export function readNavState(state: unknown): NavState {
  const s = state as Partial<NavState> | null;
  return { depth: s?.depth ?? 0, backLabel: s?.backLabel, fromPath: s?.fromPath };
}

/**
 * Навигация стеком, как в прототипе: go кладёт экран в стек, back снимает,
 * root открывает раздел нижней навигации с пустым стеком.
 */
export function useNav() {
  const navigate = useNavigate();
  const loc = useLocation();
  const st = readNavState(loc.state);
  const name = routeMeta(loc.pathname).name;

  const go = useCallback((to: string) => navigate(to, { state: { depth: st.depth + 1, backLabel: name, fromPath: loc.pathname } satisfies NavState }), [navigate, st.depth, name, loc.pathname]);
  const back = useCallback(() => { if (st.depth > 0) navigate(-1); }, [navigate, st.depth]);
  const root = useCallback((to: string) => navigate(to, { state: { depth: 0 } satisfies NavState }), [navigate]);
  const replace = useCallback((to: string) => navigate(to, { replace: true, state: st }), [navigate, st]);

  /** Собрать стек заново: первый путь — раздел, остальные кладутся сверху (например, профиль → заказы → заявка). */
  const reset = useCallback((paths: string[]) => {
    paths.forEach((to, i) => navigate(to, { state: { depth: i, backLabel: i ? routeMeta(paths[i - 1]).name : undefined, fromPath: i ? paths[i - 1] : undefined } satisfies NavState }));
  }, [navigate]);

  /** Вернуться на экран to, если пришли с него, иначе открыть его поверх. Без дублей в стеке. */
  const goOrBack = useCallback((to: string) => (st.depth > 0 && st.fromPath === to ? navigate(-1) : go(to)), [st.depth, st.fromPath, navigate, go]);

  return useMemo(() => ({ depth: st.depth, backLabel: st.backLabel ?? 'Назад', fromPath: st.fromPath, go, back, root, replace, goOrBack, reset }), [st.depth, st.backLabel, st.fromPath, go, back, root, replace, goOrBack, reset]);
}
