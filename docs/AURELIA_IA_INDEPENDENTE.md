# Aurélia independente — primeira etapa

Esta etapa prepara a evolução da Aurélia sem alterar operações que já funcionam.

## Modo sombra

Quando `AURELIA_IA_SHADOW=true`, a API chama o modelo para medir a interpretação,
mas ignora o resultado da IA. A resposta continua vindo do fluxo determinístico
atual. Assim podemos medir entendimento e latência sem criar agenda, gastos ou
parcelas por causa de uma inferência experimental.

## Próximas etapas

1. Registrar exemplos anonimizados de correções e confirmações.
2. Criar memória explícita por usuário, com retenção e exclusão controladas.
3. Expor ferramentas autorizadas para agenda e gastos.
4. Avaliar mensagens reais anonimizadas antes de ativar novas respostas.

Nenhuma etapa de aprendizado automático altera os pesos do modelo. A ativação
continua protegida por flags e pode ser revertida.
