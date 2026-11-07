# Versão 5.3.0 — lembretes, hábitos e aprendizado revisado

## Escopo

- Código de aplicação: `3a4a730`, branch `claude/orkiestri-audit-benchmark-4a28b4`.
- Teste integrado com rollback: `d2fabd1`, `backend/scripts/smoke-rotina-530.cjs`.
- API e painel: 5.3.0. Website permanece 3.17.0.
- Publicação concluída em 07/11/2026; ref publicado `d2fabd1`.

## Comportamento

- Lembretes: `Me lembre de beber água daqui 15m` e `Me lembre amanhã pela manhã de marcar uma consulta`. Gravação direta, sem confirmação. Dados incompletos ou inválidos não são gravados.
- Brasília: manhã 09:00 (personalizável), tarde 14:00, noite 19:00. A resposta informa o horário efetivo.
- Tela `/dashboard/lembretes`: pendentes, enviados, cancelados e situações que exigem revisão. Cancelamento apenas enquanto pendente.
- Hábitos: `/dashboard/habitos`, cards com nome, cor, início e duração de 1 a 366 dias; uma marca por data dentro do período. Permite desfazer o check-in de hoje e arquivar/reativar cards.
- WhatsApp: `Crie um hábito Academia por 30 dias`; `Faça check-in no hábito "Academia"`.
- Texto e transcrições de áudio chegam ao mesmo serviço após identificação do usuário.
- Permissões: reaproveita Agenda (ver/criar/editar), com filtro obrigatório de usuário e organização.

## Aprendizado

- `/dashboard/aurelia`: consentimento individual, horário da manhã, revisão e exclusão dos próprios exemplos.
- Pedidos de agenda confirmados e compatíveis com a extração originam exemplos PENDENTES. Correções curtas de horário podem compor o exemplo.
- Títulos são substituídos por `compromisso`; filtros removem identificadores conhecidos. O filtro não garante anonimização irreversível de texto livre: exemplos permanecem privados e requerem revisão.
- Somente APROVADOS da mesma conta são consultados. Até três exemplos relevantes compõem o contexto da inferência. Nenhum exemplo altera as permissões ou executa comandos.
- Desligar a preferência interrompe coleta e consulta. Apagar remove exemplos e preferências, preservando dados operacionais.
- Retenção dos exemplos: 90 dias. Não há ajuste automático dos pesos do Qwen, compartilhamento entre clientes ou treinamento com todo o histórico.
- Modelos indisponíveis continuam usando o fluxo determinístico. Compromissos e gastos mantêm confirmação.

## Operação

- Migração aditiva: `20261106210000_rotina_pessoal` (três tabelas, sem exclusão de dados anteriores).
- `backend/deploy/rotina.production.yml` habilita o agendador somente em produção e libera a interpretação de IA para 100% das contas elegíveis. Consentimento de aprendizado continua individual e desativado por padrão.
- Agendador a cada 15 segundos; claim persistente com `SKIP LOCKED`. Entrega incerta fica em REVISAR, sem repetição automática.
- Sem garantia de entrega quando WhatsApp está desconectado. O painel mostra a situação.
- Localhost e Evolution local permanecem sem deploy e sem ativação de envios.

## Validação

- 187 testes passaram em 11 suítes de agenda/WhatsApp.
- Builds locais de API e painel concluídos; as três rotas novas foram geradas.
- Script de deploy validado com `bash -n`.
- Teste integrado executado: SMOKE_OK e ROLLBACK_OK na conta fictícia `aurelia.teste@example.com`. Validou gravação, isolamento, duplicidade, cancelamento, coleta, aprovação, consulta e desligamento. Nenhum dado dessa transação persistiu.
- WhatsApp real: lembrete criado sem confirmação às 12:26, previsto para 12:27:44, enviado às 12:27:47 (Brasília) e observado na conversa.
- Hábito `Academia Teste 530`: criado por 30 dias, check-in 1/30; segunda tentativa respondeu que já estava marcado, preservando 1/30. Card arquivado ao concluir o teste, preservando histórico.
- Correção real `não, às 11h`: mudou Reunião Teste 530 de 08/11/2026 10:00 para 11:00. Rascunho cancelado e cancelamento confirmado no chat.
- Conferência visual das telas autenticadas não realizada: painel abriu na tela de login, sem sessão. Build e rotas compiladas verificados.

## Resultado da publicação

- API: build e container concluídos; saúde pública `status=ok`, versão `5.3.0`.
- Painel: build e container concluídos; nginx recarregado.
- Script oficial finalizou com código 0: 290 arquivos no Git e 290 em produção, paridade confirmada.
- `ROTINA_LEMBRETES_ENABLED=true` e `AURELIA_IA_ROLLOUT_PERCENT=100` confirmados no container.
- Modelo preservado: `qwen3:1.7b`. Aprendizado é consulta a exemplos revisados, não ajuste dos pesos do modelo.
- Backup/rollback de código: referência anterior `3f51f78`; tabelas novas são aditivas e devem ser preservadas em eventual rollback. O arquivo de configuração de produção deve ser ajustado junto se houver rollback do recurso.
