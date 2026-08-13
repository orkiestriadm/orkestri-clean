#!/bin/bash
# verificar-paridade.sh — o que está rodando no servidor é o que está no git?
#
# Responde em segundos uma pergunta que, sem ele, se descobre por acidente
# semanas depois. Foi escrito no dia em que se descobriu que:
#
#   - homologação rodava o `modules.tsx` anterior à 1.10.0 enquanto a tela Sobre
#     anunciava 1.10.1 — o número da versão descrevia UM arquivo, não a árvore;
#   - a logo de um cliente, escrita direto no Sidebar de homologação, tinha
#     entrado no git numa sincronização e ido parar em PRODUÇÃO.
#
# A deriva é silenciosa nos dois sentidos: código que está no servidor e não no
# git some no próximo `checkout`; código que está no git e não no servidor faz o
# defeito "já corrigido" continuar de pé.
#
# Uso:
#   bash scripts/verificar-paridade.sh homologacao
#   bash scripts/verificar-paridade.sh producao
#   bash scripts/verificar-paridade.sh producao origin/main~1
#
# Saída: lista de arquivos divergentes. Código de saída 0 = paridade, 1 = deriva
# (serve para travar um deploy num pipeline).

set -uo pipefail

ALVO="${1:-}"
REF="${2:-origin/main}"

case "$ALVO" in
  homologacao) SSH_ALVO="planner@10.192.4.123"; DIR="/home/planner/orkestri"; SUDO="" ;;
  producao)    SSH_ALVO="orkestri-prod";        DIR="/opt/orkestri";         SUDO="sudo" ;;
  *)
    echo "Uso: bash scripts/verificar-paridade.sh homologacao|producao [ref-git]" >&2
    exit 2 ;;
esac

# Só código-fonte. `public/` e os compose ficam de fora de propósito: imagem de
# marca e configuração de infraestrutura SÃO diferentes por ambiente, e acusá-las
# como deriva ensinaria a ignorar a saída deste script.
ESCOPO=(backend/src frontend/src)
PADRAO='\( -name "*.ts" -o -name "*.tsx" \)'

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# CRLF é normalizado: a árvore dos servidores tem final de linha misturado por
# herança, e sem isso todo arquivo apareceria como divergente.
hashear() { while read -r f; do printf "%s %s\n" "$(tr -d '\r' < "$f" | md5sum | cut -d' ' -f1)" "$f"; done; }

echo "==> git ($REF)"
git archive "$REF" "${ESCOPO[@]}" | tar -x -C "$TMP" || {
  echo "ERRO: não consegui ler $REF. Rodou 'git fetch'?" >&2; exit 2; }
( cd "$TMP" && eval "find ${ESCOPO[*]} -type f $PADRAO" | hashear ) | LC_ALL=C sort -k2 > "$TMP/git.txt"

echo "==> $ALVO ($SSH_ALVO:$DIR)"
ssh -o BatchMode=yes "$SSH_ALVO" \
  "cd $DIR && $SUDO find ${ESCOPO[*]} -type f $PADRAO | while read -r f; do printf '%s %s\n' \"\$($SUDO tr -d '\r' < \"\$f\" | md5sum | cut -d' ' -f1)\" \"\$f\"; done" \
  2>/dev/null | LC_ALL=C sort -k2 > "$TMP/servidor.txt"

if [ ! -s "$TMP/servidor.txt" ]; then
  echo "ERRO: não obtive a lista do servidor (SSH ou permissão)." >&2; exit 2
fi

echo
printf 'arquivos: git=%s  %s=%s\n\n' "$(wc -l < "$TMP/git.txt")" "$ALVO" "$(wc -l < "$TMP/servidor.txt")"

SO_NO_GIT=$(comm -23 <(cut -d' ' -f2- "$TMP/git.txt") <(cut -d' ' -f2- "$TMP/servidor.txt"))
SO_NO_SRV=$(comm -13 <(cut -d' ' -f2- "$TMP/git.txt") <(cut -d' ' -f2- "$TMP/servidor.txt"))
DIFERENTES=$(join -j 2 -o 0,1.1,2.1 "$TMP/git.txt" "$TMP/servidor.txt" | awk '$2!=$3 {print $1}')

DERIVA=0
[ -n "$SO_NO_GIT" ]   && { echo "NO GIT, FALTA NO SERVIDOR (deploy atrasado):"; echo "$SO_NO_GIT" | sed 's/^/  /'; echo; DERIVA=1; }
[ -n "$SO_NO_SRV" ]   && { echo "NO SERVIDOR, FALTA NO GIT (some no próximo checkout):"; echo "$SO_NO_SRV" | sed 's/^/  /'; echo; DERIVA=1; }
[ -n "$DIFERENTES" ]  && { echo "CONTEÚDO DIFERENTE:"; echo "$DIFERENTES" | sed 's/^/  /'; echo; DERIVA=1; }

if [ "$DERIVA" -eq 0 ]; then
  echo "PARIDADE: $ALVO está idêntico a $REF."
else
  echo "DERIVA encontrada. Para cada arquivo acima, decida a direção:"
  echo "  servidor certo -> traga para o git e commite"
  echo "  git certo      -> redeploy do arquivo"
fi
exit "$DERIVA"
