/** Обращение по заказу (M → Y): причина, описание, фото; ответ продавца приходит из админки (adm13). */
export type ClaimReason = 0 | 1 | 2 | 3 | 4;
export const CLAIM_REASONS = [
  { label: 'Брак', sub: 'Дефект, пятно, повреждение', photo: true },
  { label: 'Не та вещь', sub: 'Модель или цвет не совпадают', photo: true },
  { label: 'Не тот размер', sub: 'Размер на бирке другой', photo: true },
  { label: 'Не пришла', sub: 'Статус «доставлен», а посылки нет', photo: false },
  { label: 'Другое', sub: 'Опишите ниже', photo: false, wide: true },
] as const;

export type ClaimAnswer = 'ok' | 'no' | 'more';

/** Возврат денег по одобренному обращению — только для вещей из наличия. */
export type Refund = { to: 'sbp' | 'card'; val: string; bank: string; state: 'form' | 'sent' | 'done' };

export type Claim = {
  id: string;
  orderNum: string;
  reason: ClaimReason;
  text: string;
  photos: number;
  sentAt: string;
  state: 'sent' | 'answer';
  answer?: ClaimAnswer;
  /** Сумма к возврату, если обращение одобрено. */
  refundSum?: number;
  /** Повторно отправленные фото по запросу продавца. */
  morePhotos?: number;
  refund?: Refund;
};

export const REFUND_BANKS = ['Сбербанк', 'Т-Банк', 'Альфа-Банк', 'ВТБ', 'Озон Банк', 'Райффайзен'];

/** Номер полностью: карта — 16 цифр, телефон для СБП — 11 цифр. */
export const refundNumberComplete = (r: Pick<Refund, 'to' | 'val'>) => r.val.replace(/\D/g, '').length >= (r.to === 'card' ? 16 : 11);
export const refundReady = (r: Refund) => refundNumberComplete(r) && !!r.bank.trim();
