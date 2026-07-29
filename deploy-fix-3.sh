#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Enviando arquivos de correcao do crud para o servidor..."
tar czf - \
  frontend/src/app/dashboard/frota/veiculos/page.tsx \
  frontend/src/app/dashboard/frota/_components/crud.tsx \
| ssh -o StrictHostKeyChecking=no "$SERVER" '
  set -e
  echo "==> Extraindo arquivos..."
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f "$x/docker-compose.yml" ] && D="$x" && break
  done
  cd "$D"
  tar xzf -
  
  echo "==> Rebuildando frontend..."
  docker compose build frontend
  
  echo "==> Reiniciando frontend..."
  docker compose up -d frontend
  
  echo "=== FEITO ==="
'
