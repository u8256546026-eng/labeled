import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
// Контраст белого заголовка на баннере с фото (7a): нужно не ниже 4.5:1 на любом пикселе под заголовком.
// Худший случай — сплошь белая картинка; второй прогон — светлое фото (PHOTO=путь), его снимок сохраняется (SHOT=путь).
// Нужен запущенный `npm run dev` (моки). Запуск: node scripts/check-banner-contrast.mjs (код выхода 1 при ошибке).
const B = process.env.BASE || 'http://localhost:5173/';
const b = await chromium.launch();
const res = [];

/** Белая картинка 1080 × 600 из canvas страницы. */
async function whitePng(p) {
  const url = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1080; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1080, 600); return c.toDataURL('image/png'); });
  return { name: 'white.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') };
}

async function run(label, file, shot, width = 390) {
  const p = await b.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(B + '?staff=content&path=/admin/banners'); await p.waitForTimeout(900);
  const pic = file ?? await whitePng(p);
  await p.getByRole('button', { name: 'Добавить баннер', exact: true }).click(); await p.waitForTimeout(400);
  await p.locator('input[type=file]').first().setInputFiles(pic); await p.waitForTimeout(600);
  // Длинный заголовок в 40 знаков — три строки, худшая ширина.
  await p.getByLabel('Заголовок').fill('Осенняя коллекция уже в каталоге labeled');
  await p.getByLabel('Текст кнопки').fill('Смотреть');
  await p.getByRole('button', { name: 'Сохранить', exact: true }).click(); await p.waitForTimeout(800);
  // Моки живут в памяти страницы: на главную — внутри приложения, без перезагрузки.
  await p.getByRole('button', { name: /^Назад/ }).first().click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Ещё', exact: true }).click(); await p.waitForTimeout(400);
  await p.getByText('Перейти в режим покупателя').click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Каталог', exact: true }).click(); await p.waitForTimeout(1200);
  const ban = p.locator('button', { hasText: 'Осенняя коллекция' }).first();
  await ban.evaluate((el) => el.scrollIntoView({ inline: 'start', block: 'nearest' })); await p.waitForTimeout(500);
  if (shot) await ban.screenshot({ path: shot });
  // Заголовок прозрачный — снимаем только фон под строками текста.
  const title = ban.locator('div').first();
  const rects = await title.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); el.style.color = 'transparent'; return [...r.getClientRects()].map((x) => ({ x: x.x, y: x.y, width: x.width, height: x.height })); });
  let worst = 0;
  for (const clip of rects) {
    const png = await p.screenshot({ clip });
    const L = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      let m = 0;
      for (let i = 0; i < d.length; i += 4) m = Math.max(m, 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
      return m;
    }, png.toString('base64'));
    worst = Math.max(worst, L);
  }
  const ratio = 1.05 / (worst + 0.05);
  res.push(`${ratio >= 4.5 ? 'OK  ' : 'FAIL'} ${label}, ${width} px: худший пиксель под заголовком — контраст ${ratio.toFixed(2)}:1 (${rects.length} строки)`);
  await p.close();
}

for (const w of [360, 390]) {
  await run('белая картинка', null, undefined, w);
  if (process.env.PHOTO) await run('фото', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: readFileSync(process.env.PHOTO) }, w === 390 ? process.env.SHOT : undefined, w);
}
await b.close();
console.log(res.join('\n'));
if (process.env.REPORT) writeFileSync(process.env.REPORT, res.join('\n') + '\n');
process.exit(res.some((x) => x.startsWith('FAIL')) ? 1 : 0);
