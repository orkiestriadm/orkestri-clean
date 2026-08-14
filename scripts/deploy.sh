#!/bin/bash
# deploy.sh — publica um REF DO GIT num ambiente.
#
# A regra que este script existe para tornar mecanismo, e não disciplina:
# o que chega no servidor é sempre um ref do git. Nunca a minha árvore local.
#
# Antes dele, o deploy de homologação era `tar | ssh` da árvore de trabalho, e
# em um único dia isso produziu:
#
#   - homologação rodando o `modules.tsx` anterior à 1.10.0 enquanto a tela
#     Sobre anunciava 1.10.1 — o número da versão descrevia UM arquivo;
#   - a migration `20260812000000_chamado_aguardando` nunca enviada: as colunas
#     tinham sido criadas na mão e o histórico do Prisma ficou torto. Arquivo eu
#     lembro de mandar; migration ninguém lembra;
#   - 425 arquivos com CRLF, porque o tar saía de um worktree Windows — o que
#     fazia `git status` no servidor acusar a árvore inteira como modificada e
#     deixava de servir para qualquer diagnóstico;
#   - a logo de um cliente indo parar em produção, porque a árvore do servidor
#     virou fonte e foi sincronizada de volta para o git.
#
# Uso:
#   bash scripts/deploy.sh homologacao
#   bash scripts/deploy.sh producao
#   SERVICOS="frontend" bash scripts/deploy.sh homologacao     # só um serviço
#   bash scripts/deploy.sh producao origin/main~1              # voltar uma versão
#
# Produção pede confirmação digitada. Para automação: CONFIRMA=sim.

set -uo pipefail

AMBIENTE="${1:-}"
REF="${2:-origin/main}"
SERVICOS="${SERVICOS:-api frontend}"

# `backend` e `frontend` INTEIRAS, e não só `src`: foi assim que uma migration
# ficou para trás. O que legitimamente difere por ambiente — compose, .env,
# nginx — mora fora dessas duas pastas, de propósito. Isso foi verificado nos
# dois servidores antes de escrever este script: a única divergência dentro
# delas era fim de linha.
ESCOPO="backend frontend"

case "$AMBIENTE" in
  homologacao)
    SSH_ALVO="planner@10.192.4.123"; DIR="/home/planner/orkestri"; SUDO=""
    URL_SAUDE="http://10.192.4.123/api/health" ;;
  producao)
    SSH_ALVO="orkestri-prod"; DIR="/opt/orkestri"; SUDO="sudo"
    URL_SAUDE="https://orkiestri.com/api/health" ;;
  *)
    echo "Uso: bash scripts/deploy.sh homologacao|producao [ref-git]" >&2
    exit 2 ;;
esac

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ" || exit 2

falhar() { echo; echo "ABORTADO: $*" >&2; exit 1; }

# ── Travas ──────────────────────────────────────────────────────────────────
# Todas antes de qualquer efeito. Um deploy que para no meio é pior que um que
# nem começa.

echo "==> conferindo o lado de cá"
git fetch origin --quiet || falhar "não consegui falar com o origin."

git rev-parse --verify "$REF" >/dev/null 2>&1 || falhar "ref '$REF' não existe."

# 1. Nada pendente no que vai ser publicado. Esta é a trava que teria impedido
#    o servidor de ficar à frente do git.
PENDENTE="$(git status --porcelain -- $ESCOPO)"
[ -n "$PENDENTE" ] && {
  echo "$PENDENTE" | head -20
  falhar "há alteração não commitada em $ESCOPO. Commite (e publique) antes."
}

# 2. O que está no HEAD local precisa estar contido no ref publicado. Sem isto,
#    um commit local não publicado subiria para o servidor e sumiria do mundo.
git merge-base --is-ancestor HEAD "$REF" 2>/dev/null || \
  falhar "o HEAD local não está contido em $REF. Faça o push antes de publicar."

