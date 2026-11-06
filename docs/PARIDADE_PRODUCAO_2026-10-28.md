# Paridade com a produção em 28/10/2026

## Resultado

Foi feita uma consulta de leitura no servidor de produção, sem deploy, migrations, seeds, escrita de arquivos, alterações de configuração ou reinício de containers. A referência aprovada para preservação foi o sistema já em execução.

- API em execução: 4.3.0, conferida no arquivo compilado dentro do container.
- Frontend: fonte 4.3.0; build ativo `2SGTR_mnp-EB9i4I6epsB`.
- Site: fonte 3.3.2; build ativo `m19iR3-F4i5NzsX5YkXoL`.
- Foram auditados 530 arquivos de código, migrations como arquivos, dependências declaradas, configuração de build e assets estáticos. CRLF foi normalizado para LF.
- Contra a main em 3859c35, 464 arquivos eram iguais, 55 diferentes e 11 faltavam. Não havia arquivos extras no escopo auditado da main.
- Os 66 arquivos divergentes foram copiados do servidor para a base compartilhada. Nenhum arquivo foi enviado ao servidor.
- A verificação offline confirmou os 530 hashes na base compartilhada, sem diferenças.

O manifesto completo está em `baselines/production-20261028.json`. Para verificar a cópia local:

```text
node scripts/verify-source-baseline.cjs
```

O comando só lê arquivos e executa o inventário Git local. Não acessa rede nem produção. Depois de uma nova tarefa, diferenças são esperadas; documentá-las e revisá-las, sem alterar o manifesto para esconder mudanças.

## Comparação com o Claude

As pastas do Claude também foram comparadas pelos mesmos caminhos e hashes. A mais próxima, `mercadopago-orkiestri-integration-783283`, tinha 486 arquivos iguais, 38 diferentes e seis ausentes. O site mais recente estava em outra pasta. Nenhuma dessas pastas, isoladamente, continha os 530 arquivos corretos.

A versão compartilhada foi por isso montada a partir dos fontes de produção, mantendo as pastas antigas e suas alterações. As branches históricas continuam disponíveis para consulta; não devem ser a base de novas alterações da versão atual.

## Como continuar

Enquanto o PR #15 estiver aberto, Codex e Claude devem partir de `origin/codex/sync-20261028/coordination`. Esta é a mesma branch usada nesta pasta de trabalho e publicada no GitHub. A main fica intacta nesta tarefa, conforme a proteção solicitada.

Nesta máquina, a pasta limpa da base compartilhada é `C:/Users/guilherme.luis/.codex/worktrees/production-baseline/orkestri-clean`. Abrir essa pasta no Claude para trabalhar na mesma base. Trabalhos simultâneos devem criar branches e pastas de tarefa a partir da mesma referência, preservando mudanças em andamento.

`AGENTS.md` e `CLAUDE.md` contêm o mesmo fluxo: conferir status, buscar atualizações, escolher a base correta, criar branch de tarefa, validar localmente, salvar commits, enviar a branch e documentar o SHA. Deploy continua sendo uma operação separada, com autorização expressa.

## Limites

O Git HEAD registrado no servidor era 304e458, mas os fontes não correspondiam apenas a esse commit. Por isso a comparação usou conteúdo, não apenas números de versão ou o HEAD do servidor.

Os 530 hashes demonstram paridade dos arquivos-fonte auditados no disco do servidor. A versão compilada da API e os identificadores dos builds foram lidos separadamente; isso não é uma prova byte a byte de que cada bundle foi construído desses fontes. Banco, credenciais, uploads, volumes, nginx e configurações específicas do ambiente não foram copiados para o repositório público.

## Validação local desta base

Sete suites Jest com mocks passaram, totalizando 97 testes: painel-billing, estado-checkout, porta-unica, conta-nasce-no-ciclo, lead-onboarding, prospects e whatsapp-entrada. Foram usadas dependências locais já instaladas; não houve instalação, chamada de negócio para produção ou acesso a banco real. A verificação de hashes passou nos 530 arquivos; um ensaio com um hash esperado propositalmente corrompido foi rejeitado corretamente, sem alterar os fontes.

As instruções locais AGENTS.md e CLAUDE.md das 32 pastas históricas sob C:/orkestri-clean receberam avisos apontando para a base atual. O código e as alterações dessas pastas não foram apagados ou substituídos. As conversas já abertas no Claude não foram controladas nem receberam mensagens; abrir a pasta compartilhada e iniciar a próxima tarefa pela referência indicada evita continuar de uma árvore antiga.

Na conferência final de leitura em 28/10/2026, os 530 fontes continuavam com os mesmos hashes. IDs, imagens e horários de início dos containers de API, frontend, site e media-worker também continuavam iguais aos do começo da auditoria. Esta tarefa não substituiu ou reiniciou esses serviços.
