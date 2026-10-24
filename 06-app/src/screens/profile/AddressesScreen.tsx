import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { profileApi } from '../../api/profile';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { haptic } from '../../telegram/tma';
import { Empty } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';

const PICKERS = ['/checkout', '/link', '/delivery'];

/** AQ — адреса: основной подставляется при оформлении; из оформления экран открывается для выбора. */
export function AddressesScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const addrs = useApp((s) => s.addrs);
  const sel = useApp((s) => s.addrSel);
  const picking = PICKERS.includes(nav.fromPath ?? '');

  const del = (id: string, city: string) => sheet.open({
    title: 'Удалить адрес?', text: `Адрес «${city}» будет удалён из сохранённых.`,
    btns: [{ label: 'Удалить', kind: 'danger', on: () => profileApi.deleteAddress(id).then(() => actions.deleteAddress(id)) }, { label: 'Отмена', kind: 'ghost' }],
  });

  if (!addrs.length) {
    return <Screen header={<Header title="Адреса" />}><Empty minH={600} title="Адресов пока нет" text="Добавьте адрес получения — он подставится при оформлении обоих типов заказа." btns={[{ label: 'Добавить адрес', kind: 'primary', on: () => nav.go('/addresses/new') }]} /></Screen>;
  }
  return (
    <Screen header={<Header title="Адреса" />} bar={picking ? { btns: [{ label: 'Выбрать и вернуться', kind: 'primary', on: nav.back }] } : undefined}>
      <div role="radiogroup" aria-label="Адреса" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {addrs.map((a, i) => {
          const on = sel === i;
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'stretch', borderRadius: 16, background: 'var(--lb-white)', boxShadow: on ? 'inset 0 0 0 2px var(--lime), 0 8px 20px -16px var(--lb-black-a40)' : 'inset 0 0 0 1px var(--lb-ink-a08)', transition: 'box-shadow 180ms ease' }}>
              <button type="button" role="radio" aria-checked={on} onClick={() => { haptic.select(); actions.setAddress(i); }}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0 14px 14px', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)' }}>
                <div aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--lime)' : 'var(--lb-n-150)', transition: 'background 180ms ease' }}><MapPin size={20} strokeWidth={2} /></div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lb-ink-2)' }}>{a.city}</span>
                    {on && <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, background: 'var(--lime)', fontSize: 10.5, fontWeight: 700 }}>Основной</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, textWrap: 'pretty' }}>{a.line}</div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>{a.name} · {a.phone}</div>
                </div>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 6px 6px 0' }}>
                <button type="button" aria-label={'Изменить адрес: ' + a.city} onClick={() => nav.go('/addresses/' + a.id)} className="pressable-xs" style={iconBtn('var(--lb-ink)')}><Pencil size={18} strokeWidth={2} aria-hidden /></button>
                <button type="button" aria-label={'Удалить адрес: ' + a.city} onClick={() => del(a.id, a.city)} className="pressable-xs" style={iconBtn('var(--lb-danger)')}><Trash2 size={18} strokeWidth={2} aria-hidden /></button>
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => nav.go('/addresses/new')} className="pressable"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, border: '1.5px dashed var(--lb-ink-a28)', borderRadius: 16, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={18} strokeWidth={2.4} aria-hidden /><span>Добавить адрес</span>
        </button>
        <div style={{ padding: '4px 4px 0', fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>Основной адрес подставляется при оформлении. Нажмите на адрес, чтобы сделать его основным.</div>
      </div>
    </Screen>
  );
}

const iconBtn = (color: string) => ({ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 12, background: 'none', color, cursor: 'pointer' }) as const;
