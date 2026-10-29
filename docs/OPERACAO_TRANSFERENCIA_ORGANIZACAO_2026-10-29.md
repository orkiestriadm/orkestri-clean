# Transferência de usuário entre organizações — 29/10/2026

Manutenção de dados em produção expressamente solicitada pelo responsável. Sem deploy, migrations, reinício de containers ou envio de mensagens de teste.

## Operação

- Usuário identificado unicamente na origem; organização de destino criada com o nome solicitado. O identificador do usuário foi mantido.
- 47 compromissos transferidos com os mesmos IDs, conteúdo, datas e recorrências. Há 20 registros recorrentes e dois compromissos futuros confirmados no momento da conferência.
- Papel da nova organização criado com as mesmas 44 permissões do papel anterior, sem elevar privilégios. Vínculo com o papel da origem removido apenas para o usuário transferido.
- Cinco regras de avisos preservadas integralmente: 60, 30, 15, 5 e 0 minutos. Nova organização resolve para o mesmo canal WhatsApp padrão, conferido como conectado via consulta de leitura.
- Atividade e recibo técnico da conversa vinculados à organização de destino. A conferência adicional incluiu modelos com organizationId/userId sem relação Prisma explícita, para não omitir recibos.
- Perfil, número de WhatsApp, módulos e campos de assinatura do usuário preservados. Nenhuma configuração da organização de origem foi alterada.

## Proteções e verificação

Antes da escrita, cópias privadas de reversão foram salvas no servidor com acesso restrito. Identificadores, conteúdo de eventos, contatos e backups não integram o repositório público.

A transferência principal usou transação serializável, bloqueio do usuário/eventos, comparação com o retrato anterior e pós-condições. O recibo técnico identificado na conferência complementar foi preservado antes de ajustar seu vínculo em transação própria.

A conferência final comparou todos os eventos com a cópia anterior, ignorando somente organizationId e atualizadoEm; confirmou perfil, conjunto de permissões e regras de avisos equivalentes. Nenhum vínculo do usuário com organizationId permaneceu fora do destino nos modelos auditados. API saudável e WhatsApp conectado após a operação. Não foi forçado disparo de lembrete: a validação confirmou as condições de agendamento e envio, sem simular entrega futura.

Branch de registro: codex/organization-member-transfer, baseada em origin/codex/site-continuous-atmosphere (32166cb). A referência compartilhada de código continua sendo a release do site já publicada. Actions e webhooks conferidos antes do push: nenhum configurado. Main protegida.
