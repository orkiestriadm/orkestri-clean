#!/bin/bash
# Aba "Versao SAGA" em Servicos & Desempenho (dash por pista, lido do Zabbix item VersaoSaga).
# Inclui tambem o que estava pendente: endpoint saga-versoes, Orcamento no menu Financeiro,
# nomes logicos no OSA. Backend (osa.module) + frontend. Rebuild api + frontend.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy VERSAO SAGA (+ pendentes) -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  backend/src/modules/osa/osa.module.ts \
  frontend/src/app/dashboard/monitoramento/servicos/page.tsx \
  frontend/src/app/dashboard/monitoramento/osa/page.tsx \
  frontend/src/components/layout/Sidebar.tsx \
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
