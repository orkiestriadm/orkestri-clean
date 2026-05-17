#!/usr/bin/env bash
# =============================================================================
# backup-tenant.sh — Backup do banco de dados de um tenant específico
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENANTS_FILE="$SCRIPT_DIR/tenants.json"
BACKUP_BASE="${BACKUP_DIR:-$SCRIPT_DIR/backups}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
die()     { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

usage() {
  cat <<EOF
${BOLD}Uso:${RESET} $0 <slug>

  Faz dump do banco PostgreSQL do tenant para $BACKUP_BASE/<slug>/

  A variável BACKUP_DIR pode sobrescrever o diretório base.

EOF
  exit 1
}

[[ $# -lt 1 ]] && usage

TENANT_SLUG="$1"

# Verifica existência
if ! jq -e --arg s "$TENANT_SLUG" '.tenants[] | select(.slug == $s)' "$TENANTS_FILE" > /dev/null 2>&1; then
  die "Tenant '$TENANT_SLUG' não encontrado no registro."
fi

PG_CONTAINER="ork_${TENANT_SLUG}_postgres"

# Verifica se container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
  die "Container $PG_CONTAINER não está em execução."
fi

# Lê credenciais do .env do tenant
TENANT_DIR="$SCRIPT_DIR/tenants/$TENANT_SLUG"
DB_USER=$(grep "^POSTGRES_USER=" "$TENANT_DIR/.env" | cut -d= -f2)
DB_NAME=$(grep "^POSTGRES_DB=" "$TENANT_DIR/.env" | cut -d= -f2)

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR_TENANT="$BACKUP_BASE/$TENANT_SLUG"
BACKUP_FILE="$BACKUP_DIR_TENANT/${TENANT_SLUG}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR_TENANT"

info "Iniciando backup de '$TENANT_SLUG' → $BACKUP_FILE"

docker exec "$PG_CONTAINER" \
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
success "Backup concluído: $BACKUP_FILE ($SIZE)"

# Limpa backups com mais de 30 dias
find "$BACKUP_DIR_TENANT" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null && \
  info "Backups com mais de 30 dias removidos."

echo ""
