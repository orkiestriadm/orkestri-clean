# Cadastro único pelo WhatsApp — correção e testes

Estado: 28/10/2026. Alteração preparada na branch `codex/fix-whatsapp-signup-flow`, a partir da base compartilhada `df9f908`. Não houve deploy, escrita em produção ou envio de mensagem real.

## Problema reproduzido

A opção antiga “Só para mim” gravava `empresa` vazia. Na confirmação, a transação exigia esse campo e devolvia a mensagem “Não consegui concluir seu cadastro agora”. O teste de criação da conta que já existia substituía a função de transação por um mock, então não exercitava a validação que falhava.

Foi criada uma suite que percorre o webhook, as etapas da conversa, a transação PostgreSQL real, criação da organização/usuário/permissões/perfil e a fila de boas-vindas. Apenas o transporte de saída do WhatsApp é simulado. A falha do caminho antigo foi reproduzida antes da correção.

## Fluxo final

1. Nome completo.
2. CPF válido.
3. E-mail válido e ainda não usado.
4. Nome da empresa ou organização, obrigatório. Se a pessoa não tiver empresa, ela informa o próprio nome completo nesse campo.
5. Resumo com nome, CPF, e-mail e organização; confirmar ou corrigir.

Não há escolha entre sistema pessoal e sistema de empresa. O nome informado no quarto passo é gravado em `Organization.nome`. O telefone/WhatsApp vem da conversa, inclusive quando o provedor usa LID com telefone alternativo; não é solicitado ao usuário.

Na transação final, nome, CPF, WhatsApp, e-mail e organização não podem estar vazios nem conter somente espaços. O WhatsApp continua validado e identificado pela entrada da conversa. Nenhuma conta/organização parcial é mantida quando a transação falha.

## Conversas já iniciadas

- Confirmação antiga de uso pessoal com empresa vazia: o nome já informado é materializado no campo da organização antes de criar a conta e persistido nas respostas. A antiga opção não volta ao menu.
- Confirmação sem nome de organização e sem a escolha pessoal antiga: solicita preencher o campo obrigatório, preservando os demais dados.
- Etapas antigas EMPRESA e EMPRESA_NOME aceitam o nome diretamente, sem menu de tipos. Respostas numéricas 1/2 não viram nome de organização.
- O menu de correção mantém quatro campos; a opção 4 corrige o nome da organização.
- Falha na entrega de boas-vindas não desfaz uma conta criada; a fila permite reentregar. Falha dentro da transação reverte tudo e permite tentar novamente sem duplicar a conta.

## Validação

- 26 testes de integração passaram usando PostgreSQL 16 descartável local, com schema do projeto e a transação real.
- 78 testes de regressão existentes passaram, em cinco suites de mensagens, cadastro, fluxo guiado, gastos e renovação simulada.
- Total: 104 testes aprovados. Esses resultados não equivalem a um teste com a conexão real da Evolution API ou entrega em telefone real.
- Nenhum serviço local existente foi reiniciado ou substituído. Os containers de banco criados exclusivamente para o ensaio foram removidos.

Para repetir a integração, com dependências instaladas, Docker local e a imagem `postgres:16-alpine` disponível:

```text
cd backend
npm run test:signup
```

O comando recusa um endpoint Docker remoto, cria um container com nome e label únicos, publica somente em 127.0.0.1 e porta aleatória, prepara exclusivamente o banco `codex_signup_audit`, executa os testes e remove o próprio container. Não lê a DATABASE_URL do ambiente como destino e não regenera o cliente Prisma compartilhado.

A produção continuará com o comportamento anterior até uma publicação expressamente autorizada. Não executar deploy como consequência do push ou da criação do PR.
