#!/bin/sh
# Заголовки безопасности (CSP, HSTS, nosniff…) для сайта labeled в nginx. Запускать с Mac из любой папки:
#   sh 07-server/deploy/security-headers.sh
# Повторный запуск безопасен. После setup-https.sh (он пишет сайт заново) запустить ещё раз.
# Заголовки — security-headers.conf рядом; проверка приложения с ними — 06-app/scripts/check-csp.mjs.
# При ошибке nginx -t прежние файлы возвращаются, nginx не перезагружается.
set -e
HOST=${HOST:?Укажите HOST=<IP сервера>}
DOMAIN=${DOMAIN:?Укажите DOMAIN=<домен>}
cd "$(dirname "$0")"
. ./ssh-once.sh

$SSH 'mkdir -p /etc/nginx/snippets && cat > /tmp/labeled-security.conf.new' < security-headers.conf
$SSH 'sh -s' <<'EOF'
set -e
C=/etc/nginx/sites-enabled/labeled.conf
S=/etc/nginx/snippets/labeled-security.conf
cp -p $C /tmp/labeled.conf.bak
[ -f $S ] && cp -p $S /tmp/labeled-security.conf.bak || rm -f /tmp/labeled-security.conf.bak
mv /tmp/labeled-security.conf.new $S
if ! grep -q 'labeled-security.conf' $C; then
  # Только location приложения (/ и /assets/ — у них свой add_header Cache-Control). Ответы /api/ и /files/
  # не трогаем: CSP с object-src 'none' может помешать открыть PDF-чек, nosniff у файлов ставит сам сервер.
  awk -v s="$S" '{ print } /^[ \t]*add_header Cache-Control/ { print "\t\tinclude " s ";" }' $C > /tmp/labeled.conf.new
  cat /tmp/labeled.conf.new > $C
fi
if nginx -t; then
  systemctl reload nginx
  echo "заголовки включены"
else
  cp -p /tmp/labeled.conf.bak $C
  if [ -f /tmp/labeled-security.conf.bak ]; then cp -p /tmp/labeled-security.conf.bak $S; else rm -f $S; fi
  echo "Ошибка в конфиге nginx — возвращено как было"
  exit 1
fi
EOF
echo "Проверка https://$DOMAIN/:"
curl -sI "https://$DOMAIN/" | grep -iE '^(content-security-policy|strict-transport-security|x-content-type-options|referrer-policy):' || echo "заголовков нет — проверьте вывод выше"
