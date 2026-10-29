## Referência após publicação autorizada em 29/10/2026

A base atual é `origin/codex/site-whatsapp-orbit-dots`. Site publicado em fa60e89 com pontos orbitando a captura do WhatsApp, sem monograma, e fundo laranja contínuo. Frontend mantém o login corrigido em b790e15; cadastro e lembretes já estão publicados na API. Partir dessa referência enquanto o PR #22 estiver aberto. Main continua protegida. Ver `docs/DEPLOY_PONTOS_ORBITAIS_2026-10-29.md`. Esta autorização não autoriza futuras publicações.

# Instruções para o Claude

Leia e siga `AGENTS.md`, `docs/SINCRONIZACAO_GITHUB.md` e `docs/PARIDADE_PRODUCAO_2026-10-28.md` antes de alterar código.

A base compartilhada atual é `origin/codex/site-whatsapp-orbit-dots` até a integração revisada do PR #22. Ela espelha os fontes de produção auditados em 28/10/2026: API/frontend 4.3.0 e site 3.3.2. Não partir das antigas branches Hub ou de uma worktree antiga só porque ela já está aberta.

Começar com status, fetch e atualização da base limpa. Criar branch de tarefa; terminar com testes locais, revisão, commit, push da branch e documentação do SHA. Nunca sobrescrever trabalho de outra sessão.

Deploy é uma operação separada e exige autorização expressa. Não publicar, aplicar migrations, rodar seeds ou reiniciar serviços como consequência de sincronizar Git. Nesta sincronização, main permanece intacta e não há auto-merge.
