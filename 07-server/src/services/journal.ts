import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { LOG_KEEP_MONTHS, ROLES, SELLER_CANCEL, type LogEntry, type LogType, type Role } from '../../../06-app/src/admin/model';
import { plural, rub } from '../../../06-app/src/lib/format';
import { banners, categories, journal, orders, payments, products, staff, users } from '../db/schema';
import { avatarOf } from './avatars';
import type { Ctx, Tx } from './core';

// Журнал действий (adm33). Записи пишет logAction в каждом действии сотрудника; здесь — чтение для владельца
// и удаление записей старше 12 месяцев. Менять и удалять более свежие записи не даёт триггер базы (миграция 0003).

/** Тип каждого действия: по нему фильтр и иконка. Действие без типа в журнале попадает в «Заказы». */
const ACTION_TYPE: Record<string, LogType> = {
  'payment.confirm': 'pay', 'payment.fail': 'pay', 'payment.receipt': 'pay', 'payment.receipt_remove': 'pay',
  'parcel.bill': 'pay', 'order.refunded': 'pay', 'points.add': 'pay', 'points.sub': 'pay',
  'request.approve': 'req', 'request.change': 'req', 'request.reject': 'req',
  'order.stage': 'orders', 'order.cancel': 'orders', 'claim.reply': 'orders', 'claim.decide': 'orders', 'claim.close': 'orders', 'parcel.add': 'orders',
  'parcel.track': 'stock', 'parcel.split': 'stock', 'report.pics': 'stock', 'report.send': 'stock',
  'item.create': 'catalog', 'item.update': 'catalog', 'item.merge': 'catalog', 'item.delete': 'catalog', 'banner.show': 'catalog', 'banner.hide': 'catalog', 'banner.add': 'catalog', 'banner.save': 'catalog', 'banner.delete': 'catalog',
  'category.show': 'catalog', 'category.hide': 'catalog', 'category.add': 'catalog', 'category.photo': 'catalog', 'review.publish': 'catalog', 'review.hide': 'catalog', 'size.notify': 'catalog', 'size.reject': 'catalog',
  'settings.prices': 'prices',
  'staff.update': 'staff', 'staff.remove': 'staff', 'staff.invite': 'staff',
};

const keepFrom = () => sql`now() - make_interval(months => ${LOG_KEEP_MONTHS})`;

/** Удаляет записи старше 12 месяцев — единственное удаление, которое разрешает триггер. */
export async function purgeJournal(db: Tx) {
  await db.delete(journal).where(lt(journal.at, keepFrom()));
}

type Row = typeof journal.$inferSelect;
type P = Record<string, unknown>;
const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0);
const kg = (g: number) => (g / 1000).toFixed(1).replace('.', ',');
const cny = (x: number) => x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Журнал новыми сверху: последние 300 записей за 12 месяцев, с фильтром по сотруднику и типу действия. */
export async function listJournal(ctx: Ctx, f: { who?: number; type?: LogType }): Promise<LogEntry[]> {
  await purgeJournal(ctx.db);
  const actions = f.type ? Object.keys(ACTION_TYPE).filter((a) => ACTION_TYPE[a] === f.type) : null;
  const rows = await ctx.db.select().from(journal)
    .where(and(gte(journal.at, keepFrom()), f.who ? eq(journal.staffId, f.who) : undefined, actions ? inArray(journal.action, actions) : undefined))
    .orderBy(desc(journal.at), desc(journal.id)).limit(300);
  return describe(ctx.db, rows);
}

