import { createContext, useContext } from 'react';

export type ShellCtx = {
  showNav: boolean;
  kb: boolean;
  barH: number;
  setBarH: (h: number) => void;
};

export const ShellContext = createContext<ShellCtx>({ showNav: false, kb: false, barH: 0, setBarH: () => {} });
export const useShell = () => useContext(ShellContext);

/** Нижняя граница закреплённой панели: над навигацией, над краем экрана или над клавиатурой. */
export const barBottom = (showNav: boolean) => (showNav ? 92 : 16);
