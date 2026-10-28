## Referência após publicação autorizada em 28/10/2026

A base atual é `origin/codex/fix-whatsapp-signup-flow`, com a correção já em produção no commit 9d15275. Partir dessa referência enquanto o PR #16 estiver aberto. A branch coordination é a base anterior a essa correção. Depois das integrações revisadas, adotar a referência resultante registrada no GitHub. Main continua protegida nesta tarefa. Ver `docs/DEPLOY_CADASTRO_WHATSAPP_2026-10-28.md`. A autorização deste deploy não autoriza futuras publicações.

# Instruções para o Claude

Leia e siga `AGENTS.md`, `docs/SINCRONIZACAO_GITHUB.md` e `docs/PARIDADE_PRODUCAO_2026-10-28.md` antes de alterar código.

A base compartilhada atual é `origin/codex/fix-whatsapp-signup-flow` até a integração revisada do PR #16. Ela espelha os fontes de produção auditados em 28/10/2026: API/frontend 4.3.0 e site 3.3.2. Não partir das antigas branches Hub ou de uma worktree antiga só porque ela já está aberta.

Começar com status, fetch e atualização da base limpa. Criar branch de tarefa; terminar com testes locais, revisão, commit, push da branch e documentação do SHA. Nunca sobrescrever trabalho de outra sessão.

Deploy é uma operação separada e exige autorização expressa. Não publicar, aplicar migrations, rodar seeds ou reiniciar serviços como consequência de sincronizar Git. Nesta sincronização, main permanece intacta e não há auto-merge.
