import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
// Сквозная проверка приложения с сервером 07-server (режим VITE_API_URL): покупатель и админка в браузере,
// результат каждого действия — на другой стороне. Нужны: сервер с демо-данными (SEED_DEMO=1, свежая база)
// и `VITE_API_URL=<сервер> npx vite --port 5174`. Запуск: BASE=http://127.0.0.1:5174/ node scripts/check-live.mjs
const B = process.env.BASE || 'http://127.0.0.1:5174/';
const API = process.env.API || 'http://localhost:8787';
const SHOTS = fileURLToPath(new URL('../reports/email-confirm-2026-10-20/', import.meta.url));
const SHOTS_DESIGN = fileURLToPath(new URL('../reports/email-design-2026-10-22/', import.meta.url));
const SHOTS_COLORS = fileURLToPath(new URL('../reports/colors-2026-10-22/', import.meta.url));
const PNG = { name: 'check.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex') };
const b = await chromium.launch();
const errs = [];
const res = [];
const ok = (name, cond) => res.push((cond ? 'OK  ' : 'FAIL') + ' ' + name);
async function page(q) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(q + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(q + ': ' + e.message));
  await p.goto(B + q); await p.waitForTimeout(1500);
  return p;
}
const btn = (p, t) => p.getByRole('button', { name: t, exact: true }).first();
const has = async (p, t) => (await p.getByText(t, { exact: false }).count()) > 0;
const wait = (p, ms = 700) => p.waitForTimeout(ms);
const step = async (name, fn) => { try { await fn(); } catch (e) { res.push('FAIL ' + name + ': ' + e.message.split('\n')[0]); } };
const api = (path, tg = 1001) => fetch(API + path, { headers: { 'x-dev-user': String(tg) } }).then((r) => r.json());

let num = '';
await step('покупатель: данные с сервера', async () => {
  const p = await page('?path=/profile');
  ok('профиль: баллы с сервера (1 240)', await has(p, '1 240'));
  const o = await page('?path=/orders');
  ok('мои заказы с сервера: 1047 и 1042', await has(o, 'Заявка 1047') && await has(o, 'Заказ 1042'));
  const c = await page('');
  ok('каталог с сервера', (await c.getByRole('button', { name: /Футболка с принтом/ }).count()) > 0);
});

await step('заказ из наличия → оплата → подтверждение продавцом', async () => {
  const p = await page('?path=/product/bomber');
  await p.getByRole('radiogroup', { name: 'Размер' }).getByRole('radio', { name: 'M', exact: true }).click();
  await wait(p, 300);
  await btn(p, 'Заказать').click(); await wait(p, 1500);
  ok('A: проверка заказа сервером', await has(p, 'Проверка заказа'));
  ok('X: без пункта выдачи оформить нельзя — кнопка ведёт к выбору', (await btn(p, 'Подтвердить заказ').count()) === 0 && await btn(p, 'Выбрать получение').isVisible());
  await p.getByRole('button', { name: /Способ получения/ }).click(); await wait(p, 500);
  await p.getByLabel('Адрес или код пункта CDEK').fill('Москва, Тверская, 15'); await wait(p, 200);
  await btn(p, 'Выбрать').click(); await wait(p, 600);
  ok('X: пункт выдачи в проверке заказа', await has(p, 'Пункт выдачи CDEK · Москва, Тверская, 15'));
  const before = (await api('/api/orders')).length;
  await btn(p, 'Подтвердить заказ').dblclick(); await wait(p, 1500);
  ok('двойное нажатие «Подтвердить заказ» — один заказ', (await api('/api/orders')).length === before + 1);
  ok('C: платёж открыт', await has(p, 'Оплата переводом'));
  num = (await p.locator('text=/Заказ \\d{4}/').first().innerText()).match(/\d{4}/)?.[0] ?? '';
  await p.locator('input[type=file]').first().setInputFiles(PNG); await wait(p, 1200);
  await btn(p, 'Перевёл').click(); await wait(p, 1500);
  ok('K: заказ оформлен', await has(p, 'оформлен'));
  const adm = await api('/api/admin/orders/' + num, 2001);
  ok('adm: продавец видит пункт выдачи и получателя', adm.ship?.how === 'Пункт выдачи CDEK · Москва, Тверская, 15' && !!adm.ship?.who && !!adm.ship?.phone);
  const pays = await api('/api/payments');
  ok('сервер: платёж на проверке с чеком', pays.some((x) => x.orderNum === num && x.state === 'review' && x.receipt));
  const a = await page('?staff=owner&path=/admin');
  ok('adm02: задача на оплату нового заказа', await has(a, 'Оплата товаров · заказ ' + num));
  await a.getByText('Оплата товаров · заказ ' + num).click(); await wait(a, 1200);
  await btn(a, 'Подтвердить оплату').click(); await wait(a, 1500);
  ok('adm04: подтверждена', await has(a, 'Оплата подтверждена'));
  const o = await page('?path=/order/' + num);
  ok('покупатель видит «Оплата подтверждена»', await has(o, 'Оплата подтверждена'));
});

