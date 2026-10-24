import { inArray, sql } from 'drizzle-orm';
import { files, claims, linkDrafts, orderItems, payments, reviews } from '../db/schema';
import { unlinkUpload } from '../files';
import type { Ctx } from './core';

/** Загрузки покупателя, которые ни к чему не привязались за это время, удаляются. */
export const ORPHAN_AGE_DAYS = 7;

/**
 * Удалить загрузки покупателей (чек, фото обращения, отзыва, позиции заявки), на которые ничто не ссылается:
 * обращение не отправили, чек заменили другим, позицию убрали из черновика. Файлы сотрудников, товаров и баннеров
 * не трогаются. Ссылка из черновика ищется в тексте формы — черновик хранит её как прислало приложение.
 */
export async function purgeOrphanFiles(ctx: Pick<Ctx, 'db' | 'config' | 'log'>, now = new Date()) {
  const before = new Date(now.getTime() - ORPHAN_AGE_DAYS * 86400_000);
  const rows = await ctx.db.select({ id: files.id, path: files.path }).from(files).where(sql`${files.kind} in ('receipt', 'claim', 'review', 'link_item')
    and ${files.createdAt} < ${before}
    and not exists (select 1 from ${payments} where ${payments.receiptFileId} = ${files.id} or ${payments.sellerReceiptFileId} = ${files.id})
    and not exists (select 1 from ${claims} where ${files.id} = any(${claims.fileIds}))
    and not exists (select 1 from ${reviews} where ${files.id} = any(${reviews.fileIds}))
    and not exists (select 1 from ${orderItems} where ${orderItems.picFileId} = ${files.id})
    and not exists (select 1 from ${linkDrafts} where strpos(${linkDrafts.form}::text, ${files.id}) > 0)`).limit(500);
  if (!rows.length) return 0;
  await ctx.db.delete(files).where(inArray(files.id, rows.map((r) => r.id)));
  for (const r of rows) {
    await unlinkUpload(ctx.config, r.path).catch((err: NodeJS.ErrnoException) => { if (err.code !== 'ENOENT') ctx.log.warn({ err, id: r.id }, 'файл не удалён с диска'); });
  }
  ctx.log.info({ n: rows.length }, 'удалены непривязанные загрузки покупателей');
  return rows.length;
}
