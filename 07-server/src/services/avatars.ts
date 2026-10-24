import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { files, users } from '../db/schema';
import { unlinkUpload } from '../files';
import type { Ctx } from './core';

// Аватарки людей (покупателей и сотрудников) хранятся на нашем сервере. Ссылка t.me из initData в WebView
// из России открывается не всегда и есть не у всех: Telegram отдаёт её не каждому. Сервер раз в сутки при
// входе берёт фото через бота (getUserProfilePhotos → getFile → файл через тот же TELEGRAM_API) и сохраняет
// публичным файлом /files/<id>. Не вышло — остаётся ссылка из initData, без неё приложение рисует значок.

const DAY = 86400_000;
type Fetch = typeof fetch;

/** Адрес аватарки для ответа: свой файл, иначе ссылка Telegram из initData. Приложение дополняет относительный адрес. */
export const avatarOf = (u: { avatarFileId: string | null; photoUrl: string | null }) => (u.avatarFileId ? '/files/' + u.avatarFileId : u.photoUrl ?? '');

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

/** Фото профиля через бота. null — фото нет или скрыто; undefined — Telegram недоступен, попробуем позже. */
async function viaBot(ctx: Ctx, tgId: number, f: Fetch): Promise<Buffer | null | undefined> {
  const { telegramApi: api, botToken: token } = ctx.config;
  const call = async (method: string, body: object) => {
    const r = await f(`${api}/bot${token}/${method}`, { method: 'POST', signal: AbortSignal.timeout(8000), headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json()) as { ok: boolean; result?: any };
  };
  try {
    const list = await call('getUserProfilePhotos', { user_id: tgId, limit: 1 });
    if (!list.ok) return undefined;
    const sizes = (list.result?.photos?.[0] ?? []) as { file_id: string; width: number }[];
    if (!sizes.length) return null;
    // Хватает 160–320 px: аватарка в приложении — до 60 px на экране с тройной плотностью.
    const pick = sizes.find((s) => s.width >= 160) ?? sizes[sizes.length - 1];
    const file = await call('getFile', { file_id: pick.file_id });
    const path = file.result?.file_path as string | undefined;
    if (!file.ok || !path) return undefined;
    const r = await f(`${api}/file/bot${token}/${path}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    return isJpeg(buf) ? buf : undefined;
  } catch {
    return undefined;
  }
}

/** Ссылка из initData — если сервер до неё дотягивается. Только JPEG: SVG-заглушки Telegram не храним. */
async function viaLink(url: string | null, f: Fetch): Promise<Buffer | undefined> {
  if (!url || !/^https:\/\//.test(url)) return undefined;
  try {
    const r = await f(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    return isJpeg(buf) && buf.length < 2 * 1024 * 1024 ? buf : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Обновить аватарку, если её не проверяли сутки. Ошибки только в журнал: вход и запросы не ждут и не падают.
 * Без бота (разработка, тесты) — ничего не делает; f — подмена fetch в тестах.
 */
export async function refreshAvatar(ctx: Ctx, userId: number, opts: { force?: boolean; fetch?: Fetch } = {}) {
  if (!ctx.config.botMessages && !opts.fetch) return;
  const f = opts.fetch ?? fetch;
  const [u] = await ctx.db.select().from(users).where(eq(users.id, userId));
  if (!u || u.deletedAt || u.tgId <= 0) return;
  if (!opts.force && u.avatarCheckedAt && Date.now() - u.avatarCheckedAt.getTime() < DAY) return;
  const got = await viaBot(ctx, u.tgId, f);
  const buf = got ?? (await viaLink(u.photoUrl, f));
  // Telegram не ответил, а ссылки нет — повторим при следующем входе, прежнюю аватарку не трогаем.
  if (buf === undefined && got === undefined) return;
  const old = u.avatarFileId;
  let id: string | null = null;
  if (buf) {
    id = randomUUID();
    await mkdir(ctx.config.uploadDir, { recursive: true });
    await writeFile(join(ctx.config.uploadDir, id), buf);
    await ctx.db.insert(files).values({ id, ownerUserId: u.id, kind: 'avatar', name: 'avatar.jpg', mime: 'image/jpeg', size: buf.length, path: id, public: true });
  }
  await ctx.db.update(users).set({ avatarFileId: id, avatarCheckedAt: new Date() }).where(eq(users.id, u.id));
  if (old && old !== id) {
    await ctx.db.delete(files).where(eq(files.id, old));
    await unlinkUpload(ctx.config, old).catch(() => {});
  }
}

/** После запуска: аватарки всех, кого ещё не проверяли или проверяли давно, — по одному, без спешки. */
export async function backfillAvatars(ctx: Ctx, opts: { fetch?: Fetch; pauseMs?: number } = {}) {
  if (!ctx.config.botMessages && !opts.fetch) return;
  const due = await ctx.db.select({ id: users.id }).from(users)
    .where(and(isNull(users.deletedAt), or(isNull(users.avatarCheckedAt), lt(users.avatarCheckedAt, new Date(Date.now() - DAY)))));
  for (const { id } of due) {
    await refreshAvatar(ctx, id, opts).catch((err) => ctx.log.warn({ err }, 'аватарка'));
    if (opts.pauseMs !== 0) await new Promise((r) => setTimeout(r, opts.pauseMs ?? 300));
  }
}
