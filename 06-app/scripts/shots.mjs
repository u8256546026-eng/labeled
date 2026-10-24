// Снимки для сверки: кадр макета (design_handoff) и тот же экран приложения, 390×844.
// Запуск: node scripts/shots.mjs <outDir> <job...>   job = mock:<file>:<frameId> | app:<name>
// Нужны запущенные серверы: макеты на :8901 (python3 -m http.server), приложение на :5173 (npm run dev).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [, , out, ...jobs] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
// Имя размера без наличия — «XL, под заказ» / «XS, нет в наличии».
const size = (p, s) => p.getByRole('radiogroup', { name: 'Размер' }).getByRole('radio', { name: new RegExp('^' + s + '(,|$)') }).click();
const scroll = (p, y) => p.locator('[data-scroll]').evaluate((el, y) => (el.scrollTop = y), y);
const WIDTH = { '7b2': 360, 'G': 360, 'F': 360, '7m': 360, '7n': 360 };
// Начальный адрес сценария: демо-сценарий сервера и экран, открытый сразу.
const QUERY = { '7g': '?path=/cart', '7h': '?path=/cart', 'A': '?path=/cart&scenario=price', 'A-bottom': '?path=/cart', 'L': '?path=/cart&scenario=sold', 'X': '?path=/cart', 'X-courier': '?path=/cart', 'C': '?path=/pay/p-1042-1', 'pay': '?path=/checkout', 'K': '?path=/checkout',
  '7i': '?path=/orders', '7i-bottom': '?path=/orders', '7j': '?path=/order/1042', 'D': '?path=/order/1042', 'D-parcels': '?path=/order/1042',
  '7k': '?path=/order/1039', '7l': '?path=/order/1038', 'J': '?path=/order/1047', 'AA': '?path=/order/1040', 'AZ': '?path=/order/1044',
  'B': '?path=/link', 'B-mid': '?path=/link', 'B-bottom': '?path=/link', 'B-hist': '?path=/link', 'F': '?path=/link', 'AW': '?path=/link', 'AW-new': '?path=/link', 'AX': '?path=/link',
  'E': '?path=/profile&guest', 'P': '?path=/profile&guest', 'AK': '?path=/profile', 'AK-bottom': '?path=/profile', 'AL': '?path=/profile/edit', 'AM': '?path=/settings', 'AN': '?path=/email', 'AP': '?path=/notif',
  'AQ': '?path=/addresses', 'AR': '?path=/addresses/new', 'H': '?path=/points', 'H-bottom': '?path=/points', 'AS': '?path=/invite',
  'AT': '?path=/help', 'AV': '?path=/legal', 'AU': '?path=/chart/tee', 'N': '?path=/inbox', 'O': '?path=/delete-account', 'T': '?path=/fav', 'I': '?path=/share/tee',
  'R': '?start=item_sold-cap', 'S': '?guest&start=ref_1001', 'AI': '?path=/search', 'AI-empty': '?path=/search', 'AJ': '?path=/search',
  'V': '?path=/photo/1046', 'AG': '?path=/viewer/product/tee', 'M': '?path=/claim/1046', 'Y': '?path=/claim/1046', 'Z': '?path=/claim/1046', 'AB': '?path=/order/1040',
  'AC': '?path=/reviews', 'AD': '?onboarding', 'AE': '?path=/push', 'AH': '?scenario=update', 'AH-maint': '?scenario=maint', 'Q': '?offline', 'W': '?path=/payments', 'BA': '?scenario=booterr',
  '7n': '?path=/order/1042', 'G': '?path=/orders', 'BF': '?path=/cart', 'AY': '?path=/orders&scenario=noorders',
  // Режим администратора: ?staff=<роль> — демо-сессия сотрудника.
  'adm01': '?staff=owner&path=/profile', 'adm02': '?staff=owner&path=/admin', 'adm03': '?staff=owner&path=/admin', 'adm04': '?staff=owner&path=/admin/pay/p-1041', 'adm05': '?staff=owner&path=/admin/pay/p-1041',
  'adm06': '?staff=owner&path=/admin/req/1043', 'adm07': '?staff=owner&path=/admin/req/1043', 'adm08': '?staff=owner&path=/admin/req/1043', 'adm09': '?staff=owner&path=/admin/orders',
  'adm10': '?staff=owner&path=/admin/order/1042', 'adm11': '?staff=owner&path=/admin/order/1042', 'adm12': '?staff=owner&path=/admin/photo/1040', 'adm13': '?staff=owner&path=/admin/claim/1038',
  'adm14': '?staff=owner&path=/admin/catalog', 'adm15': '?staff=owner&path=/admin/item/tee', 'adm16': '?staff=owner&path=/admin/banners', 'adm17': '?staff=owner&path=/admin/more',
  'adm18': '?staff=owner&path=/admin/buyers', 'adm19': '?staff=owner&path=/admin/buyer/b-anna', 'adm20': '?staff=owner&path=/admin/reviews', 'adm21': '?staff=owner&path=/admin/settings',
  'adm22': '?staff=owner&path=/admin/staff', 'adm23': '?staff=owner&path=/admin/member/s-artem', 'adm24': '?staff=owner&path=/admin/staff', 'adm25': '?staff=owner&path=/admin/summary',
  'adm26': '?staff=stock&path=/admin', 'adm27': '?staff=stock&path=/admin/settings',
  'adm33': '?staff=owner&path=/admin/log', 'adm34': '?staff=owner&path=/admin/order/1040/split' };

