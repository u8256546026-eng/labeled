import type { Cond, Offer, Product } from '../domain/types';
import { IMG, U } from './images';

// Полные модели товаров. Карточки каталога (ITEMS) выводятся из них в mocks/catalog.ts,
// поэтому каталог, фильтры и карточка товара всегда согласованы.

const NOTE: Record<Cond, string> = {
  'новое': 'Бирки на месте',
  'как новое': 'Надета один раз, следов носки нет',
  'чуть уставшее': 'Есть следы носки, описаны в карточке',
};

const LETTERS = ['XS', 'S', 'M', 'L', 'XL'];

type Simple = {
  id: string; name: string; brand: string; cat: string; description: string;
  photo: string; colorName: string; filter: string;
  /** размер → [состояние, цена, остаток][] */
  stock: Record<string, [Cond, number, number][]>;
  preorder?: string[];
  added: number; pop: number;
};

/** Модель в одной расцветке — так устроено большинство вещей из наличия. */
function simple(p: Simple): Product {
  const offers: Offer[] = [];
  Object.entries(p.stock).forEach(([size, list]) => list.forEach(([cond, price, stock], i) => {
    offers.push({ id: `${p.id}-${size || 'one'}-${i}`, color: 'c1', size, cond, price, note: NOTE[cond], img: U(p.photo, 200), stock });
  }));
  const sized = Object.keys(p.stock).some((s) => s !== '');
  return {
    id: p.id, name: p.name, brand: p.brand, cat: p.cat, description: p.description,
    sizeGrid: sized ? LETTERS : [],
    colors: [{ id: 'c1', name: p.colorName, filter: p.filter, thumb: U(p.photo, 200), photos: [U(p.photo, 760)] }],
    offers, preorder: { c1: p.preorder ?? [] }, added: p.added, pop: p.pop,
  };
}

/** «Футболка с принтом» — модель из Flow v12 с тремя расцветками и несколькими экземплярами в одном размере. */
const TEE: Product = {
  id: 'tee', name: 'Футболка с принтом', brand: 'Stüssy', cat: 'tee',
  description: 'Плотный хлопок, свободный силуэт, шелкографический принт на груди. На модели размер M.',
  sizeGrid: LETTERS,
  colors: [
    { id: 'black', name: 'Чёрный', filter: 'black', thumb: IMG.teeBlackS, photos: [IMG.teeBlack, IMG.teeBlack2] },
    { id: 'milk', name: 'Молочный', filter: 'white', thumb: IMG.teeMilkS, photos: [IMG.teeMilk, IMG.teeMilk2] },
    { id: 'grey', name: 'Серый принт', filter: 'black', thumb: IMG.teeGreyS, photos: [IMG.teeGrey] },
  ],
  offers: [
    { id: 'tee-black-S', color: 'black', size: 'S', cond: 'новое', price: 3990, note: 'Бирки на месте', img: IMG.teeBlackS, stock: 3 },
    { id: 'tee-black-M-new', color: 'black', size: 'M', cond: 'новое', price: 3990, note: 'Бирки на месте', img: IMG.teeBlackS, stock: 3 },
    { id: 'tee-black-M-likenew', color: 'black', size: 'M', cond: 'как новое', price: 3690, note: 'Надета один раз, следов носки нет', img: IMG.teeBlack2S, stock: 1 },
    { id: 'tee-black-L', color: 'black', size: 'L', cond: 'новое', price: 3990, note: 'Бирки на месте', img: IMG.teeBlackS, stock: 3 },
    { id: 'tee-milk-XS', color: 'milk', size: 'XS', cond: 'новое', price: 3990, note: 'Бирки на месте', img: IMG.teeMilkS, stock: 2 },
    { id: 'tee-milk-S', color: 'milk', size: 'S', cond: 'новое', price: 3990, note: 'Бирки на месте', img: IMG.teeMilkS, stock: 2 },
    { id: 'tee-milk-L', color: 'milk', size: 'L', cond: 'новое', price: 3990, note: 'Бирки на месте', img: IMG.teeMilkS, stock: 2 },
    { id: 'tee-grey-L', color: 'grey', size: 'L', cond: 'чуть уставшее', price: 3490, note: 'Принт слегка выцвел, ткань целая', img: IMG.teeGreyS, stock: 1 },
  ],
  preorder: { black: ['XL'], milk: ['M', 'XL'], grey: ['S', 'M'] },
  sizeChart: IMG.chart,
  added: 17, pop: 50,
};

