import { useState } from 'react';
import { plural, rub } from '../../lib/format';
import { SUMMARY } from '../../mocks/admin';
import { useNav } from '../../nav/useNav';
import { adminLoad, useAdmin, useCan, visibleTasks } from '../api';
import { useLoad } from '../hooks';
import { live } from '../../api/client';
import { ROLES, TASK_GROUPS, TASK_KIND, type Task, type TaskGroup } from '../model';
import { AChips, AdminLoading, AEmpty, AH, AdminScreen, IconBox, pillStyle, Stats } from '../ui';

/** adm02 · adm03 · adm26 — очередь задач: всё, что ждёт действия, по правам роли. */
export function AdminTasksScreen() {
  const nav = useNav();
  const can = useCan();
  const me = useAdmin((s) => s.me);
  const state = useAdmin((s) => s);
  const [qf, setQf] = useState<TaskGroup>('all');
  const L = useLoad(() => Promise.all([adminLoad.tasks(), can('summary') ? adminLoad.summary('day') : Promise.resolve()]), [], { live: true });
  const sum = useAdmin((s) => s.summary.day);
  const all = visibleTasks(state);
  const cnt = (g: TaskGroup) => (g === 'all' ? all.length : all.filter((t) => TASK_KIND[t.kind].group === g).length);
  const list = all.filter((t) => qf === 'all' || TASK_KIND[t.kind].group === qf);
  const day = live() && sum ? sum.v : SUMMARY.day.v;
  const newReq = live() && sum ? sum.newReq : SUMMARY.day.newReq ?? 0;
  if (!L.ready) return <AdminLoading title="Задачи" error={L.error} retry={L.reload} />;

  return (
    <AdminScreen title="Задачи" sub={`${me ? ROLES[me.role].label : ''} · ${all.length} ${plural(all.length, 'задача ждёт', 'задачи ждут', 'задач ждут')} действия`}>
      {can('summary') && (
        <>
          <AH title="Сегодня" link="Сводка" on={() => nav.go('/admin/summary')} />
          <Stats items={[['Ждут действия', all.length, true], ['Оплачено сегодня', rub(day[1])], ['Новые заказы', day[0]], ['Новые заявки', newReq]]} />
        </>
      )}
      <AChips label="Тип задачи" items={TASK_GROUPS.filter(([g]) => g === 'all' || cnt(g) > 0 || qf === g).map(([g, label]) => ({ label, n: cnt(g), on_: qf === g, act: () => setQf(g) }))} />
      {list.length === 0
        ? <AEmpty icon="check" title="Очередь пуста" text="Новые оплаты, заявки и обращения появятся здесь. Бот labeled пришлёт уведомление в Telegram." />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{list.map((t) => <TaskCard key={t.id} t={t} onOpen={() => nav.go(t.to)} />)}</div>}
    </AdminScreen>
  );
}

function TaskCard({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const k = TASK_KIND[t.kind];
  return (
    <button type="button" onClick={onOpen} className="pressable"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', padding: 14, border: 0, borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)', font: 'inherit' }}>
      <IconBox name={k.icon} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={pillStyle(k.tone)}>{k.label}</span>
          {t.urgent && <span style={pillStyle('err')}>Давно ждёт</span>}
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: 'var(--lb-ink-2)', whiteSpace: 'nowrap' }}>{t.age}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em', textWrap: 'pretty' }}>{t.title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>{t.sub}</div>
        {t.amount != null && <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{rub(t.amount)}</div>}
      </div>
    </button>
  );
}