// Сценарии приложения: последовательность действий до нужного состояния.
const APP = {
  '7a': async () => {},
  '7a-scrolled': async (p) => { await p.locator('[data-scroll]').evaluate((el) => (el.scrollTop = 1150)); },
  'U': async (p) => { await p.getByRole('button', { name: /^Фильтры/ }).click(); },
  'BC': async (p) => {
    await p.getByRole('button', { name: /^Фильтры/ }).click();
    const g = (label, name) => p.getByRole('group', { name: label }).getByRole('button', { name, exact: true });
    await g('Сортировка', 'Дешевле').click();
    await g('Категория', /^Футболки/).click();
    await g('Категория', /^Штаны/).click();
    await g('Размер', 'M').click();
    await p.getByRole('group', { name: 'Состояние' }).getByRole('button', { name: /^Новое/ }).click();
    await g('Цвет', 'Чёрный').click();
    await g('Цвет', 'Бежевый').click();
    await p.getByPlaceholder('Без ограничения').fill('8000');
    await p.getByPlaceholder('Без ограничения').blur();
    await p.waitForTimeout(300);
  },
  'BC-bottom': async (p) => { await APP.BC(p); await p.locator('[data-scroll]').evaluate((el) => (el.scrollTop = el.scrollHeight)); },
  'BD': async (p) => { await APP.BC(p); await p.getByRole('button', { name: /^Показать/ }).click(); await p.waitForTimeout(600); await p.locator('[data-scroll]').evaluate((el) => (el.scrollTop = 470)); },
  'sticky': async (p) => { await APP.BD(p); await p.locator('[data-scroll]').evaluate((el) => (el.scrollTop = 1000)); },
  'AF-catalog': async (p) => {
    await p.getByRole('group', { name: 'Категории' }).getByRole('button', { name: 'Нижнее бельё' }).click();
    await p.waitForTimeout(500);
    await p.locator('[data-scroll]').evaluate((el) => (el.scrollTop = 470));
  },
  // Карточка товара (Flow 7b–7q): открыть «Футболку с принтом» и выставить состояние кадра.
  '7r': async (p) => { await p.locator('[data-scroll]').evaluate((el) => (el.scrollTop = 1150)); },
  '7m': async (p) => { await p.locator('[data-scroll]').evaluate((el) => (el.scrollTop = 1150)); },
  '7n': async () => {}, 'G': async () => {}, 'BF': async () => {}, 'AY': async () => {},
  'BE': async (p) => { await p.getByRole('button', { name: /Футболка с принтом/ }).first().click(); await p.waitForTimeout(700); },
  'tee': async (p) => { await p.getByRole('button', { name: /Футболка с принтом/ }).first().click(); await p.waitForTimeout(700); },
  '7b1': async (p) => { await APP.tee(p); await size(p, 'M'); await p.getByRole('radiogroup', { name: 'Доступные варианты' }).getByRole('radio').first().click(); },
  '7b': async (p) => { await APP.tee(p); await scroll(p, 457); },
  '7c': async (p) => { await APP.tee(p); await size(p, 'M'); await scroll(p, 487); },
  '7d': async (p) => { await APP['7b1'](p); await scroll(p, 487); },
  '7e': async (p) => { await APP.tee(p); await size(p, 'M'); await p.getByRole('radio', { name: 'Цвет Молочный' }).click(); await scroll(p, 457); },
  '7f': async (p) => { await APP.tee(p); await p.getByRole('radio', { name: 'Цвет Серый принт' }).click(); await size(p, 'L'); await scroll(p, 487); },
  '7o': async (p) => { await APP.tee(p); await size(p, 'XL'); await scroll(p, 487); },
  '7p': async (p) => { await APP['7o'](p); await p.getByRole('button', { name: 'Под заказ' }).click(); await p.waitForTimeout(400); },
  '7q': async (p) => { await APP['7p'](p); await p.getByRole('button', { name: 'Отправить заявку' }).click(); await p.waitForTimeout(700); },
  '7b2': async (p) => { await APP['7b1'](p); },
  // Корзина и оформление (7g, 7h, A, L, X, C, K).
  '7g': async () => {},
  '7h': async (p) => { while (await p.getByRole('button', { name: 'Убрать из корзины' }).count()) { await p.getByRole('button', { name: 'Убрать из корзины' }).first().click(); } },
  'A': async (p) => { await p.getByRole('button', { name: 'Оформить' }).click(); await p.waitForTimeout(700); },
  'A-bottom': async (p) => { await APP.A(p); await scroll(p, 5000); },
  'L': async (p) => { await APP.A(p); },
  'X': async (p) => { await APP.A(p); await p.getByRole('button', { name: /Способ получения/ }).click(); },
  'X-courier': async (p) => { await APP.X(p); await p.getByRole('button', { name: 'Курьер', exact: true }).click(); },
  // Без способа получения кнопка оформления ведёт к выбору: вписываем пункт CDEK и подтверждаем.
  'pickup': async (p) => {
    await p.getByRole('button', { name: 'Выбрать получение' }).click(); await p.waitForTimeout(500);
    await p.getByLabel('Адрес или код пункта CDEK').fill('Москва, Тверская, 15');
    await p.getByRole('button', { name: 'Выбрать', exact: true }).click(); await p.waitForTimeout(600);
  },
  'pay': async (p) => { await APP.pickup(p); await p.getByRole('button', { name: 'Подтвердить заказ' }).click(); await p.waitForTimeout(900); },
  'C': async () => {},
  'K': async (p) => {
    await APP.pickup(p);
    await p.getByRole('button', { name: 'Подтвердить заказ' }).click(); await p.waitForTimeout(900);
    await p.locator('input[type=file]').setInputFiles({ name: 'Чек из банка.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(240 * 1024) });
    await p.waitForTimeout(800); await p.getByRole('button', { name: 'Перевёл' }).click(); await p.waitForTimeout(900);
  },
  // Заказы и отслеживание (7i, G, 7j/D, 7k, 7l, J, AA, AZ).
  '7i': async () => {},
  '7i-bottom': async (p) => { await scroll(p, 5000); },
  '7j': async () => {},
  'D': async (p) => { await p.getByRole('button', { name: 'История заказа' }).click(); await p.waitForTimeout(300); },
  'D-parcels': async (p) => { await scroll(p, 600); },
  '7k': async () => {}, '7l': async () => {}, 'J': async () => {}, 'AA': async () => {},
  'AZ': async (p) => { await p.getByRole('button', { name: 'Отменить заказ' }).click(); await p.waitForTimeout(500); },
  // Заказ по ссылке (B, F, AW, AX).
  'B': async () => {},
  'B-mid': async (p) => { await scroll(p, 900); },
  'B-bottom': async (p) => { await scroll(p, 5000); },
  'B-hist': async (p) => { await p.getByRole('tab', { name: 'История' }).click(); await p.waitForTimeout(500); },
  'F': async (p) => { await p.getByLabel('Название заказа').focus(); await p.waitForTimeout(300); },
  'AW': async (p) => { await p.getByRole('button', { name: 'Изменить' }).first().click(); await p.waitForTimeout(500); },
  'AW-new': async (p) => { await p.getByRole('button', { name: /Добавить ещё один товар/ }).click(); await p.waitForTimeout(400); await p.getByLabel('Ссылка на товар').fill('https://item.taobao.com/item.htm?id=72'); await p.getByLabel('Цена одной штуки, ¥').fill('180'); await p.getByLabel('Ссылка на товар').focus(); await p.getByLabel('Цена одной штуки, ¥').blur(); },
  'AX': async (p) => { await p.getByRole('button', { name: 'Отправить на проверку' }).click(); await p.waitForTimeout(900); },
  // Профиль, вход, адреса, баллы (заход 1).
  'E': async () => {}, 'AK': async () => {}, 'AK-bottom': async (p) => { await scroll(p, 5000); },
  'P': async (p) => { await p.getByRole('button', { name: 'Войти через Telegram' }).click(); await p.waitForTimeout(500); },
  'AL': async () => {}, 'AM': async () => {}, 'AP': async () => {}, 'AQ': async () => {}, 'H': async () => {}, 'H-bottom': async (p) => { await scroll(p, 5000); }, 'AS': async () => {},
  'AN': async (p) => { await p.getByLabel('Адрес почты').fill('anna@example.com'); await p.getByRole('button', { name: 'Отправить письмо' }).click(); await p.waitForTimeout(600); },
  'AR': async (p) => { await p.getByRole('button', { name: 'Подставить номер из Telegram' }).click(); await p.waitForTimeout(500); },
  // Заход 2: помощь, документы, поиск, избранное, события, удаление, приглашения.
  'AT': async () => {}, 'AV': async () => {}, 'AU': async () => {}, 'N': async () => {}, 'O': async () => {}, 'T': async () => {}, 'I': async () => {}, 'R': async () => {}, 'S': async () => {},
  'AI': async (p) => { await p.getByLabel('Поиск по каталогу').fill('футболка'); await p.waitForTimeout(900); await p.getByLabel('Поиск по каталогу').blur(); },
  'AI-empty': async () => {},
  'AJ': async (p) => { await p.getByLabel('Поиск по каталогу').fill('кожаный тренч'); await p.waitForTimeout(900); await p.getByLabel('Поиск по каталогу').blur(); },
  // Заход 3: фотоотчёт, обращения, возврат, отзывы, служебные.
  'V': async () => {}, 'AG': async () => {}, 'M': async () => {}, 'AC': async () => {}, 'AD': async () => {}, 'AE': async () => {}, 'AH': async () => {}, 'AH-maint': async () => {}, 'Q': async () => {}, 'W': async () => {}, 'BA': async () => {},
  'Y': async (p) => {
    await p.getByRole('radio', { name: /^Брак/ }).click();
    await p.getByLabel('Опишите проблему').fill('Отклеилась подошва у носка');
    await p.locator('input[type=file]').setInputFiles([{ name: '1.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(500) }, { name: '2.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(500) }]);
    await p.getByRole('button', { name: 'Отправить обращение' }).click(); await p.waitForTimeout(600);
    await p.getByRole('button', { name: 'Показать ответ продавца' }).click(); await p.waitForTimeout(400);
  },
  'Z': async (p) => { await APP.Y(p); await p.getByRole('button', { name: 'Указать реквизиты для возврата' }).click(); await p.waitForTimeout(500); await p.getByLabel('Телефон для перевода').fill('9162454512'); await p.getByRole('button', { name: 'Т-Банк' }).click(); await p.getByLabel('Телефон для перевода').blur(); },
  'AB': async (p) => { await p.getByRole('button', { name: 'Всё в порядке, получил' }).click(); await p.waitForTimeout(400); await p.getByRole('radio', { name: '5 из 5' }).click(); await p.waitForTimeout(600); await p.getByLabel('Текст отзыва').fill('Размер совпал, ткань плотная, принт не трескается после стирки.'); await p.getByLabel('Текст отзыва').blur(); },
  // Режим администратора (adm01–adm27).
  ...Object.fromEntries(['adm01', 'adm02', 'adm04', 'adm06', 'adm09', 'adm10', 'adm12', 'adm14', 'adm15', 'adm16', 'adm17', 'adm18', 'adm20', 'adm21', 'adm22', 'adm23', 'adm25', 'adm26', 'adm27'].map((k) => [k, async () => {}])),
  'adm03': async (p) => { await p.getByRole('group', { name: 'Тип задачи' }).getByRole('button', { name: /^Оплаты/ }).click(); },
  'adm05': async (p) => { await p.getByRole('button', { name: 'Деньги не пришли' }).click(); await p.waitForTimeout(400); },
  'adm07': async (p) => { await p.getByRole('button', { name: 'Изменить цену' }).click(); await p.waitForTimeout(400); await p.getByRole('textbox', { name: /^Nike Air Force/ }).fill('999'); await p.getByLabel('Причина').fill('Цена на Poizon выросла'); await p.getByLabel('Причина').blur(); },
  'adm08': async (p) => { await p.getByRole('button', { name: 'Отказать' }).click(); await p.waitForTimeout(400); },
  'adm11': async (p) => { await p.getByRole('button', { name: 'Сменить статус' }).click(); await p.waitForTimeout(400); },
  'adm13': async (p) => { await p.getByRole('button', { name: /^Посылка на сортировке/ }).click(); },
  'adm19': async (p) => { await p.getByLabel('Сколько').fill('250'); await p.getByLabel('Причина').fill('Компенсация за задержку посылки'); await p.getByLabel('Причина').blur(); },
  'adm33': async () => {},
  'adm34': async (p) => {
    await p.getByRole('button', { name: 'Добавить посылку', exact: true }).click();
    await p.getByRole('radiogroup', { name: 'Посылка для: Свитшот с вышивкой' }).getByRole('radio', { name: 'Посылка 2' }).click();
  },
  'adm24': async (p) => { await p.getByRole('button', { name: 'Пригласить' }).click(); await p.waitForTimeout(400); await p.getByRole('button', { name: 'Создать приглашение' }).click(); await p.waitForTimeout(500); },
  'AF': async (p) => {
    await p.getByRole('button', { name: /^Фильтры/ }).click();
    await p.getByRole('group', { name: 'Размер' }).getByRole('button', { name: 'XXL', exact: true }).click();
    await p.waitForTimeout(300);
  },
};

for (const job of jobs) {
  const [kind, a, b] = job.split(':');
  const page = await browser.newPage({ viewport: { width: kind === 'mock' ? 1600 : WIDTH[a] ?? 390, height: kind === 'mock' ? 1200 : 844 }, deviceScaleFactor: 2 });
  if (kind === 'mock') {
    await page.goto(`http://localhost:8901/${encodeURIComponent(a)}.dc.html`, { waitUntil: 'networkidle' });
    const frame = page.locator(`[id="${b}"] > div:nth-of-type(2)`);
    await frame.waitFor();
    await page.waitForTimeout(1500);
    await frame.screenshot({ path: `${out}/mock-${b}.png` });
  } else {
    page.on('pageerror', (e) => console.log('ERR', job, e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', job, m.text()); });
    await page.goto('http://localhost:5173/' + (QUERY[a] ?? ''), { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await APP[a](page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/app-${a}.png` });
  }
  await page.close();
  console.log('ok', job);
}
await browser.close();
