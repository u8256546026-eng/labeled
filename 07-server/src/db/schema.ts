// Модель данных labeled: одна база для покупателя (Mini App) и режима администратора.
// Деньги — целые рубли; цены площадок — целые юани. Время — timestamptz.
import { sql } from 'drizzle-orm';
import {
  bigint, bigserial, boolean, check, index, integer, jsonb, pgSequence, pgTable, primaryKey, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const ts = () => timestamp({ withTimezone: true });

/** Номера заказов и заявок общие и сквозные: «Заказ 1048», «Заявка 1049». Демо-данные занимают номера до 1047. */
export const orderNumSeq = pgSequence('order_num_seq', { startWith: 1048 });

// ───────────────────────────── люди ─────────────────────────────

/** Покупатель. Вход только через Telegram: пользователь берётся из initData, подлинность проверяет сервер. */
export const users = pgTable('users', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  tgId: bigint('tg_id', { mode: 'number' }).notNull().unique(),
  username: text(),
  tgName: text('tg_name').notNull(),
  /** Имя в профиле; по умолчанию — из Telegram, покупатель может изменить (AL). */
  name: text().notNull(),
  photoUrl: text('photo_url'),
  /** Аватарка на нашем сервере (services/avatars.ts) и когда её последний раз проверяли в Telegram. */
  avatarFileId: text('avatar_file_id'),
  avatarCheckedAt: timestamp('avatar_checked_at', { withTimezone: true }),
  /** Согласие с офертой и политикой — один раз при первом входе (P). */
  consentAt: ts(),
  email: text(),
  emailState: text('email_state', { enum: ['none', 'wait', 'ok'] }).notNull().default('none'),
  emailToken: text('email_token'),
  /** Когда отправлено письмо подтверждения: ссылка действует EMAIL_LINK_HOURS (services/mail.ts). */
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  /** Каналы уведомлений (AP). */
  notif: jsonb().$type<{ bot: boolean; req: boolean; pay: boolean; ship: boolean; pts: boolean; promo: boolean; mail: boolean }>().notNull()
    .default({ bot: true, req: true, pay: true, ship: true, pts: false, promo: false, mail: false }),
  /** Разрешение боту писать первым (requestWriteAccess). */
  botAllowed: boolean('bot_allowed').notNull().default(false),
  /** Баланс баллов — сумма points_ledger, хранится для быстрых проверок; меняется только вместе с журналом. */
  points: integer().notNull().default(0),
  referrerId: bigint('referrer_id', { mode: 'number' }),
  /** Скидка 50% на комиссию первого заказа уже использована. */
  firstDiscountUsed: boolean('first_discount_used').notNull().default(false),
  createdAt: now(),
  /** Удалён (O): личные данные стёрты, строка оставлена для истории заказов. */
  deletedAt: ts(),
}, (t) => [check('points_nonneg', sql`${t.points} >= 0`)]);

/** Сотрудник: Telegram-аккаунт покупателя с ролью. Права роли можно переопределить (adm23). */
export const staff = pgTable('staff', {
  id: serial().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().unique().references(() => users.id),
  role: text({ enum: ['owner', 'manager', 'stock', 'content'] }).notNull(),
  perms: text().array(),
  createdAt: now(),
  removedAt: ts(),
});