await step('доставка → «получил» → отзыв → публикация', async () => {
  const a = await page('?staff=manager&path=/admin/order/' + num);
  await btn(a, 'Сменить статус').click(); await wait(a, 500);
  await a.getByRole('radio', { name: /^Доставлен/ }).click();
  await a.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click(); await wait(a, 1500);
  ok('adm11: статус изменён', await has(a, 'Статус изменён'));
  const o = await page('?path=/order/' + num);
  await btn(o, 'Всё в порядке, получил').click(); await wait(o, 1500);
  await o.getByRole('radio', { name: '5 из 5' }).click(); await wait(o, 1200);
  await o.getByLabel('Текст отзыва').fill('Бомбер как на фото, проверка с сервером');
  await btn(o, 'Отправить отзыв').click(); await wait(o, 1500);
  ok('AB: отзыв на модерации', await has(o, 'Отзыв на модерации'));
  const r = await page('?staff=content&path=/admin/reviews');
  const card = r.locator('div').filter({ hasText: 'проверка с сервером' }).filter({ has: r.getByRole('button', { name: 'Опубликовать' }) }).last();
  await card.getByRole('button', { name: 'Опубликовать' }).click(); await wait(r, 1200);
  const pub = await fetch(API + '/api/reviews').then((x) => x.json());
  ok('AC: опубликованный отзыв виден всем', pub.items.some((x) => x.text.includes('проверка с сервером')));
});

await step('обращение с фото → ответ продавца', async () => {
  const p = await page('?path=/claim/' + num);
  await p.getByRole('radio', { name: /^Брак/ }).click();
  await p.getByLabel('Опишите проблему').fill('Шов разошёлся');
  await p.locator('input[type=file]').first().setInputFiles([PNG]); await wait(p, 400);
  await btn(p, 'Отправить обращение').click(); await wait(p, 1500);
  ok('M: обращение отправлено', await has(p, 'отправлено'));
  const a = await page('?staff=owner&path=/admin/claim/' + num);
  ok('adm13: обращение у продавца', await has(a, 'Шов разошёлся'));
  await a.getByLabel('Ответ', { exact: true }).fill('Пришлите фото бирки, пожалуйста');
  await btn(a, 'Отправить ответ').click(); await wait(a, 1200);
  ok('adm13: ответ в переписке', await has(a, 'Пришлите фото бирки'));
});

await step('адрес, заявка на размер, черновик', async () => {
  const p = await page('?path=/addresses/new');
  await btn(p, 'Подставить номер из Telegram').click(); await wait(p, 500);
  const allow = p.getByRole('button', { name: 'Разрешить' });
  if (await allow.count()) { await allow.first().click(); await wait(p, 500); }
  await p.getByLabel(/Город/).fill('Казань');
  await p.getByLabel(/Адрес получения/).fill('ул. Баумана, 1');
  await btn(p, 'Сохранить адрес').click(); await wait(p, 1200);
  ok('AR: адрес на сервере', (await api('/api/addresses')).some((x) => x.city === 'Казань'));
  const q = await page('?path=/product/tee');
  await q.getByRole('radiogroup', { name: 'Размер' }).getByRole('radio', { name: /^XL(,|$)/ }).click(); await wait(q, 300);
  await btn(q, 'Под заказ').click(); await wait(q, 500);
  await btn(q, 'Отправить заявку').click(); await wait(q, 1200);
  ok('7q: заявка на размер на сервере', (await api('/api/orders')).some((x) => x.sizeRequest && x.sub.includes('XL')));
  const l = await page('?path=/link');
  await l.getByLabel('Название заказа').fill('Черновик 1');
  await l.getByRole('button', { name: /В черновик/ }).first().click(); await wait(l, 1000);
  ok('черновик на сервере', (await api('/api/link/drafts')).some((d) => d.form.title === 'Черновик 1'));
});

