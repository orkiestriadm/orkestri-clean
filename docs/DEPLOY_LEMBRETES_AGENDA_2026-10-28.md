# Publicação dos lembretes da agenda — 28/10/2026

Deploy expressamente autorizado pelo usuário e concluído em **28/10/2026, 16:00:50 (America/Sao_Paulo)**. Código publicado: `011930db3769a5dca8a7c00e8dd0bd0cb95c7e36`.

A alteração aplica os avisos padrão de 60, 15, 5 e 0 minutos às organizações que não possuem regras próprias. Regras personalizadas e avisos explicitamente desativados continuam respeitados. Organizações já cadastradas sem regras também recebem os padrões; não há migração ou preenchimento manual de configurações. A janela de busca inclui o aviso padrão de uma hora mesmo quando outras organizações só configuraram antecipações menores.

## Validação da publicação

- 39 testes locais aprovados: 11 cenários do agendador e 28 de avisos, confirmação/adiamento e deduplicação.
- Build completo local aprovado; sete verificações do módulo compilado também passaram em imagem candidata com rede desativada.
- A imagem deriva da API já ativa e substitui somente o módulo compilado do agendador e seu source map, preservando a correção anterior do cadastro.
- API saudável, dois hashes de runtime aprovados e três rotas públicas respondendo com sucesso após a troca.
- Frontend, site, nginx, PostgreSQL, Redis, Evolution e media-worker mantiveram seus containers. Nginx recebeu apenas reload para atualizar a resolução da API.
- Nenhuma migration foi executada. A aplicação inicia diretamente com node dist/main.
- Nenhum compromisso foi alterado e nenhum aviso vencido foi reenviado manualmente.

Imagem anterior preservada em `orkestri/api:rollback-reminders-011930d-20261028`. Fontes anteriores e manifesto estão em `/opt/orkestri/releases/reminders-011930d-20261028`. O procedimento de retorno automático estava preparado e não precisou ser acionado.

A referência compartilhada passa a ser `origin/codex/fix-agenda-reminders-by-organization` enquanto o PR #17 estiver aberto. Main permanece intacta e sem auto-merge. A autorização desta publicação não autoriza futuros deploys.

## Verificação de entrega automática

Após o deploy, foi observado um lembrete automático real na conversa do WhatsApp. Uma consulta somente de leitura confirmou o recibo de 15 minutos como ENVIADO, uma notificação no sistema e a preservação do horário do compromisso. Não foi necessário reenviar ou disparar o aviso manualmente. A evidência visual fica na pasta privada de artefatos desta conversa; dados do usuário e o conteúdo de seu compromisso não foram publicados no Git.

A tolerância já existente do agendador é de 2,5 minutos em torno de cada antecedência; esta publicação não alterou essa janela nem a regra que só envia o aviso de agora depois do início do evento.
