import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { catalogFacets, catalogPage, parseFilter, productById, search, visibleBanners, visibleCategories } from '../services/catalog';
import { getSetting, type Ctx } from '../services/core';
import { publicReviews } from '../services/aftersale';
import { confirmPage } from '../services/mail';
import { confirmEmail, inviter } from '../services/profile';
import { linkRates } from '../services/orders';
import { notFound, pathInt } from '../http';

/** Без входа: каталог открыт и гостю (E), документы, отзывы, курс, файлы по подписанной ссылке. */
export const publicRoutes = (ctx: Ctx): FastifyPluginAsync => async (app) => {
  app.get('/api/catalog', async (req) => {
    const q = z.object({ f: z.string().optional(), page: z.coerce.number().int().min(0).max(100).default(0) }).parse(req.query);
    return catalogPage(ctx.db, parseFilter(q.f), q.page);
  });
  app.get('/api/catalog/facets', async (req) => catalogFacets(ctx.db, parseFilter((req.query as { f?: string }).f)));
  app.get('/api/products/:id', async (req) => {
    const p = await productById(ctx.db, (req.params as { id: string }).id);
    if (!p) throw notFound('product_not_found');
    return p;
  });
  app.get('/api/search', async (req) => search(ctx.db, z.object({ q: z.string().max(100).default('') }).parse(req.query).q));
  app.get('/api/showcase', async () => ({ categories: await visibleCategories(ctx.db), banners: await visibleBanners(ctx.db) }));
  app.get('/api/rates', async () => linkRates(ctx));
  app.get('/api/requisites', async () => getSetting(ctx.db, 'requisites'));
  app.get('/api/legal', async () => {
    const L = await getSetting(ctx.db, 'legal');
    return { effectiveFrom: L.effectiveFrom, docs: Object.entries(L.docs).map(([id, d]) => ({ id, title: d.title, sub: d.sub })) };
  });
  app.get('/api/legal/:id', async (req) => {
    const L = await getSetting(ctx.db, 'legal');
    const d = L.docs[(req.params as { id: string }).id];
    if (!d) throw notFound();
    return { title: d.title, effectiveFrom: L.effectiveFrom, body: d.body };
  });
  app.get('/api/reviews', async () => publicReviews(ctx));
  app.get('/api/system', async () => getSetting(ctx.db, 'system'));
  app.get('/api/inviter/:tgId', async (req) => {
    const r = await inviter(ctx, pathInt((req.params as { tgId: string }).tgId));
    if (!r) throw notFound();
    return r;
  });
  /** Ссылка из письма подтверждения почты (AN). Открывается в браузере почты — отвечаем страницей, а не JSON. */
  app.get('/api/email/confirm', async (req, reply) => {
    const token = (req.query as { token?: unknown }).token;
    const r = typeof token === 'string' && /^[0-9a-f]{32}$/.test(token) ? await confirmEmail(ctx, token) : 'bad';
    return reply.status(r === 'ok' ? 200 : r === 'expired' ? 410 : 404).header('cache-control', 'no-store').type('text/html; charset=utf-8').send(confirmPage(r, ctx.config.botLink));
  });
  app.get('/files/:id', async (req, reply) => {
    const q = req.query as { e?: string; s?: string; w?: string };
    const f = await ctx.files.read((req.params as { id: string }).id, q.e, q.s, Number(q.w) || undefined);
    // У публичного файла id случайный и содержимое по нему не меняется — кешируем надолго; приватные ссылки живут сутки.
    return reply.header('cache-control', f.public ? 'public, max-age=31536000, immutable' : 'private, max-age=3600').header('x-content-type-options', 'nosniff').header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`).type(f.mime).send(f.body);
  });
};
