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
#   ESPERA_MAX=5400 bash scripts/deploy.sh producao            # teto de espera maior
#
# Produção pede confirmação digitada. Para automação: CONFIRMA=sim.
#
# O build roda solto da sessão ssh (ver a seção "Publicação"): cair a conexão
# não interrompe mais nada, e dá para desligar a máquina no meio. Para
# acompanhar de outro terminal, ou depois de um teto de espera estourado:
#
#   ssh <alvo> tail -f /tmp/orkestri-deploy-<ambiente>.log

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
COMMIT_CHEIO="$(git rev-parse "$REF")"
echo "    ref $REF ($COMMIT), versão $VERSAO_REF"

# ── Remoções ────────────────────────────────────────────────────────────────
#
# `git checkout <ref> -- caminho` NÃO apaga arquivo que foi removido no git: ele
# escreve o que existe no ref e ignora o resto. Até 19/10/2026 isso era ressalva
# conhecida e o verificador de paridade apenas ACUSAVA, na linha "NO SERVIDOR,
# FALTA NO GIT". Enquanto todo release só adicionava e alterava, passou. No dia
# em que um release removeu 20 módulos, a conta chegou: os arquivos ficariam no
# servidor, e o Next, que monta rota por arquivo em disco, continuaria servindo
# as telas removidas — chamando uma API que não existe mais.
#
# A correção NÃO é `git clean` no servidor. Aquele comando apaga tudo que não
# está no git, e no servidor isso inclui o que legitimamente mora só lá: .env,
# certificado, upload de cliente, build. Teria sido trocar um problema visível
# por um irreversível.
#
# O que se apaga aqui é só o que o GIT afirma que saiu entre o ref que está
# publicado e o que vai entrar — lista fechada, calculada deste lado, onde o
# repositório está inteiro. Arquivo não rastreado nunca entra nela.
#
# Para saber de onde o servidor veio, o deploy grava o ref publicado em
# .deploy-ref ao terminar. Na primeira vez esse arquivo não existe, e aí o ref
# anterior tem de ser dito à mão (REF_ANTERIOR=<ref>) em vez de adivinhado:
# errar o ponto de partida apagaria arquivo que devia ficar.
echo "==> apurando o que saiu do git"
ANTES="$(ssh -o BatchMode=yes -o ConnectTimeout=20 "$SSH_ALVO" \
  "$SUDO cat $DIR/.deploy-ref 2>/dev/null" 2>/dev/null | tr -d '[:space:]')"
[ -z "$ANTES" ] && ANTES="${REF_ANTERIOR:-}"
[ -z "$ANTES" ] && falhar "não sei de qual ref $AMBIENTE veio: $DIR/.deploy-ref não existe ainda.
  Descubra a versão no ar com 'curl -s $URL_SAUDE' e rode uma vez com o ref correspondente:
  REF_ANTERIOR=<ref> bash scripts/deploy.sh $AMBIENTE $REF"
git rev-parse --verify "$ANTES" >/dev/null 2>&1 || falhar "o ref anterior '$ANTES' não existe aqui. Rodou 'git fetch'?"

REMOVER="$(git diff --name-only --diff-filter=D "$ANTES" "$REF" -- $ESCOPO)"
QTD_REMOVER="$(printf '%s' "$REMOVER" | grep -c . || true)"
echo "    veio de $(git rev-parse --short "$ANTES") — $QTD_REMOVER arquivo(s) a remover"
if [ "$QTD_REMOVER" -gt 0 ]; then
  printf '%s\n' "$REMOVER" | sed 's/^/      - /' | head -15
  [ "$QTD_REMOVER" -gt 15 ] && echo "      … e $((QTD_REMOVER - 15)) outro(s)"
  # Caminho com espaço quebraria o laço remoto, que lê linha a linha. Nenhum
  # arquivo do projeto tem, e é melhor travar do que apagar o alvo errado.
  printf '%s\n' "$REMOVER" | grep -q ' ' && falhar "há caminho com espaço na lista de remoção; trate antes de publicar."
fi

