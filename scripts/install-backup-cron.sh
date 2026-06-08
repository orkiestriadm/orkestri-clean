#!/bin/bash
# install-backup-cron.sh — Instala o cron de backup automático do Orkestri
#
# Agenda backup diário às 02h00 (horário de Brasília = 05h00 UTC).
# Pode ser re-executado com segurança (não duplica a entrada).
#
# Uso:
#   bash /opt/orkestri/scripts/install-backup-cron.sh

set -euo pipefail

SCRIPT_PATH="/opt/orkestri/scripts/backup.sh"
CHECK_PATH="/opt/orkestri/scripts/check-backup.sh"
LOG_PATH="/opt/orkestri/backups/logs/cron.log"
CRON_LINE="0 5 * * * $SCRIPT_PATH >> $LOG_PATH 2>&1"
CHECK_LINE="30 6 * * * $CHECK_PATH >> $LOG_PATH 2>&1"
BACKUP_DIR="/opt/orkestri/backups"

echo "==> Verificando pré-requisitos..."

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "ERRO: $SCRIPT_PATH não encontrado. Execute este script a partir de /opt/orkestri."
  exit 1
fi

# Garante permissão de execução
chmod +x "$SCRIPT_PATH"
[ -f "$CHECK_PATH" ] && chmod +x "$CHECK_PATH"

# Cria diretórios necessários
mkdir -p "$BACKUP_DIR"/{db,uploads,logs}
echo "==> Diretórios de backup criados em $BACKUP_DIR"

# Instala entrada no cron sem duplicar
CURRENT_CRON=$(crontab -l 2>/dev/null || true)

if echo "$CURRENT_CRON" | grep -qF "$SCRIPT_PATH"; then
  echo "==> Cron de backup já configurado."
else
  (echo "$CURRENT_CRON"; echo "$CRON_LINE") | crontab -
  CURRENT_CRON=$(crontab -l 2>/dev/null || true)
  echo "==> Cron de backup instalado."
fi

# Cron do check-backup (apenas se o script existe)
if [ -f "$CHECK_PATH" ]; then
  if echo "$CURRENT_CRON" | grep -qF "$CHECK_PATH"; then
    echo "==> Cron de verificação já configurado."
  else
    (echo "$CURRENT_CRON"; echo "$CHECK_LINE") | crontab -
    echo "==> Cron de verificação instalado (06:30 diário)."
  fi
fi

echo ""
echo "Configuração atual do cron:"
crontab -l
echo ""
echo "==> Executando primeiro backup agora para verificar..."
bash "$SCRIPT_PATH"
echo ""
echo "==> Tudo pronto! Backups automáticos diários às 02h00 (Brasília)."
echo "    Logs em: $BACKUP_DIR/logs/"
echo "    Arquivos em: $BACKUP_DIR/db/"
