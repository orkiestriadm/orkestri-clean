#!/usr/bin/env bash
# =============================================================================
# update-all.sh — Atualiza todos os tenants para a versão mais recente das imagens
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENANTS_FILE="$SCRIPT_DIR/tenants.json"
TENANTS_DIR="$SCRIPT_DIR/tenants"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
die()     { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

TOTAL=$(jq '.tenants | length' "$TENANTS_FILE")
[[ "$TOTAL" -eq 0 ]] && { warn "Nenhum tenant provisionado."; exit 0; }

echo ""
echo -e "${BOLD}Orkestri SaaS — Atualização de tenants${RESET}  (${TOTAL} tenant(s))"
echo ""

# ---------------------------------------------------------------------------
# 1. Puxa novas imagens
# ---------------------------------------------------------------------------
info "Puxando imagens mais recentes..."
docker pull orkestri/api:latest
docker pull orkestri/frontend:latest
success "Imagens atualizadas."

# ---------------------------------------------------------------------------
# 2. Atualiza cada tenant (rolling restart)
# ---------------------------------------------------------------------------
FAILED=()

while IFS= read -r tenant; do
  SLUG=$(echo "$tenant" | jq -r '.slug')
  NOME=$(echo "$tenant" | jq -r '.nome')
  TENANT_DIR="$TENANTS_DIR/$SLUG"

  info "Atualizando tenant '$SLUG' ($NOME)..."

  if [[ ! -f "$TENANT_DIR/docker-compose.yml" ]]; then
    warn "  docker-compose.yml não encontrado para '$SLUG'. Pulando."
    FAILED+=("$SLUG")
    continue
  fi

  cd "$TENANT_DIR"

  # Restart apenas dos containers api e frontend (postgres e redis não mudam de imagem)
  if docker compose --env-file .env up -d --no-deps ork_${SLUG}_api ork_${SLUG}_frontend 2>&1; then
    success "  Tenant '$SLUG' atualizado."
  else
    warn "  Falha ao atualizar tenant '$SLUG'."
    FAILED+=("$SLUG")
  fi
done < <(jq -c '.tenants[]' "$TENANTS_FILE")

# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------
echo ""
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}Todos os ${TOTAL} tenant(s) atualizados com sucesso!${RESET}"
else
  echo -e "${YELLOW}${BOLD}${TOTAL} tenants processados. Falhas: ${FAILED[*]}${RESET}"
  echo -e "  Verifique os logs manualmente para os tenants com falha."
fi
echo ""
