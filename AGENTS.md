# Trabalho compartilhado entre IAs

## Proteção da produção
- Sincronizar com o GitHub não autoriza publicar em produção.
- Não executar deploy, SSH de escrita, rsync/scp, migrations, seeds, testes contra serviços reais, reinício de containers ou alteração de configuração de produção sem autorização expressa para essa operação.
- Não fazer push direto, force-push ou merge na main nesta tarefa de sincronização. Usar branches codex/ e PRs em rascunho, sem auto-merge.
- Antes de publicar uma branch ou abrir PR, verificar workflows e integrações de deploy. Se puderem afetar produção, interromper essa etapa e explicar o bloqueio.

## Começo de cada trabalho
1. Ler docs/SINCRONIZACAO_GITHUB.md e docs/INVENTARIO_SINCRONIZACAO_2026-10-28.md.
2. Conferir git status, branch e git worktree list. Preservar alterações existentes, inclusive de outras IAs.
3. Executar git fetch origin e escolher a base pelo produto. main é a referência compartilhada do código resgatado de produção; a raiz desta pasta local está na linha Hub e não equivale à main.
4. Criar uma branch de trabalho a partir da referência escolhida. Se houver trabalho local pendente, preservá-lo antes de trocar de branch; preferir uma pasta de trabalho separada.
5. Não substituir backend/frontend da main por cópias de apps/, work/ ou branches Hub. Essas árvores são versões divergentes para consulta e revisão.

## Final de cada trabalho
- Revisar git diff e os arquivos novos; nunca usar git add . sem revisão.
- Não publicar .env, chaves, tokens, dumps, dados de clientes, sessões, caches ou artefatos de build. Este repositório é público.
- Executar apenas validações locais isoladas pertinentes. Testes de integração podem escrever em banco ou enviar mensagens; conferir antes de rodar.
- Salvar código e documentação em commits e fazer push da branch autorizada. Informar branch e SHA, verificações realizadas e pendências.
- Registrar decisões e estado do trabalho em documentação versionada. Histórico de chat e configurações privadas não acompanham o clone.
- Branches codex/sync-20261028/* são cópias de preservação, não releases validadas. Integrar diferenças seletivamente, com testes e revisão.
