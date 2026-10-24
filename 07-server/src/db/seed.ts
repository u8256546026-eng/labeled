// Демо-данные: каталог и категории — из моков приложения (06-app/src/mocks), покупатели, сотрудники,
// заказы 1038–1047 и отзывы — по сценариям Buyer v15 и Labeled Admin. Только для показа и разработки.
import { sql } from 'drizzle-orm';
import { CATEGORIES } from '../../../06-app/src/mocks/catalog';
import { PRODUCTS } from '../../../06-app/src/mocks/products';
import { IMG, U } from '../../../06-app/src/mocks/images';
import type { Db } from './client';
import {
  addresses, banners, categories, sizeRequests, claimMessages, claims, events, offers, orderHistory, journal, orderItems, orders, parcels, payments, photoReports, pointsLedger, products, reviews, staff, users,
} from './schema';

const day = 86400000;
const ago = (ms: number) => new Date(Date.now() - ms);
const RECEIPT = U('1554224155-8d04cb21cd6c', 500);
const HOODIE = U('1556821840-3a63f95609a7', 300);

export async function seedDemo(db: Db) {
  const n = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  if (Number(n[0].n) > 0) return false;

  await db.transaction(async (tx) => {
    // Каталог.
    await tx.insert(categories).values(CATEGORIES.map((c, i) => ({ id: c.id, name: c.name, img: c.img, sort: i })));
    await tx.insert(banners).values([
      { title: 'Заказать из-за границы', cta: 'Оформить заказ', target: 'link', sort: 0 },
      { title: '−50% на комиссию первого заказа', cta: 'Подробнее', target: 'email', sort: 1 },
      { title: '250 баллов за друга', cta: 'Пригласить друга', target: 'invite', sort: 2 },
    ]);
    const base = Date.now() - 60 * day;
    for (const p of PRODUCTS) {
      await tx.insert(products).values({
        id: p.id, name: p.name, brand: p.brand, categoryId: p.cat, description: p.description, sizeGrid: p.sizeGrid, colors: p.colors,
        preorder: p.preorder, sizeChart: p.sizeChart ?? null, preorderAllowed: Object.values(p.preorder).some((l) => l.length), pop: p.pop, createdAt: new Date(base + p.added * 3600_000),
      });
      if (p.offers.length) await tx.insert(offers).values(p.offers.map((o) => ({ id: o.id, productId: p.id, color: o.color, size: o.size, cond: o.cond, note: o.note, price: o.price, stock: o.stock, img: o.img })));
    }

    // Люди. Анна — демо-покупатель приложения (tg 1001), Иван — владелец (tg 2001).
    const U0 = { notif: { bot: true, req: true, pay: true, ship: true, pts: false, promo: false, mail: false }, consentAt: ago(200 * day) };
    const people = await tx.insert(users).values([
      { tgId: 1001, username: 'anna_smirnova', tgName: 'Анна Смирнова', name: 'Анна Смирнова', photoUrl: IMG.ava, points: 1240, createdAt: new Date('2026-03-10'), ...U0 },
      { tgId: 2002, username: 'igor_k', tgName: 'Игорь Котов', name: 'Игорь Котов', createdAt: ago(5 * day), ...U0 },
      { tgId: 2003, username: 'maria_leb', tgName: 'Мария Лебедева', name: 'Мария Лебедева', points: 410, email: 'maria@example.com', emailState: 'ok' as const, createdAt: new Date('2026-05-02'), ...U0 },
      { tgId: 2004, username: 'oleg_p', tgName: 'Олег Петров', name: 'Олег Петров', points: 300, createdAt: new Date('2026-06-11'), ...U0 },
      { tgId: 2005, username: 'd_sokolov', tgName: 'Дмитрий Соколов', name: 'Дмитрий Соколов', points: 820, createdAt: new Date('2026-04-01'), ...U0 },
      { tgId: 2006, username: 'elena_v', tgName: 'Елена Волкова', name: 'Елена Волкова', points: 2150, createdAt: new Date('2026-02-14'), ...U0 },
      { tgId: 2001, username: 'ivan_labeled', tgName: 'Иван Петров', name: 'Иван Петров', photoUrl: U('1500648767791-00dcc994a43e', 200), createdAt: new Date('2026-08-01'), ...U0 },
      { tgId: 2011, username: 'ksenia_lbd', tgName: 'Ксения', name: 'Ксения', createdAt: new Date('2026-08-05'), ...U0 },
      { tgId: 2012, username: 'artem_sklad', tgName: 'Артём', name: 'Артём', createdAt: new Date('2026-08-12'), ...U0 },
      { tgId: 2013, username: 'liza_content', tgName: 'Лиза', name: 'Лиза', createdAt: new Date('2026-08-20'), ...U0 },
    ]).returning();
    const id = (tg: number) => people.find((p) => p.tgId === tg)!.id;
    const [anna, igor, maria, oleg, dmitry, elena] = [1001, 2002, 2003, 2004, 2005, 2006].map(id);
    // Заявки на отсутствующий размер (adm31).
    await tx.insert(sizeRequests).values([
      { userId: oleg, productId: 'tee', color: 'Чёрный', size: 'XL', createdAt: ago(2 * 3600_000) },
      { userId: dmitry, productId: 'bomber', color: 'Кирпичный', size: 'XL', createdAt: ago(day) },
      { userId: elena, productId: 'chinos', color: 'Бежевый', size: '34', createdAt: ago(4 * day) },
    ]);
    await tx.insert(staff).values([
      { userId: id(2001), role: 'owner', createdAt: new Date('2026-08-01') }, { userId: id(2011), role: 'manager', createdAt: new Date('2026-08-05') },
      { userId: id(2012), role: 'stock', createdAt: new Date('2026-08-12') }, { userId: id(2013), role: 'content', createdAt: new Date('2026-08-20') },
    ]);
    await tx.insert(addresses).values([
      { userId: anna, name: 'Анна Смирнова', phone: '+7 921 000-00-00', city: 'Санкт-Петербург', line: 'пр. Энгельса, 27, кв. 14', isMain: true },
      { userId: anna, name: 'Анна Смирнова', phone: '+7 921 000-00-00', city: 'Москва', line: 'ул. Правды, 8, офис 3' },
      { userId: maria, name: 'Мария Лебедева', phone: '+7 905 111-22-33', city: 'Москва', line: 'ул. Лесная, 5, кв. 2', isMain: true },
    ]);
    await tx.insert(pointsLedger).values([
      { userId: anna, delta: 1240, kind: 'referral', title: 'Друг выполнил первый заказ', friendId: elena, at: new Date('2026-08-12') },
      { userId: maria, delta: 410, kind: 'manual', title: 'Перенос баланса', at: new Date('2026-05-02') },
      { userId: oleg, delta: 300, kind: 'manual', title: 'Перенос баланса', at: new Date('2026-06-11') },
      { userId: dmitry, delta: 820, kind: 'manual', title: 'Перенос баланса', at: new Date('2026-04-01') },
      { userId: elena, delta: 2150, kind: 'manual', title: 'Перенос баланса', at: new Date('2026-02-14') },
    ]);

    // Заказы. Номера заняты до 1047 — последовательность начинается с 1048.
    const order = async (o: typeof orders.$inferInsert, items: Omit<typeof orderItems.$inferInsert, 'orderId'>[], hist: [string, Date][]) => {
      const [row] = await tx.insert(orders).values(o).returning();
      const its = await tx.insert(orderItems).values(items.map((i) => ({ ...i, orderId: row.id }))).returning();
      await tx.insert(orderHistory).values(hist.map(([label, at]) => ({ orderId: row.id, label, at })));
      return { row, its };
    };
    const tee = (cond: 'новое' | 'как новое', price: number) => ({ offerId: null, name: 'Футболка с принтом', params: 'Чёрный / M', img: IMG.teeBlackS, cond, price, qty: 1 });

    const o1045 = await order({ num: '1045', userId: anna, kind: 'stock', title: 'Футболка с принтом и ещё 1', phase: 'invoiced', goods: 9800, total: 9800, createdAt: ago(31 * day) }, [tee('новое', 3990), { name: 'Джинсы прямые', params: 'Синий / M', img: U('1542272604-787c3835535d', 200), cond: 'новое', price: 5810, qty: 1 }], [['Оформлен — ждёт оплаты', ago(31 * day)], ['Оплата на проверке', ago(31 * day)]]);
    await tx.insert(payments).values({ id: 'p-1045', orderId: o1045.row.id, kind: 'goods', amount: 9800, state: 'fail', receiptFileId: RECEIPT, sentAt: ago(31 * day), checkedAt: ago(30 * day), failReason: 0 });

    const o1044 = await order({ num: '1044', userId: oleg, kind: 'stock', title: 'Бомбер на молнии', phase: 'invoiced', goods: 8990, total: 8990, createdAt: ago(17 * day) }, [{ name: 'Бомбер на молнии', params: 'Кирпичный / M', img: IMG.bomberS, cond: 'новое', price: 8990, qty: 1 }], [['Оформлен — ждёт оплаты', ago(17 * day)]]);
    await tx.insert(payments).values({ id: 'p-1044', orderId: o1044.row.id, kind: 'goods', amount: 8990 });

    await order({ num: '1043', userId: igor, kind: 'link', title: 'Кроссовки и худи', phase: 'review', goods: 18591, commission: 1600, services: 400, protection: 186, total: 20777, protect: true, createdAt: ago(40 * 60000) }, [
      { name: 'Nike Air Force 1 ’07', plat: 'Poizon', url: 'dw4.co/t/A/1sKq9X', size: '42', qty: 1, priceCny: 899, photo: true, box: true, picFileId: IMG.sneakS },
      { name: 'Худи Essentials', plat: 'Poizon', url: 'dw4.co/t/A/1sKr2M', size: 'L', qty: 1, priceCny: 520, picFileId: HOODIE },
      { name: 'Носки, 3 пары', plat: 'Taobao', url: 'item.taobao.com/item.htm?id=726410', size: 'One size', qty: 2, priceCny: 45 },
    ], [['Ждёт подтверждения', ago(40 * 60000)]]);

    const o1042 = await order({ num: '1042', userId: anna, kind: 'link', title: 'Базовый гардероб', phase: 'active', stage: 4, goods: 16870, commission: 1500, total: 16870, createdAt: ago(32 * day) }, [
      { name: 'Кроссовки', plat: 'Poizon', url: 'dw4.co/t/A/1sK001', size: '42', qty: 1, priceCny: 899, picFileId: IMG.sneakS, photo: true },
      { name: 'Худи', plat: 'Poizon', url: 'dw4.co/t/A/1sK002', size: 'L', qty: 1, priceCny: 520, picFileId: HOODIE },
    ], [['Заявка одобрена', ago(28 * day)], ['Товары оплачены', ago(28 * day)], ['Выкуплено продавцом', ago(26 * day)], ['На складе в Китае', ago(23 * day)], ['Отправлено в Россию', ago(2 * day)]]);
    await tx.insert(payments).values({ id: 'p-1042', orderId: o1042.row.id, kind: 'goods', amount: 16870, state: 'ok', sentAt: ago(28 * day), checkedAt: ago(28 * day) });
    const [p1, p2] = await tx.insert(parcels).values([
      { orderId: o1042.row.id, n: 1, title: 'Посылка 1 · кроссовки', state: 'Передано в CDEK', track: '10234567890', itemIds: [o1042.its[0].id] },
      { orderId: o1042.row.id, n: 2, title: 'Посылка 2 · худи', state: 'На складе в России', itemIds: [o1042.its[1].id], waitingSince: ago(day + 3600_000) },
    ]).returning();
    await tx.insert(payments).values([
      { id: 'p-1042-1', orderId: o1042.row.id, parcelId: p1.id, kind: 'delivery', amount: 1850, state: 'review', sentAt: ago(3 * 3600_000) },
      { id: 'p-1042-2', orderId: o1042.row.id, parcelId: p2.id, kind: 'delivery', amount: 1200, state: 'ok', sentAt: ago(30 * day), checkedAt: ago(30 * day) },
    ]);

    const o1041 = await order({ num: '1041', userId: anna, kind: 'stock', title: 'Джемпер крупной вязки и ещё 2', phase: 'invoiced', goods: 14380, total: 14380, createdAt: ago(30 * day) }, [
      { name: 'Джемпер крупной вязки', params: 'Молочный / S', img: IMG.knitS, cond: 'чуть уставшее', price: 8900, qty: 1 }, tee('как новое', 3690), { name: 'Кепка', params: 'Серый', img: IMG.receipt, cond: 'новое', price: 1790, qty: 1 },
    ], [['Оформлен — ждёт оплаты', ago(30 * day)], ['Оплата на проверке', ago(12 * 60000)]]);
    await tx.insert(payments).values({ id: 'p-1041', orderId: o1041.row.id, kind: 'goods', amount: 14380, state: 'review', receiptFileId: RECEIPT, sentAt: ago(12 * 60000) });

    const o1040 = await order({ num: '1040', userId: dmitry, kind: 'link', title: 'Кроссовки и свитшот', phase: 'active', stage: 3, goods: 12400, total: 12400, createdAt: ago(16 * day) }, [
      { name: 'Nike Dunk Low', plat: 'Poizon', url: 'dw4.co/t/A/1sD001', size: '43', qty: 1, priceCny: 760, photo: true, picFileId: IMG.sneakS },
      { name: 'Свитшот с вышивкой', plat: 'Taobao', url: 'item.taobao.com/item.htm?id=1', size: 'M', qty: 1, priceCny: 230, photo: true },
    ], [['Заявка одобрена', ago(16 * day)], ['Товары оплачены', ago(16 * day)], ['Выкуплено продавцом', ago(12 * day)], ['На складе в Китае', ago(5 * 3600_000)]]);
    await tx.insert(payments).values({ id: 'p-1040', orderId: o1040.row.id, kind: 'goods', amount: 12400, state: 'ok', sentAt: ago(16 * day), checkedAt: ago(16 * day) });
    await tx.insert(photoReports).values({ orderId: o1040.row.id, items: [{ itemId: o1040.its[0].id, fileIds: [IMG.sneakS, IMG.sneakS] }, { itemId: o1040.its[1].id, fileIds: [] }], createdAt: ago(5 * 3600_000) });

    const o1039 = await order({ num: '1039', userId: elena, kind: 'stock', title: 'Рюкзак городской', phase: 'done', stage: 3, goods: 5990, total: 5990, createdAt: ago(26 * day), receivedAt: ago(20 * day) }, [{ name: 'Рюкзак городской', params: 'Синий', img: IMG.bagS, cond: 'новое', price: 5990, qty: 1 }], [['Оформлен', ago(26 * day)], ['Оплата подтверждена', ago(26 * day)], ['Передано в CDEK', ago(25 * day)], ['Получен', ago(20 * day)]]);
    await tx.insert(payments).values({ id: 'p-1039', orderId: o1039.row.id, kind: 'goods', amount: 5990, state: 'ok', sentAt: ago(26 * day), checkedAt: ago(26 * day) });
    await tx.insert(parcels).values({ orderId: o1039.row.id, n: 1, title: 'Посылка', state: 'Выдано покупателю', track: '10555222111' });

    const o1038 = await order({ num: '1038', userId: maria, kind: 'stock', title: 'Брюки чинос', phase: 'active', stage: 2, goods: 4990, total: 4990, createdAt: ago(35 * day) }, [{ name: 'Брюки чинос', params: 'Бежевый / 32', img: IMG.chinosS, cond: 'новое', price: 4990, qty: 1 }], [['Оформлен', ago(35 * day)], ['Оплата подтверждена', ago(35 * day)], ['Передано в CDEK', ago(5 * day)]]);
    await tx.insert(payments).values({ id: 'p-1038', orderId: o1038.row.id, kind: 'goods', amount: 4990, state: 'ok', sentAt: ago(35 * day), checkedAt: ago(35 * day), sellerReceiptFileId: IMG.receipt });
    await tx.insert(parcels).values({ orderId: o1038.row.id, n: 1, title: 'Посылка', state: 'Передано в CDEK', track: '10987654321' });
    const [cl] = await tx.insert(claims).values({ orderId: o1038.row.id, userId: maria, reason: 3, topic: 'Трек не обновляется', text: 'Здравствуйте! Трек по заказу 1038 не обновляется уже четыре дня. Посылка не потерялась?', createdAt: ago(18 * 3600_000) }).returning();
    await tx.insert(claimMessages).values({ claimId: cl.id, from: 'buyer', text: cl.text, at: cl.createdAt });

    await order({ num: '1047', userId: anna, kind: 'link', title: 'Летние кеды', phase: 'changed', goods: 2587, commission: 300, services: 200, total: 3087, changeComment: 'Кеды размера 42 закончились — позиция убрана. Цена худи на Taobao выросла со 180 до 210 ¥', createdAt: ago(15 * day) }, [
      { name: 'Poizon · кеды', plat: 'Poizon', url: 'dw4.co/t/A/1sK777', size: '42', qty: 1, priceCny: 560, picFileId: IMG.sneakS, removed: true },
      { name: 'Taobao · худи', plat: 'Taobao', url: 'item.taobao.com/item.htm?id=2', size: 'L', qty: 1, priceCny: 210, oldPriceCny: 180, picFileId: IMG.knitS, photo: true },
    ], [['Ждёт подтверждения', ago(15 * day)], ['Продавец изменил заявку', ago(15 * day)]]);

    await tx.insert(reviews).values([
      { userId: anna, signature: 'Анна С.', stars: 5, text: 'Заказывала кроссовки с Poizon, пришли за 19 дней. Фотоотчёт со склада очень выручил.', about: 'Заказ 1036 · по ссылке', state: 'mod', createdAt: ago(day) },
      { userId: oleg, signature: 'Олег П.', stars: 4, text: 'Бомбер как на фото. Доставка CDEK заняла на два дня дольше, чем писали.', about: 'Бомбер на молнии', state: 'mod', createdAt: ago(day) },
      { userId: elena, orderId: o1039.row.id, signature: 'Елена В.', stars: 5, text: 'Рюкзак в идеальном состоянии, упаковали аккуратно.', about: 'Заказ 1039 · из наличия', state: 'pub', createdAt: ago(4 * day) },
      { signature: 'Без имени', stars: 1, text: 'Реклама другого магазина со ссылкой.', about: 'Без заказа', state: 'hid', createdAt: ago(6 * day) },
    ]);

    await tx.insert(events).values([
      { userId: anna, kind: 'act', channel: 'req', title: 'Продавец изменил заявку 1047', sub: 'Кеды убраны, цена худи выросла. Без вашего согласия заказ не оформится.', act: 'Посмотреть изменения', to: '/order/1047', at: ago(2 * 3600_000), notifiedAt: new Date() },
      { userId: anna, kind: 'pay', channel: 'pay', title: 'Доставка по заказу 1042', sub: 'Посылка 1 на складе в Китае · 1 850 ₽ ждёт оплаты', to: '/order/1042', at: ago(16 * day), notifiedAt: new Date() },
      { userId: anna, kind: 'err', channel: 'pay', title: 'Оплата заказа 1045 не подтверждена', sub: 'Продавец указал причину', to: '/order/1045', at: ago(30 * day), notifiedAt: new Date() },
    ]);

    // Журнал действий (adm33): staff 1 — Иван (владелец), 2 — Ксения, 3 — Артём (склад), 4 — Лиза (контент).
    const [rv] = await tx.select({ id: reviews.id }).from(reviews).where(sql`${reviews.state} = 'pub'`).limit(1);
    await tx.insert(journal).values([
      { staffId: 3, action: 'order.stage', target: '1040', payload: { stage: 3, label: 'На складе в Китае', notify: true }, at: ago(5 * 3600_000) },
      { staffId: 3, action: 'report.pics', target: '1040', payload: { itemIndex: 0, n: 2 }, at: ago(5 * 3600_000 - 600_000) },
      { staffId: 1, action: 'settings.prices', payload: { rates: { rate: 11.62 }, prevRate: 11.48 }, at: ago(4 * 3600_000) },
      { staffId: 4, action: 'item.update', target: 'tee', at: ago(2 * 3600_000) },
      { staffId: 3, action: 'parcel.track', target: '1042/1', payload: { track: '10234567890' }, at: ago(day + 2 * 3600_000) },
      { staffId: 1, action: 'staff.invite', target: 'demo', payload: { role: 'content' }, at: ago(day + 5 * 3600_000) },
      { staffId: 4, action: 'review.publish', target: String(rv.id), at: ago(day + 6 * 3600_000) },
      { staffId: 2, action: 'payment.confirm', target: 'p-1040', payload: { amount: 12400 }, at: ago(16 * day) },
    ]);
  });
  return true;
}
