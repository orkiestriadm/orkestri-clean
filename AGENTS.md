## Referência atual de produção — Atualizado em 04/11/2026

- **Pasta principal oficial (local):** `C:\orkestri-clean` (branch local `producao-5.1.3` rastreando `origin/claude/orkiestri-audit-benchmark-4a28b4`).
- **Branch remota de referência (GitHub):** `origin/claude/orkiestri-audit-benchmark-4a28b4` (site `4fb3748`, ver `docs/DEPLOY_SITE_3150_2026-11-04.md`).
- **Versões em produção e no `http://localhost`:**
  - **API:** `5.1.3`
  - **Frontend (Painel):** `5.1.3`
  - **Website:** `3.15.0`
- **Histórico antigo:** A antiga linha Hub foi preservada em backup externo (`C:\orkestri-backup-hub-20261104`) e na branch local `codex/preserva-hub-20261104`. O foco total do projeto é exclusivamente o sistema atual em produção.

---

# Sincronização Automática entre IAs (Antigravity, Claude e Codex)

## 1. Base única compartilhada
- Todas as IAs (**Antigravity**, **Claude** e **Codex**) devem usar **`C:\orkestri-clean`** e a referência remota acima como fonte única da verdade.
- Não usar versões antigas nem recriar arquivos da antiga linha Hub.

## 2. Ritual obrigatório ao INICIAR qualquer tarefa
1. Ler este arquivo (`AGENTS.md`) e `CLAUDE.md`.
2. Executar `git fetch origin` e verificar `git status -sb`.
3. Se a árvore estiver limpa e houver commits novos na branch remota de produção, atualizar automaticamente com `git pull --ff-only` antes de editar qualquer arquivo.
4. Caso duas IAs precisem editar simultaneamente em paralelo, usar worktree temporária criada a partir do commit mais recente da referência remota acima e integrar de volta assim que concluir.

## 3. Ritual obrigatório ao CONCLUIR alterações ou deploy autorizado
1. Validar localmente as alterações (testes/build pertinentes).
2. Quando um deploy em produção ou atualização oficial for autorizado e concluído:
   - Atualizar este cabeçalho em `AGENTS.md` e `CLAUDE.md` com a nova versão, commit/branch e arquivo `docs/DEPLOY_*.md`.
   - Fazer `git commit` e `git push` para o GitHub imediatamente, garantindo que todas as outras IAs recebam a atualização automaticamente no próximo `git fetch` / `git pull`.
   - Atualizar também o `http://localhost` (`docker compose up -d --build` em `C:\orkestri-clean`) quando solicitado pelo usuário para manter paridade total entre Produção, GitHub e Localhost.

## 4. Segurança de Produção e Privacidade
- Sincronização Git não autoriza deploy. Nunca executar deploy, SSH de escrita, rsync/scp para servidor, migrations em produção, seeds ou testes com WhatsApp real sem autorização expressa do usuário.
- No ambiente local (`http://localhost`), o container `evolution_v2` permanece desligado (`replicas: 0` no `docker-compose.override.yml`) para nunca disparar mensagens reais de WhatsApp.
- O repositório exige proteção de segredos: nunca publicar `.env`, `.env.production`, chaves, tokens, dumps de banco ou caches.
