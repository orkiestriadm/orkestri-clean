# Confirmar e adiar compromissos pelo WhatsApp

O aviso de início passa a oferecer **1 — confirmar participação** e **2 — adiar**. Confirmar encerra os avisos daquele evento naquele horário; não desliga as notificações da conta. Adiar solicita data e hora no futuro em Brasília e preserva a duração. `cancelar` mantém o horário atual.

Estado persistido por evento/horário, com deduplicação de envio por antecedência configurada. A confirmação sobrevive a reinícios. Ao alterar o início, uma nova ocorrência de aviso fica habilitada; o registro antigo é encerrado. Eventos removidos, cancelados externamente ou editados em outro horário não aceitam o aviso antigo.

Somente o dono identificado e autorizado pode responder, na instância do envio e na própria organização. Avisos simultâneos exigem código de evento, sem selecionar arbitrariamente um compromisso. Iniciar outro comando suspende o atalho numérico; o código explícito continua disponível. A resposta expira em 24 horas após o início.

Para eventos recorrentes, o adiamento segue o comportamento de edição da agenda: muda o início da série. A Aurélia avisa isso antes de pedir a nova data; o fim da repetição é respeitado. A integração externa usa o mesmo serviço de writeback da agenda.

## Validação

- 60 testes automatizados aprovados: 28 novos de data/menu/scheduler e 32 regressões de cadastro/inbound.
- TypeScript aprovado e esquema Prisma validado.
- Fontes conferidos por hashes contra o servidor; oito arquivos no manifesto `evento-alerta-release-20261027.json`.
- Backup mantido no servidor: `/opt/orkestri/backups/evento-alerta-before-20261027T092930Z.tar.gz`.
- Imagem de retorno: `orkestri/api:rollback-evento-alerta-20261027`.
- Migração aditiva: `20261027090000_whatsapp_evento_confirmacao`, tabela `whatsapp_evento_alertas`. Sem alteração de registros de compromissos existentes pela migração.

O teste com banco real cria apenas fixtures isoladas e reverte a transação inteira, inclusive a tabela da migração durante o ensaio anterior à publicação. WhatsApp e integração externa são simulados. O handler real de entrada é exercitado, incluindo identidade por usuário/organização, seleção de eventos simultâneos, permissão, instância, expiração, edição concorrente, rascunhos de outras operações e duração preservada.

## Publicado

Ativado em **27/10/2026, 06:40 (America/Sao_Paulo)**. Imagem ativa da API: `sha256:668463f89a96940ddab342a93aa361866571c6b4f8445b33d5312d12cc869c88`.

- Imagem final antes da ativação: 31 verificações com banco real, rollback confirmado, incluindo reversão do DDL de ensaio.
- Após ativação e migração efetiva: 30 verificações com banco real aprovadas, fixtures revertidas e nenhum envio real ou chamada externa de calendário.
- Migração aditiva aplicada com sucesso; API saudável e rotas públicas `/api/health`, `/` e `/login` disponíveis.
- Frontend, website e container do nginx preservados. Nginx validado e recarregado para resolver o upstream da API recriada.
- Retorno disponível pela imagem anterior. A tabela aditiva pode ser preservada em eventual retorno, mantendo histórico de confirmações.

Os menus aparecem nos **novos avisos de início**. Mensagens antigas já entregues não são editadas. O código de evento oferece uma saída explícita quando há avisos simultâneos ou outro registro aguardando confirmação na conversa.
