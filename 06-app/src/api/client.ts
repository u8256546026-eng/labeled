// API-слой. Без VITE_API_URL ответы берутся из src/mocks с небольшой задержкой (демо, сверка с макетами);
// с VITE_API_URL — запросы к серверу 07-server. Экраны вызывают одни и те же функции в обоих режимах.

export const MOCK_LATENCY = 260;

export class ApiError extends Error {
  /** HTTP-статус и код ошибки сервера: consent_required, price_changed, sold, open_orders… */
  constructor(public code: 'offline' | 'server', message?: string, public status = 0, public detail = '') {
    super(message ?? code);
  }
}

/** Режим отладки: ?offline в адресе — все запросы падают (экран «Нет соединения», Q). */
const forceOffline = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('offline');

export function mock<T>(fn: () => T, ms = MOCK_LATENCY): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (forceOffline() || (typeof navigator !== 'undefined' && navigator.onLine === false)) reject(new ApiError('offline'));
      else {
        try { resolve(structuredClone(fn())); } catch (e) { reject(e); }
      }
    }, ms);
  });
}

// «/» — сервер на том же адресе, что и приложение (рабочая версия: nginx отдаёт и то и другое).
// Так одна сборка работает с любого адреса сайта: и с example.com, и с прежнего sslip.io.
const RAW_API = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ?? '';
const API_URL = RAW_API.replace(/\/$/, '');

/** Работаем с сервером (VITE_API_URL задан) или на моках. */
export const live = () => RAW_API !== '';

/**
 * Заголовки входа. В Telegram — «tma <initData>», подпись проверяет сервер. В демо с сервером —
 * x-dev-user с id демо-пользователя (сервер принимает его только вне production). Задаётся при запуске.
 */
let authHeaders: () => Record<string, string> = () => ({});
export function setAuthHeaders(fn: () => Record<string, string>) { authHeaders = fn; }

/**
 * Сколько ждать ответа. Без предела зависший запрос в WebView (сеть пропала посреди ответа) держал бы экран
 * в загрузке бесконечно. Превышение — как «Нет соединения»: оформление и заявку можно повторить с тем же
 * ключом попытки, сервер не создаст второй заказ.
 */
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;

async function send<T>(method: string, path: string, body?: BodyInit | null, json = false): Promise<T> {
  if (forceOffline()) throw new ApiError('offline');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), body instanceof FormData ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(API_URL + path, { method, body, signal: ctl.signal, headers: { ...authHeaders(), ...(json ? { 'content-type': 'application/json' } : {}) } });
    text = await res.text();
  } catch {
    throw new ApiError('offline');
  } finally {
    clearTimeout(timer);
  }
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  if (!res.ok) {
    const d = data as { error?: string; message?: string } | undefined;
    throw new ApiError('server', d?.error ?? 'server', res.status, d?.message ?? '');
  }
  return data as T;
}

/**
 * Текст ошибки для тоста. На 400 и 409 сервер пишет в message объяснение для человека («Адрес не найден»,
 * «Оплату уже проверили») — его и показываем; коды без текста, ошибки проверки полей и 5xx — общий fallback.
 */
export function errorText(e: unknown, fallback: string): string {
  if (!(e instanceof ApiError)) return fallback;
  if (e.code === 'offline') return 'Нет соединения';
  if (e.status === 401) return 'Вход устарел — закройте приложение и откройте его заново';
  if (e.status === 403) return 'Нет прав на это действие';
  if ((e.status === 400 || e.status === 409 || e.status === 429) && /[а-яё]/i.test(e.detail)) return e.detail;
  return fallback;
}

export function http<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  return send<T>(method, path, body === undefined ? undefined : JSON.stringify(body), body !== undefined);
}

/** Загрузка одного файла (multipart, поле file). */
export function upload<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  return send<T>('POST', path, fd);
}

/** Адрес файла с сервера — уже полный (подписанная ссылка) или относительный. */
export const fileUrl = (u: string | undefined) => (!u || /^(https?:|blob:|data:)/.test(u) ? u : API_URL + u);

/** Долгий GET-поток (text/event-stream) с заголовками входа — для живого обновления заказов (api/changes.ts). */
export function openStream(path: string, signal: AbortSignal): Promise<Response> {
  return fetch(API_URL + path, { signal, headers: { ...authHeaders(), accept: 'text/event-stream' }, cache: 'no-store' });
}
