import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// Скрины для пользователя: расцветки отдельными карточками в каталоге и свой цвет в админке (2026-10-22). Нужен `npm run dev` на моках.
const B = process.env.BASE || 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../reports/colors-catalog-2026-10-22/', import.meta.url));
const b = await chromium.launch();
const page = async (q) => { const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); await p.goto(B + q); await p.waitForTimeout(900); return p; };
const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' });

const s = await page('');
await s.getByRole('button', { name: /Искать на labeled/ }).click(); await s.waitForTimeout(500);
await s.keyboard.type('футболка с принтом'); await s.waitForTimeout(1200);
await shot(s, '1-poisk-tri-kartochki');
await s.getByRole('button', { name: /Футболка с принтом/ }).nth(1).click(); await s.waitForTimeout(2500);
await shot(s, '2-kartochka-otkrylas-v-cvete');

const a = await page('?staff=owner&path=/admin/item/tee');
await a.getByRole('button', { name: /Цвет/ }).nth(1).click(); await a.waitForTimeout(600);
await shot(a, '3-admin-vybor-cveta');
await a.getByRole('button', { name: 'Другой цвет', exact: true }).click(); await a.waitForTimeout(600);
await a.getByPlaceholder('Например: Оливковый').fill('Оливковый');
await a.getByRole('radio', { name: 'Зелёный' }).click(); await a.waitForTimeout(400);
await shot(a, '4-admin-drugoy-cvet');
await a.getByRole('button', { name: 'Готово', exact: true }).click(); await a.waitForTimeout(600);
await a.getByText('Оливковый · в фильтре «Зелёный»').scrollIntoViewIfNeeded();
await shot(a, '5-admin-cvet-dobavlen');
await b.close();
console.log('ok');
