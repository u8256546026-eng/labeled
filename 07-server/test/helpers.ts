import { sign } from '@telegram-apps/init-data-node';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app';
import { loadConfig, type Config } from '../src/config';
import { openDb } from '../src/db/client';
import { seedDemo } from '../src/db/seed';
import type { Mailer } from '../src/services/mail';

process.env.NODE_ENV = 'test';
export const BOT = '123456:TEST-TOKEN';

/** Сервер на PGlite в памяти с демо-данными. Каждый файл тестов получает свою базу. */
export async function testApp(opts: { mailer?: Mailer | null; config?: Partial<Config> } = {}) {
  const config = { ...loadConfig({ BOT_TOKEN: BOT, UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'lbd-')), PUBLIC_URL: 'http://api.test' } as NodeJS.ProcessEnv), devAuth: true, botMessages: false, cbrUrl: '', ...opts.config };
  const { db, close } = await openDb({});
  await seedDemo(db);
  const app = await buildApp(db, config, { mailer: opts.mailer ?? null });
  return { app, db, config, close: async () => { await app.close(); await close(); } };
}

/** Заголовки разработчика: x-dev-user. tg 1001 — Анна (покупатель), 2001 — Иван (владелец), 2012 — Артём (склад), 2011 — Ксения (менеджер). */
export const as = (tg: number, name?: string) => ({ 'x-dev-user': encodeURIComponent(name ? `${tg};${name}` : String(tg)) });

/** Настоящая подпись initData токеном бота — для проверки входа как в Telegram. */
export function initData(user: { id: number; first_name: string; username?: string }, startParam?: string, authDate = new Date()) {
  return 'tma ' + sign({ user: { ...user, is_bot: false, language_code: 'ru' } as never, ...(startParam ? { start_param: startParam } : {}) } as never, BOT, authDate);
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

/** multipart/form-data с одним файлом. */
export function upload(buf = PNG, name = 'photo.png', mime = 'image/png') {
  const b = '----lbdtest' + Math.random().toString(16).slice(2);
  const body = Buffer.concat([
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`),
    buf, Buffer.from(`\r\n--${b}--\r\n`),
  ]);
  return { payload: body, headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}

export async function req(app: FastifyInstance, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, headers: Record<string, string>, body?: unknown) {
  const r = await app.inject({ method, url, headers, ...(body !== undefined ? { payload: body as never } : {}) });
  let json: any = null;
  try { json = r.json(); } catch { /* не JSON */ }
  return { status: r.statusCode, json };
}
