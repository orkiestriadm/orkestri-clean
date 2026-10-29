# Publicação do fundo contínuo — 29/10/2026

Publicação expressamente autorizada pelo usuário e concluída em **29/10/2026, 01:26:19 (America/Sao_Paulo)**. Código publicado: **fe3e61ebdcf8547ec67bb29b0c9f237d86febe34**. Branch: **codex/site-continuous-atmosphere**. PR #20: https://github.com/orkiestriadm/orkestri-clean/pull/20 (rascunho, sem auto-merge).

## Resultado

Degradê e textura agora cobrem a página inteira em camadas únicas, sem reiniciar nas seções. As divisórias foram removidas e a agenda acompanha o tema escuro. Menus usam a mesma iluminação com fundo opaco. O medalhão e as órbitas deram lugar a um monograma suave girando atrás do WhatsApp fixo, clicável e com captura real preservada. Movimento reduzido desativa a animação.

Somente o website foi substituído. Frontend com login corrigido, API, PostgreSQL, Redis, Evolution, media-worker e nginx mantiveram seus containers. Nginx recebeu apenas reload. Sem migrations, seeds, alteração de contas ou envio de mensagens.

## Evidências

- Auditoria antes da troca: 262 fontes do frontend/site coincidentes com a base publicada, sem mudanças concorrentes.
- TypeScript aprovado; build Linux completo com 32 páginas e standalone válido.
- Candidato sem rede, read-only e com limite de memória: 22 verificações de páginas, CSS, camadas, oito imagens e otimizador aprovadas.
- Imagem Linux amd64 e arquivo transferido conferidos por SHA-256.
- Após ativação: nove verificações de rotas públicas, oito hashes de imagens e otimizador aprovados. API saudável. Todos os sete containers preservados conferidos por ID.
- Navegador oficial: fundo e textura fixos, todas as seções da home transparentes sem ruído próprio; orbit-turn em 70 segundos no monograma e animation:none no WhatsApp. Junção da home e página /demo verificadas visualmente. Menu móvel opaco com degradê e sem overflow em 390 px; desktop sem overflow em 1440 px.
- Antes de publicar, 25 páginas auditadas em desktop e sete páginas principais em celular; menus desktop/mobile e junções inspecionados.

Imagem ativa: sha256:19a8d4c5574e5376241ce368ce52f73fd7534c01437e8910689454f9863928f0. Rollback preservado: orkestri/website:rollback-continuous-fe3e61e-20261028. Artefatos, backup de fontes e relatórios privados: /opt/orkestri/releases/continuous-fe3e61e-20261028. Retorno automático preparado e não acionado.

A execução foi retomada após o limite de uso permitir a revisão automática das operações. Nenhuma publicação ocorreu durante o bloqueio. O acompanhamento de retomada foi encerrado após conclusão.

A referência compartilhada passa a origin/codex/site-continuous-atmosphere enquanto o PR #20 estiver aberto. Main permanece intacta. Esta autorização cobre esta publicação, não futuras operações.
