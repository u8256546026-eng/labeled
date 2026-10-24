import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LOG_TYPES, MAX_PARCELS, PERMS, type LogType, type Perm } from '../../../06-app/src/admin/model';
import { needStaff } from '../auth';
import { forbidden, invalid, pathInt } from '../http';
import type { Ctx } from '../services/core';
import * as S from '../services/admin';
import { listJournal } from '../services/journal';

const perm = z.enum(PERMS.map((p) => p[0]) as [Perm, ...Perm[]]);
const role = z.enum(['manager', 'stock', 'content']);
const p = (req: { params: unknown }) => req.params as Record<string, string>;
const ok = { ok: true };

/** Режим администратора: права проверяются на каждом запросе по сотруднику из initData. */
export const adminRoutes = (ctx: Ctx): FastifyPluginAsync => async (app) => {
  app.get('/tasks', async (req) => S.tasks(ctx, needStaff(req, null)));

  /** adm33: журнал действий — только владелец (право «Сотрудники» выдать нельзя). Только чтение: API изменения нет. */
  app.get('/journal', async (req) => {
    if (needStaff(req, 'staff').role !== 'owner') throw forbidden('owner_only');
    const q = z.object({ who: z.coerce.number().int().positive().optional(), type: z.enum(LOG_TYPES.slice(1).map((t) => t[0]) as [LogType, ...LogType[]]).optional() }).parse(req.query);
    return listJournal(ctx, q);
  });

  app.get('/payments/:id', async (req) => { needStaff(req, 'pay'); return S.getPayment(ctx, p(req).id); });
  app.post('/payments/:id/confirm', async (req) => { await S.confirmPayment(ctx, needStaff(req, 'pay'), p(req).id); return ok; });
  app.post('/payments/:id/fail', async (req) => {
    const b = z.object({ why: z.number().int().min(0).max(3), note: z.string().max(300).default('') }).parse(req.body);
    await S.failPayment(ctx, needStaff(req, 'pay'), p(req).id, b.why, b.note); return ok;
  });
  app.post('/payments/:id/seller-receipt', async (req) => {
    const s = needStaff(req, 'pay');
    const part = await req.file();
    if (!part) throw invalid('Нужен файл');
    const f = await ctx.files.save(part, 'seller_receipt', null, { pdf: true });
    await S.setSellerReceipt(ctx, s, p(req).id, f.id);
    return { name: f.name, preview: ctx.files.url(f.id) };
  });
  app.delete('/payments/:id/seller-receipt', async (req) => { await S.setSellerReceipt(ctx, needStaff(req, 'pay'), p(req).id, null); return ok; });

  app.get('/requests/:num', async (req) => { needStaff(req, 'req'); return S.getRequest(ctx, p(req).num); });
  app.post('/requests/:num/approve', async (req) => { await S.approveRequest(ctx, needStaff(req, 'req'), p(req).num); return ok; });
  app.post('/requests/:num/change', async (req) => {
    const b = z.object({ prices: z.array(z.number().int().min(0)).max(30), removed: z.array(z.boolean()).max(30).optional(), comment: z.string().max(300) }).parse(req.body);
    await S.changeRequest(ctx, needStaff(req, 'req'), p(req).num, b.prices, b.comment, b.removed); return ok;
  });
  app.post('/requests/:num/reject', async (req) => {
    const b = z.object({ why: z.number().int().min(0).max(3), note: z.string().max(300).default('') }).parse(req.body);
    await S.rejectRequest(ctx, needStaff(req, 'req'), p(req).num, b.why, b.note); return ok;
  });

  app.get('/orders', async (req) => { needStaff(req, 'orders'); return S.listOrders(ctx); });
  app.get('/orders/:num', async (req) => { needStaff(req, 'orders'); return S.getOrder(ctx, p(req).num); });
  app.post('/orders/:num/stage', async (req) => {
    const b = z.object({ stage: z.number().int().min(0).max(7), notify: z.boolean().default(true) }).parse(req.body);
    await S.setStage(ctx, needStaff(req, 'orders'), p(req).num, b.stage, b.notify); return ok;
  });
  app.post('/orders/:num/parcels', async (req) => {
    const b = z.object({ title: z.string().max(60).default(''), itemIds: z.array(z.number().int()).max(50).default([]), deliveryAmount: z.number().int().min(0).max(1_000_000).optional() }).parse(req.body);
    return { n: await S.addParcel(ctx, needStaff(req, 'track'), p(req).num, b) };
  });
  app.post('/orders/:num/parcels/:n/track', async (req) => {
    await S.saveTrack(ctx, needStaff(req, 'track'), p(req).num, pathInt(p(req).n), z.object({ track: z.string().max(30) }).parse(req.body).track); return ok;
  });
  /** adm29: счёт за доставку посылки после взвешивания. n = 0 — посылок ещё нет, создаётся посылка 1. */
  app.post('/orders/:num/parcels/:n/bill', async (req) => {
    const b = z.object({ weight: z.number().positive().max(1000), amount: z.number().int().positive().max(1_000_000) }).parse(req.body);
    const n = pathInt(p(req).n);
    return { n: await S.billParcel(ctx, needStaff(req, 'pay'), p(req).num, n > 0 ? n : null, b.weight, b.amount) };
  });
  /** adm34: состав посылок на складе в Китае — groups[k] — id вещей посылки k+1. */
  app.put('/orders/:num/parcels', async (req) => {
    const b = z.object({ groups: z.array(z.array(z.number().int()).max(50)).min(1).max(MAX_PARCELS) }).parse(req.body);
    await S.splitParcels(ctx, needStaff(req, 'orders'), p(req).num, b.groups); return ok;
  });
  app.post('/orders/:num/cancel', async (req) => {
    const b = z.object({ why: z.number().int().min(0).max(3), note: z.string().max(300).default('') }).parse(req.body ?? {});
    await S.cancelOrder(ctx, needStaff(req, 'orders'), p(req).num, b.why, b.note); return ok;
  });
  app.post('/orders/:num/refunded', async (req) => { await S.markRefunded(ctx, needStaff(req, 'pay'), p(req).num); return ok; });

  app.get('/photo/:num', async (req) => { needStaff(req, 'photo'); return S.getPhotoReport(ctx, p(req).num); });
  /** Фото вещи в отчёт: загрузка одного файла; ответ — id для списка фото вещи. */
  app.post('/photo/:num/upload', async (req) => {
    needStaff(req, 'photo');
    const part = await req.file();
    if (!part) throw invalid('Нужен файл');
    const f = await ctx.files.save(part, 'report', null);
    return { id: f.id, url: ctx.files.url(f.id) };
  });
  app.put('/photo/:num/items/:i', async (req) => { await S.setReportPics(ctx, needStaff(req, 'photo'), p(req).num, pathInt(p(req).i), z.object({ fileIds: z.array(z.string().max(600)).max(3) }).parse(req.body).fileIds); return ok; });
  app.post('/photo/:num/send', async (req) => { await S.sendReport(ctx, needStaff(req, 'photo'), p(req).num, z.object({ note: z.string().max(300).default('') }).parse(req.body ?? {}).note); return ok; });

  app.get('/claims/:num', async (req) => { needStaff(req, 'claims'); return S.getClaim(ctx, p(req).num); });
  app.post('/claims/:num/reply', async (req) => { await S.replyClaim(ctx, needStaff(req, 'claims'), p(req).num, z.object({ text: z.string().max(1000) }).parse(req.body).text); return ok; });
  app.post('/claims/:num/decide', async (req) => {
    const b = z.object({ answer: z.enum(['ok', 'no', 'more']), text: z.string().max(1000).default(''), refundSum: z.number().int().min(0).optional() }).parse(req.body);
    await S.decideClaim(ctx, needStaff(req, 'claims'), p(req).num, b.answer, b.text, b.refundSum); return ok;
  });
  app.post('/claims/:num/close', async (req) => { await S.closeClaim(ctx, needStaff(req, 'claims'), p(req).num); return ok; });

  app.get('/items', async (req) => { needStaff(req, 'catalog'); return S.listItems(ctx); });
  app.post('/items/upload', async (req) => {
    needStaff(req, 'catalog');
    const part = await req.file();
    if (!part) throw invalid('Нужен файл');
    const f = await ctx.files.save(part, 'product', null, { public: true });
    return { id: f.id, url: ctx.files.url(f.id, true) };
  });
  app.put('/items', async (req) => {
    const b = z.object({
      id: z.string().max(80), isNew: z.boolean().optional(), name: z.string().max(80), brand: z.string().max(60), description: z.string().max(2000).optional(), img: z.string().default(''),
      cat: z.string().max(60), cats: z.array(z.string().max(60)).min(1).max(12).optional(), show: z.boolean(), preorder: z.boolean(), preorderSizes: z.array(z.string().max(20)).max(20).optional(),
      colors: z.array(z.object({ id: z.string().regex(/^[\w-]{1,40}$/), name: z.string().min(1).max(40), filter: z.string().max(20).optional(), pics: z.array(z.string().max(500)).max(3) })).min(1).max(12),
      offers: z.array(z.object({ id: z.string().max(80), color: z.string().max(40), cond: z.string().max(40), size: z.string().max(20), price: z.number().int().min(0), qty: z.number().int().min(0).max(999) })).max(100),
    }).parse(req.body);
    return { id: await S.saveItem(ctx, needStaff(req, 'catalog'), b) };
  });
  app.post('/items/:id/merge', async (req) => {
    await S.mergeItem(ctx, needStaff(req, 'catalog'), p(req).id, z.object({ from: z.string().max(80) }).parse(req.body).from);
    return ok;
  });

  app.delete('/items/:id', async (req) => { await S.deleteItem(ctx, needStaff(req, 'catalog'), p(req).id); return ok; });

  app.get('/showcase', async (req) => { needStaff(req, 'banners'); return S.showcase(ctx); });
  app.put('/banners/:id', async (req) => { await S.setBanner(ctx, needStaff(req, 'banners'), pathInt(p(req).id), z.object({ on: z.boolean() }).parse(req.body).on); return ok; });
  const banner = z.object({ title: z.string().max(40), cta: z.string().max(30), target: z.enum(['link', 'catalog', 'email', 'invite']), cat: z.string().max(60).nullish(), img: z.string().max(600) });
  app.post('/banners/upload', async (req) => {
    needStaff(req, 'banners');
    const part = await req.file();
    if (!part) throw invalid('Нужен файл');
    const f = await ctx.files.save(part, 'banner', null, { public: true });
    return { id: f.id, url: ctx.files.url(f.id, true) };
  });
  app.post('/banners', async (req) => ({ id: await S.saveBanner(ctx, needStaff(req, 'banners'), null, banner.parse(req.body)) }));
  app.patch('/banners/:id', async (req) => ({ id: await S.saveBanner(ctx, needStaff(req, 'banners'), pathInt(p(req).id), banner.parse(req.body)) }));
  app.delete('/banners/:id', async (req) => { await S.deleteBanner(ctx, needStaff(req, 'banners'), pathInt(p(req).id)); return ok; });
  app.get('/sizes', async (req) => { needStaff(req, 'catalog'); return S.listSizes(ctx); });
  app.post('/sizes/:id', async (req) => { await S.answerSize(ctx, needStaff(req, 'catalog'), pathInt(p(req).id), z.object({ answer: z.enum(['yes', 'no']) }).parse(req.body).answer); return ok; });
  app.put('/categories/:id', async (req) => { await S.setCategory(ctx, needStaff(req, 'banners'), p(req).id, z.object({ on: z.boolean() }).parse(req.body).on); return ok; });
  app.post('/categories/upload', async (req) => {
    needStaff(req, 'banners');
    const part = await req.file();
    if (!part) throw invalid('Нужен файл');
    const f = await ctx.files.save(part, 'banner', null, { public: true });
    return { id: f.id, url: ctx.files.url(f.id, true) };
  });
  app.patch('/categories/:id', async (req) => { await S.setCategoryImg(ctx, needStaff(req, 'banners'), p(req).id, z.object({ img: z.string().max(600) }).parse(req.body).img); return ok; });
  app.post('/categories', async (req) => { await S.addCategory(ctx, needStaff(req, 'banners'), z.object({ name: z.string().max(40) }).parse(req.body).name); return ok; });

  app.get('/buyers', async (req) => { needStaff(req, 'buyers'); return S.listBuyers(ctx); });
  app.get('/buyers/:id', async (req) => { needStaff(req, 'buyers'); return S.buyer(ctx, pathInt(p(req).id)); });
  app.post('/buyers/:id/points', async (req) => {
    const b = z.object({ delta: z.number().int(), reason: z.string().max(120) }).parse(req.body);
    await S.adjustPoints(ctx, needStaff(req, 'buyers'), pathInt(p(req).id), b.delta, b.reason); return ok;
  });

  app.get('/reviews', async (req) => { needStaff(req, 'reviews'); return S.listReviews(ctx); });
  app.put('/reviews/:id', async (req) => { await S.setReview(ctx, needStaff(req, 'reviews'), pathInt(p(req).id), z.object({ state: z.enum(['pub', 'hid']) }).parse(req.body).state); return ok; });

  const tier = z.object({ upTo: z.number().int().positive().nullable(), value: z.number().min(0) });
  app.get('/settings', async (req) => { needStaff(req, 'prices'); return S.getPrices(ctx); });
  app.put('/settings', async (req) => {
    const b = z.object({
      rates: z.object({ rate: z.number().positive(), rateAuto: z.boolean().optional(), markup: z.array(tier).min(1).max(6), commission: z.array(tier).min(1).max(6), photo: z.number().min(0), box: z.number().min(0), protectPct: z.number().min(0).max(100), pointsShare: z.number().min(0).max(1).default(0.3) }),
      requisites: z.object({ bank: z.string().max(80), recipient: z.string().max(120), number: z.string().max(40) }),
    }).parse(req.body);
    await S.savePrices(ctx, needStaff(req, 'prices'), b.rates, b.requisites); return ok;
  });

  app.get('/staff', async (req) => S.listStaff(ctx, needStaff(req, 'staff')));
  app.put('/staff/:id', async (req) => {
    const b = z.object({ role, perms: z.array(perm).nullable() }).parse(req.body);
    await S.saveStaff(ctx, needStaff(req, 'staff'), pathInt(p(req).id), b.role, b.perms); return ok;
  });
  app.delete('/staff/:id', async (req) => { await S.removeStaff(ctx, needStaff(req, 'staff'), pathInt(p(req).id)); return ok; });
  app.post('/staff/invites', async (req) => S.createInvite(ctx, needStaff(req, 'staff'), z.object({ role }).parse(req.body).role));

  app.get('/summary', async (req) => { needStaff(req, 'summary'); return S.summary(ctx, z.enum(['day', 'week', 'month']).default('day').parse((req.query as { range?: string }).range)); });
};
