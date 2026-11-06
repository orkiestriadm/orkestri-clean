# Aurélia IA 5.2.2 — migração do servidor — 05/11/2026

Publicação concluída às 22:39 (São Paulo). Código: `2042368`, branch
`claude/orkiestri-audit-benchmark-4a28b4`. API pública e Docker saudáveis.
Frontend 5.2.0 e website 3.17.0 não alterados. Localhost não atualizado.

## Infraestrutura e ativação

- IA ativa: `54.20.149.136`, Debian 12, 2 vCPU, 3715 MiB RAM, sem GPU.
- Ollama 0.40.14, modelo `qwen3:1.7b`, ID `8f68893c685c`, contexto 2048.
- Ollama restrito a localhost; novo túnel SSH de produção:
  `orkiestri-ia-v2-tunnel.service`, habilitado e ativo, endpoint Docker
  `http://172.18.0.1:11436`. Encaminhamento com chave técnica e host verificado.
- Servidor antigo `54.233.131.47` e túnel antigo na porta 11435 preservados.
- Evolution permanece no servidor de produção: nenhuma sessão foi transferida
  ou duplicada. A migração desta entrega é da inferência de IA.
- Limites do Ollama novo: MemoryHigh 2400M, MemoryMax 2800M, CPUQuota 180%,
  um modelo carregado e uma inferência por vez. Nenhuma nova instância criada.
- Ambiente da API: `AURELIA_IA_ENABLED=true`,
  `AURELIA_IA_URL=http://172.18.0.1:11436`,
  `AURELIA_IA_MODEL=qwen3:1.7b`, `AURELIA_IA_KEEP_ALIVE=-1h`.
  A unidade é necessária: a string `-1` causa HTTP 400 nesta versão do Ollama.
- Modelo pré-carregado; `ollama ps` confirmou retenção Forever. Após reinício
  do Ollama, a primeira carga ainda pode exceder o timeout e cair no fluxo guiado.
- Após ativação: 1573 MiB disponíveis, sem OOM ou OOM kill. Há eventos de
  MemoryHigh durante carga; não foi aumentado o limite além de 2800M.

## Comportamento e validação

- Qwen3 opera com `think:false`. Prompt restringe extração a dados fornecidos.
- Validação tolera diferenças de acentuação/caixa, recuperando o trecho original
  com limites de palavra. Continua recusando dados inventados ou convertidos.
- Horários por extenso com período explícito são convertidos deterministicamente:
  duas da tarde = 14:00; nove e meia da manhã = 09:30. Horário ambíguo é recusado.
- 66 testes passaram em 3 suítes; build Nest e Docker concluídos.
- Comparação sintética de oito frases com o mesmo prompt: ambos Qwen2.5 1.5B e
  Qwen3 1.7B produziram seis extrações aproveitáveis e duas rejeitadas. Não há
  evidência nesta amostra de superioridade geral do Qwen3. Ambos perderam
  qualificadores de alguns títulos (ex.: reunião com João virou reunião).
- Qwen3: primeiro pedido 18,01 s; demais 3,16–5,87 s. Qwen2.5: primeiro 12,05 s;
  demais 2,34–5,93 s. São medições pontuais, não teste de carga.
- Teste isolado da imagem através do túnel: três extrações válidas, 4,24–12,96 s,
  incluindo conversão de horários e preservação de campos ausentes.
- Inferência sintética dentro da API publicada: consulta sexta às duas da tarde
  extraída corretamente em 5,315 s. Nenhuma mensagem WhatsApp enviada e nenhum
  compromisso ou registro de cliente criado durante os testes.
- Qwen2.5 3B foi baixado para avaliação, mas não ativado nem usado pela aplicação:
  sua licença de pesquisa exige licença específica para uso comercial.
  Fonte: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE

## Escopo e limitações

Continua sendo extração inicial para criação de compromissos pessoais. Não é
agente geral nem substituição integral de menus. Consultas, exclusões e outros
módulos seguem os fluxos anteriores. Não houve troca do transcritor de áudio.
Confirmação explícita, permissões e isolamento por usuário continuam obrigatórios.
Respostas inválidas, timeout ou concorrência retornam ao fluxo guiado. Não foi
demonstrada capacidade de atender 5–10 inferências simultâneas.

## Deploy e reversão

- Imagem publicada: `orkestri/api:aurelia-5.2.2`, também `orkestri/api:latest`.
- Backup: `orkestri/api:rollback-before-aurelia-522` (API 5.2.1).
- Compose: `/opt/orkestri/docker-compose.prod.yml`; backup
  `docker-compose.prod.yml.bak-before-aurelia-522`.
- Composição preservada: `docker-compose.yml`, `docker-compose.prod.yml`,
  `website/deploy/docker-compose.website.yml`. Recriada somente `api`.
- Antes da ativação: zero diferenças em outras variáveis do ambiente da API.
  Migrations da imagem nova e anterior têm hash idêntico; nenhuma nova migration.
- `/api/health`: versão 5.2.2, status ok. API healthy. Evolution e demais serviços
  permaneceram ativos sem recriação neste deploy.
- Para reverter: restaurar o compose do backup, marcar a imagem de rollback
  como `orkestri/api:latest` e recriar somente `api` com os mesmos três arquivos,
  `up -d --no-deps --no-build api`. Isso restaura modelo antigo/porta 11435.
  Alternativamente desativar `AURELIA_IA_ENABLED` mantém o atendimento guiado.
- Chaves, tokens e arquivos de ambiente não foram incluídos no Git.
