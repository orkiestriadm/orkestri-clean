#!/bin/bash
# Script para puxar (fazer o pull) das atualizações de Homologação para o localhost
# Mantém os arquivos locais de ambiente (.env) e pastas como .git seguros

SERVER_IP="10.192.4.123"
SERVER_USER="planner"
REMOTE_DIR="/opt/orkestri"

echo "==> Baixando atualizações do servidor de Homologação ($SERVER_IP)..."
echo "OBS: Quando for solicitada a senha, digite: TBR.153.info"
echo ""

rsync -avz --progress \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude 'docker-compose.override.yml' \
  --exclude '*.log' \
  "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/" ./

echo ""
echo "==> Código atualizado com sucesso no seu ambiente local (C:\orkestri-clean)!"
