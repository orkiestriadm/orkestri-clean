# Orkiestri — diagnóstico inicial de produto, negócios e tecnologia

Data: 24/10/2026. Diretriz do fundador: ajudar pessoas a orquestrar a vida e os negócios, conectando demandas, agendas, compromissos e gastos ao WhatsApp.

## Parecer

A oportunidade é tornar o Orkiestri um assistente cotidiano de organização que transforma mensagens em ações acompanhadas. Os módulos são a estrutura que sustenta essa experiência. A promessa comercial proposta é: **“Organize sua vida e seu negócio pelo WhatsApp: compromissos, tarefas e gastos, acompanhados em um só lugar.”** Trata-se de uma hipótese de posicionamento a validar, não de uma conclusão de pesquisa de mercado.

O próximo investimento deve melhorar o ciclo completo: capturar → esclarecer → registrar → lembrar → concluir → mostrar resultado. Ampliar o catálogo de módulos antes de tornar esse ciclo confiável pode aumentar a dificuldade de uso e manutenção.

## Evidências e limites

- Nesta sessão foram testados em produção menu, evento e gasto, com conferência e limpeza dos registros. A Evolution aceitou os envios; isso não prova leitura no aparelho.
- A instância de WhatsApp é única e compartilhada, por decisão do proprietário. Essa decisão deve ser preservada; a separação de usuários e organizações acontece na aplicação.
- Produção tem módulos de conversa e cadastro ausentes do checkout local. A divergência foi comprovada durante o deploy; precisa de reconciliação cuidadosa, preservando o trabalho existente.
- Foram lidos os arquivos copiados da produção, os arquivos corrigidos publicados, documentação de visão e arquitetura e a auditoria técnica de setembro. Os achados antigos não são tratados como falhas atuais de produção sem revalidação.
- O cadastro de nova conta ainda não foi testado ponta a ponta. O número autorizado já tem conta.
- Não foram analisadas métricas de receita, conversão, retenção, custos por cliente nem entrevistas com usuários. Não há base para estimar ganho de receita, tamanho de mercado ou disposição a pagar.
- Este trabalho produz diagnóstico e propostas. Nenhuma implementação adicional ou campanha comercial foi realizada nesta etapa.

## Prioridades propostas

| Ordem | Melhoria | Por que importa | Critério de aceitação |
|---|---|---|---|
| 1 | Convergir código, homologação e produção | Evita perder funcionalidades e repetir correções | Uma versão identificável por release, build reproduzível e teste de restauração/reversão |
| 2 | Cadastro íntegro e recuperável | A pessoa não pode ficar com conta parcialmente criada ou sem acesso | Falhas injetadas não deixam empresa/usuário/papéis incompletos; repetir confirmação não duplica conta; acesso pode ser recuperado sem novo cadastro |
| 3 | Uma mensagem gera uma única operação | Reenvio do provedor não deve duplicar gasto ou compromisso | Mesmo ID recebido repetidamente e em paralelo produz um único registro; falhas podem ser reprocessadas |
| 4 | Separar contexto pessoal e empresarial | Um único número não pode misturar dinheiro pessoal com contas da empresa | Toda operação identifica titular e contexto; colaboradores não veem dados pessoais; contexto ambíguo é esclarecido |
| 5 | Primeira ação útil durante o cadastro | Ter uma conta não equivale a perceber valor | Usuário novo conclui uma tarefa escolhida e sabe como consultar/corrigir o resultado |
| 6 | Conversa guiada e correção simples | Reduz necessidade de decorar comandos | Campos ausentes geram perguntas; voltar/cancelar funcionam; correção aponta o registro exato |
| 7 | Entrega rastreável e recuperação | Registro salvo e confirmação enviada são eventos diferentes | Painel distingue pendente, aceito, entregue quando informado, falhou; reenvio não repete a operação de negócio |
| 8 | Rotina diária opcional | Conecta captura ao acompanhamento | Pessoa escolhe horário, dias, conteúdo e pausa; resumo agrega dados sem duplicar alertas |
| 9 | Funil e retenção por uso real | Direciona melhorias pelo comportamento | Medir cadastro, primeira ação, retorno semanal, tarefa concluída e motivo de abandono |
| 10 | Oferta e preço testados com usuários | Monetiza o resultado percebido | Piloto explicita benefício, limites e preço; mede aceitação, custo de servir e continuidade |

