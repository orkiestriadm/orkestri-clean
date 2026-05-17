#!/bin/bash
# deploy.sh — Envia o código para o servidor Lightsail
# Uso: bash deploy.sh <IP_DO_SERVIDOR> [usuario]
# Exemplo: bash deploy.sh 18.215.185.83

SERVER_IP="${1:-18.215.185.83}"
SERVER_USER="${2:-ubuntu}"
REMOTE_DIR="/opt/orkestri"
KEY_FILE="${3:-}"  # Opcional: caminho para o .pem

SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "$KEY_FILE" ]; then
  SSH_OPTS="$SSH_OPTS -i $KEY_FILE"
fi

echo "==> Enviando código para $SERVER_USER@$SERVER_IP:$REMOTE_DIR"

rsync -avz --progress \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude 'docker-compose.override.yml' \
  --exclude '*.log' \
  -e "ssh $SSH_OPTS" \
  ./ "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

echo ""
echo "==> Enviando .env de produção como .env no servidor"
scp $SSH_OPTS .env.production "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/.env"

echo ""
echo "==> Código enviado com sucesso!"
echo ""
echo "Próximo passo — acesse o servidor:"
echo "  ssh $SSH_OPTS $SERVER_USER@$SERVER_IP"
echo "  cd $REMOTE_DIR && docker compose up -d"
