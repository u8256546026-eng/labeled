import { matchPath } from 'react-router-dom';

/**
 * Метаданные экранов: подпись «назад» для следующего экрана (backName в Buyer v15),
 * раздел нижней навигации и цвет верха экрана для системной шапки Telegram.
 */
export type Chrome = 'lime' | 'bg' | 'dark';
/** admin — экран режима администратора: тёмная шапка и своя нижняя навигация. */
export type RouteMeta = { path: string; name: string; tab?: 0 | 1 | 2 | 3; chrome: Chrome; admin?: boolean };

export const TAB_PATHS = ['/', '/cart', '/link', '/profile'] as const;

export const ROUTES: RouteMeta[] = [
  { path: '/', name: 'Каталог', tab: 0, chrome: 'lime' },
  { path: '/cart', name: 'Корзина', tab: 1, chrome: 'bg' },
  { path: '/link', name: 'Заказ по ссылке', tab: 2, chrome: 'lime' },
  { path: '/profile', name: 'Профиль', tab: 3, chrome: 'lime' },
  { path: '/filters', name: 'Фильтры', chrome: 'lime' },
  { path: '/link/item/:key', name: 'Товар', chrome: 'lime' },
  { path: '/link/sent/:num', name: 'Заявка отправлена', chrome: 'lime' },
  { path: '/search', name: 'Поиск', chrome: 'lime' },
  { path: '/product/:id', name: 'Товар', chrome: 'bg' },
  { path: '/viewer/:kind/:id', name: 'Фото', chrome: 'bg' },
  { path: '/refund/:num', name: 'Возврат', chrome: 'lime' },
  { path: '/onboarding', name: 'Знакомство', chrome: 'bg' },
  { path: '/push', name: 'Уведомления', chrome: 'lime' },
  { path: '/chart/:id', name: 'Размерная сетка', chrome: 'lime' },
  { path: '/share/:id', name: 'Поделиться', chrome: 'lime' },
  { path: '/checkout', name: 'Проверка заказа', chrome: 'lime' },
  { path: '/delivery', name: 'Способ получения', chrome: 'lime' },
  { path: '/pay/:id', name: 'Оплата', chrome: 'lime' },
  { path: '/placed/:num', name: 'Заказ оформлен', chrome: 'lime' },
  { path: '/orders', name: 'Мои заказы', chrome: 'lime' },
  { path: '/order/:num', name: 'Заказ', chrome: 'lime' },
  { path: '/photo/:num', name: 'Фотоотчёт', chrome: 'lime' },
  { path: '/claim/:num', name: 'Проблема', chrome: 'lime' },
  { path: '/review/:num', name: 'Отзыв', chrome: 'lime' },
  { path: '/addresses', name: 'Адреса', chrome: 'lime' },
  { path: '/addresses/:id', name: 'Адрес', chrome: 'lime' },
  { path: '/auth', name: 'Вход', chrome: 'lime' },
  { path: '/profile/edit', name: 'Имя и фото', chrome: 'lime' },
  { path: '/settings', name: 'Настройки', chrome: 'lime' },
  { path: '/notif', name: 'Уведомления', chrome: 'lime' },
  { path: '/inbox', name: 'События', chrome: 'lime' },
  { path: '/fav', name: 'Избранное', chrome: 'lime' },
  { path: '/payments', name: 'Платежи', chrome: 'lime' },
  { path: '/help', name: 'Помощь', chrome: 'lime' },
  { path: '/delete-account', name: 'Удаление', chrome: 'lime' },
  { path: '/legal', name: 'Документы', chrome: 'lime' },
  { path: '/legal/:id', name: 'Документ', chrome: 'lime' },
  { path: '/invited/:ref', name: 'Приглашение', chrome: 'lime' },
  { path: '/reviews', name: 'Отзывы', chrome: 'lime' },
  { path: '/points', name: 'Баллы', chrome: 'lime' },
  { path: '/email', name: 'Почта', chrome: 'lime' },
  { path: '/invite', name: 'Пригласить друга', chrome: 'lime' },
  // Режим администратора (adm01–adm27).
  { path: '/admin', name: 'Задачи', tab: 0, chrome: 'dark', admin: true },
  { path: '/admin/orders', name: 'Заказы', tab: 1, chrome: 'dark', admin: true },
  { path: '/admin/catalog', name: 'Каталог', tab: 2, chrome: 'dark', admin: true },
  { path: '/admin/more', name: 'Ещё', tab: 3, chrome: 'dark', admin: true },
  { path: '/admin/pay/:id', name: 'Оплата', chrome: 'dark', admin: true },
  { path: '/admin/req/:num', name: 'Заявка', chrome: 'dark', admin: true },
  { path: '/admin/order/:num', name: 'Заказ', chrome: 'dark', admin: true },
  { path: '/admin/order/:num/split', name: 'Посылки', chrome: 'dark', admin: true },
  { path: '/admin/photo/:num', name: 'Фотоотчёт', chrome: 'dark', admin: true },
  { path: '/admin/claim/:num', name: 'Обращение', chrome: 'dark', admin: true },
  { path: '/admin/item/:id', name: 'Вещь', chrome: 'dark', admin: true },
  { path: '/admin/banners', name: 'Витрина', chrome: 'dark', admin: true },
  { path: '/admin/banner/:id', name: 'Баннер', chrome: 'dark', admin: true },
  { path: '/admin/category/:id', name: 'Категория', chrome: 'dark', admin: true },
  { path: '/admin/sizes', name: 'Заявки на размер', chrome: 'dark', admin: true },
  { path: '/admin/buyers', name: 'Покупатели', chrome: 'dark', admin: true },
  { path: '/admin/buyer/:id', name: 'Покупатель', chrome: 'dark', admin: true },
  { path: '/admin/reviews', name: 'Отзывы', chrome: 'dark', admin: true },
  { path: '/admin/settings', name: 'Курс и цены', chrome: 'dark', admin: true },
  { path: '/admin/staff', name: 'Сотрудники', chrome: 'dark', admin: true },
  { path: '/admin/member/:id', name: 'Сотрудник', chrome: 'dark', admin: true },
  { path: '/admin/log', name: 'Журнал действий', chrome: 'dark', admin: true },
  { path: '/admin/summary', name: 'Сводка', chrome: 'dark', admin: true },
];

export function routeMeta(pathname: string): RouteMeta {
  return ROUTES.find((r) => matchPath({ path: r.path, end: true }, pathname)) ?? { path: pathname, name: 'Назад', chrome: 'lime' };
}

/** Лайм — под лаймовой шапкой экрана, #F7F7F5 — у всех остальных (решение 2026-10-06). */
export const CHROME_COLOR: Record<Chrome, `#${string}`> = { lime: '#C6FF00', bg: '#F7F7F5', dark: '#242424' };
