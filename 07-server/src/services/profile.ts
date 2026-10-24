import { randomBytes } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { toCatalogItem } from '../../../06-app/src/domain/catalog';
import { rub } from '../../../06-app/src/lib/format';
import type { Perm, Role } from '../../../06-app/src/admin/model';
import { rolePerms } from '../../../06-app/src/admin/model';
import type { TgUser, UserRow } from '../auth';
import { addresses, events, favorites, files, linkDrafts, offers, orders, pointsLedger, products, staff, staffInvites, users } from '../db/schema';
import { unlinkUpload } from '../files';
import { conflict, HttpError, invalid, ruDate, ruTime } from '../http';
import { productView } from './catalog';
import { getSetting, type Ctx } from './core';
import { avatarOf } from './avatars';
import { confirmLetter, EMAIL_LINK_HOURS } from './mail';

/** Состояние почты для приложения (AN): err — ссылка из письма истекла, нужно отправить заново. */
type EmailState = 'none' | 'wait' | 'ok' | 'err';
const LINK_MS = EMAIL_LINK_HOURS * 3600_000;
const linkExpired = (u: UserRow) => !u.emailSentAt || Date.now() - new Date(u.emailSentAt).getTime() > LINK_MS;
const emailStateOf = (u: UserRow): EmailState => (u.emailState === 'wait' && linkExpired(u) ? 'err' : u.emailState);

const DEFAULT_NOTIF = { bot: true, req: true, pay: true, ship: true, pts: false, promo: false, mail: false };

export type Session = {
  user: { id: number; tgId: number; name: string; username?: string; photo?: string; points: number; email: string; emailState: EmailState; notif: typeof DEFAULT_NOTIF; botAllowed: boolean; firstDiscount: boolean };
  staff: { role: Role; perms: Perm[] } | null;
  system: { maintenanceUntil: string | null; minVersion: string };
  firstLogin: boolean;
};

async function sessionOf(ctx: Ctx, u: UserRow, firstLogin: boolean): Promise<Session> {
  const [s] = await ctx.db.select().from(staff).where(and(eq(staff.userId, u.id), isNull(staff.removedAt)));
  return {
    user: { id: u.id, tgId: u.tgId, name: u.name, username: u.username ?? undefined, photo: avatarOf(u) || undefined, points: u.points, email: u.email ?? '', emailState: emailStateOf(u), notif: u.notif, botAllowed: u.botAllowed, firstDiscount: !u.firstDiscountUsed },
    staff: s ? { role: s.role as Role, perms: (s.perms as Perm[] | null) ?? rolePerms(s.role as Role) } : null,
    system: await getSetting(ctx.db, 'system'),
    firstLogin,
  };
}

/**
 * Вход (BA, P). Пользователь — из проверенного initData. Новый покупатель создаётся только с согласием
 * с офертой и политикой; без него — 401 consent_required (экран P). Параметр запуска ref_<tgId> запоминает
 * пригласившего, staff_<код> — принимает приглашение сотрудника.
 */
