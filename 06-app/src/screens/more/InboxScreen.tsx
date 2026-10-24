import { Plus, Truck, X } from 'lucide-react';
import { eventsApi } from '../../api/content';
import { useApi } from '../../lib/useApi';
import type { AppEvent, EventKind } from '../../mocks/content';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { Btn, Btns } from '../../ui/Btn';
import { H, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

const TONE: Record<EventKind, [string, string]> = {
  act: ['var(--lb-ink)', 'var(--lime)'], pay: ['var(--lb-warn-soft)', 'var(--lb-warn-ink)'], ship: ['var(--lb-limedeep-a40)', 'var(--lb-ink)'],
  err: ['var(--lb-danger-soft)', 'var(--lb-danger)'], pts: ['var(--lb-violet-soft)', 'var(--lb-violet)'],
};
const ICON: Record<EventKind, React.ReactNode> = {
  act: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>,
  pay: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12.5V3.5h3a2.5 2.5 0 0 1 0 5H4.5M4.5 10.6h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  ship: <Truck size={16} strokeWidth={1.8} />, err: <X size={16} strokeWidth={2} />, pts: <Plus size={16} strokeWidth={2} />,
};

/** N — события: лента изменений заявок, оплат и доставки. Каждое событие ведёт к своему заказу. */
export function InboxScreen() {
  const nav = useNav();
  const read = useApp((s) => s.eventsRead);
  const q = useApi(() => eventsApi.list(), [], 'events', { live: true });
  const markAll = () => eventsApi.markAllRead().then(actions.markEventsRead);
  const feed = (rows: AppEvent[]) => (
    <div style={{ borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const unread = r.today && !read;
        return (
          <div key={r.id} style={{ padding: 12, borderTop: i ? '1px solid var(--lb-ink-a08)' : 'none', background: unread ? 'var(--lb-n-50)' : 'var(--lb-white)' }}>
            <button type="button" onClick={() => nav.go(r.to)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', padding: 0, border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)' }}>
              <div aria-hidden style={{ width: 34, height: 34, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TONE[r.kind][0], color: TONE[r.kind][1] }}>{ICON[r.kind]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, textWrap: 'pretty' }}>{r.title}</div>
                  <div style={{ flex: 'none', fontSize: 11, fontWeight: 600, color: 'var(--lb-ink-2)', whiteSpace: 'nowrap' }}>{r.time}</div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{r.sub}</div>
              </div>
              <div aria-label={unread ? 'Новое' : undefined} style={{ width: 8, height: 8, flex: 'none', marginTop: 4, borderRadius: 999, background: 'var(--lb-danger)', visibility: unread ? 'visible' : 'hidden' }} />
            </button>
            {r.act && <Btn kind={r.kind === 'act' ? 'primary' : 'ghost'} small onClick={() => nav.go(r.to)} style={{ marginTop: 10, marginLeft: 45, width: 'calc(100% - 45px)' }}>{r.act}</Btn>}
          </div>
        );
      })}
    </div>
  );
  return (
    <Screen header={<Header title="События" btn={read ? undefined : { label: 'Прочитать все', on: markAll }} />}>
      {!q.data ? <Skel n={2} /> : (
        <>
          <H text="Сегодня" />{feed(q.data.filter((e) => e.today))}
          <H text="Раньше" />{feed(q.data.filter((e) => !e.today))}
        </>
      )}
      <Btns items={[{ label: 'Настроить каналы уведомлений', kind: 'limeSoft', on: () => nav.go('/notif') }]} />
    </Screen>
  );
}
