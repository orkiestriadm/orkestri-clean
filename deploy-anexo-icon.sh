#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Copiando frontend..."
scp -o StrictHostKeyChecking=no frontend/src/app/dashboard/frota/manutencoes/page.tsx "$SERVER:/home/planner/orkestri/frontend/src/app/dashboard/frota/manutencoes/page.tsx"

echo "==> Copiando backend..."
scp -o StrictHostKeyChecking=no backend/src/modules/frota/frota.module.ts "$SERVER:/home/planner/orkestri/backend/src/modules/frota/frota.module.ts"

echo "==> Reiniciando serviços..."
ssh -o StrictHostKeyChecking=no "$SERVER" '
  cd /home/planner/orkestri
  echo "==> Rebuildando frontend..."
  docker compose build frontend
  docker compose build api
  echo "==> Reiniciando containers..."
  docker compose up -d frontend api
  echo "=== FEITO ==="
'
