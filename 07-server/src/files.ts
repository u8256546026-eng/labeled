import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MultipartFile } from '@fastify/multipart';
import { and, eq, inArray } from 'drizzle-orm';
import sharp from 'sharp';
import type { Config } from './config';
import type { Db } from './db/client';
import { files } from './db/schema';
import { HttpError, invalid } from './http';

export type FileKind = (typeof files.$inferInsert)['kind'];

/** Тип файла по первым байтам: клиентскому mimetype не доверяем. */
function sniff(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b.subarray(0, 4).toString('hex') === '89504e47') return 'image/png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  // HEIC/HEIF с iPhone: контейнер ISO BMFF с брендом изображения; видео MP4/MOV с тем же «ftyp» не принимаем.
  if (b.subarray(4, 8).toString() === 'ftyp' && ['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1'].includes(b.subarray(8, 12).toString())) return 'image/heic';
  if (b.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  return null;
}

/**
 * Ширины уменьшенных копий фото (`/files/:id?w=`): превью в списках, карточка каталога, галерея товара.
 * Оригиналы с телефона весят 0,3–0,6 МБ — каталог на мобильном интернете грузился десятки секунд.
 * Других ширин не делаем, чтобы по запросам с произвольным w нельзя было забить диск.
 */
export const IMAGE_WIDTHS = [240, 480, 960] as const;

const variantPath = (config: Config, id: string, w: number) => join(config.uploadDir, 'w', `${id}-${w}.webp`);

/** Удалить с диска загрузку и её уменьшенные копии. */
export async function unlinkUpload(config: Config, path: string) {
  await unlink(join(config.uploadDir, path));
  await Promise.all(IMAGE_WIDTHS.map((w) => unlink(variantPath(config, path, w)).catch(() => {})));
}

export function fileStore(db: Db, config: Config) {
  const sig = (id: string, exp: number) => createHmac('sha256', config.fileSecret).update(id + '.' + exp).digest('base64url');

  return {
    /** Сохранить загрузку. pdf — только для чеков. Размер ограничен MAX_UPLOAD_MB. */
    async save(part: MultipartFile, kind: FileKind, ownerUserId: number | null, opts: { pdf?: boolean; public?: boolean } = {}) {
      const buf = await part.toBuffer();
      if (buf.length > config.maxUploadMb * 1024 * 1024) throw new HttpError(413, 'too_large');
      const mime = sniff(buf);
      if (!mime || (mime === 'application/pdf' && !opts.pdf)) throw invalid('Нужна картинка' + (opts.pdf ? ' или PDF' : ''));
      const id = randomUUID();
      await mkdir(config.uploadDir, { recursive: true });
      await writeFile(join(config.uploadDir, id), buf);
      await db.insert(files).values({ id, ownerUserId, kind, name: part.filename.slice(0, 200) || 'file', mime, size: buf.length, path: id, public: !!opts.public });
      return { id, name: part.filename, mime, size: buf.length };
    },

    /** Ссылка на файл: публичный — постоянная, приватный — подписанная на сутки (картинки в WebView без заголовков). */
    url(id: string | null | undefined, isPublic = false): string | undefined {
      if (!id) return undefined;
      if (/^https?:\/\//.test(id)) return id;
      if (isPublic) return `${config.publicUrl}/files/${id}`;
      const exp = Math.floor(Date.now() / 1000) + 86400;
      return `${config.publicUrl}/files/${id}?e=${exp}&s=${sig(id, exp)}`;
    },

    /**
     * Файлы, которые покупатель прикладывает к обращению, отзыву или позиции заявки: только свои и того же
     * назначения. Иначе по известному id можно было бы показать продавцу или опубликовать чужой чек.
     */
    async assertOwn(ids: string[], ownerUserId: number, kind: FileKind) {
      const uniq = [...new Set(ids)];
      if (!uniq.length) return;
      const rows = await db.select({ id: files.id }).from(files).where(and(inArray(files.id, uniq), eq(files.ownerUserId, ownerUserId), eq(files.kind, kind)));
      if (rows.length !== uniq.length) throw invalid('Файл не найден — загрузите его заново');
    },

    /** Файл; с w из IMAGE_WIDTHS у картинки — уменьшенная копия WebP (делается при первом запросе и лежит на диске). */
    async read(id: string, e?: string, s?: string, w?: number): Promise<{ mime: string; name: string; public: boolean; body: Buffer }> {
      const [f] = await db.select().from(files).where(eq(files.id, id));
      if (!f) throw new HttpError(404, 'not_found');
      if (!f.public) {
        const exp = Number(e);
        const good = s && exp > Date.now() / 1000 && s.length === sig(id, exp).length && timingSafeEqual(Buffer.from(s), Buffer.from(sig(id, exp)));
        if (!good) throw new HttpError(403, 'forbidden');
      }
      const orig = join(config.uploadDir, f.path);
      if (w && (IMAGE_WIDTHS as readonly number[]).includes(w) && f.mime.startsWith('image/')) {
        const vp = variantPath(config, f.path, w);
        const ready = await readFile(vp).catch(() => null);
        if (ready) return { mime: 'image/webp', name: f.name, public: f.public, body: ready };
        try {
          // rotate() без аргументов поворачивает по EXIF и вместе с остальными метаданными убирает координаты съёмки.
          const body = await sharp(orig).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
          await mkdir(join(config.uploadDir, 'w'), { recursive: true });
          const tmp = `${vp}.${randomUUID()}`;
          await writeFile(tmp, body);
          await rename(tmp, vp);
          return { mime: 'image/webp', name: f.name, public: f.public, body };
        } catch {
          // HEIC сборка sharp не читает — отдаём оригинал, как раньше.
        }
      }
      return { mime: f.mime, name: f.name, public: f.public, body: await readFile(orig) };
    },
  };
}

export type FileStore = ReturnType<typeof fileStore>;
