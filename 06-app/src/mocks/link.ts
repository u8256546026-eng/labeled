import type { LinkDraft, LinkForm, Rates } from '../domain/linkOrder';
import { IMG } from './images';

/** Демонстрационные параметры расчёта из Buyer v15, не текущий курс. */
export const RATES: Rates = {
  rate: 11.62, rateDate: '09.10.2026',
  markup: [{ upTo: 1000, value: 0.70 }, { upTo: 3000, value: 0.65 }, { upTo: null, value: 0.60 }],
  commission: [{ upTo: 100, value: 300 }, { upTo: 2000, value: 500 }, { upTo: null, value: 1000 }],
  photo: 200, box: 200, protectPct: 1, pointsShare: 0.3,
};

/** Заявка «Осенний дроп» из кадра B. */
export const link0 = (): LinkForm => ({
  title: 'Осенний дроп',
  items: [
    { key: 'i1', plat: 'Poizon', url: 'poizon.com/product/8842190', size: 'M', qty: 2, price: 420, photo: true, box: false, pic: { name: 'Скриншот карточки', meta: '1 файл', preview: IMG.sneakS } },
    { key: 'i2', plat: 'Taobao', url: 'item.taobao.com/i77120934', size: 'L', qty: 1, price: 1250, photo: false, box: true, pic: null },
  ],
  protect: false, ship: 'all', disc: 'none', dirty: false,
});

export const drafts0 = (): LinkDraft[] => [{
  id: 'd1', date: '18 сентября',
  form: { draftId: 'd1', title: 'Кроссовки другу', items: [{ key: 'd1i1', plat: 'Poizon', url: 'dw4.co/t/A/1sKq9X', size: '42', qty: 1, price: 899, photo: true, box: true, pic: null }], protect: false, ship: 'all', disc: 'none', dirty: false },
}];
