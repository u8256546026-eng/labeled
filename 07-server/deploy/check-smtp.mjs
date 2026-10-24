// Проверка ящика для писем (SMTP_USER/SMTP_PASS) без вывода секретов: форма значений и вход в smtp.mail.ru.
// Запуск с Mac из корня проекта: ~/.local/node/bin/node 07-server/deploy/check-smtp.mjs [~/labeled-secrets.env]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const nodemailer = require('nodemailer');
const file = process.argv[2] ?? homedir() + '/labeled-secrets.env';
const lines = readFileSync(file, 'utf8').split(/\r?\n/);

/** Как systemd EnvironmentFile: KEY=VALUE, внешние кавычки снимаются. */
const parse = (raw) => raw.replace(/^\s+|\s+$/g, '').replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1');
function look(key) {
  const found = lines.filter((l) => new RegExp(`^\\s*(export\\s+)?${key}\\s*=`).test(l));
  const raw = found.length ? found.at(-1).replace(/^[^=]*=/, '') : '';
  return { found, raw, value: parse(raw) };
}
const shape = (raw, v) => [
  `длина ${v.length}`,
  /\s/.test(v) ? 'ЕСТЬ пробелы внутри' : 'без пробелов',
  raw !== raw.trim() ? 'пробел по краям' : '',
  /^["']|["']$/.test(raw.trim()) ? 'в кавычках' : '',
  /[а-яё]/i.test(v) ? 'ЕСТЬ русские буквы' : '',
  /^[A-Za-z0-9]+$/.test(v) ? 'только латиница и цифры' : 'есть другие символы',
].filter(Boolean).join(', ');

const u = look('SMTP_USER'), p = look('SMTP_PASS');
const bad = (k, x) => (x.found.length !== 1 ? ` — строк ${k}: ${x.found.length}${x.found.length > 1 ? ' (берётся последняя)' : ''}` : '');
const [local = '', domain = ''] = u.value.split('@');
console.log(`SMTP_USER: ${local.slice(0, 2)}***@${domain || '(нет @)'}; ${shape(u.raw, u.value)}${bad('SMTP_USER', u)}`);
console.log(`SMTP_PASS: ${shape(p.raw, p.value)}${bad('SMTP_PASS', p)}`);
for (const k of ['SMTP_HOST', 'SMTP_PORT']) if (look(k).found.length) console.log(`${k} задан: ${k === 'SMTP_PORT' ? look(k).value : look(k).value.replace(/^(.{3}).*/, '$1***')}`);
if (!u.value || !p.value) { console.log('Не заполнены SMTP_USER или SMTP_PASS.'); process.exit(1); }

async function tryLogin(label, pass) {
  const t = nodemailer.createTransport({ host: 'smtp.mail.ru', port: 465, secure: true, auth: { user: u.value.trim(), pass }, connectionTimeout: 10_000 });
  try {
    await t.verify();
    console.log(`Вход в smtp.mail.ru ${label}: УСПЕШНО — ящик и пароль подходят.`);
    return true;
  } catch (e) {
    console.log(`Вход в smtp.mail.ru ${label}: ОШИБКА ${e.responseCode ?? e.code ?? ''} ${String(e.response ?? e.message).slice(0, 200)}`);
    return false;
  }
}
// Пароль приложения показывают группами через пробел — сами пробелы в пароль не входят.
const okAsIs = await tryLogin('(как в файле)', p.value.trim());
if (!okAsIs && /\s/.test(p.value.trim())) {
  if (await tryLogin('(без пробелов)', p.value.replace(/\s+/g, ''))) console.log('→ Уберите пробелы в SMTP_PASS в файле и запустите push-env.sh.');
}
process.exit(okAsIs ? 0 : 1);
