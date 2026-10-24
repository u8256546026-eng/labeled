#!/bin/sh
# Сжатие (gzip) скриптов, стилей и ответов API для сайта labeled в nginx. Запускать с Mac из любой папки:
#   sh 07-server/deploy/compression.sh
# Повторный запуск безопасен. Настройки — compression.conf рядом. setup-https.sh уже пишет сайт со сжатием.
# При ошибке nginx -t прежние файлы возвращаются, nginx не перезагружается.
set -e
HOST=${HOST:?Укажите HOST=<IP сервера>}
DOMAIN=${DOMAIN:?Укажите DOMAIN=<домен>}
cd "$(dirname "$0")"
. ./ssh-once.sh

$SSH 'mkdir -p /etc/nginx/snippets && cat > /tmp/labeled-gzip.conf.new' < compression.conf
$SSH 'sh -s' <<'EOS'
set -e
C=/etc/nginx/sites-enabled/labeled.conf
S=/etc/nginx/snippets/labeled-gzip.conf
cp -p $C /tmp/labeled.conf.bak
[ -f $S ] && cp -p $S /tmp/labeled-gzip.conf.bak || rm -f /tmp/labeled-gzip.conf.bak
mv /tmp/labeled-gzip.conf.new $S
# Сайт, записанный новым setup-https.sh, уже со сжатием — второй раз не подключаем (nginx не примет повтор gzip).
if ! grep -q 'labeled-gzip.conf' $C && ! grep -q 'gzip_types' $C; then
  # В server {} с HTTPS — после client_max_body_size (он есть только там).
  awk -v s="$S" '{ print } /^[ \t]*client_max_body_size/ { print "\tinclude " s ";" }' $C > /tmp/labeled.conf.new
  cat /tmp/labeled.conf.new > $C
fi
if nginx -t; then
  systemctl reload nginx
  echo "сжатие включено"
else
  cp -p /tmp/labeled.conf.bak $C
  if [ -f /tmp/labeled-gzip.conf.bak ]; then cp -p /tmp/labeled-gzip.conf.bak $S; else rm -f $S; fi
  echo "Ошибка в конфиге nginx — возвращено как было"
  exit 1
fi
EOS
JS=$(curl -s "https://$DOMAIN/" | grep -o 'assets/index-[^"]*\.js' | head -1)
echo "Проверка https://$DOMAIN/$JS:"
curl -s -o /dev/null -H 'Accept-Encoding: gzip' -w "передано %{size_download} байт\n" "https://$DOMAIN/$JS"
curl -sI -H 'Accept-Encoding: gzip' "https://$DOMAIN/$JS" | grep -i '^content-encoding:' || echo "сжатия нет — проверьте вывод выше"
