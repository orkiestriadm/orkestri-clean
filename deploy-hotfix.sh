#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Enviando arquivos alterados de backend e frontend para o servidor..."
tar czf - \
  backend/src/modules/auth/auth.service.ts \
  backend/src/modules/frota/reservas/reservas.controller.ts \
  frontend/src/middleware.ts \
  frontend/src/components/layout/Sidebar.tsx \
  frontend/src/app/reservas/veiculos/page.tsx \
  frontend/src/app/reservas/calendario/page.tsx \
  frontend/src/app/reservas/lista/page.tsx \
  frontend/src/app/dashboard/cadastros/page.tsx \
  frontend/src/app/dashboard/executivo/page.tsx \
  frontend/src/app/dashboard/frota/manutencoes/page.tsx \
  frontend/src/app/dashboard/monitoramento/page.tsx \
| ssh -o StrictHostKeyChecking=no "$SERVER" '
  set -e
  echo "==> Localizando diretório do projeto..."
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f "$x/docker-compose.yml" ] && D="$x" && break
  done
  
  if [ -z "$D" ]; then
    echo "Diretório orkestri não encontrado no servidor!"
    exit 1
  fi
  
  echo "==> Extraindo arquivos em $D..."
  cd "$D"
  tar xzf -
  
  echo "==> Rebuildando backend e frontend..."
  docker compose build api frontend
  
  echo "==> Reiniciando serviços..."
  docker compose up -d api frontend
  
  echo "=== DEPLOY CONCLUÍDO COM SUCESSO ==="
'
