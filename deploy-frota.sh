#!/bin/bash
# Modulo Gestao de Frotas (NOVO): veiculos, motoristas, pneus, revisoes,
# manutencoes, documentacoes, abastecimentos + dashboard, relatorios e config.
# ATENCAO: cria tabelas novas no banco. O 'prisma migrate deploy' roda
# automaticamente no boot do container api e aplica a migration frota_gestao.
set -e
SERVER="planner@10.192.4.123"

# Empacota a partir do checkout principal (/c/orkestri-clean), que reflete a
# producao (inclui monitoramento, osa, financeiro etc.) + as adicoes da Frota.
cd "$(dirname "$0")"

echo "==> Deploy GESTAO DE FROTAS -> producao $SERVER"
echo "==> Origem dos arquivos: $(pwd)"
echo "==> Vai pedir a senha do SSH (usuario planner) UMA vez."
echo "==> Cria tabelas novas (migration roda sozinha no boot da api). Aguarde o build."
echo ""

tar czf - \
  backend/prisma/schema.prisma \
  backend/prisma/migrations/20260624000001_frota_gestao \
  backend/prisma/migrations/20260624000002_frota_veiculo_detalhe \
  backend/prisma/migrations/20260624000003_frota_motorista_detalhe \
  backend/prisma/migrations/20260624000004_frota_pneu_gestao \
  backend/prisma/migrations/20260624000005_frota_revisao_preventiva \
  backend/prisma/migrations/20260624000006_frota_manutencao_os \
  backend/prisma/migrations/20260624000007_frota_documento_anexos \
  backend/prisma/migrations/20260624000008_frota_abastecimento_custokm \
  backend/prisma/migrations/20260625000001_frota_report_schedules \
  backend/prisma/migrations/20260625000002_rename_criado_por_id \
  backend/src/modules/frota \
  backend/src/app.module.ts \
  backend/src/modules/auth/auth.service.ts \
  backend/src/modules/notifications/alert.scheduler.ts \
  backend/src/modules/notifications/email.service.ts \
  frontend/src/app/dashboard/frota \
  frontend/src/components/layout/Sidebar.tsx \
  frontend/src/components/layout/Topbar.tsx \
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
echo "==> Arquivos atualizados. Rebuild api + frontend (a migration roda no boot da api)..."
if [ -f docker-compose.prod.yml ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api frontend
else
  docker compose up -d --build api frontend
fi
echo ""
echo "=== DEPLOY_OK ==="
'
