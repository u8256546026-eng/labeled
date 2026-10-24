#!/bin/sh
# Отправить заполненный ~/labeled-secrets.env на сервер (с Mac). Значения не выводятся.
# Переносятся только ключи сервера из списка ниже; DATABASE_URL и FILE_SECRET на сервере не трогаются.
# Переменные VITE_* берёт deploy.sh при сборке приложения.
set -e
F=${1:-$HOME/labeled-secrets.env}
SSH=${SSH:-ssh root@${HOST:?Укажите HOST=<IP сервера>}}
KEYS='BOT_TOKEN|BOT_LINK|TELEGRAM_API|INIT_DATA_TTL|MAX_UPLOAD_MB|SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_PASS|SMTP_FROM_NAME'
[ -f "$F" ] || { echo "Нет файла $F"; exit 1; }
grep -Eq '^BOT_TOKEN=.+' "$F" || { echo "В $F не заполнен BOT_TOKEN"; exit 1; }

grep -E "^($KEYS)=.+" "$F" | $SSH 'set -e
E=/etc/labeled/server.env; cp -p $E $E.bak
while IFS= read -r L; do
  K=${L%%=*}
  { grep -v "^$K=" $E || true; printf "%s\n" "$L"; } > /tmp/lbd.env
  cat /tmp/lbd.env > $E; echo "записано: $K"
done
rm -f /tmp/lbd.env
systemctl restart labeled; sleep 3; echo "служба: $(systemctl is-active labeled)"'
