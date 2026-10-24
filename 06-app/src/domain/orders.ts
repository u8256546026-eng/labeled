import type { BtnKind, SumRow } from './view';
import type { Payment } from './order';

/** Пять групп импортных этапов (предложение интерфейса) и четыре точки заказа из наличия. */
export const G5 = ['Оформление', 'Китай', 'В Россию', 'По России', 'Получен'];
export const G4 = ['Оформлен', 'Оплата подтверждена', 'Передано в CDEK', 'Доставлен'];

export type Tone = 'live' | 'wait' | 'err' | 'off';
export type HistState = 'done' | 'current' | 'future' | 'stop';
export type HistRow = { label: string; date?: string; state: HistState };

export type OrderAct =
  | { label: string; kind: BtnKind; to: string; root?: boolean }
  | { label: string; kind: BtnKind; sheet: 'cancel' | 'support' }
  | { label: string; kind: BtnKind; pay: Omit<Payment, 'state'> }
  | { label: string; kind: BtnKind; recv: true }
  | { label: string; kind: 'off'; dis: true };

export type Parcel = {
  title: string; stage: string; cur: number;
  items: { name: string; img: string }[];
  /** Доставка посылки оплачивается отдельно; состояние берётся из платежа. */
  payId?: string; deliveryPaid?: string; track?: string;
};

/** Заказ или заявка покупателя. Одна модель на импорт и наличие; экран собирается из данных. */
export type Order = {
  num: string;
  pre: 'Заказ' | 'Заявка';
  /** Короткое название для списка. */
  name: string;
  kind: 'link' | 'stock';
  title: string;
  sub: string;
  /** Подписи и группа в «Моих заказах». */
  listMeta: string;
  group: 'draft' | 'decision' | 'active' | 'done';
  thumbs: string[];
  status: string;
  tone: Tone;
  /** В списке подпись и цвет могут быть короче и заметнее: «Нужно решение» красным. */
  listStatus?: string;
  listTone?: Tone;
  /** Своя первая строка карточки списка вместо «Заявка 1043 · Название». */
  listTitle?: string;
  note: string;
  stage: number;
  stopped?: { label: string; reason: string };
  /** Ждёт оплаты товаров — статус выводится из платежа payId. */
  awaitingPay?: boolean;
  payId?: string;
  history?: HistRow[];
  alert?: { title: string; text: string };
  items?: { name: string; params: string; price: string; img: string; tag?: string; serv?: string[]; qty?: string }[];
  sums?: { rows: SumRow[]; note?: string };
  parcels?: Parcel[];
  parcelNote?: string;
  photos?: { title: string; text: string; pics: string[] };
  materials?: { rows: { label: string; value: string }[]; pics?: string[] };
  acts?: OrderAct[];
  footnote?: string;
  /** Отмену можно запросить (до выкупа для импорта, до получения для наличия). */
  cancellable?: boolean;
  /** Заявка на отсутствующий размер: вместо полосы этапов — решение продавца. */
  sizeRequest?: boolean;
  /** Ждёт подтверждения получения (AA). */
  receivable?: boolean;
  /** Дата получения — в обращении по заказу (M). */
  receivedAt?: string;
};

export type OrderUserState = { cancel?: 'sent'; recv?: 'ok' };

/** Итоговый вид заказа с учётом платежа и действий покупателя. */
export function orderView(o: Order, pay: Payment | undefined, us: OrderUserState | undefined): Order {
  let v = o;
  if (o.awaitingPay && pay) {
    const stock = o.kind === 'stock';
    if (pay.state === 'review') {
      v = { ...v, status: 'Оплата на проверке', tone: 'wait', note: stock ? 'Чек получен, продавец сверяет поступление. Вещи закреплены за вами.' : 'Чек загружен, продавец сверяет поступление вручную. Заказ пока не оплачен.', stage: stock ? 1 : 0,
        acts: [{ label: 'Открыть платёж', kind: 'warn', to: '/pay/' + pay.id }, ...(o.cancellable ? [{ label: 'Отменить заказ', kind: 'danger', sheet: 'cancel' } as OrderAct] : [])] };
    } else if (pay.state === 'fail') {
      v = { ...v, status: 'Оплата не подтверждена', tone: 'err', note: 'Продавец не нашёл поступление по чеку. Заказ остался в статусе «ждёт оплаты» — прикрепите другой чек или напишите в поддержку.',
        acts: [{ label: 'Прикрепить другой чек', kind: 'primary', to: '/pay/' + pay.id }, { label: 'Написать в поддержку', kind: 'violet', sheet: 'support' }] };
    } else if (pay.state === 'ok') {
      v = { ...v, status: 'Оплачен', tone: 'live', note: 'Оплата подтверждена продавцом.' + (stock ? '' : ' Дальше продавец выкупит вещи и отправит их на склад.'), stage: 1, acts: o.cancellable ? [{ label: 'Отменить заказ', kind: 'danger', sheet: 'cancel' }] : [] };
    }
  }
  if (o.receivable && us?.recv === 'ok') {
    v = { ...v, status: 'Получен', tone: 'off', note: 'Вы подтвердили получение. Заказ закрыт.', stage: 4, alert: undefined, acts: [], receivable: false, group: 'done' };
  }
  return v;
}

/** Подпись статуса доставки посылки по состоянию её платежа. */
export function parcelDelivery(sum: string, pay: Payment | undefined, paidNote?: string): { text: string; needPay: boolean } {
  if (paidNote) return { text: paidNote, needPay: false };
  if (!pay) return { text: sum + ' · ждёт оплаты', needPay: true };
  if (pay.state === 'ok') return { text: sum + ' · оплачена', needPay: false };
  if (pay.state === 'review') return { text: sum + ' · оплата на проверке', needPay: false };
  if (pay.state === 'fail') return { text: sum + ' · оплата не подтверждена', needPay: true };
  return { text: sum + ' · ждёт оплаты', needPay: true };
}
