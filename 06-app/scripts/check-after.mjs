import { chromium } from 'playwright';
// Проверка сценариев после покупки (заход 3): обращение → ответ → возврат, отзыв, фотоотчёт, знакомство,
// платежи, системные состояния. Нужен запущенный `npm run dev`. Запуск: node scripts/check-after.mjs
const PIC = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') };
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
const step = async (name, fn) => { try { await fn(); } catch (e) { res.push('FAIL ' + name + ': ' + e.message.split('\n')[0]); } };

await step('M/Y/Z', async () => {
  const p = await page('?path=/claim/1046');
  ok('M: back row «Заказ»', await has(p, 'Заказ'));
  ok('M: send disabled before reason', await btn(p, 'Выберите причину').isDisabled());
  await p.getByText('Брак', { exact: true }).click();
  ok('M: Брак needs photo', await btn(p, 'Добавьте фото').isDisabled());
  await p.locator('input[type=file]').first().setInputFiles([PIC, PIC]);
  await p.waitForTimeout(200);
  ok('M: 2 photos counted', await has(p, '2 фото'));
  await btn(p, 'Отправить обращение').click(); await p.waitForTimeout(700);
  ok('M: sent note', await has(p, 'отправлено'));
  await btn(p, 'Показать ответ продавца').click(); await p.waitForTimeout(200);
  ok('Y: approved + refund bar', await has(p, 'Обращение одобрено') && await btn(p, 'Указать реквизиты для возврата').isVisible());
  await btn(p, 'Отказ').click(); await p.waitForTimeout(200);
  ok('Y: refusal', await has(p, 'Отказ по обращению') && await btn(p, 'Не согласен — в поддержку').isVisible());
  await btn(p, 'Нужны фото').click(); await p.waitForTimeout(200);
  ok('Y: more photos send disabled', await btn(p, 'Добавьте фото').isDisabled());
  await btn(p, 'Одобрено').click(); await p.waitForTimeout(200);
  await btn(p, 'Указать реквизиты для возврата').click(); await p.waitForTimeout(700);
  ok('Z: title', await has(p, 'Ждём реквизиты'));
  await btn(p, 'На карту').click();
  const card = p.getByPlaceholder('0000 0000 0000 0000');
  await card.fill('22001234567');
  ok('Z: card mask partial', (await card.inputValue()) === '2200 1234 567');
  ok('Z: label Введите номер карты', await btn(p, 'Введите номер карты').isDisabled());
  await card.fill('2200123456789012');
  ok('Z: card mask full', (await card.inputValue()) === '2200 1234 5678 9012');
  ok('Z: label Выберите банк', await btn(p, 'Выберите банк').isDisabled());
  await btn(p, 'Другой').click(); await p.waitForTimeout(150);
  ok('Z: other → still choose bank', await btn(p, 'Выберите банк').isDisabled());
  await p.getByPlaceholder('Например: Совкомбанк').fill('Совкомбанк');
  ok('Z: send enabled', await btn(p, 'Отправить реквизиты').isEnabled());
  await btn(p, 'Отправить реквизиты').click(); await p.waitForTimeout(700);
  ok('Z: sent state', await has(p, 'Продавец готовит перевод') && await has(p, '9012'));
  await btn(p, 'Показать: продавец перевёл').click(); await p.waitForTimeout(200);
  ok('Z: done', await has(p, 'Возврат отправлен'));
  await p.close();
});

await step('Z non-stock', async () => {
  const p = await page('?path=/refund/1042');
  ok('Z: non-stock unavailable', await has(p, 'недоступен') || await has(p, 'не возвращаются'));
  await p.close();
});

await step('AB/AC', async () => {
  let p = await page('?path=/review/1040');
  ok('AB: disabled without stars', await btn(p, 'Поставьте оценку').isDisabled());
  await p.getByRole('radio', { name: '5 из 5' }).click();
  ok('AB: enabled after stars', await btn(p, 'Отправить отзыв').isEnabled());
  await p.getByLabel('Текст отзыва').fill('Размер совпал, ткань плотная.');
  await btn(p, 'Отправить отзыв').click(); await p.waitForTimeout(700);
  ok('AB: on moderation', await has(p, 'Отзыв на модерации'));
  await p.close();
  p = await page('?path=/reviews');
  const n = await p.locator('text=Покупка подтверждена ·').count();
  ok('AC: reviews listed (' + n + ')', n > 0);
  await p.close();
});

await step('V/AG', async () => {
  const p = await page('?path=/photo/1046');
  ok('V: no save/share', !(await has(p, 'Сохранить фото')) && !(await has(p, 'Поделиться')));
  await p.getByRole('button', { name: 'Открыть фото на весь экран' }).click(); await p.waitForTimeout(500);
  const t = await p.locator('body').innerText();
  ok('V→AG fullscreen opened', /1\s*\/\s*3|1 из 3/.test(t) && !(await has(p, 'Проблема с заказом')));
  await p.close();
});

await step('AD/AE', async () => {
  const p = await page('?onboarding');
  await btn(p, 'Далее').click(); await p.waitForTimeout(250);
  await btn(p, 'Далее').click(); await p.waitForTimeout(250);
  await btn(p, 'Начать').click(); await p.waitForTimeout(500);
  ok('AD → AE', await has(p, 'Не пропустите'));
  await btn(p, 'Включить').click(); await p.waitForTimeout(500);
  ok('AE: enabled state', await btn(p, 'Продолжить').isVisible());
  await btn(p, 'Продолжить').click(); await p.waitForTimeout(600);
  ok('AE → catalog', await has(p, 'Искать на labeled'));
  await p.close();
});

await step('W/K', async () => {
  let p = await page('?path=/payments');
  ok('W: groups', await has(p, 'Требуют действия') && await has(p, 'На проверке') && await has(p, 'Подтверждены'));
  await p.close();
  p = await page('?path=/pay/p-1038');
  ok('K: seller receipt shown', await has(p, 'Чек продавца'));
  await p.close();
});

await step('AH/BA/Q', async () => {
  for (const [q, t] of [['?scenario=update', 'Обновите приложение'], ['?scenario=maint', 'Идут технические работы'], ['?offline', 'Нет соединения']]) {
    const p = await page(q); ok(q + ' → ' + t, await has(p, t)); await p.close();
  }
  const p = await page('?scenario=booterr'); ok('BA loading', await has(p, 'Открываем labeled'));
  await p.waitForTimeout(6300); ok('BA slow hint after 6s', await has(p, 'Соединение медленное') && !(await has(p, 'Не удалось открыть labeled')));
  // Ждём появления, а не ровно 24 с: под нагрузкой таймеры страницы в headless Chrome отставали на ~7 с, а запас был 0,3 с.
  const gaveUp = await p.waitForFunction(() => document.body.innerText.includes('Не удалось открыть labeled'), null, { timeout: 45000 }).then(() => true, () => false);
  ok('BA error after 30s', gaveUp && await has(p, 'Сервер не ответил')); await p.close();
});

console.log(res.join('\n'));
console.log('console errors:', errs.length ? '\n' + errs.join('\n') : 'none');
await b.close();
if (errs.length || res.some((r) => r.startsWith('FAIL'))) process.exit(1);
