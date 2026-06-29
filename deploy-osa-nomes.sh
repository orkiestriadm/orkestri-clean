#!/bin/bash
# Mostra o nome da OSA ao lado do ID_OSA no card de consulta N1. Frontend-only.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy OSA nomes (ID - Nome) -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - frontend/src/app/dashboard/monitoramento/osa/page.tsx \
| ssh -o StrictHostKeyChecking=no "$SERVER" '
set -e
D=/opt/orkestri
if [ ! -f "$D/docker-compose.yml" ]; then
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f "$x/docker-compose.yml" ] && D="$x" && break
  done
fi
[ -f "$D/docker-compose.yml" ] || { echo "ERRO: diretorio do orkestri nao encontrado"; exit 1; }
echo "==> Producao em: $D"
cd "$D"
tar xzf -
echo "==> Arquivo atualizado. Rebuild do frontend..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend
else
  docker compose up -d --build frontend
fi
echo ""
echo "=== DEPLOY_OK ==="
'
