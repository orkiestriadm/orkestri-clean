#!/bin/bash
# Modernizacao NOC da tela Servicos & Desempenho: cards densos com faixa de status,
# gauges radiais, sparkline ao vivo de CPU, discos em 2 colunas, tiles com icone.
# Backend (deep/overview traz mini-serie de CPU) + frontend (redesign).
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy NOC (modernizacao Servicos & Desempenho) -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  backend/src/modules/monitoramento/monitoramento.module.ts \
  frontend/src/app/dashboard/monitoramento/servicos/page.tsx \
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
