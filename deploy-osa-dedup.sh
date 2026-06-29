#!/bin/bash
# Remove o card duplicado "Via SMB" do SEMPARAR (auto-descoberto do Zabbix).
# A lista /osa passa a mostrar so monitores SMB manuais (sem zabbix_host_id).
# Backend-only: envia osa.module.ts + rebuild da api. Nao toca banco/worker/frontend.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy OSA (remove duplicado SMB) -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - backend/src/modules/osa/osa.module.ts \
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
echo "==> osa.module.ts atualizado. Rebuild da api..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api
else
  docker compose up -d --build api
fi
echo ""
echo "=== DEPLOY_OK ==="
'
