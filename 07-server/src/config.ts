import { randomBytes } from 'node:crypto';

/** Настройки сервера из окружения. В продукте обязательны BOT_TOKEN, DATABASE_URL и FILE_SECRET. */
export type Config = {
  port: number;
  host: string;
  production: boolean;
  databaseUrl?: string;
  pgliteDir?: string;
  /** Токен бота: проверка initData и сообщения покупателям. */
  botToken: string;
  /** Срок действия initData, секунд. */
  initDataTtl: number;
  /**
   * Разработка без Telegram: заголовок x-dev-user: <tgId> вместо initData. Только вне production и,
   * пока не задан BOT_TOKEN, — чтобы сервер с настоящим ботом и забытым NODE_ENV не пускал по заголовку.
   * Принудительно: DEV_AUTH=1 (вне production) или DEV_AUTH=0.
   */
  devAuth: boolean;
  uploadDir: string;
  /** Ключ подписи ссылок на приватные файлы (чеки, фото обращений). */
  fileSecret: string;
  /** Адрес API снаружи — для ссылок на файлы. */
  publicUrl: string;
  corsOrigin: string[];
  /** Ссылка на Mini App для приглашений сотрудников (t.me/<бот>/app). */
  botLink: string;
  /** Отправлять сообщения бота: есть BOT_TOKEN и это не тесты. */
  botMessages: boolean;
  /** Адрес Bot API; прокси, если api.telegram.org с сервера недоступен. */
  telegramApi: string;
  maxUploadMb: number;
  /** Курсы ЦБ на день (XML_daily, юань — CNY); пусто — автокурс выключен (тесты). */
  cbrUrl: string;
  /** Ящик магазина для писем (подтверждение почты, уведомления). Без SMTP_USER и SMTP_PASS письма не отправляются. */
  smtp: { host: string; port: number; user: string; pass: string; fromName: string } | null;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const need = (k: string) => { if (production && !env[k]) throw new Error(`Не задана переменная ${k}`); return env[k] ?? ''; };
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    production,
    databaseUrl: production ? need('DATABASE_URL') : env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR ?? (env.DATABASE_URL ? undefined : './data/pglite'),
    botToken: need('BOT_TOKEN'),
    // 0 у библиотеки отключает проверку срока — такого значения не допускаем.
    initDataTtl: Number(env.INIT_DATA_TTL) > 0 ? Number(env.INIT_DATA_TTL) : 86400,
    devAuth: !production && (env.DEV_AUTH === '1' || (env.DEV_AUTH !== '0' && !env.BOT_TOKEN)),
    uploadDir: env.UPLOAD_DIR ?? './data/uploads',
    fileSecret: need('FILE_SECRET') || randomBytes(16).toString('hex'),
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${env.PORT ?? 8787}`).replace(/\/$/, ''),
    corsOrigin: (env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()).filter(Boolean),
    botLink: env.BOT_LINK ?? 'https://t.me/your_bot/app',
    botMessages: !!env.BOT_TOKEN && env.NODE_ENV !== 'test',
    telegramApi: (env.TELEGRAM_API ?? 'https://api.telegram.org').replace(/\/$/, ''),
    maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 10),
    cbrUrl: env.CBR_URL ?? (env.NODE_ENV === 'test' ? '' : 'https://www.cbr.ru/scripts/XML_daily.asp'),
    smtp: env.SMTP_USER && env.SMTP_PASS && env.NODE_ENV !== 'test'
      ? { host: env.SMTP_HOST ?? 'smtp.mail.ru', port: Number(env.SMTP_PORT ?? 465), user: env.SMTP_USER.trim(), pass: env.SMTP_PASS.replace(/\s+/g, '') /* пароль приложения показывают группами через пробел */, fromName: env.SMTP_FROM_NAME ?? 'labeled' }
      : null,
  };
}
