// Демо-данные режима администратора из Labeled Admin (adm01–adm32). В продукте приходят с бэкенда.
import type { LogEntry, Perm, Role, Staff } from '../admin/model';
import { IMG, U } from './images';

export const AIMG = {
  ivan: U('1500648767791-00dcc994a43e', 200),
  hoodie: U('1556821840-3a63f95609a7', 300),
  receipt: U('1554224155-8d04cb21cd6c', 500),
};

export type AdmPayment = {
  /** Тот же id, что у платежа покупателя (W, C): подтверждение меняет его состояние. */
  id: string;
  kind: 'goods' | 'delivery';
  orderNum: string;
  orderLabel: string;
  amount: number;
  buyerId: string;
  when: string;
  purpose: string;
  /** Чек покупателя: фото или PDF. Нет — сверяют по сумме, времени и назначению. */
  receipt?: string;
  state: 'review' | 'ok' | 'fail';
  failWhy?: number;
  failNote?: string;
  /** Чек для покупателя после подтверждения. */
  sellerReceipt?: { name: string; preview?: string };
  age: string;
  buyerName?: string; buyerHandle?: string;
};

export type AdmReqItem = { plat: string; name: string; size: string; qty: number; img?: string; url: string; price: number; photo: boolean; box: boolean };
export type AdmRequest = {
  num: string; title: string; buyerId: string; ago: string; age: string;
  items: AdmReqItem[]; protect: boolean;
  state: 'review' | 'ok' | 'changed' | 'rejected';
  /** Цены до изменения продавцом (adm07) — покупатель видит старую и новую. */
  old?: number[]; comment?: string; rejectWhy?: number; rejectNote?: string;
  buyerName?: string; buyerHandle?: string;
  /** С сервера: курс на момент отправки и расчёт, зафиксированный в заявке. */
  rates?: import('../domain/linkOrder').Rates;
  calc?: { goods: number; comm: number; serv: number; prot: number; points: number; commDiscount: number; total: number };
};

export type AdmParcel = {
  /** Номер посылки в заказе (1, 2…). */
  n?: number;
  title: string; track?: string; state: string; /** Сколько посылка ждёт трека. */ age?: string;
  /** Счёт за доставку выставлен (adm29); вес — после взвешивания, «1,4». */
  billed?: boolean; weight?: string;
  /** id вещей посылки из AdmOrder.items (adm34). */
  items?: string[];
};
export type AdmOrder = {
  num: string; buyerId: string; what: string; sum: number; kind: 'link' | 'stock';
  /** Этап заказа: индекс в STAGES (из-за границы) или в STOCK_STAGES (наличие). */
  stage: number;
  stageDates: string[];
  status: string; tone: 'live' | 'wait' | 'err' | 'info' | 'violet' | 'n';
  group: 'req' | 'pay' | 'buy' | 'ship' | 'done' | 'prob';
  pays: { label: string; value: string }[];
  parcels: AdmParcel[];
  buyerName?: string; buyerHandle?: string;
  /** Отменён, отклонён или выполнен: отменять и выставлять счета нельзя. */
  closed?: boolean;
  /** Отмена продавцом (adm30): причина из SELLER_CANCEL и комментарий. */
  cancel?: { why: number; note: string };
  /** Вернуть покупателю после отмены оплаченного заказа; refunded — сотрудник отметил возврат. */
  refundDue?: number; refunded?: boolean;
  /** Вещи заказа по ссылке — для разбиения на посылки (adm34). */
  items?: { id: string; name: string; meta: string; img?: string }[];
  /** Куда отправлять: получатель из адреса заказа и способ получения (CDEK) или порядок отправки заказа по ссылке. */
  ship?: { who: string; phone: string; addr: string; how: string };
};

