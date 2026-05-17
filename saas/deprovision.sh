#!/usr/bin/env bash
# =============================================================================
# deprovision.sh — Remove um tenant do Orkestri SaaS Assistido
# ATENÇÃO: Esta operação é destrutiva e irreversível!
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENANTS_FILE="$SCRIPT_DIR/tenants.json"
TENANTS_DIR="$SCRIPT_DIR/tenants"
NGINX_CONF_DIR="/etc/nginx/conf.d"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
die()     { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

usage() {
  cat <<EOF
${BOLD}Uso:${RESET} $0 <slug> [--force]

  slug     Identificador do tenant a remover
  --force  Pula confirmação interativa

${BOLD}Exemplos:${RESET}
  $0 acme
  $0 acme --force

EOF
  exit 1
}

[[ $# -lt 1 ]] && usage

TENANT_SLUG="$1"
FORCE="${2:-}"

# Verifica existência no registro
if ! jq -e --arg s "$TENANT_SLUG" '.tenants[] | select(.slug == $s)' "$TENANTS_FILE" > /dev/null 2>&1; then
  die "Tenant '$TENANT_SLUG' não encontrado no registro."
fi

TENANT_DIR="$TENANTS_DIR/$TENANT_SLUG"
TENANT_NOME=$(jq -r --arg s "$TENANT_SLUG" '.tenants[] | select(.slug == $s) | .nome' "$TENANTS_FILE")

# ---------------------------------------------------------------------------
# Confirmação
# ---------------------------------------------------------------------------
if [[ "$FORCE" != "--force" ]]; then
  echo ""
  echo -e "${RED}${BOLD}⚠  ATENÇÃO: OPERAÇÃO DESTRUTIVA E IRREVERSÍVEL!${RESET}"
  echo ""
  echo -e "  Tenant:    ${BOLD}$TENANT_SLUG${RESET} ($TENANT_NOME)"
  echo -e "  Diretório: $TENANT_DIR"
  echo ""
  echo -e "  Isso irá:"
  echo -e "    • Parar e remover todos os containers"
  echo -e "    • ${RED}Deletar todos os dados do banco de dados${RESET}"
  echo -e "    • Remover a configuração do nginx"
  echo -e "    • Remover o tenant do registro"
  echo ""
  read -rp "  Digite o slug '$TENANT_SLUG' para confirmar: " CONFIRM
  if [[ "$CONFIRM" != "$TENANT_SLUG" ]]; then
    echo "Operação cancelada."
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Para e remove containers
# ---------------------------------------------------------------------------
info "Parando containers de '$TENANT_SLUG'..."
if [[ -f "$TENANT_DIR/docker-compose.yml" ]]; then
  cd "$TENANT_DIR"
  docker compose down -v --remove-orphans 2>/dev/null || true
  success "Containers removidos."
else
  warn "docker-compose.yml não encontrado. Tentando remover containers manualmente..."
  for svc in postgres redis api frontend; do
    docker rm -f "ork_${TENANT_SLUG}_${svc}" 2>/dev/null && info "Removido ork_${TENANT_SLUG}_${svc}" || true
  done
fi

# Remove rede interna do tenant
docker network rm "ork_${TENANT_SLUG}_internal" 2>/dev/null && info "Rede interna removida." || true

# ---------------------------------------------------------------------------
# Remove dados
# ---------------------------------------------------------------------------
info "Removendo dados do tenant..."
if [[ -d "$TENANT_DIR" ]]; then
  rm -rf "$TENANT_DIR"
  success "Diretório $TENANT_DIR removido."
fi

# ---------------------------------------------------------------------------
# Remove config do nginx
# ---------------------------------------------------------------------------
info "Removendo configuração do nginx..."
NGINX_CONF="${NGINX_CONF_DIR}/${TENANT_SLUG}.conf"
if [[ -f "$NGINX_CONF" ]]; then
  rm -f "$NGINX_CONF"
  # Recarrega nginx
  if docker ps --format '{{.Names}}' | grep -q '^ork_nginx$'; then
    docker exec ork_nginx nginx -s reload && success "Nginx recarregado."
  elif systemctl is-active --quiet nginx 2>/dev/null; then
    nginx -t && systemctl reload nginx && success "Nginx recarregado."
  else
    warn "Nginx não encontrado em execução. Recarregue manualmente."
  fi
else
  warn "Config nginx não encontrada: $NGINX_CONF"
fi

# ---------------------------------------------------------------------------
# Atualiza registro
# ---------------------------------------------------------------------------
info "Atualizando registro..."
TMP="$(mktemp)"
jq --arg s "$TENANT_SLUG" 'del(.tenants[] | select(.slug == $s))' "$TENANTS_FILE" > "$TMP" && mv "$TMP" "$TENANTS_FILE"
success "Tenant removido do registro."

echo ""
echo -e "${GREEN}${BOLD}Tenant '$TENANT_SLUG' removido com sucesso.${RESET}"
echo ""
