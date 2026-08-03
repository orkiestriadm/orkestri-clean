#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Enviando arquivos do calendario para o servidor..."
tar czf - \
  frontend/src/app/reservas/page.tsx \
  frontend/src/app/reservas/veiculos/page.tsx \
  frontend/src/app/reservas/calendario/page.tsx \
  frontend/src/app/reservas/lista/page.tsx \
  frontend/src/app/reservas/relatorios/page.tsx \
  frontend/src/app/reservas/components/ReservaModal.tsx \
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
