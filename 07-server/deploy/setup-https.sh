#!/bin/sh
# HTTPS для labeled на сервере (запускать от root): сайт nginx + сертификат Let's Encrypt.
# С Mac:  ssh root@<IP сервера> 'sh -s' < 07-server/deploy/setup-https.sh
# Свой домен вместо технического:  ssh root@… 'sh -s -- shop.example.ru' < …
# Файлы панели ISPmanager не трогаются: сайт лежит в /etc/nginx/sites-enabled/labeled.conf.
set -e
D=${1:?Укажите домен}
CONF=/etc/nginx/sites-enabled/labeled.conf
mkdir -p /var/www/acme

# 1. Только HTTP — чтобы Let's Encrypt проверил домен.
cat > $CONF <<EOF
server {
	listen 80;
	listen [::]:80;
	server_name $D;
	location ^~ /.well-known/acme-challenge/ { root /var/www/acme; }
	location / { return 301 https://\$host\$request_uri; }
}
EOF
nginx -t || { rm $CONF; echo "Ошибка в конфиге — сайт не добавлен"; exit 1; }
systemctl reload nginx

# 2. Сертификат; продлевается сам (certbot.timer), после продления nginx перечитывает его.
certbot certonly --webroot -w /var/www/acme -d $D --non-interactive --agree-tos \
	--register-unsafely-without-email --deploy-hook "systemctl reload nginx"

# 3. HTTPS: приложение из /opt/labeled/app, API и файлы — на сервер 127.0.0.1:8787.
cp $CONF /tmp/labeled.conf.http
cat >> $CONF <<EOF

server {
	listen 443 ssl;
	listen [::]:443 ssl;
	http2 on;
	server_name $D;
	ssl_certificate /etc/letsencrypt/live/$D/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/$D/privkey.pem;
	ssl_protocols TLSv1.2 TLSv1.3;

	root /opt/labeled/app;
	index index.html;
	client_max_body_size 12m;
	# Сжатие — как compression.conf (главный скрипт 687 КБ → ~200 КБ).
	gzip on;
	gzip_comp_level 6;
	gzip_min_length 1024;
	gzip_vary on;
	gzip_proxied any;
	gzip_types text/css application/javascript text/javascript application/json image/svg+xml text/plain;

	location ^~ /.well-known/acme-challenge/ { root /var/www/acme; }

	location /api/ {
		proxy_pass http://127.0.0.1:8787;
		proxy_set_header Host \$host;
		proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto https;
	}
	location /files/ {
		proxy_pass http://127.0.0.1:8787;
		proxy_set_header Host \$host;
	}
	location /assets/ {
		add_header Cache-Control "public, max-age=604800";
		try_files \$uri =404;
	}
	location / {
		add_header Cache-Control "no-cache";
		try_files \$uri /index.html;
	}
}
EOF
if ! nginx -t; then cp /tmp/labeled.conf.http $CONF; echo "Ошибка в конфиге HTTPS — возвращён прежний"; exit 1; fi
systemctl reload nginx
echo "Готово: https://$D/"
