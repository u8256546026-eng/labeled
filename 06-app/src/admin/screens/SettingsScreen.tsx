import { useState } from 'react';
import type { Rates } from '../../domain/linkOrder';
import { numNbsp } from '../../lib/format';
import { adminApi, adminLoad, rates, requisites, type Requisites } from '../api';
import { useToast } from '../../ui/Toast';
import { useAction, useLoad } from '../hooks';
import { AdminLoading, ANote, AH, AdminScreen, Form, Rows, TogList } from '../ui';

type Draft = {
  auto: boolean; rate: string; mk: string[]; mkUp: string[]; cm: string[]; cmUp: string[];
  photo: string; box: string; prot: string; bank: string; recipient: string; number: string;
};

const s = (n: number) => String(n).replace('.', ',');
const toDraft = (r: Rates, q: Requisites): Draft => ({
  auto: r.rateAuto !== false, rate: r.rate.toFixed(2).replace('.', ','), mk: r.markup.map((t) => t.value.toFixed(2).replace('.', ',')), mkUp: r.markup.slice(0, -1).map((t) => String(t.upTo)),
  cm: r.commission.map((t) => s(t.value)), cmUp: r.commission.slice(0, -1).map((t) => String(t.upTo)),
  photo: s(r.photo), box: s(r.box), prot: s(r.protectPct), bank: q.bank, recipient: q.recipient, number: q.number,
});
const dec = (v: string) => { const t = v.replace(/\s/g, '').replace(',', '.'); return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN; };
const ascending = (a: number[]) => a.every((x, i) => x > 0 && Number.isInteger(x) && (i === 0 || x > a[i - 1]));

/** Черновик → настройки. null — есть ошибка в полях. */
function fromDraft(d: Draft, base: Rates): { rates: Rates; req: Requisites } | null {
  const rate = dec(d.rate), mk = d.mk.map(dec), cm = d.cm.map(dec), mkUp = d.mkUp.map(dec), cmUp = d.cmUp.map(dec);
  const photo = dec(d.photo), box = dec(d.box), prot = dec(d.prot);
  const nums = [...(d.auto ? [] : [rate]), ...mk, ...cm, photo, box, prot];
  if (nums.some((n) => Number.isNaN(n)) || !(d.auto || rate > 0) || prot > 100 || !ascending(mkUp) || !ascending(cmUp)) return null;
  if (!d.bank.trim() || !d.recipient.trim() || d.number.replace(/\D/g, '').length < 10) return null;
  const tiers = (vals: number[], ups: number[]) => vals.map((value, i) => ({ upTo: i < ups.length ? ups[i] : null, value }));
  return {
    rates: { ...base, rateAuto: d.auto, rate: d.auto ? base.rate : rate, markup: tiers(mk, mkUp), commission: tiers(cm, cmUp), photo, box, protectPct: prot },
    req: { bank: d.bank.trim(), recipient: d.recipient.trim(), number: d.number.trim() },
  };
}

/**
 * adm21 — только владелец. Курс ЦБ по умолчанию подтягивается с сайта ЦБ раз в час (округление вверх до копеек,
 * при сбое — последний курс); выключив автокурс, владелец вводит его сам. Курс = курс ЦБ + надбавка в рублях за ¥ по цене одной вещи, три ступени;
 * комиссия за штуку — три ступени со своими границами. Граница входит в нижнюю ступень.
 * Новые значения действуют для новых заявок, выставленные счета не пересчитываются.
 */
export function AdminSettingsScreen() {
  const L = useLoad(() => adminLoad.settings(), []);
  if (!L.ready) return <AdminLoading title="Курс, комиссия, услуги" error={L.error} retry={L.reload} />;
  return <SettingsForm />;
}

