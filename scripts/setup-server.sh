#!/bin/bash
# setup-server.sh — Configura o servidor Lightsail do zero (Ubuntu 24.04)
#
# Instala Docker, configura o projeto e sobe a stack.
# Rodar APÓS copiar o código com deploy.sh e criar o .env.
#
# Uso:
#   bash scripts/setup-server.sh

set -euo pipefail

REMOTE_DIR="/opt/orkestri"

echo "==> Atualizando sistema..."
sudo apt-get update -q
sudo apt-get upgrade -y -q

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "==> Instalando Docker..."
  sudo apt-get install -y -q ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -q
  sudo apt-get install -y -q docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo "==> Docker instalado. Reloginando permissões..."
  newgrp docker << 'INNEREOF'
INNEREOF
else
  echo "==> Docker já instalado ($(docker --version))"
fi

# ── Diretório do projeto ───────────────────────────────────────────────────────
sudo mkdir -p "$REMOTE_DIR"
sudo chown "$USER:$USER" "$REMOTE_DIR"

# ── Verifica .env ─────────────────────────────────────────────────────────────
if [ ! -f "$REMOTE_DIR/.env" ]; then
  echo ""
  echo "ERRO: $REMOTE_DIR/.env não encontrado."
  echo "Execute deploy.sh primeiro para enviar o código e o .env."
  exit 1
fi

# ── Sobe a stack ──────────────────────────────────────────────────────────────
cd "$REMOTE_DIR"

echo "==> Construindo imagens..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo "==> Subindo serviços (sem nginx ainda)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d \
  postgres redis api frontend evolution sa_panel

echo "==> Aguardando API ficar pronta..."
for i in $(seq 1 20); do
  if docker compose exec -T api wget --spider -q http://127.0.0.1:3000/health 2>/dev/null; then
    echo "    API OK"
    break
  fi
  echo "    tentativa $i/20..."
  sleep 5
done

echo ""
echo "==> Stack rodando!"
echo ""
echo "Próximo passo:"
echo "  1. Configure DNS: A @ → $(curl -s ifconfig.me)"
echo "  2. Aguarde propagação (5-30 min) e teste: curl http://orkiestri.com/health"
echo "  3. Execute: bash scripts/init-ssl.sh"
