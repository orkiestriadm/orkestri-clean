# WhatsApp — rotina diária opcional e tarefas pessoais

Publicado em produção em 24/10/2026, aproximadamente 19h36, horário de São Paulo. Instância única compartilhada preservada.

## Comandos

| Comando | Resultado |
|---|---|
| `meu dia` ou `resumo de hoje` | Consulta sua agenda e suas tarefas pessoais |
| `tarefas` ou `tarefas de hoje` | Consulta pendências de hoje e atrasadas, sem a agenda |
| `rotina` ou `resumo diário` | Mostra a configuração atual e como escolher um horário |
| `ativar resumo diário 08:00` | Ativa envio todos os dias, às 08h de Brasília |
| `ativar resumo diário 08:00 dias úteis` | Ativa somente de segunda a sexta |
| `pausar resumo diário` | Desativa o envio automático; consultas manuais continuam disponíveis |
| `tarefa: comprar material amanhã` | Cria tarefa pessoal no Keep; sem data, usa hoje |
| `tarefa: preparar documento 25/10/2026` | Cria tarefa com data explícita validada |
| `concluir tarefa T-AB12CD34` | Conclui a sua tarefa identificada pelo código mostrado |
| `reabrir tarefa T-AB12CD34` | Reabre a tarefa, permitindo desfazer a conclusão |

Não há adesão automática. A migration não ativou usuários nem modificou preferências gerais de notificação. O comando sem horário mostra as instruções, sem ativar. Os comandos anteriores do resumo semanal financeiro continuam funcionando separadamente.

## Conteúdo e autorização

O resumo contém somente os dados disponíveis pelas permissões atuais do usuário: `agenda:ver` para compromissos e `keep:ver` para tarefas pessoais. As operações de tarefa exigem `keep:criar` ou `keep:editar`, conforme a ação. O papel master mantém o acesso amplo previsto no sistema.

Eventos são filtrados pelo titular e pela organização atual, além da confirmação. Tarefas usam o `userId` proprietário, pois `DailyTask` não possui campo de organização. Não são incluídos valores financeiros, documentos, dados de outras pessoas ou todas as demandas da equipe. Compromissos de que o usuário é apenas convidado, sem ser titular, não foram incluídos nesta etapa.

O resumo considera eventos do dia, compromissos em andamento que atravessam a meia-noite e ocorrências diárias, semanais, quinzenais e mensais. A regra mensal acompanha o avanço de calendário já usado pela Agenda. A recorrência diária não depende do limite antigo de 200 iterações. Há limites explícitos de consulta e apresentação; o texto avisa quando existem registros adicionais para consultar no sistema.

As tarefas de hoje e atrasadas são apresentadas separadamente. O indicador de conclusão refere-se às tarefas programadas para hoje, não a qualquer tarefa concluída naquela data. Os códigos são derivados do início do ID; se houver colisão dentro do usuário, a operação é recusada em vez de escolher arbitrariamente. O código não concede acesso: o filtro de proprietário é obrigatório. Concluir uma tarefa pessoal não conclui automaticamente itens de projeto ou outros registros.

## Agendamento e falhas

- Horário fixado em `America/Sao_Paulo`, com cálculo de datas pelo fuso, não pela data UTC.
- O agendador consulta as preferências a cada minuto. Cada pessoa precisa optar pelo envio e informar o horário.
- A chave `(user_id, dia)` no registro de envio impede segunda execução no dia, inclusive após reinício ou com processadores concorrentes. Alterar o horário não gera novo envio no dia já registrado.
- Existe janela de recuperação de até duas horas após o horário escolhido. Fora dela, não é disparado um resumo atrasado.
- Se a instância estiver desconectada antes da tentativa, não é criado registro de envio; o sistema pode tentar depois, dentro da janela.
- Depois que uma tentativa de envio começou, uma falha fica como FALHOU, sem repetição automática no mesmo dia, porque um timeout pode ocorrer depois da aceitação pelo provedor. A pessoa pode usar `meu dia` para consultar novamente.
- Uma execução interrompida fica em REVISAR após dez minutos. Não há promessa de entrega exatamente uma vez em todas as falhas de rede.
- Pausa e mudança de programação invalidam a revisão de consentimento. Telefone, situação do usuário e organização são conferidos novamente antes de enviar, inclusive após a montagem do resumo.
- ACEITA significa aceitação pela API da Evolution, não leitura nem entrega confirmada no aparelho.

As tabelas novas guardam preferências e metadados de execução, sem persistir o corpo do resumo. Interface administrativa, política de retenção e reprocessamento assistido continuam pendentes. Uma alteração feita depois de a requisição de envio já ter saído não consegue recolher essa mensagem.

## Testes

- TypeScript aprovado; 14 testes focados de rotina/datas e regressão de menu aprovados.
- Banco isolado com schema real, sem dados de clientes: validação de recorrências antigas, intervalo semanal/quinzenal, fim de recorrência, tarefas atrasadas, dia de Brasília e datas inválidas.
- Isolamento: dados de outro usuário, relação de evento com outra organização e eventos não confirmados não aparecem.
- Permissões de Agenda e Keep verificadas independentemente. Código de tarefa de terceiro ou código ambíguo não altera registros.
- Captura pelo handler de entrada, reentrega simultânea sem duplicidade, conclusão, repetição da conclusão e reabertura aprovadas.
- Agendamento: horário, dias úteis, fim de semana, pausa, alteração de horário sem segundo envio, dois processadores, reinício e janela máxima aprovados.
- Revogação de acesso, mudança de telefone antes e durante a montagem, pausa durante a montagem, falha de transporte e execução interrompida aprovados.
- Instância desconectada seguida de reconexão dentro da janela recuperou o envio no banco isolado.
- Nesses testes integrados, transporte e permissões foram simulados para controlar cenários; as gravações e consultas usaram PostgreSQL real e o fluxo de entrada compilado.
- Produção: tarefa de teste criada uma vez após três entregas simultâneas, consultada, concluída, reaberta e concluída novamente pelo webhook e número autorizado. A tarefa foi removida.
- Produção: ativação temporária no horário corrente foi processada pelo agendador real e registrada como ACEITA. A preferência e o registro de envio pertencentes ao teste foram retirados ao final, permitindo ao usuário escolher sua programação real.
- Produção: aviso de encerramento do teste aceito pela Evolution (HTTP 201). API healthy, zero reinícios após inicialização e endpoint público HTTP 200.
- O banco temporário foi removido após os testes. A injeção autenticada de entradas no webhook não substitui teste visual de todas as telas nem comprova leitura no aparelho.

## Publicação e rollback

- Migration: `20261024193000_whatsapp_rotina`.
- Imagem: `orkestri/api:rotina-20261024`, também marcada `latest`.
- Digest: `sha256:0f5f6ff4e1e0e04a920845298095ba731d2af02f5c6ec03b06db3a034ddbc10a`.
- Backup: `orkestri/api:before-rotina-20261024`.
- Materiais de publicação e script de rollback: `/opt/orkestri/.deploy-whatsapp-rotina-20261024-7elkZU`.

O rollback restaura o módulo de entrada e a imagem anterior. As tabelas, o schema e a migration aplicada devem ser preservados; não apagar tarefas ou preferências para reverter a aplicação. A imagem anterior não registra o agendador de rotina.

O checkout local ainda não contém todos os módulos encontrados em produção. A publicação usou os fontes atuais do servidor como base e verificou seus hashes antes da substituição. A consolidação dos ambientes continua no plano.
