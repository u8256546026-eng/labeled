import { useNav } from '../nav/useNav';
import { useToast } from '../ui/Toast';
import { useAdmin } from './api';
import { ROLES } from './model';
import { Seg } from './Seg';

/** adm01 — блок «Режим работы» в профиле. Виден только сотрудникам: сервер нашёл их Telegram в «Сотрудниках». */
export function StaffModeCard() {
  const nav = useNav();
  const toast = useToast();
  const me = useAdmin((s) => s.me);
  if (!me) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 20, background: 'var(--lb-ink-2)', color: 'var(--lb-white)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lime)', color: 'var(--lb-ink)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Режим работы</div>
          <div style={{ fontSize: 12, color: 'var(--lb-white-a72)' }}>Вы сотрудник labeled · {ROLES[me.role].label}</div>
        </div>
      </div>
      <Seg aria="Режим работы" dark items={[['buyer', 'Покупатель'], ['admin', 'Админ']]} cur="buyer" set={(k) => { if (k === 'admin') { nav.root('/admin'); toast('Режим администратора'); } }} />
      <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-white-a72)', textWrap: 'pretty' }}>Переключатель видят только сотрудники. Покупатели его не видят.</div>
    </div>
  );
}
