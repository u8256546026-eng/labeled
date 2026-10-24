import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// Скрины для пользователя: несколько категорий у вещи в админке (2026-10-22). Нужен `npm run dev` на моках.
const B = process.env.BASE || 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../reports/categories-2026-10-22/', import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto(B + '?staff=owner&path=/admin/item/tee'); await p.waitForTimeout(900);
await p.getByRole('button', { name: /^Категория/ }).click(); await p.waitForTimeout(600);
await p.getByRole('switch', { name: /Свитеры и худи/ }).click(); await p.waitForTimeout(300);
await p.screenshot({ path: OUT + '1-vybor-kategoriy.png' });
await p.getByRole('button', { name: 'Готово', exact: true }).click(); await p.waitForTimeout(600);
await p.getByText('Футболки, Свитеры и худи').scrollIntoViewIfNeeded();
await p.screenshot({ path: OUT + '2-kategorii-u-veshchi.png' });
await b.close();
console.log('ok');
