#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Enviando arquivos para o servidor de produção..."
tar czf - \
  frontend/src/app/dashboard/frota/manutencoes/[id]/page.tsx \
| ssh -o StrictHostKeyChecking=no "$SERVER" '
  set -e
  echo "==> Extraindo arquivos no servidor..."
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f "$x/docker-compose.yml" ] && D="$x" && break
  done
  if [ -z "$D" ]; then echo "Projeto não encontrado."; exit 1; fi
  cd "$D"
  tar xzf -
  
  echo "==> Rebuildando frontend..."
  docker compose build frontend
  
  echo "==> Reiniciando containers..."
  docker compose up -d frontend
  
  echo "=== FEITO ==="
'
