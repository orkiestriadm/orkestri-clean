# Comandos de agenda por texto e áudio transcrito

Implementação local, sem deploy. Produção permanece na API 5.2.2.

Reconhece `Aurélia/Aurélio, anota aí pra mim/para mim`, sem depender de
maiúsculas, acentos no nome/comando ou pontuação inserida pelo transcritor.
Também reconhece marque/marca/agende e pedidos diretos de academia,
cardiologista, dentista e reunião acompanhados de data ou horário.

Exemplos cobertos: academia amanhã às 15; pegar táxi amanhã às 12;
reunião às 15h30; dentista duas horas; cardiologista dia 26 do 11 às 15h30;
dentista hoje às quatro horas. Mantém o título completo em vez de delegar
sua extração ao LLM nesses comandos. Não altera nem treina o Qwen3.

`whatsapp-inbound.module.ts` já entrega `media.transcricao` ao fluxo guiado
antes do parser legado de áudio. Por isso o mesmo reconhecimento cobre texto
e transcrição. Não houve troca do transcritor nem teste com áudio real nesta
alteração. Se a transcrição vier incorreta, essa camada não garante recuperação.

Data ausente não vira hoje. Horários escritos sem período, como duas horas
ou quatro e trinta, pedem esclarecimento. Respostas como da tarde ou duas da
tarde completam o rascunho. Horários numéricos como 12, 15 e 15h30 seguem
notação de 24 horas. Datas inválidas não são normalizadas para outro dia.

Permissões e contexto pessoal são verificados antes do reconhecimento. Não
substitui formulários em andamento. Mantém snapshot sob lock, confirmação
explícita antes da gravação, revalidação de permissões e cancelamento.
Comandos de tarefa como tenho que comprar pão não viram agenda.

Validação: 113 testes em cinco suítes (comandos, guia, datas, IA e alertas).
Após ajuste final de data/hora ambíguas na continuação, repetidas as suítes
de comandos/datas e o build Nest. Testes usam mensagens transcritas sintéticas,
banco e WhatsApp simulados. Nenhuma mensagem ou evento real criado.
