import { useCallback } from 'react';
import { useApp } from '../store/app';
import { useNav } from './useNav';

/**
 * Каталог открыт без входа. Вход требуется перед сохранением заказа, адресов и баллов;
 * после входа покупатель возвращается к прерванному действию (README, E).
 */
export function useRequireAuth() {
  const nav = useNav();
  const auth = useApp((s) => s.auth);
  return useCallback((path: string) => nav.go(auth ? path : '/auth?next=' + encodeURIComponent(path)), [nav, auth]);
}
