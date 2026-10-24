import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { bump, ani } from './lib/motion';
import { runBackGuards } from './nav/backGuard';
import { CHROME_COLOR, routeMeta } from './nav/routes';
import { readNavState, useNav } from './nav/useNav';
import { CatalogScreen } from './screens/catalog/CatalogScreen';
import { FiltersScreen } from './screens/filters/FiltersScreen';
import { ProductScreen } from './screens/product/ProductScreen';
import { CartScreen } from './screens/cart/CartScreen';
import { CheckoutScreen } from './screens/checkout/CheckoutScreen';
import { DeliveryScreen } from './screens/checkout/DeliveryScreen';
import { PayScreen } from './screens/checkout/PayScreen';
import { PlacedScreen } from './screens/checkout/PlacedScreen';
import { OrdersScreen } from './screens/orders/OrdersScreen';
import { LinkScreen } from './screens/link/LinkScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { AuthScreen } from './screens/profile/AuthScreen';
import { EditProfileScreen } from './screens/profile/EditProfileScreen';
import { SettingsScreen } from './screens/profile/SettingsScreen';
import { EmailScreen } from './screens/profile/EmailScreen';
import { NotifScreen } from './screens/profile/NotifScreen';
import { AddressesScreen } from './screens/profile/AddressesScreen';
import { AddressFormScreen } from './screens/profile/AddressFormScreen';
import { PointsScreen } from './screens/profile/PointsScreen';
import { InviteScreen } from './screens/profile/InviteScreen';
import { HelpScreen } from './screens/more/HelpScreen';
import { LegalDocScreen, LegalScreen } from './screens/more/LegalScreen';
import { ChartScreen } from './screens/more/ChartScreen';
import { InboxScreen } from './screens/more/InboxScreen';
import { DeleteAccountScreen } from './screens/more/DeleteAccountScreen';
import { FavScreen } from './screens/more/FavScreen';
import { ShareScreen } from './screens/more/ShareScreen';
import { InvitedScreen } from './screens/more/InvitedScreen';
import { SearchScreen } from './screens/more/SearchScreen';
import { ViewerScreen } from './screens/after/ViewerScreen';
import { PhotoReportScreen } from './screens/after/PhotoReportScreen';
import { ClaimScreen } from './screens/after/ClaimScreen';
import { RefundScreen } from './screens/after/RefundScreen';
import { ReviewScreen } from './screens/after/ReviewScreen';
import { ReviewsScreen } from './screens/after/ReviewsScreen';
import { OnboardingScreen } from './screens/after/OnboardingScreen';
import { PushScreen } from './screens/after/PushScreen';
import { PaymentsScreen } from './screens/after/PaymentsScreen';
import { LinkItemScreen } from './screens/link/LinkItemScreen';
import { LinkSentScreen } from './screens/link/LinkSentScreen';
import { OrderScreen } from './screens/orders/OrderScreen';
import { useAdmin } from './admin/api';
import { cartCount, useApp } from './store/app';
import { bindBackButton, setChromeColor } from './telegram/tma';
import { BottomNav } from './ui/BottomNav';
import { useKeyboardOpen } from './ui/keyboard';
import { SheetProvider, useSheet } from './ui/Sheet';
import { ShellContext } from './ui/shellContext';
import { ToastProvider } from './ui/Toast';

/**
 * Режим администратора — отдельный чанк: покупатель его не скачивает, сотруднику он подгружается заранее.
 * Загруженный модуль рисуется сразу, без Suspense: React 19 держит заглушку не меньше ~300 мс даже для готового модуля.
 */
type AdminModule = typeof import('./admin/AdminRoutes');
let adminModule: AdminModule | null = null;
const loadAdmin = () => import('./admin/AdminRoutes').then((m) => (adminModule = m));
const LazyAdminRoutes = lazy(loadAdmin);
const LazyAdminNav = lazy(() => loadAdmin().then((m) => ({ default: m.AdminNav })));
// Ветка выбирается при монтировании: модуль, догрузившийся под открытым экраном, не пересоздаёт его и не стирает ввод.
function AdminRoutes() {
  const [m] = useState(() => adminModule);
  return m ? <m.default /> : <Suspense fallback={null}><LazyAdminRoutes /></Suspense>;
}
function AdminNav({ active }: { active: string }) {
  const [m] = useState(() => adminModule);
  return m ? <m.AdminNav active={active} /> : <Suspense fallback={null}><LazyAdminNav active={active} /></Suspense>;
}

