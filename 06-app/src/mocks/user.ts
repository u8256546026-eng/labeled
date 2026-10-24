import type { CartLine } from '../store/app';
import { IMG } from './images';

/** Корзина 7g: две строки «Чёрный / M» с разным состоянием и проданная вещь. */
export const cart0 = (): CartLine[] => [
  { key: 'a', itemId: 'tee', offerId: 'tee-black-M-new', name: 'Футболка с принтом', img: IMG.teeBlackS, params: 'Чёрный / M', cond: 'новое', price: 3990, qty: 2, max: 3 },
  { key: 'b', itemId: 'tee', offerId: 'tee-black-M-likenew', name: 'Футболка с принтом', img: IMG.teeBlack2S, params: 'Чёрный / M', cond: 'как новое', price: 3690, qty: 1, max: 1, single: true },
  { key: 'c', itemId: 'knit', offerId: 'knit-S-0', name: 'Джемпер крупной вязки', img: IMG.knitS, params: 'Молочный / S', cond: 'чуть уставшее', price: 8900, qty: 1, max: 1, single: true },
  { key: 'd', itemId: 'shirt', offerId: 'shirt-L-0', name: 'Джинсовая рубашка oversize', img: IMG.shirtS, params: 'Синий / L', cond: 'как новое', price: 6490, qty: 1, max: 1, gone: true },
];
