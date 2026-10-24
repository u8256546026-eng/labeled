import { Fragment, useState, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { copyText } from '../../lib/clipboard';
import { plural } from '../../lib/format';
import { routeMeta } from '../../nav/routes';
import { useNav } from '../../nav/useNav';
import { appLink } from '../../telegram/tma';
import { Btn } from '../../ui/Btn';
import { useSheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { adminApi, adminLoad, useAdmin, useCan, type Invite } from '../api';
import { useAction, useLoad } from '../hooks';
import { LOG_ICON, LOG_KEEP_MONTHS, LOG_TYPES, OWNER_ONLY, PERMS, ROLES, rolePerms, type LogEntry, type LogType, type Perm, type Role } from '../model';
import { AChips, AdminLoading, AEmpty, AH, ANote, AdminScreen, BtnRow, Field, RadioList, Rows, TogList } from '../ui';

const STAFF_ROLES: Role[] = ['manager', 'stock', 'content'];

/** adm22 · adm24 — сотрудники с доступом и приглашение по одноразовой ссылке. */
export function AdminStaffScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const staff = useAdmin((s) => s.staff);
  const L = useLoad(() => adminLoad.staff(), []);
  if (!L.ready) return <AdminLoading title="Сотрудники" error={L.error} retry={L.reload} />;
  const scope = (p: Perm[] | null, r: Role) => (p ? 'права изменены' : ROLES[r].sub);
  return (
    <AdminScreen title="Сотрудники" sub={`${staff.length} ${plural(staff.length, 'человек', 'человека', 'человек')} с доступом`}
      btn={{ label: 'Пригласить', on: () => sheet.open({ title: 'Пригласить сотрудника', text: 'Ссылка одноразовая и действует 24 часа.', body: <InviteForm />, btns: [] }) }}>
      <Rows items={staff.map((x) => ({ ava: { photo: x.photo }, title: x.name + (x.me ? ' · вы' : ''), sub: `${x.handle} · ${scope(x.perms, x.role)}`, pill: ROLES[x.role].label, tone: ROLES[x.role].tone, chev: !x.me, on: x.me ? undefined : () => nav.go('/admin/member/' + x.id) }))} />
      <ANote tone="n" text="Сотрудник входит через свой Telegram. Переключатель «Покупатель / Админ» появится у него в профиле после приглашения." />
    </AdminScreen>
  );
}

function InviteForm() {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const [role, setRole] = useState<Role>('manager');
  const [inv, setInv] = useState<Invite | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Роль" items={STAFF_ROLES.map((r) => ({ label: ROLES[r].label, sub: ROLES[r].sub, on_: role === r, act: () => { setRole(r); setInv(null); } }))} />
      {inv ? (
        <>
          <Field label={'Ссылка-приглашение · ' + ROLES[inv.role].label} value={inv.link.replace(/^https:\/\//, '')} readOnly />
          <Btn kind="limeSoft" onClick={() => copyText(inv.link).then((ok) => (ok ? toast('Скопировано') : toast('Не получилось скопировать', 'error')))}>Скопировать ссылку</Btn>
          <Btn kind="ghost" onClick={sheet.close}>Готово</Btn>
        </>
      ) : (
        <>
          <Btn kind="primary" dis={busy} onClick={() => run(() => adminApi.createInvite(role, appLink), setInv)}>Создать приглашение</Btn>
          <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
        </>
      )}
    </div>
  );
}

/** adm23 — роль задаёт права по умолчанию; отдельные права можно добавить или убрать. Курс, реквизиты и сотрудники — только владелец. */
export function AdminMemberScreen() {
  const { id = '' } = useParams();
  const L = useLoad(() => adminLoad.staff(), []);
  if (!L.ready) return <AdminLoading title="Сотрудник" error={L.error} retry={L.reload} />;
  return <MemberForm key={id} id={id} />;
}

function MemberForm({ id }: { id: string }) {
  const nav = useNav();
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const m = useAdmin((s) => s.staff.find((x) => x.id === id));
  const [role, setRole] = useState<Role>(m?.role ?? 'manager');
  const [perms, setPerms] = useState<Perm[] | null>(m?.perms ?? null);
  if (!m || m.role === 'owner') return <AdminScreen title="Сотрудник"><AEmpty icon="user" title="Сотрудник не найден" text="Возможно, доступ уже убрали." /></AdminScreen>;
  const cur = perms ?? rolePerms(role);
  const changed = role !== m.role || JSON.stringify(perms) !== JSON.stringify(m.perms);
  const toggle = (p: Perm) => { const n = cur.includes(p) ? cur.filter((x) => x !== p) : cur.concat([p]); setPerms(JSON.stringify([...n].sort()) === JSON.stringify([...rolePerms(role)].sort()) ? null : n); };
  const remove = () => sheet.open({
    title: 'Убрать доступ?', text: `${m.name} больше не увидит режим администратора. Вернуть доступ можно новым приглашением.`,
    btns: [{ label: 'Убрать доступ', kind: 'danger', on: () => run(() => adminApi.removeStaff(m.id), () => { toast('Доступ убран'); nav.back(); }) }, { label: 'Отмена', kind: 'ghost' }],
  });
  return (
    <AdminScreen title={m.name} sub={`${m.handle} · ${m.since}`}
      bar={[{ label: 'Сохранить', dis: !changed || busy, on: () => run(() => adminApi.saveStaff(m.id, role, perms), 'Права сохранены') }]}>
      <Rows items={[{ ava: { photo: m.photo }, title: m.name, sub: m.handle !== '—' ? m.handle + ' · Telegram' : 'Telegram без @имени', copy: m.handle !== '—' ? m.handle : undefined }]} />
      <AH title="Роль" />
      <RadioList aria="Роль" items={STAFF_ROLES.map((r) => ({ label: ROLES[r].label, sub: ROLES[r].sub, on_: role === r, act: () => { setRole(r); setPerms(null); } }))} />
      <AH title="Права" sub={perms ? 'Изменены вручную' : 'По умолчанию для роли'} />
      <TogList items={PERMS.filter(([p]) => !OWNER_ONLY.includes(p)).map(([p, label]) => ({ label, on_: cur.includes(p), act: () => toggle(p) }))} />
      <ANote tone="n" text="Курс, реквизиты и сотрудники доступны только владельцу." />
      <BtnRow items={[{ label: 'Убрать доступ', kind: 'danger', on: remove }]} />
    </AdminScreen>
  );
}

/** adm27 — раздел без прав: объясняем, у кого просить доступ. Покупателю режим администратора недоступен вовсе. */
export function AdminGuard({ perm, children }: { perm: Perm | null; children: ReactNode }) {
  const nav = useNav();
  const loc = useLocation();
  const me = useAdmin((s) => s.me);
  const can = useCan();
  if (me && (!perm || can(perm))) return <>{children}</>;
  const title = routeMeta(loc.pathname).name;
  return (
    <AdminScreen title={me ? title : 'Режим администратора'} bar={[{ label: nav.depth > 0 ? 'Назад' : me ? 'К задачам' : 'В профиль', kind: 'ghost', on: () => (nav.depth > 0 ? nav.back() : nav.root(me ? '/admin' : '/profile')) }]}>
      <AEmpty icon="lock" title="Нет доступа" text={me ? 'Раздел доступен владельцу. Попросите его добавить право в «Сотрудниках», и раздел появится у вас в «Ещё».' : 'Режим администратора — для сотрудников labeled. Владелец добавляет их в «Сотрудниках».'} />
    </AdminScreen>
  );
}

/** «Сегодня», «Вчера» или дата — заголовок группы журнала. */
function dayOf(at: string) {
  const d = new Date(at), t = new Date();
  const k = (x: Date) => x.toDateString();
  if (k(d) === k(t)) return 'Сегодня';
  t.setDate(t.getDate() - 1);
  if (k(d) === k(t)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}
const timeOf = (at: string) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/**
 * adm33 — журнал действий: только владелец. Фильтры по сотруднику и типу, группы по дням; строка открывает
 * заказ или раздел. Записи неизменяемы и хранятся 12 месяцев — изменить или удалить их нельзя ни здесь, ни на сервере.
 */
export function AdminJournalScreen() {
  const nav = useNav();
  const me = useAdmin((s) => s.me);
  const staff = useAdmin((s) => s.staff);
  const log = useAdmin((s) => s.journal);
  const [who, setWho] = useState('all');
  const [type, setType] = useState<LogType | 'all'>('all');
  useLoad(() => adminLoad.staff().catch(() => 0), []);
  const L = useLoad(() => adminLoad.journal(who, type), [who, type]);
  const title = 'Журнал действий';
  if (me?.role !== 'owner') return <AdminScreen title={title}><AEmpty icon="lock" title="Только владелец" text="Журнал действий сотрудников видит владелец магазина." /></AdminScreen>;
  if (!L.ready) return <AdminLoading title={title} error={L.error} retry={L.reload} />;
  const list = log.filter((x) => (who === 'all' || x.who === who) && (type === 'all' || x.type === type));
  const days = [...new Set(list.map((x) => dayOf(x.at)))];
  const row = (x: LogEntry) => ({
    icon: LOG_ICON[x.type], title: x.text, sub: `${x.whoName.split(' ')[0]} · ${ROLES[x.whoRole].label} · ${timeOf(x.at)}`, subAva: { photo: x.whoPhoto, name: x.whoName }, pill: x.obj, tone: 'n' as const,
    on: x.to ? () => nav.go(x.to!) : undefined,
  });
  return (
    <AdminScreen title={title} sub={`Все действия сотрудников, хранится ${LOG_KEEP_MONTHS} месяцев`}>
      <AChips label="Сотрудник" items={[{ label: 'Все', on_: who === 'all', act: () => setWho('all') }, ...staff.map((x) => ({ label: x.name.split(' ')[0], on_: who === x.id, act: () => setWho(x.id) }))]} />
      <AChips label="Тип действия" items={LOG_TYPES.map(([k, label]) => ({ label, on_: type === k, act: () => setType(k) }))} />
      {list.length === 0
        ? <AEmpty icon="receipt" title="Действий нет" text="Измените сотрудника или тип действия." />
        : days.map((d) => (
          <Fragment key={d}>
            <AH title={d} />
            <Rows items={list.filter((x) => dayOf(x.at) === d).map(row)} />
          </Fragment>
        ))}
    </AdminScreen>
  );
}


