import { IMG } from './images';

/** Фотоотчёт со склада: фото загружает сотрудник в админке (adm12), покупатель только смотрит. */
export const PHOTO_REPORTS: Record<string, { place: string; date: string; pics: string[] }> = {
  '1046': { place: 'Склад в Китае', date: '9 августа', pics: [IMG.sneak, IMG.bag, IMG.chinos] },
};

/** Отзывы. В «Отзывах о labeled» показываются только опубликованные модератором (adm20). */
export type ReviewKind = 'app' | 'ya' | 'gis';
export type Review = { id: string; name: string; date: string; stars: number; kind: ReviewKind; badge: string; text: string; pics?: string[]; reply?: string; replyDate?: string; status: 'pub' | 'mod' | 'hid'; url?: string };

export const REVIEWS: Review[] = [
  { id: 'r1', name: 'Мария К.', date: '19 сентября', stars: 5, kind: 'app', badge: 'Покупка подтверждена · по ссылке · 29 дней', text: 'Заказывала кроссовки с Poizon. Продавец написал, что цена выросла, и спросил, беру ли. Фотоотчёт со склада совпал с тем, что пришло.', pics: [IMG.sneakS], status: 'pub' },
  { id: 'r2', name: 'Дмитрий', date: '14 сентября', stars: 2, kind: 'app', badge: 'Покупка подтверждена · по ссылке · 41 день', text: 'Посылка почти две недели стояла на таможне, статус долго не менялся. Вещь пришла целой, но ждать пришлось дольше, чем рассчитывал.', reply: 'Дмитрий, задержка была на таможенном оформлении, а статус мы обновили с опозданием. Этап «Таможня» теперь виден в отслеживании отдельно.', replyDate: '15 сентября', status: 'pub' },
  { id: 'r3', name: 'Екатерина Л.', date: '2 сентября', stars: 5, kind: 'ya', badge: 'Яндекс Карты · перенесён без изменений', text: 'Брала джемпер в состоянии «чуть уставшее» — так и есть, катышки честно показали на фото. Забрала в пункте CDEK.', status: 'pub', url: 'https://yandex.ru/maps' },
  { id: 'r4', name: 'Игорь', date: '28 августа', stars: 4, kind: 'gis', badge: '2ГИС · перенесён без изменений', text: 'Не сразу понял, как платить переводом и куда загружать чек. В остальном всё чётко, бомбер новый, с бирками.', status: 'pub', url: 'https://2gis.ru' },
  { id: 'r5', name: 'Алина Р.', date: '20 августа', stars: 5, kind: 'app', badge: 'Покупка подтверждена · из наличия · 3 дня', text: 'Рюкзак как на фото, пришёл в коробке. Заказываю второй раз.', pics: [IMG.bagS], status: 'pub' },
  { id: 'r6', name: 'Олег П.', date: 'Вчера', stars: 4, kind: 'app', badge: 'Покупка подтверждена · из наличия', text: 'Бомбер как на фото. Доставка CDEK заняла на два дня дольше, чем писали.', status: 'mod' },
  { id: 'r7', name: 'Без имени', date: '30 сентября', stars: 1, kind: 'app', badge: 'Без заказа', text: 'Реклама другого магазина со ссылкой.', status: 'hid' },
];

export const RATING: { total: number; score: string; count: string; bars: { n: number; c: number }[]; sources: { name: string; meta: string; score: string; url?: string }[] } = {
  total: 1184, score: '4,8', count: 'Средняя по всем источникам · 1 184 оценки',
  bars: [{ n: 5, c: 1010 }, { n: 4, c: 115 }, { n: 3, c: 27 }, { n: 2, c: 12 }, { n: 1, c: 20 }],
  sources: [
    { name: 'В приложении', meta: '312 отзывов · только после получения заказа', score: '4,9' },
    { name: 'Яндекс Карты', meta: '806 оценок · обновляется автоматически', score: '4,7', url: 'https://yandex.ru/maps' },
    { name: '2ГИС', meta: '66 оценок · обновляется автоматически', score: '4,8', url: 'https://2gis.ru' },
  ],
};