const J = (p: Simple) => simple(p);

export const PRODUCTS: Product[] = [
  // Шесть вещей прототипа — в порядке сетки 7a.
  J({ id: 'shirt', name: 'Джинсовая рубашка oversize', brand: 'Levi’s', cat: 'top', photo: '1596755094514-f87e34085b2c', colorName: 'Синий', filter: 'blue', description: 'Плотный деним, свободный крой, накладные карманы на груди.', stock: { M: [['как новое', 6490, 1]], L: [['как новое', 6490, 1]], XL: [['как новое', 6490, 1]] }, added: 20, pop: 30 }),
  J({ id: 'bomber', name: 'Бомбер на молнии', brand: 'Carhartt WIP', cat: 'outer', photo: '1591047139829-d91aecb6caea', colorName: 'Кирпичный', filter: 'red', description: 'Нейлон с утеплителем, трикотажные манжеты и воротник.', stock: { M: [['новое', 12400, 2]], L: [['новое', 12400, 1]] }, preorder: ['XL'], added: 19, pop: 40 }),
  J({ id: 'chinos', name: 'Брюки чинос', brand: 'Dickies', cat: 'pants', photo: '1473966968600-fa801b869a1a', colorName: 'Бежевый', filter: 'beige', description: 'Плотный хлопковый твил, прямой крой.', stock: { S: [['новое', 7200, 1]], M: [['новое', 7200, 2]], L: [['новое', 7200, 2]], XL: [['новое', 7200, 1]] }, added: 18, pop: 15 }),
  TEE,
  J({ id: 'bag', name: 'Рюкзак городской', brand: 'The North Face', cat: 'bags', photo: '1553062407-98eeb64c6a62', colorName: 'Синий', filter: 'blue', description: 'Отделение для ноутбука, влагостойкая ткань, мягкие лямки.', stock: { '': [['новое', 5900, 2]] }, added: 16, pop: 10 }),
  J({ id: 'knit', name: 'Джемпер крупной вязки', brand: 'COS', cat: 'top', photo: '1434389677669-e08b4cac3105', colorName: 'Молочный', filter: 'white', description: 'Шерсть с хлопком, крупная вязка. Есть катышки, показаны на фото.', stock: { S: [['чуть уставшее', 8900, 1]] }, added: 15, pop: 20 }),

  // Дополнительные вещи, чтобы в каталоге была вторая страница.
  J({ id: 'jeans', name: 'Джинсы прямые', brand: 'Levi’s', cat: 'pants', photo: '1542272604-787c3835535d', colorName: 'Синий', filter: 'blue', description: 'Классическая посадка, плотный деним без растяжения.', stock: { S: [['новое', 7900, 2]], M: [['новое', 7900, 2], ['как новое', 6400, 1]], L: [['как новое', 6400, 1]] }, preorder: ['XL'], added: 14, pop: 45 }),
  J({ id: 'leather', name: 'Куртка-косуха кожаная', brand: 'COS', cat: 'outer', photo: '1551028719-00167b16eac5', colorName: 'Чёрный', filter: 'black', description: 'Натуральная кожа, косая молния, подкладка из вискозы.', stock: { M: [['как новое', 18900, 1]] }, added: 13, pop: 35 }),
  J({ id: 'tee-basic', name: 'Футболка базовая', brand: 'Nike', cat: 'tee', photo: '1620799139834-6b8f844fbe61', colorName: 'Белый', filter: 'white', description: 'Хлопок средней плотности, прямой силуэт.', stock: { S: [['новое', 2490, 3]], M: [['новое', 2490, 3]], L: [['новое', 2490, 2]] }, added: 12, pop: 25 }),
  J({ id: 'trench', name: 'Тренч с поясом', brand: 'COS', cat: 'outer', photo: '1539533018447-63fcce2678e3', colorName: 'Бежевый', filter: 'beige', description: 'Хлопковый габардин, двубортная застёжка, пояс в комплекте.', stock: { S: [['новое', 15900, 1]], M: [['новое', 15900, 1]] }, added: 11, pop: 18 }),
  J({ id: 'denim-jacket', name: 'Джинсовая куртка', brand: 'Levi’s', cat: 'outer', photo: '1611312449408-fcece27cdbb7', colorName: 'Синий', filter: 'blue', description: 'Плотный деним, вельветовый воротник.', stock: { M: [['чуть уставшее', 7400, 1]], L: [['как новое', 8900, 1]] }, added: 10, pop: 28 }),
  J({ id: 'tee-print', name: 'Футболка оверсайз с принтом', brand: 'Adidas', cat: 'tee', photo: '1583744946564-b52ac1c389c8', colorName: 'Чёрный', filter: 'black', description: 'Свободный крой, принт на груди.', stock: { XS: [['новое', 2990, 1]], S: [['новое', 2990, 2]], M: [['новое', 2990, 2]] }, preorder: ['L'], added: 9, pop: 22 }),
  J({ id: 'sweat', name: 'Свитшот базовый', brand: 'Adidas', cat: 'top', photo: '1620799140408-edc6dcb6d633', colorName: 'Белый', filter: 'white', description: 'Футер с начёсом, манжеты в рубчик.', stock: { M: [['новое', 5490, 2]], L: [['новое', 5490, 1]] }, added: 8, pop: 16 }),
  J({ id: 'shirt-white', name: 'Рубашка классическая', brand: 'COS', cat: 'top', photo: '1598033129183-c4f50c736f10', colorName: 'Белый', filter: 'white', description: 'Хлопковый поплин, прямой крой.', stock: { M: [['как новое', 3990, 1]], L: [['новое', 4790, 1]] }, added: 7, pop: 12 }),
  J({ id: 'tee-trim', name: 'Футболка с контрастным кантом', brand: 'Adidas', cat: 'tee', photo: '1622519407650-3df9883f76a5', colorName: 'Чёрный', filter: 'black', description: 'Плотный трикотаж, кант по рукавам и горловине.', stock: { M: [['новое', 3290, 2]], L: [['новое', 3290, 2]], XL: [['новое', 3290, 1]] }, added: 6, pop: 14 }),
  J({ id: 'shorts', name: 'Шорты джинсовые', brand: 'Levi’s', cat: 'pants', photo: '1591195853828-11db59a44f6b', colorName: 'Голубой', filter: 'blue', description: 'Высокая посадка, необработанный край.', stock: { XS: [['как новое', 2790, 1]], S: [['новое', 3490, 1]] }, added: 5, pop: 9 }),
  J({ id: 'jeans-wide', name: 'Джинсы широкие', brand: 'Carhartt WIP', cat: 'pants', photo: '1624378439575-d8705ad7ae80', colorName: 'Тёмно-синий', filter: 'blue', description: 'Свободный крой, плотный необработанный деним.', stock: { M: [['чуть уставшее', 5900, 1]] }, added: 4, pop: 11 }),
  J({ id: 'pants-navy', name: 'Брюки прямые', brand: 'Dickies', cat: 'pants', photo: '1544441893-675973e31985', colorName: 'Тёмно-синий', filter: 'blue', description: 'Смесовая ткань, стрелки, прямой крой.', stock: { M: [['новое', 6200, 1]], L: [['новое', 6200, 1]] }, added: 3, pop: 8 }),
  J({ id: 'cap', name: 'Кепка тракер', brand: 'New Balance', cat: 'acc', photo: '1588850561407-ed78c282e89b', colorName: 'Белый', filter: 'white', description: 'Сетчатая спинка, регулируемая застёжка.', stock: { '': [['новое', 1990, 3]] }, added: 2, pop: 7 }),
  J({ id: 'flap-bag', name: 'Сумка с клапаном', brand: 'COS', cat: 'bags', photo: '1584917865442-de89df76afd3', colorName: 'Красный', filter: 'red', description: 'Гладкая кожа, металлическая застёжка, съёмный ремень.', stock: { '': [['как новое', 9900, 1]] }, added: 1, pop: 6 }),
];
