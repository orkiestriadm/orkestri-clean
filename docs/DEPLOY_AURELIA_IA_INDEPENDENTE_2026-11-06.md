# Deploy Aurélia independente — 06/11/2026

- Commit: `87fed65`
- Branch: `origin/claude/orkiestri-audit-benchmark-4a28b4`
- Serviço: API em produção
- Resultado: imagem construída, container `orkiestri_api` recriado e nginx recarregado.
- Healthcheck: `https://orkiestri.com/api/health` respondeu `status=ok`, API `5.2.3`.
- Incluído: modo sombra, anonimização, coleta pendente, memória consentida com expiração, ferramentas determinísticas e rollout percentual.
- Observação: o script de deploy compara a versão esperada do manifesto (`5.2.0`) com a versão efetiva da API (`5.2.3`) e exibe divergência histórica; o healthcheck confirma a versão efetiva em produção.
