# Publicação do site e correção do login — 28/10/2026

Publicação expressamente autorizada pelo usuário e concluída em **28/10/2026, 22:17:47 (America/Sao_Paulo)**. Código publicado: **b790e15392d003a1b8f812f7e27c7c0c965d825a**, branch **codex/site-real-dark-captures**, PR #18: https://github.com/orkiestriadm/orkestri-clean/pull/18.

## Resultado

O frontend passa a recuperar a sessão expirada enviando CSRF na limpeza do cookie e abrindo o formulário mesmo se essa limpeza falhar. O site apresenta cinco capturas reais do sistema em modo escuro e três recortes reais do teste no WhatsApp. Os cartões de Gastos também respeitam o tema. Os dados das telas são fictícios; dados cadastrais, contatos e identificadores internos ficaram fora dos prints públicos. Ver o inventário em SITE_CAPTURAS_REAIS_E_LOGIN_2026-10-28.md.

## Validação

- Os 250 arquivos do frontend/site coincidiram com a base auditada antes da publicação; não havia alteração concorrente nesses fontes.
- Builds Linux concluídos para os dois apps, incluindo empacotamento standalone. Dependências e configurações públicas de marca preservadas. As imagens foram construídas localmente para evitar carga de compilação na produção.
- Candidatos executados sem rede: rotas normais/protegidas, sessão inválida e recuperação do login; verificação do código compilado; oito assets com hashes; otimizador de imagem respondendo corretamente.
- Arquivo transferido conferido por SHA-256 e imagens importadas conferidas pelo manifesto Linux amd64 exportado.
- Nove verificações de rotas públicas, oito hashes de assets e otimizador aprovados após a troca. Acesso ao site e botão Entrar conferidos no navegador oficial.
- Somente frontend e website substituídos. As configurações Compose específicas de cada serviço foram preservadas, inclusive o tmpfs de cache de imagens do site.
- Nginx recebeu reload para atualizar upstreams; seu container permaneceu igual. API, PostgreSQL, Redis, Evolution e media-worker também mantiveram seus containers; API saudável.
- Nenhuma migration, seed, alteração de conta real ou envio de mensagens foi executado nesta publicação.
- Avisos de referência atualizados em 64 arquivos AGENTS/CLAUDE de 32 pastas históricas locais, preservando o restante das instruções e o código dessas pastas.

## Imagens e retorno

| Serviço | Imagem ativa | Tag anterior preservada |
|---|---|---|
| Frontend | sha256:9cb52e71879843065d9d1ed234fd14aaea1943f3a12e640f2c9d5f63530336fd | orkestri/frontend:rollback-web-b790e15-20261028 |
| Site | sha256:42c0723f721390d829193c11407bebdd3f1d2cc102e6ed490e54faa4f40fb864 | orkestri/website:rollback-web-b790e15-20261028 |

Artefatos, backup de fontes e relatórios privados ficam em /opt/orkestri/releases/web-b790e15-20261028. A validação de preparação interrompeu antes da troca ao encontrar a diferença entre o índice OCI local e o manifesto da plataforma no servidor; o identificador correto foi obtido do arquivo exportado e validado antes de ativar. A tentativa inicial de cópia sem privilégios foi interrompida por permissão; os serviços continuaram nas imagens anteriores até a ativação com os privilégios necessários. Nenhum rollback de runtime foi necessário.

A referência compartilhada passa a origin/codex/site-real-dark-captures enquanto o PR #18 estiver aberto. Main continua intacta, sem merge automático. Esta autorização não autoriza futuras publicações.