await step('заказ по ссылке → одобрение → счёт', async () => {
  const p = await page('?path=/link');
  await p.getByLabel('Название заказа').fill('Проверка');
  await p.getByRole('button', { name: /Добавить ещё один товар|Добавить товар/ }).first().click(); await wait(p, 600);
  await p.getByLabel('Ссылка на товар').fill('https://item.taobao.com/item.htm?id=72');
  await p.getByLabel('Размер').fill('M').catch(() => {});
  await p.getByLabel('Цена одной штуки, ¥').fill('180');
  await btn(p, 'Добавить товар').click(); await wait(p, 800);
  await btn(p, 'Отправить на проверку').click(); await wait(p, 1800);
  ok('AX: заявка отправлена', await has(p, 'Заявка отправлена'));
  const orders = await api('/api/orders');
  const req = orders.find((o) => o.name === 'Проверка');
  ok('сервер: заявка «Проверка» ждёт подтверждения', !!req && req.status === 'Ждёт подтверждения');
  const a = await page('?staff=owner&path=/admin/req/' + req.num);
  await btn(a, 'Одобрить и выставить счёт').click(); await wait(a, 1500);
  ok('adm06: одобрена', await has(a, 'Заявка одобрена'));
  const o = await page('?path=/order/' + req.num);
  ok('покупатель: «Оформлен — ждёт оплаты» и кнопка оплаты', await has(o, 'Оформлен — ждёт оплаты') && await has(o, 'Оплатить товары'));
});

await step('J: согласие с изменённой заявкой → счёт', async () => {
  const p = await page('?path=/order/1047');
  await p.getByRole('button', { name: /^Согласиться/ }).click(); await wait(p, 1800);
  ok('открыт платёж p-1047', await has(p, 'Оплата переводом'));
  ok('сервер: заявка 1047 со счётом', (await api('/api/payments')).some((x) => x.id === 'p-1047'));
});

await step('избранное и уведомления сохраняются на сервере', async () => {
  const p = await page('?path=/product/chinos');
  await p.getByRole('button', { name: /избранное/i }).first().click(); await wait(p, 800);
  ok('сервер: брюки в избранном', (await api('/api/favorites')).some((f) => f.id === 'chinos'));
  const n = await page('?path=/notif');
  ok('AP: без разрешения боту категории выключены', await n.getByRole('switch', { name: /Баллы и приглашения/ }).getAttribute('aria-disabled') === 'true');
  await n.getByRole('switch', { name: /Сообщения от бота/ }).click(); await wait(n, 800);
  await n.getByRole('switch', { name: /Баллы и приглашения/ }).click(); await wait(n, 800);
  const me = (await api('/api/me')).user;
  ok('сервер: бот разрешён, уведомления о баллах включены', me.botAllowed === true && me.notif.pts === true);
  const n2 = await page('?path=/notif');
  ok('после перезапуска переключатель включён', await n2.getByRole('switch', { name: /Баллы и приглашения/ }).getAttribute('aria-checked') === 'true');
});

await step('админ: курс → расчёт покупателя; фотоотчёт с загрузкой', async () => {
  const a = await page('?staff=owner&path=/admin/settings');
  await a.getByLabel('Вещь до 1\u00a0000 ¥ включительно').fill('0,90'); await wait(a, 200);
  await btn(a, 'Сохранить изменения').click(); await wait(a, 1200);
  ok('adm21: сохранено', await has(a, 'Сохранено'));
  ok('сервер: надбавка 0,90', (await fetch(API + '/api/rates').then((r) => r.json())).markup[0].value === 0.9);
  const ph = await page('?staff=stock&path=/admin/photo/1040');
  await ph.locator('input[type=file]').nth(1).setInputFiles(PNG); await wait(ph, 1500);
  ok('adm12: фото загружено (1 из 3)', await has(ph, '1 из 3'));
  await btn(ph, 'Отправить фотоотчёт').click(); await wait(ph, 1500);
  ok('adm12: отправлен', await has(ph, 'Фотоотчёт отправлен'));
});

