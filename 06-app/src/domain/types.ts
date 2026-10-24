export type Cond = 'новое' | 'как новое' | 'чуть уставшее';

export type Category = { id: string; name: string; img: string };

/** Вещь в каталоге — модель с одним или несколькими предложениями. */
export type CatalogItem = {
  id: string;
  name: string;
  brand: string;
  /** Подпись цены в карточке: «12 400 ₽» или «от 3 490 ₽». */
  priceLabel: string;
  /** Минимальная цена, по ней сортируем и фильтруем. */
  price: number;
  img: string;
  /** Состояние, если предложение одно. */
  cond?: Cond;
  /** Несколько предложений — тег «несколько предложений». */
  multi?: boolean;
  /** Основная категория. */
  cat: string;
  /** Все категории, в которых вещь видна (основная первой); по ним работает фильтр. */
  cats: string[];
  /** Цвета для фильтра (одна модель может продаваться в нескольких расцветках). */
  colors: string[];
  /** Карточка одной расцветки модели (id расцветки): открывает товар в этом цвете. */
  color?: string;
  sizes: string[];
  conds: Cond[];
  /** Есть размеры, которые можно заказать. */
  preorder?: boolean;
  /** Порядок новизны: больше — новее. */
  added: number;
  /** Популярность для сортировки «Популярные». */
  pop: number;
};

export type Page<T> = { items: T[]; total: number; hasMore: boolean };

/** Конкретное предложение: экземпляр модели в цвете, размере и состоянии со своей ценой и остатком. */
export type Offer = {
  id: string;
  color: string;
  /** '' — у вещи нет размеров (сумки, аксессуары). */
  size: string;
  cond: Cond;
  price: number;
  note: string;
  img: string;
  stock: number;
};

export type ProductColor = {
  id: string;
  name: string;
  /** Цвет из фильтра (black, white…). */
  filter: string;
  thumb: string;
  photos: string[];
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  cat: string;
  /** Все категории вещи (основная первой); нет — только cat. */
  cats?: string[];
  description: string;
  /** Размерный ряд модели; отсутствующие в цвете размеры показываются зачёркнутыми. */
  sizeGrid: string[];
  colors: ProductColor[];
  offers: Offer[];
  /** Размеры, которые можно заказать, по цветам. */
  preorder: Record<string, string[]>;
  /** Изображение размерной сетки от продавца (AU). Нет — открываем помощь с размером. */
  sizeChart?: string;
  added: number;
  pop: number;
};

/**
 * Баннер главной (7a). Владелец ведёт их в админке (adm16, adm32). Без картинки — один из трёх
 * нарисованных баннеров labeled (по цели кнопки); с картинкой 1080 × 600 — заголовок и кнопка поверх неё.
 */
export type ShowBanner = { id: number; title: string; cta: string; target: 'link' | 'catalog' | 'email' | 'invite'; cat?: string | null; img?: string | null };

