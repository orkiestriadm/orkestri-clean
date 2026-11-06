# Aurélia independente — seis etapas

Esta etapa prepara a evolução da Aurélia sem alterar operações que já funcionam.

## Modo sombra

Quando `AURELIA_IA_SHADOW=true`, a API chama o modelo para medir a interpretação,
mas ignora o resultado da IA. A resposta continua vindo do fluxo determinístico
atual. Assim podemos medir entendimento e latência sem criar agenda, gastos ou
parcelas por causa de uma inferência experimental.

## Etapas implementadas

1. **Modo sombra:** o modelo interpreta, mas não executa operações.
2. **Privacidade:** exemplos e memórias passam por anonimização antes do armazenamento.
3. **Coleta controlada:** interpretações experimentais ficam pendentes para revisão.
4. **Memória explícita:** somente fatos salvos com consentimento, chave por usuário e validade opcional são reutilizados.
5. **Ferramentas seguras:** agenda e gastos continuam atrás das portas determinísticas, permissões e confirmação explícita.
6. **Ativação gradual:** `AURELIA_IA_ROLLOUT_PERCENT` permite ativar por percentual determinístico; falhas retornam ao fluxo atual.

Nenhuma etapa de aprendizado automático altera os pesos do modelo. A ativação
continua protegida por flags e pode ser revertida.
