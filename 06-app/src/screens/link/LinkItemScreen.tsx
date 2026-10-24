import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { paymentsApi } from '../../api/checkout';
import { linkApi } from '../../api/link';
import { commFor, commissionText, emptyItem, guessPlatform, pickUrl, PLATFORMS, rateFor, type LinkItem } from '../../domain/linkOrder';
import { rub } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { actions, appStore } from '../../store/app';
import { Btns } from '../../ui/Btn';
import { H, Tog } from '../../ui/blocks';
import { Input, Radio, Upload } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { linkAbout, sizeHelpSheet } from './LinkScreen';

const digits = (v: string) => parseInt(v.replace(/\D/g, ''), 10) || 0;

/** AW — позиция заявки: площадка, ссылка, фото, размер, количество, цена в юанях, услуги. Сохраняется кнопкой. */
export function LinkItemScreen() {
  const { key = 'new' } = useParams();
  const nav = useNav();
  const sheet = useSheet();
  const isNew = key === 'new';
  const [it, setIt] = useState<LinkItem>(() => (isNew ? emptyItem() : appStore.get().link.items.find((x) => x.key === key) ?? emptyItem()));
  const [platTouched, setPlatTouched] = useState(!isNew);
  const [urlTouched, setUrlTouched] = useState(false);
  const [urlCut, setUrlCut] = useState(false);
  const [picErr, setPicErr] = useState(false);
  const rates = useApi(() => linkApi.rates(), [], 'rates');
  const set = (p: Partial<LinkItem>) => setIt((x) => ({ ...x, ...p }));

  const urlOk = it.url.trim().length > 3 && it.url.includes('.');
  const ok = urlOk && it.price > 0 && it.qty >= 1;
  const save = () => {
    const items = appStore.get().link.items;
    actions.setLink({ items: isNew ? items.concat([it]) : items.map((x) => (x.key === it.key ? it : x)) });
    nav.back();
  };
  const r = rates.data;
  const hint = it.price && r
    ? `Расчётный курс: ${rateFor(r, it.price).toFixed(2).replace('.', ',')} ₽ за 1 ¥ · комиссия ${rub(commFor(r, it.price))} за штуку`
    : 'Комиссия зависит от цены: ' + (r ? commissionText(r) : 'до 100 ¥ — 300 ₽, до 2 000 ¥ — 500 ₽, дальше 1 000 ₽');

  return (
    <Screen header={<Header title={isNew ? 'Новый товар' : 'Товар в заявке'} />}
      bar={{ btns: [{ label: isNew ? 'Добавить товар' : 'Сохранить', kind: 'primary', dis: !ok, on: save }] }}>
      <H text="Площадка" />
      <Radio label="Площадка" rows={PLATFORMS.map((p) => ({ label: p, on_: it.plat === p, act: () => { setPlatTouched(true); set({ plat: p }); } }))} />
      <div onBlur={() => setUrlTouched(true)}>
        <Input label="Ссылка на товар" value={it.url} ph="https://" mode="url" err={urlTouched && !urlOk ? 'Укажите ссылку на товар' : undefined}
          hint={urlCut ? 'Из текста оставили только ссылку' : undefined}
          onChange={(v) => { const url = pickUrl(v); setUrlCut(url !== v); set({ url, ...(platTouched ? {} : { plat: guessPlatform(v) }) }); }} />
      </div>
      <Upload accept="image/*" title="Прикрепить скриншот" text="Фото товара (необязательно)" file={it.pic}
        err={picErr ? 'Файл не загрузился — попробуйте ещё раз или выберите другой' : undefined}
        onPick={(f) => { setPicErr(false); paymentsApi.uploadReceipt('link', f).then((p) => set({ pic: { ...p, name: 'Скриншот карточки', meta: '1 файл' } }), () => setPicErr(true)); }}
        onClear={() => set({ pic: null })} />
      <Input label="Размер" value={it.size} ph="Например, M или 42" onChange={(v) => set({ size: v })} />
      <Input label="Количество" value={String(it.qty)} mode="numeric" onChange={(v) => set({ qty: Math.max(1, digits(v)) })} />
      <Input label="Цена одной штуки, ¥" value={it.price ? String(it.price) : ''} ph="0" mode="numeric" hint={hint} onChange={(v) => set({ price: digits(v) })} />
      <H text="Услуги для этого товара" />
      <Tog rows={[
        { label: `Фотоотчёт — ${r?.photo ?? 200} ₽ за штуку`, on_: it.photo, act: () => set({ photo: !it.photo }) },
        { label: `Коробка — ${r?.box ?? 200} ₽ за штуку`, on_: it.box, act: () => set({ box: !it.box }) },
      ]} />
      <Btns items={[{ label: 'Помощь с размером', kind: 'violet', on: () => sheet.open(sizeHelpSheet(linkAbout(it))) }]} />
    </Screen>
  );
}
