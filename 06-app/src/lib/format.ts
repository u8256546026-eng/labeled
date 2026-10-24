const group = (n: number, sep: string) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/** 12 400 ₽ — тонкий пробел между разрядами, как в макетах. */
export const rub = (n: number) => group(n, ' ') + ' ₽';
export const yuan = (n: number) => group(n, ' ') + ' ¥';
export const num = (n: number) => group(n, ' ');
/** Разделитель для полей ввода и чипсов фильтра (неразрывный пробел). */
export const numNbsp = (n: number | string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** plural(5, 'вещь', 'вещи', 'вещей') → 'вещей' */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
