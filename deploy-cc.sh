#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Enviando arquivos alterados..."
tar czf - \
  backend/prisma/schema.prisma \
  backend/prisma/migrations \
  backend/src/modules/frota/frota.module.ts \
  backend/src/modules/frota/frota-relatorios.service.ts \
  backend/src/modules/frota/reservas/reservas.service.ts \
  frontend/src/app/dashboard/frota/page.tsx \
  frontend/src/app/dashboard/frota/veiculos/page.tsx \
  frontend/src/app/dashboard/frota/_components/crud.tsx \
  frontend/src/app/dashboard/frota/manutencoes/page.tsx \
  frontend/src/app/dashboard/frota/documentacoes/page.tsx \
| ssh -o StrictHostKeyChecking=no "$SERVER" "
  set -e
  echo \"==> Localizando diretorio...\"
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f \"\$x/docker-compose.yml\" ] && D=\"\$x\" && break
  done
  cd \"\$D\"
  tar xzf -
  echo \"==> Rebuild and restart...\"
  docker compose build api frontend
  docker compose up -d api frontend
  echo \"=== DEPLOY CONCLUIDO ===\"
"

