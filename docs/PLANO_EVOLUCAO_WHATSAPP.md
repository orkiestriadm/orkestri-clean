# Plano de evolução do WhatsApp no Orkiestri

Atualizado em 25/10/2026 após as publicações e validações em produção.

| Frente | Situação | Evidência / próximo resultado |
|---|---|---|
| Cadastro íntegro | Publicado | Rollback, confirmação concorrente e permissões reais testados |
| Reenvios duplicados e lotes | Publicado | Recibos persistentes e todos os itens do lote |
| Recuperação das boas-vindas | Publicado | Fila persistente, agendador e orientação de acesso |
| Definição/recuperação de senha | Integrada e corrigida | Número com/sem DDI; percurso até login validado em banco isolado |
| Primeira ação guiada | Publicado para compromisso e gasto | Perguntas, resumo, correção e confirmação |
| Mensagens de saída do bot | Corrigido | Não executam comandos |
| Contexto pessoal e empresa | Publicado | Contexto persistente, escopo do cadastro e cancelamento de rascunhos |
| Ativação e retenção | Publicado | Ações úteis e coortes reais; janelas incompletas não entram no denominador |
| Resumo diário opcional | Publicado | Horário de Brasília, dias úteis, pausa e consulta sob demanda |
| Tarefas pessoais até a conclusão | Publicado | Captura, listagem, conclusão e reabertura pelo código |
| Acompanhamento de demandas de equipe/projetos | Publicado | Criação, atribuição, andamento, conclusão/reabertura pela API existente |
| Linguagem cotidiana, áudio e anexos | Publicado | Intenções delimitadas com prévia; áudio local de até 30 s; PDFs/imagens privados |
| Fonte e release da edição One | Publicado | Fonte consolidada, lockfiles e imagens completas validadas em ambiente isolado; Hub preservado |
| Operação das filas e recibos | Publicado | Painel autenticado, revisão auditada e repetição bloqueada quando há efeitos parciais |

O pacote principal foi publicado em 25/10/2026, com validação de saúde, ASR real e transferência real de PDF pelo provedor compartilhado. Detalhes e limites em `WHATSAPP_CONSOLIDACAO_2026-10-25.md`. O servidor 10.192.4.123 não foi alterado.

Caso adicional da imagem: corrigido e publicado. `0` encerra mesmo sem menu aberto; `9` reabre; mensagens desconhecidas orientam a abrir o menu; números soltos não viram despesas, inclusive para contas com acesso somente a gastos. Cadastro, renovação válida e confirmações mantêm precedência. Sequência validada em banco isolado e no número autorizado em produção, sem novos gastos.

Detalhes: `CADASTRO_WHATSAPP_ETAPA_1_2026-10-24.md`, `WHATSAPP_ACESSO_E_INICIO_2026-10-24.md` e `WHATSAPP_ROTINA_E_TAREFAS_2026-10-24.md`. A autorização de desenvolvimento e publicação já foi concedida no chat. Este arquivo registra o progresso; não agenda execução automática.
