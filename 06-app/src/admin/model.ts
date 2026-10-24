// Модель режима администратора (Labeled Admin, adm01–adm34). Права проверяет сервер по Telegram ID
// сотрудника из initData; здесь — те же правила для интерфейса: что показывать и куда пускать.

export type Perm =
  | 'req' | 'pay' | 'orders' | 'photo' | 'track' | 'claims' | 'catalog' | 'banners'
  | 'buyers' | 'reviews' | 'prices' | 'staff' | 'summary';

export const PERMS: [Perm, string][] = [
  ['req', 'Заявки по ссылке'], ['pay', 'Проверка оплаты и чеки'], ['orders', 'Заказы и статусы'],
  ['photo', 'Фотоотчёт со склада'], ['track', 'Посылки и трек CDEK'], ['claims', 'Обращения покупателей'],
  ['catalog', 'Каталог'], ['banners', 'Баннеры и категории'], ['buyers', 'Покупатели и баллы'],
  ['reviews', 'Отзывы'], ['prices', 'Курс, комиссия, реквизиты'], ['staff', 'Сотрудники и права'], ['summary', 'Сводка за день'],
];

/** Курс, реквизиты и сотрудники — только владелец; сотруднику их не выдать. */
export const OWNER_ONLY: Perm[] = ['prices', 'staff'];

export type Role = 'owner' | 'manager' | 'stock' | 'content';
export type PillTone = 'live' | 'wait' | 'err' | 'info' | 'violet' | 'n' | 'lime';

export const ROLES: Record<Role, { label: string; sub: string; tone: PillTone; perms: Perm[] | null }> = {
  owner: { label: 'Владелец', sub: 'Все разделы', tone: 'live', perms: null },
  manager: { label: 'Менеджер', sub: 'Заявки, оплаты, заказы, обращения, покупатели', tone: 'info', perms: ['req', 'pay', 'orders', 'claims', 'buyers', 'summary'] },
  stock: { label: 'Склад', sub: 'Фотоотчёты, посылки, трек CDEK', tone: 'violet', perms: ['orders', 'photo', 'track'] },
  content: { label: 'Контент', sub: 'Каталог, баннеры, категории, отзывы', tone: 'wait', perms: ['catalog', 'banners', 'reviews'] },
};

export const rolePerms = (r: Role): Perm[] => ROLES[r].perms ?? PERMS.map((p) => p[0]);

/** Права сотрудника: по роли или переопределённые вручную (adm23). */
export type Staff = { id: string; name: string; handle: string; /** Аватарка — с сервера. */ photo?: string; role: Role; since: string; perms: Perm[] | null; me?: boolean };
export const staffPerms = (s: Pick<Staff, 'role' | 'perms'>): Perm[] => s.perms ?? rolePerms(s.role);

/** Восемь этапов заказа из-за границы, которые ведёт продавец (adm10, adm11). */
export const STAGES = ['Заявка одобрена', 'Товары оплачены', 'Выкуплено продавцом', 'На складе в Китае', 'Отправлено в Россию', 'Прибыло на склад в России', 'Передано в CDEK', 'Выдано покупателю'];

export type TaskKind = 'pay' | 'req' | 'claim' | 'photo' | 'track' | 'review' | 'size' | 'refund';
export const TASK_KIND: Record<TaskKind, { label: string; icon: AdminIcon; tone: PillTone; perm: Perm; group: TaskGroup }> = {
  pay: { label: 'Оплата', icon: 'card', tone: 'wait', perm: 'pay', group: 'pay' },
  req: { label: 'Заявка', icon: 'link', tone: 'live', perm: 'req', group: 'req' },
  claim: { label: 'Обращение', icon: 'msg', tone: 'err', perm: 'claims', group: 'claim' },
  photo: { label: 'Фотоотчёт', icon: 'camera', tone: 'violet', perm: 'photo', group: 'stock' },
  track: { label: 'Посылка', icon: 'truck', tone: 'info', perm: 'track', group: 'stock' },
  review: { label: 'Отзыв', icon: 'star', tone: 'n', perm: 'reviews', group: 'review' },
  size: { label: 'Размер', icon: 'tag', tone: 'wait', perm: 'catalog', group: 'review' },
  /** Нет в макете: после отмены оплаченного заказа продавцом (adm30) деньги нужно вернуть. */
  refund: { label: 'Возврат', icon: 'card', tone: 'err', perm: 'pay', group: 'pay' },
};
export type TaskGroup = 'all' | 'pay' | 'req' | 'claim' | 'stock' | 'review';
export const TASK_GROUPS: [TaskGroup, string][] = [['all', 'Все'], ['pay', 'Оплаты'], ['req', 'Заявки'], ['claim', 'Обращения'], ['stock', 'Склад'], ['review', 'Каталог и отзывы']];