/** ids — id фото на сервере в том же порядке, что pics (для сохранения списка). */
export type AdmPhotoReport = { orderNum: string; buyerId: string; place: string; items: { name: string; meta: string; pics: string[]; ids?: string[] }[]; note: string; sent: boolean; age: string; buyerName?: string; buyerHandle?: string };
export type AdmMsg = { from: 'buyer' | 'admin'; text: string; time: string };
export type AdmClaim = {
  orderNum: string; buyerId: string; topic: string; opened: string; track: string; stage: string; what: string; msgs: AdmMsg[]; closed: boolean; age: string; buyerName?: string; buyerHandle?: string;
  /** Для решения (adm28): тип заказа (возврат — только наличие) и сколько оплачено за товары. */
  kind: 'stock' | 'link'; paid: number;
  answer?: 'ok' | 'no' | 'more'; answerText?: string; refundSum?: number;
  /** Покупатель уже прислал реквизиты — решение не меняется; номер целиком виден только сотрудникам. */
  refundSent?: boolean;
  refund?: { to: 'sbp' | 'card'; val: string; bank: string; state: 'sent' | 'done' } | null;
};

/** Заявка покупателя на отсутствующий размер (7p → adm31). */
export type AdmSizeReq = { id: string; item: string; productId: string; size: string; color: string; who: string; when: string; img: string; state: 'wait' | 'yes' | 'no' };

/** Баннер главной (adm16, adm32). Без картинки — один из трёх нарисованных баннеров labeled. */
export type AdmBanner = { id?: number; title: string; sub: string; on: boolean; img?: string; cta?: string; target?: 'link' | 'catalog' | 'email' | 'invite'; cat?: string };

/** Предложение вещи; color — id расцветки. */
export type AdmOffer = { id: string; color: string; cond: string; size: string; price: number; qty: number };
/**
 * Расцветка вещи: цвет и до трёх фото; в каталоге у каждой расцветки своя карточка с обложкой — первым фото.
 * Цвет — из справочника фильтра или свой («Оливковый»); у своего filter — цвет фильтра, в котором его найдут покупатели.
 */
export type AdmColor = { id: string; name: string; filter?: string; pics: string[] };
/** preorderSizes — размеры, которых нет в наличии, но их можно запросить «под заказ» (вместе с распроданными). */
export type AdmItem = { id: string; name: string; brand: string; /** Текст под «Описание» в карточке покупателя. */ description: string; img: string; cat: string; /** Все категории по названиям, основная (cat) первой; нет — только cat. */ cats?: string[]; colors: AdmColor[]; offers: AdmOffer[]; show: boolean; preorder: boolean; preorderSizes?: string[] };

export type AdmBuyer = { id: string; name: string; handle: string; /** Фото из Telegram (initData) — адрес t.me или пусто. */ photo?: string; phone: string; email: string; since: string; orders: number; spent: number; pts: number; invitePts: number; points: { text: string; delta: number; date: string }[]; waiting?: [string, 'wait' | 'live' | 'err'] | null };
export type AdmReview = { id: string; who: string; /** Аватарка автора — видна только в админке. */ photo?: string; stars: number; when: string; text: string; about: string; state: 'mod' | 'pub' | 'hid' };

export const ADMIN_BUYERS: AdmBuyer[] = [
  { id: 'b-anna', name: 'Анна Смирнова', handle: '@anna_smirnova', photo: IMG.ava, phone: '+7 921 000-00-00', email: 'anna@example.com · подтверждена', since: 'с марта 2026', orders: 5, spent: 62300, pts: 1240, invitePts: 500, points: [] },
  { id: 'b-igor', name: 'Игорь Котов', handle: '@igor_k', phone: '+7 911 222-33-44', email: 'не привязана', since: 'с октября 2026', orders: 1, spent: 21640, pts: 0, invitePts: 0, points: [] },
  { id: 'b-maria', name: 'Мария Лебедева', handle: '@maria_leb', phone: '+7 905 111-22-33', email: 'maria@example.com · подтверждена', since: 'с мая 2026', orders: 3, spent: 18400, pts: 410, invitePts: 0, points: [] },
  { id: 'b-oleg', name: 'Олег Петров', handle: '@oleg_p', phone: '+7 916 555-66-77', email: 'не привязана', since: 'с июня 2026', orders: 2, spent: 15990, pts: 300, invitePts: 250, points: [] },
  { id: 'b-dmitry', name: 'Дмитрий Соколов', handle: '@d_sokolov', phone: '+7 925 444-11-00', email: 'dmitry@example.com · подтверждена', since: 'с апреля 2026', orders: 4, spent: 41200, pts: 820, invitePts: 250, points: [] },
  { id: 'b-elena', name: 'Елена Волкова', handle: '@elena_v', phone: '+7 903 777-88-99', email: 'elena@example.com · подтверждена', since: 'с февраля 2026', orders: 7, spent: 76500, pts: 2150, invitePts: 750, points: [] },
];

