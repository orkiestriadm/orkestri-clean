#!/bin/bash
# Feature: card "Consultar Sequencial (N1)" na tela OSA — usuario informa IP/usuario/senha/banco
# e ve o SELECT da MTP_LISTAG ali mesmo. Backend (endpoint + mysql2) + frontend (card).
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy CARD CONSULTAR N1 -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  backend/src/modules/osa/osa.module.ts \
  backend/package.json \
  docker-compose.yml \
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
echo "==> Arquivos atualizados."
echo "==> Testando rota prod -> 10.204.1.6:22 (SSH) ..."
if timeout 5 bash -c "cat < /dev/null > /dev/tcp/10.204.1.6/22" 2>/dev/null; then
  echo "    >>> Servidor N1 ALCANCAVEL pela producao (porta 22). OK."
else
  echo "    >>> ATENCAO: producao NAO alcanca 10.204.1.6:22 — o card vai dar erro de conexao."
  echo "    >>> Precisa liberar a rota da producao ate o(s) servidor(es) N."
fi
echo "==> Rebuild api + frontend (instala ssh2 no build da api)..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api frontend
else
  docker compose up -d --build api frontend
fi
echo ""
echo "=== DEPLOY_OK ==="
'