if [ "$AMBIENTE" = "producao" ] && [ "${CONFIRMA:-}" != "sim" ]; then
  echo
  echo "PRODUÇÃO — $SSH_ALVO:$DIR"
  read -r -p "Confirma? (digite: sim) " RESPOSTA
  [ "$RESPOSTA" = "sim" ] || falhar "cancelado."
fi

# ── Publicação ──────────────────────────────────────────────────────────────
#
# O build roda SOLTO da sessão ssh, e não dentro dela.
#
# Em 15/08/2026 o deploy de produção morreu com `Connection reset by peer` no
# meio do build do frontend. A instância tem 1,9 GB e o build passa de vinte
# minutos lá (só o `nest build` levou 674s); a sessão ssh não sobreviveu, e
# levou o build junto. Nada de OOM no kernel, disco em 29% — foi só a conexão.
#
# Produção não caiu, porque build que falha não troca container. Mas o
# `git checkout` já tinha rodado, e o servidor ficou num estado misto: a árvore
# à frente do que estava rodando, a paridade dizendo "idêntico ao ref" e o
# /api/health ainda respondendo a versão anterior.
#
# Com `setsid nohup` o build sobrevive à queda da conexão, e o polling reconecta
# quantas vezes precisar. O preço é ter que descobrir o desfecho por um sentinela
# no log, em vez de pelo código de saída do ssh.
LOG_REMOTO="/tmp/orkestri-deploy-$AMBIENTE.log"
SENTINELA="__DEPLOY_FIM__"
ESPERA_MAX=${ESPERA_MAX:-3600}   # 1h: o build de produção passa de 20 min

echo "==> publicando em $AMBIENTE ($SSH_ALVO:$DIR)"

# A lista de remoção vai por stdin de um ssh próprio, e não embutida no script
# remoto: assim nenhum nome de arquivo passa por expansão de shell.
if [ "$QTD_REMOVER" -gt 0 ]; then
  printf '%s\n' "$REMOVER" | ssh -o BatchMode=yes "$SSH_ALVO" "cat > /tmp/orkestri-remover-$AMBIENTE.txt" \
    || falhar "não consegui enviar a lista de remoção."
else
  ssh -o BatchMode=yes "$SSH_ALVO" ": > /tmp/orkestri-remover-$AMBIENTE.txt" >/dev/null 2>&1 || true
fi

ssh -o BatchMode=yes "$SSH_ALVO" "
set -e
cd $DIR
$SUDO git fetch origin --quiet
$SUDO git checkout $REF -- $ESCOPO
echo '    arquivos atualizados a partir de $REF'

