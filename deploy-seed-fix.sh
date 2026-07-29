#!/bin/bash
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploying Seed & Frontend Fix to Production ($SERVER)"

tar czf - \
  backend/prisma/seed-frota-veiculos.js \
  frontend/src/app/dashboard/frota \
| ssh -o StrictHostKeyChecking=no "$SERVER" '
set -e
D=/opt/orkestri
if [ ! -f "$D/docker-compose.yml" ]; then
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f "$x/docker-compose.yml" ] && D="$x" && break
  done
fi
cd "$D"
tar xzf -
echo "==> Arquivos atualizados. Rebuild frontend..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend
else
  docker compose up -d --build frontend
fi

echo "==> Rodando seed no container API em produção..."
docker exec orkestri_api node prisma/seed-frota-veiculos.js
echo "=== FEITO ==="
'
