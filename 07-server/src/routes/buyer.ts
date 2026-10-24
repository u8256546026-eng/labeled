import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, invalid, pathInt, ruDate } from '../http';
import { needUser } from '../auth';
import { LIMITS } from '../limits';
import type { LiveHub } from '../live';
import type { Ctx } from '../services/core';
import * as O from '../services/orders';
import * as P from '../services/profile';
import * as A from '../services/aftersale';
import { refreshAvatar } from '../services/avatars';

const num = z.string().regex(/^(\d{3,9}|pre-\d+)$/);
const fileIds = z.array(z.string().uuid()).max(10).default([]);

/** Загрузка одного файла из multipart. */
async function oneFile(req: FastifyRequest) {
  const part = await req.file();
  if (!part) throw invalid('Нужен файл');
  return part;
}

/** Покупатель: всё, что требует входа через Telegram. */
export const buyerRoutes = (ctx: Ctx, live: LiveHub): FastifyPluginAsync => async (app) => {
  const limit = (what: keyof typeof LIMITS, userId: number) => ctx.limit(`${what}:${userId}`, LIMITS[what][0], LIMITS[what][1]);

  /** Вход (BA, P): consent — согласие с офертой и политикой при первом входе. */
  app.post('/session', async (req) => {
    if (!req.tg) throw new HttpError(401, 'login_required');
    const b = z.object({ consent: z.boolean().default(false) }).parse(req.body ?? {});
    const s = await P.login(ctx, req.tg, b.consent);
    void refreshAvatar(ctx, s.user.id).catch((err) => req.log.warn({ err }, 'аватарка'));
    return s;
  });
  app.get('/me', async (req) => P.session(ctx, needUser(req)));
  /** Живое обновление заказов: поток сигналов «orders» (см. live.ts). */
  app.get('/live', (req, reply) => live.stream(req, reply, needUser(req).id));
  app.patch('/me', async (req) => {
    const u = needUser(req);
    const b = z.object({ name: z.string().max(60).optional() }).parse(req.body);
    return { name: b.name !== undefined ? await P.updateName(ctx, u.id, b.name) : u.name };
  });
  app.put('/me/notif', async (req) => P.setNotif(ctx, needUser(req).id, z.object({ bot: z.boolean(), req: z.boolean(), pay: z.boolean(), ship: z.boolean(), pts: z.boolean(), promo: z.boolean(), mail: z.boolean(), botAllowed: z.boolean() }).partial().parse(req.body)));
  app.delete('/me', async (req) => { await P.deleteAccount(ctx, needUser(req).id); return { ok: true }; });

  app.get('/addresses', async (req) => P.listAddresses(ctx, needUser(req).id));
  app.post('/addresses', async (req) => P.saveAddress(ctx, needUser(req).id, z.object({ id: z.string().optional(), name: z.string().max(80), phone: z.string().max(20), city: z.string().max(80), line: z.string().max(200), main: z.boolean().optional() }).parse(req.body)));
  app.delete('/addresses/:id', async (req) => { await P.deleteAddress(ctx, needUser(req).id, pathInt((req.params as { id: string }).id)); return { ok: true }; });

  app.post('/email', async (req) => {
    const u = needUser(req);
    limit('email', u.id);
    return P.sendEmail(ctx, u.id, z.object({ address: z.string().max(120) }).parse(req.body).address);
  });
  app.delete('/email', async (req) => { await P.unlinkEmail(ctx, needUser(req).id); return { ok: true }; });

  app.get('/favorites', async (req) => P.listFavorites(ctx, needUser(req).id));
  app.put('/favorites/:id', async (req) => { await P.setFavorite(ctx, needUser(req).id, (req.params as { id: string }).id, true); return { ok: true }; });
  app.delete('/favorites/:id', async (req) => { await P.setFavorite(ctx, needUser(req).id, (req.params as { id: string }).id, false); return { ok: true }; });

  app.get('/events', async (req) => P.listEvents(ctx, needUser(req).id));
  app.post('/events/read', async (req) => { await P.readEvents(ctx, needUser(req).id); return { ok: true }; });
  app.get('/points', async (req) => ({ balance: needUser(req).points, history: await P.pointsHistory(ctx, needUser(req).id) }));

  /** Файл для обращения, отзыва или позиции заявки. Чек загружается отдельно — к платежу. */
  app.post('/files', async (req) => {
    const u = needUser(req);
    const kind = z.enum(['claim', 'review', 'link_item']).parse((req.query as { kind?: string }).kind);
    limit('upload', u.id);
    const f = await ctx.files.save(await oneFile(req), kind, u.id);
    return { id: f.id, name: f.name, url: ctx.files.url(f.id) };
  });

  // ───── оформление и оплата ─────
  app.post('/checkout/validate', async (req) => {
    needUser(req);
    const b = z.object({ lines: z.array(z.object({ key: z.string(), itemId: z.string(), offerId: z.string(), name: z.string(), img: z.string(), params: z.string(), cond: z.enum(['новое', 'как новое', 'чуть уставшее']), price: z.number().int(), qty: z.number().int().min(1).max(20) })).max(50) }).parse(req.body);
    return O.validateLines(ctx.db, b.lines);
  });
  app.post('/orders', async (req) => {
    const u = needUser(req);
    const b = z.object({
      lines: z.array(z.object({ offerId: z.string(), qty: z.number().int().min(1).max(20), price: z.number().int().positive() })).min(1).max(50),
      pointsOff: z.number().int().min(0).default(0),
      delivery: z.object({ mode: z.enum(['pvz', 'post', 'courier']), pvz: z.string().max(200), slot: z.number().int().min(0).max(5) }),
      addressId: z.coerce.number().int(),
      /** Ключ попытки оформления: повтор с тем же ключом возвращает уже оформленный заказ. */
      key: z.string().min(8).max(64).optional(),
    }).parse(req.body);
    limit('order', u.id);
    return O.placeStockOrder(ctx, u.id, b);
  });
  app.get('/orders', async (req) => O.listOrders(ctx, needUser(req).id));
  app.get('/orders/:num', async (req) => O.getOrder(ctx, needUser(req).id, num.parse((req.params as { num: string }).num)));
  app.post('/orders/:num/cancel', async (req) => ({ result: await O.cancelOrder(ctx, needUser(req).id, num.parse((req.params as { num: string }).num)) }));
  // Награду пригласившему (событие и сообщение бота) рассылает общий flushPending после ответа.
  app.post('/orders/:num/received', async (req) => { await O.confirmReceipt(ctx, needUser(req).id, num.parse((req.params as { num: string }).num)); return { ok: true }; });
  app.post('/orders/:num/accept', async (req) => ({ payId: await O.acceptChange(ctx, needUser(req).id, num.parse((req.params as { num: string }).num)) }));
  app.get('/orders/:num/photo-report', async (req) => A.photoReport(ctx, needUser(req).id, num.parse((req.params as { num: string }).num)));
  app.get('/payments', async (req) => O.listPayments(ctx, needUser(req).id));
  /** Чек к платежу (C): фото или PDF. */
  app.post('/payments/:id/receipt', async (req) => {
    const u = needUser(req);
    const id = (req.params as { id: string }).id;
    limit('upload', u.id);
    // Платёж проверяется до сохранения: чек к чужому или уже проверенному платежу не оставляет файл на диске.
    await O.receiptAllowed(ctx, u.id, id);
    const f = await ctx.files.save(await oneFile(req), 'receipt', u.id, { pdf: true });
    await O.attachReceipt(ctx, u.id, id, f.id);
    return { name: f.name, meta: `${Math.max(1, Math.round(f.size / 1024))} КБ · ${ruDate(new Date())}`, preview: f.mime.startsWith('image/') ? ctx.files.url(f.id) : undefined };
  });
  app.post('/payments/:id/transferred', async (req) => { await O.markTransferred(ctx, needUser(req).id, (req.params as { id: string }).id); return { ok: true }; });

  // ───── заказ по ссылке ─────
  const linkItem = z.object({ key: z.string().max(40), plat: z.enum(['Poizon', 'Taobao', 'Свой вариант', '']), url: z.string().max(500), size: z.string().max(20), qty: z.number().int().min(1).max(50), price: z.number().positive().max(1_000_000), photo: z.boolean(), box: z.boolean(), picFileId: z.string().uuid().nullish() });
  app.post('/link', async (req) => {
    const u = needUser(req);
    const b = z.object({ title: z.string().max(16), items: z.array(linkItem).min(1).max(30), protect: z.boolean(), ship: z.enum(['all', 'parts']), disc: z.enum(['points', 'comm', 'none']), draftId: z.string().max(40).optional(), key: z.string().min(8).max(64).optional(), addressId: z.coerce.number().int().optional() }).parse(req.body);
    limit('order', u.id);
    return O.submitLink(ctx, u.id, b);
  });
  app.get('/link/drafts', async (req) => O.listDrafts(ctx, needUser(req).id));
  app.put('/link/drafts/:id', async (req) => {
    const u = needUser(req);
    limit('draft', u.id);
    await O.saveDraft(ctx, u.id, z.string().max(40).parse((req.params as { id: string }).id), req.body);
    return { ok: true };
  });
  app.delete('/link/drafts/:id', async (req) => { await O.deleteDraft(ctx, needUser(req).id, (req.params as { id: string }).id); return { ok: true }; });
  app.post('/size-requests', async (req) => {
    const u = needUser(req);
    const b = z.object({ productId: z.string().max(80), color: z.string().max(40), size: z.string().max(20) }).parse(req.body);
    limit('sizeRequest', u.id);
    return O.createSizeRequest(ctx, u.id, b);
  });

  // ───── после покупки ─────
  app.get('/claims/:num', async (req) => A.getClaim(ctx, needUser(req).id, num.parse((req.params as { num: string }).num)));
  app.post('/claims', async (req) => A.createClaim(ctx, needUser(req).id, z.object({ orderNum: num, reason: z.number().int().min(0).max(4), text: z.string().max(1000).default(''), fileIds }).parse(req.body)));
  app.post('/claims/:id/photos', async (req) => { await A.addClaimPhotos(ctx, needUser(req).id, pathInt((req.params as { id: string }).id), fileIds.parse((req.body as { fileIds?: unknown })?.fileIds)); return { ok: true }; });
  app.post('/claims/:id/refund', async (req) => A.sendRefund(ctx, needUser(req).id, pathInt((req.params as { id: string }).id), z.object({ to: z.enum(['sbp', 'card']), val: z.string().max(30), bank: z.string().max(60) }).parse(req.body)));
  app.post('/reviews', async (req) => A.submitReview(ctx, needUser(req).id, z.object({ orderNum: num, stars: z.number().int().min(1).max(5), text: z.string().max(600).default(''), fileIds, sign: z.enum(['short', 'anon']) }).parse(req.body)));
};
