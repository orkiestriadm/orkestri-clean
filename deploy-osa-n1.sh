#!/bin/bash
# Feature: mostra no OSA o sequencial ESPERADO do N1 (MTP_LISTAG) + atraso, por SERIE.
# Backend (mysql2 + osa.module) + frontend (card) + env N1 + rebuild api/frontend.
# Inclui teste de conectividade prod -> 10.204.1.6:3306.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy OSA + N1 -> producao $SERVER"
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

# Credenciais do N1 no .env (se faltarem)
if ! grep -q "N1_DB_HOST" .env 2>/dev/null; then
  printf "\nN1_DB_HOST=10.204.1.6\nN1_DB_PORT=3306\nN1_DB_USER=root\nN1_DB_PASS=Fadami@12\nN1_DB_NAME=SGA_N1\n" >> .env
  echo "==> .env: credenciais N1 adicionadas."
else
  echo "==> .env: N1 ja presente."
fi

# Teste de conectividade prod -> N1
echo "==> Testando rota prod -> 10.204.1.6:3306 ..."
if timeout 5 bash -c "cat < /dev/null > /dev/tcp/10.204.1.6/3306" 2>/dev/null; then
  echo "    >>> N1 ALCANCAVEL pela producao. OK."
else
  echo "    >>> ATENCAO: N1 INALCANCAVEL pela producao (subrede/firewall)."
  echo "    >>> A feature sobe sem erro, mas o Esperado(N1) so aparece quando a rota for liberada."
fi

echo "==> Rebuild api + frontend..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api frontend
else
  docker compose up -d --build api frontend
fi
echo ""
echo "=== DEPLOY_OK ==="
'
