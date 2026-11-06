# Aurélia IA — infraestrutura e primeira integração — 05/11/2026

## Escopo

Ollama instalado no novo servidor autorizado pelo proprietário, Debian 12, 2 vCPUs,
1941 MiB RAM, sem GPU. Modelo `qwen2.5:1.5b`, Q4_K_M (~986 MB), Ollama 0.40.14.
Evolution permanece no servidor atual. Nenhuma sessão de WhatsApp foi duplicada.

A primeira integração é **extração de dados para criar compromissos pessoais**.
Não é um agente geral: consultas, exclusões, reagendamentos e demais módulos mantêm
os fluxos existentes. Usuários novos continuam pelo cadastro atual. Todos os
usuários identificados ficam elegíveis quando a configuração está ativada; as
permissões de agenda continuam obrigatórias.

## Rede e operação

- IA: `54.233.131.47`, IP interno `172.26.4.127`. Produção: alias SSH `orkestri-prod`.
- Ollama escuta somente `127.0.0.1:11434` no servidor de IA.
- Produção usa `orkiestri-ia-tunnel.service`, SSH com chave técnica exclusiva,
  verificação da chave do host e reconexão automática.
- Endpoint para a API em Docker: `http://172.18.0.1:11435`; para diagnóstico no host:
  `http://127.0.0.1:11435/api/version`.
- O bind Docker depende da ponte atual `172.18.0.1`; revisar ao recriar a rede.
- Conta `orkiestri-tunnel`: chave limitada a encaminhar para `127.0.0.1:11434`,
  sem execução de comandos, sem TTY e sem encaminhamento remoto.
- O túnel usa o IP público com criptografia SSH; não foi criada VPC peering.
- Chaves privadas ficam fora do Git. Não copiar a chave pessoal para produção.

No servidor IA, `/etc/systemd/system/ollama.service.d/orkiestri.conf` define:
`OLLAMA_NUM_PARALLEL=1`, `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_MAX_QUEUE=4`,
`OLLAMA_CONTEXT_LENGTH=2048`, `OLLAMA_KEEP_ALIVE=5m`, `MemoryHigh=1400M`,
`MemoryMax=1650M`, `CPUQuota=180%`. Não foi adicionada swap nem criada outra
instância cobrável.

## Proteções e experiência

- Modelo não recebe credenciais, banco de dados nem lista de outros usuários.
- Apenas texto de um pedido candidato a agendamento (até 1000 caracteres).
- Cada campo extraído precisa ser uma substring literal da mensagem; dados
  inventados, campos extras ou respostas inválidas são rejeitados.
- Datas/horários são calculados/validados pelo backend no fuso de São Paulo.
- Dados ausentes viram perguntas, nunca defaults do modelo.
- Persistência usa os rascunhos existentes, escopo usuário/instância/conversa,
  transação e lock. A inferência ocorre fora da transação, com revalidação do
  estado antes de aplicar a proposta.
- Confirmação explícita obrigatória; permissões reavaliadas ao gravar.
- Reutiliza o writeback Google/Outlook existente após gravar.
- Uma inferência por vez por processo; chamadas concorrentes seguem o fluxo
  existente em vez de esperar. Timeout 20 s; pausa de 60 s após três erros.
- Logs novos registram latência/validade, sem texto da conversa.
- Menu explícito continua disponível. Cadastro, cobrança e fluxos em andamento
  não são substituídos pelo modelo.

## Configuração do backend

`AURELIA_IA_ENABLED=true`, `AURELIA_IA_URL=http://172.18.0.1:11435`,
`AURELIA_IA_MODEL=qwen2.5:1.5b`. Sem configuração, fica desligado.
Injetar no serviço `api` do compose remoto, preservando TLS e demais diferenças
documentadas em `OPERACAO-SERVIDOR.md`.

## Evidências

- Consulta `/api/version` realizada de dentro de `orkestri_api` através do túnel.
- Testes sintéticos iniciais mostraram datas inventadas; essa abordagem foi
  rejeitada. A extração restrita rejeita essas saídas em vez de executar ações.
- Com esquema restrito: exemplos simples ~3–12 s; frases ambíguas ainda falham.
- Testes locais: 5 suítes, 99 testes passando, incluindo permissões, confirmação,
  cancelamento, isolamento dos registros, indisponibilidade e fluxo legado.
- Build Nest e Docker passaram. Publicação concluída em 05/11/2026 às 22:03 (São Paulo).
- Não foram disparadas mensagens reais nem criados compromissos de clientes
  durante a validação técnica.

## Rollback

Definir `AURELIA_IA_ENABLED=false` no ambiente efetivo do serviço `api` e recriar
somente a API. O atendimento anterior continua operante. Para retornar o código,
usar a imagem de backup registrada na publicação. Sem migration nova.
O túnel e o Ollama podem ser parados separadamente sem modificar Evolution.

## Limites

Não apresentar este release como conversa livre completa. A máquina atende uma
inferência por vez; um teste curto não determina a capacidade contínua para todos
os clientes. Frases não compreendidas usam o fluxo existente. Não prometer latência
fixa ou atendimento simultâneo de 5–10 conversas com IA.

## Publicação concluída

- API em produção: **5.2.1**, commit de implementação **8b13117**.
- Imagem: `orkestri/api:aurelia-5.2.1`, também marcada `orkestri/api:latest`.
- Rollback preservado: `orkestri/api:rollback-before-aurelia-521`.
- Configuração aplicada em `/opt/orkestri/docker-compose.prod.yml`; backup:
  `docker-compose.prod.yml.bak-before-aurelia-521`.
- Composição efetiva preservada: `docker-compose.yml`, `docker-compose.prod.yml`,
  `website/deploy/docker-compose.website.yml`. Recriada somente a API.
- `/api/health` público retornou `status=ok`, `version=5.2.1`; Docker: `healthy`.
- Dentro da API em execução: `IA_ENABLED=true`; pedido fictício de dentista amanhã
  às 14h por uma hora retornou os campos corretos em **17,3 s** (incluindo carga do modelo).
- Cinco requisições sintéticas curtas ao Ollama concluíram entre 8,2 e 11,0 s.
  Não equivalem a cinco conversas completas; backend continua com uma inferência por vez.
- Migrations da imagem anterior e nova têm hash agregado idêntico; sem mudança de schema.
- Evolution, frontend, website e demais serviços não foram recriados.
- Localhost não foi atualizado nesta publicação: última API local registrada 5.2.0.
- Não houve teste de ponta a ponta com número real nem gravação de compromisso real.

## Avaliação Qwen3 1.7B — 05/11/2026

A pedido do usuário, baixado `qwen3:1.7b` e testado pelo túnel com o mesmo prompt,
esquema e validação da Aurélia, sempre com `think=false` e mensagens fictícias.
- Contexto 2048: timeout após 45,0 s sem resposta utilizável.
- Contexto 1024, num_batch 32, saída limitada a 120 tokens: timeout após 25,0 s.
- Durante o primeiro teste: 1793/1941 MiB de RAM usados, 148 MiB disponíveis, sem swap.
- Resultado: reprovado para ativação nesta máquina com prazo de resposta de 20 s.
- Configuração de produção permaneceu `qwen2.5:1.5b`; nenhuma troca de modelo ou
  deploy da API foi aplicado. Ollama reiniciado para descarregar a inferência em teste.
- Qwen3 permanece baixado para avaliação futura com mais recursos. Não carregar
  automaticamente ou substituir a produção sem nova avaliação.
