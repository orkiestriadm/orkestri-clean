#!/bin/bash
# Deploy: correcao do dias-de-atraso (calculo pela data real) + enriquecimento do
# Dashboard Financeiro (valor vencido/a vencer, ticket medio, aging, proximos vencimentos, naturezas).
# Envia 3 arquivos + rebuild api/frontend. Nao mexe no banco nem em permissoes.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy DASHBOARD FINANCEIRO -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  backend/src/modules/financeiro/financeiro.module.ts \
  frontend/src/app/dashboard/financeiro/page.tsx \
  frontend/src/app/dashboard/financeiro/contas-a-pagar/page.tsx \
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
echo "==> Arquivos atualizados. Rebuild api + frontend..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api frontend
else
  docker compose up -d --build api frontend
fi
echo ""
echo "=== DEPLOY_OK ==="
'