export const ADMIN_PAYMENTS: AdmPayment[] = [
  { id: 'p-1041', kind: 'goods', orderNum: '1041', orderLabel: '1041', amount: 14380, buyerId: 'b-anna', when: 'Сегодня, 14:08', purpose: 'labeled 1041', receipt: AIMG.receipt, state: 'review', age: '12 мин' },
  { id: 'p-1042-1', kind: 'delivery', orderNum: '1042', orderLabel: '1042, посылка 1', amount: 1850, buyerId: 'b-anna', when: 'Сегодня, 11:40', purpose: 'labeled 1042-1', state: 'review', age: '3 ч' },
];

export const ADMIN_REQUESTS: AdmRequest[] = [{
  num: '1043', title: 'Кроссовки и худи', buyerId: 'b-igor', ago: '40 минут назад', age: '40 мин', protect: true, state: 'review',
  items: [
    { plat: 'Poizon', name: 'Nike Air Force 1 ’07', size: '42', qty: 1, img: IMG.sneakS, url: 'dw4.co/t/A/1sKq9X', price: 899, photo: true, box: true },
    { plat: 'Poizon', name: 'Худи Essentials', size: 'L', qty: 1, img: AIMG.hoodie, url: 'dw4.co/t/A/1sKr2M', price: 520, photo: false, box: false },
    { plat: 'Taobao', name: 'Носки, 3 пары', size: 'One size', qty: 2, url: 'item.taobao.com/item.htm?id=726410', price: 45, photo: false, box: false },
  ],
}];

const dates = ['28 сентября', '28 сентября', '30 сентября', '3 октября', '4 октября', '', '', ''];

export const ADMIN_ORDERS: AdmOrder[] = [
  { num: '1045', buyerId: 'b-anna', what: 'Футболка с принтом и ещё 1', sum: 9800, kind: 'stock', stage: 0, stageDates: ['5 сентября'], status: 'Оплата не подтверждена', tone: 'err', group: 'prob', pays: [{ label: 'Товары', value: 'Не подтверждена · 9 800 ₽' }], parcels: [] },
  { num: '1044', buyerId: 'b-oleg', what: 'Бомбер на молнии', sum: 8990, kind: 'stock', stage: 0, stageDates: ['19 сентября'], status: 'Ждёт оплаты', tone: 'wait', group: 'pay', pays: [{ label: 'Товары', value: 'Счёт выставлен · 8 990 ₽' }], parcels: [],
    ship: { who: 'Олег Петров', phone: '+7 916 000-00-00', addr: 'Москва, ул. Лесная, 5, кв. 12', how: 'Пункт выдачи CDEK · Москва, Тверская, 15' } },
  { num: '1043', buyerId: 'b-igor', what: 'По ссылке · 3 позиции', sum: 21640, kind: 'link', stage: -1, stageDates: [], status: 'Заявка на проверке', tone: 'wait', group: 'req', pays: [{ label: 'Товары', value: 'Счёт после одобрения' }], parcels: [] },
  { num: '1042', buyerId: 'b-anna', what: 'По ссылке · 2 посылки', sum: 18720, kind: 'link', stage: 4, stageDates: dates, status: 'В пути', tone: 'info', group: 'ship',
    pays: [{ label: 'Товары', value: 'Оплачено · 16 870 ₽' }, { label: 'Доставка посылки 1', value: 'На проверке · 1 850 ₽' }, { label: 'Доставка посылки 2', value: 'Счёт после взвешивания' }],
    parcels: [{ n: 1, title: 'Посылка 1 · кроссовки', track: '10 234 567 890', state: 'Передано в CDEK', billed: true, weight: '1,1' }, { n: 2, title: 'Посылка 2 · худи', state: 'На складе в России', age: '1 д' }] },
  { num: '1041', buyerId: 'b-anna', what: 'Джемпер крупной вязки и ещё 2', sum: 14380, kind: 'stock', stage: 0, stageDates: ['6 сентября'], status: 'Оплата на проверке', tone: 'wait', group: 'pay', pays: [{ label: 'Товары', value: 'На проверке · 14 380 ₽' }], parcels: [] },
  { num: '1040', buyerId: 'b-dmitry', what: 'По ссылке · 2 вещи', sum: 12400, kind: 'link', stage: 3, stageDates: ['20 сентября', '20 сентября', '24 сентября', '2 октября'], status: 'На складе в Китае', tone: 'violet', group: 'buy', pays: [{ label: 'Товары', value: 'Оплачено · 12 400 ₽' }], parcels: [],
    items: [{ id: '1040-1', name: 'Nike Dunk Low', meta: 'Размер 43 · Poizon', img: IMG.sneakS }, { id: '1040-2', name: 'Свитшот с вышивкой', meta: 'Размер M · Taobao' }] },
  { num: '1039', buyerId: 'b-elena', what: 'Рюкзак городской', sum: 5990, kind: 'stock', stage: 3, stageDates: ['10 сентября', '10 сентября', '11 сентября', '14 сентября'], status: 'Выдан', tone: 'live', group: 'done', pays: [{ label: 'Товары', value: 'Оплачено · 5 990 ₽' }], parcels: [{ n: 1, title: 'Посылка', track: '10 555 222 111', state: 'Выдано покупателю' }], closed: true },
  { num: '1038', buyerId: 'b-maria', what: 'Брюки чинос', sum: 4990, kind: 'stock', stage: 2, stageDates: ['1 сентября', '1 сентября', '2 октября'], status: 'Открыто обращение', tone: 'err', group: 'prob', pays: [{ label: 'Товары', value: 'Оплачено · 4 990 ₽' }], parcels: [{ n: 1, title: 'Посылка', track: '10 987 654 321', state: 'Передано в CDEK' }] },
];

