import type { Receipt } from './order';

export type Platform = 'Poizon' | 'Taobao' | 'Свой вариант';
export const PLATFORMS: Platform[] = ['Poizon', 'Taobao', 'Свой вариант'];

/** Позиция заявки: одна ссылка, один размер. Разные размеры — отдельные позиции. */
export type LinkItem = {
  key: string;
  plat: Platform | '';
  url: string;
  size: string;
  qty: number;
  /** Цена одной штуки в юанях. */
  price: number;
  photo: boolean;
  box: boolean;
  pic?: Receipt | null;
};

export type LinkForm = {
  draftId?: string;
  title: string;
  items: LinkItem[];
  protect: boolean;
  ship: 'all' | 'parts';
  disc: 'points' | 'comm' | 'none';
  dirty: boolean;
};

export type LinkDraft = { id: string; date: string; form: LinkForm };

/** Ступень по цене одной вещи: действует для цены до upTo ¥ включительно; upTo = null — для всех дороже. */
export type Tier = { upTo: number | null; value: number };

/**
 * Параметры расчёта. Задаёт владелец в админке (adm21) и получает приложение из API вместе с курсом;
 * новые значения действуют для новых заявок. Граница ступени включительно: вещь ровно за 1 000 ¥
 * идёт по ступени «до 1 000 ¥» (решение пользователя 2026-10-06).
 */
export type Rates = {
  /** Курс ЦБ, рублей за 1 ¥ (округлён вверх до копеек). */
  rate: number;
  /** Курс ЦБ подтягивается с сайта ЦБ (по умолчанию). false — владелец вводит курс вручную. */
  rateAuto?: boolean;
  /** Дата курса ЦБ «09.10.2026» — у автоматического курса. */
  rateDate?: string;
  /** Надбавка к курсу, ₽ за 1 ¥, по цене одной вещи. */
  markup: Tier[];
  /** Комиссия, ₽ за штуку, по цене одной вещи. */
  commission: Tier[];
  photo: number;
  box: number;
  protectPct: number;
  /** Доля «товары + комиссия», которую можно оплатить баллами. */
  pointsShare: number;
};

const step = (tiers: Tier[], p: number) => (tiers.find((t) => t.upTo == null || p <= t.upTo) ?? tiers[tiers.length - 1]).value;

const yuanNum = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

/** «до 100 ¥ — 300 ₽, до 2 000 ¥ — 500 ₽, дальше 1 000 ₽» — подпись из тех же настроек. */
export const commissionText = (r: Rates) => r.commission.map((t) => (t.upTo == null ? 'дальше ' : `до ${yuanNum(t.upTo)} ¥ — `) + yuanNum(t.value) + '\u00a0₽').join(', ');

export const rateFor = (r: Rates, priceCny: number) => r.rate + step(r.markup, priceCny);
export const commFor = (r: Rates, priceCny: number) => step(r.commission, priceCny);
export const itemSum = (r: Rates, it: LinkItem) => Math.round(it.price * it.qty * rateFor(r, it.price));

export type LinkCalc = { goods: number; comm: number; serv: number; prot: number; maxPts: number; commOff: number; disc: number; total: number };

/** Расчёт заявки по ссылке. Доставка из-за границы считается отдельно, после склада в Китае. */
export function calcLink(r: Rates, f: Pick<LinkForm, 'items' | 'protect' | 'disc'>, pts: number, commDiscountAllowed: boolean): LinkCalc {
  const goods = f.items.reduce((s, it) => s + itemSum(r, it), 0);
  const comm = f.items.reduce((s, it) => s + commFor(r, it.price) * it.qty, 0);
  const serv = f.items.reduce((s, it) => s + ((it.photo ? r.photo : 0) + (it.box ? r.box : 0)) * it.qty, 0);
  const prot = f.protect ? Math.round(goods * r.protectPct / 100) : 0;
  const maxPts = Math.min(pts, Math.floor((goods + comm) * r.pointsShare));
  const commOff = Math.round(comm * 0.5);
  const disc = f.disc === 'points' ? maxPts : f.disc === 'comm' && commDiscountAllowed ? commOff : 0;
  return { goods, comm, serv, prot, maxPts, commOff, disc, total: goods + comm + serv + prot - disc };
}

/** Площадка по адресу ссылки — подставляется, пока покупатель не выбрал сам. */
export function guessPlatform(url: string): Platform | '' {
  const u = url.toLowerCase();
  if (/poizon|dewu|dw4\.co/.test(u)) return 'Poizon';
  if (/taobao|tmall/.test(u)) return 'Taobao';
  if (u.trim()) return 'Свой вариант';
  return '';
}

/**
 * Ссылка из текста «Поделиться» площадки: «【得物】… https://dw4.co/t/A/Hn8BOarOq Maison Margiela…, 点击链接直接打开» →
 * «https://dw4.co/t/A/Hn8BOarOq». Без адреса http(s) в тексте возвращает текст как есть (покупатель печатает сам).
 */
export function pickUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s<>"'，。、；！？【】「」（）]+/i);
  return m ? m[0].replace(/[.,;:!?)\]}»"']+$/, '') : text;
}

export const emptyItem = (): LinkItem => ({ key: 'i' + Date.now(), plat: '', url: '', size: '', qty: 1, price: 0, photo: false, box: false, pic: null });
export const emptyForm = (): LinkForm => ({ title: '', items: [], protect: false, ship: 'all', disc: 'none', dirty: false });
