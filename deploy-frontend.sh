#!/bin/bash
# Deploy frontend: Orcamento no grupo Financeiro do menu + nomes logicos no OSA
# (card N1 com ID-Nome e cards Via Zabbix com nome logico). Frontend-only.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy FRONTEND (menu Orcamento + nomes OSA) -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  frontend/src/components/layout/Sidebar.tsx \
  frontend/src/app/dashboard/monitoramento/osa/page.tsx \
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
echo "==> Arquivos atualizados. Rebuild do frontend..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend
else
  docker compose up -d --build frontend
fi
echo ""
echo "=== DEPLOY_OK ==="
'
