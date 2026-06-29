#!/bin/bash
# Deploy cirurgico do Monitoramento OSA (Zabbix) para a producao 10.192.4.123
# Envia 3 arquivos + adiciona ZABBIX no .env + rebuild de api/frontend.
# NAO toca em banco, migrations, nem em outros servicos.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy OSA -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  backend/src/modules/osa/osa.module.ts \
  frontend/src/app/dashboard/monitoramento/osa/page.tsx \
  docker-compose.yml \
| ssh -o StrictHostKeyChecking=no "$SERVER" '
set -e
D=/opt/orkestri
if [ ! -f "$D/docker-compose.yml" ]; then
  for x in /home/*/orkestri* /root/orkestri* /srv/orkestri* /opt/orkestri*; do
    [ -f "$x/docker-compose.yml" ] && D="$x" && break
  done
fi
[ -f "$D/docker-compose.yml" ] || { echo "ERRO: diretorio do orkestri nao encontrado no servidor"; exit 1; }
echo "==> Producao em: $D"
cd "$D"
tar xzf -
echo "==> Arquivos atualizados."
if ! grep -q ZABBIX_API_URL .env 2>/dev/null; then
  printf "\nZABBIX_API_URL=http://10.192.100.191/zabbix/api_jsonrpc.php\nZABBIX_API_TOKEN=338d1fd0f5c5b9ec6059a3e0ba71942fd43e3355570e8e10d9caeb9749df2205\n" >> .env
  echo "==> .env: credenciais ZABBIX adicionadas."
else
  echo "==> .env: ZABBIX ja presente."
fi
echo "==> Rebuild api + frontend (pode levar alguns minutos)..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api frontend
else
  docker compose up -d --build api frontend
fi
echo ""
echo "=== DEPLOY_OK ==="
'
