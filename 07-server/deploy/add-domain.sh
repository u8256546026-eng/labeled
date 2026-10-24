#!/bin/sh
# Подключить свой домен к labeled. Запускать с Mac из любой папки:
#   sh 07-server/deploy/add-domain.sh example.com
# Заранее: A-записи домена и www.домена → <IP сервера>. Скрипт проверяет их сам и без них ничего не меняет.
# Прежний адрес <IP-через-дефисы>.sslip.io продолжает работать: по нему открывается Mini App, пока адрес не сменили
# в BotFather, и на нём лежат ссылки на уже загруженные фото.
# Что делает на сервере:
#   1. домен и www — в HTTP-блок сайта nginx, чтобы Let's Encrypt проверил их через /var/www/acme;
#   2. сертификат на домен и www (продлевается сам, как прежний);
#   3. HTTPS-блок для домена — копия блока прежнего адреса (с заголовками безопасности и сжатием);
#   4. PUBLIC_URL=https://<домен> в /etc/labeled/server.env (ссылки в письмах и на новые файлы), перезапуск службы.
# При ошибке nginx -t или certbot прежний конфиг возвращается. Повторный запуск безопасен: сделанные шаги пропускаются.
set -e
D=${1:?Укажите домен: sh add-domain.sh example.com}
HOST=${HOST:?Укажите HOST=<IP сервера>}
OLD=${OLD:?Укажите OLD=<прежний домен>}
cd "$(dirname "$0")"
. ./ssh-once.sh

$SSH "D='$D' OLD='$OLD' IP='$HOST' sh -s" <<'EOS'
set -e
C=/etc/nginx/sites-enabled/labeled.conf
E=/etc/labeled/server.env

# 0. DNS: домен и www уже указывают на этот сервер.
for n in "$D" "www.$D"; do
  got=$(getent ahostsv4 "$n" | awk 'NR == 1 { print $1 }')
  [ "$got" = "$IP" ] || { echo "$n указывает на «${got:-никуда}», нужно $IP — сначала A-запись в DNS. Ничего не изменено."; exit 1; }
done
echo "DNS: $D и www.$D → $IP"

cp -p $C /tmp/labeled.conf.before-domain
restore() { cp -p /tmp/labeled.conf.before-domain $C; nginx -t 2>/dev/null && systemctl reload nginx; echo "$1 — возвращён прежний конфиг nginx"; exit 1; }

# 1. HTTP-блок (первый server_name прежнего адреса — порт 80).
if ! grep -qE "server_name[^;]* $D[ ;]" $C; then
  awk -v old="$OLD" -v d="$D" '!done && $1 == "server_name" && $2 == old ";" { sub(old ";", old " " d " www." d ";"); done = 1 } { print }' $C > /tmp/lbd.conf
  cat /tmp/lbd.conf > $C
  nginx -t || restore "Ошибка в конфиге HTTP"
  systemctl reload nginx
fi

# 2. Сертификат.
if [ ! -f "/etc/letsencrypt/live/$D/fullchain.pem" ]; then
  certbot certonly --webroot -w /var/www/acme -d "$D" -d "www.$D" --cert-name "$D" --non-interactive --agree-tos \
    --register-unsafely-without-email --deploy-hook "systemctl reload nginx" || restore "Сертификат не выпущен"
fi

# 3. HTTPS-блок домена — копия первого блока с listen 443.
if ! grep -q "live/$D/fullchain.pem" $C; then
  awk '
    /^server[ \t]*\{/ { buf = ""; inb = 1; depth = 0 }
    inb { buf = buf $0 "\n"; t = $0; depth += gsub(/\{/, "", t); depth -= gsub(/\}/, "", t)
          if (depth == 0) { inb = 0; if (!got && buf ~ /listen 443/) { printf "%s", buf; got = 1 } } }
  ' $C > /tmp/lbd-https.conf
  sed -e "s|server_name $OLD;|server_name $D www.$D;|" -e "s|live/$OLD/|live/$D/|g" /tmp/lbd-https.conf > /tmp/lbd-new.conf
  grep -q "server_name $D www.$D;" /tmp/lbd-new.conf && grep -q "live/$D/fullchain.pem" /tmp/lbd-new.conf || restore "Не нашёл HTTPS-блок прежнего адреса"
  { printf '\n'; cat /tmp/lbd-new.conf; } >> $C
  nginx -t || restore "Ошибка в конфиге HTTPS"
  systemctl reload nginx
fi
rm -f /tmp/lbd.conf /tmp/lbd-https.conf /tmp/lbd-new.conf

# 4. Адрес для ссылок в письмах и на файлы.
if ! grep -qx "PUBLIC_URL=https://$D" $E; then
  cp -p $E $E.bak
  { grep -v '^PUBLIC_URL=' $E || true; echo "PUBLIC_URL=https://$D"; } > /tmp/lbd.env
  cat /tmp/lbd.env > $E; rm -f /tmp/lbd.env
  systemctl restart labeled; sleep 3
fi
echo "служба: $(systemctl is-active labeled)"
EOS

echo "Проверка https://$D/:"
curl -s "https://$D/api/system" && echo
curl -sI "https://www.$D/" | head -1
curl -sI "https://$OLD/" | head -1