/** Текст, объект и экран каждой записи. Объекты подгружаются пачкой: имена вещей, баннеров, покупателей, сотрудников. */
async function describe(db: Tx, rows: Row[]): Promise<LogEntry[]> {
  const ids = (pre: string[]) => [...new Set(rows.filter((r) => pre.some((p) => r.action.startsWith(p))).map((r) => r.target).filter(Boolean))];
  const ints = (xs: string[]) => xs.map(Number).filter((n) => Number.isInteger(n));
  const staffIds = [...new Set([...rows.map((r) => r.staffId), ...ints(ids(['staff.update', 'staff.remove']))])];
  const [pays, items, bans, cats, buyers, people] = await Promise.all([
    ids(['payment.']).length ? db.select({ id: payments.id, kind: payments.kind, num: orders.num }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(inArray(payments.id, ids(['payment.']))) : [],
    ids(['item.']).length ? db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, ids(['item.']))) : [],
    ints(ids(['banner.'])).length ? db.select({ id: banners.id, title: banners.title }).from(banners).where(inArray(banners.id, ints(ids(['banner.'])))) : [],
    ids(['category.']).length ? db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, ids(['category.']))) : [],
    ints(ids(['points.'])).length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ints(ids(['points.'])))) : [],
    staffIds.length ? db.select({ id: staff.id, role: staff.role, name: users.name, photoUrl: users.photoUrl, avatarFileId: users.avatarFileId }).from(staff).innerJoin(users, eq(users.id, staff.userId)).where(inArray(staff.id, staffIds)) : [],
  ]);
  const person = (id: number) => people.find((x) => x.id === id);
  const first = (name: string) => name.split(' ')[0];

  return rows.map((r): LogEntry => {
    const p = (r.payload ?? {}) as P;
    const t = r.target;
    const order = (text: string, to = '/admin/order/' + t) => ({ text, obj: 'Заказ ' + t, to });
    const [pnum, pn] = t.split('/');
    let d: { text: string; obj: string; to?: string };
    switch (r.action) {
      case 'payment.confirm': case 'payment.fail': case 'payment.receipt': case 'payment.receipt_remove': {
        const pay = pays.find((x) => x.id === t);
        const what = pay?.kind === 'delivery' ? 'доставки' : 'товаров';
        const text = r.action === 'payment.confirm' ? `Подтверждена оплата ${what}${p.amount ? ' · ' + rub(num(p.amount)) : ''}`
          : r.action === 'payment.fail' ? `Отмечено: деньги за ${what === 'доставки' ? 'доставку' : 'товары'} не пришли`
          : r.action === 'payment.receipt' ? 'Приложен чек продавца' : 'Убран чек продавца';
        d = { text, obj: pay ? 'Заказ ' + pay.num : 'Оплата', to: '/admin/pay/' + t };
        break;
      }
      case 'request.approve': d = { text: 'Заявка одобрена', obj: 'Заявка ' + t, to: '/admin/req/' + t }; break;
      case 'request.change': d = { text: 'Изменена цена в заявке', obj: 'Заявка ' + t, to: '/admin/req/' + t }; break;
      case 'request.reject': d = { text: 'Отказ по заявке', obj: 'Заявка ' + t, to: '/admin/req/' + t }; break;
      case 'order.stage': d = order(`Сменён статус: «${String(p.label ?? '')}»${p.notify === false ? ' · без уведомления' : ''}`); break;
      case 'order.cancel': d = order(`Заказ отменён: ${SELLER_CANCEL[num(p.why)] ?? 'другая причина'}`); break;
      case 'order.refunded': d = order(`Оплата возвращена${p.sum ? ' · ' + rub(num(p.sum)) : ''}`); break;
      case 'parcel.add': d = order('Добавлена посылка'); break;
      case 'parcel.track': d = { ...order(`Добавлен трек CDEK · посылка ${pn}`, '/admin/order/' + pnum), obj: 'Заказ ' + pnum }; break;
      case 'parcel.bill': d = { ...order(`Счёт за доставку · посылка ${pn}${p.weightG ? ', ' + kg(num(p.weightG)) + ' кг' : ''} · ${rub(num(p.amount))}`, '/admin/order/' + pnum), obj: 'Заказ ' + pnum }; break;
      case 'parcel.split': { const n = num(p.parcels); d = order(`Заказ разбит на ${n} ${plural(n, 'посылку', 'посылки', 'посылок')}`); break; }
      case 'report.pics': d = order('Обновлены фото в фотоотчёте', '/admin/photo/' + t); break;
      case 'report.send': d = order('Отправлен фотоотчёт', '/admin/photo/' + t); break;
      case 'claim.reply': d = order('Ответ на обращение', '/admin/claim/' + t); break;
      case 'claim.decide': d = order(`Решение по обращению: ${p.answer === 'ok' ? 'возврат ' + rub(num(p.refundSum)) : p.answer === 'more' ? 'нужны фото' : 'отказ'}`, '/admin/claim/' + t); break;
      case 'claim.close': d = order('Обращение закрыто', '/admin/claim/' + t); break;
      case 'item.create': case 'item.update': {
        const it = items.find((x) => x.id === t);
        d = { text: r.action === 'item.create' ? 'Вещь добавлена в каталог' : 'Вещь изменена', obj: it?.name ?? 'Вещь удалена', to: it ? '/admin/item/' + t : undefined };
        break;
      }
      case 'item.merge': {
        const it = items.find((x) => x.id === t);
        d = { text: `Объединена с «${String(p.name ?? 'вещью')}»`, obj: it?.name ?? 'Вещь удалена', to: it ? '/admin/item/' + t : undefined };
        break;
      }
      case 'item.delete': d = { text: 'Вещь удалена из каталога', obj: String(p.name ?? 'Вещь') }; break;
      case 'banner.show': case 'banner.hide': case 'banner.add': case 'banner.save': case 'banner.delete': {
        const b = bans.find((x) => String(x.id) === t);
        const text = { 'banner.show': 'Баннер показан', 'banner.hide': 'Баннер скрыт', 'banner.add': 'Баннер добавлен', 'banner.save': 'Баннер изменён', 'banner.delete': 'Баннер удалён' }[r.action];
        d = { text, obj: b?.title ?? String(p.title ?? 'Баннер'), to: b ? '/admin/banner/' + t : '/admin/banners' };
        break;
      }
      case 'category.show': case 'category.hide': case 'category.add': case 'category.photo': {
        const c = cats.find((x) => x.id === t);
        d = { text: { 'category.add': 'Категория добавлена', 'category.show': 'Категория показана', 'category.hide': 'Категория скрыта', 'category.photo': 'Изменено фото категории' }[r.action], obj: c?.name ?? 'Категория', to: c ? '/admin/category/' + c.id : '/admin/banners' };
        break;
      }
      case 'review.publish': d = { text: 'Отзыв опубликован', obj: 'Отзывы', to: '/admin/reviews' }; break;
      case 'review.hide': d = { text: 'Отзыв скрыт', obj: 'Отзывы', to: '/admin/reviews' }; break;
      case 'size.notify': d = { text: 'Покупатель уведомлён о размере', obj: 'Заявки на размер', to: '/admin/sizes' }; break;
      case 'size.reject': d = { text: 'Заявка на размер отклонена', obj: 'Заявки на размер', to: '/admin/sizes' }; break;
      case 'points.add': case 'points.sub': {
        const u = buyers.find((x) => String(x.id) === t);
        const n = Math.abs(num(p.delta));
        d = { text: `${r.action === 'points.add' ? 'Начислено' : 'Списано'} ${n} ${plural(n, 'балл', 'балла', 'баллов')}${p.reason ? ': ' + String(p.reason) : ''}`, obj: u?.name ?? 'Покупатель', to: '/admin/buyer/' + t };
        break;
      }
      case 'settings.prices': {
        const prev = num(p.prevRate), next = num((p.rates as P | undefined)?.rate);
        d = { text: prev && next && prev !== next ? `Изменён курс ЦБ: ${cny(prev)} → ${cny(next)} ₽` : 'Изменены цены или реквизиты', obj: 'Курс и цены', to: '/admin/settings' };
        break;
      }
      case 'staff.update': case 'staff.remove': {
        const m = person(Number(t));
        const role = p.role ? ROLES[p.role as Role]?.label : '';
        d = { text: r.action === 'staff.update' ? `Изменены права${role ? ' · ' + role : ''}` : 'Доступ сотрудника убран', obj: m ? first(m.name) : 'Сотрудник', to: r.action === 'staff.update' ? '/admin/member/' + t : '/admin/staff' };
        break;
      }
      case 'staff.invite': d = { text: `Создано приглашение · ${ROLES[p.role as Role]?.label ?? 'сотрудник'}`, obj: 'Сотрудники', to: '/admin/staff' }; break;
      default: d = { text: r.action, obj: t || '—' };
    }
    const m = person(r.staffId);
    return { id: String(r.id), at: r.at.toISOString(), who: String(r.staffId), whoName: m?.name ?? 'Бывший сотрудник', whoPhoto: m ? avatarOf(m) : '', whoRole: (m?.role ?? 'manager') as Role, type: ACTION_TYPE[r.action] ?? 'orders', ...d };
  });
}
