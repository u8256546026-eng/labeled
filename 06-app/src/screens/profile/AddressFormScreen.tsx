import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { profileApi } from '../../api/profile';
import type { Address } from '../../domain/order';
import { useNav } from '../../nav/useNav';
import { actions, appStore } from '../../store/app';
import { requestPhone, tmaEnv } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { Input } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';

/** AR — новый адрес или изменение. «Подставить номер из Telegram» — запрос контакта; номер можно поправить. */
export function AddressFormScreen() {
  const { id = 'new' } = useParams();
  const nav = useNav();
  const sheet = useSheet();
  const isNew = id === 'new';
  const [f, setF] = useState<Address>(() => appStore.get().addrs.find((a) => a.id === id) ?? { id: 'a' + Date.now(), name: '', phone: '', city: '', line: '' });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Address>) => setF((x) => ({ ...x, ...p }));
  const phoneDigits = f.phone.replace(/\D/g, '').length;
  const ok = f.name.trim() && phoneDigits >= 10 && f.city.trim() && f.line.trim();

  const fillPhone = async () => {
    if (tmaEnv() === 'mock') {
      // В демо системного окна Telegram нет — показываем его текст листом.
      sheet.open({
        title: 'Поделиться номером телефона?', text: 'labeled получит номер, привязанный к вашему Telegram. Его можно изменить в форме.',
        btns: [{ label: 'Разрешить', kind: 'primary', on: () => setF((x) => ({ ...x, phone: '+7 921 000-00-00', name: x.name || appStore.get().me.tgName })) }, { label: 'Не разрешать', kind: 'ghost' }],
      });
      return;
    }
    const c = await requestPhone();
    if (c) setF((x) => ({ ...x, phone: c.phone, name: x.name || c.name }));
  };
  const save = () => { setBusy(true); profileApi.saveAddress(f).then((a) => { actions.saveAddress(a); nav.back(); }, () => setBusy(false)); };

  return (
    <Screen header={<Header title={isNew ? 'Новый адрес' : 'Изменить адрес'} />} bar={{ btns: [{ label: 'Сохранить адрес', kind: 'primary', dis: !ok || busy, on: save }] }}>
      <Input label="Имя получателя *" value={f.name} ph="Фамилия и имя" onChange={(v) => set({ name: v })} />
      <Input label="Телефон *" value={f.phone} ph="+7" mode="tel" err={f.phone && phoneDigits < 10 ? 'Телефон выглядит неполным' : undefined} onChange={(v) => set({ phone: v })} />
      <Btns items={[{ label: 'Подставить номер из Telegram', kind: 'limeSoft', on: fillPhone }]} />
      <Input label="Город *" value={f.city} ph="Город" onChange={(v) => set({ city: v })} />
      <Input label="Адрес получения *" value={f.line} ph="Улица, дом, квартира или пункт выдачи" onChange={(v) => set({ line: v })} />
    </Screen>
  );
}
