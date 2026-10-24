import {
  backButton,
  emitEvent,
  hapticFeedback,
  init,
  isTMA,
  miniApp,
  mockTelegramEnv,
  openTelegramLink,
  openLink,
  requestContact,
  requestWriteAccess,
  shareURL,
  retrieveLaunchParams,
  retrieveRawInitData,
  swipeBehavior,
  viewport,
} from '@telegram-apps/sdk-react';

/**
 * Где запущено приложение:
 * - telegram — настоящий Telegram, есть нативная кнопка «Назад»;
 * - mock — браузер разработчика или демо (?demo), окружение Telegram подменено;
 * - none — обычный браузер без initData, показываем экран «Открыто вне Telegram» (BB).
 */
export type TmaEnv = 'telegram' | 'mock' | 'none';

let env: TmaEnv = 'none';
export const tmaEnv = () => env;
/** Нативная кнопка «Назад» есть только в настоящем Telegram — иначе показываем свою в шапке. */
export const hasNativeBack = () => env === 'telegram';

const DEMO_USER = { id: 1001, first_name: 'Анна', last_name: 'Смирнова', username: 'anna_smirnova', language_code: 'ru', photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&q=68' };

function mockEnv() {
  const noInsets = { left: 0, top: 0, right: 0, bottom: 0 };
  const theme = { bg_color: '#F7F7F5', text_color: '#111111', button_color: '#C6FF00', button_text_color: '#111111' } as const;
  mockTelegramEnv({
    onEvent(e) {
      if (e[0] === 'web_app_request_theme') return emitEvent('theme_changed', { theme_params: theme });
      if (e[0] === 'web_app_request_viewport') {
        return emitEvent('viewport_changed', { height: window.innerHeight, width: window.innerWidth, is_expanded: true, is_state_stable: true });
      }
      if (e[0] === 'web_app_request_content_safe_area') return emitEvent('content_safe_area_changed', noInsets);
      if (e[0] === 'web_app_request_safe_area') return emitEvent('safe_area_changed', noInsets);
    },
    launchParams: new URLSearchParams([
      ['tgWebAppThemeParams', JSON.stringify(theme)],
      ['tgWebAppData', new URLSearchParams([
        ['auth_date', String(Math.floor(Date.now() / 1000))],
        ['hash', 'demo-hash'],
        ['signature', 'demo-signature'],
        ['user', JSON.stringify(DEMO_USER)],
      ]).toString()],
      ['tgWebAppVersion', '8.4'],
      ['tgWebAppPlatform', 'tdesktop'],
    ]),
  });
}

/**
 * Признаки настоящего клиента Telegram. isTMA() сам по себе не годится: после перезагрузки
 * страницы в браузере SDK находит параметры, сохранённые демо-режимом в sessionStorage.
 */
function insideTelegramClient(): boolean {
  const w = window as unknown as { TelegramWebviewProxy?: unknown };
  return !!w.TelegramWebviewProxy || window.parent !== window || /tgWebAppData|tgWebAppPlatform/.test(location.hash);
}

/** Запуск SDK. Возвращает окружение; ошибки SDK не роняют приложение. */
export function bootTelegram(): TmaEnv {
  const demo = import.meta.env.DEV || new URLSearchParams(location.search).has('demo');
  if (insideTelegramClient() && isTMA()) env = 'telegram';
  else if (demo) { mockEnv(); env = 'mock'; }
  else { env = 'none'; return env; }

  try {
    init();
    backButton.mount.ifAvailable();
    swipeBehavior.mount.ifAvailable();
    // Листы и экраны прокручиваются сами — свайп вниз не должен сворачивать приложение.
    swipeBehavior.disableVertical.ifAvailable();
    if (miniApp.mountSync.isAvailable()) {
      miniApp.mountSync();
      miniApp.setBackgroundColor.ifAvailable('#F7F7F5');
      miniApp.setBottomBarColor.ifAvailable('#F7F7F5');
    }
    if (viewport.mount.isAvailable()) {
      viewport.mount()
        .then(() => {
          viewport.bindCssVars.ifAvailable();
          viewport.expand.ifAvailable();
          // На телефоне — во весь экран (шапку сдвигает --safe-top с отступом под кнопки Telegram), на ПК — обычное окно.
          if (MOBILE.includes(launchPlatform()) && viewport.requestFullscreen.isAvailable()) {
            viewport.requestFullscreen().catch((e: unknown) => console.warn('[tma] fullscreen', e));
          }
        })
        .catch((e: unknown) => console.warn('[tma] viewport', e));
    }
    miniApp.ready.ifAvailable();
  } catch (e) {
    console.warn('[tma] init failed', e);
  }
  return env;
}

/** Пользователь из initData (имя, фото). Подлинность initData проверяет сервер. */
export function launchUser() {
  try {
    const lp = retrieveLaunchParams();
    return lp.tgWebAppData?.user ?? null;
  } catch {
    return null;
  }
}

const MOBILE = ['ios', 'android', 'android_x'];

/** Платформа клиента Telegram: ios, android, tdesktop, macos, weba… */
function launchPlatform(): string {
  try {
    return retrieveLaunchParams().tgWebAppPlatform ?? '';
  } catch {
    return '';
  }
}

export function launchStartParam(): string | undefined {
  try {
    return retrieveLaunchParams().tgWebAppStartParam;
  } catch {
    return undefined;
  }
}

/** Цвет системной шапки Telegram под верх текущего экрана. */
export function setChromeColor(color: `#${string}`) {
  if (env === 'none') return;
  miniApp.setHeaderColor.ifAvailable(color);
}

export const haptic = {
  light: () => { if (env !== 'none') hapticFeedback.impactOccurred.ifAvailable('light'); },
  select: () => { if (env !== 'none') hapticFeedback.selectionChanged.ifAvailable(); },
  error: () => { if (env !== 'none') hapticFeedback.notificationOccurred.ifAvailable('error'); },
  success: () => { if (env !== 'none') hapticFeedback.notificationOccurred.ifAvailable('success'); },
};

export function bindBackButton(visible: boolean, onBack: () => void): () => void {
  if (env !== 'telegram') return () => {};
  if (visible) backButton.show.ifAvailable(); else backButton.hide.ifAvailable();
  const [, off] = backButton.onClick.ifAvailable(onBack);
  return () => { if (typeof off === 'function') off(); };
}

/** Открыть чат или бота в Telegram (поддержка, приглашения). Вне Telegram — обычный переход. */
export function openTg(url: string) {
  if (env === 'telegram' && openTelegramLink.isAvailable()) openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

/** Внешняя ссылка (CDEK, документы): в Telegram открывается во встроенном браузере. */
export function openExternal(url: string) {
  if (env === 'telegram' && openLink.isAvailable()) openLink(url);
  else window.open(url, '_blank', 'noopener');
}

/** Номер телефона из Telegram (AR). null — пользователь отказал или метод недоступен. */
export async function requestPhone(): Promise<{ phone: string; name: string } | null> {
  if (env !== 'telegram' || !requestContact.isAvailable()) return null;
  try {
    const r = await requestContact();
    const c = r.contact;
    const phone = c.phone_number.startsWith('+') ? c.phone_number : '+' + c.phone_number;
    return { phone, name: [c.first_name, c.last_name].filter(Boolean).join(' ') };
  } catch {
    return null;
  }
}

/** Разрешение боту присылать сообщения (уведомления о заказах, AE/AP). */
export async function requestBotMessages(): Promise<boolean> {
  if (env !== 'telegram') return true;
  if (!requestWriteAccess.isAvailable()) return false;
  try { return (await requestWriteAccess()) === 'allowed'; } catch { return false; }
}

/** «Поделиться» средствами Telegram: выбор чата и готовый текст. */
export function shareLink(url: string, text?: string) {
  if (env === 'telegram' && shareURL.isAvailable()) shareURL(url, text);
  else window.open('https://t.me/share/url?url=' + encodeURIComponent(url) + (text ? '&text=' + encodeURIComponent(text) : ''), '_blank', 'noopener');
}

/** Ссылка на Mini App с параметром запуска: приглашение, карточка товара. */
export function appLink(startParam: string) {
  const base = import.meta.env.VITE_BOT_LINK || 'https://t.me/your_bot/app';
  return base + (base.includes('?') ? '&' : '?') + 'startapp=' + encodeURIComponent(startParam);
}

/** Сырая строка initData — уходит на сервер для проверки подписи при входе. */
export function retrieveInitDataRaw(): string | undefined {
  try { return retrieveRawInitData(); } catch { return undefined; }
}