await step('adm33–34 с сервером', async () => {
  const p = await page('?staff=stock&path=/admin/order/1040');
  await btn(p, 'Разбить на посылки').click(); await wait(p);
  await btn(p, 'Добавить посылку').click(); await wait(p, 200);
  ok('adm34: пустую не сохранить', await btn(p, 'Заполните все посылки').isDisabled());
  await p.getByRole('radiogroup', { name: 'Посылка для: Свитшот с вышивкой' }).getByRole('radio', { name: 'Посылка 2' }).click(); await wait(p, 200);
  await btn(p, 'Сохранить · 2 посылки').click(); await wait(p, 1500);
  ok('adm34: сохранено на сервере', await btn(p, 'Посылки: 2 · изменить').isVisible() && (await api('/api/admin/orders/1040', 2001)).parcels.length === 2);
  ok('adm34: покупатель видит 2 посылки', (await api('/api/orders/1040', 2005)).parcels?.map((x) => x.title).join() === 'Посылка 1 из 2,Посылка 2 из 2');

  const j = await page('?staff=owner&path=/admin/log');
  ok('adm33: журнал с сервера', await has(j, 'Все действия сотрудников, хранится 12 месяцев') && /Заказ разбит на 2 посылки/.test(await j.locator('button.press-row').first().innerText()));
  await j.getByRole('group', { name: 'Сотрудник' }).getByRole('button', { name: 'Ксения' }).click(); await wait(j, 1000);
  ok('adm33: фильтр по сотруднику — на сервере', await has(j, 'Подтверждена оплата товаров') && !(await has(j, 'Заказ разбит')));
  await j.getByRole('group', { name: 'Сотрудник' }).getByRole('button', { name: 'Все' }).click(); await wait(j, 1000);
  await j.getByText('Заказ разбит на 2 посылки').click(); await wait(j, 1200);
  ok('adm33: строка открывает заказ', await has(j, 'Посылки: 2 · изменить'));
  ok('adm33: менеджеру закрыт', (await api('/api/admin/journal', 2011)).error === 'no_permission');
});

await step('adm28–adm32 с сервером', async () => {
  const a = await page('?staff=owner&path=/admin/claim/' + num);
  await btn(a, 'Принять решение').click(); await wait(a, 400);
  const d = a.getByRole('dialog');
  const paid = Number(await d.getByLabel('Сумма возврата').inputValue());
  await d.getByLabel('Сумма возврата').fill(String(paid + 1));
  ok('adm28: больше оплаченного — нельзя', await btn(a, 'Больше суммы заказа').isDisabled());
  await d.getByLabel('Сумма возврата').fill(String(paid));
  await d.getByRole('button', { name: /^Вернуть / }).click(); await wait(a, 1200);
  ok('adm28: решение сохранено', await has(a, 'Решение: возврат'));
  const z = await page('?path=/claim/' + num);
  ok('Y: покупателю открыт возврат', await has(z, 'Указать реквизиты для возврата'));

  const o = await page('?staff=manager&path=/admin/order/1040');
  await btn(o, 'Выставить счёт за доставку · посылка 1').click(); await wait(o, 400);
  await o.getByRole('dialog').getByLabel('Вес посылки').fill('1,4');
  await o.getByRole('dialog').getByLabel('Сумма к оплате').fill('2310');
  await o.getByRole('dialog').getByRole('button', { name: /^Выставить / }).click(); await wait(o, 1200);
  ok('adm29: счёт выставлен', await has(o, 'Счёт за доставку посылки 1 выставлен'));
  ok('adm29: платёж у покупателя', (await api('/api/payments', 2005)).some((x) => x.id === 'p-1040-1'));

  const c = await page('?staff=owner&path=/admin/order/1038');
  await btn(c, 'Отменить заказ').click(); await wait(c, 400);
  await c.getByRole('dialog').getByRole('button', { name: 'Отменить заказ' }).click(); await wait(c, 1200);
  ok('adm30: отменён, вернуть оплату', await has(c, 'Заказ отменён продавцом') && await has(c, 'Вернуть оплату'));
  ok('adm30: покупатель видит причину', (await api('/api/orders/1038', 2003)).stopped?.label === 'Заказ отменён продавцом');
  ok('adm30: задача на возврат', (await api('/api/admin/tasks', 2001)).some((t) => t.kind === 'refund'));
  await btn(c, 'Деньги возвращены').click(); await wait(c, 1200);
  ok('adm30: возврат отмечен', await has(c, 'Оплата возвращена'));

  const s = await page('?staff=content&path=/admin/sizes');
  await s.locator('button', { hasText: 'Анна Смирнова' }).first().click(); await wait(s, 400);
  await btn(s, 'Размер есть — уведомить').click(); await wait(s, 1200);
  ok('adm31: уведомлён', await has(s, 'Уведомлён: размер есть'));
  ok('adm31: у покупателя «Есть предложение»', (await api('/api/orders')).some((x) => x.sizeRequest && x.status === 'Есть предложение'));

  const bn = await page('?staff=content&path=/admin/banner/new');
  await bn.locator('input[type=file]').first().setInputFiles(PNG); await wait(bn, 1200);
  await bn.getByLabel('Заголовок').fill('Новая коллекция');
  await bn.getByLabel('Текст кнопки').fill('Смотреть');
  await bn.getByRole('radio', { name: 'Категория каталога' }).click();
  await bn.getByText('Весь каталог').click(); await wait(bn, 400);
  await bn.getByRole('dialog').getByRole('radio', { name: 'Футболки' }).click(); await wait(bn, 300);
  await btn(bn, 'Сохранить').click(); await wait(bn, 1500);
  const pub = (await fetch(API + '/api/showcase').then((r) => r.json())).banners;
  ok('adm32: баннер на сервере', pub.some((x) => x.title === 'Новая коллекция' && x.cat === 'tee' && x.img));
  const home = await page('');
  ok('7a: баннер с картинкой на главной', await has(home, 'Новая коллекция'));
});

