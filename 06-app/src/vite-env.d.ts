/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ссылка на бота для экрана «Открыто вне Telegram», например https://t.me/your_bot/app */
  readonly VITE_BOT_LINK?: string;
  /** Аккаунт поддержки вместо @your_support: человек (текст подставляется через ?text=) или бот на «bot» (контекст в /start). */
  readonly VITE_SUPPORT_BOT?: string;
  /** Карточка labeled на Яндекс Картах — для дубля отзыва (AB). */
  readonly VITE_YANDEX_MAPS_URL?: string;
}
