import { parse, validate } from '@telegram-apps/init-data-node';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Perm, Role } from '../../06-app/src/admin/model';
import { rolePerms } from '../../06-app/src/admin/model';
import type { Config } from './config';
import type { Db } from './db/client';
import { staff, users } from './db/schema';
import { forbidden, HttpError } from './http';

/** Пользователь Telegram из initData (подпись проверена) или из x-dev-user в разработке. */
export type TgUser = { id: number; name: string; username?: string; photo?: string; startParam?: string };
export type UserRow = typeof users.$inferSelect;
export type StaffRow = typeof staff.$inferSelect & { perms: Perm[] };

declare module 'fastify' {
  interface FastifyRequest {
    tg: TgUser | null;
    user: UserRow | null;
    staffRow: StaffRow | null;
  }
}

/**
 * Заголовок Authorization: tma <initData>. Подпись проверяется токеном бота, срок — INIT_DATA_TTL.
 * В разработке (DEV_AUTH) можно передать x-dev-user: <tgId>[;Имя] без Telegram.
 */
export function readTelegram(req: FastifyRequest, config: Config): TgUser | null {
  const h = req.headers.authorization;
  if (h?.startsWith('tma ')) {
    const raw = h.slice(4);
    try {
      validate(raw, config.botToken, { expiresIn: config.initDataTtl });
    } catch {
      throw new HttpError(401, 'bad_init_data');
    }
    // parse() отдаёт поля как в initData (snake_case); camelCase — только по флагу. Читаем оба варианта.
    const d = parse(raw) as unknown as Record<string, unknown>;
    const u = d.user as Record<string, unknown> | undefined;
    if (!u || typeof u.id !== 'number') throw new HttpError(401, 'bad_init_data');
    const str = (...k: string[]) => k.map((x) => u[x]).find((v): v is string => typeof v === 'string');
    return {
      id: u.id, name: [str('first_name', 'firstName'), str('last_name', 'lastName')].filter(Boolean).join(' ') || 'Покупатель',
      username: str('username'), photo: str('photo_url', 'photoUrl'), startParam: [d.start_param, d.startParam].find((v): v is string => typeof v === 'string'),
    };
  }
  const dev = req.headers['x-dev-user'];
  if (config.devAuth && typeof dev === 'string' && dev) {
    let raw: string;
    try { raw = decodeURIComponent(dev); } catch { return null; } // битая кодировка — как без заголовка
    const [id, name] = raw.split(';');
    if (!/^\d{1,15}$/.test(id)) return null;
    return { id: Number(id), name: name || 'Покупатель ' + id };
  }
  return null;
}

/** Хук: Telegram-пользователь, строка покупателя и сотрудника (если есть). Ничего не создаёт — это делает вход. */
export function authHook(db: Db, config: Config) {
  return async (req: FastifyRequest) => {
    req.tg = readTelegram(req, config);
    req.user = null;
    req.staffRow = null;
    if (!req.tg) return;
    const [u] = await db.select().from(users).where(and(eq(users.tgId, req.tg.id), isNull(users.deletedAt)));
    if (!u) return;
    req.user = u;
    const [s] = await db.select().from(staff).where(and(eq(staff.userId, u.id), isNull(staff.removedAt)));
    if (s) req.staffRow = { ...s, perms: (s.perms as Perm[] | null) ?? rolePerms(s.role as Role) };
  };
}

export function needUser(req: FastifyRequest): UserRow {
  if (!req.tg) throw new HttpError(401, 'login_required');
  if (!req.user) throw new HttpError(401, 'login_required');
  return req.user;
}

/** Сотрудник с правом perm. Права проверяются на каждом запросе, а не только в интерфейсе. */
export function needStaff(req: FastifyRequest, perm: Perm | null): StaffRow {
  needUser(req);
  const s = req.staffRow;
  if (!s) throw forbidden('not_staff');
  if (perm && !s.perms.includes(perm)) throw forbidden('no_permission');
  return s;
}

export const sendError = (reply: FastifyReply, e: HttpError) => reply.status(e.status).send({ error: e.code, message: e.message });
