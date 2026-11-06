## Referência atual de produção — Atualizado em 06/11/2026

- **Pasta principal oficial (local):** `C:\orkestri-clean` (alinhada com a produção atual).
- **Branch remota de referência (GitHub):** `origin/claude/orkiestri-audit-benchmark-4a28b4` (API `098f3e2`, ver `docs/DEPLOY_AURELIA_CONVERSACIONAL_2026-11-06.md`).
- **Versões em produção:** API `5.2.3` (Aurélia conversacional) | Frontend `5.2.0` | Website `3.17.0`.

Localhost não atualizado neste deploy: última API local registrada `5.2.0`.

# Instruções para o Claude (e demais IAs)

1. **Leia e siga `AGENTS.md`** antes de iniciar qualquer alteração.
2. **`C:\orkestri-clean` agora é a pasta principal de produção** (não é mais a linha Hub antiga; a linha Hub foi arquivada em `C:\orkestri-backup-hub-20261104`).
3. **Ao iniciar qualquer sessão:** rode `git fetch origin` e `git pull --ff-only` para garantir que está com a última atualização deixada por outra IA (Antigravity, Codex ou Claude).
4. **Ao concluir qualquer atualização ou deploy autorizado:** faça `git commit` e `git push` para a branch compartilhada no GitHub e mantenha `AGENTS.md` e `CLAUDE.md` atualizados com a versão e commit vigentes, para que todas as IAs permaneçam sincronizadas automaticamente.
5. **Deploy em produção exige autorização expressa:** nunca publicar em produção, aplicar migrations remotas ou acionar serviços reais sem pedido explícito do usuário.

