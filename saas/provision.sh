#!/usr/bin/env bash
# =============================================================================
# provision.sh — Orkestri SaaS Assistido
# Provisiona um novo tenant isolado em container Docker dedicado
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TENANTS_FILE="$SCRIPT_DIR/tenants.json"
TENANTS_DIR="$SCRIPT_DIR/tenants"
NGINX_CONF_DIR="/etc/nginx/conf.d"
NGINX_TEMPLATE="$SCRIPT_DIR/nginx/tenant.conf.template"
DC_TEMPLATE="$SCRIPT_DIR/base/docker-compose.yml"
ENV_TEMPLATE="$SCRIPT_DIR/base/.env.template"

# ---------------------------------------------------------------------------
# Cores
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Uso
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
${BOLD}Uso:${RESET} $0 <slug> <nome> <admin-email> [admin-nome]

  slug        Identificador único do tenant (ex: acme, cliente01)
              Apenas letras minúsculas, números e hífens. Máx 20 chars.
  nome        Nome da empresa do tenant (ex: "Acme Corp")
  admin-email E-mail do usuário administrador inicial
  admin-nome  Nome do administrador (default: "Administrador")

${BOLD}Exemplos:${RESET}
  $0 acme "Acme Corp" admin@acme.com "João Silva"
  $0 startup1 "Startup One" ceo@startup.io

EOF
  exit 1
}

