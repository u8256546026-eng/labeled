import { useState } from 'react';
import { profileApi } from '../../api/profile';
import { useNav } from '../../nav/useNav';
import { actions, appStore, useApp } from '../../store/app';
import { Cards } from '../../ui/blocks';
import { Input } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

/** AL — имя и фото. Фото берётся из Telegram и в приложении не меняется; имя можно изменить. */
export function EditProfileScreen() {
  const nav = useNav();
  const me = useApp((s) => s.me);
  const [name, setName] = useState(() => appStore.get().name);
  const [busy, setBusy] = useState(false);
  const save = () => { setBusy(true); profileApi.updateName(name).then((n) => { actions.setName(n); nav.back(); }, () => setBusy(false)); };
  return (
    <Screen header={<Header title="Имя и фото" />} bar={{ btns: [{ label: 'Сохранить', kind: 'primary', dis: !name.trim() || busy, on: save }] }}>
      <Cards rows={[{ title: 'Фото профиля', sub: 'Берётся из Telegram и обновляется само', img: me.photo }]} />
      <Input label="Имя" value={name} onChange={setName} max={40} />
    </Screen>
  );
}
