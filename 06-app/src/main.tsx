import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './styles/tokens.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { OutsideTelegram } from './screens/OutsideTelegram';
import { onboarded } from './screens/after/OnboardingScreen';
import { SystemGate } from './screens/after/SystemGate';
import { actions, appStore } from './store/app';
import { bootTelegram, launchStartParam, launchUser } from './telegram/tma';
import { adminApi } from './admin/api';
import { initLive } from './api/live';
import { live } from './api/client';
import { ROLES, type Role } from './admin/model';
import { ADMIN_STAFF, AIMG } from './mocks/admin';

const env = bootTelegram();
initLive(env);
// Фото и имя профиля — из Telegram (initData). Подлинность initData проверяет сервер.
const tgUser = env !== 'none' ? launchUser() : null;
if (tgUser) {
  actions.setTelegramUser({ id: tgUser.id, username: tgUser.username, photo: typeof tgUser.photo_url === 'string' ? tgUser.photo_url : undefined, tgName: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') });
}
// Сотрудник: сервер находит Telegram ID из initData в таблице сотрудников и отдаёт роль вместе с сессией.
// Демо: ?staff=owner|manager|stock|content — вход как Иван Петров с выбранной ролью (adm01–adm27).
const demoStaff = env === 'mock' ? new URLSearchParams(location.search).get('staff') : null;
if (demoStaff && demoStaff in ROLES) {
  // На моках — Иван с выбранной ролью. С сервером роль приходит из его сессии, поэтому входим сотрудником
  // из демо-данных сервера с этой ролью: Иван — владелец, Ксения — менеджер, Артём — склад, Лиза — контент.
  const who = (live() && ADMIN_STAFF.find((x) => x.role === demoStaff)) || ADMIN_STAFF[0];
  const tg: Record<string, number> = { 's-ivan': 2001, 's-ksenia': 2011, 's-artem': 2012, 's-liza': 2013 };
  if (!live()) adminApi.setSession({ ...who, role: demoStaff as Role });
  actions.setTelegramUser({ id: tg[who.id], username: who.handle.slice(1), photo: who.id === 's-ivan' ? AIMG.ivan : undefined, tgName: who.name });
}
// Демо и разработка: ?path=/pay/p-1042-1 открывает нужный экран сразу (для показа и сверки с кадрами).
const demoPath = env === 'mock' ? new URLSearchParams(location.search).get('path') ?? undefined : undefined;

/**
 * Параметр запуска Mini App (t.me/<bot>/app?startapp=…): ref_<id> — приглашение друга (S),
 * item_<id> — карточка вещи или «Вещь не найдена» (R), order_<num> — заказ. В демо — ?start=….
 */
function startPath(): string | undefined {
  const sp = launchStartParam() ?? (env === 'mock' ? new URLSearchParams(location.search).get('start') ?? undefined : undefined);
  if (!sp) return undefined;
  const [kind, ...rest] = sp.split('_');
  const id = rest.join('_');
  if (kind === 'ref' && id) { actions.setReferrer(id); return appStore.get().auth ? undefined : '/invited/' + id; }
  if (kind === 'item' && id) return '/product/' + id;
  if (kind === 'order' && id) return '/order/' + id;
  return undefined;
}
const fromStart = startPath();
// Знакомство (AD) — при первом запуске без приглашения; в демо только по ?onboarding.
const showOnboarding = !fromStart && !demoPath && (env === 'telegram' ? !onboarded() : new URLSearchParams(location.search).has('onboarding'));
const initialPath = demoPath ?? fromStart ?? (showOnboarding ? '/onboarding' : undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>{env === 'none' ? <OutsideTelegram /> : <SystemGate><App initialPath={initialPath} /></SystemGate>}</StrictMode>,
);
