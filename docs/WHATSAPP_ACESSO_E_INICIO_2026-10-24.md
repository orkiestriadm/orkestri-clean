# WhatsApp — acesso recuperável e primeira ação guiada

Status: publicado em produção em 24/10/2026. Publicação principal às 18h57 e filtro final às 19h03, horário de São Paulo.

## O que o usuário pode fazer

- Enviar **acesso** para receber o e-mail de login e a página onde pode definir ou recuperar a senha por código de WhatsApp ou link de e-mail.
- Enviar **começar**, **primeiros passos** ou **organizar** para registrar um compromisso ou gasto com perguntas sequenciais.
- Conferir o resumo e responder **1** para confirmar, **2** para corrigir ou **0** para cancelar. A gravação acontece depois da confirmação.
- Enviar **voltar** para recomeçar a escolha; **menu** ou **ajuda** encerram o passo a passo e abrem a ajuda existente.
- Pedir **cadastro** novamente, quando a conta já existe, agora devolve as orientações de acesso em vez de deixar a mensagem sem resposta útil.

O guia de gastos usa o módulo de gastos pessoais do usuário; não cria conta a pagar empresarial. O fluxo de compromissos não inclui recorrência nesta etapa.

## Cadastro e boas-vindas

A fila `whatsapp_boas_vindas` é gravada na mesma transação que cria a conta. Se a fila não puder ser registrada, o cadastro também sofre rollback. Uma falha de envio posterior não desfaz a conta: a tentativa fica persistida.

O agendador consulta a fila a cada minuto. Há até cinco tentativas, com espera crescente, validade de 24 horas e controle de concorrência. O telefone e a situação atual do usuário são conferidos antes de enviar. Mudança de telefone ou conta inativa/bloqueada impede o envio ao destino antigo.

Estados: PENDENTE, ENVIANDO, ACEITA, FALHOU, EXPIRADA e DESCARTADA. ACEITA indica aceitação pela API do provedor, não leitura nem entrega confirmada no aparelho. Uma interrupção depois do envio e antes de registrar o resultado pode repetir a orientação; ela não contém senha e não executa nenhuma operação de negócio.

Novas contas recebem hash de uma senha aleatória que não é enviada nem persistida em texto. A pessoa define sua senha pelo fluxo existente de recuperação; por isso não é solicitado trocar essa senha novamente no primeiro login. A fila guarda identificadores e metadados, sem corpo de mensagem, senha ou token. A orientação de acesso pode ser solicitada novamente pelo próprio WhatsApp vinculado.

## Recuperação por telefone

O backend de envio e verificação do código agora aceita telefone brasileiro com ou sem DDI 55 e com pontuação. A comparação usa variantes completas, sem comparação por sufixo. Quando mais de um perfil corresponde às variantes, o fluxo exige recuperação por e-mail, em vez de escolher uma conta arbitrariamente. O envio ao provedor usa o número com DDI.

## Estado da conversa e permissões

O passo a passo fica em `whatsapp_inicio`, separado por usuário, instância e conversa, com validade de 30 minutos. As transições usam lock transacional; os envios ocorrem depois da transação. A confirmação conserva a data e o valor mostrados no resumo. Permissões são verificadas durante a conversa e antes da operação de negócio.

Mensagens reenviadas pelo provedor continuam protegidas pelo registro de recibos da etapa anterior. Grupos e mensagens marcadas como saída do próprio bot são ignorados antes de executar comandos. Esse filtro elimina o caminho reproduzido em teste no qual uma mensagem `fromMe` podia criar um evento.

O diário de recibos continua conservador: falhas com efeitos possivelmente parciais exigem revisão, sem repetir automaticamente uma operação de negócio. Isso é diferente da fila de orientações de boas-vindas, cujo conteúdo pode ser reenviado sem criar registros.

## Logs e tempo de resposta

O conteúdo bruto do webhook e o retorno bruto do envio não são mais registrados nesses pontos. Os números nos logs de envio ficam parcialmente ocultos; os códigos de recuperação deixam de aparecer no corpo de resposta registrado. Isso não representa remoção de todo dado de negócio de todos os logs históricos ou módulos.

As chamadas HTTP ao provedor receberam limite de 15 segundos por requisição. A consulta de status pode envolver mais de uma requisição; o limite não é o tempo máximo de toda a conversa.

## Validação

- TypeScript: aprovado.
- Regressão anterior de WhatsApp: 26 testes aprovados; autenticação: 24 aprovados. Após incluir o filtro de saída, a suíte de fluxo, que está incluída na contagem de WhatsApp, passou com oito casos. As contagens não devem ser somadas como testes distintos.
- Banco isolado com estrutura e helpers reais: falha na fila desfaz cadastro; falha de transporte preserva conta e fila; novo worker recupera envio; concorrência não dispara dois envios na mesma tentativa; limite de tentativas e mudança de telefone funcionam.
- Compromisso guiado: data inválida recusada, correção e confirmação funcionam, titular e organização corretos.
- Gasto guiado: valor correto mesmo com número na descrição; cancelamento não grava; confirmação grava uma vez.
- Permissão revogada, saída para menu, expiração e mensagem duplicada verificadas.
- Recuperação completa no banco isolado: solicitar código sem DDI, verificar número formatado, recusar código já usado, definir senha e fazer login. Nenhuma senha de cliente foi alterada nesses testes.
- Transporte simulado: sinais de timeout presentes e logs sem conteúdo do código/mensagem.
- Produção: compromisso guiado pelo webhook e número autorizado, confirmação repetida sem duplicar, orientação de acesso aceita pelo provedor. O evento de teste foi removido.
- Produção: o agendador, sem chamada manual do worker, processou a orientação de teste e registrou ACEITA. A entrada de teste foi removida depois da conferência.
- Produção: mensagem marcada `fromMe` não criou evento nem recibo. API healthy, zero reinícios após inicialização; API e página de recuperação HTTP 200.

Os testes de produção injetaram entradas autenticadas no webhook e usaram o envio real para o número autorizado. Não equivalem à validação visual de cada tela nem comprovam leitura das mensagens no aparelho.

## Publicação e reversão

- Migration aditiva: `20261024190000_whatsapp_inicio`.
- Imagem final: `orkestri/api:inicio-final-20261024`, também marcada `latest`.
- Digest final: `sha256:288840725c87227206db0338974b586ac5feb1703012c7504de5fefbf2a70eab`.
- Backup anterior à etapa: `orkestri/api:before-inicio-20261024`.
- Materiais e script de rollback: `/opt/orkestri/.deploy-whatsapp-inicio-20261024-F8Bpdw`.
- O ajuste final do filtro tem backup adicional `orkestri/api:before-eco-20261024`.

Para reverter a aplicação, restaurar os fontes e a imagem conforme `rollback-inicio.sh`. Manter as tabelas, o schema e a migration já aplicada; não descartar contas ou filas para reverter código. A instância única compartilhada permanece em uso.

## Próximas etapas do plano

1. Tornar explícito o contexto pessoal/empresa e revisar os pontos de escolha e autorização.
2. Medir ativação e retorno, incluindo início e conclusão do passo a passo, sem inflar números com notificações passivas.
3. Rotina diária opcional e acompanhamento até a conclusão das demandas.
4. Convergir o checkout local com os módulos de produção e consolidar uma publicação reproduzível. Esta etapa ainda usou a versão de produção como base para preservar recursos ausentes localmente.
5. Interface operacional para filas e recibos, retenção de metadados e reprocessamento assistido.
