# Publicação da coleta de datas da Aurélia — 29/10/2026

Publicação expressamente autorizada, concluída em **29/10/2026, 09:10:05 (America/Sao_Paulo)**. Código: **e4b11d3fc5a68e830816dfa4a11e5774bbe20de7**. Branch: codex/aurelia-date-followup, PR #23.

A API agora guarda data e horário enviados separadamente, aceita meses completos por extenso e pergunta apenas a informação faltante. Mantém confirmação antes da gravação e validação de calendário/futuro no fuso de São Paulo.

## Publicação e verificações técnicas

- Sete arquivos de fonte/documentação conferidos contra a base ativa. Oito arquivos compilados (JavaScript e mapas de quatro módulos) sobrepostos à imagem vigente da API; demais módulos, dependências e configurações preservados.
- Compilação TypeScript completa aprovada; 92 testes locais em quatro suítes com banco/WhatsApp simulados.
- Candidato construído no servidor sem rede, a partir da imagem anterior preservada. Verificações de calendário, coleta parcial e sintaxe: 17 aprovadas, sem conexão ao banco ou envio de mensagens no candidato.
- Após ativação: API saudável, oito hashes do runtime conferidos e três rotas públicas aprovadas.
- Frontend, website, nginx, PostgreSQL, Redis, Evolution e media-worker preservados por ID de container. Nginx recebeu reload. Sem migrations, seeds ou substituição de dados de negócio.

Imagem ativa: sha256:7e89efc85f1c42bb596efd9c2002c76562cb5a5092e783b265ed8436c3b66a49. Rollback: orkestri/api:rollback-date-e4b11d3-20261029. Artefatos e relatórios privados: /opt/orkestri/releases/date-e4b11d3-20261029. Rollback preparado e não acionado.

## Verificações reais e bloqueio externo

O usuário autorizou testes reais na conta conectada ao navegador. O perfil foi conferido e a mensagem menu foi enviada somente ao contato oficial. O WhatsApp indicou entrega, mas a aplicação não respondeu. A instância oficial estava fechada; a reconexão normal pediu QR Code. O usuário então informou que o número da assistente está restrito por 24 horas, atribuindo a restrição ao gestor de leads. Essa causa e o prazo são informações do usuário; não foram confirmados por painel da Meta nesta tarefa.

Com a restrição, testes reais de reconhecimento de data pela conversa, criação/correção/cancelamento e entrega de lembretes continuam PENDENTES. Não foram criados compromissos nem enviadas mensagens de teste a outros clientes. Não houve tentativa de contornar a restrição ou novos disparos após essa informação.

Auditoria somente de leitura no gestor de leads: worker verifica a fila a cada cinco segundos; a fila não tinha mensagens PENDENTE ou ENVIANDO no momento da consulta. Histórico agregado: 58 ENVIADO e 120 FALHOU. Nenhuma fila foi reenviada, contato foi alterado ou configuração foi pausada nesta etapa.

Os mesmos 17 testes determinísticos também foram executados no runtime ativo da API, sem escrita no banco ou envio de mensagens. Isso valida o parser publicado e a sintaxe dos módulos, não a entrega de WhatsApp. A validação de ponta a ponta só poderá prosseguir depois de a restrição ser liberada e a instância oficial estar conectada.

Contatos, identificadores, conteúdos de conversa, relatórios privados e QR de autenticação ficam fora do repositório público. A publicação está concluída; a homologação real de WhatsApp permanece incompleta.