await step('живое обновление: открытый экран меняется без перезагрузки', async () => {
  const post = (path, tg, body = {}) => fetch(API + path, { method: 'POST', headers: { 'x-dev-user': String(tg), 'content-type': 'application/json' }, body: JSON.stringify(body) });
  // Покупатель держит открытым заказ 1042 — сотрудник добавляет трек посылке.
  const p = await page('?path=/order/1042');
  const n = (await api('/api/orders/1042')).parcels.findIndex((x) => !x.track) + 1;
  ok('живое: у 1042 есть посылка без трека', n > 0);
  ok('живое: трек сохранён', (await post(`/api/admin/orders/1042/parcels/${n}/track`, 2001, { track: '1999 888 777 6' })).ok);
  await wait(p, 2000);
  ok('живое: покупатель видит трек без перезагрузки', await has(p, '19998887776'));
  // Сотрудник держит открытым заказ 1045 — покупатель отменяет его до оплаты.
  const a = await page('?staff=owner&path=/admin/order/1045');
  const before = await has(a, 'Отменить заказ');
  ok('живое: покупатель отменил 1045', (await (await post('/api/orders/1045/cancel', 1001)).json()).result === 'cancelled');
  await wait(a, 2000);
  ok('живое: в админке у отменённого 1045 пропала «Отменить заказ» без перезагрузки', before && !(await has(a, 'Отменить заказ')));
});

await step('расцветки: две вещи одной модели → одна вещь с выбором цвета', async () => {
  const a = await page('?staff=owner&path=/admin/item/leather');
  await btn(a, 'Объединить с другой вещью').click(); await wait(a, 500);
  await a.getByRole('dialog').getByRole('button', { name: /Джинсы прямые/ }).click(); await wait(a, 500);
  await a.screenshot({ path: SHOTS_COLORS + '1-merge-confirm.png' });
  await a.getByRole('dialog').getByRole('button', { name: 'Объединить', exact: true }).click(); await wait(a, 1500);
  await a.screenshot({ path: SHOTS_COLORS + '2-admin-item-two-colors.png', fullPage: true });
  const p = await api('/api/products/leather');
  ok('объединение: у вещи два цвета', p.colors.map((c) => c.name).join() === 'Чёрный,Синий');
  ok('объединение: второй вещи отдельно нет', (await fetch(API + '/api/products/jeans')).status === 404);
  const f = await api('/api/catalog?f=' + encodeURIComponent(JSON.stringify({ colors: ['blue'] })));
  ok('фильтр «Синий» находит объединённую вещь', f.items.some((x) => x.id === 'leather'));
  const c = await page('?path=/product/leather');
  ok('покупатель: в карточке выбор из двух цветов', (await c.getByRole('radio', { name: /^Цвет / }).count()) === 2);
  await c.getByRole('radio', { name: 'Цвет Синий' }).click(); await wait(c, 500);
  ok('покупатель: выбран синий', (await c.getByRole('radio', { name: 'Цвет Синий' }).getAttribute('aria-checked')) === 'true');
  await c.screenshot({ path: SHOTS_COLORS + '3-buyer-card-blue.png' });
});

