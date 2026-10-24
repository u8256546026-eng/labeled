// Режим сервера: заголовки входа и отправка на сервер изменений, которые экраны делают локально.
import { appStore, remote, type NotifPrefs } from '../store/app';
import { retrieveInitDataRaw, type TmaEnv } from '../telegram/tma';
import { http, live, setAuthHeaders } from './client';
import { syncLater } from './sync';

/** Изменения уведомлений приходят частями — копятся, пока сервер их не принял. */
let notifPatch: Partial<NotifPrefs> = {};

export function initLive(env: TmaEnv) {
  if (!live()) return;
  setAuthHeaders((): Record<string, string> => {
    if (env === 'telegram') { const raw = retrieveInitDataRaw(); return raw ? { authorization: 'tma ' + raw } : {}; }
    // Демо в браузере с сервером разработки: сервер принимает x-dev-user только вне production.
    const me = appStore.get().me;
    return { 'x-dev-user': encodeURIComponent(`${me.id};${me.tgName}`) };
  });
  remote.notif = (p) => {
    notifPatch = { ...notifPatch, ...p };
    syncLater('notif', async () => {
      const body = notifPatch;
      await http('PUT', '/api/me/notif', { ...body, ...(body.bot ? { botAllowed: true } : {}) });
      if (notifPatch === body) notifPatch = {};
    });
  };
  remote.fav = (id, on) => syncLater('fav:' + id, () => http(on ? 'PUT' : 'DELETE', '/api/favorites/' + encodeURIComponent(id)));
  remote.draft = (d) => syncLater('draft:' + d.id, () => http('PUT', '/api/link/drafts/' + encodeURIComponent(d.id), d.form));
}