# Remove o que saiu do git. A lista veio calculada do outro lado; aqui só se
# apaga o que está nela, e dentro do escopo — nada de clean nem de glob.
REMOVIDOS=0
while read -r f; do
  [ -z \"\$f\" ] && continue
  case \"\$f\" in backend/*|frontend/*) ;; *) echo \"    IGNORADO (fora do escopo): \$f\"; continue ;; esac
  if [ -e \"\$f\" ]; then $SUDO rm -f \"\$f\"; REMOVIDOS=\$((REMOVIDOS+1)); fi
done < /tmp/orkestri-remover-$AMBIENTE.txt
if [ \"\$REMOVIDOS\" -gt 0 ]; then
  echo \"    \$REMOVIDOS arquivo(s) removido(s)\"
  # Diretório que ficou vazio depois da remoção também sai: no Next, uma pasta
  # de rota vazia não serve nada, mas suja o diagnóstico de paridade.
  for d in $ESCOPO; do $SUDO find \$d -type d -empty -delete 2>/dev/null || true; done
fi

# Grava DE QUAL REF a árvore veio, para o próximo deploy saber o que remover.
# Vai aqui, logo depois do checkout, e não no fim: isto descreve os ARQUIVOS em
# disco, que já estão no ref novo mesmo se o build falhar adiante.
echo $COMMIT_CHEIO | $SUDO tee $DIR/.deploy-ref > /dev/null

# Os arquivos de compose saem do container que está rodando, e não de um valor
# fixo aqui: produção e homologação já divergiram nisso, e subir com o conjunto
# errado derruba o TLS em silêncio.
CONFIG=\$($SUDO docker inspect orkestri_api --format '{{index .Config.Labels \"com.docker.compose.project.config_files\"}}' 2>/dev/null || true)
ARGS=''
IFS=',' ; for c in \$CONFIG ; do ARGS=\"\$ARGS -f \$c\" ; done ; unset IFS
[ -z \"\$ARGS\" ] && ARGS='-f docker-compose.yml -f docker-compose.override.yml'
echo \"    compose:\$ARGS\"

# O sentinela carrega o código de saída do compose: é por ele que o lado de cá
# distingue 'terminou bem' de 'quebrou' de 'ainda rodando'.
$SUDO bash -c \"setsid nohup bash -c '
  docker compose \$ARGS up -d --build $SERVICOS
  echo \\\"$SENTINELA rc=\\\$?\\\"
' > $LOG_REMOTO 2>&1 < /dev/null &\"
sleep 2
echo '    build solto do terminal; log em $LOG_REMOTO'
" || falhar "não consegui iniciar a publicação no servidor."

# ── Espera ──────────────────────────────────────────────────────────────────
# Falha de ssh aqui NÃO é falha de deploy: o build está solto e segue de pé. Só
# desiste no teto de tempo.
echo "==> acompanhando o build (até $((ESPERA_MAX / 60)) min; queda de conexão não interrompe)"
INICIO=$(date +%s)
RC_BUILD=""
ULTIMA=""
while : ; do
  SAIDA="$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$SSH_ALVO" \
    "grep -m1 '$SENTINELA' $LOG_REMOTO 2>/dev/null; tail -n 1 $LOG_REMOTO 2>/dev/null" 2>/dev/null || true)"

  case "$SAIDA" in
    *"$SENTINELA"*)
      RC_BUILD="$(printf '%s\n' "$SAIDA" | sed -n "s/.*$SENTINELA rc=\([0-9]*\).*/\1/p" | head -1)"
      break ;;
  esac

  # Só imprime quando muda, para o acompanhamento não virar mil linhas iguais.
  LINHA="$(printf '%s\n' "$SAIDA" | tail -n 1)"
  [ -n "$LINHA" ] && [ "$LINHA" != "$ULTIMA" ] && { echo "    $LINHA"; ULTIMA="$LINHA"; }

  DECORRIDO=$(( $(date +%s) - INICIO ))
  [ "$DECORRIDO" -ge "$ESPERA_MAX" ] && falhar "o build passou de $((ESPERA_MAX / 60)) min sem terminar. Ele CONTINUA rodando no servidor: acompanhe com 'ssh $SSH_ALVO tail -f $LOG_REMOTO'."
  sleep 15
done

if [ "${RC_BUILD:-1}" != "0" ]; then
  echo
  ssh -o BatchMode=yes "$SSH_ALVO" "tail -n 25 $LOG_REMOTO" 2>/dev/null || true
  falhar "o build falhou no servidor (rc=${RC_BUILD:-?}). Os containers antigos continuam no ar; a ÁRVORE já está em $REF, então quem responde 'o que está publicado' agora é a versão da API, não a paridade."
fi
echo "    build concluído"

# nginx guarda o IP do container; sem o reload ele fala com quem não existe
# mais. Erro aqui não derruba o deploy — o container pode nem existir.
ssh -o BatchMode=yes "$SSH_ALVO" \
  "$SUDO docker exec orkestri_nginx nginx -s reload 2>/dev/null && echo '    nginx recarregado' || true" 2>/dev/null || true

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

# A remoção de arquivo que saiu do git é feita na seção "Remoções", a partir do
# ref gravado em .deploy-ref — e não por `git clean`, que no servidor levaria
# junto .env, certificado e upload. Se .deploy-ref não existir (servidor que
# nunca passou por esta versão do script), o deploy TRAVA pedindo REF_ANTERIOR,
# em vez de adivinhar o ponto de partida e apagar o que devia ficar.
exit "$PROBLEMA"
