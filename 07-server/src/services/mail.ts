import nodemailer from 'nodemailer';
import type { Config } from '../config';

/** Письмо покупателю: текст и тот же текст в HTML с кнопкой. */
export type Letter = { to: string; subject: string; text: string; html: string };
/** Отправка писем. Тесты подставляют свою, без SMTP_USER/SMTP_PASS её нет — письма не уходят. */
export type Mailer = { send(l: Letter): Promise<void> };

/** Ящик магазина по SMTP (mail.ru: smtp.mail.ru:465, пароль для внешних приложений). Отправитель — сам ящик. */
export function smtpMailer(c: NonNullable<Config['smtp']>): Mailer {
  const t = nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  const from = { name: c.fromName, address: c.user };
  return { async send(l) { await t.sendMail({ from, ...l }); } };
}

/** Постоянный отказ сервера почты (5xx: нет такого ящика, адрес отклонён) — повтор не поможет. */
export const permanentMailError = (err: unknown) => {
  const code = (err as { responseCode?: number })?.responseCode;
  return typeof code === 'number' && code >= 500 && code < 600;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Оформление писем и страницы ссылки — вариант A (выбор пользователя 2026-10-22, 06-app/reports/email-design-2026-10-22/):
// лаймовая шапка с логотипом, как верх экранов приложения, белая карточка, чёрная кнопка. Цвета — токены приложения.
const LIME = '#C6FF00', INK = '#111111', INK2 = '#242424', INK3 = '#6B6B65', PAPER = '#F7F7F5';
const FONT = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
/** Логотип 1091×535 из сборки приложения (06-app/public/assets). Почта без картинок покажет alt «labeled». */
const LOGO = '/assets/lbld-black.png';
const logo = (src: string, h: number) => `<img src="${esc(src)}" alt="labeled" width="${Math.round((h * 1091) / 535)}" height="${h}" style="display:block;border:0;outline:none;height:${h}px;width:auto;font:800 24px ${FONT};color:${INK}">`;

/**
 * Письмо: шапка с логотипом, заголовок, абзацы, кнопка и подпись мелким шрифтом. Вёрстка таблицами и
 * встроенными стилями — так письмо одинаково показывают Mail.ru, Gmail, Яндекс и Outlook.
 */
function letter(config: { publicUrl: string }, to: string, subject: string, title: string, lines: string[], button: { label: string; url: string }, foot: string): Letter {
  const text = [title, '', ...lines, '', `${button.label}: ${button.url}`, '', foot].join('\n');
  const p = (l: string, last: boolean) => `<p style="margin:0 0 ${last ? 28 : 12}px;font:400 16px/1.55 ${FONT};color:${INK2}">${esc(l)}</p>`;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(lines[0] ?? title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden">
<tr><td style="background:${LIME};padding:28px 32px 24px;border-radius:0 0 24px 24px">${logo(config.publicUrl + LOGO, 34)}</td></tr>
<tr><td style="padding:28px 32px 32px">
<h1 style="margin:0 0 16px;font:800 26px/1.2 ${FONT};letter-spacing:-0.02em;color:${INK}">${esc(title)}</h1>
${lines.map((l, i) => p(l, i === lines.length - 1)).join('\n')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:${INK};border-radius:14px">
<a href="${esc(button.url)}" style="display:block;padding:16px 20px;font:700 16px/1.25 ${FONT};color:#FFFFFF;text-decoration:none">${esc(button.label)}</a>
</td></tr></table>
<p style="margin:24px 0 0;font:400 13px/1.5 ${FONT};color:${INK3}">${esc(foot)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { to, subject, text, html };
}

export const EMAIL_LINK_HOURS = 24;

export const confirmLetter = (config: { publicUrl: string }, to: string, url: string) => letter(config, to, 'Подтвердите почту в labeled', 'Подтвердите почту', [
  'Вы привязали эту почту к аккаунту labeled в Telegram.',
  'Подтвердите адрес — после этого в первом заказе будет доступна скидка 50% на комиссию, а уведомления о заказах смогут приходить на почту.',
], { label: 'Подтвердить почту', url }, `Ссылка действует ${EMAIL_LINK_HOURS} часа. Если вы не привязывали почту, просто удалите это письмо.`);

export const eventLetter = (config: { publicUrl: string }, to: string, title: string, sub: string, button: { label: string; url: string }) =>
  letter(config, to, title, title, sub ? [sub] : [], button, 'Уведомления на почту можно выключить в labeled: Профиль → Настройки → Уведомления.');

const PAGE = {
  ok: ['Почта подтверждена', 'Вернитесь в labeled в Telegram — скидка 50% на комиссию доступна в первом заказе.'],
  expired: ['Ссылка устарела', 'Откройте labeled в Telegram: Профиль → Настройки → Почта — и отправьте письмо ещё раз.'],
  bad: ['Ссылка не подходит', 'Возможно, адрес почты уже изменили. Отправьте новое письмо из labeled: Профиль → Настройки → Почта.'],
} as const;

/** Страница перехода по ссылке из письма (открывается в браузере почты): шапка как в письме, значок, текст, кнопка в Mini App. */
export function confirmPage(r: keyof typeof PAGE, appUrl: string) {
  const [title, text] = PAGE[r];
  const mark = r === 'ok'
    ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
    : '<path d="M12 6.5v7"/><path d="M12 17.5v.01"/>';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light"><title>${title} · labeled</title>
<style>body{margin:0;background:${PAPER};color:${INK};font-family:${FONT};-webkit-font-smoothing:antialiased}
.top{background:${LIME};padding:calc(40px + env(safe-area-inset-top,0px)) 24px 24px;border-radius:0 0 28px 28px}
.top img{display:block;height:30px;width:auto}
main{max-width:440px;margin:0 auto;padding:32px 24px calc(32px + env(safe-area-inset-bottom,0px))}
.ic{width:56px;height:56px;border-radius:50%;background:${INK};display:flex;align-items:center;justify-content:center;margin:0 0 20px}
h1{margin:0 0 12px;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.02em}
p{margin:0 0 32px;font-size:16px;line-height:1.55;color:${INK2}}
a.btn{display:block;text-align:center;background:${INK};color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 20px;border-radius:14px}
@media (min-width:600px){.top{padding-left:calc(50% - 196px);padding-right:calc(50% - 196px)}}</style></head>
<body><div class="top">${logo(LOGO, 30)}</div>
<main><div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${LIME}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${mark}</svg></div>
<h1>${title}</h1><p>${text}</p><a class="btn" href="${esc(appUrl)}">Открыть labeled</a></main></body></html>`;
}
