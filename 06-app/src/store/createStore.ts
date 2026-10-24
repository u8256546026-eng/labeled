import { useSyncExternalStore } from 'react';

export type Store<S> = {
  get: () => S;
  set: (patch: Partial<S> | ((s: S) => Partial<S>)) => void;
  subscribe: (fn: () => void) => () => void;
};

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      subs.forEach((f) => f());
    },
    subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}

/** Селектор должен возвращать примитив или уже существующую ссылку из состояния. */
export function useStore<S extends object, T>(store: Store<S>, sel: (s: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()));
}