/** Естественный родитель экрана: откуда на него приходят по обычной навигации. */
function parentOf(pathname: string): string | null {
  if (routeMeta(pathname).tab != null) return null;
  const after = /^\/(photo|claim|refund|review)\/([^/]+)$/.exec(pathname);
  if (after) return '/order/' + after[2];
  const prod = /^\/(?:chart|share|viewer\/product)\/([^/]+)$/.exec(pathname);
  if (prod) return '/product/' + prod[1];
  const pay = /^\/pay\/p-(\d+)/.exec(pathname);
  if (pay) return '/order/' + pay[1];
  const rep = /^\/viewer\/report\/([^/]+)$/.exec(pathname);
  if (rep) return '/photo/' + rep[1];
  const split = pathname.match(/^\/admin\/order\/([^/]+)\/split$/);
  if (split) return '/admin/order/' + split[1];
  const rules: [RegExp, string][] = [
    [/^\/(product|filters|search|reviews)(\/|$)/, '/'],
    [/^\/checkout$/, '/cart'],
    [/^\/delivery$/, '/checkout'],
    [/^\/order\//, '/orders'],
    [/^\/addresses\/./, '/addresses'],
    [/^\/legal\/./, '/legal'],
    [/^\/legal$/, '/help'],
    [/^\/(email|notif|delete-account)$/, '/settings'],
    [/^\/(orders|payments|profile\/edit|settings|addresses|points|invite|help|inbox|fav)$/, '/profile'],
    [/^\/link\/item\//, '/link'],
    [/^\/admin\/((pay|req|photo|claim)\/|summary$)/, '/admin'],
    [/^\/admin\/order\//, '/admin/orders'],
    [/^\/admin\/(item\/|banners$|sizes$)/, '/admin/catalog'],
    [/^\/admin\/(banner|category)\//, '/admin/banners'],
    [/^\/admin\/(buyers|reviews|settings|staff|log)$/, '/admin/more'],
    [/^\/admin\/buyer\//, '/admin/buyers'],
    [/^\/admin\/member\//, '/admin/staff'],
  ];
  return rules.find(([re]) => re.test(pathname))?.[1] ?? null;
}

/**
 * Стек при открытии по ссылке: под экраном лежат его естественные родители, чтобы работали
 * «назад» и нижняя навигация (каталог → карточка, профиль → мои заказы → заказ).
 */
function initialStack(path: string): string[] {
  const stack = [path];
  for (let p = parentOf(path.split('?')[0]); p; p = parentOf(p)) stack.unshift(p);
  return stack;
}

export function App({ initialPath = '/' }: { initialPath?: string }) {
  const stack = initialStack(initialPath);
  const entries = stack.map((p, i) => {
    const [pathname, search = ''] = p.split('?');
    return { pathname, search: search ? '?' + search : '', state: { depth: i, backLabel: i ? routeMeta(stack[i - 1]).name : undefined, fromPath: i ? stack[i - 1] : undefined } };
  });
  return (
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Shell />
    </MemoryRouter>
  );
}

function Shell() {
  const loc = useLocation();
  const st = readNavState(loc.state);
  const meta = routeMeta(loc.pathname);
  const kb = useKeyboardOpen();
  const [barH, setBarH] = useState(0);
  const showNav = meta.tab != null && st.depth === 0 && !kb;
  const badgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => { setChromeColor(CHROME_COLOR[meta.chrome]); }, [meta.chrome]);
  const staff = useAdmin((s) => !!s.me);
  useEffect(() => { if (staff) void loadAdmin(); }, [staff]);

  // Счётчик корзины увеличивается и возвращается, 320 мс.
  const count = useApp((s) => cartCount(s.cart));
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) bump(badgeRef.current);
    prevCount.current = count;
  }, [count]);

  return (
    <ShellContext.Provider value={{ showNav, kb, barH, setBarH }}>
      <div className="app">
        <ToastProvider>
          <SheetProvider>
            <ScreenHost />
            {showNav && (meta.admin ? <AdminNav active={meta.path} /> : <BottomNav active={meta.tab!} badgeRef={badgeRef} />)}
            <BackButtonBridge />
          </SheetProvider>
        </ToastProvider>
      </div>
    </ShellContext.Provider>
  );
}

/** Нативная кнопка «Назад» Telegram: закрывает лист или снимает экран со стека. */
function BackButtonBridge() {
  const nav = useNav();
  const sheet = useSheet();
  const loc = useLocation();
  useEffect(() => { sheet.close(); }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => bindBackButton(nav.depth > 0 || sheet.isOpen, () => {
    if (sheet.isOpen) return sheet.close();
    if (!runBackGuards()) nav.back();
  }), [nav, sheet]);
  return null;
}

const scrollPos = new Map<string, number>();

/**
 * Переход между экранами: вперёд — въезд справа на 28 px с проявлением за 220 мс, назад — слева,
 * смена вкладки — только проявление за 160 мс. Позиция прокрутки восстанавливается при возврате.
 */
function ScreenHost() {
  const loc = useLocation();
  const depth = readNavState(loc.state).depth;
  const wrap = useRef<HTMLElement>(null);
  const prev = useRef({ depth, path: loc.pathname, key: loc.key });

  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { depth, path: loc.pathname, key: loc.key };
    const el = wrap.current;
    const scroller = el?.querySelector<HTMLElement>('[data-scroll]');
    const key = loc.key;
    const onScroll = () => { if (scroller) scrollPos.set(key, scroller.scrollTop); };
    if (scroller) {
      const saved = scrollPos.get(key);
      if (saved) scroller.scrollTop = saved;
      scroller.addEventListener('scroll', onScroll, { passive: true });
    }
    if (p.key !== loc.key) {
      // Фокус — на заголовок нового экрана: диктор сообщает, куда перешли, а Tab начинается с этого экрана.
      // Поле с autoFocus (поиск) уже забрало фокус — его не трогаем.
      if (el && !el.contains(document.activeElement)) {
        const target = el.querySelector<HTMLElement>('h1') ?? scroller;
        if (target) { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      }
      const dir = depth > p.depth ? 'fwd' : depth < p.depth ? 'back' : p.path !== loc.pathname ? 'tab' : null;
      if (dir === 'tab') ani(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      else if (dir) ani(el, [{ opacity: 0, transform: `translateX(${dir === 'fwd' ? 28 : -28}px)` }, { opacity: 1, transform: 'none' }], { duration: 220 });
    }
    return () => scroller?.removeEventListener('scroll', onScroll);
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main key={loc.key} ref={wrap} data-anim="screen" style={{ position: 'absolute', inset: 0 }}>
      <Routes location={loc}>
        <Route path="/" element={<CatalogScreen />} />
        <Route path="/filters" element={<FiltersScreen />} />
        <Route path="/cart" element={<CartScreen />} />
        <Route path="/link" element={<LinkScreen />} />
        <Route path="/link/item/:key" element={<LinkItemScreen />} />
        <Route path="/link/sent/:num" element={<LinkSentScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/edit" element={<EditProfileScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/notif" element={<NotifScreen />} />
        <Route path="/addresses/:id" element={<AddressFormScreen />} />
        <Route path="/inbox" element={<InboxScreen />} />
        <Route path="/fav" element={<FavScreen />} />
        <Route path="/payments" element={<PaymentsScreen />} />
        <Route path="/help" element={<HelpScreen />} />
        <Route path="/delete-account" element={<DeleteAccountScreen />} />
        <Route path="/invited/:ref" element={<InvitedScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/product/:id" element={<ProductScreen />} />
        <Route path="/viewer/:kind/:id" element={<ViewerScreen />} />
        <Route path="/chart/:id" element={<ChartScreen />} />
        <Route path="/share/:id" element={<ShareScreen />} />
        <Route path="/checkout" element={<CheckoutScreen />} />
        <Route path="/delivery" element={<DeliveryScreen />} />
        <Route path="/pay/:id" element={<PayScreen />} />
        <Route path="/placed/:num" element={<PlacedScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/order/:num" element={<OrderScreen />} />
        <Route path="/photo/:num" element={<PhotoReportScreen />} />
        <Route path="/claim/:num" element={<ClaimScreen />} />
        <Route path="/refund/:num" element={<RefundScreen />} />
        <Route path="/review/:num" element={<ReviewScreen />} />
        <Route path="/addresses" element={<AddressesScreen />} />
        <Route path="/legal" element={<LegalScreen />} />
        <Route path="/legal/:id" element={<LegalDocScreen />} />
        <Route path="/reviews" element={<ReviewsScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/push" element={<PushScreen />} />
        <Route path="/points" element={<PointsScreen />} />
        <Route path="/email" element={<EmailScreen />} />
        <Route path="/invite" element={<InviteScreen />} />
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<CatalogScreen />} />
      </Routes>
    </main>
  );
}
