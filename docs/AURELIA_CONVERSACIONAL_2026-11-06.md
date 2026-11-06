# Atendimento conversacional da Aurélia

Implementado e validado localmente; ainda não publicado. Produção permanece
na API 5.2.3. Esta mudança não altera os pesos do Qwen3 nem o transcritor.

## Experiência

- Convite e cadastro fazem perguntas diretas, sem anunciar opções numéricas.
  Reconhecem quero me cadastrar, vamos começar, sim, não tenho interesse e
  agora não. Dados continuam sendo validados e confirmados antes de criar conta.
- Boas-vindas orientam compromisso e gasto por mensagem; outros módulos são
  direcionados ao navegador em https://www.orkiestri.com/login.
- A entrada pública do WhatsApp usa `tratarConversa`. Saudações, ajuda e números
  avulsos não abrem menus. Os antigos fluxos internos são preservados para
  compatibilidade e testes, mas não são oferecidos pelo novo atendimento público.
- Rascunhos legados não conversacionais são reiniciados sem salvar a operação.
- Compromissos e gastos continuam exigindo confirmação. A camada de texto usa
  perguntas claras e regras de intenção; não promete conversa irrestrita ou
  interpretação correta de qualquer frase. O LLM continua limitado ao escopo
  autorizado, sem acesso livre ao banco.
- O resultado da transcrição de áudio percorre a mesma entrada. Não houve
  teste com gravação real de áudio ou mensagens reais nesta implementação.

## Financeiro

`lançar barrinha de cereal 12 reais no pix` prepara um gasto de R$ 12,00.
`lançar Gasolina 400 reais no credito em 3x` prepara três lançamentos de
R$ 133,34, R$ 133,33 e R$ 133,33, no mês da compra e nos dois seguintes.

A prévia mostra os valores e as datas. Somente depois da confirmação são
criados os registros dentro da transação existente. Cada linha recebe a
descrição com índice (1/3 etc.), valor da parcela, `parcelas=1` e
`valorParcela=null`, para os relatórios existentes contarem cada despesa mensal
uma única vez. Não é criado outro lançamento com o valor total da compra.
Não há cobrança no cartão: são registros de despesas pessoais.

O dia da compra é mantido em cada mês, limitado ao último dia quando necessário
(31/01 → 28/02 → 31/03). Centavos são distribuídos sem alterar o total. São
aceitas até 120 parcelas, cada uma com pelo menos um centavo; parcelamento
requer crédito. Dados e permissões são limitados ao usuário e organização.

Essa regra aplica-se aos novos gastos parcelados do atendimento conversacional.
Não reescreve compras antigas ou muda o comportamento de inclusão pelo site.
Os registros mensais são individuais no site; não há editor de série de compra
nesta entrega. Dizer pessoal permite sair explicitamente do contexto empresa.

## Verificação

177 testes passaram em oito suítes: conversa, cadastro, onboarding, ciclo de
conta, parser financeiro, comandos de agenda, datas e fluxo guiado. Cobertura
inclui opt-out sem criação de conta, ausência de menus na entrada pública,
confirmação, cancelamento, permissões, distribuição de centavos, meses e ano
bissexto. Build Nest concluído. Banco e WhatsApp simulados nos testes.
