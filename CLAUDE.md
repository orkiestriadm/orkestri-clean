## Referência após publicação autorizada em 29/10/2026

A base atual é `origin/codex/aurelia-date-followup`. API publicada em e4b11d3: data e horário em mensagens separadas e meses por extenso. Site mantém pontos orbitais publicados em fa60e89 e frontend mantém o login corrigido em b790e15. Testes locais e do runtime aprovados; testes reais de WhatsApp pendentes por restrição do número oficial informada pelo usuário. Partir dessa referência enquanto o PR #23 estiver aberto. Main continua protegida. Ver `docs/DEPLOY_AURELIA_DATAS_2026-10-29.md`. Esta autorização não autoriza futuras publicações.

# Instruções para o Claude

Leia e siga `AGENTS.md`, `docs/SINCRONIZACAO_GITHUB.md` e `docs/PARIDADE_PRODUCAO_2026-10-28.md` antes de alterar código.

A base compartilhada atual é `origin/codex/aurelia-date-followup` até a integração revisada do PR #23. Ela espelha os fontes de produção auditados em 28/10/2026: API/frontend 4.3.0 e site 3.3.2. Não partir das antigas branches Hub ou de uma worktree antiga só porque ela já está aberta.

Começar com status, fetch e atualização da base limpa. Criar branch de tarefa; terminar com testes locais, revisão, commit, push da branch e documentação do SHA. Nunca sobrescrever trabalho de outra sessão.

Deploy é uma operação separada e exige autorização expressa. Não publicar, aplicar migrations, rodar seeds ou reiniciar serviços como consequência de sincronizar Git. Nesta sincronização, main permanece intacta e não há auto-merge.
