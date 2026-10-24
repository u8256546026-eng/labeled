import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, live, mock } from '../../api/client';
import { startLive } from '../../api/session';
import { Btns } from '../../ui/Btn';
import { Empty, Skel } from '../../ui/blocks';
import { supportSheet, supportUrl } from '../../ui/support';
import { openTg } from '../../telegram/tma';

/** Версия приложения — сервер сообщает минимальную поддерживаемую. */
export const APP_VERSION = 1;

type Status = { ok: true } | { maintenance: { until: string } } | { update: true };

const scenario = () => new URLSearchParams(location.search).get('scenario');

/** Сессия: сервер проверяет initData и отдаёт состояние сервиса. ?scenario=booterr|maint|update — демо. */
function startSession(): Promise<Status> {
  const s = scenario();
  if (s === 'booterr') return new Promise(() => {});
  if (live()) return startLive(APP_VERSION);
  return mock<Status>(() => (s === 'maint' ? { maintenance: { until: '04:00 по Москве' } } : s === 'update' ? { update: true } : { ok: true }), 400);
}

/** Через сколько показать «медленное соединение» и когда сдаться. Запрос сам обрывается через 20 с (api/client). */
const SLOW_MS = 6000;
const GATE_LIMIT_MS = 30_000;

/**
 * BA — запуск: пока сервер проверяет вход через Telegram и грузится каталог. На медленной сети не обрываем вход
 * через несколько секунд (раньше через 8 с показывалась ошибка, хотя ответ был в пути): с 6 с — подсказка про
 * соединение, ошибка — при ответе сервера с ошибкой или через 30 с. Нет сети — пускаем, экраны покажут «Нет соединения».
 * AH — блокирующие состояния: устаревшая версия и технические работы.
 */
export function SystemGate({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<'loading' | 'slow' | 'error' | 'auth' | Status>('loading');
  // Номер попытки: ответ прежней попытки, пришедший после «Повторить», не перезаписывает новую.
  const attempt = useRef(0);
  const run = useCallback(() => {
    const my = ++attempt.current;
    let done = false;
    const set = (x: 'slow' | 'error' | 'auth' | Status) => { if (attempt.current === my && !done) { if (x !== 'slow') done = true; setSt(x); } };
    setSt('loading');
    const slow = window.setTimeout(() => set('slow'), SLOW_MS);
    const limit = window.setTimeout(() => set('error'), GATE_LIMIT_MS);
    const stop = () => { window.clearTimeout(slow); window.clearTimeout(limit); };
    startSession().then((r) => { stop(); set(r); }, (e: unknown) => {
      stop();
      if (e instanceof ApiError && e.code === 'offline') set({ ok: true });
      else set(e instanceof ApiError && e.status === 401 ? 'auth' : 'error');
    });
  }, []);
  useEffect(run, [run]);

  const wrap = (body: ReactNode) => <div className="app"><main className="screen"><div className="screen-body" style={{ paddingTop: 'calc(16px + var(--safe-top))' }}>{body}</div></main></div>;
  if (st === 'loading' || st === 'slow') return wrap(<><Empty minH={520} title="Открываем labeled"
    text={st === 'slow' ? 'Соединение медленное — продолжаем загрузку, закрывать приложение не нужно.' : 'Проверяем вход через Telegram и загружаем каталог. Обычно это пара секунд.'} /><Skel /></>);
  if (st === 'error' || st === 'auth') {
    const sup = supportSheet('boot');
    return wrap(<Empty minH={600} title="Не удалось открыть labeled"
      text={st === 'auth' ? 'Telegram не передал данные для входа. Закройте приложение и откройте его заново из чата с ботом.' : 'Сервер не ответил. Проверьте интернет и нажмите «Повторить».'}
      btns={[{ label: 'Повторить', kind: 'primary', on: run }, { label: 'Написать в поддержку', kind: 'violet', dis: !supportUrl('boot'), on: sup.btns[0].on }]} />);
  }
  if ('update' in st) {
    return wrap(<Empty minH={600} title="Обновите приложение" text="Эта версия больше не поддерживается. Корзина, черновики и заказы сохранены в аккаунте и появятся после обновления." btns={[{ label: 'Обновить', kind: 'primary', on: () => location.reload() }]} />);
  }
  if ('maintenance' in st) {
    return wrap(<>
      <Empty minH={600} title="Идут технические работы" text={`Закончим до ${st.maintenance.until}. Заказы, оплаты и загруженные чеки не пропадут.`}
        btns={[{ label: 'Повторить', kind: 'primary', on: run }]} />
      {supportUrl('maint') && <Btns items={[{ label: 'Написать в Telegram', kind: 'violet', on: () => openTg(supportUrl('maint')!) }]} />}
    </>);
  }
  return <>{children}</>;
}