await step('описание вещи: продавец пишет — покупатель видит', async () => {
  const a = await page('?staff=owner&path=/admin/item/trench');
  await a.getByLabel('Описание').fill('Хлопковый габардин.\nНа модели размер M.');
  await btn(a, 'Сохранить').click(); await wait(a, 1500);
  ok('описание сохранено на сервере', (await api('/api/products/trench')).description === 'Хлопковый габардин.\nНа модели размер M.');
  const c = await page('?path=/product/trench');
  ok('покупатель видит описание в карточке', await has(c, 'Хлопковый габардин.') && await has(c, 'На модели размер M.'));
  await c.getByText('На модели размер M.').evaluate((el) => el.scrollIntoView({ block: 'center' })); await wait(c, 300);
  await c.screenshot({ path: SHOTS_COLORS + '4-buyer-description.png' });
});

await step('удаление вещи: пропадает у покупателя, заказ с ней остаётся', async () => {
  const a = await page('?staff=owner&path=/admin/item/chinos');
  await btn(a, 'Удалить вещь').click(); await wait(a, 400);
  await a.getByRole('dialog').getByRole('button', { name: 'Удалить вещь', exact: true }).click(); await wait(a, 1500);
  ok('adm15: вещь удалена из админки', !(await api('/api/admin/items', 2001)).some((x) => x.id === 'chinos'));
  const c = await page('');
  ok('покупатель: в каталоге её нет', (await c.getByRole('button', { name: /Футболка с принтом/ }).count()) > 0 && (await c.getByRole('button', { name: /Брюки чинос/ }).count()) === 0);
  ok('заказ 1038 с этой вещью у покупателя не изменился', JSON.stringify(await api('/api/orders/1038', 2003)).includes('"name":"Брюки чинос"'));
});

await step('почта: письмо → ссылка → подтверждена', async () => {
  const p = await page('?path=/email');
  await p.getByLabel('Адрес почты').fill('anna.check@example.com');
  const sent = p.waitForResponse((r) => r.url().endsWith('/api/email') && r.request().method() === 'POST');
  await btn(p, 'Отправить письмо').click();
  const body = await (await sent).json();
  await wait(p);
  ok('AN: ждёт подтверждения, адрес на экране', await has(p, 'Ждёт подтверждения') && await has(p, 'anna.check@example.com'));
  await p.screenshot({ path: SHOTS + 'email-1-wait.png' });
  const page2 = await fetch(body.devLink);
  ok('ссылка из письма: страница «Почта подтверждена»', page2.status === 200 && (await page2.text()).includes('Почта подтверждена'));
  await p.waitForTimeout(11_000);
  ok('AN: приложение само увидело подтверждение', await has(p, 'Почта подтверждена'));
  await p.screenshot({ path: SHOTS + 'email-2-ok.png' });
  const me = await api('/api/me');
  ok('сервер: почта подтверждена, письма включены', me.user.emailState === 'ok' && me.user.notif.mail === true);
  await btn(p, 'Отвязать почту').click(); await wait(p);
  ok('AN: перед отвязкой — «Отвязать почту?»', await has(p, 'Отвязать почту?') && await has(p, 'anna.check@example.com перестанут'));
  await p.screenshot({ path: SHOTS_DESIGN + 'unlink-confirm.png' });
  await btn(p, 'Отмена').click(); await wait(p);
  ok('«Отмена» — почта на месте', await has(p, 'Почта подтверждена') && (await api('/api/me')).user.emailState === 'ok');
  await btn(p, 'Отвязать почту').click(); await wait(p);
  await btn(p, 'Отвязать').click(); await wait(p, 1200);
  const after = await api('/api/me');
  ok('«Отвязать» — почта отвязана на сервере', after.user.emailState === 'none' && after.user.email === '');
});

await step('права и нет сети', async () => {
  const s = await page('?staff=stock&path=/admin/settings');
  ok('склад: курс недоступен', await has(s, 'Нет доступа'));
  const q = await page('?offline');
  ok('Q без сети', await has(q, 'Нет соединения'));
});

await b.close();
console.log(res.join('\n'));
console.log('console errors:', errs.length ? '\n' + errs.join('\n') : 'none');
process.exit(res.some((r) => r.startsWith('FAIL')) || errs.length ? 1 : 0);
