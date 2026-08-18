#!/bin/bash
# verificar-nginx.sh — o nginx do servidor ainda é o que está no repositório?
#
# Companheiro do verificar-paridade.sh, para a parte que o deploy NÃO publica.
# `backend` e `frontend` chegam por ref do git; compose, .env e nginx moram
# fora disso de propósito, porque diferem por ambiente. O preço dessa escolha é
# que nada avisa quando alguém mexe à mão no servidor — e foi assim que o
# módulo de Monitoramento ficou sem tempo real nos dois ambientes, por falta de
# um `location /socket.io`, sem erro em log nenhum.
#
# Aqui a fonte é o SERVIDOR e o repositório é a cópia. Divergiu, este script
# mostra o diff e sai 1; quem decide qual lado está certo é quem lê.
#
# Uso:
#   bash scripts/verificar-nginx.sh homologacao
#   bash scripts/verificar-nginx.sh producao

set -uo pipefail

AMBIENTE="${1:-}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

case "$AMBIENTE" in
  homologacao)
    ALVO="planner@10.192.4.123"
    REMOTO="/home/planner/orkestri/nginx/nginx.conf"
    LOCAL="$RAIZ/infra/nginx/homologacao.conf"
    SUDO="" ;;
  producao)
    ALVO="orkestri-prod"
    REMOTO="/opt/orkestri/nginx/nginx-ssl.conf"
    LOCAL="$RAIZ/infra/nginx/producao-ssl.conf"
    SUDO="sudo" ;;
  *)
    echo "Uso: bash scripts/verificar-nginx.sh homologacao|producao" >&2
    exit 2 ;;
esac

[ -f "$LOCAL" ] || { echo "ABORTADO: não achei $LOCAL" >&2; exit 2; }

echo "==> $AMBIENTE ($ALVO:$REMOTO)"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if ! ssh -o BatchMode=yes "$ALVO" "$SUDO cat $REMOTO" > "$TMP" 2>/dev/null; then
  echo "ABORTADO: não consegui ler o arquivo no servidor." >&2
  exit 2
fi
[ -s "$TMP" ] || { echo "ABORTADO: o servidor devolveu arquivo vazio." >&2; exit 2; }

# Fim de linha não é divergência: o repositório pode estar em CRLF por causa do
# checkout no Windows, e isso não muda o que o nginx lê.
if diff -q <(tr -d '\r' < "$LOCAL") <(tr -d '\r' < "$TMP") >/dev/null; then
  echo "OK: o nginx de $AMBIENTE é idêntico ao do repositório."
  exit 0
fi

echo
echo "DIVERGE — repositório (-) contra servidor (+):"
diff -u <(tr -d '\r' < "$LOCAL") <(tr -d '\r' < "$TMP") | tail -n +3 | head -60
echo
echo "Se o servidor está certo:  ssh $ALVO $SUDO cat $REMOTO > ${LOCAL#$RAIZ/}"
echo "Se o repositório está certo: aplique seguindo infra/nginx/README.md (backup + nginx -t ANTES de sobrescrever)."
exit 1
