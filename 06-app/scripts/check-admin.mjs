import { chromium } from 'playwright';
// Проверка режима администратора (adm01–adm34): очередь, действия и что после них видит покупатель, права ролей.
// Нужен запущенный `npm run dev`. Запуск: node scripts/check-admin.mjs (код выхода 1 при ошибке).
const PIC = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex') };
const B = process.env.BASE || 'http://localhost:5173/';
const b = await chromium.launch();
const errs = [];
const res = [];
const ok = (name, cond) => res.push((cond ? 'OK  ' : 'FAIL') + ' ' + name);
async function page(q) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(q + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push(q + ': ' + e.message));
  await p.goto(B + q); await p.waitForTimeout(900);
  return p;
}
const btn = (p, t) => p.getByRole('button', { name: t, exact: true }).first();
const has = async (p, t) => (await p.getByText(t, { exact: false }).count()) > 0;
const wait = (p, ms = 450) => p.waitForTimeout(ms);
const step = async (name, fn) => { try { await fn(); } catch (e) { res.push('FAIL ' + name + ': ' + e.message.split('\n')[0]); } };
const badge = async (p) => (await p.getByRole('button', { name: 'Задачи', exact: true }).innerText()).replace(/\D/g, '');

await step('adm01 · переключатель', async () => {
  const p = await page('?staff=owner&path=/profile');
  ok('adm01: «Режим работы» у сотрудника', await has(p, 'Режим работы') && await has(p, 'Вы сотрудник labeled · Владелец'));
  await p.getByRole('radio', { name: 'Админ' }).click(); await wait(p);
  ok('adm01: «Админ» → очередь задач', await has(p, '8 задач ждут действия') && await has(p, 'Режим администратора'));
  const q = await page('?path=/profile');
  ok('adm01: покупатель переключателя не видит', !(await has(q, 'Режим работы')));
  const r = await page('?path=/admin');
  ok('не сотрудник: /admin закрыт', await has(r, 'для сотрудников labeled'));
});