export async function login(ctx: Ctx, tg: TgUser, consent: boolean): Promise<Session> {
  return ctx.db.transaction(async (tx) => {
    let [u] = await tx.select().from(users).where(and(eq(users.tgId, tg.id), isNull(users.deletedAt)));
    let first = false;
    if (!u) {
      if (!consent) throw new HttpError(401, 'consent_required');
      let referrerId: number | null = null;
      const ref = tg.startParam?.match(/^ref_(\d+)$/)?.[1];
      if (ref && Number(ref) !== tg.id) {
        const [r] = await tx.select().from(users).where(and(eq(users.tgId, Number(ref)), isNull(users.deletedAt)));
        referrerId = r?.id ?? null;
      }
      // Два первых входа одновременно (приложение открыли дважды): второй не падает на уникальном tg_id, а берёт созданного.
      const [made] = await tx.insert(users).values({ tgId: tg.id, username: tg.username ?? null, tgName: tg.name, name: tg.name, photoUrl: tg.photo ?? null, consentAt: new Date(), referrerId, notif: DEFAULT_NOTIF }).onConflictDoNothing({ target: users.tgId }).returning();
      if (made) { u = made; first = true; }
      else [u] = await tx.select().from(users).where(eq(users.tgId, tg.id));
    } else {
      // Имя по умолчанию следует за Telegram, пока покупатель не переименовался сам.
      const name = u.name === u.tgName ? tg.name : u.name;
      [u] = await tx.update(users).set({ tgName: tg.name, name, username: tg.username ?? null, photoUrl: tg.photo ?? u.photoUrl }).where(eq(users.id, u.id)).returning();
    }
    const code = tg.startParam?.match(/^staff_([a-z0-9]+)$/)?.[1];
    const [had] = code ? await tx.select().from(staff).where(eq(staff.userId, u.id)) : [];
    // Действующий сотрудник (в том числе владелец, проверяющий ссылку перед отправкой) приглашение не забирает:
    // иначе вход по ссылке сменил бы ему роль. Роль меняют в «Сотрудниках», ссылка остаётся тому, кому её отправят.
    if (code && !(had && !had.removedAt)) {
      // Приглашение одноразовое: забираем его одним условным UPDATE, чтобы два входа по одной ссылке не прошли оба.
      const [inv] = await tx.update(staffInvites).set({ usedBy: u.id, usedAt: new Date() })
        .where(and(eq(staffInvites.code, code), isNull(staffInvites.usedAt), gt(staffInvites.expiresAt, new Date()))).returning();
      if (inv) {
        if (had) await tx.update(staff).set({ role: inv.role, perms: null, removedAt: null }).where(eq(staff.id, had.id));
        else await tx.insert(staff).values({ userId: u.id, role: inv.role });
      }
    }
    return sessionOf({ ...ctx, db: tx as never }, u, first);
  });
}

export async function session(ctx: Ctx, u: UserRow) { return sessionOf(ctx, u, false); }

export async function updateName(ctx: Ctx, userId: number, name: string) {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n || n.length > 40) throw invalid('Имя — от 1 до 40 символов');
  await ctx.db.update(users).set({ name: n }).where(eq(users.id, userId));
  return n;
}

export async function setNotif(ctx: Ctx, userId: number, p: Partial<typeof DEFAULT_NOTIF> & { botAllowed?: boolean }) {
  const [u] = await ctx.db.select().from(users).where(eq(users.id, userId));
  const notif = { ...u.notif };
  for (const k of Object.keys(DEFAULT_NOTIF) as (keyof typeof DEFAULT_NOTIF)[]) if (typeof p[k] === 'boolean') notif[k] = p[k]!;
  if (notif.mail && u.emailState !== 'ok') notif.mail = false;
  await ctx.db.update(users).set({ notif, ...(typeof p.botAllowed === 'boolean' ? { botAllowed: p.botAllowed } : {}) }).where(eq(users.id, userId));
  return notif;
}

// ───────────── адреса ─────────────

export async function listAddresses(ctx: Ctx, userId: number) {
  return (await ctx.db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(addresses.id)).map((a) => ({ id: String(a.id), name: a.name, phone: a.phone, city: a.city, line: a.line, main: a.isMain }));
}

export async function saveAddress(ctx: Ctx, userId: number, a: { id?: string; name: string; phone: string; city: string; line: string; main?: boolean }) {
  if (![a.name, a.city, a.line].every((x) => x.trim()) || a.phone.replace(/\D/g, '').length < 11) throw invalid('Заполните получателя, телефон, город и адрес');
  return ctx.db.transaction(async (tx) => {
    const id = a.id && /^\d+$/.test(a.id) ? Number(a.id) : null;
    const count = (await tx.select({ n: sql<number>`count(*)::int` }).from(addresses).where(eq(addresses.userId, userId)))[0].n;
    const main = a.main ?? Number(count) === 0;
    if (main) await tx.update(addresses).set({ isMain: false }).where(eq(addresses.userId, userId));
    const vals = { name: a.name.trim(), phone: a.phone.trim(), city: a.city.trim(), line: a.line.trim(), ...(a.main !== undefined || !id ? { isMain: main } : {}) };
    const [row] = id
      ? await tx.update(addresses).set(vals).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).returning()
      : await tx.insert(addresses).values({ userId, ...vals }).returning();
    if (!row) throw new HttpError(404, 'not_found');
    return { id: String(row.id), name: row.name, phone: row.phone, city: row.city, line: row.line, main: row.isMain };
  });
}