export const ADMIN_PHOTOS: AdmPhotoReport[] = [{
  orderNum: '1040', buyerId: 'b-dmitry', place: 'склад в Китае', note: '', sent: false, age: '5 ч',
  items: [
    { name: 'Nike Dunk Low', meta: 'Размер 43 · Poizon', pics: [IMG.sneakS, IMG.sneakS] },
    { name: 'Свитшот с вышивкой', meta: 'Размер M · Taobao', pics: [] },
  ],
}];

export const ADMIN_CLAIMS: AdmClaim[] = [{
  orderNum: '1038', buyerId: 'b-maria', topic: 'Трек не обновляется', opened: 'открыто вчера в 19:02', track: '10 987 654 321', stage: 'Передано в CDEK', what: 'Брюки чинос', closed: false, age: '18 ч', kind: 'stock', paid: 4990,
  msgs: [{ from: 'buyer', text: 'Здравствуйте! Трек по заказу 1038 не обновляется уже четыре дня. Посылка не потерялась?', time: 'Вчера, 19:02' }],
}];

export const QUICK_REPLIES = ['Проверим и ответим сегодня', 'Посылка на сортировке CDEK, статус обновится в течение суток', 'Пришлите, пожалуйста, телефон получателя'];

const one = (name: string, pics: string[]): AdmColor[] => [{ id: 'c1', name, pics }];
export const ADMIN_ITEMS: AdmItem[] = [
  { id: 'tee', name: 'Футболка с принтом', brand: 'Stüssy', description: 'Плотный хлопок, свободный силуэт, шелкографический принт на груди. На модели размер M.', img: IMG.teeBlackS, cat: 'Футболки', show: true, preorder: true,
    colors: [{ id: 'c1', name: 'Чёрный', pics: [IMG.teeBlackS, IMG.teeBlack2S] }, { id: 'c2', name: 'Белый', pics: [IMG.teeMilkS] }],
    offers: [{ id: 'o1', color: 'c1', cond: 'Новое · бирки на месте', size: 'M', price: 3990, qty: 2 }, { id: 'o2', color: 'c1', cond: 'Как новое', size: 'M', price: 3490, qty: 1 }, { id: 'o3', color: 'c1', cond: 'Чуть уставшее', size: 'L', price: 2790, qty: 0 }, { id: 'o4', color: 'c2', cond: 'Новое · бирки на месте', size: 'S', price: 3990, qty: 2 }] },
  { id: 'shirt', name: 'Джинсовая рубашка oversize', brand: 'Levi’s', description: '', img: IMG.shirtS, colors: one('Синий', [IMG.shirtS]), cat: 'Рубашки', show: true, preorder: false, offers: [{ id: 'o1', color: 'c1', cond: 'Как новое', size: 'L', price: 6490, qty: 1 }] },
  { id: 'bomber', name: 'Бомбер на молнии', brand: 'Carhartt WIP', description: '', img: IMG.bomberS, colors: one('Красный', [IMG.bomberS]), cat: 'Куртки', show: true, preorder: false, offers: [{ id: 'o1', color: 'c1', cond: 'Новое · бирки на месте', size: 'M', price: 8990, qty: 1 }, { id: 'o2', color: 'c1', cond: 'Как новое', size: 'L', price: 8990, qty: 1 }] },
  { id: 'chinos', name: 'Брюки чинос', brand: 'Dickies', description: '', img: IMG.chinosS, colors: one('Бежевый', [IMG.chinosS]), cat: 'Брюки и джинсы', show: true, preorder: false, offers: [{ id: 'o1', color: 'c1', cond: 'Новое · бирки на месте', size: '32', price: 4990, qty: 0 }] },
  { id: 'knit', name: 'Джемпер крупной вязки', brand: 'COS', description: '', img: IMG.knitS, colors: one('Белый', [IMG.knitS]), cat: 'Свитеры и худи', show: true, preorder: false, offers: [{ id: 'o1', color: 'c1', cond: 'Чуть уставшее', size: 'S', price: 5490, qty: 1 }, { id: 'o2', color: 'c1', cond: 'Как новое', size: 'M', price: 5490, qty: 1 }] },
  { id: 'bag', name: 'Рюкзак городской', brand: 'The North Face', description: '', img: IMG.bagS, colors: one('Синий', [IMG.bagS]), cat: 'Аксессуары', show: false, preorder: false, offers: [{ id: 'o1', color: 'c1', cond: 'Новое · бирки на месте', size: 'One size', price: 5990, qty: 1 }] },
];

