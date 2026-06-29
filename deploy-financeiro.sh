#!/bin/bash
# Deploy do modulo Financeiro (Contas a Pagar) para a producao 10.192.4.123
# Envia modulo + telas + schema + migration (cria tabela contas_pagar) + rebuild.
# A unica mudanca de banco e ADITIVA: cria a tabela contas_pagar. Nao altera chamados.
set -e
SERVER="planner@10.192.4.123"
cd "$(dirname "$0")"

echo "==> Deploy FINANCEIRO -> producao $SERVER"
echo "==> Vai pedir a senha do SSH UMA vez. Aguarde o build no final."
echo ""

tar czf - \
  backend/src/modules/financeiro/financeiro.module.ts \
  backend/src/modules/auth/auth.service.ts \
  backend/src/app.module.ts \
  backend/prisma/schema.prisma \
  backend/prisma/migrations/20260617180001_financeiro_contas_pagar \
  frontend/package.json \
  frontend/src/app/dashboard/financeiro/page.tsx \
  frontend/src/app/dashboard/financeiro/contas-a-pagar/page.tsx \
  frontend/src/components/layout/Sidebar.tsx \
  frontend/src/app/dashboard/layout.tsx \
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
echo "==> Arquivos do financeiro atualizados."
echo "==> Rebuild api + frontend (a api roda a migration contas_pagar no boot)..."
if [ -f docker-compose.prod.yml ]; then
  DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
else
  DC="docker compose"
fi
$DC up -d --build api frontend
echo "==> Aguardando a api ficar pronta (migration + seed das permissoes)..."
set +e
for i in $(seq 1 50); do
  $DC exec -T api wget -q -O- http://127.0.0.1:3000/api/health >/dev/null 2>&1 && break
  sleep 3
done
sleep 3
echo "==> Limpando cache de permissoes no Redis (pra financeiro aparecer na hora)..."
RP=$(grep "^REDIS_PASSWORD=" .env | cut -d= -f2- | tr -d "\r")
$DC exec -T redis redis-cli -a "$RP" --no-auth-warning --scan --pattern "cache:permissions:*" 2>/dev/null | tr -d "\r" | while read k; do
  [ -n "$k" ] && $DC exec -T redis redis-cli -a "$RP" --no-auth-warning del "$k" >/dev/null 2>&1
done
echo "==> Cache de permissoes limpo (se falhar, expira sozinho em 5 min)."
set -e
echo ""
echo "=== DEPLOY_OK ==="
'
