#!/usr/bin/env bash
# =============================================================================
# status.sh — Exibe status de todos os tenants provisionados
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENANTS_FILE="$SCRIPT_DIR/tenants.json"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

TOTAL=$(jq '.tenants | length' "$TENANTS_FILE")

echo ""
echo -e "${BOLD}Orkestri SaaS — Status dos Tenants${RESET}  (${TOTAL} tenant(s))"
echo -e "${DIM}$(date -u '+%Y-%m-%d %H:%M:%S UTC')${RESET}"
echo ""

if [[ "$TOTAL" -eq 0 ]]; then
  echo -e "  ${DIM}Nenhum tenant provisionado ainda.${RESET}"
  echo ""
  exit 0
fi

printf "  %-20s %-25s %-12s %-12s %-12s %-12s\n" "SLUG" "NOME" "POSTGRES" "REDIS" "API" "FRONTEND"
echo "  $(printf '%.0s─' {1..95})"

while IFS= read -r tenant; do
  SLUG=$(echo "$tenant" | jq -r '.slug')
  NOME=$(echo "$tenant" | jq -r '.nome')

  get_status() {
    local cname="$1"
    local state
    state=$(docker inspect --format='{{.State.Status}}' "$cname" 2>/dev/null || echo "absent")
    local health
    health=$(docker inspect --format='{{.State.Health.Status}}' "$cname" 2>/dev/null || echo "")
    if [[ "$state" == "running" ]]; then
      if [[ "$health" == "healthy" ]]; then
        echo -e "${GREEN}healthy${RESET}"
      elif [[ "$health" == "unhealthy" ]]; then
        echo -e "${RED}unhealthy${RESET}"
      elif [[ "$health" == "starting" ]]; then
        echo -e "${YELLOW}starting${RESET}"
      else
        echo -e "${GREEN}running${RESET}"
      fi
    elif [[ "$state" == "absent" ]]; then
      echo -e "${RED}absent${RESET}"
    else
      echo -e "${RED}$state${RESET}"
    fi
  }

  PG=$(get_status "ork_${SLUG}_postgres")
  RD=$(get_status "ork_${SLUG}_redis")
  API=$(get_status "ork_${SLUG}_api")
  FE=$(get_status "ork_${SLUG}_frontend")

  printf "  %-20s %-25s %-20b %-20b %-20b %-20b\n" "$SLUG" "${NOME:0:24}" "$PG" "$RD" "$API" "$FE"
done < <(jq -c '.tenants[]' "$TENANTS_FILE")

echo ""

# Uso de recursos
echo -e "${DIM}Uso de recursos dos containers Orkestri:${RESET}"
docker stats --no-stream --format "  {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
  $(docker ps --filter "label=orkestri.tenant" --format "{{.Names}}" 2>/dev/null) 2>/dev/null || \
  echo -e "  ${DIM}Nenhum container Orkestri em execução.${RESET}"

echo ""
