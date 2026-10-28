# Sincronização entre IAs sem alterar produção

Estado em 28/10/2026. Repositório: https://github.com/orkiestriadm/orkestri-clean

## Qual versão usar

A main remota em 3859c35e2502907a4346f60c77b9eba5325ba84d recebeu o resgate de fontes de produção nos PRs 12 e 13. Isso descreve o histórico Git consultado; esta tarefa não acessou o servidor para atestar equivalência com o processo em execução.

A pasta local C:/orkestri-clean estava na branch localhost/hub-1.49.2, baseada em 2f1618954000c4e29b9c875b52b311c42839dcdd. Ela pertence à linha Hub e difere substancialmente da main. As cópias apps/orkiestri-one e work/whatsapp-entry-20261027 são fontes de entregas anteriores; não sobrescrever a main com essas árvores.

Para continuar o sistema da main, começar pela branch codex/sync-20261028/coordination enquanto seu PR estiver aberto; após a integração revisada desse PR, usar main atualizada. Para retomar uma alteração específica ainda não integrada, consultar a branch de preservação no inventário e criar uma branch própria a partir da base apropriada.

## Rotina

1. Ler AGENTS.md, este documento e o inventário.
2. Conferir git status e a branch atual; preservar pendências.
3. Executar git fetch origin. Em uma árvore limpa da branch correta, atualizar com git pull --ff-only.
4. Criar uma branch de trabalho. Para trabalhar em paralelo, usar uma pasta separada.
5. Implementar, validar localmente, revisar arquivos e salvar commits.
6. Fazer push da branch e abrir PR em rascunho quando necessário. Não habilitar auto-merge.
7. Registrar branch, SHA, testes, decisões e pendências para a próxima IA.

## Produção

Nenhum deploy é autorizado por esta sincronização. Não executar scripts de deploy/activate/stage, comandos remotos de escrita, migrations, seeds ou testes contra produção. Push, PR e deploy são operações diferentes. Uma futura integração deve conferir novamente se há automações externas antes de modificar main.

Na auditoria local não foram encontrados workflows em .github na main consultada nem hooks Git ativos nesta pasta. Os scripts de deploy consultados exigem execução separada. Isso não comprova ausência de integrações externas configuradas fora do repositório.

## O que acompanha o Git

Código, migrations como arquivos, documentação técnica e branches publicadas. Banco, arquivos de clientes, credenciais, configuração dos servidores e histórico dos chats permanecem separados. Caches e builds são regenerados. Documentos internos e binários não revisados permanecem locais e constam como excluídos no inventário local.

## Limites das cópias preservadas

As branches de preservação guardam versões divergentes e não são aprovadas para deploy. Não houve tentativa de juntar todos os recursos antigos em uma única versão: isso poderia desfazer correções e misturar produtos diferentes. A integração funcional precisa selecionar diferenças contra a base correta e validar seu comportamento.
