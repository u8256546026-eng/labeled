// Cloudflare Worker: пересылает запросы сервера labeled в Bot API Telegram.
// Нужен, потому что с сервера в Москве api.telegram.org недоступен, а Cloudflare — доступен.
// Адрес Worker'а (https://<имя>.<аккаунт>.workers.dev) вписывается в TELEGRAM_API.
// Пропускаются только запросы к Bot API (/bot<токен>/<метод>) и скачивание файлов бота
// (/file/bot<токен>/<путь> — аватарки покупателей), остальное — 404.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const api = /^\/bot\d+:[\w-]+\/\w+$/.test(url.pathname);
    const file = /^\/file\/bot\d+:[\w-]+\/[\w./-]+$/.test(url.pathname) && !url.pathname.includes('..');
    if (!api && !file) return new Response('Not found', { status: 404 });
    if (file) return fetch('https://api.telegram.org' + url.pathname);
    return fetch('https://api.telegram.org' + url.pathname + url.search, {
      method: request.method,
      headers: { 'content-type': request.headers.get('content-type') ?? 'application/json' },
      body: request.method === 'GET' ? undefined : request.body,
    });
  },
};
