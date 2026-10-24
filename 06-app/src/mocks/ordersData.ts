import type { Order } from '../domain/orders';
import { rub } from '../lib/format';
import { IMG, U } from './images';

const HOODIE = U('1556821840-3a63f95609a7', 200);
const JEANS = U('1542272604-787c3835535d', 200);

/** Заказы и заявки покупателя из Buyer v15 (G, D, J, AA) и Flow v12 (7i–7l). Тексты — из макетов. */
export const ORDERS: Order[] = [
  {
    num: '1047', pre: 'Заявка', name: 'Летние кеды', kind: 'link', title: 'Заявка 1047', sub: 'Летние кеды · 21 сентября',
    listMeta: '21 сентября · продавец изменил состав', group: 'decision', thumbs: [IMG.sneakS, IMG.knitS],
    status: 'Нужно ваше решение', tone: 'wait', listStatus: 'Нужно решение', listTone: 'err', stage: 0,
    note: 'Продавец проверил заявку и изменил её. Без вашего согласия заказ не оформится и оплата не выставится.',
    alert: { title: 'Что изменилось', text: 'Кеды размера 42 закончились — позиция убрана. Цена худи на Taobao выросла со 180 до 210 ¥.' },
    items: [
      { name: 'Poizon · кеды', params: '42 · 1 шт · нет в наличии', price: '—', img: IMG.sneakS, tag: 'убрано продавцом' },
      { name: 'Taobao · худи', params: 'L · 1 шт · 210 ¥ вместо 180 ¥', price: rub(3087), img: IMG.knitS, tag: 'цена изменена' },
    ],
    sums: { rows: [{ label: 'Было в заявке', value: rub(9624) }, { label: 'Кеды убраны', value: '−' + rub(6906) }, { label: 'Худи: 180 → 210 ¥', value: '+' + rub(369) }, { label: 'Новая сумма', value: rub(3087), total: true }], note: 'Курс и комиссия пересчитаны по тем же правилам. Баллы и скидку можно применить при оплате.' },
    acts: [
      { label: 'Согласиться — ' + rub(3087), kind: 'primary', pay: { id: 'p-1047', kind: 'goods', orderNum: '1047', orderLabel: '1047', sum: 3087 } },
      { label: 'Отказаться от заявки', kind: 'danger', sheet: 'cancel' },
    ],
  },
  {
    num: '1043', pre: 'Заявка', name: 'Осенний дроп', kind: 'link', title: 'Заявка 1043', sub: 'Осенний дроп · 20 сентября',
    listMeta: '20 сентября · 2 позиции', group: 'decision', thumbs: [IMG.sneakS],
    status: 'Ждёт подтверждения', tone: 'wait', stage: 0, cancellable: true,
    note: 'Продавец проверяет ссылки, наличие и цену. Оплаты до одобрения нет.',
    history: [{ label: 'Ждёт подтверждения', date: '20 сентября', state: 'current' }, { label: 'Оформлен — ждёт оплаты', state: 'future' }],
    items: [{ name: 'Poizon · 420 ¥ за штуку', params: 'Размер M · 2 шт', price: rub(10349), img: IMG.sneakS, serv: ['фотоотчёт'] }],
    acts: [{ label: 'Отменить заявку', kind: 'danger', sheet: 'cancel' }],
  },
  {
    num: 'pre', pre: 'Заявка', name: 'футболка', kind: 'stock', sizeRequest: true, title: 'Заявка на размер', sub: 'Футболка с принтом · XL',
    listTitle: 'Заявка на размер XL · футболка', listMeta: '19 сентября · продавец подтвердил сумму', group: 'decision', thumbs: [IMG.teeBlackS],
    status: 'Есть предложение', tone: 'live', stage: 0,
    note: 'Продавец подтвердил возможность заказа и назвал сумму 4 600 ₽. Проверьте предложение и переходите к оплате — цена наличия автоматически не переносится.',
    sums: { rows: [{ label: 'Футболка с принтом · Чёрный / XL', value: rub(4600) }, { label: 'К оплате', value: rub(4600), total: true }] },
    acts: [
      { label: 'Перейти к оплате', kind: 'primary', pay: { id: 'p-1049', kind: 'goods', orderNum: '1049', orderLabel: '1049', sum: 4600 } },
      { label: 'Отказаться от предложения', kind: 'danger', sheet: 'cancel' },
    ],
  },
  {
    num: '1044', pre: 'Заказ', name: 'Зимняя куртка', kind: 'link', title: 'Заказ 1044', sub: 'Зимняя куртка · 19 сентября',
    listMeta: '19 сентября · 1 вещь', group: 'active', thumbs: [IMG.bomberS],
    status: 'Оформлен — ждёт оплаты', tone: 'wait', stage: 0, awaitingPay: true, payId: 'p-1044', cancellable: true,
    note: 'Продавец подтвердил заявку и сумму 24 680 ₽. Оплатите товары переводом — после подтверждения оплаты начнётся выкуп.',
    sums: { rows: [{ label: 'Товары и комиссия', value: rub(24680) }, { label: 'К оплате', value: rub(24680), total: true }], note: 'Доставка из-за границы оплачивается отдельно после поступления на склад в Китае.' },
    acts: [{ label: 'Оплатить товары', kind: 'primary', to: '/pay/p-1044' }, { label: 'Отменить заказ', kind: 'danger', sheet: 'cancel' }],
  },
  {
    num: '1041', pre: 'Заказ', name: 'Худи', kind: 'link', title: 'Заказ 1041', sub: 'Худи · 6 сентября',
    listMeta: '6 сентября · 1 вещь', group: 'active', thumbs: [HOODIE],
    status: 'Оформлен — ждёт оплаты', tone: 'wait', stage: 0, awaitingPay: true, payId: 'p-1041',
    note: '',
    history: [{ label: 'Ждёт подтверждения', date: '6 сентября', state: 'done' }, { label: 'Оформлен — ждёт оплаты', date: '6 сентября', state: 'done' }, { label: 'Оплата на проверке', date: '6 сентября', state: 'current' }, { label: 'Оплачен', state: 'future' }],
  },
  {
    num: '1045', pre: 'Заказ', name: 'Джинсы', kind: 'link', title: 'Заказ 1045', sub: 'Джинсы · 5 сентября',
    listMeta: '5 сентября · причина указана', group: 'active', thumbs: [JEANS],
    status: 'Оформлен — ждёт оплаты', tone: 'wait', stage: 0, awaitingPay: true, payId: 'p-1045', note: '',
  },
  {
    num: '1042', pre: 'Заказ', name: 'Базовый гардероб', kind: 'link', title: 'Заказ 1042', sub: 'Из-за границы · 4 сентября · 3 вещи',
    listMeta: '4 сентября · 3 вещи · 2 посылки', group: 'active', thumbs: [IMG.teeBlackS, IMG.knitS, IMG.chinosS],
    status: 'На складе в Китае', tone: 'live', stage: 1,
    note: 'Вещи выкуплены и лежат на складе. Дальше каждая посылка едет отдельно — доставку оплачиваете по каждой.',
    history: [
      { label: 'Ждёт подтверждения', date: '4 сентября', state: 'done' },
      { label: 'Оформлен — ждёт оплаты', date: '4 сентября', state: 'done' },
      { label: 'Оплата на проверке', date: '4 сентября', state: 'done' },
      { label: 'Оплачен', date: '5 сентября', state: 'done' },
      { label: 'Едет на склад', date: '6 сентября', state: 'done' },
      { label: 'На складе в Китае', date: '7 сентября', state: 'current' },
      { label: 'Едет в Россию', state: 'future' },
      { label: 'Таможня', state: 'future' },
      { label: 'Едет на склад России', state: 'future' },
      { label: 'Передано в CDEK', state: 'future' },
      { label: 'В пути к вам', state: 'future' },
      { label: 'Доставлен', state: 'future' },
    ],
    parcels: [
      { title: 'Посылка 1 из 2', stage: 'На складе в Китае', cur: 1, payId: 'p-1042-1', items: [{ name: 'Футболка с принтом · Чёрный / M · новое', img: IMG.teeBlackS }, { name: 'Джемпер крупной вязки · Молочный / S · чуть уставшее', img: IMG.knitS }] },
      { title: 'Посылка 2 из 2', stage: 'В пути к вам', cur: 3, deliveryPaid: rub(1200) + ' · оплачена 6 сентября', track: 'CDEK 1042 7788 991', items: [{ name: 'Брюки чинос · Бежевый / 32 · новое', img: IMG.chinosS }] },
    ],
    parcelNote: 'Оплата одной посылки не закрывает доставку другой.',
    materials: { rows: [{ label: 'Товары и комиссия', value: 'Оплачено 5 сентября' }, { label: 'Фото выкупа', value: '2 файла от продавца' }, { label: 'Фотоотчёт со склада', value: 'Не выбран — платная услуга' }], pics: [IMG.teeBlackS, IMG.knitS] },
    acts: [{ label: 'Отменить заказ', kind: 'off', dis: true }],
    footnote: 'Отмена доступна до выкупа — вещи уже выкуплены, поэтому кнопка выключена.',
  },
  {
    num: '1040', pre: 'Заказ', name: 'Футболка с принтом', kind: 'stock', title: 'Заказ 1040', sub: 'Из наличия · 18 сентября',
    listMeta: '22 сентября · из наличия · подтвердите получение', group: 'active', thumbs: [IMG.teeBlack2S],
    status: 'Доставлен в пункт выдачи', tone: 'live', stage: 3, receivable: true,
    note: 'CDEK доставил посылку 22 сентября: Тверская, 15. Проверьте вещь и подтвердите получение.',
    items: [{ name: 'Футболка с принтом', params: 'Чёрный / S · новое', price: rub(3990), img: IMG.teeBlack2S, tag: 'новое' }],
    alert: { title: 'Проверьте при получении', text: 'Если с вещью что-то не так, сообщите до 29 сентября. После этого заказ закроется автоматически.' },
    acts: [{ label: 'Всё в порядке, получил', kind: 'primary', recv: true }, { label: 'Проблема с заказом', kind: 'dangerSoft', to: '/claim/1040' }],
  },
  {
    num: '1038', pre: 'Заказ', name: 'Бомбер и рюкзак', kind: 'stock', title: 'Заказ 1038', sub: 'Из наличия · 1 сентября',
    listMeta: '1 сентября · 2 вещи', group: 'active', thumbs: [IMG.bomberS, IMG.bagS],
    status: 'В пути к вам', tone: 'live', stage: 2, cancellable: true,
    note: 'Заказ из наличия — без китайского маршрута.',
    history: [{ label: 'Оформлен', date: '1 сентября', state: 'done' }, { label: 'Оплата на проверке', date: '1 сентября', state: 'done' }, { label: 'Оплата подтверждена', date: '1 сентября', state: 'done' }, { label: 'Передано в CDEK', date: '2 сентября', state: 'done' }, { label: 'В пути к вам', date: '3 сентября', state: 'current' }, { label: 'Доставлен', state: 'future' }],
    parcels: [{ title: 'Доставка', stage: 'В пути к вам', cur: 2, deliveryPaid: 'Оплачена при оформлении', track: 'CDEK 1038 4410 233', items: [{ name: 'Бомбер на молнии · Кирпичный / M · новое', img: IMG.bomberS }, { name: 'Рюкзак городской · Синий · новое', img: IMG.bagS }] }],
    materials: { rows: [{ label: 'Оплата товаров', value: 'Подтверждена продавцом 1 сентября' }, { label: 'Списано баллов', value: '250 ₽' }] },
    acts: [{ label: 'Отменить заказ', kind: 'danger', sheet: 'cancel' }],
    footnote: 'Заказ из наличия можно отменить до получения.',
  },
  {
    num: '1046', pre: 'Заказ', name: 'Кроссовки', kind: 'stock', title: 'Заказ 1046', sub: 'Кроссовки · 12 августа',
    listMeta: '12 августа · получен', group: 'done', thumbs: [IMG.sneakS],
    status: 'Доставлен', tone: 'off', stage: 3, note: 'Заказ получен 12 августа.', receivedAt: '12 августа',
    items: [{ name: 'Кроссовки', params: '42 · новое', price: rub(15400), img: IMG.sneakS }],
    photos: { title: 'Фотоотчёт со склада', text: 'Услуга оплачена · 3 файла', pics: [IMG.sneakS, IMG.bagS, IMG.chinosS] },
    acts: [{ label: 'Смотреть фотоотчёт', kind: 'info', to: '/photo/1046' }, { label: 'Проблема с заказом', kind: 'dangerSoft', to: '/claim/1046' }],
  },
  {
    num: '1037', pre: 'Заявка', name: 'Кроссовки', kind: 'link', title: 'Заявка 1037', sub: 'Из-за границы · заявка 31 августа',
    listMeta: '31 августа · причина указана', group: 'done', thumbs: [IMG.sneakS],
    status: 'Отклонён', tone: 'err', stage: 0,
    stopped: { label: 'Заявка отклонена продавцом', reason: 'Цена на площадке отличается от указанной в заявке · 31 августа' },
    note: 'Заявку можно оформить заново с верной ценой. Оплата не запрашивалась.',
    history: [{ label: 'Ждёт подтверждения', date: '31 августа', state: 'done' }, { label: 'Отклонён', date: '31 августа', state: 'stop' }],
    materials: { rows: [{ label: 'Оплата товаров', value: 'Оплаты не было' }, { label: 'Причина', value: 'Указана продавцом' }] },
    acts: [{ label: 'Оформить заново', kind: 'primary', to: '/link', root: true }],
  },
  {
    num: '1039', pre: 'Заказ', name: 'Свитшот', kind: 'link', title: 'Заказ 1039', sub: 'Из-за границы · оформлен 1 сентября',
    listMeta: '1 сентября · отменён покупателем', group: 'done', thumbs: [IMG.teeGreyS],
    status: 'Отменён', tone: 'off', stage: 0,
    stopped: { label: 'Заказ отменён', reason: 'Отменён покупателем до выкупа · 2 сентября' },
    note: 'Вещи не выкупались, оплаты не было.',
    history: [{ label: 'Ждёт подтверждения', date: '1 сентября', state: 'done' }, { label: 'Оформлен — ждёт оплаты', date: '1 сентября', state: 'done' }, { label: 'Отменён', date: '2 сентября', state: 'stop' }],
    materials: { rows: [{ label: 'Оплата товаров', value: 'Оплаты не было' }, { label: 'Причина', value: 'Отмена покупателем' }] },
    acts: [{ label: 'Помощь', kind: 'violet', to: '/help' }],
  },
];

export const DRAFTS = [{ id: 'd1', title: 'Кроссовки другу', date: '18 сентября' }];
