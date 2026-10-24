// Типы представления, общие для приложения и сервера (сервер собирает экраны заказа в этом виде).

/** Цвет кнопки по смыслу действия (README, «Кнопки: цвет по смыслу»). */
export type BtnKind = 'primary' | 'dark' | 'ghost' | 'danger' | 'dangerSoft' | 'violet' | 'limeSoft' | 'warn' | 'info' | 'off';

/** Строка суммы: подпись, значение, итоговая строка крупнее. */
export type SumRow = { label: string; value: string; total?: boolean };
