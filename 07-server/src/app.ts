import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { authHook } from './auth';
import type { Config } from './config';
import type { Db } from './db/client';
import { fileStore } from './files';
import { HttpError } from './http';
import { rateLimiter } from './limits';
import { liveHub } from './live';
import { adminRoutes } from './routes/admin';
import { buyerRoutes } from './routes/buyer';
import { publicRoutes } from './routes/public';
import { backfillAvatars } from './services/avatars';
import { flushPending, type Ctx } from './services/core';
import { smtpMailer, type Mailer } from './services/mail';

/** Приложение API. Тесты собирают его на PGlite в памяти и шлют запросы через inject. */
export async function buildApp(db: Db, config: Config, opts: { logger?: boolean; mailer?: Mailer | null } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1024 * 1024, trustProxy: true });
  await app.register(cors, { origin: config.corsOrigin, credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['authorization', 'content-type', 'x-dev-user'] });
  await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 5 } });

  const mail = opts.mailer !== undefined ? opts.mailer : config.smtp ? smtpMailer(config.smtp) : null;
  const ctx: Ctx = { db, config, files: fileStore(db, config), log: app.log, limit: rateLimiter(), mail };
  app.decorateRequest('tg', null);
  app.decorateRequest('user', null);
  app.decorateRequest('staffRow', null);
  app.addHook('onRequest', authHook(db, config));

  app.setErrorHandler((e, req, reply) => {
    if (e instanceof HttpError) return reply.status(e.status).send({ error: e.code, message: e.message });
    if (e instanceof ZodError) return reply.status(400).send({ error: 'invalid', message: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const err = e as { statusCode?: number; code?: string; message: string };
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.code ?? 'bad_request', message: err.message });
    req.log.error(e);
    return reply.status(500).send({ error: 'server', message: 'Ошибка сервера' });
  });

  // Сообщения бота и сигнал открытым приложениям уходят после ответа: изменения уже сохранены.
  const live = liveHub();
  app.addHook('onResponse', async (req, reply) => {
    if (req.method !== 'GET' && reply.statusCode < 400) flushPending(ctx).catch((e) => req.log.warn(e, 'уведомления'));
    live.afterResponse(req, reply.statusCode);
  });
  app.addHook('preClose', async () => live.closeAll());
  // Аватарки людей, которых ещё не проверяли, — в фоне после запуска (без бота ничего не делает).
  app.addHook('onReady', async () => { void backfillAvatars(ctx).catch((err) => app.log.warn({ err }, 'аватарки')); });

  app.get('/health', async () => ({ ok: true }));
  await app.register(publicRoutes(ctx), { prefix: '' });
  await app.register(buyerRoutes(ctx, live), { prefix: '/api' });
  await app.register(adminRoutes(ctx), { prefix: '/api/admin' });
  return app;
}
