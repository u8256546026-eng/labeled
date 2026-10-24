#!/bin/sh
# Выкладка новой версии labeled на сервер (с Mac, из папки 07-server/deploy).
# Нужны: соединение ssh к root@$HOST (пароль спрашивается один раз — ssh-once.sh), Node в ~/.local/node.
# База и настройки не меняются. Запускать одну команду за раз: вставленная следом строка попадёт в поле пароля.
set -e
HOST=${HOST:?Укажите HOST=<IP сервера>}
DOMAIN=${DOMAIN:?Укажите DOMAIN=<домен>}
. "$(dirname "$0")/ssh-once.sh"
ENVF=${ENVF:-$HOME/labeled-secrets.env}
export PATH=$HOME/.local/node/bin:$PATH npm_config_cache=$HOME/.local/npm-cache COPYFILE_DISABLE=1
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)

# Настройки приложения из ~/labeled-secrets.env (VITE_* и BOT_LINK); значения не выводятся.
VITE_BOT_LINK=https://t.me/your_bot/app
if [ -f "$ENVF" ]; then
  while IFS= read -r L; do
    case "$L" in VITE_*=?*) export "$L" ;; BOT_LINK=?*) export "VITE_BOT_LINK=${L#BOT_LINK=}" ;; esac
  done < "$ENVF"
fi
export VITE_BOT_LINK

npm run build
# API — на том же адресе, что и приложение («/»): сборка работает и с example.com, и с прежнего sslip.io.
(cd ../06-app && VITE_API_URL=/ npx vite build --outDir "$TMP/app" --emptyOutDir)

tar -czf - dist package.json package-lock.json drizzle | $SSH 'rm -rf /opt/labeled/server.new && mkdir /opt/labeled/server.new && tar -xzf - -C /opt/labeled/server.new 2>/dev/null'
(cd "$TMP/app" && tar -czf - .) | $SSH 'rm -rf /opt/labeled/app.new && mkdir /opt/labeled/app.new && tar -xzf - -C /opt/labeled/app.new 2>/dev/null'
$SSH 'set -e; cd /opt/labeled/server.new && PATH=/opt/node/bin:$PATH npm ci --omit=dev --no-audit --no-fund >/dev/null
  /usr/local/sbin/labeled-backup
  cd /opt/labeled && rm -rf server.old app.old && mv server server.old && mv server.new server && mv app app.old && mv app.new app
  systemctl restart labeled && sleep 2 && systemctl is-active labeled'
rm -rf "$TMP"
echo "Выложено: https://$DOMAIN/"
