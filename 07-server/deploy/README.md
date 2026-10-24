# Развёртывание labeled

Сервер: VPS с Ubuntu 24.04 и ISPmanager. Адрес вида `<IP-через-дефисы>.sslip.io` (бесплатный DNS sslip.io указывает на IP сервера) или свой домен — раздел «Свой домен» ниже; `setup-https.sh <домен>` для своего домена не нужен: он переписывает сайт под один адрес.

## Что где на сервере

| Что | Где |
| --- | --- |
| Сервер API | `/opt/labeled/server` (`dist/main.js`), служба `labeled` (`labeled.service`), слушает `127.0.0.1:8787` |
| Приложение | `/opt/labeled/app` (статическая сборка `06-app`) |
| Настройки и секреты | `/etc/labeled/server.env` (root:labeled, 640). Пароль базы и `FILE_SECRET` сгенерированы на сервере |
| База | Postgres 16, база и роль `labeled`, только `127.0.0.1` |
| Загрузки | `/var/lib/labeled/uploads` |
| Копии | `/var/backups/labeled`: `db-<дата>.dump` и `uploads-<дата>.tar.gz`, ежедневно в 04:30 (`labeled-backup.timer`), хранятся 14 дней |
| Сайт nginx | `/etc/nginx/sites-enabled/labeled.conf` (`setup-https.sh`), файлы ISPmanager не трогаются |
| Node | `/opt/node` (24.x) |

## Шаги запуска

1. HTTPS: `ssh root@<IP сервера> 'sh -s' < 07-server/deploy/setup-https.sh`.
2. Настройки: заполнить `~/labeled-secrets.env` на Mac (вне проекта: в нём токен бота) и отправить — `sh 07-server/deploy/push-env.sh`. На сервер уходят только `BOT_TOKEN`, `BOT_LINK`, `TELEGRAM_API`, `INIT_DATA_TTL`, `MAX_UPLOAD_MB` и `SMTP_*`, служба перезапускается. `VITE_*` из того же файла берёт `deploy.sh` при сборке приложения — после их изменения нужен `deploy.sh`.
3. BotFather (с аккаунта, которому принадлежит `@your_bot`): `/newapp` → `@your_bot` → название, описание, картинка 640×360 → URL `https://<IP-через-дефисы>.sslip.io/` → короткое имя `app`. Ссылка: `https://t.me/your_bot/app`. Кнопка меню: `/setmenubutton` → тот же URL.
4. Владелец открывает Mini App и входит (согласие P), затем:
   ```sh
   ssh root@<IP сервера> 'cd /opt/labeled/server && set -a && . /etc/labeled/server.env && sudo -E -u labeled /opt/node/bin/node dist/admin-cli.js owner @<username>'
   ```
   Вместо `@username` можно числовой Telegram ID. Остальные сотрудники — приглашениями из админки (adm24).

Сообщения бота: с сервера `api.telegram.org` недоступен (проверено 2026-10-08), Cloudflare доступен. Прокси — Cloudflare Worker из `telegram-proxy.worker.js`; его адрес вписать в `TELEGRAM_API` в `~/labeled-secrets.env` и отправить `push-env.sh`. Вход в Mini App от этого не зависит. С 2026-10-09 Worker пропускает и скачивание файлов бота (`/file/bot…`) — через него сервер забирает аватарки; после изменения `telegram-proxy.worker.js` его код нужно вставить в Cloudflare заново (Workers → свой Worker → Edit code → Deploy). Без этого аватарки остаются ссылками Telegram из initData.

Письма (подтверждение почты, уведомления о заказах): ящик магазина на mail.ru, `smtp.mail.ru:465`. В `~/labeled-secrets.env` — `SMTP_USER=<адрес ящика>` и `SMTP_PASS=<пароль для внешних приложений>` (не основной пароль и не «пароль приложения» VK ID — его mail.ru не принимает: в самой почте Настройки → Все настройки → Безопасность → Пароли для внешних приложений → Создать, тип «Только отправка писем в Почте»; нужен привязанный телефон). Проверка с Mac без вывода секретов — `~/.local/node/bin/node 07-server/deploy/check-smtp.mjs`; затем `push-env.sh`. Ответ mail.ru `535 … Application password is REQUIRED` означает любой неподходящий пароль, не только основной. Без них в продукте `POST /api/email` отвечает `503 mail_off`. Доступность SMTP с сервера проверить до этого: `ssh root@<IP сервера> 'timeout 8 openssl s_client -connect smtp.mail.ru:465 -quiet </dev/null 2>&1 | head -3'` — ждём строку `220 … ESMTP`; тишина или `connect:errno` — порт закрыт, тогда нужен почтовый сервис с HTTP-API.