## WhatsApp: lacunas técnicas observadas

### Cadastro em várias escritas

Em `.whatsapp-audit/production-cadastro.ts`, `concluir` cria organização, usuário, papéis, perfil e finaliza o cadastro em operações separadas, sem transação envolvendo o conjunto. Isso comprova a estrutura do código, não uma ocorrência de cadastro parcial em produção.

Proposta: transação para o provisionamento, controle de concorrência por cadastro e restrições únicas adequadas. O envio de boas-vindas deve sair depois do commit por uma fila persistente. Se o envio falhar, a conta criada deve continuar recuperável. Revisar também a necessidade de pedir CPF tão cedo; é uma decisão de produto a validar conforme a finalidade do dado, não uma recomendação jurídica.

### Entrada sem registro durável do processamento

No módulo de entrada auditado, não foi localizado controle persistente por `key.id` antes das gravações; o controller captura erro e responde HTTP 200. Há risco de duplicação em reenvios e de perda silenciosa de processamento em falhas. A frequência desses problemas não foi medida.

Proposta: autenticar, validar e persistir o evento; só então confirmar o recebimento. Processar por conversa em ordem, com repetição segura, tentativas limitadas e fila de falhas revisável. Não basta trocar todo erro por HTTP 500: isso pode repetir uma operação que já foi gravada.

Essa proposta é coerente com a orientação da [OWASP para webhooks](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html): autenticação, processamento idempotente e controle de duplicidade. A aplicação concreta depende do contrato da Evolution utilizada.

### Respostas, sessão e identificadores

O menu usa estado em memória com validade de dez minutos; reiniciar a API perde esse estado. O parser lê apenas o primeiro item quando `data` é uma lista. O cadastro usa a parte numérica de `remoteJid`; é necessário validar eventos com identificador LID e telefone alternativo para não tratar LID como telefone.

Proposta: sessão persistente com prazo de expiração, tratamento explícito de lotes, matriz de payloads reais e resolução consistente de identidade. Para múltiplas organizações, selecionar contexto entre as organizações às quais o usuário comprovadamente tem acesso; o remetente compartilhado não determina a organização.

### Saída e credenciais

O cadastro ignora falha de envio e envia senha provisória na mensagem de boas-vindas. O serviço de envio registra parte do retorno do provedor, que pode conter conteúdo da mensagem. Não foi verificado se alguma credencial apareceu em logs.

Proposta: link de ativação de uso único e expiração curta, ocultação de conteúdo sensível nos logs e fila de envio recuperável. O repositório já contém um worker de notificações com tentativas; avaliar seu reaproveitamento e confirmar a versão ativa antes de criar um segundo mecanismo.

## Experiência desejada

### Primeiro contato

“O que você quer organizar primeiro?” com três caminhos simples: compromissos, tarefas ou gastos. Depois da identificação mínima necessária, ajudar a registrar um item real. Mostrar o resultado, como editar e como receber lembrete. Pedir dados adicionais no momento em que forem necessários e explicar sua finalidade.

### Linguagem cotidiana

Exemplos de experiências propostas, ainda não implementadas:

- “Dentista terça às 15h” → resolver a data, mostrar o compromisso e oferecer lembrete.
- “Preciso cobrar o orçamento do João amanhã” → tarefa com prazo; contato ambíguo exige esclarecimento.
- “Gastei 48 no almoço” → confirmar interpretação do valor e contexto quando necessário.
- “O que tenho hoje?” → compromissos e tarefas, separados de contas vencidas.
- “Quanto gastei esta semana?” → total, período, contexto e acesso aos lançamentos.

IA pode ajudar a interpretar linguagem, mas permissões, datas, valores e gravação devem continuar determinísticos e auditáveis. Pedir confirmação quando houver ambiguidade ou impacto relevante; ações simples e claras podem ser registradas com confirmação posterior e edição segura. Áudio e fotos entram depois, com avaliação de precisão e custo.

### Pessoal e empresa

