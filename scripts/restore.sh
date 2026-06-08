#!/bin/bash
# restore.sh — Restaura o banco de dados a partir de um backup
#
# Uso:
#   bash /opt/orkestri/scripts/restore.sh /opt/orkestri/backups/db/db_20260518_020000.sql.gz
#
# ATENÇÃO: apaga os dados atuais do banco antes de restaurar.

set -euo pipefail

BACKUP_FILE="${1:-}"
DB_CONTAINER="orkestri_postgres"
DB_USER="orkestri"
DB_NAME="orkestri"

if [ -z "$BACKUP_FILE" ]; then
  echo ""
  echo "Uso: bash restore.sh <arquivo.sql.gz>"
  echo ""
  echo "Backups disponíveis:"
  ls -lht /opt/orkestri/backups/db/*.sql.gz 2>/dev/null | head -20 || echo "  (nenhum backup encontrado)"
  echo ""
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERRO: arquivo não encontrado: $BACKUP_FILE"
  exit 1
fi

echo ""
echo "======================================================="
echo "  RESTAURAÇÃO DO BANCO ORKESTRI"
echo "======================================================="
echo ""
echo "  Arquivo : $BACKUP_FILE"
echo "  Tamanho : $(du -sh "$BACKUP_FILE" | cut -f1)"
echo "  Banco   : $DB_NAME no container $DB_CONTAINER"
echo ""
echo "  ATENÇÃO: todos os dados atuais serão APAGADOS."
echo ""
read -r -p "  Confirma a restauração? (digite SIM para continuar): " CONFIRM

if [ "$CONFIRM" != "SIM" ]; then
  echo "Restauração cancelada."
  exit 0
fi

echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando restauração..."

# Encerra conexões ativas
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

# Recria o banco
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" > /dev/null
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" > /dev/null

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Banco recriado. Restaurando dados..."

# Restaura
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" > /dev/null

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauração concluída com sucesso."
echo ""
echo "Reiniciando API para reconectar ao banco..."
cd /opt/orkestri && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api
echo "Pronto."