`admin-cli.js init` (категории и три баннера в пустой базе) уже выполнен 2026-10-08.

## Заголовки безопасности

`sh 07-server/deploy/security-headers.sh` — CSP, HSTS, `nosniff`, `Referrer-Policy` для страниц приложения (`/`, `/assets/`); сами заголовки — `security-headers.conf`. Проверяет `nginx -t`, при ошибке возвращает прежний конфиг. После `setup-https.sh` запустить снова. Перед изменением CSP — `node 06-app/scripts/check-csp.mjs <сборка>`.

`sh 07-server/deploy/compression.sh` — сжатие gzip для скриптов, стилей и ответов API (`compression.conf`): главный скрипт приложения 687 КБ → ~200 КБ. Проверяет `nginx -t`, при ошибке возвращает прежний конфиг. `setup-https.sh` уже пишет сайт со сжатием.

## Свой домен (example.com)

Приложение с 2026-10-22 собирается с `VITE_API_URL=/` — обращается к серверу по тому адресу, с которого открыто. Поэтому старый адрес `<IP-через-дефисы>.sslip.io` и новый домен работают одновременно, а переезд проходит без простоя. Старый адрес не отключать: на нём лежат ссылки на уже загруженные фото (в базе — полные адреса).

1. **Регистратор → DNS-зона example.com:** завершить регистрацию (статус «Требуется настройка»: данные владельца и NS-серверы), затем в DNS-зоне домена — A-записи `example.com` и `www.example.com` → `<IP сервера>`. Проверка с Mac: `dig +short example.com` и `dig +short www.example.com` выдают IP.
2. `sh 07-server/deploy/add-domain.sh example.com` — сам проверяет DNS; добавляет домен в сайт nginx, выпускает сертификат на домен и www, копирует HTTPS-блок прежнего адреса (заголовки и сжатие сохраняются), ставит `PUBLIC_URL=https://example.com` и перезапускает службу. При ошибке возвращает прежний конфиг.
3. **Заказчик в BotFather** (бот его): `/myapps` → приложение `@your_bot` → Edit Web App URL → `https://example.com/`; если кнопка меню задана через `/setmenubutton` — тот же адрес. Ссылка `t.me/your_bot/app` не меняется.
4. Дальше выкладка — `DOMAIN=example.com HOST=<IP сервера> sh 07-server/deploy/deploy.sh` (`DOMAIN` влияет только на итоговую строку), проверки — `curl -s https://example.com/api/system`.

## Обновление

Перед каждой выкладкой — проверки интерфейса и сквозные сценарии (решение 2026-10-10). Агент прогоняет их сам и даёт команду выкладки только при зелёном результате:

```sh
cd 06-app && export PATH=~/.local/node/bin:$PATH
npx vite --host 127.0.0.1 --port 5173 &   # моки
node scripts/check-ux.mjs                 # фокус, тосты, оформление, ширины — 18 проверок
node scripts/check-after.mjs && node scripts/check-admin.mjs
# check-live.mjs — с сервером на свежей базе, команды в 06-app/README.md, раздел «С сервером»
```

`HOST=<IP сервера> sh 07-server/deploy/deploy.sh` — собирает сервер и приложение, делает копию базы, выкладывает новую версию (прежняя остаётся в `*.old`), перезапускает службу. Миграции применяются при старте.

`deploy.sh` и `security-headers.sh` спрашивают пароль root один раз, в начале (`ssh-once.sh`): дальше все команды идут через то же соединение. Запускайте по одной команде — строка, вставленная следом, попадёт в поле пароля.

## Проверка и журналы

```sh
systemctl status labeled
journalctl -u labeled -n 100
curl -s https://<IP-через-дефисы>.sslip.io/api/system
```

Восстановление базы из копии: `systemctl stop labeled && sudo -u postgres pg_restore --clean -d labeled /var/backups/labeled/db-<дата>.dump && systemctl start labeled`.
