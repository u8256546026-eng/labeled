import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
// Собранное приложение с заголовками безопасности рабочего сервера (07-server/deploy/security-headers.conf):
// нарушение CSP в консоли — FAIL. Запуск после сборки: node scripts/check-csp.mjs [папка сборки, по умолчанию dist]
// Демо-режим (?demo) на моках: картинки товаров — внешние https, как и в продукте.
const here = fileURLToPath(new URL('.', import.meta.url));
const dist = process.argv[2] || join(here, '../dist');
const conf = readFileSync(join(here, '../../07-server/deploy/security-headers.conf'), 'utf8');
const headers = Object.fromEntries([...conf.matchAll(/^add_header ([\w-]+) "([^"]+)"/gm)].map((m) => [m[1], m[2]]));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json' };

const srv = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(dist, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;

const PAGES = ['?demo', '?demo&path=/product/tee', '?demo&path=/cart', '?demo&path=/link', '?demo&path=/profile', '?demo&path=/pay/p-1042-1', '?demo&path=/reviews', '?demo&staff=owner&path=/admin', '?demo&staff=owner&path=/admin/catalog'];
const b = await chromium.launch();
const bad = [];
for (const q of PAGES) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) bad.push(`${q}: ${m.text()}`); });
  p.on('pageerror', (e) => bad.push(`${q}: ${e.message}`));
  await p.goto(base + q);
  await p.waitForTimeout(1500);
  const shown = await p.locator('#root *').count();
  console.log((shown > 5 ? 'OK  ' : 'FAIL') + ' ' + q + (shown > 5 ? '' : ' — пустой экран'));
  if (shown <= 5) bad.push(q + ': пустой экран');
  await p.close();
}
await b.close();
srv.close();
console.log(bad.length ? 'нарушения:\n' + bad.join('\n') : 'нарушений CSP нет');
process.exit(bad.length ? 1 : 0);