export const ADMIN_BANNERS: AdmBanner[] = [
  { id: 1, title: 'Заказать из-за границы', sub: 'Кнопка «Оформить заказ» → заказ по ссылке', on: true, cta: 'Оформить заказ', target: 'link' },
  { id: 2, title: '−50% на комиссию первого заказа', sub: 'Кнопка «Подробнее» → подтверждение почты', on: true, cta: 'Подробнее', target: 'email' },
  { id: 3, title: '250 баллов за друга', sub: 'Кнопка «Пригласить друга» → приглашение', on: true, cta: 'Пригласить друга', target: 'invite' },
];

export const ADMIN_SIZES: AdmSizeReq[] = [
  { id: 's1', item: 'Футболка с принтом', productId: 'tee', size: 'L', color: 'Чёрный', who: 'Олег Петров', when: '2 ч назад', img: IMG.teeBlackS, state: 'wait' },
  { id: 's2', item: 'Бомбер на молнии', productId: 'bomber', size: 'S', color: 'Красный', who: 'Анна Смирнова', when: 'Вчера', img: IMG.bomberS, state: 'wait' },
  { id: 's3', item: 'Брюки чинос', productId: 'chinos', size: '32', color: 'Бежевый', who: 'Елена Волкова', when: '3 октября', img: IMG.chinosS, state: 'wait' },
];
export const ADMIN_CATS = [
  { name: 'Футболки', n: 12, on: true }, { name: 'Рубашки', n: 7, on: true }, { name: 'Свитеры и худи', n: 9, on: true },
  { name: 'Куртки', n: 5, on: true }, { name: 'Брюки и джинсы', n: 8, on: true }, { name: 'Обувь', n: 0, on: true }, { name: 'Аксессуары', n: 6, on: true },
];

