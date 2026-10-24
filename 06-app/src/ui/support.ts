import { openTg } from '../telegram/tma';
import type { SheetSpec } from './Sheet';

/**
 * Аккаунт поддержки (по умолчанию — заглушка @your_support);
 * VITE_SUPPORT_BOT подменяет его без правки кода. Имя на «bot» — бот: контекст уходит параметром /start.
 * Иначе — человек: ссылка t.me/<имя>?text=… подставляет готовое сообщение в поле ввода.
 */
const SUPPORT = (import.meta.env.VITE_SUPPORT_BOT || 'your_support').trim().replace(/^@/, '');
const isBot = /bot$/i.test(SUPPORT);

/** Первое сообщение по контексту: order_1042, claim_1042, size, help, boot, maint. */
function supportText(context?: string): string {
  const [kind, id] = (context ?? '').split('_');
  if (kind === 'order' && id) return `Здравствуйте! Вопрос по заказу №${id}.`;
  if (kind === 'claim' && id) return `Здравствуйте! Не согласен с решением по обращению к заказу №${id}.`;
  if (kind === 'size') return 'Здравствуйте! Нужна помощь с размером.';
  if (kind === 'boot') return 'Здравствуйте! Не открывается приложение labeled.';
  if (kind === 'maint') return 'Здравствуйте! Когда закончатся технические работы в labeled?';
  return 'Здравствуйте! Вопрос по labeled.';
}

/** text — своё сообщение вместо типового (для человека; бот получает только контекст). */
export function supportUrl(context?: string, text?: string): string | null {
  if (!SUPPORT) return null;
  const base = `https://t.me/${SUPPORT}`;
  if (isBot) return base + (context ? '?start=' + encodeURIComponent(context.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)) : '');
  return base + '?text=' + encodeURIComponent(text || supportText(context));
}

export function openSupport(context?: string, text?: string) {
  const url = supportUrl(context, text);
  if (url) openTg(url);
}

/** Лист «Поддержка в Telegram». context — например, order_1042. */
export function supportSheet(context?: string): SheetSpec {
  const url = supportUrl(context);
  return {
    title: 'Поддержка в Telegram',
    text: url ? 'Откроется чат с менеджером labeled. Текст с номером заказа уже будет в поле ввода — останется отправить.' : 'Чат поддержки пока не подключён.',
    btns: [
      { label: 'Открыть Telegram', kind: 'primary', dis: !url, on: () => openSupport(context) },
      { label: 'Отмена', kind: 'ghost' },
    ],
  };
}
