import { useState } from 'react';
import { pvzText, SLOTS, type Delivery } from '../../domain/order';
import { useNav } from '../../nav/useNav';
import { actions, appStore, useApp } from '../../store/app';
import { openExternal } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Chips, H, P } from '../../ui/blocks';
import { Fields, Input } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

/** Карта пунктов выдачи и постаматов CDEK — покупатель находит удобный и вписывает его адрес или код. */
const CDEK_OFFICES = 'https://www.cdek.ru/ru/offices';

/**
 * X — способ получения CDEK: пункт выдачи, постамат или курьер. Своего списка пунктов у магазина нет (нужен договор
 * и ключ API CDEK), поэтому пункт покупатель вписывает сам; продавец видит его в заказе. Применяется кнопкой «Выбрать».
 */
export function DeliveryScreen() {
  const nav = useNav();
  const [d, setD] = useState<Delivery>(() => { const x = appStore.get().dlv; return { ...x, pvz: pvzText(x) }; });
  const addr = useApp((s) => s.addrs[s.addrSel]);
  const set = (p: Partial<Delivery>) => setD((x) => ({ ...x, ...p }));
  const ok = d.mode === 'courier' || d.pvz.trim().length >= 3;

  return (
    <Screen header={<Header title="Способ получения" sub="Заказ из наличия · CDEK" />}
      bar={{ btns: [{ label: 'Выбрать', kind: 'primary', dis: !ok, on: () => { actions.setDelivery({ ...d, pvz: d.pvz.trim() }); nav.back(); } }] }}>
      <Chips label="Способ получения" rows={([['pvz', 'Пункт выдачи'], ['post', 'Постамат'], ['courier', 'Курьер']] as const).map(([k, l]) => ({
        label: l, on_: d.mode === k, act: () => set({ mode: k }),
      }))} />
      {d.mode !== 'courier' ? (
        <>
          <Input label={d.mode === 'post' ? 'Адрес или код постамата CDEK' : 'Адрес или код пункта CDEK'} value={d.pvz} max={200}
            ph="Например, Москва, Тверская, 15 или MSK123" onChange={(v) => set({ pvz: v.slice(0, 200) })} />
          <Btns items={[{ label: 'Найти пункт на карте CDEK', kind: 'limeSoft', on: () => openExternal(CDEK_OFFICES) }]} />
          <P>{d.mode === 'post' ? 'В постамате нет примерки. Посылку забираете по коду из уведомления.' : 'Выберите пункт на карте CDEK и впишите его адрес или код. В пунктах с примерочной вещь можно осмотреть до получения.'}</P>
        </>
      ) : (
        <>
          <Fields rows={[{ label: 'Адрес доставки', value: addr ? addr.city + ', ' + addr.line : '', ph: 'Выберите адрес', on: () => nav.go('/addresses') }]} />
          <H text="Когда удобно" />
          <Chips label="Интервал" rows={SLOTS.map((x, i) => ({ label: x, on_: d.slot === i, act: () => set({ slot: i }) }))} />
        </>
      )}
    </Screen>
  );
}
