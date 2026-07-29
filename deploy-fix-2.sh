#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Enviando arquivos alterados para o servidor de produção..."
tar czf - \
  frontend/src/app/dashboard/frota/veiculos/page.tsx \
  backend/src/modules/frota/frota.module.ts \
| ssh -o StrictHostKeyChecking=no "$SERVER" '
  set -e
  echo "==> Extraindo arquivos no servidor..."
  # Encontra a pasta do projeto (geralmente /opt/orkestri)
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f "$x/docker-compose.yml" ] && D="$x" && break
  done
  if [ -z "$D" ]; then echo "Projeto não encontrado."; exit 1; fi
  cd "$D"
  tar xzf -
  
  echo "==> Rebuildando frontend e API..."
  docker compose build frontend api
  
  echo "==> Reiniciando containers..."
  docker compose up -d frontend api
  
  echo "=== FEITO ==="
'
