// Регрессия интерфейса (аудит 2026-10-09): тост ошибки, фокус в листе и после перехода, кнопка оформления,
// клавиатура, альбомная ориентация, ширины 430–1280, уменьшенное движение.
// Запуск: npm run dev, затем node scripts/check-ux.mjs [папка для снимков]. Код выхода 1 при ошибке.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const out = process.argv[2] ?? tmpdir() + '/lb-check-ux';
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const browser = await chromium.launch();
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'OK   ' : 'FAIL ') + name); if (!cond) fails++; };
const open = async (q, w = 390, h = 844, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: w < 500, ...opts });
  const p = await ctx.newPage();
  await p.goto(BASE + q, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  return p;
};
const active = (p) => p.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('role') || a.tagName.toLowerCase()) + ':' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40) : ''; });

// 1. Тост ошибки: без сети отправить заявку по ссылке.
{
  const p = await open('?path=/link', 320, 640);
  await p.context().setOffline(true);
  await p.getByRole('button', { name: 'Отправить на проверку' }).click();
  await p.waitForTimeout(600);
  const t = await p.locator('[data-anim=toast]').textContent();
  ok('тост ошибки: «Нет соединения» с пометкой ошибки для диктора', /Ошибка: Нет соединения/.test(t));
  await p.screenshot({ path: `${out}/toast-error-320.png` });
  await p.locator('[data-anim=toast] > span').evaluate((el) => { el.lastChild.textContent = 'Вход устарел — закройте приложение и откройте его заново'; });
  const box = await p.locator('[data-anim=toast]').boundingBox();
  ok('длинный тост помещается в 320 px', box.x >= 0 && box.x + box.width <= 320);
  await p.screenshot({ path: `${out}/toast-long-320.png` });
  await p.waitForTimeout(2600);
  ok('тост ошибки виден дольше 3 с', await p.locator('[data-anim=toast]').count() === 1);
  await p.context().close();
}

// 2. Лист: фокус внутри, Tab не уходит, Esc закрывает, фокус возвращается.
{
  const p = await open('?path=/help');
  const faq = p.getByRole('button', { name: /Как считается стоимость/ });
  await faq.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(450);
  ok('лист открыт и фокус в нём', (await active(p)).startsWith('dialog:'));
  for (let i = 0; i < 4; i++) await p.keyboard.press('Tab');
  ok('Tab остаётся внутри листа', await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  ok('Esc закрывает лист', await p.locator('[role=dialog]').count() === 0);
  ok('фокус вернулся на кнопку вопроса', /Как считается стоимость/.test(await active(p)));
  await p.context().close();
}

// 3. Переход: фокус на заголовке нового экрана; поиск сохраняет autoFocus.
{
  const p = await open('?path=/profile');
  await p.getByRole('button', { name: 'Все заказы' }).click(); await p.waitForTimeout(500);
  ok('после перехода фокус на заголовке «Мои заказы»', /^h1:Мои заказы/.test(await active(p)));
  ok('ориентир main есть', await p.locator('main').count() === 1);
  const c = await open('');
  await c.getByRole('button', { name: /Искать на labeled/ }).click(); await c.waitForTimeout(500);
  ok('поиск: фокус остаётся в поле', /^input|searchbox/.test(await active(c)) || (await active(c)).startsWith('input'));
  await p.context().close(); await c.context().close();
}

// 4. Оформление: кнопка ведёт к выбору получения.
{
  const p = await open('?path=/cart');
  await p.getByRole('button', { name: 'Оформить' }).click(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: 'Выбрать получение' }).click(); await p.waitForTimeout(500);
  ok('«Выбрать получение» открывает выбор способа', /Способ получения|Получение/.test(await p.locator('h1').first().innerText()));
  await p.context().close();
}

// 5. Малая высота (клавиатура) и альбомная ориентация, широкие экраны.
{
  const p = await open('?path=/addresses/new', 390, 844);
  await p.locator('input').first().focus(); await p.setViewportSize({ width: 390, height: 460 }); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/keyboard-address-390x460.png` });
  ok('при клавиатуре нижняя навигация скрыта', await p.locator('nav[aria-label="Разделы"]').count() === 0);
  await p.context().close();
  for (const [q, n] of [['', 'catalog'], ['?path=/cart', 'cart']]) {
    const l = await open(q, 844, 390);
    await l.screenshot({ path: `${out}/landscape-${n}-844x390.png` });
    ok(`альбомная ${n}: нет горизонтальной прокрутки`, await l.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await l.context().close();
  }
  for (const w of [430, 768, 1280]) {
    const d = await open('', w, w === 1280 ? 800 : 932);
    await d.screenshot({ path: `${out}/catalog-${w}.png` });
    ok(`ширина ${w}: нет горизонтальной прокрутки`, await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await d.context().close();
  }
}

// 6. Уменьшенное движение: лист и тост появляются без сдвига.
{
  const p = await open('?path=/help', 390, 844, { reducedMotion: 'reduce' });
  await p.getByRole('button', { name: /Как считается стоимость/ }).click(); await p.waitForTimeout(100);
  const anim = await p.locator('[data-anim=sheet]').evaluate((el) => getComputedStyle(el).animationName);
  ok('reduce: у листа нет выезда', anim === 'none');
  await p.context().close();
}

await browser.close();
console.log(fails ? `FAILS: ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