/** Приглашение сотрудника: одноразовая ссылка startapp=staff_<code> на 24 часа (adm24). */
export const staffInvites = pgTable('staff_invites', {
  code: text().primaryKey(),
  role: text({ enum: ['manager', 'stock', 'content'] }).notNull(),
  createdBy: integer('created_by').notNull().references(() => staff.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedBy: bigint('used_by', { mode: 'number' }).references(() => users.id),
  usedAt: ts(),
});

export const addresses = pgTable('addresses', {
  id: serial().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  name: text().notNull(),
  phone: text().notNull(),
  city: text().notNull(),
  line: text().notNull(),
  isMain: boolean('is_main').notNull().default(false),
  createdAt: now(),
}, (t) => [index('addresses_user').on(t.userId)]);

// ───────────────────────────── файлы ─────────────────────────────

/** Загруженный файл: чек, фото товара, фотоотчёт, фото обращения. public — фото каталога и баннеров. */
export const files = pgTable('files', {
  id: text().primaryKey(),
  ownerUserId: bigint('owner_user_id', { mode: 'number' }).references(() => users.id),
  kind: text({ enum: ['receipt', 'seller_receipt', 'product', 'banner', 'report', 'claim', 'review', 'link_item', 'size_chart', 'avatar'] }).notNull(),
  name: text().notNull(),
  mime: text().notNull(),
  size: integer().notNull(),
  path: text().notNull(),
  public: boolean().notNull().default(false),
  createdAt: now(),
});

// ───────────────────────────── каталог ─────────────────────────────

export const categories = pgTable('categories', {
  id: text().primaryKey(),
  name: text().notNull(),
  img: text().notNull().default(''),
  sort: integer().notNull().default(0),
  visible: boolean().notNull().default(true),
});

export const banners = pgTable('banners', {
  id: serial().primaryKey(),
  title: text().notNull(),
  /** Куда ведёт кнопка: link | email | invite | catalog. */
  target: text().notNull(),
  sub: text().notNull().default(''),
  /** Текст кнопки (adm32); пусто — у нарисованных баннеров текст кнопки в дизайне. */
  cta: text().notNull().default(''),
  /** Категория, если кнопка ведёт в категорию каталога. */
  cat: text(),
  /** Картинка 1080 × 600 без текста — публичный адрес файла. */
  img: text(),
  sort: integer().notNull().default(0),
  visible: boolean().notNull().default(true),
});

/** Модель вещи из наличия: расцветки с фото, размерный ряд, описание. Конкретные экземпляры — offers. */
export const products = pgTable('products', {
  id: text().primaryKey(),
  name: text().notNull(),
  brand: text().notNull(),
  /** Основная категория; extraCategories — ещё категории, где вещь видна в каталоге (adm15, с 2026-10-22). */
  categoryId: text('category_id').notNull().references(() => categories.id),
  extraCategories: text('extra_categories').array().notNull().default(sql`'{}'::text[]`),
  description: text().notNull().default(''),
  sizeGrid: text('size_grid').array().notNull().default(sql`'{}'::text[]`),
  /** [{ id, name, filter, thumb, photos[] }] — порядок как в карточке. */
  colors: jsonb().$type<{ id: string; name: string; filter: string; thumb: string; photos: string[] }[]>().notNull(),
  /** Размеры под заказ по цветам (7o–7q). */
  preorder: jsonb().$type<Record<string, string[]>>().notNull().default({}),
  sizeChart: text('size_chart'),
  visible: boolean().notNull().default(true),
  /** Покупатель может оставить заявку на отсутствующий размер. */
  preorderAllowed: boolean('preorder_allowed').notNull().default(false),
  pop: integer().notNull().default(0),
  createdAt: now(),
});

/** Предложение: экземпляр модели в цвете, размере и состоянии со своей ценой и остатком. 0 — не видно. */
export const offers = pgTable('offers', {
  id: text().primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  color: text().notNull(),
  size: text().notNull().default(''),
  cond: text({ enum: ['новое', 'как новое', 'чуть уставшее'] }).notNull(),
  note: text().notNull().default(''),
  price: integer().notNull(),
  stock: integer().notNull().default(0),
  img: text().notNull().default(''),
}, (t) => [index('offers_product').on(t.productId), check('stock_nonneg', sql`${t.stock} >= 0`), check('price_pos', sql`${t.price} > 0`)]);

export const favorites = pgTable('favorites', {
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  productId: text('product_id').notNull(),
  createdAt: now(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);

/** Заявка на отсутствующий размер (7p): цену и возможность подтверждает продавец. */
export const sizeRequests = pgTable('size_requests', {
  id: serial().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  productId: text('product_id').notNull().references(() => products.id),
  color: text().notNull(),
  size: text().notNull(),
  state: text({ enum: ['review', 'offered', 'rejected', 'cancelled'] }).notNull().default('review'),
  price: integer(),
  createdAt: now(),
});

// ───────────────────────────── заказы ─────────────────────────────

/**
 * Заказ или заявка. kind: stock — из наличия, link — по ссылке с площадок.
 * phase ведёт заявку до оплаты: review (ждёт продавца) → changed (продавец изменил, ждёт согласия) → invoiced (счёт)
 * → active (оплачен, дальше этапы stage) → done; ответвления rejected и cancelled.
 * stage — индекс этапа: для link — 8 этапов продавца (adm10), для stock — 4 точки (Оформлен … Доставлен).
 */
export const orders = pgTable('orders', {
  id: serial().primaryKey(),
  num: text().notNull().unique(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  kind: text({ enum: ['stock', 'link'] }).notNull(),
  title: text().notNull(),
  phase: text({ enum: ['review', 'changed', 'invoiced', 'active', 'done', 'rejected', 'cancelled'] }).notNull(),
  stage: integer().notNull().default(0),
  /** Адрес и способ получения — снимок на момент оформления. */
  address: jsonb().$type<{ name: string; phone: string; city: string; line: string } | null>(),
  delivery: jsonb().$type<{ mode: 'pvz' | 'post' | 'courier'; pvz: string; slot: number } | null>(),
  /** Суммы в рублях, зафиксированы при оформлении или выставлении счёта. */
  goods: integer().notNull().default(0),
  commission: integer().notNull().default(0),
  services: integer().notNull().default(0),
  protection: integer().notNull().default(0),
  pointsUsed: integer('points_used').notNull().default(0),
  commDiscount: integer('comm_discount').notNull().default(0),
  total: integer().notNull().default(0),
  /** Заявка по ссылке: параметры расчёта на момент отправки, защита, отправка частями. */
  ratesSnapshot: jsonb('rates_snapshot'),
  protect: boolean().notNull().default(false),
  shipMode: text('ship_mode', { enum: ['all', 'parts'] }).notNull().default('all'),
  /** Продавец изменил заявку (adm07) — причина для покупателя (J). */
  changeComment: text('change_comment'),
  rejectReason: integer('reject_reason'),
  rejectNote: text('reject_note'),
  cancelRequestedAt: ts(),
  /** Отмена продавцом (adm30): причина из списка SELLER_CANCEL и комментарий для покупателя. */
  cancelReason: integer('cancel_reason'),
  cancelNote: text('cancel_note'),
  /** Сколько вернуть покупателю после отмены оплаченного заказа; refundedAt — сотрудник отметил возврат. */
  refundDue: integer('refund_due').notNull().default(0),
  refundedAt: ts(),
  receivedAt: ts(),
  createdAt: now(),
  updatedAt: now(),
  /** Ключ попытки оформления из приложения и ответ на неё: повтор (двойное нажатие, обрыв связи) возвращает тот же заказ. */
  clientKey: text('client_key'),
  clientReply: jsonb('client_reply'),
}, (t) => [index('orders_user').on(t.userId), index('orders_phase').on(t.phase), uniqueIndex('orders_client_key').on(t.userId, t.clientKey)]);

/** Позиция заказа. Для наличия — конкретное предложение и цена в рублях; для заявки — ссылка и цена в юанях. */
export const orderItems = pgTable('order_items', {
  id: serial().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  offerId: text('offer_id'),
  name: text().notNull(),
  params: text().notNull().default(''),
  img: text().notNull().default(''),
  cond: text(),
  price: integer().notNull().default(0),
  qty: integer().notNull(),
  plat: text(),
  url: text(),
  size: text(),
  priceCny: integer('price_cny'),
  oldPriceCny: integer('old_price_cny'),
  photo: boolean().notNull().default(false),
  box: boolean().notNull().default(false),
  picFileId: text('pic_file_id'),
  /** Продавец убрал позицию (нет в наличии) — покупатель видит это в J. */
  removed: boolean().notNull().default(false),
}, (t) => [index('order_items_order').on(t.orderId), check('qty_pos', sql`${t.qty} >= 1`)]);

/** История заказа (D): смены этапов, решения продавца, действия покупателя. */
export const orderHistory = pgTable('order_history', {
  id: serial().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  label: text().notNull(),
  note: text().notNull().default(''),
  staffId: integer('staff_id'),
  at: now(),
}, (t) => [index('order_history_order').on(t.orderId)]);

/** Посылка заказа: доставка каждой оплачивается отдельно; трек CDEK вводит склад (adm10). */
export const parcels = pgTable('parcels', {
  id: serial().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  n: integer().notNull(),
  title: text().notNull(),
  state: text().notNull(),
  track: text(),
  /** Вес после взвешивания на складе в Китае, граммы (adm29). */
  weightG: integer('weight_g'),
  itemIds: integer('item_ids').array().notNull().default(sql`'{}'::int[]`),
  /** С какого момента посылка ждёт трека — для «давно ждёт» в очереди. */
  waitingSince: ts(),
  createdAt: now(),
}, (t) => [uniqueIndex('parcels_order_n').on(t.orderId, t.n)]);

/**
 * Платёж переводом: id «p-1041» за товары, «p-1042-1» за доставку посылки 1.
 * empty → (чек) → review после «Перевёл» → ok | fail. «Перевёл» не означает оплату: проверяет сотрудник.
 */
export const payments = pgTable('payments', {
  id: text().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  parcelId: integer('parcel_id').references(() => parcels.id),
  kind: text({ enum: ['goods', 'delivery'] }).notNull(),
  amount: integer().notNull(),
  state: text({ enum: ['empty', 'review', 'ok', 'fail'] }).notNull().default('empty'),
  receiptFileId: text('receipt_file_id'),
  sentAt: ts(),
  checkedAt: ts(),
  checkedBy: integer('checked_by'),
  failReason: integer('fail_reason'),
  failNote: text('fail_note'),
  sellerReceiptFileId: text('seller_receipt_file_id'),
  createdAt: now(),
}, (t) => [index('payments_state').on(t.state), check('amount_pos', sql`${t.amount} > 0`)]);

/** Черновики заказа по ссылке — в «Истории» и «Моих заказах» (B). */
export const linkDrafts = pgTable('link_drafts', {
  id: text().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  form: jsonb().notNull(),
  updatedAt: now(),
});

// ───────────────────────────── после покупки ─────────────────────────────

/** Фотоотчёт со склада (adm12 → V): минимум одно фото на вещь. */
export const photoReports = pgTable('photo_reports', {
  id: serial().primaryKey(),
  orderId: integer('order_id').notNull().unique().references(() => orders.id, { onDelete: 'cascade' }),
  place: text().notNull().default('склад в Китае'),
  note: text().notNull().default(''),
  /** [{ itemId, fileIds[] }] */
  items: jsonb().$type<{ itemId: number; fileIds: string[] }[]>().notNull().default([]),
  sentAt: ts(),
  sentBy: integer('sent_by'),
  createdAt: now(),
});

/**
 * Обращение по заказу (M → Y → Z). answer — решение продавца; возврат денег — только для заказов из наличия.
 */
export const claims = pgTable('claims', {
  id: serial().primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  reason: integer().notNull(),
  topic: text().notNull(),
  text: text().notNull(),
  fileIds: text('file_ids').array().notNull().default(sql`'{}'::text[]`),
  answer: text({ enum: ['ok', 'no', 'more'] }),
  answerText: text('answer_text'),
  refundSum: integer('refund_sum'),
  /** Реквизиты для возврата. Номер полностью нужен для перевода — доступ только у сотрудников с правом обращений. */
  refund: jsonb().$type<{ to: 'sbp' | 'card'; val: string; bank: string; state: 'sent' | 'done' } | null>(),
  closedAt: ts(),
  createdAt: now(),
}, (t) => [index('claims_order').on(t.orderId)]);

export const claimMessages = pgTable('claim_messages', {
  id: serial().primaryKey(),
  claimId: integer('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  from: text({ enum: ['buyer', 'admin'] }).notNull(),
  staffId: integer('staff_id'),
  text: text().notNull(),
  at: now(),
});

/** Отзыв о покупке (AB): публикуется только после модерации (adm20). */
export const reviews = pgTable('reviews', {
  id: serial().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
  orderId: integer('order_id').unique().references(() => orders.id),
  /** Подпись: имя и инициал или «Покупатель labeled». */
  signature: text().notNull(),
  stars: integer().notNull(),
  text: text().notNull(),
  about: text().notNull().default(''),
  fileIds: text('file_ids').array().notNull().default(sql`'{}'::text[]`),
  state: text({ enum: ['mod', 'pub', 'hid'] }).notNull().default('mod'),
  reply: text(),
  moderatedBy: integer('moderated_by'),
  createdAt: now(),
}, (t) => [check('stars_range', sql`${t.stars} between 1 and 5`)]);

// ───────────────────────────── баллы, события, журнал ─────────────────────────────

/** Движение баллов: списание в заказе, возврат при отмене, награда за друга, ручное начисление (adm19). */
export const pointsLedger = pgTable('points_ledger', {
  id: serial().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  delta: integer().notNull(),
  kind: text({ enum: ['order', 'refund', 'referral', 'manual'] }).notNull(),
  title: text().notNull(),
  orderId: integer('order_id'),
  /** Друг, за первый выполненный заказ которого начислена награда — один раз на друга. */
  friendId: bigint('friend_id', { mode: 'number' }),
  staffId: integer('staff_id'),
  at: now(),
}, (t) => [index('points_user').on(t.userId), uniqueIndex('points_referral_once').on(t.friendId).where(sql`kind = 'referral'`)]);

/** Событие покупателя (N) и уведомление бота. notifiedAt — когда бот отправил сообщение. */
export const events = pgTable('events', {
  id: serial().primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  kind: text({ enum: ['act', 'pay', 'ship', 'err', 'pts'] }).notNull(),
  /** Категория настроек уведомлений (AP): req | pay | ship | pts | promo. */
  channel: text().notNull(),
  title: text().notNull(),
  sub: text().notNull().default(''),
  act: text(),
  to: text().notNull(),
  readAt: ts(),
  notifiedAt: ts(),
  /** Письмо о событии отправлено или не нужно (почта не подтверждена, канал выключен). */
  mailedAt: ts(),
  at: now(),
}, (t) => [index('events_user').on(t.userId)]);

/** Журнал действий сотрудников (adm33): только добавление; правку и удаление свежих записей запрещает триггер (миграция 0003), старше 12 месяцев — удаляются. */
export const journal = pgTable('journal', {
  id: serial().primaryKey(),
  staffId: integer('staff_id').notNull(),
  action: text().notNull(),
  target: text().notNull().default(''),
  payload: jsonb(),
  at: now(),
}, (t) => [index('journal_at').on(t.at), index('journal_staff').on(t.staffId, t.at)]);

/** Настройки магазина: rates (курс, ступени, услуги), requisites, system (техработы, мин. версия), legal. */
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: now(),
});
