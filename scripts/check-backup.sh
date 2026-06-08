#!/bin/bash
# check-backup.sh — Verifica se o backup mais recente é recente o suficiente.
#
# Se o último arquivo em backups/db/ tem mais de MAX_AGE_HOURS, dispara alerta.
# Resolve o problema "backup parou silenciosamente e ninguém viu por 19 dias".
#
# Uso manual:
#   bash /opt/orkestri/scripts/check-backup.sh
#
# Cron (configurado pelo install-backup-cron.sh):
#   30 6 * * * /opt/orkestri/scripts/check-backup.sh
#
# Configuração (em .env do servidor):
#   BACKUP_ALERT_WEBHOOK=https://...  (opcional) — recebe POST JSON quando falta backup
#   BACKUP_MAX_AGE_HOURS=30           (opcional) — tolerância, default 30h
#
# Exit codes:
#   0  → backup OK (idade ≤ MAX_AGE_HOURS)
#   1  → backup ausente ou velho demais

set -u

REMOTE_DIR="/opt/orkestri"
BACKUP_DIR="$REMOTE_DIR/backups"
DB_DIR="$BACKUP_DIR/db"
LOG_FILE="$BACKUP_DIR/logs/alerts.log"
ENV_FILE="$REMOTE_DIR/.env"

mkdir -p "$BACKUP_DIR/logs"

# carrega configs do .env, se existir
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"
WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── Encontra o backup mais recente ───────────────────────────────────────────
LATEST=$(ls -t "$DB_DIR"/*.sql.gz 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  log "🚨 ALERTA: nenhum backup encontrado em $DB_DIR"
  STATUS="missing"
  AGE_HOURS=999999
  LATEST_NAME="(nenhum)"
else
  LATEST_NAME=$(basename "$LATEST")
  # idade em segundos → horas (inteiro)
  if [ "$(uname)" = "Darwin" ]; then
    LATEST_EPOCH=$(stat -f %m "$LATEST")
  else
    LATEST_EPOCH=$(stat -c %Y "$LATEST")
  fi
  NOW_EPOCH=$(date +%s)
  AGE_SEC=$((NOW_EPOCH - LATEST_EPOCH))
  AGE_HOURS=$((AGE_SEC / 3600))

  if [ "$AGE_HOURS" -le "$MAX_AGE_HOURS" ]; then
    log "✅ Backup OK: $LATEST_NAME (${AGE_HOURS}h atrás, limite ${MAX_AGE_HOURS}h)"
    exit 0
  fi

  log "🚨 ALERTA: backup mais recente é $LATEST_NAME, idade ${AGE_HOURS}h (limite ${MAX_AGE_HOURS}h)"
  STATUS="stale"
fi

# ── Dispara webhook se configurado ───────────────────────────────────────────
if [ -n "$WEBHOOK_URL" ]; then
  HOSTNAME_VAL=$(hostname)
  PAYLOAD=$(cat <<EOF
{"alert":"backup_missing","status":"$STATUS","host":"$HOSTNAME_VAL","lastBackup":"$LATEST_NAME","ageHours":$AGE_HOURS,"limitHours":$MAX_AGE_HOURS,"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
  )
  HTTP_CODE=$(curl -s -o /tmp/backup-alert-resp -w "%{http_code}" \
    -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" --max-time 10 || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "204" ]; then
    log "→ Webhook enviado com sucesso (HTTP $HTTP_CODE)"
  else
    log "→ Falha ao enviar webhook (HTTP $HTTP_CODE)"
  fi
fi

exit 1