A pessoa pode ter compromissos pessoais e tarefas de uma empresa sem precisar manter dois números de WhatsApp. Isso exige contexto explícito na aplicação e nas confirmações: “Pessoal” ou nome da empresa. Evitar perguntar a mesma coisa em toda mensagem quando o contexto estiver claro, mas permitir “mudar para pessoal” e “mudar para empresa”.

“Apagar o último” deve evoluir para uma confirmação do item exato, sobretudo com mensagens simultâneas, recorrência e mais de um contexto. Para ações empresariais sensíveis, incluir confirmação e trilha de auditoria.

## Oportunidades de negócio para validar

Usar a mesma promessa central em três situações de uso, sem presumir que sejam três produtos distintos:

1. **Pessoa organizando a vida:** compromisso esquecido, tarefa pendente, gasto sem controle.
2. **Profissional autônomo:** agenda, retorno a cliente, proposta e despesas da atividade.
3. **Pequena equipe:** distribuir demandas, acompanhar responsáveis e integrar compromissos e gastos autorizados.

Começar entrevistando pessoas desses grupos e observar onde conseguem resultado com menor configuração e menor suporte. Escolher a primeira campanha por evidência de uso recorrente e disposição a pagar, não pela quantidade de módulos disponíveis.

Hipóteses comerciais: plano individual; plano para profissional com contextos pessoal/negócio; plano de equipe com colaboração e permissões. Preço e limites dependem do piloto, de custos de mensagens/IA/infraestrutura e do suporte. Não prometer uso ilimitado antes de medir esses custos.

Na comunicação, demonstrar uma tarefa completa em linguagem simples. O catálogo de módulos serve como aprofundamento. A proposta institucional ampla de “Business Operating System”, encontrada no site local, pode continuar atendendo compradores empresariais, mas merece teste contra uma apresentação mais direta da organização cotidiana. Não foi realizada auditoria visual da página publicada.

## Indicadores

- **Ativação:** novos usuários elegíveis que concluem a primeira ação útil ÷ novos usuários elegíveis, em janela definida.
- **Tempo até o primeiro resultado:** mediana e percentil 90 entre início e primeira ação concluída.
- **Retenção semanal:** pessoas ativadas que voltam a realizar ação útil, por coorte; separar pessoal, profissional e equipe.
- **Sucesso da conversa:** intenções suportadas concluídas ÷ tentativas dessas intenções; medir também pedidos não suportados.
- **Confiabilidade:** operações duplicadas, eventos sem processamento, envios falhos, tempo de recuperação.
- **Economia do serviço:** custo de mensagens, processamento, IA e suporte por usuário ativo/cliente.
- **Conversão e cancelamento:** passagem para pagamento, motivo de recusa e cancelamento, sem confundir cadastro com receita.

Uma ação útil pode ser concluir tarefa, registrar/consultar gasto ou organizar compromisso. Receber uma notificação passivamente não deve inflar a ativação.

## Sequência indicativa de 90 dias

**Dias 1–15:** reconciliar versões; reproduzir cadastro completo em ambiente controlado; resolver integridade, repetição e recuperação; definir eventos de medição. Revalidar segurança/isolamento apontados pela auditoria anterior na versão atual, sem presumir que continuem iguais.

**Dias 16–30:** fluxo guiado de primeira ação, correção/cancelamento, contexto pessoal/empresa e protótipo de resumo diário opcional. Testar com um pequeno grupo, por exemplo 5–10 pessoas; tamanho é sugestão operacional, não amostra estatística.

**Dias 31–60:** corrigir as maiores causas de abandono observadas, medir retorno, testar as mensagens comerciais e propostas de plano. Só incorporar interpretação por IA em intenções delimitadas, com testes e custo medido.

**Dias 61–90:** ampliar o fluxo com melhor uso recorrente, testar oferta paga e implantação de equipe, medir suporte e custo. Expandir módulos/canais apenas quando houver demanda demonstrada.

Essas janelas organizam prioridades; não são estimativas fechadas de implementação. O primeiro marco verificável deve ser: uma pessoa nova se cadastra, organiza algo útil, recebe o acompanhamento e consegue corrigir/concluir a ação sem intervenção técnica.