export const ADMIN_REVIEWS: AdmReview[] = [
  { id: 'r1', who: 'Анна С.', stars: 5, when: 'Вчера', text: 'Заказывала кроссовки с Poizon, пришли за 19 дней. Фотоотчёт со склада очень выручил.', about: 'Заказ 1036 · по ссылке', state: 'mod' },
  { id: 'r2', who: 'Олег П.', stars: 4, when: 'Вчера', text: 'Бомбер как на фото. Доставка CDEK заняла на два дня дольше, чем писали.', about: 'Бомбер на молнии', state: 'mod' },
  { id: 'r3', who: 'Елена В.', stars: 5, when: '2 октября', text: 'Рюкзак в идеальном состоянии, упаковали аккуратно.', about: 'Рюкзак городской', state: 'pub' },
  { id: 'r4', who: 'Без имени', stars: 1, when: '30 сентября', text: 'Реклама другого магазина со ссылкой.', about: 'Без заказа', state: 'hid' },
];

export const ADMIN_STAFF: Staff[] = [
  { id: 's-ivan', name: 'Иван Петров', handle: '@ivan_labeled', photo: AIMG.ivan, role: 'owner', since: 'с 1 августа', perms: null, me: true },
  { id: 's-ksenia', name: 'Ксения', handle: '@ksenia_lbd', role: 'manager', since: 'с 5 августа', perms: null },
  { id: 's-artem', name: 'Артём', handle: '@artem_sklad', role: 'stock', since: 'с 12 августа', perms: null },
  { id: 's-liza', name: 'Лиза', handle: '@liza_content', role: 'content', since: 'с 20 августа', perms: null },
];

/** Журнал действий (adm33): время — от момента открытия демо, чтобы «Сегодня» и «Вчера» были настоящими. */
const minAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const who = (id: string): Pick<LogEntry, 'who' | 'whoName' | 'whoPhoto' | 'whoRole'> => { const m = ADMIN_STAFF.find((x) => x.id === id)!; return { who: id, whoName: m.name, whoPhoto: m.photo, whoRole: m.role }; };
export const ADMIN_LOG: LogEntry[] = [
  { id: 'l1', at: minAgo(20), ...who('s-ksenia'), type: 'pay', text: 'Подтверждена оплата товаров · 12\u00a0400\u00a0₽', obj: 'Заказ 1040', to: '/admin/order/1040' },
  { id: 'l2', at: minAgo(85), ...who('s-artem'), type: 'stock', text: 'Обновлены фото в фотоотчёте', obj: 'Заказ 1040', to: '/admin/photo/1040' },
  { id: 'l3', at: minAgo(160), ...who('s-ivan'), type: 'prices', text: 'Изменён курс ЦБ: 11,48 → 11,62 ₽', obj: 'Курс и цены', to: '/admin/settings' },
  { id: 'l4', at: minAgo(210), ...who('s-ksenia'), type: 'req', text: 'Изменена цена в заявке', obj: 'Заявка 1043', to: '/admin/req/1043' },
  { id: 'l5', at: minAgo(290), ...who('s-liza'), type: 'catalog', text: 'Вещь изменена', obj: 'Футболка с принтом', to: '/admin/item/tee' },
  { id: 'l6', at: minAgo(1440 + 120), ...who('s-artem'), type: 'stock', text: 'Добавлен трек CDEK · посылка 1', obj: 'Заказ 1042', to: '/admin/order/1042' },
  { id: 'l7', at: minAgo(1440 + 260), ...who('s-ksenia'), type: 'orders', text: 'Сменён статус: «Передано в CDEK»', obj: 'Заказ 1038', to: '/admin/order/1038' },
  { id: 'l8', at: minAgo(1440 + 430), ...who('s-ivan'), type: 'staff', text: 'Создано приглашение · Контент', obj: 'Сотрудники', to: '/admin/staff' },
  { id: 'l9', at: minAgo(1440 + 600), ...who('s-liza'), type: 'catalog', text: 'Отзыв опубликован', obj: 'Отзывы', to: '/admin/reviews' },
];

/** Сводка (adm25): новые заказы, оплачено, комиссия, новые покупатели. */
export const SUMMARY: Record<'day' | 'week' | 'month', { sub: string; v: [number, number, number, number]; newReq?: number }> = {
  day: { sub: 'Сегодня, 5 октября', v: [5, 48200, 6400, 3], newReq: 2 },
  week: { sub: '29 сентября — 5 октября', v: [31, 284600, 37800, 14] },
  month: { sub: 'Сентябрь', v: [118, 1096300, 141200, 52] },
};

export type DemoStaff = { role: Role; perms?: Perm[] };
