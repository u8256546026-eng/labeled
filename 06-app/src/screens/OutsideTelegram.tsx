import { Empty } from '../ui/blocks';

/** BB — ссылку открыли в обычном браузере, initData нет. */
export function OutsideTelegram() {
  return (
    <div className="app">
      <div className="screen">
        <div className="screen-body">
          <Empty title="Откройте labeled в Telegram" text="Приложение работает внутри Telegram: так мы узнаём вас без пароля и присылаем уведомления о заказах. Ссылка откроет бота labeled."
            btns={[{ label: 'Открыть в Telegram', kind: 'primary', on: () => { const bot = import.meta.env.VITE_BOT_LINK; if (bot) location.href = bot; } }]} />
        </div>
      </div>
    </div>
  );
}
