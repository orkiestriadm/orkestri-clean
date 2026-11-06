# Aurélia: comandos formais e informais de agenda

Status: implementado no código, sem deploy. Produção permanece na API 5.2.2.
Esta entrega amplia regras determinísticas e a base de avaliação; não treina
os pesos do Qwen3 e não altera o transcritor de áudio.

## Base reutilizável

`backend/src/modules/agenda/fixtures/aurelia-agenda.json` contém 24 exemplos,
com texto, título completo, dia, expressão de horário e horário esperado.
Os exemplos são executados automaticamente pelos testes. É uma base inicial
de avaliação, pequena demais para ser apresentada como um treinamento completo.

| Forma | Exemplo | Comportamento |
|---|---|---|
| Informal | Aurélia, anota aí pra mim: academia amanhã às 15 | Agenda, amanhã, 15h |
| Formal | Aurélia, agende academia para amanhã às 15h | Mesmo significado |
| Informal | Coloca uma reunião com o João amanhã às três da tarde | Preserva título completo |
| Formal | Registre uma consulta odontológica na sexta-feira às 9h | Reconhece dia da semana |
| Data falada | Agende reunião no dia vinte e seis de novembro às três e meia da tarde | 26/11, 15h30; ano corrente |
| Hora falada | Marque reunião amanhã às quinze e trinta | 15h30 |
| Duração | Agende reunião amanhã às 10h, com duração de 30 minutos | 30 minutos |
| Áudio transcrito | Aurélio… anota aí pra mim… academia… amanhã às quinze | Aceita nome e pausas |
| Autocorreção | Marca academia amanhã às três… não, às quatro da tarde | Usa 16h e pede confirmação |
| Sem data | Agende uma reunião às 15h30 | Pergunta o dia |
| Sem horário | Anota aí: dentista amanhã | Pergunta o horário |
| Ambíguo | Dentista amanhã às duas | Pergunta o período |

## Continuação e revisão do rascunho

- Dia: amanhã, sexta, dia 26 do 11, no dia vinte e seis de novembro.
- Horário: 15h30, três e meia da tarde, ao meio-dia, quinze e trinta.
- Período: da tarde, de manhã, da noite; preserva a data informada.
- Duração: meia hora, uma hora, 45 minutos, quarenta e cinco minutos.
- Correção: não, é às 16h; troca o dia para sexta; quis dizer 14h;
  o nome é reunião com João. Corrige apenas o rascunho de criação em andamento.
- Confirmação: sim, pode salvar, pode marcar, isso mesmo, pode marcar.
- Cancelamento: cancela, cancelar, deixa pra lá, deixa para lá, não salva, desisti.

Datas impossíveis e horários passados não são ajustados silenciosamente.
Pedidos múltiplos reconhecidos recebem orientação para enviar um compromisso
por vez; não há fila automática de vários eventos. Não promete detectar toda
combinação possível de linguagem natural. Consultar, reagendar, excluir e
recorrência livre permanecem nos fluxos existentes.

## Integração e proteção

Texto e resultado da transcrição passam pelo mesmo serviço guiado. Permissões,
contexto pessoal, isolamento, lock e confirmação continuam obrigatórios.
Correções não editam eventos já gravados. Os testes usam banco e WhatsApp
simulados; não foram enviados áudios nem mensagens reais nesta entrega.

Suítes de validação: comandos (incluindo a base JSON), fluxo guiado, coleta de
datas, cliente IA e alertas. Build Nest obrigatório antes do commit.