/**
 * Задача очереди (adm02). Появляется на сервере из события (чек загружен, заявка отправлена…)
 * и закрывается действием на её экране. createdAt — для «давно ждёт» и сортировки.
 */
export type Task = { id: string; kind: TaskKind; title: string; sub: string; amount?: number; age: string; urgent?: boolean; to: string };

export type OrderGroup = 'req' | 'pay' | 'buy' | 'ship' | 'done' | 'prob';
export const ORDER_GROUPS: [OrderGroup | 'all', string][] = [['all', 'Все'], ['req', 'Заявки'], ['pay', 'Оплата'], ['buy', 'Выкуп и склад'], ['ship', 'В пути'], ['done', 'Выданы'], ['prob', 'Проблемы']];

export type AdminIcon = 'card' | 'link' | 'msg' | 'camera' | 'truck' | 'star' | 'chart' | 'users' | 'user' | 'image' | 'calc' | 'lock' | 'swap' | 'box' | 'heart' | 'receipt' | 'addr' | 'check' | 'info' | 'alert' | 'clock' | 'tag' | 'palette';

export const PAY_FAIL = ['Перевод не найден', 'Сумма меньше счёта', 'Перевод от другого человека', 'Другая причина'];
export const REQ_REJECT = ['Товара нет в наличии', 'Нельзя доставить в Россию', 'Ссылка не открывается', 'Другая причина'];
/** Отмена заказа продавцом (adm30). «Другая причина» — только с комментарием. */
export const SELLER_CANCEL = ['Товар закончился у продавца', 'Нельзя доставить в Россию', 'Покупатель попросил отменить', 'Другая причина'];
/** Решение по обращению (adm28): ответ сервера ok | more | no. */
export const CLAIM_DECISIONS: ['ok' | 'more' | 'no', string, string][] = [
  ['ok', 'Вернуть деньги', 'Покупатель получит форму реквизитов'],
  ['more', 'Нужны фото', 'Покупатель приложит фото к обращению'],
  ['no', 'Отказать', 'Покупатель увидит причину'],
];

/** Журнал действий (adm33): тип действия — для фильтра и иконки строки. */
export type LogType = 'pay' | 'req' | 'orders' | 'stock' | 'catalog' | 'prices' | 'staff';
export const LOG_TYPES: [LogType | 'all', string][] = [
  ['all', 'Все действия'], ['pay', 'Оплаты'], ['req', 'Заявки'], ['orders', 'Заказы'], ['stock', 'Склад'], ['catalog', 'Каталог'], ['prices', 'Настройки'], ['staff', 'Сотрудники'],
];
export const LOG_ICON: Record<LogType, AdminIcon> = { pay: 'card', req: 'link', orders: 'box', stock: 'camera', catalog: 'tag', prices: 'calc', staff: 'lock' };
/** Записи журнала не меняются и не удаляются; через 12 месяцев сервер удаляет их сам. Видит журнал только владелец. */
export const LOG_KEEP_MONTHS = 12;
/**
 * Запись журнала: кто (id, имя и роль на момент чтения — у бывшего сотрудника тоже), что сделал, над каким объектом.
 * to — экран объекта; нет — объект удалён или экрана у него нет.
 */
export type LogEntry = { id: string; at: string; who: string; whoName: string; /** Аватарка сотрудника — с сервера. */ whoPhoto?: string; whoRole: Role; type: LogType; text: string; obj: string; to?: string };

/** Разбиение заказа на посылки (adm34): не больше 4, в каждой хотя бы одна вещь. */
export const MAX_PARCELS = 4;
