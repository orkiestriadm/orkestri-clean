# Lembretes da agenda por organização — 28/10/2026

## Diagnóstico

A consulta de produção foi somente de leitura. O compromisso estava salvo, confirmado e com WhatsApp vinculado; o agendador estava executando sem erros. Não havia recibo de tentativa de aviso nem notificação para o evento.

A organização recém-criada não tinha AlertConfig. A implementação carregava somente regras ativas de todas as organizações e, se encontrasse qualquer regra, substituía os padrões globais por essa lista. No loop do compromisso, descartava as regras das outras organizações. O resultado era zero avisos para a organização nova.

Existiam dois efeitos relacionados: a janela de consulta podia ficar menor que os 60 minutos dos padrões se outras organizações tivessem apenas regras curtas; e uma organização com todas as regras desativadas podia receber os padrões quando o filtro global não retornava nenhuma regra ativa.

## Correção publicada

- Carregar as regras, inclusive desativadas, e agrupá-las por organização.
- Usar os padrões de 60, 15, 5 e 0 minutos somente quando a organização não possui regras próprias.
- Preservar a configuração de quem escolheu desativar avisos ou configurar apenas alguns horários.
- Incluir os 60 minutos padrão na janela global de consulta para que compromissos de organizações novas sejam encontrados.
- Manter recibos duráveis e controle de duplicidade existentes. Corrigir os escapes de emoji dos padrões.

Nenhum dado de produção, horário de compromisso ou configuração de cliente foi alterado. Nenhuma mensagem foi disparada manualmente durante a investigação; a entrega automática após a publicação foi verificada e registrada no documento do deploy. A publicação foi autorizada separadamente e concluída; ver DEPLOY_LEMBRETES_AGENDA_2026-10-28.md.

## Validação

Os testes novos reproduziram quatro falhas na implementação anterior. Após a correção, 39 testes passaram: 11 cenários do agendador e 28 cenários existentes de avisos, confirmação/adiamento e deduplicação. A fixture do teste antigo passou a declarar explicitamente ativo=true, como o banco real já retorna. A compilação completa da API também passou.

```text
cd backend
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/modules/notifications/alert.scheduler.spec.ts src/modules/notifications/evento-alerta.spec.ts
```

Base desta tarefa: branch codex/fix-whatsapp-signup-flow, commit 0941515 (registro do código de produção 9d15275). Branch da correção: codex/fix-agenda-reminders-by-organization. Não há migrations ou dependências novas. Registros específicos do usuário, números, e-mail e identificadores de seu compromisso não foram incluídos neste documento público.
