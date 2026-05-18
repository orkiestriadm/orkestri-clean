#!/bin/bash
# backup.sh — Backup automático do Orkestri (banco + uploads)
#
# Estratégia de retenção:
#   Diários  → 7 arquivos  (últimos 7 dias)
#   Semanais → 4 arquivos  (domingo de cada semana, últimas 4 semanas)
#   Mensais  → 3 arquivos  (1º de cada mês, últimos 3 meses)
#
# Uso manual:
#   bash /opt/orkestri/scripts/backup.sh
#
# Cron (configurado pelo install-backup-cron.sh):
#   0 5 * * * /opt/orkestri/scripts/backup.sh >> /opt/orkestri/backups/logs/cron.log 2>&1

set -euo pipefail

REMOTE_DIR="/opt/orkestri"
BACKUP_DIR="$REMOTE_DIR/backups"
LOG_FILE="$BACKUP_DIR/logs/backup_$(date +%Y%m%d_%H%M%S).log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)   # 1=segunda … 7=domingo
DAY_OF_MONTH=$(date +%d)  # 01-31

DB_CONTAINER="orkestri_postgres"
DB_USER="orkestri"
DB_NAME="orkestri"

mkdir -p "$BACKUP_DIR"/{db,uploads,logs}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── Verifica se os containers estão rodando ────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  log "ERRO: container ${DB_CONTAINER} não está rodando. Abortando."
  exit 1
fi

log "======================================================="
log "Iniciando backup Orkestri — $TIMESTAMP"
log "======================================================="

# ── 1. Backup do banco de dados ───────────────────────────────────────────────
DB_FILE="$BACKUP_DIR/db/db_${TIMESTAMP}.sql.gz"
log "Fazendo pg_dump → $DB_FILE"

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$DB_FILE"

DB_SIZE=$(du -sh "$DB_FILE" | cut -f1)
log "Banco salvo: $DB_SIZE"

# ── 2. Backup de uploads (volume Docker) ─────────────────────────────────────
UPLOADS_FILE="$BACKUP_DIR/uploads/uploads_${TIMESTAMP}.tar.gz"
log "Arquivando volume de uploads → $UPLOADS_FILE"

docker run --rm \
  -v orkestri_uploads_data:/data:ro \
  -v "$BACKUP_DIR/uploads":/backup \
  alpine \
  tar czf "/backup/uploads_${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null || true

if [ -f "$UPLOADS_FILE" ]; then
  UP_SIZE=$(du -sh "$UPLOADS_FILE" | cut -f1)
  log "Uploads salvos: $UP_SIZE"
else
  log "AVISO: volume de uploads vazio ou backup ignorado."
fi

# ── 3. Promover para semanal (domingo = dia 7) ────────────────────────────────
if [ "$DAY_OF_WEEK" = "7" ]; then
  cp "$DB_FILE" "$BACKUP_DIR/db/weekly_$(date +%Y_W%V).sql.gz" 2>/dev/null || true
  log "Backup semanal salvo."
fi

# ── 4. Promover para mensal (dia 1 do mês) ───────────────────────────────────
if [ "$DAY_OF_MONTH" = "01" ]; then
  cp "$DB_FILE" "$BACKUP_DIR/db/monthly_$(date +%Y_%m).sql.gz" 2>/dev/null || true
  log "Backup mensal salvo."
fi

# ── 5. Limpeza — diários: mantém 7 dias ──────────────────────────────────────
DELETED=$(find "$BACKUP_DIR/db" -name "db_*.sql.gz" -mtime +7 -print -delete 2>/dev/null | wc -l)
[ "$DELETED" -gt 0 ] && log "Diários antigos removidos: $DELETED"

DELETED_UP=$(find "$BACKUP_DIR/uploads" -name "uploads_*.tar.gz" -mtime +7 -print -delete 2>/dev/null | wc -l)
[ "$DELETED_UP" -gt 0 ] && log "Uploads antigos removidos: $DELETED_UP"

# ── 6. Limpeza — semanais: mantém 4 semanas ──────────────────────────────────
WEEKLY_COUNT=$(find "$BACKUP_DIR/db" -name "weekly_*.sql.gz" | wc -l)
if [ "$WEEKLY_COUNT" -gt 4 ]; then
  EXCESS=$((WEEKLY_COUNT - 4))
  find "$BACKUP_DIR/db" -name "weekly_*.sql.gz" | sort | head -"$EXCESS" | xargs -r rm -f
  log "Semanais antigos removidos: $EXCESS"
fi

# ── 7. Limpeza — mensais: mantém 3 meses ─────────────────────────────────────
MONTHLY_COUNT=$(find "$BACKUP_DIR/db" -name "monthly_*.sql.gz" | wc -l)
if [ "$MONTHLY_COUNT" -gt 3 ]; then
  EXCESS=$((MONTHLY_COUNT - 3))
  find "$BACKUP_DIR/db" -name "monthly_*.sql.gz" | sort | head -"$EXCESS" | xargs -r rm -f
  log "Mensais antigos removidos: $EXCESS"
fi

# ── 8. Limpeza — logs antigos: mantém 30 dias ────────────────────────────────
find "$BACKUP_DIR/logs" -name "backup_*.log" -mtime +30 -delete 2>/dev/null || true

# ── 9. Resumo final ───────────────────────────────────────────────────────────
log "-------------------------------------------------------"
log "Backup concluído com sucesso."
log "Diários:  $(find "$BACKUP_DIR/db" -name "db_*.sql.gz" | wc -l) arquivo(s)"
log "Semanais: $(find "$BACKUP_DIR/db" -name "weekly_*.sql.gz" | wc -l) arquivo(s)"
log "Mensais:  $(find "$BACKUP_DIR/db" -name "monthly_*.sql.gz" | wc -l) arquivo(s)"
log "Espaço backups: $(du -sh "$BACKUP_DIR" | cut -f1)"
log "Espaço livre:   $(df -h / | awk 'NR==2{print $4}')"
log "======================================================="
