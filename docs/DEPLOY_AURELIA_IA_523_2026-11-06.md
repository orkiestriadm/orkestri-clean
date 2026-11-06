# Deploy Aurélia — API 5.2.3

Concluído em 06/11/2026 às 06:15 (São Paulo), autorizado pelo usuário.
Código: `1cd75fd`; inclui todas as alterações pendentes `541c554` e `2ea3ad4`.
Branch: `claude/orkiestri-audit-benchmark-4a28b4`.

## Publicado

- Comandos Aurélia/Aurélio, anota aí pra mim, formas formais/informais.
- Texto e transcrição usam o mesmo reconhecimento determinístico.
- Datas e horários por extenso, esclarecimento de períodos ambíguos.
- Preservação do título, correção e cancelamento do rascunho.
- Confirmação explícita antes de gravar; pedidos múltiplos reconhecidos pedem
  envio individual, sem criar fila automática ou misturar compromissos.
- Base JSON com 24 exemplos, 145 testes passando e build Docker concluído.
- Não altera pesos do Qwen3 nem transcritor; não é um agente geral para todos
  os módulos. Frontend 5.2.0 e website 3.17.0 permanecem nas versões atuais.

## Verificação

- Imagem: `orkestri/api:aurelia-5.2.3`, também marcada `orkestri/api:latest`.
- Migrations idênticas às da imagem anterior; nenhuma migration nova.
- Testes sintéticos dentro da imagem confirmaram táxi amanhã às 12, data por
  extenso com 15h30 e esclarecimento de duas horas para duas da tarde.
- Zero diferenças nas variáveis do compose versus o container anterior.
- Recriada somente a API com os três arquivos efetivos:
  `docker-compose.yml`, `docker-compose.prod.yml`,
  `website/deploy/docker-compose.website.yml` em `/opt/orkestri`.
- Durante inicialização houve uma resposta HTTP 502; após inicializar,
  `/api/health` retornou status ok e versão 5.2.3, container healthy.
- Ollama acessível pela API no túnel 11436, modelo qwen3:1.7b mantido.
- Evolution e demais serviços não foram recriados. Não foram enviados
  WhatsApps reais nem criados compromissos de clientes durante os testes.
- Localhost não atualizado (não solicitado); última API local registrada 5.2.0.

## Reversão

Imagem preservada: `orkestri/api:rollback-before-aurelia-523` (API 5.2.2).
Backup do compose: `/opt/orkestri/docker-compose.prod.yml.bak-before-aurelia-523`.
Nenhuma variável foi alterada. Para reverter, marcar a imagem de rollback como
`orkestri/api:latest` e executar `up -d --no-deps --no-build api` com os mesmos
três arquivos de composição. Não remover sessões do Evolution ou volumes.
