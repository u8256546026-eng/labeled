import type { LinkCalc, LinkForm, Rates } from '../domain/linkOrder';
import { RATES } from '../mocks/link';
import { ApiError, http, live, mock } from './client';

const scenario = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('scenario') : null);
let seq = 1050;

export type LinkRequest = { num: string; title: string; form: LinkForm; calc: LinkCalc; date: string };

export const linkApi = {
  /** Курс, надбавки, комиссия и услуги. ?scenario=calcerr — курс недоступен, расчёт не показываем. */
  rates(): Promise<Rates> {
    if (scenario() === 'calcerr') return new Promise((_, rej) => setTimeout(() => rej(new ApiError('server', 'rates')), 300));
    if (live()) return http<Rates>('GET', '/api/rates').then((r) => Object.assign(RATES, r));
    return mock(() => RATES);
  },

  /** Заявка уходит продавцу на проверку. Оплаты до одобрения нет. */
  submit(form: LinkForm, calc: LinkCalc, key?: string, addressId?: string): Promise<LinkRequest> {
    if (live()) {
      // Сумму пересчитывает сервер по своим настройкам; в ответе — его расчёт.
      return http<{ num: string; title: string; calc: LinkCalc; date: string }>('POST', '/api/link', {
        title: form.title, protect: form.protect, ship: form.ship, disc: form.disc, draftId: form.draftId, key, addressId,
        items: form.items.map((it) => ({ key: it.key, plat: it.plat, url: it.url, size: it.size, qty: it.qty, price: it.price, photo: it.photo, box: it.box, picFileId: it.pic?.fileId ?? null })),
      }).then((r) => ({ ...r, form }));
    }
    return mock(() => ({ num: String(seq++), title: form.title, form, calc, date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) }));
  },
};
