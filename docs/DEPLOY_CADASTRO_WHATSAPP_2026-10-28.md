# Publicação do cadastro WhatsApp — 28/10/2026

Publicação expressamente autorizada pelo usuário e concluída em **28/10/2026, 15:30:11 (America/Sao_Paulo)**. Código publicado: `9d15275a44e5ac8402f06fcd24eb1d61299b2a70`.

A API usa a pergunta: “Qual é o nome da sua empresa ou organização? Se não tiver empresa, informe seu nome completo. Esse nome aparecerá na sua organização.”. A escolha antiga entre uso pessoal e empresa não está presente no arquivo compilado ativo. O telefone continua vindo da conversa.

## Evidências

- 104 testes da correção aprovados anteriormente: 26 com PostgreSQL descartável local e 78 de regressão.
- Build completo da API aprovado localmente com TypeScript 5.9.3. A configuração separa os testes de integração e mantém a entrada em dist/main.js; o Dockerfile inclui essa configuração.
- Módulos compilados testados antes da troca em container candidato com rede desativada.
- Quatro hashes de runtime e nove arquivos de código/configuração/testes/documentação verificados contra o pacote do Git.
- API saudável após a troca; três rotas públicas responderam com sucesso.
- Frontend, site, nginx, PostgreSQL, Redis, Evolution e media-worker mantiveram seus containers. Nginx recebeu apenas reload para atualizar a resolução da API.
- Nenhuma migration foi executada. O comando da nova imagem inicia diretamente node dist/main.

A imagem anterior foi preservada em `orkestri/api:rollback-cadastro-9d15275-20261028`. Fontes anteriores, manifesto e procedimento de retorno estão na pasta de release do servidor `/opt/orkestri/releases/cadastro-9d15275-20261028`. O procedimento restauraria imagem e fontes se a validação da troca falhasse; não foi necessário utilizá-lo.

## Referência para o próximo trabalho

Usar `origin/codex/fix-whatsapp-signup-flow` enquanto o PR #16 estiver aberto. A pasta compartilhada local está nessa branch. A main permanece intacta conforme a proteção solicitada; não houve merge automático. O registro JSON deste release contém hashes, identidade da imagem e resultado das verificações, sem credenciais ou dados do cadastro do usuário.

O teste acompanhado no WhatsApp aconteceu antes desta publicação. Depois da troca, a pergunta foi conferida no módulo compilado da API ativa, sem apagar a conta criada, abrir outra conta ou enviar novas mensagens ao usuário. A ocorrência inicial de conversa expirada foi observada no teste anterior e não foi alterada neste release.
