// Запуск и вход в режиме сервера: техработы и версия (AH), справочники, сессия (BA, P) и загрузка состояния
// покупателя. В режиме моков не используется.
import { adminApi } from '../admin/api';
import type { Perm, Role } from '../admin/model';
import type { Address, Payment } from '../domain/order';
import type { LinkDraft, LinkForm, Rates } from '../domain/linkOrder';
import { BANNERS, CATEGORIES } from '../mocks/catalog';
import { RATES } from '../mocks/link';
import { REQUISITES } from '../mocks/orders';
import { appStore, type NotifPrefs } from '../store/app';
import { startChanges } from './changes';
import { ApiError, fileUrl, http } from './client';

export type ServerSession = {
  user: { id: number; tgId: number; name: string; username?: string; photo?: string; points: number; email: string; emailState: 'none' | 'wait' | 'ok' | 'err'; notif: Omit<NotifPrefs, never>; botAllowed: boolean; firstDiscount: boolean };
  staff: { role: Role; perms: Perm[] } | null;
  system: { maintenanceUntil: string | null; minVersion: string };
  firstLogin: boolean;
};

export type GateStatus = { ok: true } | { maintenance: { until: string } } | { update: true };

/** Справочники, общие для всех: курс и ступени, реквизиты, видимые категории и баннеры. Пишутся в те же объекты, что читают экраны. */
async function loadReference() {
  const [rates, req, show] = await Promise.all([
    http<Rates>('GET', '/api/rates'),
    http<typeof REQUISITES>('GET', '/api/requisites'),
    http<{ categories: typeof CATEGORIES; banners: typeof BANNERS }>('GET', '/api/showcase'),
  ]);
  Object.assign(RATES, rates);
  Object.assign(REQUISITES, req);
  BANNERS.splice(0, BANNERS.length, ...show.banners);
  if (show.categories.length) CATEGORIES.splice(0, CATEGORIES.length, ...show.categories.map((c) => ({ ...c, img: c.img || CATEGORIES.find((x) => x.id === c.id)?.img || '' })));
}

/** Состояние покупателя после входа: профиль, адреса, избранное, платежи, черновики, события. */
export async function hydrate(s: ServerSession) {
  const u = s.user;
  const cur = appStore.get();
  appStore.set({
    auth: true, consent: true, name: u.name, pts: u.points, emailAddr: u.email,
    email: u.emailState, notif: { ...u.notif, bot: u.notif.bot && u.botAllowed },
    me: { ...cur.me, id: u.tgId, username: u.username ?? cur.me.username, photo: fileUrl(u.photo) ?? cur.me.photo },
  });
  adminApi.setSession(s.staff ? { id: 'me', name: u.name, handle: u.username ? '@' + u.username : '', role: s.staff.role, since: '', perms: s.staff.perms, me: true } : null);
  const [addrs, favs, pays, drafts, events] = await Promise.all([
    http<(Address & { main: boolean })[]>('GET', '/api/addresses'),
    http<{ id: string }[]>('GET', '/api/favorites'),
    http<Payment[]>('GET', '/api/payments'),
    http<{ id: string; date: string; form: LinkForm }[]>('GET', '/api/link/drafts'),
    http<{ unread: number }>('GET', '/api/events'),
  ]);
  appStore.set({
    addrs: addrs.map(({ main: _m, ...a }) => a), addrSel: Math.max(0, addrs.findIndex((a) => a.main)),
    favs: favs.map((f) => f.id), payments: Object.fromEntries(pays.map((p) => [p.id, p])),
    linkDrafts: drafts.map((d): LinkDraft => ({ id: d.id, date: d.date, form: { ...d.form, draftId: d.id, dirty: false } })),
    eventsRead: events.unread === 0,
  });
  startChanges();
}

const newer = (min: string, cur: number) => (parseInt(min, 10) || 0) > cur;

/**
 * Запуск (BA): техработы и минимальная версия, справочники, вход. Нового покупателя без согласия
 * сервер не создаёт — тогда приложение открывается гостю (E), согласие спросит экран P.
 */
export async function startLive(appVersion: number): Promise<GateStatus> {
  // Состояние сервиса, справочники и вход — одновременно: на мобильной сети каждый лишний круг до сервера заметен.
  const sysP = http<ServerSession['system']>('GET', '/api/system');
  const refP = loadReference();
  const sesP = http<ServerSession>('POST', '/api/session', { consent: false });
  // При техработах или старой версии остальные ответы не ждём — их ошибки не должны всплыть необработанными.
  refP.catch(() => {}); sesP.catch(() => {});
  const sys = await sysP;
  if (sys.maintenanceUntil) return { maintenance: { until: sys.maintenanceUntil } };
  if (newer(sys.minVersion, appVersion)) return { update: true };
  await refP;
  try {
    await hydrate(await sesP);
  } catch (e) {
    if (e instanceof ApiError && e.message === 'consent_required') appStore.set({ auth: false, consent: false });
    else throw e;
  }
  return { ok: true };
}

/** Вход с согласием (P). */
export async function loginLive(consent: boolean) {
  await hydrate(await http<ServerSession>('POST', '/api/session', { consent }));
}

/**
 * Повторно загрузить платежи — после оформления, загрузки чека, «Перевёл» и по сигналу живого обновления.
 * Отметка «из оформления» есть только в приложении — переносим её, иначе после «Перевёл» не откроется K.
 */
export async function reloadPayments() {
  const pays = await http<Payment[]>('GET', '/api/payments');
  const cur = appStore.get().payments;
  appStore.set({ payments: Object.fromEntries(pays.map((p) => [p.id, cur[p.id]?.fromCheckout ? { ...p, fromCheckout: true } : p])) });
}

export async function reloadMe() {
  const s = await http<ServerSession>('GET', '/api/me');
  // Подтверждение почты по ссылке включает на сервере канал «Почта» — переносим только его, остальные переключатели свои.
  appStore.set((cur) => ({ pts: s.user.points, email: s.user.emailState, emailAddr: s.user.email, notif: { ...cur.notif, mail: s.user.notif.mail } }));
}