await step('adm02–05 · оплата', async () => {
  const p = await page('?staff=owner&path=/admin');
  ok('adm02: значок 8', (await badge(p)) === '8');
  ok('adm02: давние сверху', (await p.locator('button:has-text("Давно ждёт")').count()) === 2);
  await p.getByRole('group', { name: 'Тип задачи' }).getByRole('button', { name: /^Оплаты/ }).click(); await wait(p, 200);
  ok('adm03: только оплаты', (await p.getByText('Оплата товаров · заказ 1041').count()) === 1 && !(await has(p, 'Обращение по заказу')));
  await p.getByText('Оплата товаров · заказ 1041').click(); await wait(p);
  await btn(p, 'Подтвердить оплату').click(); await wait(p, 600);
  ok('adm04: подтверждена', await has(p, 'Оплата подтверждена'));
  await p.locator('input[type=file]').first().setInputFiles({ name: 'check.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }); await wait(p, 600);
  ok('adm04: чек продавца загружен', await has(p, 'Чек загружен'));
  await btn(p, 'К задачам').click(); await wait(p);
  ok('adm04: задача закрыта, значок 7', (await badge(p)) === '7');
  await p.getByText('Оплата доставки · 1042, посылка 1').click(); await wait(p);
  await btn(p, 'Деньги не пришли').click(); await wait(p);
  await p.getByRole('radio', { name: 'Другая причина' }).click();
  ok('adm05: «Другая причина» без комментария — нельзя', await btn(p, 'Отправить покупателю').isDisabled());
  await p.getByLabel('Комментарий для покупателя').fill('Платёж пришёл с другой карты');
  await btn(p, 'Отправить покупателю').click(); await wait(p, 700);
  ok('adm05: отмечено', await has(p, 'Отмечено: деньги не пришли') && await has(p, 'Покупатель уведомлён'));
  // Покупатель видит результат в «Платежах и чеках» (W).
  await p.getByRole('button', { name: /^Назад/ }).first().click(); await wait(p);
  await p.getByRole('button', { name: 'Ещё', exact: true }).click(); await wait(p);
  await p.getByText('Перейти в режим покупателя').click(); await wait(p);
  await p.getByText('Платежи и чеки').click(); await wait(p, 700);
  const row = p.locator('button', { hasText: 'Заказ 1041' }).first();
  ok('W: 1041 подтверждена у покупателя', /Подтверждена/.test(await row.innerText()));
  ok('W: чек продавца у 1041', /чек продавца/i.test(await row.innerText()));
});

await step('adm06–08 · заявка', async () => {
  const p = await page('?staff=owner&path=/admin/req/1043');
  ok('adm06: расчёт по настройкам (комиссия 1 600 ₽)', await has(p, '1 600 ₽'));
  await btn(p, 'Изменить цену').click(); await wait(p);
  ok('adm07: без изменения цены — нельзя', await btn(p, 'Измените цену позиции').isDisabled());
  await p.getByRole('textbox', { name: /^Nike Air Force/ }).fill('999');
  ok('adm07: без причины — нельзя', await btn(p, 'Отправить на согласование').isDisabled());
  await p.getByLabel('Причина').fill('Цена на Poizon выросла');
  await btn(p, 'Отправить на согласование').click(); await wait(p, 700);
  ok('adm07: ждём согласия, старая цена зачёркнута', await has(p, 'Ждём согласия покупателя') && await has(p, '899 ¥'));
  const q = await page('?staff=owner&path=/admin/req/1043');
  await btn(q, 'Отказать').click(); await wait(q);
  await q.getByRole('radio', { name: 'Другая причина' }).click();
  ok('adm08: «Другая причина» без комментария — нельзя', await q.getByRole('dialog').getByRole('button', { name: 'Отказать', exact: true }).isDisabled());
  await q.getByLabel('Комментарий').fill('Продавец не отвечает');
  await q.getByRole('dialog').getByRole('button', { name: 'Отказать', exact: true }).click(); await wait(q, 700);
  ok('adm08: отклонена', await has(q, 'Заявка отклонена'));
});

await step('adm09–11 · заказы', async () => {
  const p = await page('?staff=owner&path=/admin/orders');
  await p.getByLabel('Номер заказа или имя').fill('котов'); await wait(p, 200);
  ok('adm09: поиск по имени', (await p.getByText(/^№\d+ ·/).count()) === 1 && await has(p, '№1043'));
  await p.getByLabel('Номер заказа или имя').fill('');
  await p.getByRole('group', { name: 'Этап заказа' }).getByRole('button', { name: /^Проблемы/ }).click(); await wait(p, 200);
  ok('adm09: «Проблемы» — 2', (await p.getByText(/^№\d+ ·/).count()) === 2);
  const q = await page('?staff=owner&path=/admin/order/1042');
  ok('adm10: трек < 10 цифр — нельзя', await btn(q, 'Сохранить трек и уведомить').isDisabled());
  await q.getByLabel('Трек CDEK · посылка 2').fill('1023456789');
  await btn(q, 'Сохранить трек и уведомить').click(); await wait(q, 700);
  ok('adm10: трек сохранён', await has(q, 'трек 1023456789') && await has(q, 'Трек отправлен покупателю'));
  await btn(q, 'Сменить статус').click(); await wait(q);
  ok('adm11: по умолчанию следующий этап, уведомление включено', await q.getByRole('radio', { name: /Прибыло на склад в России/ }).getAttribute('aria-checked') === 'true' && await q.getByRole('switch', { name: /Уведомить покупателя/ }).getAttribute('aria-checked') === 'true');
  await btn(q, 'Сохранить').click(); await wait(q, 700);
  ok('adm11: этап сменён', await has(q, 'Статус изменён, покупатель уведомлён'));
});

await step('adm12–13 · фотоотчёт и обращение', async () => {
  const p = await page('?staff=owner&path=/admin/photo/1040');
  ok('adm12: без фото второй вещи — нельзя', await btn(p, 'Добавьте фото каждой вещи').isDisabled());
  await p.locator('input[type=file]').nth(1).setInputFiles(PIC); await wait(p, 600);
  ok('adm12: 1 из 3', await has(p, '1 из 3'));
  await btn(p, 'Отправить фотоотчёт').click(); await wait(p, 700);
  ok('adm12: отправлен', await has(p, 'Фотоотчёт отправлен'));
  const q = await page('?staff=owner&path=/admin/claim/1038');
  ok('adm13: пустой ответ — нельзя', await btn(q, 'Отправить ответ').isDisabled());
  await q.getByRole('button', { name: /^Проверим и ответим/ }).click();
  await btn(q, 'Отправить ответ').click(); await wait(q, 700);
  ok('adm13: ответ в переписке', await has(q, 'Вы · сейчас'));
  await btn(q, 'Закрыть обращение').click(); await wait(q, 700);
  ok('adm13: закрыто', await has(q, 'Обращение закрыто'));
});

await step('adm14–16 · каталог', async () => {
  const p = await page('?staff=owner&path=/admin/catalog');
  await p.getByRole('group', { name: 'Статус вещи' }).getByRole('button', { name: /^Скрыты/ }).click(); await wait(p, 200);
  ok('adm14: скрытые — рюкзак', await has(p, 'Рюкзак городской') && !(await has(p, 'Бомбер на молнии')));
  await p.getByRole('group', { name: 'Статус вещи' }).getByRole('button', { name: 'Все', exact: true }).click();
  await btn(p, 'Добавить').click(); await wait(p);
  ok('adm15: новая вещь без фото — нельзя', await btn(p, 'Добавьте фото').isDisabled());
  await p.locator('input[type=file]').first().setInputFiles(PIC); await wait(p, 200);
  await p.getByLabel('Название').fill('Кепка');
  await p.getByRole('button', { name: /^Изменить: / }).click(); await wait(p);
  await p.getByRole('dialog').getByLabel('Цена').fill('2490');
  await btn(p, 'Готово').click(); await wait(p);
  await btn(p, 'Сохранить').click(); await wait(p, 900);
  ok('adm15: вещь в каталоге', await has(p, 'Кепка') && await has(p, '7 вещей'));
  const q = await page('?staff=owner&path=/admin/banners');
  await q.getByRole('button', { name: /Рубашки/ }).click(); await wait(q, 600);
  await q.getByRole('switch', { name: /Показывать в каталоге/ }).click(); await wait(q, 600);
  ok('adm16: категория скрыта', await q.getByRole('switch', { name: /Показывать в каталоге/ }).getAttribute('aria-checked') === 'false');
  await q.locator('input[type=file]').first().setInputFiles(PIC); await wait(q, 600);
  ok('adm16: фото категории загружено', await has(q, 'Загружено') && await q.getByRole('button', { name: 'Текущее фото' }).isVisible());
  await q.getByRole('button', { name: /^Назад/ }).click(); await wait(q, 600);
  ok('adm16: в списке — скрыта', await has(q, 'Скрыта'));
});

await step('adm15 · расцветки одной модели', async () => {
  const p = await page('?staff=owner&path=/admin/item/tee');
  ok('adm15: у футболки две расцветки', await has(p, 'Основная расцветка') && await has(p, 'Фото · белый'));
  await btn(p, 'Добавить расцветку').click(); await wait(p);
  await p.getByRole('dialog').getByText('Серый', { exact: true }).click(); await wait(p);
  ok('adm15: расцветка без фото — кнопка называет шаг', await btn(p, 'Добавьте фото: серый').isDisabled());
  await p.locator('input[type=file]').last().setInputFiles(PIC); await wait(p, 300);
  await p.getByRole('button', { name: 'Добавить предложение', exact: true }).nth(2).click(); await wait(p);
  const d = p.getByRole('dialog');
  await d.getByLabel('Размер').fill('L'); await d.getByLabel('Цена').fill('3990');
  await d.getByRole('button', { name: 'Добавить', exact: true }).click(); await wait(p);
  await btn(p, 'Сохранить').click(); await wait(p, 900);
  await p.getByRole('button', { name: /^Назад/ }).click(); await wait(p, 600);
  ok('adm14: в списке — 3 цвета', await has(p, 'Stüssy · 3 цвета'));

  const m = await page('?staff=owner&path=/admin/item/shirt');
  await btn(m, 'Объединить с другой вещью').click(); await wait(m);
  await m.getByRole('dialog').getByRole('button', { name: /Бомбер на молнии/ }).click(); await wait(m);
  await m.getByRole('dialog').getByRole('button', { name: 'Объединить', exact: true }).click(); await wait(m, 900);
  ok('adm15: объединение — красный стал расцветкой рубашки', await has(m, 'Фото · красный') && await has(m, 'Вещи объединены'));
  await m.getByRole('button', { name: /^Назад/ }).click(); await wait(m, 600);
  ok('adm14: бомбера отдельно нет', !(await has(m, 'Бомбер на молнии')) && await has(m, '2 цвета'));

  const s = await page('?staff=owner&path=/admin/item/knit');
  await btn(s, 'Объединить с другой вещью').click(); await wait(s);
  await s.getByRole('dialog').getByRole('button', { name: /Футболка с принтом/ }).click(); await wait(s);
  await s.getByRole('dialog').getByRole('button', { name: 'Объединить', exact: true }).click(); await wait(s, 900);
  ok('adm15: одинаковый цвет — объяснение', await has(s, 'В обеих вещах есть цвет «Белый»'));
});

await step('adm18–20 · покупатели и отзывы', async () => {
  const p = await page('?staff=owner&path=/admin/buyers');
  await p.getByLabel('Имя, @telegram или телефон').fill('@igor'); await wait(p, 200);
  ok('adm18: поиск по @telegram', await has(p, 'Игорь Котов') && !(await has(p, 'Анна Смирнова')));
  const q = await page('?staff=owner&path=/admin/buyer/b-anna');
  await q.getByRole('radio', { name: 'Списать' }).click();
  await q.getByLabel('Сколько').fill('5000');
  ok('adm19: больше баланса — нельзя', await btn(q, 'Больше, чем на балансе').isDisabled());
  await q.getByRole('radio', { name: 'Начислить' }).click();
  await q.getByLabel('Сколько').fill('250');
  ok('adm19: без причины — нельзя', await btn(q, 'Начислить 250 баллов').isDisabled());
  await q.getByLabel('Причина').fill('Компенсация за задержку посылки');
  await btn(q, 'Начислить 250 баллов').click(); await wait(q, 700);
  ok('adm19: баланс 1 490 и история', await has(q, '1 490') && await has(q, 'Компенсация за задержку посылки'));
  const r = await page('?staff=owner&path=/admin/reviews');
  await r.getByRole('button', { name: 'Опубликовать' }).first().click(); await wait(r, 600);
  ok('adm20: опубликован, на модерации 1', await has(r, '1 на модерации'));
});

await step('adm21 · настройки → расчёт покупателя', async () => {
  const p = await page('?staff=owner&path=/admin/settings');
  ok('adm21: без изменений — нельзя', await btn(p, 'Сохранить изменения').isDisabled());
  ok('adm21: ступени как в макете', await has(p, 'Вещь до 1\u00a0000 ¥ включительно') && await has(p, 'Дороже 3\u00a0000 ¥') && await has(p, 'Курс ЦБ'));
  await p.getByLabel('Вещь до 1\u00a0000 ¥ включительно').fill('0,80');
  ok('adm21: расчётный курс пересчитан', await has(p, 'Курс: 12,42 ₽ за ¥'));
  await p.getByLabel('Граница 1').first().fill('5000');
  ok('adm21: границы не по возрастанию — нельзя', await has(p, 'Проверьте границы') && await btn(p, 'Сохранить изменения').isDisabled());
  await p.getByLabel('Граница 1').first().fill('1000');
  await btn(p, 'Сохранить изменения').click(); await wait(p, 700);
  ok('adm21: сохранено', await has(p, 'Сохранено'));
  await p.getByRole('button', { name: /Назад/ }).first().click(); await wait(p);
  await p.getByText('Перейти в режим покупателя').click(); await wait(p);
  await p.getByRole('button', { name: 'Заказ по ссылке', exact: true }).click(); await wait(p, 900);
  ok('B: новая надбавка у покупателя', await has(p, '0,80'));
});

await step('adm22–24 · сотрудники', async () => {
  const p = await page('?staff=owner&path=/admin/staff');
  await btn(p, 'Пригласить').click(); await wait(p);
  await p.getByRole('radio', { name: /^Склад/ }).click();
  await btn(p, 'Создать приглашение').click(); await wait(p, 600);
  ok('adm24: ссылка staff_ для склада', await has(p, 'Ссылка-приглашение · Склад') && (await p.getByRole('dialog').locator('input').inputValue()).includes('startapp=staff_'));
  await btn(p, 'Готово').click(); await wait(p);
  await p.getByText('Лиза').click(); await wait(p);
  ok('adm23: без изменений — нельзя', await btn(p, 'Сохранить').isDisabled());
  await p.getByRole('switch', { name: 'Отзывы' }).click();
  ok('adm23: права изменены вручную', await has(p, 'Изменены вручную'));
  await btn(p, 'Убрать доступ').click(); await wait(p);
  await p.getByRole('dialog').getByRole('button', { name: 'Убрать доступ' }).click(); await wait(p, 800);
  ok('adm23: доступ убран', await has(p, '3 человека с доступом'));
});

await step('adm28 · решение по обращению', async () => {
  const p = await page('?staff=owner&path=/admin/claim/1038');
  await btn(p, 'Принять решение').click(); await wait(p);
  const d = p.getByRole('dialog');
  ok('adm28: оплачено и сумма по умолчанию', await has(p, 'оплачено 4\u00a0990 ₽') && (await d.getByLabel('Сумма возврата').inputValue()) === '4990');
  await d.getByLabel('Сумма возврата').fill('5000');
  ok('adm28: больше оплаченного — нельзя', await btn(p, 'Больше суммы заказа').isDisabled());
  await d.getByRole('radio', { name: /^Отказать/ }).click();
  ok('adm28: отказ без причины — нельзя', await d.getByRole('button', { name: 'Отказать', exact: true }).isDisabled());
  await d.getByRole('radio', { name: /^Вернуть деньги/ }).click();
  await d.getByLabel('Сумма возврата').fill('4000');
  await btn(p, 'Вернуть 4\u00a0000 ₽').click(); await wait(p, 700);
  ok('adm28: решение показано', await has(p, 'Решение: возврат 4\u00a0000 ₽') && await has(p, 'Покупатель уведомлён'));
});

await step('adm29–30 · счёт за доставку и отмена', async () => {
  const p = await page('?staff=owner&path=/admin/order/1042');
  await btn(p, 'Выставить счёт за доставку · посылка 2').click(); await wait(p);
  ok('adm29: без веса и суммы — нельзя', await btn(p, 'Укажите вес и сумму').isDisabled());
  await p.getByRole('dialog').getByLabel('Вес посылки').fill('1,4');
  await p.getByRole('dialog').getByLabel('Сумма к оплате').fill('2310');
  await btn(p, 'Выставить 2\u00a0310 ₽').click(); await wait(p, 700);
  ok('adm29: счёт выставлен', await has(p, 'Счёт за доставку посылки 2 выставлен') && await has(p, '1,4 кг') && !(await has(p, 'Выставить счёт за доставку')));
  const q = await page('?staff=owner&path=/admin/order/1038');
  await btn(q, 'Отменить заказ').click(); await wait(q);
  await q.getByRole('radio', { name: 'Другая причина' }).click();
  ok('adm30: «Другая причина» без комментария — нельзя', await q.getByRole('dialog').getByRole('button', { name: 'Отменить заказ' }).isDisabled());
  await q.getByRole('radio', { name: 'Товар закончился у продавца' }).click();
  await q.getByRole('dialog').getByRole('button', { name: 'Отменить заказ' }).click(); await wait(q, 700);
  ok('adm30: отменён, нужно вернуть оплату', await has(q, 'Заказ отменён продавцом') && await has(q, 'Вернуть оплату 4\u00a0990 ₽') && await btn(q, 'К заказам').isVisible());
  await btn(q, 'К заказам').click(); await wait(q);
  ok('adm09: заказ в «Проблемах»', /Отменён · вернуть оплату/.test(await q.locator('button', { hasText: '№1038' }).innerText()));
  await q.getByRole('button', { name: 'Задачи', exact: true }).click(); await wait(q);
  ok('adm30: задача на возврат в очереди', await has(q, 'Вернуть оплату · заказ 1038'));
  await q.getByText('Вернуть оплату · заказ 1038').click(); await wait(q);
  await btn(q, 'Деньги возвращены').click(); await wait(q, 700);
  ok('adm30: возврат отмечен', await has(q, 'Оплата возвращена'));
});

await step('adm31–32 · заявки на размер и баннер', async () => {
  const p = await page('?staff=content&path=/admin/catalog');
  ok('adm14: вход в заявки на размер', await has(p, 'Заявки на размер') && await has(p, '3 ждут'));
  await p.getByText('Заявки на размер').first().click(); await wait(p);
  ok('adm31: 3 заявки ждут', await has(p, '3 заявки ждут ответа'));
  await p.getByText('Футболка с принтом · L').click(); await wait(p);
  await btn(p, 'Размер есть — уведомить').click(); await wait(p, 700);
  ok('adm31: покупатель уведомлён', await has(p, 'Уведомлён: размер есть') && await has(p, '2 заявки ждут ответа'));
  const c = await page('?staff=content&path=/admin/banners');
  await btn(c, 'Добавить баннер').click(); await wait(c);
  ok('adm32: без картинки — нельзя', await btn(c, 'Добавьте картинку, заголовок и кнопку').isDisabled());
  await c.locator('input[type=file]').first().setInputFiles(PIC); await wait(c, 600);
  await c.getByLabel('Заголовок').fill('Новая коллекция');
  await c.getByLabel('Текст кнопки').fill('Смотреть');
  await c.getByRole('radio', { name: 'Категория каталога' }).click();
  await btn(c, 'Сохранить').click(); await wait(c, 800);
  ok('adm32: баннер в списке', await has(c, '4. Новая коллекция') && await has(c, 'Кнопка «Смотреть» → каталог'));
  await c.getByText('1. Заказать из-за границы').click(); await wait(c);
  await c.getByRole('switch', { name: 'Показывать на главной' }).click(); await wait(c, 600);
  await c.getByRole('button', { name: /^Назад/ }).first().click(); await wait(c);
  ok('adm16: баннер скрыт', /Скрыт/.test(await c.locator('button', { hasText: '1. Заказать из-за границы' }).innerText()));
  await c.getByRole('button', { name: /^Назад/ }).first().click(); await wait(c);
  await c.getByRole('button', { name: 'Ещё', exact: true }).click(); await wait(c);
  await c.getByText('Перейти в режим покупателя').click(); await wait(c);
  await c.getByRole('button', { name: 'Каталог', exact: true }).click(); await wait(c, 900);
  ok('7a: новый баннер на главной, скрытого нет', await has(c, 'Новая коллекция') && !(await has(c, 'Заказать из-за границы')));
});

await step('adm33–34 · посылки и журнал', async () => {
  const p = await page('?staff=owner&path=/admin/order/1040');
  ok('adm34: кнопка в заказе на складе в Китае', await btn(p, 'Разбить на посылки').isVisible());
  await btn(p, 'Разбить на посылки').click(); await wait(p);
  ok('adm34: экран', await has(p, 'Заказ 1040 · на складе в Китае') && await has(p, 'Каждая посылка получит свой счёт за доставку'));
  await btn(p, 'Добавить посылку').click(); await wait(p, 200);
  ok('adm34: пустая посылка — сохранить нельзя', await has(p, 'Пустая посылка') && await btn(p, 'Заполните все посылки').isDisabled());
  ok('adm34: посылок не больше, чем вещей', !(await btn(p, 'Добавить посылку').count()));
  await p.getByRole('radiogroup', { name: 'Посылка для: Свитшот с вышивкой' }).getByRole('radio', { name: 'Посылка 2' }).click(); await wait(p, 200);
  ok('adm34: итог по посылкам', !(await has(p, 'Пустая посылка')) && (await p.getByText('1 вещь', { exact: true }).count()) === 2);
  await btn(p, 'Сохранить · 2 посылки').click(); await wait(p, 800);
  ok('adm34: сохранено, у каждой посылки свой счёт', await has(p, 'Покупатель увидит посылки в заказе') && await btn(p, 'Посылки: 2 · изменить').isVisible()
    && await btn(p, 'Выставить счёт за доставку · посылка 1').isVisible() && await btn(p, 'Выставить счёт за доставку · посылка 2').isVisible());
  await btn(p, 'Выставить счёт за доставку · посылка 1').click(); await wait(p);
  await p.getByRole('dialog').getByLabel('Вес посылки').fill('1,1');
  await p.getByRole('dialog').getByLabel('Сумма к оплате').fill('1700');
  await btn(p, 'Выставить 1\u00a0700 ₽').click(); await wait(p, 700);
  ok('adm34: посылка со счётом — состав больше не меняется', !(await btn(p, 'Посылки: 2 · изменить').count()));

  await p.getByRole('button', { name: /^Назад/ }).first().click(); await wait(p);
  await p.getByRole('button', { name: 'Ещё', exact: true }).click(); await wait(p);
  await p.getByText('Журнал действий').click(); await wait(p);
  ok('adm33: журнал', await has(p, 'Все действия сотрудников, хранится 12 месяцев') && await has(p, 'Вчера'));
  ok('adm33: свои действия сверху', /Счёт за доставку · посылка 1/.test(await p.locator('button.press-row').first().innerText()) && await has(p, 'Заказ разбит на 2 посылки'));
  await p.getByRole('group', { name: 'Тип действия' }).getByRole('button', { name: 'Склад' }).click(); await wait(p, 200);
  ok('adm33: фильтр по типу', await has(p, 'Добавлен трек CDEK') && !(await has(p, 'Изменён курс ЦБ')));
  await p.getByRole('group', { name: 'Сотрудник' }).getByRole('button', { name: 'Лиза' }).click(); await wait(p, 200);
  ok('adm33: пусто', await has(p, 'Действий нет'));
  await p.getByRole('group', { name: 'Тип действия' }).getByRole('button', { name: 'Все действия' }).click(); await wait(p, 200);
  ok('adm33: фильтр по сотруднику', await has(p, 'Отзыв опубликован') && !(await has(p, 'Добавлен трек CDEK')));
  await p.getByText('Отзыв опубликован').click(); await wait(p);
  ok('adm33: строка открывает объект', await has(p, 'на модерации') && !(await has(p, 'Все действия сотрудников')));
  const m = await page('?staff=manager&path=/admin/more');
  ok('adm33: менеджер журнала не видит', !(await has(m, 'Журнал действий')));
  const n = await page('?staff=manager&path=/admin/log');
  ok('adm33: прямой адрес закрыт', await has(n, 'Нет доступа'));
});

await step('adm25–27 · роли', async () => {
  const p = await page('?staff=owner&path=/admin/summary');
  await p.getByRole('button', { name: /Проблемы/ }).click(); await wait(p);
  ok('adm25: этап → заказы с фильтром', await p.getByRole('group', { name: 'Этап заказа' }).getByRole('button', { name: /^Проблемы/ }).getAttribute('aria-pressed') === 'true');
  const s = await page('?staff=stock&path=/admin');
  ok('adm26: склад — 2 задачи, без каталога', (await badge(s)) === '2' && !(await s.getByRole('button', { name: 'Каталог', exact: true }).count()));
  const n = await page('?staff=stock&path=/admin/settings');
  ok('adm27: нет доступа', await has(n, 'Нет доступа'));
  const m = await page('?staff=manager&path=/admin');
  ok('менеджер: без фото/треков/отзывов, без каталога', !(await has(m, 'Фотоотчёт · заказ')) && !(await has(m, 'Трек CDEK')) && !(await m.getByRole('button', { name: 'Каталог', exact: true }).count()));
  const c = await page('?staff=content&path=/admin/more');
  ok('контент: в «Ещё» нет курса и сотрудников', !(await has(c, 'Курс, комиссия, услуги')) && !(await has(c, 'Сотрудники и права')) && await has(c, 'Отзывы'));
  const o = await page('?staff=owner&offline&path=/admin/pay/p-1041');
  await btn(o, 'Подтвердить оплату').click(); await wait(o, 700);
  ok('нет сети: действие не прошло', await has(o, 'Нет соединения') && !(await has(o, 'Оплата подтверждена')));
});

await b.close();
console.log(res.join('\n'));
console.log('console errors:', errs.length ? '\n' + errs.join('\n') : 'none');
process.exit(res.some((r) => r.startsWith('FAIL')) || errs.length ? 1 : 0);
