// Режим администратора — отдельный чанк сборки: покупатель его не скачивает (App.tsx, React.lazy).
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CatalogScreen } from '../screens/catalog/CatalogScreen';
import type { Perm } from './model';
import { AdminTasksScreen } from './screens/TasksScreen';
import { AdminPayScreen } from './screens/PayScreen';
import { AdminRequestScreen } from './screens/RequestScreen';
import { AdminClaimScreen, AdminOrderScreen, AdminOrdersScreen, AdminPhotoScreen, AdminSplitScreen } from './screens/OrdersScreens';
import { AdminBannerScreen, AdminBannersScreen, AdminCatalogScreen, AdminCategoryScreen, AdminItemScreen, AdminSizesScreen } from './screens/CatalogScreens';
import { AdminBuyerScreen, AdminBuyersScreen, AdminMoreScreen, AdminReviewsScreen, AdminSummaryScreen } from './screens/MoreScreens';
import { AdminSettingsScreen } from './screens/SettingsScreen';
import { AdminGuard, AdminJournalScreen, AdminMemberScreen, AdminStaffScreen } from './screens/StaffScreens';

export { AdminNav } from './AdminNav';

/** Экран админки за проверкой прав: без права — «Нет доступа» (adm27). Права проверяет и сервер. */
const adm = (perm: Perm | null, el: ReactElement) => <AdminGuard perm={perm}>{el}</AdminGuard>;

/** Экраны /admin/*: пути относительно /admin. */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={adm(null, <AdminTasksScreen />)} />
      <Route path="orders" element={adm('orders', <AdminOrdersScreen />)} />
      <Route path="catalog" element={adm('catalog', <AdminCatalogScreen />)} />
      <Route path="more" element={adm(null, <AdminMoreScreen />)} />
      <Route path="pay/:id" element={adm('pay', <AdminPayScreen />)} />
      <Route path="req/:num" element={adm('req', <AdminRequestScreen />)} />
      <Route path="order/:num" element={adm('orders', <AdminOrderScreen />)} />
      <Route path="order/:num/split" element={adm('orders', <AdminSplitScreen />)} />
      <Route path="photo/:num" element={adm('photo', <AdminPhotoScreen />)} />
      <Route path="claim/:num" element={adm('claims', <AdminClaimScreen />)} />
      <Route path="item/:id" element={adm('catalog', <AdminItemScreen />)} />
      <Route path="banners" element={adm('banners', <AdminBannersScreen />)} />
      <Route path="banner/:id" element={adm('banners', <AdminBannerScreen />)} />
      <Route path="category/:id" element={adm('banners', <AdminCategoryScreen />)} />
      <Route path="sizes" element={adm('catalog', <AdminSizesScreen />)} />
      <Route path="buyers" element={adm('buyers', <AdminBuyersScreen />)} />
      <Route path="buyer/:id" element={adm('buyers', <AdminBuyerScreen />)} />
      <Route path="reviews" element={adm('reviews', <AdminReviewsScreen />)} />
      <Route path="settings" element={adm('prices', <AdminSettingsScreen />)} />
      <Route path="staff" element={adm('staff', <AdminStaffScreen />)} />
      <Route path="member/:id" element={adm('staff', <AdminMemberScreen />)} />
      <Route path="log" element={adm('staff', <AdminJournalScreen />)} />
      <Route path="summary" element={adm('summary', <AdminSummaryScreen />)} />
      {/* Неизвестный путь — как и вне админки, каталог. */}
      <Route path="*" element={<CatalogScreen />} />
    </Routes>
  );
}