# ---------------------------------------------------------------------------
# Validação de argumentos
# ---------------------------------------------------------------------------
[[ $# -lt 3 ]] && usage

TENANT_SLUG="$1"
TENANT_NOME="$2"
MASTER_EMAIL="$3"
MASTER_NOME="${4:-Administrador}"

# Valida slug
if ! echo "$TENANT_SLUG" | grep -qE '^[a-z0-9][a-z0-9-]{0,19}$'; then
  die "Slug inválido: '$TENANT_SLUG'. Use apenas letras minúsculas, números e hífens (máx 20 chars, não pode começar com hífen)."
fi

# Verifica se tenant já existe
if jq -e --arg s "$TENANT_SLUG" '.tenants[] | select(.slug == $s)' "$TENANTS_FILE" > /dev/null 2>&1; then
  die "Tenant '$TENANT_SLUG' já existe. Use deprovision.sh para remover antes de reprovisionar."
fi

TENANT_DIR="$TENANTS_DIR/$TENANT_SLUG"
DOMAIN="${TENANT_SLUG}.orkestri.com.br"
PROVISIONED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# ---------------------------------------------------------------------------
# Verificações de dependências
# ---------------------------------------------------------------------------
info "Verificando dependências..."
for cmd in docker jq openssl; do
  command -v "$cmd" &>/dev/null || die "Dependência ausente: $cmd"
done

# Verifica rede proxy
if ! docker network ls --format '{{.Name}}' | grep -q '^orkestri_proxy$'; then
  warn "Rede 'orkestri_proxy' não encontrada. Criando..."
  docker network create orkestri_proxy
  success "Rede orkestri_proxy criada."
fi

# ---------------------------------------------------------------------------
# Geração de credenciais
# ---------------------------------------------------------------------------
info "Gerando credenciais seguras..."

DB_PASS="$(openssl rand -hex 20)"
JWT_SECRET="$(openssl rand -hex 40)"
JWT_REFRESH_SECRET="$(openssl rand -hex 40)"
# Senha com complexidade suficiente: base64 + sufixo com maiúscula, número e especial
ADMIN_PASS_BASE="$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12)"
ADMIN_PASS="${ADMIN_PASS_BASE}@Ork1"

success "Credenciais geradas."

# ---------------------------------------------------------------------------
# Cria estrutura de diretórios do tenant
# ---------------------------------------------------------------------------
info "Criando diretório do tenant em $TENANT_DIR ..."
mkdir -p "$TENANT_DIR/data/postgres" "$TENANT_DIR/data/redis"

# Gera .env
sed \
  -e "s|{{TENANT_SLUG}}|$TENANT_SLUG|g" \
  -e "s|{{TENANT_NOME}}|$TENANT_NOME|g" \
  -e "s|{{DOMAIN}}|$DOMAIN|g" \
  -e "s|{{DB_PASS}}|$DB_PASS|g" \
  -e "s|{{JWT_SECRET}}|$JWT_SECRET|g" \
  -e "s|{{JWT_REFRESH_SECRET}}|$JWT_REFRESH_SECRET|g" \
  -e "s|{{MASTER_EMAIL}}|$MASTER_EMAIL|g" \
  -e "s|{{MASTER_PASS}}|$ADMIN_PASS|g" \
  -e "s|{{MASTER_NOME}}|$MASTER_NOME|g" \
  "$ENV_TEMPLATE" > "$TENANT_DIR/.env"

# Gera docker-compose.yml
sed \
  -e "s|{{TENANT_SLUG}}|$TENANT_SLUG|g" \
  "$DC_TEMPLATE" > "$TENANT_DIR/docker-compose.yml"

success "Arquivos de configuração criados."

# ---------------------------------------------------------------------------
# Sobe os containers
# ---------------------------------------------------------------------------
info "Iniciando containers para tenant '$TENANT_SLUG'..."
cd "$TENANT_DIR"
docker compose up -d

# ---------------------------------------------------------------------------
# Aguarda health check da API
# ---------------------------------------------------------------------------
info "Aguardando API ficar saudável (máx 120s)..."
API_CONTAINER="ork_${TENANT_SLUG}_api"
TIMEOUT=120
ELAPSED=0
until docker inspect --format='{{.State.Health.Status}}' "$API_CONTAINER" 2>/dev/null | grep -q 'healthy'; do
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    warn "API não ficou healthy em ${TIMEOUT}s. Verifique os logs:"
    warn "  docker logs $API_CONTAINER"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -n "."
done
echo ""

if docker inspect --format='{{.State.Health.Status}}' "$API_CONTAINER" 2>/dev/null | grep -q 'healthy'; then
  success "API healthy após ${ELAPSED}s."
else
  warn "API pode ainda estar iniciando. Containers estão rodando; verifique em alguns minutos."
fi

# ---------------------------------------------------------------------------
# Configura nginx
# ---------------------------------------------------------------------------
info "Configurando nginx para $DOMAIN ..."
sed \
  -e "s|{{TENANT_SLUG}}|$TENANT_SLUG|g" \
  -e "s|{{TENANT_NOME}}|$TENANT_NOME|g" \
  -e "s|{{PROVISIONED_AT}}|$PROVISIONED_AT|g" \
  "$NGINX_TEMPLATE" > "${NGINX_CONF_DIR}/${TENANT_SLUG}.conf"

# Recarrega nginx (tenta o container primeiro, depois systemd)
if docker ps --format '{{.Names}}' | grep -q '^ork_nginx$'; then
  docker exec ork_nginx nginx -s reload && success "Nginx recarregado (container)."
elif systemctl is-active --quiet nginx 2>/dev/null; then
  nginx -t && systemctl reload nginx && success "Nginx recarregado (systemd)."
else
  warn "Nginx não encontrado em execução. Config salva em $NGINX_CONF_DIR/${TENANT_SLUG}.conf — recarregue manualmente."
fi

# ---------------------------------------------------------------------------
# Atualiza registro de tenants
# ---------------------------------------------------------------------------
info "Atualizando registro de tenants..."
TENANT_RECORD=$(jq -n \
  --arg slug "$TENANT_SLUG" \
  --arg nome "$TENANT_NOME" \
  --arg domain "$DOMAIN" \
  --arg email "$MASTER_EMAIL" \
  --arg adminNome "$MASTER_NOME" \
  --arg dir "$TENANT_DIR" \
  --arg at "$PROVISIONED_AT" \
  '{slug:$slug, nome:$nome, domain:$domain, adminEmail:$email, adminNome:$adminNome, dir:$dir, provisionedAt:$at, status:"active"}')

TMP="$(mktemp)"
jq --argjson t "$TENANT_RECORD" '.tenants += [$t]' "$TENANTS_FILE" > "$TMP" && mv "$TMP" "$TENANTS_FILE"
success "Registro atualizado."

# ---------------------------------------------------------------------------
# Resumo final
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Tenant '$TENANT_SLUG' provisionado com sucesso!${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Empresa:${RESET}         $TENANT_NOME"
echo -e "  ${BOLD}URL:${RESET}             https://$DOMAIN"
echo -e "  ${BOLD}Admin Email:${RESET}     $MASTER_EMAIL"
echo -e "  ${BOLD}Admin Nome:${RESET}      $MASTER_NOME"
echo -e "  ${BOLD}Admin Senha:${RESET}     ${YELLOW}${ADMIN_PASS}${RESET}"
echo ""
echo -e "  ${BOLD}Containers:${RESET}"
echo -e "    ork_${TENANT_SLUG}_postgres"
echo -e "    ork_${TENANT_SLUG}_redis"
echo -e "    ork_${TENANT_SLUG}_api"
echo -e "    ork_${TENANT_SLUG}_frontend"
echo ""
echo -e "  ${BOLD}Diretório:${RESET}       $TENANT_DIR"
echo -e "  ${BOLD}Nginx conf:${RESET}      ${NGINX_CONF_DIR}/${TENANT_SLUG}.conf"
echo ""
echo -e "  ${RED}${BOLD}⚠ GUARDE A SENHA DO ADMIN — ela não pode ser recuperada!${RESET}"
echo ""