function SettingsForm() {
  const toast = useToast();
  const { busy, run } = useAction();
  const [saved, setSaved] = useState(() => toDraft(rates(), requisites()));
  const [d, setD] = useState(saved);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const at = (k: 'mk' | 'mkUp' | 'cm' | 'cmUp', i: number) => (v: string) => set({ [k]: d[k].map((x, j) => (j === i ? v : x)) } as Partial<Draft>);
  const parsed = fromDraft(d, rates());
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const rate = dec(d.rate);
  const calc = (i: number) => { const m = dec(d.mk[i]); return Number.isNaN(rate) || Number.isNaN(m) ? '—' : (rate + m).toFixed(2).replace('.', ','); };
  const up = (arr: string[], i: number) => numNbsp(arr[i] || '…');
  /** «Вещь до 1 000 ¥ включительно», «До 3 000 ¥ включительно», «Дороже 3 000 ¥». */
  const tierLabel = (ups: string[], i: number, incl: boolean) => (i < ups.length ? `${i === 0 ? 'Вещь до' : 'До'} ${up(ups, i)} ¥${incl ? ' включительно' : ''}` : `Дороже ${up(ups, ups.length - 1)} ¥`);
  const badBorders = !ascending(d.mkUp.map(dec)) || !ascending(d.cmUp.map(dec));

  return (
    <AdminScreen title="Курс, комиссия, услуги" sub="Для новых заявок"
      bar={[{ label: 'Сохранить изменения', dis: !dirty || !parsed || busy, on: () => parsed && run(() => adminApi.saveSettings(parsed.rates, parsed.req), () => { setSaved(d); toast('Сохранено'); }) }]}>
      <AH title="Курс юаня" sub="Расчётный курс = курс ЦБ + надбавка по цене одной вещи" />
      <TogList items={[{ label: 'Курс ЦБ автоматически', sub: d.auto ? 'С сайта ЦБ каждый час, округление вверх до копеек. Если ЦБ не ответит, расчёт идёт по последнему курсу' : 'Выключено — курс вводится вручную и сам не меняется', on_: d.auto, act: () => set({ auto: !d.auto }) }]} />
      {d.auto
        ? <Rows items={[{ title: 'Курс ЦБ', sub: rates().rateDate ? 'На ' + rates().rateDate : 'Обновится в течение часа', right: rates().rate.toFixed(2).replace('.', ',') + ' ₽' }]} />
        : <Form rows={[{ label: 'Курс ЦБ', sub: 'Рублей за 1 ¥', value: d.rate, onChange: (v) => set({ rate: v }), suffix: '₽' }]} />}
      <AH title="Надбавка к курсу" sub="Рублей за 1 ¥. Граница входит в нижнюю ступень" />
      <Form rows={d.mk.map((v, i) => ({ label: tierLabel(d.mkUp, i, true), sub: `Курс: ${calc(i)} ₽ за ¥`, value: v, onChange: at('mk', i), suffix: '₽' }))} />
      <Form rows={d.mkUp.map((v, i) => ({ label: `Граница ${i + 1}`, sub: 'Цена одной вещи', value: v, onChange: at('mkUp', i), suffix: '¥' }))} />
      <AH title="Комиссия за штуку" sub="Граница входит в нижнюю ступень" />
      <Form rows={d.cm.map((v, i) => ({ label: tierLabel(d.cmUp, i, false), value: v, onChange: at('cm', i), suffix: '₽' }))} />
      <Form rows={d.cmUp.map((v, i) => ({ label: `Граница ${i + 1}`, value: v, onChange: at('cmUp', i), suffix: '¥' }))} />
      {badBorders && <ANote tone="err" title="Проверьте границы" text="Вторая граница должна быть больше первой." />}
      <AH title="Услуги" />
      <Form rows={[
        { label: 'Фотоотчёт', sub: 'За штуку', value: d.photo, onChange: (v) => set({ photo: v }), suffix: '₽' },
        { label: 'Коробка', sub: 'За штуку', value: d.box, onChange: (v) => set({ box: v }), suffix: '₽' },
        { label: 'Защита', sub: 'От стоимости товаров', value: d.prot, onChange: (v) => set({ prot: v }), suffix: '%' },
      ]} />
      <AH title="Реквизиты для перевода" sub="Покупатель видит их на экране оплаты" />
      <Form rows={[
        { label: 'Банк', value: d.bank, onChange: (v) => set({ bank: v }), wide: true },
        { label: 'Получатель', value: d.recipient, onChange: (v) => set({ recipient: v }), wide: true },
        { label: 'Номер для СБП', value: d.number, onChange: (v) => set({ number: v }), wide: true },
      ]} />
      {dirty && !parsed && !badBorders && <ANote tone="err" title="Проверьте поля" text="Числа — через запятую или точку, границы — целые. Реквизиты заполнены, в номере для СБП не меньше 10 цифр." />}
      <ANote tone="wait" text="Уже выставленные счета не пересчитываются." />
    </AdminScreen>
  );
}