export async function deleteAddress(ctx: Ctx, userId: number, id: number) {
  await ctx.db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
}

// ───────────── почта ─────────────

/**
 * Письмо со ссылкой подтверждения (AN). Адрес сохраняется только после того, как ящик магазина принял письмо:
 * иначе приложение показало бы «Письмо отправлено», а письма нет. Без ящика (SMTP_USER/SMTP_PASS) в продукте — 503;
 * при разработке ссылка возвращается в ответе.
 */
export async function sendEmail(ctx: Ctx, userId: number, address: string) {
  const a = address.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) throw invalid('Проверьте адрес почты');
  const token = randomBytes(16).toString('hex');
  const link = `${ctx.config.publicUrl}/api/email/confirm?token=${token}`;
  if (ctx.mail) {
    try {
      await ctx.mail.send(confirmLetter(ctx.config, a, link));
    } catch (err) {
      ctx.log.warn({ code: (err as { responseCode?: number }).responseCode, err: (err as Error).message }, 'письмо подтверждения не отправлено');
      throw new HttpError(502, 'mail_failed', 'Не удалось отправить письмо. Попробуйте позже');
    }
  } else if (ctx.config.production) {
    throw new HttpError(503, 'mail_off', 'Отправка писем пока не подключена');
  }
  await ctx.db.update(users).set({ email: a, emailState: 'wait', emailToken: token, emailSentAt: new Date() }).where(eq(users.id, userId));
  // Разработка без ящика: ссылка в ответе — для сквозной проверки (check-live). В продукте сюда не доходит (503 выше).
  return ctx.mail ? { address: a } : { address: a, devLink: link };
}

/**
 * Переход по ссылке из письма. Подтверждённая почта сразу включает канал «Почта» (AP); прошлые события
 * письмами не догоняем. Повторный переход по той же ссылке — снова «подтверждена».
 */
export async function confirmEmail(ctx: Ctx, token: string): Promise<'ok' | 'expired' | 'bad'> {
  return ctx.db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(and(eq(users.emailToken, token), isNull(users.deletedAt)));
    if (!u) return 'bad';
    if (u.emailState === 'ok') return 'ok';
    if (linkExpired(u)) return 'expired';
    await tx.update(users).set({ emailState: 'ok', notif: { ...u.notif, mail: true } }).where(eq(users.id, u.id));
    await tx.update(events).set({ mailedAt: new Date() }).where(and(eq(events.userId, u.id), isNull(events.mailedAt)));
    return 'ok';
  });
}

export async function unlinkEmail(ctx: Ctx, userId: number) {
  const [u] = await ctx.db.select().from(users).where(eq(users.id, userId));
  await ctx.db.update(users).set({ email: null, emailState: 'none', emailToken: null, emailSentAt: null, notif: { ...u.notif, mail: false } }).where(eq(users.id, userId));
}

// ───────────── избранное, события, баллы ─────────────

export async function setFavorite(ctx: Ctx, userId: number, productId: string, on: boolean) {
  if (on) await ctx.db.insert(favorites).values({ userId, productId }).onConflictDoNothing();
  else await ctx.db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)));
}

/** Избранное (T): доступные вещи и снятые с продажи («продано»). */
export async function listFavorites(ctx: Ctx, userId: number) {
  const favs = await ctx.db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
  if (!favs.length) return [];
  const ids = favs.map((f) => f.productId);
  const [ps, os] = await Promise.all([ctx.db.select().from(products).where(inArray(products.id, ids)), ctx.db.select().from(offers).where(inArray(offers.productId, ids))]);
  return favs.map((f) => {
    const p = ps.find((x) => x.id === f.productId);
    if (!p) return null;
    const v = productView(p, os.filter((o) => o.productId === p.id));
    if (p.visible && v.offers.length) return toCatalogItem(v);
    const any = os.filter((o) => o.productId === p.id);
    return { id: p.id, name: p.name, priceLabel: any.length ? rub(Math.min(...any.map((o) => o.price))) : '', img: p.colors[0]?.photos[0] ?? '', sold: true as const };
  }).filter((x) => !!x);
}

