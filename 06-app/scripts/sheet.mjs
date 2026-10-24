// Сводные листы для общего прогона: по каждому кадру — снимок макета и все состояния приложения рядом.
// Запуск: node scripts/sheet.mjs <папка снимков shots.mjs> <папка листов> <кадров на лист> <кадр...>
import { chromium } from 'playwright';
import fs from 'node:fs';

const [dir, out, per, ...ids] = process.argv.slice(2);
const files = fs.readdirSync(dir);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
fs.mkdirSync(out, { recursive: true });
const groups = ids.map((id) => [id, files.filter((f) => f === `mock-${id}.png` || f === `app-${id}.png` || (f.startsWith(`app-${id}-`) && !ids.includes(f.slice(4, -4)))).sort((a) => (a.startsWith('mock') ? -1 : 1))]);
for (let i = 0; i < groups.length; i += +per) {
  const g = groups.slice(i, i + +per);
  const html = g.map(([id, list]) => `<div class="g"><b>${id}</b><div class="r">${list.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(dir + '/' + f).toString('base64')}"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('')}</div></div>`).join('');
  await p.setContent(`<style>body{margin:0;font:14px sans-serif;background:#777;display:flex;flex-wrap:wrap;gap:14px;padding:8px}.g{background:#555;padding:6px;border-radius:6px}.g b{color:#fff;font-size:18px}.r{display:flex;gap:6px;align-items:flex-start}figure{margin:0}img{width:250px;display:block}figcaption{color:#ddd;font-size:11px}</style>${html}`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/sheet-${String(i / +per).padStart(2, '0')}-${g.map((x) => x[0]).join('_')}.png`, fullPage: true });
}
await b.close();
