import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Живое обновление заказов: открытые приложения держат поток /api/live (text/event-stream) и получают
 * сигнал «orders», когда что-то изменилось в заказах, оплатах, заявках или обращениях. Данных в сигнале нет —
 * приложение само перечитывает свой экран теми же запросами и с теми же проверками прав.
 *
 * Кому сигнал: изменение покупателя — ему (на всех его устройствах) и сотрудникам; изменение сотрудника — всем,
 * покупатель заказа заранее не известен, а лишний сигнал стоит одного запроса списка. Сигналы за 200 мс
 * склеиваются в один. Сервер работает одним процессом, подписки хранятся в памяти.
 */
type Sub = { userId: number; staff: boolean; res: FastifyReply['raw'] };

const PING_MS = 25_000; // меньше proxy_read_timeout nginx (60 с) — иначе он закроет тихое соединение
const PER_USER = 5;
const MAX_SUBS = 2000;

/** Изменяющие запросы, после которых меняется вид заказов (шаблоны путей Fastify). */
const BUYER_ORDER = /^\/api\/(orders|payments|link$|size-requests|claims|reviews$)/;
const STAFF_ORDER = /^\/api\/admin\/(payments|requests|orders|photo|claims|sizes|buyers\/:id\/points)/;

export type LiveHub = ReturnType<typeof liveHub>;

export function liveHub() {
  const subs = new Set<Sub>();
  let pending: { all: boolean; users: Set<number> } | null = null;

  const write = (s: Sub, text: string) => { if (!s.res.writableEnded) s.res.write(text); };

  function flush() {
    const p = pending;
    pending = null;
    if (!p) return;
    for (const s of subs) if (p.all || s.staff || p.users.has(s.userId)) write(s, 'data: orders\n\n');
  }

  /** Отметить изменение: userId — только этому покупателю и сотрудникам, 'all' — всем. */
  function publish(target: number | 'all') {
    if (!pending) { pending = { all: false, users: new Set() }; setTimeout(flush, 200).unref(); }
    if (target === 'all') pending.all = true; else pending.users.add(target);
  }

  /** Решение по завершённому запросу: хук onResponse вызывает для каждого ответа. */
  function afterResponse(req: FastifyRequest, status: number) {
    if (req.method === 'GET' || status >= 400 || !req.user) return;
    const route = req.routeOptions.url ?? '';
    if (STAFF_ORDER.test(route)) publish('all');
    else if (BUYER_ORDER.test(route)) publish(req.user.id);
  }

  /** GET /api/live: поток держится, пока приложение открыто; каждые 25 с — пустая строка-комментарий. */
  function stream(req: FastifyRequest, reply: FastifyReply, userId: number) {
    const mine = [...subs].filter((s) => s.userId === userId);
    // Лишние вкладки и зависшие соединения одного покупателя закрываем, начиная со старых.
    for (const s of mine.slice(0, Math.max(0, mine.length - PER_USER + 1))) s.res.end();
    if (subs.size >= MAX_SUBS) return reply.status(503).send({ error: 'busy' });
    reply.hijack();
    const res = reply.raw;
    // Заголовки CORS уже выставлены плагином на reply — переносим их в ответ, который пишем сами.
    res.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no', // nginx отдаёт сигнал сразу, а не копит в буфере
      connection: 'keep-alive',
    });
    res.write(': ok\n\n');
    const sub: Sub = { userId, staff: !!req.staffRow, res };
    subs.add(sub);
    const ping = setInterval(() => write(sub, ': ping\n\n'), PING_MS);
    const done = () => { clearInterval(ping); subs.delete(sub); };
    res.on('close', done);
    req.raw.on('close', done);
  }

  /** Перед остановкой сервера: иначе открытые потоки держали бы его до тайм-аута systemd. */
  function closeAll() { for (const s of subs) s.res.end(); subs.clear(); }

  return { publish, afterResponse, stream, closeAll, size: () => subs.size };
}
