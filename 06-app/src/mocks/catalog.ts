import type { CatalogItem, Category, Cond, ShowBanner } from '../domain/types';
import { PRODUCTS } from './products';
import { catalogCards, toCatalogItem } from '../domain/catalog';
import { asset, IMG } from './images';

/**
 * Категории — плитки главного экрана 7a. Экран фильтров U в макете показывает другой набор
 * (Рубашки, Свитеры и худи…); чтобы плитка и фильтр совпадали, оба берут этот список.
 * Состав категорий у клиента ещё не утверждён (TODO: обувь, разделение футболок и верха).
 */
export const CATEGORIES: Category[] = [
  { id: 'tee', name: 'Футболки', img: asset('cat-tshirt.webp') },
  { id: 'top', name: 'Верх', img: asset('cat-sweatshirt.webp') },
  { id: 'pants', name: 'Штаны', img: asset('cat-jeans.webp') },
  // Фото плитки загружает продавец в админке (adm16 → категория); пока его нет — плитка с буквой.
  // Обувь — кроссовки, кеды, ботинки (переименовано из «Кроссовок» 2026-10-09; id прежний).
  { id: 'sneakers', name: 'Обувь', img: '' },
  { id: 'bags', name: 'Сумки', img: IMG.catBag },
  { id: 'acc', name: 'Аксессуары', img: IMG.catAcc },
  { id: 'outer', name: 'Куртки', img: IMG.catJacket },
  { id: 'under', name: 'Нижнее бельё', img: IMG.catBase },
];

/** Видимые баннеры главной в порядке карусели. С сервером заполняется из /api/showcase, на моках — из админки. */
export const BANNERS: ShowBanner[] = [
  { id: 1, title: 'Заказать из-за границы', cta: 'Оформить заказ', target: 'link' },
  { id: 2, title: '−50% на комиссию первого заказа', cta: 'Подробнее', target: 'email' },
  { id: 3, title: '250 баллов за друга', cta: 'Пригласить друга', target: 'invite' },
];

export const SORTS = [
  { id: 'new', name: 'Сначала новые', short: 'Новые' },
  { id: 'cheap', name: 'Дешевле', short: 'Дешевле' },
  { id: 'exp', name: 'Дороже', short: 'Дороже' },
  { id: 'pop', name: 'Популярные', short: 'Популярные' },
] as const;

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const CONDS: { id: Cond; name: string; sub: string }[] = [
  { id: 'новое', name: 'Новое', sub: 'С бирками или без носки' },
  { id: 'как новое', name: 'Как новое', sub: 'Носили пару раз, без следов' },
  { id: 'чуть уставшее', name: 'Чуть уставшее', sub: 'Есть следы носки, описаны в карточке' },
];

/** Цвета фильтра. Продавец выбирает цвет расцветки из этого же списка (adm15), поэтому вещь находится фильтром. */
export const COLORS = [
  { id: 'black', name: 'Чёрный', hex: '#111111' },
  { id: 'white', name: 'Белый', hex: '#FFFFFF' },
  { id: 'grey', name: 'Серый', hex: '#9A9A9A' },
  { id: 'beige', name: 'Бежевый', hex: '#D9C6A5' },
  { id: 'brown', name: 'Коричневый', hex: '#7A5236' },
  { id: 'blue', name: 'Синий', hex: '#2F5DA8' },
  { id: 'red', name: 'Красный', hex: '#B2432F' },
  { id: 'green', name: 'Зелёный', hex: '#4F7A4A' },
];

/** Оттенки из прежнего списка админки — к ближайшему цвету фильтра. */
const COLOR_ALIASES: Record<string, string> = { 'Молочный': 'white', 'Кирпичный': 'red' };

/** Название цвета расцветки → цвет фильтра; '' — цвета нет в справочнике. */
export const colorFilter = (name: string) => COLORS.find((c) => c.name === name.trim())?.id ?? COLOR_ALIASES[name.trim()] ?? '';

export const BRANDS = ['Stüssy', 'Carhartt WIP', 'Levi’s', 'Dickies', 'COS', 'The North Face', 'Nike', 'Adidas', 'New Balance', 'Arc’teryx'];

export const PRICE_PRESETS = [
  { id: 'p3', name: 'До 3 000', from: 0, to: 3000 },
  { id: 'p38', name: '3 000–8 000', from: 3000, to: 8000 },
  { id: 'p8', name: 'От 8 000', from: 8000, to: 0 },
];

/** Выдача каталога: расцветки — отдельными карточками. */
export const ITEMS: CatalogItem[] = PRODUCTS.flatMap(catalogCards);
/** Модели целиком (избранное хранит модель, не расцветку). */
export const MODELS: CatalogItem[] = PRODUCTS.map(toCatalogItem);


/** Подписи для чипсов активных фильтров. */
export const FILTER_DICT = {
  cats: CATEGORIES,
  conds: CONDS.map((c) => ({ id: c.id as string, name: c.name })),
  colors: COLORS,
};