VERSAO_REF="$(git show "$REF:frontend/src/lib/version.ts" | sed -n 's/^export const VERSAO = "\(.*\)";/\1/p')"
COMMIT="$(git rev-parse --short "$REF")"
echo "    ref $REF ($COMMIT), versão $VERSAO_REF"

if [ "$AMBIENTE" = "producao" ] && [ "${CONFIRMA:-}" != "sim" ]; then
  echo
  echo "PRODUÇÃO — $SSH_ALVO:$DIR"
  read -r -p "Confirma? (digite: sim) " RESPOSTA
  [ "$RESPOSTA" = "sim" ] || falhar "cancelado."
fi

# ── Publicação ──────────────────────────────────────────────────────────────
echo "==> publicando em $AMBIENTE ($SSH_ALVO:$DIR)"

ssh -o BatchMode=yes "$SSH_ALVO" "
set -e
cd $DIR
$SUDO git fetch origin --quiet
$SUDO git checkout $REF -- $ESCOPO
echo '    arquivos atualizados a partir de $REF'

# Os arquivos de compose saem do container que está rodando, e não de um valor
# fixo aqui: produção e homologação já divergiram nisso, e subir com o conjunto
# errado derruba o TLS em silêncio.
CONFIG=\$($SUDO docker inspect orkestri_api --format '{{index .Config.Labels \"com.docker.compose.project.config_files\"}}' 2>/dev/null || true)
ARGS=''
IFS=',' ; for c in \$CONFIG ; do ARGS=\"\$ARGS -f \$c\" ; done ; unset IFS
[ -z \"\$ARGS\" ] && ARGS='-f docker-compose.yml -f docker-compose.override.yml'
echo \"    compose:\$ARGS\"

$SUDO docker compose \$ARGS up -d --build $SERVICOS

# nginx guarda o IP do container; sem o reload ele fala com quem não existe
# mais. Erro aqui não derruba o deploy — o container pode nem existir.
$SUDO docker exec orkestri_nginx nginx -s reload 2>/dev/null && echo '    nginx recarregado' || true
" || falhar "a publicação falhou no servidor. Nada foi verificado; olhe os logs."

# ── Verificação ─────────────────────────────────────────────────────────────
# Um deploy sem verificação é uma esperança. Estas duas provam coisas
# diferentes: a paridade prova que o CÓDIGO chegou; a versão prova que ele foi
# COMPILADO e está sendo servido.

echo
echo "==> paridade com $REF"
bash "$RAIZ/scripts/verificar-paridade.sh" "$AMBIENTE" "$REF" | tail -8
PARIDADE=${PIPESTATUS[0]}

echo "==> versão que a API responde"
VERSAO_API="$(curl -s --max-time 20 "$URL_SAUDE" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')"
echo "    esperada $VERSAO_REF | respondida ${VERSAO_API:-<sem resposta>}"

PROBLEMA=0
[ "$PARIDADE" -ne 0 ] && { echo "    !! o código do servidor não bate com $REF"; PROBLEMA=1; }
[ -z "$VERSAO_API" ] && { echo "    !! a API não respondeu"; PROBLEMA=1; }
[ -n "$VERSAO_API" ] && [ "$VERSAO_API" != "$VERSAO_REF" ] && {
  echo "    !! versão divergente — build antiga no ar, ou bump esquecido"; PROBLEMA=1; }

echo
if [ "$PROBLEMA" -eq 0 ]; then
  echo "OK: $AMBIENTE em $VERSAO_REF ($COMMIT), idêntico a $REF."
else
  echo "ATENÇÃO: publicou, mas a verificação apontou problema. Não considere feito."
fi

# Ressalva conhecida, e deliberada: `git checkout <ref> -- caminho` NÃO apaga
# arquivo que foi removido no git. Quem pega isso é o verificador de paridade,
# na linha "NO SERVIDOR, FALTA NO GIT". A remoção ficou de fora porque um
# `git clean` no servidor é justamente o tipo de comando que leva junto o que
# não devia.
exit "$PROBLEMA"
