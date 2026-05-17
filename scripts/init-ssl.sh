#!/bin/bash
# init-ssl.sh — Obtém o primeiro certificado Let's Encrypt para orkiestri.com
#
# Fluxo:
#   1. Cria certificado self-signed temporário (nginx precisa de cert para subir)
#   2. Sobe nginx (HTTP only, webroot challenge)
#   3. Certbot obtém certificado real
#   4. Recarrega nginx com SSL ativo
#
# Uso (no servidor, dentro de /opt/orkestri):
#   bash scripts/init-ssl.sh

set -euo pipefail

DOMAIN="orkiestri.com"
EMAIL="guilumagaro@gmail.com"
SSL_DIR="./ssl"
CERT_DIR="$SSL_DIR/letsencrypt/live/$DOMAIN"
WWW_DIR="$SSL_DIR/www"

echo "==> Criando diretórios SSL..."
mkdir -p "$CERT_DIR" "$WWW_DIR"

# ── 1. Certificado self-signed temporário ────────────────────────────────────
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  echo "==> Gerando certificado self-signed temporário..."
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN"
fi

# ── 2. Sobe stack (nginx usa self-signed, apenas porta 80 inicialmente) ───────
echo "==> Subindo stack..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx

echo "==> Aguardando nginx ficar pronto..."
for i in $(seq 1 15); do
  if curl -sf http://localhost/health > /dev/null 2>&1; then
    echo "    nginx OK"
    break
  fi
  echo "    tentativa $i/15..."
  sleep 2
done

# ── 3. Certbot obtém certificado real ────────────────────────────────────────
echo "==> Obtendo certificado Let's Encrypt para $DOMAIN..."
docker run --rm \
  -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/ssl/www:/var/www/certbot" \
  certbot/certbot:latest certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# ── 4. Recarrega nginx com certificado real ───────────────────────────────────
echo "==> Recarregando nginx com SSL..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo ""
echo "==> SSL configurado com sucesso!"
echo "    Acesse: https://$DOMAIN"