export async function listEvents(ctx: Ctx, userId: number) {
  const list = await ctx.db.select().from(events).where(eq(events.userId, userId)).orderBy(desc(events.at)).limit(100);
  const today = new Date().toDateString();
  return {
    unread: list.filter((e) => !e.readAt).length,
    items: list.map((e) => ({ id: String(e.id), kind: e.kind, title: e.title, sub: e.sub, time: e.at.toDateString() === today ? ruTime(e.at) : ruDate(e.at).replace(/(\S+) (\S{3,4}).*/, '$1 $2'), today: e.at.toDateString() === today, act: e.act ?? undefined, to: e.to, unread: !e.readAt })),
  };
}

export async function readEvents(ctx: Ctx, userId: number) {
  await ctx.db.update(events).set({ readAt: new Date() }).where(and(eq(events.userId, userId), isNull(events.readAt)));
}

/** История баллов (H). */
export async function pointsHistory(ctx: Ctx, userId: number) {
  return (await ctx.db.select().from(pointsLedger).where(eq(pointsLedger.userId, userId)).orderBy(desc(pointsLedger.at))).map((p) => ({ plus: p.delta > 0, title: p.title, date: ruDate(p.at), amount: Math.abs(p.delta) }));
}

/** Кто пригласил (S) — по параметру ref_<tgId>. */
export async function inviter(ctx: Ctx, tgId: number) {
  const [u] = await ctx.db.select({ name: users.name }).from(users).where(and(eq(users.tgId, tgId), isNull(users.deletedAt)));
  // Ответ открыт без входа и по любому tg id — отдаём только имя, без фамилии.
  return u ? { name: u.name.trim().split(/\s+/)[0] || 'Друг' } : null;
}

/**
 * Удаление аккаунта (O): нельзя, пока есть незавершённые заказы и заявки. Личные данные стираются,
 * заказы остаются для отчётности; вход через Telegram потом создаст новый пустой аккаунт.
 */
export async function deleteAccount(ctx: Ctx, userId: number) {
  const avatar = await ctx.db.transaction(async (tx) => {
    const open = await tx.select({ num: orders.num }).from(orders).where(and(eq(orders.userId, userId), inArray(orders.phase, ['review', 'changed', 'invoiced', 'active'])));
    if (open.length) throw conflict('open_orders', open.map((o) => o.num).join(', '));
    // Без владельца никто не управляет сотрудниками и настройками — вернуть его можно только с сервера (admin-cli).
    const [own] = await tx.select({ id: staff.id }).from(staff).where(and(eq(staff.userId, userId), eq(staff.role, 'owner'), isNull(staff.removedAt)));
    if (own) throw conflict('owner', 'Владелец магазина не может удалить аккаунт');
    await tx.delete(addresses).where(eq(addresses.userId, userId));
    await tx.delete(favorites).where(eq(favorites.userId, userId));
    await tx.delete(linkDrafts).where(eq(linkDrafts.userId, userId));
    await tx.update(staff).set({ removedAt: new Date() }).where(eq(staff.userId, userId));
    const [u] = await tx.select({ avatar: users.avatarFileId }).from(users).where(eq(users.id, userId));
    await tx.update(users).set({ tgId: -userId, name: 'Удалённый аккаунт', tgName: '', username: null, photoUrl: null, avatarFileId: null, email: null, emailState: 'none', emailToken: null, emailSentAt: null, points: 0, deletedAt: new Date() }).where(eq(users.id, userId));
    // Фото профиля лежит публичным файлом — удаляем вместе с остальными личными данными.
    if (u?.avatar) await tx.delete(files).where(eq(files.id, u.avatar));
    return u?.avatar ?? null;
  });
  if (avatar) await unlinkUpload(ctx.config, avatar).catch((err: NodeJS.ErrnoException) => { if (err.code !== 'ENOENT') ctx.log.warn({ err }, 'фото профиля не удалено с диска'); });
}
