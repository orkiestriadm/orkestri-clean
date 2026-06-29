#!/bin/bash
# Fix: barra de progresso do modulo Projetos agora e PONDERADA pelo estagio da
# tarefa (A Fazer 0%, Em Andamento 50%, Em Revisao 80%, Concluida 100%);
# canceladas saem da conta. So backend -> rebuild da api.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy FIX progresso Projetos -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  backend/src/modules/projects/projects.module.ts \
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
echo "==> Arquivo atualizado. Rebuild api..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api
else
  docker compose up -d --build api
fi
echo ""
echo "=== DEPLOY_OK ==="
'
