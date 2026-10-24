# Одно ssh-соединение на весь скрипт выкладки: пароль root спрашивается один раз, в самом начале,
# остальные команды идут через это соединение (ControlMaster). Подключается из deploy.sh и
# security-headers.sh через «.» после HOST. Если SSH задан в окружении — используется как есть.
if [ -z "$SSH" ]; then
  LBD_CTL=/tmp/lbd-ssh-$$
  SSH="ssh -o ControlMaster=auto -o ControlPath=$LBD_CTL -o ControlPersist=600 root@$HOST"
  echo "Вход на сервер $HOST — пароль root спрашивается один раз:"
  $SSH true
  trap 'ssh -o ControlPath="$LBD_CTL" -O exit "root@$HOST" 2>/dev/null; [ -n "$TMP" ] && rm -rf "$TMP"' EXIT
fi
