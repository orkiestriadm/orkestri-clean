# Aurélia: data e horário em etapas — 29/10/2026

Branch: codex/aurelia-date-followup. Base: origin/codex/site-whatsapp-orbit-dots em eea0758. Alteração ainda não publicada na API.

## Falha reproduzida

O fluxo guiado pedia dia e horário juntos. Se a pessoa enviasse somente uma data, o validador rejeitava toda a informação e repetia a pergunta genérica. Além disso, a leitura determinística de datas não aceitava meses por extenso. Isso afetava entradas válidas como 10/12/2026 e 10 de dezembro de 2026 quando faltava apenas o horário.

Cinco cenários de conversa falharam no código anterior, reproduzindo o relato. A correção guarda a parte válida no rascunho persistido da conversa e pede apenas o que falta, sem criar evento antes da confirmação. Aceita data antes do horário ou horário antes da data. Uma nova instância do serviço retoma a coleta a partir desse rascunho. Voltar restaura a etapa anterior e cancelar descarta o rascunho.

O parser compartilhado agora reconhece meses completos em português, preservando validação estrita do calendário e o fuso America/Sao_Paulo. Não normaliza datas impossíveis, não presume hoje para um horário isolado e não inventa horário para uma data isolada. O número 9 na pergunta de horário é tratado como 09h; a palavra Voltar continua sendo a navegação explícita.

## Exemplo após a correção

- Pessoa: 10/12/2026 (ou 10 de dezembro de 2026).
- Aurélia: Data: 10/12/2026. Qual é o horário? Exemplo: 14h ou 14:30.
- Pessoa: 14:30.
- Aurélia: pergunta a duração, prossegue com repetição e apresenta o resumo para confirmar.
- O evento permanece sem gravação até a confirmação e usa 10/12/2026 às 14:30 em São Paulo.

## Verificações e limites

- TypeScript do backend aprovado: tsc --noEmit --incremental false.
- Quatro suítes isoladas aprovadas, 92 testes: whatsapp-guiado, whatsapp-guiado-quando, evento-alerta e alert.scheduler.
- Cobertura inclui os dois formatos relatados, mensagens separadas em ambas as ordens, retomada entre instâncias, horário inválido, substituição da data, navegação/cancelamento, anos bissextos, datas impossíveis/passadas, virada de dia em São Paulo e regressões dos avisos.
- Jest executado com transformação isolada ts-jest e diagnósticos separados pelo tsc. Chamadas de banco e WhatsApp simuladas; nenhum serviço real ou contato de cliente usado. Um aviso de depreciação do parâmetro isolatedModules do ts-jest 29 não afetou os resultados.
- Esses resultados comprovam os cenários cobertos. Não constituem garantia de funcionamento universal de todos os formatos ou fluxos da assistente.

Sem migrations, alterações de registros ou disparos reais. Para disponibilizar a correção é necessária publicação da API expressamente autorizada, com auditoria da base ativa e rollback. A autorização anterior cobriu somente o site. Actions e webhooks conferidos antes do push: nenhum configurado. Main protegida.
