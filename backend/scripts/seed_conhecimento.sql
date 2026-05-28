-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Base de Conhecimento Orkiestri — Default org
-- Idempotente: usa ON CONFLICT DO NOTHING. Pode rodar quantas vezes quiser.
-- ─────────────────────────────────────────────────────────────────────────────

\set ORG_ID '00000000-0000-0000-0000-000000000001'

-- Autor: primeiro usuário Master da Default (fallback: qualquer user da org)
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_org_id      TEXT := '00000000-0000-0000-0000-000000000001';
  v_autor_id    TEXT;
  v_cat_op      TEXT;
  v_cat_fin     TEXT;
  v_cat_pes     TEXT;
  v_cat_com     TEXT;
  v_cat_cfg     TEXT;
BEGIN
  -- Resolve autor: master da Default; fallback = qualquer user da Default
  SELECT id INTO v_autor_id FROM users
    WHERE organization_id = v_org_id AND nome ILIKE '%Guilherme%'
    LIMIT 1;
  IF v_autor_id IS NULL THEN
    SELECT id INTO v_autor_id FROM users WHERE organization_id = v_org_id LIMIT 1;
  END IF;
  IF v_autor_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuario na org %', v_org_id;
  END IF;

  -- ── Categorias (idempotentes via UNIQUE org+nome) ─────────────────────────
  INSERT INTO categorias_conhecimento (id, organization_id, nome, descricao, icone, cor, ordem, ativo, criado_em)
  VALUES
    (gen_random_uuid()::text, v_org_id, 'Operacoes',     'Chamados, projetos, apontamentos',  'briefcase', '#60a5fa', 1, true, NOW()),
    (gen_random_uuid()::text, v_org_id, 'Financeiro',    'Orcamento, aprovacoes, faturas',     'dollar',    '#34d399', 2, true, NOW()),
    (gen_random_uuid()::text, v_org_id, 'Pessoas',       'Workforce, capacidade, skills',      'users',     '#f59e0b', 3, true, NOW()),
    (gen_random_uuid()::text, v_org_id, 'Comercial',     'Clientes, CRM, propostas',           'building',  '#a78bfa', 4, true, NOW()),
    (gen_random_uuid()::text, v_org_id, 'Configuracoes', 'Permissoes, integracoes, sistema',   'settings',  '#94a3b8', 5, true, NOW())
  ON CONFLICT (organization_id, nome) DO NOTHING;

  SELECT id INTO v_cat_op  FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Operacoes';
  SELECT id INTO v_cat_fin FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Financeiro';
  SELECT id INTO v_cat_pes FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Pessoas';
  SELECT id INTO v_cat_com FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Comercial';
  SELECT id INTO v_cat_cfg FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Configuracoes';

  -- ── Artigos (idempotentes via UNIQUE org+slug) ────────────────────────────

  -- 1. Criação de Orçamento
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Como criar um orcamento anual',
    'como-criar-um-orcamento-anual',
    'Passo a passo completo para criar um ciclo orcamentario, cadastrar itens e lancar valores realizados.',
    $md$
# Como criar um orcamento anual no Orkiestri

O modulo **Orcamento** organiza o planejamento financeiro em **ciclos anuais**. Cada ciclo agrupa **itens de orcamento** distribuidos em **categorias** (ex.: TI, Marketing, Pessoal) com valores previstos **mes a mes**. Conforme os valores realizados sao lancados, o sistema acompanha a execucao e dispara aprovacao automatica em caso de estouro.

## 1. Pre-requisitos

- Permissao `orcamento:criar` (Master ou perfil financeiro)
- Categorias de orcamento ja cadastradas (Configuracoes -> Orcamento -> Categorias)
- Centros de custo opcionais para segmentar (Cadastros -> Centros de Custo)

## 2. Criar o ciclo

1. Acesse **Operacoes -> Orcamento**
2. No topo direito, clique no seletor de ano e selecione **+ Novo ciclo**
3. Preencha:
   - **Ano** (ex.: 2026)
   - **Descricao** (opcional)
4. Status inicial: `rascunho` — voce ainda pode editar livremente
5. Clique em **Criar**

## 3. Cadastrar itens

Cada item representa uma linha do orcamento (ex.: "Licenca Slack", "Salarios TI").

1. Na aba **OPEX** ou **CAPEX**, clique **+ Novo item**
2. Preencha:
   - **Nome** (obrigatorio)
   - **Categoria** (obrigatoria)
   - **Tipo**: OPEX (despesa recorrente) ou CAPEX (investimento)
   - **Centro de custo** (opcional)
   - **Fornecedor** (opcional)
   - **Recorrente**: marca despesas que se repetem todo mes
   - **Periodicidade**: mensal, trimestral, anual
3. **Distribua os 12 meses** — pode digitar mes a mes ou usar o botao **Replicar** (copia o valor de janeiro para todos)

> Dica: se voce marcar **Recorrente**, o sistema sugere automaticamente a mesma distribuicao no proximo ciclo.

## 4. Aprovar o ciclo

1. Depois de cadastrar todos os itens, mude o status de `rascunho` para `aprovado` na aba **Configuracoes**
2. **Apenas Masters e perfis com `orcamento:aprovar`** podem aprovar
3. A partir de **aprovado**, o ciclo entra em producao — qualquer alteracao gera **timeline** para auditoria

## 5. Lancar valores realizados

Conforme as despesas acontecem, lance o que foi efetivamente gasto em cada mes:

1. Abra o item desejado
2. Clique no mes (ex.: **Marco**)
3. Informe:
   - **Valor realizado**
   - **Observacoes** (NF, link de comprovante, etc.)
4. Clique em **Lancar**

O sistema calcula automaticamente:
- **Execucao %** = realizado / previsto
- **Saldo** = previsto - realizado
- **Status do mes**: ok / alerta (> 80%) / estouro (> 100%)

## 6. Estouro e aprovacao automatica

Se o realizado **passar de 100%** do previsto:

1. O sistema cria uma **aprovacao pendente** na aba **Aprovacoes**
2. Notifica os gestores com permissao `orcamento:aprovar`
3. O lancamento fica **bloqueado** ate ser resolvido (aprovado ou rejeitado)

Veja o artigo **"Aprovacao de estouro de orcamento"** para o fluxo completo.

## 7. Acompanhamento

- **Dashboard**: visao macro com cards de previsto vs. realizado, top categorias, estouros
- **OPEX / CAPEX**: detalhe por linha
- **Aprovacoes**: pendencias do mes
- **Configuracoes**: gestao de ciclos, categorias, centros

## Permissoes envolvidas

| Permissao              | O que libera                                     |
|------------------------|--------------------------------------------------|
| `orcamento:ver`        | Visualizar dashboard e itens                     |
| `orcamento:criar`      | Cadastrar ciclos e itens                         |
| `orcamento:editar`     | Editar itens e lancar valores                    |
| `orcamento:aprovar`    | Aprovar ciclo e resolver estouros                |
| `orcamento:deletar`    | Remover itens e ciclos                           |

## Erros comuns

- **"Estouro de X%"** — espere o gestor aprovar ou ajuste o previsto
- **"Categoria nao encontrada"** — cadastre antes em Configuracoes -> Orcamento -> Categorias
- **"Sem permissao"** — solicite ao Master o papel financeiro
$md$,
    'publicado', v_cat_fin, ARRAY['orcamento','financeiro','procedimento','tutorial'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 2. Abertura e gestão de chamados (fila pública)
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Chamados: fila publica, atribuicao individual e SLA',
    'chamados-fila-publica-atribuicao-sla',
    'Como funciona o modelo hibrido de chamados — fila publica, botao Assumir, transferencias e SLA.',
    $md$
# Chamados: modelo hibrido (fila publica + atribuicao individual)

O modulo **Chamados** funciona como um helpdesk estilo **Jira Service Management** / Zendesk. Tem dois mundos:

1. **Fila Publica** — chamados abertos sem atendente; qualquer usuario com permissao pode visualizar e **assumir**
2. **Meus Chamados** — depois de assumir (ou ser atribuido), o chamado some da fila publica e aparece apenas no painel do responsavel + gestores

## 1. Abrir um chamado

1. Acesse **Operacoes -> Chamados**
2. Clique em **+ Novo Chamado**
3. Preencha:
   - **Titulo** (obrigatorio)
   - **Descricao** (obrigatoria)
   - **Prioridade**: baixa / media / alta / critica
   - **Categoria** (opcional)
   - **Cliente** (opcional, se for atendimento externo)
4. Salve

O sistema:
- Gera um **numero sequencial** (#1, #2, ...)
- Calcula o **SLA** automatico conforme prioridade (baixa=72h, media=24h, alta=8h, critica=2h)
- Notifica o solicitante por **WhatsApp** e **e-mail**

> Dica: a base de conhecimento sugere artigos relacionados enquanto voce digita o titulo. Linkar um artigo no chamado reduz o tempo de resolucao.

## 2. Trabalhar com a fila publica

Na tela de chamados, ha 3 abas no topo:

| Aba              | O que mostra                                            |
|------------------|---------------------------------------------------------|
| **Meus**         | Chamados onde voce e solicitante ou atendente           |
| **Fila Publica** | Abertos sem atendente — qualquer um pode pegar          |
| **Todos**        | (Apenas Master) — todos os chamados do tenant            |

Cards da fila publica ganham **borda violeta** + badge **"Fila"** + botao **"Assumir Chamado"** inline.

## 3. Assumir um chamado

1. Na aba **Fila Publica**, clique em **Assumir Chamado** no card OU
2. Abra o chamado e clique em **Assumir Chamado** no banner roxo

O backend faz a operacao de forma **atomica** — se dois usuarios clicarem ao mesmo tempo, o segundo recebe um aviso **"Chamado ja foi assumido por {nome}"**. Sem conflito de dados.

Apos assumir:
- Status muda para `em_atendimento`
- Voce vira **atendente**
- O chamado some da fila publica
- O solicitante recebe notificacao

## 4. Atender o chamado

Dentro do chamado voce pode:

- **Mover status** (botoes no topo): em_atendimento -> aguardando -> resolvido -> fechado
- **Adicionar comentarios** publicos (visivel ao solicitante) ou **internos** (so a equipe)
- **Transferir** para outro atendente (Master ou solicitante)
- **Anexar artigo da KB** ao chamado
- **Apontar horas** (modulo Apontamentos integrado)

## 5. SLA — Resposta e Resolucao

O sistema controla **dois SLAs**:

- **SLA de Resposta**: tempo ate o primeiro comentario do atendente
- **SLA de Resolucao**: tempo ate o status `resolvido`

Badges no card:
- **SLA OK** (sem badge)
- **SLA em Risco** (amarelo, ultima 1h/2h do prazo)
- **SLA Violado** (vermelho)

## 6. Historico / Auditoria

Clique no icone de **relogio** no topo do drawer ou pagina do chamado para ver a timeline:

- Criacao
- Atribuicoes / transferencias
- Mudancas de status
- Mudancas de prioridade

Cada entrada mostra **quem**, **quando** e **de -> para**.

## 7. Avaliacao (CSAT)

Quando o status vira **resolvido**, o solicitante pode avaliar de 1 a 5 estrelas. Notas baixas alimentam o modulo **CSAT**.

## Permissoes envolvidas

| Permissao             | O que libera                                  |
|-----------------------|-----------------------------------------------|
| `chamados:ver`        | Listar / abrir chamados e visualizar fila     |
| `chamados:criar`      | Abrir novos chamados                          |
| `chamados:editar`     | **Assumir, comentar, mudar status**, atribuir |
| `chamados:deletar`    | Remover chamados (apenas Master)              |

## Erros comuns

- **"Chamado ja foi assumido por X"** — outro usuario clicou primeiro; a fila e first-come, first-served
- **"Sem permissao"** — peca `chamados:editar` ao Master
- **"SLA violado"** — priorize ou repactue prazo com o solicitante
$md$,
    'publicado', v_cat_op, ARRAY['chamados','helpdesk','sla','procedimento'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 3. Aprovação de estouro de orçamento
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Aprovacao de estouro de orcamento',
    'aprovacao-estouro-orcamento',
    'Como o sistema bloqueia lancamentos acima do previsto e como o gestor aprova ou rejeita.',
    $md$
# Aprovacao de estouro de orcamento

Quando um lancamento ultrapassa **100%** do valor previsto de um mes, o Orkiestri **nao bloqueia** o lancamento — ele e registrado, mas gera uma **aprovacao pendente** que precisa ser resolvida.

## Quando o estouro e disparado

- Lancamento mensal com `valor_realizado > valor_previsto` do mes
- O sistema calcula a **execucao %** automaticamente
- Se passar de 100%, cria uma aprovacao com `tipo = lancamento` e `status = pendente`

## Fluxo de aprovacao

1. Lancamento e gravado (status do mes vira **estouro**)
2. Aprovacao **pendente** e criada
3. Gestores com permissao `orcamento:aprovar` recebem notificacao
4. Na aba **Operacoes -> Orcamento -> Aprovacoes** aparece a lista de pendencias
5. Gestor abre, analisa o contexto e decide:
   - **Aprovar**: status vai para `aprovado`, lancamento fica consolidado
   - **Rejeitar**: status vai para `rejeitado`, lancamento permanece como estouro

> A aprovacao **nao reverte** o lancamento. Ela e auditoria — registra que o gestor tomou ciencia e decidiu manter ou nao.

## Como aprovar

1. Acesse **Operacoes -> Orcamento -> Aprovacoes**
2. Veja cards pendentes com:
   - Item / categoria / mes
   - Previsto vs. realizado
   - % de estouro
   - Quem lancou
   - Observacoes do solicitante
3. Clique em **Aprovar** ou **Rejeitar**
4. (Opcional) Adicione observacoes na decisao
5. A timeline do item registra a decisao com seu nome e data

## Isolamento multi-tenant

A aprovacao so e visivel para gestores **da mesma organizacao** que originou o lancamento. Em tenants diferentes, as aprovacoes nao se cruzam.

## Permissoes

| Permissao             | O que libera                          |
|-----------------------|---------------------------------------|
| `orcamento:editar`    | Lancar (incluindo lancamentos com estouro) |
| `orcamento:aprovar`   | Ver e resolver aprovacoes pendentes   |

## Boas praticas

- **Aprove rapido** — itens pendentes travam o fechamento contabil
- **Use observacoes** — explique a decisao para a auditoria futura
- **Revise tendencia** — se uma categoria estoura todo mes, ajuste o previsto do proximo ciclo
$md$,
    'publicado', v_cat_fin, ARRAY['orcamento','aprovacao','financeiro'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 4. Cadastro de colaborador
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Cadastro de colaborador: solicitacao, aprovacao e provisionamento',
    'cadastro-colaborador-solicitacao-aprovacao',
    'Fluxo completo de onboarding — solicitacao publica, aprovacao do Master e provisionamento Workforce.',
    $md$
# Cadastro de colaborador

O Orkiestri usa um fluxo de **solicitacao + aprovacao** para criar novos usuarios. Isso evita criacao indevida e garante que o Master configure permissoes e estrutura organizacional no momento certo.

## 1. Solicitacao de acesso

O candidato acessa a tela publica de login e clica em **"Solicitar acesso"**. Preenche:

- Nome completo
- E-mail (obrigatorio, sera o login)
- WhatsApp (opcional, mas recomendado para OTP de senha)
- Cargo / Departamento / Empresa
- Motivacao (texto livre)

A solicitacao entra como **pendente** na aba **Cadastros -> Solicitacoes** do Master.

> Rate-limit: 5 solicitacoes por hora por IP. Anti-spam.

## 2. Aprovacao do Master

1. Master abre **Cadastros -> Solicitacoes**
2. Ve as solicitacoes pendentes
3. Clica em **Aprovar** numa solicitacao
4. Modal de aprovacao com 3 etapas:

### Etapa 1: Identificacao
- Confirma nome, e-mail, WhatsApp
- Pode editar antes de aprovar

### Etapa 2: Provisionamento Workforce
- **Setor**: a qual area pertence (ex.: TI, RH)
- **Gestor**: quem vai aprovar horas / ausencias dele
- **Perfil de permissoes**: define que modulos ele acessa
- **Squad** (opcional)
- **Matricula**: gerada automaticamente (3 letras da org + 4 digitos, ex.: `DEF0001`)
- **Senioridade**: junior / pleno / senior / staff
- **Tipo de vinculo**: CLT / PJ / estagio / terceiro
- **Jornada (h/dia)**: usado para calculo de capacidade

### Etapa 3: Confirmacao
- Master clica em **Aprovar**
- Sistema cria:
  - Usuario (com senha temporaria aleatoria de 12 caracteres)
  - Perfil Workforce
  - Permissoes do papel escolhido
- Envia credenciais por:
  - **WhatsApp** (se informado)
  - **E-mail**

## 3. Primeiro acesso

- Colaborador recebe a senha temporaria
- No primeiro login, e **obrigado** a trocar para senha propria (minimo 8 caracteres)
- Apos a troca, acessa o sistema normalmente

## 4. Rejeitar uma solicitacao

1. Na lista de pendentes, clique em **Rejeitar**
2. Informe o **motivo** (opcional, mas recomendado)
3. Sistema notifica o candidato por e-mail

## 5. Convite direto (sem solicitacao)

Master pode tambem criar usuarios **sem a etapa de solicitacao**:

1. Acesse **Cadastros -> Usuarios -> + Novo**
2. Preenche todos os dados
3. Sistema gera senha temporaria
4. Envia credenciais pelo mesmo canal (WhatsApp / e-mail)

## Permissoes

| Acao                                  | Quem pode                  |
|---------------------------------------|----------------------------|
| Criar solicitacao publica             | Qualquer um (rate-limited) |
| Ver solicitacoes da sua organizacao   | Master + cadastros:ver     |
| Aprovar / rejeitar                    | Master + cadastros:editar  |
| Criar usuario diretamente             | Master + cadastros:criar   |
| Desbloquear usuario travado           | Master                     |

## Erros comuns

- **"E-mail ja cadastrado"** — usuario existe em outro tenant ou ja foi criado
- **"Sem permissao"** — apenas Master da organizacao aprova
- **WhatsApp nao chegou** — verifique se o numero esta com DDI (+55) e se o WhatsApp da organizacao esta configurado
$md$,
    'publicado', v_cat_pes, ARRAY['cadastro','onboarding','workforce','usuario'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 5. Apontamento de horas
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Apontamento de horas em chamados e projetos',
    'apontamento-horas-chamados-projetos',
    'Como registrar horas trabalhadas, vincular a chamado/projeto e acompanhar capacidade.',
    $md$
# Apontamento de horas

O modulo **Horas** (apontamentos) registra o tempo gasto em chamados, projetos ou tarefas. Alimenta a **Capacidade** (carga real do colaborador) e os relatorios de hora-homem por cliente.

## 1. Criar um apontamento

1. Acesse **Operacoes -> Horas**
2. Clique em **+ Novo Apontamento**
3. Preencha:
   - **Data** (default = hoje)
   - **Horas** + **Minutos** (ex.: 1h 30min = 90 minutos)
   - **Vinculo**: Chamado OU Projeto OU Task
   - **Descricao** (opcional, recomendado)
4. Salve

> Atalho: dentro de um chamado ou projeto, ha um botao **"Apontar horas"** que ja vincula automaticamente.

## 2. Vincular ao trabalho

Cada apontamento tem 3 vinculos possiveis (exclusivos):

| Vinculo  | Quando usar                              |
|----------|------------------------------------------|
| Chamado  | Atendimento de suporte / helpdesk        |
| Projeto  | Esforco em projeto interno ou de cliente |
| Task     | Tarefa especifica dentro de um projeto   |

Apontamentos **sem vinculo** sao permitidos (ex.: reuniao geral) mas nao contam para faturamento de cliente.

## 3. Capacidade do colaborador

O sistema calcula automaticamente:

- **Jornada mes**: dias uteis x jornada/dia (ex.: 22 x 8 = 176h)
- **Horas alocadas**: total de apontamentos do mes
- **Utilizacao %**: alocadas / jornada
- **Tickets abertos**: chamados em aberto sob sua responsabilidade

Esses dados aparecem em:
- **Workforce -> Colaborador** (perfil)
- **Capacidade** (visao agregada)
- **Sugestao de atendente** ao atribuir chamado (modulo Skills)

## 4. Aprovacao de horas

Se a organizacao tiver workflow ativado:

1. Apontamento entra como `pendente`
2. Gestor direto recebe notificacao
3. Aprova ou rejeita
4. Horas aprovadas viram **faturaveis** (entram no relatorio de cliente)

## 5. Relatorios

Em **Relatorios -> Horas**:

- Por colaborador
- Por cliente
- Por projeto
- Comparativo previsto vs. realizado (capacidade)

Exportacao para Excel/CSV disponivel.

## Permissoes

| Permissao            | O que libera                          |
|----------------------|---------------------------------------|
| `horas:ver`          | Ver seus apontamentos                 |
| `horas:criar`        | Apontar                               |
| `horas:editar`       | Editar / deletar apontamentos         |
| `horas:aprovar`      | Aprovar horas do time (gestor)        |
$md$,
    'publicado', v_cat_op, ARRAY['horas','apontamento','timesheet','capacidade'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 6. Gestão de projetos
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Gestao de projetos: milestones, tasks e equipe',
    'gestao-projetos-milestones-tasks',
    'Como criar um projeto, definir milestones, distribuir tasks e acompanhar progresso.',
    $md$
# Gestao de projetos

O modulo **Projetos** organiza iniciativas com prazo, equipe e entregaveis. Cada projeto tem **milestones** (marcos), **tasks** (tarefas) e **membros**.

## 1. Criar um projeto

1. Acesse **Operacoes -> Projetos**
2. Clique em **+ Novo Projeto**
3. Preencha:
   - **Titulo** (obrigatorio)
   - **Tipo**: PROJETO / OPERACIONAL / INICIATIVA
   - **Cliente** (opcional, para projetos externos)
   - **Status inicial**: PLANEJAMENTO
   - **Prioridade**: BAIXA / MEDIA / ALTA
   - **Data inicio** / **Data fim**
   - **Valor** (opcional, para contratos a preco fixo)
   - **Cor** (visual no kanban)

## 2. Adicionar membros

1. Aba **Equipe**
2. Clique em **+ Adicionar membro**
3. Escolha o colaborador e o **papel**:
   - **Owner**: dono do projeto
   - **Lider**: pode editar e atribuir tasks
   - **Membro**: executa tasks atribuidas

Apenas membros veem o projeto na lista deles.

## 3. Definir milestones

Milestones sao marcos importantes (ex.: "MVP entregue", "Homologacao aprovada").

1. Aba **Milestones**
2. **+ Novo milestone** com titulo + data
3. Conforme as tasks vinculadas terminam, o progresso do milestone avanca

## 4. Criar tasks

1. Aba **Tasks**
2. **+ Nova task**
3. Preencha:
   - Titulo + descricao
   - **Responsavel** (qualquer membro)
   - **Milestone** (opcional)
   - **Prazo**
   - **Prioridade**
   - **Horas estimadas** (alimenta Capacidade)

Tasks tem **status** (TODO / IN_PROGRESS / REVIEW / DONE) e podem virar **subtasks** umas das outras.

## 5. Acompanhar progresso

- **Dashboard do projeto**: progresso geral (%), horas previstas vs. realizadas, tasks por status
- **Linha do Tempo**: visao gantt de todas as iniciativas
- **Apontamentos**: total de horas lancadas vinculadas ao projeto

## 6. Encerrar

Quando todas as tasks estao DONE e milestones cumpridos:

1. Volte ao projeto
2. Status -> **CONCLUIDO**
3. Sistema arquiva mas mantem historico

## Permissoes

| Permissao            | O que libera                       |
|----------------------|------------------------------------|
| `projetos:ver`       | Ver projetos onde e membro         |
| `projetos:criar`     | Abrir novos projetos               |
| `projetos:editar`    | Editar projetos onde e owner/lider |
| `projetos:deletar`   | Remover (apenas Master)            |
$md$,
    'publicado', v_cat_op, ARRAY['projetos','milestones','tasks','kanban'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 7. Workforce: setores e hierarquia
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Workforce: setores, hierarquia e skills',
    'workforce-setores-hierarquia-skills',
    'Como modelar a estrutura organizacional — setores hierarquicos, gestores, skills e niveis.',
    $md$
# Workforce

O modulo **Workforce** modela a **estrutura organizacional** da empresa: setores, hierarquia, gestores, skills tecnicas e niveis de senioridade. Alimenta os algoritmos de sugestao de atendente, capacidade e relatorios gerenciais.

## 1. Setores

Setores sao a primeira camada da organizacao. Suportam **hierarquia** (setor pai -> filhos).

1. Acesse **Cadastros -> Setores**
2. **+ Novo Setor**:
   - **Nome** (ex.: TI, RH, Comercial)
   - **Setor pai** (opcional, para criar arvore)
   - **Responsavel** (gestor do setor)
   - **Cor** (identificacao visual)
3. Salve

Exemplo de hierarquia:
```
TI
  Infraestrutura
  Desenvolvimento
    Frontend
    Backend
RH
Comercial
```

## 2. Atribuir colaboradores ao setor

Quando voce aprova um cadastro (ver artigo de Cadastro de Colaborador), escolhe o **Setor** e o **Gestor**. Pode mudar depois em **Workforce -> Colaboradores**.

## 3. Skills

Skills sao competencias tecnicas (ex.: "AWS", "PostgreSQL", "Node.js"). Cada skill tem **niveis**: junior / pleno / senior / staff.

1. Acesse **Cadastros -> Skills**
2. **+ Nova Skill**
3. Em cada colaborador, atribua skills com nivel

## 4. Sugestao de atendente

Quando um chamado precisa de uma skill especifica:

1. Master abre o chamado
2. Define a **Skill requerida** + **Nivel minimo**
3. Clica em **Sugerir** no campo Atendente
4. Sistema retorna **top 5 colaboradores** ordenados por:
   - **Skill match** (nivel >= minimo)
   - **Carga atual** (menos chamados abertos)
   - **Senioridade** (desempate)

A pontuacao composta ajuda a balancear o trabalho do time.

## 5. Squads

Squads sao **equipes transversais** que cortam a hierarquia tradicional. Util para times de produto.

Cada colaborador pode estar em **uma** squad. Configurado no cadastro ou em **Workforce -> Squads**.

## 6. Capacidade vs. Carga

Veja o artigo **"Capacidade e carga de trabalho"** para detalhes do calculo.

## Permissoes

| Permissao              | O que libera                          |
|------------------------|---------------------------------------|
| `workforce:ver`        | Ver estrutura organizacional          |
| `workforce:editar`     | Cadastrar setores, skills, squads     |
| `cadastros:editar`     | Atribuir colaboradores a setores      |
$md$,
    'publicado', v_cat_pes, ARRAY['workforce','setores','skills','hierarquia'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 8. Capacidade
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Capacidade e carga de trabalho',
    'capacidade-carga-de-trabalho',
    'Como o sistema calcula a utilizacao real do colaborador e como agir sobre superalocacao.',
    $md$
# Capacidade e carga de trabalho

O modulo **Capacidade** mostra, em tempo real, quanto da jornada de cada colaborador esta **alocada** vs. quanto ele **realmente trabalhou**. Apoia decisoes de redistribuicao de chamados, contratacao e planejamento de projetos.

## 1. O calculo

Para cada colaborador, no mes corrente:

```
Jornada do mes = dias_uteis * jornada_horas_dia
Horas alocadas = SUM(horas previstas em tasks abertas + horas dos apontamentos no mes)
Utilizacao % = (Horas alocadas / Jornada do mes) * 100
```

Faixas de cor:

| Utilizacao | Significado                  |
|------------|------------------------------|
| 0-70%      | Subutilizado (verde)         |
| 70-90%     | Saudavel (amarelo)           |
| > 90%      | Sobrecarregado (vermelho)    |

## 2. Tela de Capacidade

Acesse **Operacoes -> Capacidade**:

- **Heatmap** semanal — quem esta sobrecarregado hoje
- **Lista de colaboradores** com utilizacao + tickets abertos + horas alocadas
- **Filtro por setor / squad / skill**

## 3. Acoes possiveis

Ao ver alguem sobrecarregado:

1. **Redistribuir chamados** — abra os chamados dele e transfira para alguem com utilizacao baixa
2. **Postergar projeto** — mude prazos das tasks
3. **Aprovar ausencia** — se for ferias / atestado, registre em Ausencias para o calculo considerar
4. **Sugerir contratacao** — relatorio de capacidade ajuda a justificar nova vaga

## 4. Estimativas em projetos

Tasks com **horas_estimadas** preenchidas contribuem para capacidade **antes** de serem feitas. Sem estimativa, a capacidade so reflete o que ja foi apontado.

> Boa pratica: sempre estime horas em tasks ao cria-las.

## 5. Sugestao automatica

Ao atribuir um chamado, o botao **Sugerir** considera capacidade no score (quem tem menos carga aparece primeiro entre os qualificados).

## Permissoes

| Permissao              | O que libera                       |
|------------------------|------------------------------------|
| `capacidade:ver`       | Ver heatmap e utilizacao do time   |
| `workforce:editar`     | Ajustar jornada do colaborador     |
$md$,
    'publicado', v_cat_pes, ARRAY['capacidade','workforce','planejamento'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 9. Cadastro de clientes
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Cadastro e gestao de clientes',
    'cadastro-gestao-clientes',
    'Como cadastrar clientes, vincular contratos e acompanhar timeline de relacionamento.',
    $md$
# Cadastro e gestao de clientes

O modulo **Clientes** centraliza os dados de quem voce atende. Conecta-se a Chamados, Projetos, Apontamentos e Contratos.

## 1. Criar um cliente

1. Acesse **Cadastros -> Clientes**
2. **+ Novo Cliente**
3. Preencha:
   - **Nome** (obrigatorio)
   - **Empresa** (CNPJ, razao social)
   - **E-mail** + **Telefone**
   - **Endereco** (CEP, logradouro, cidade, UF)
   - **Responsavel interno** (colaborador da sua empresa que cuida da conta)
   - **Observacoes**

## 2. Timeline de relacionamento

Cada interacao com o cliente fica registrada:

- Chamados abertos por ele
- Projetos em andamento
- Contratos ativos
- Faturas emitidas
- Notas / observacoes adicionadas manualmente

Tudo aparece em ordem cronologica na aba **Timeline** do cliente.

## 3. Contratos

Para clientes recorrentes, cadastre **contratos**:

1. Aba **Contratos** -> **+ Novo**
2. Modelo: hora-pacote (bolsa de horas), mensalidade, projeto preco fixo
3. Vincula automaticamente apontamentos de horas

## 4. Faturas

Geradas a partir de:
- Horas apontadas em chamados / projetos do cliente
- Contratos com cobranca mensal
- Itens avulsos

Status: rascunho -> emitida -> paga / vencida

## 5. Pipeline (CRM)

Se o cliente ainda for **prospect** (potencial), gerencie no modulo **CRM -> Pipeline**:
- Estagios: novo / contato / proposta / negociacao / ganho / perdido
- Movimentacao por drag-and-drop em kanban
- Conversao automatica para cliente quando o estagio vira "ganho"

## Permissoes

| Permissao             | O que libera                       |
|-----------------------|------------------------------------|
| `clientes:ver`        | Listar clientes                    |
| `clientes:criar`      | Cadastrar novos                    |
| `clientes:editar`     | Atualizar dados                    |
| `clientes:deletar`    | Remover (apenas Master)            |
$md$,
    'publicado', v_cat_com, ARRAY['clientes','crm','cadastros'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 10. Permissões e papéis
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Permissoes, papeis e perfis de acesso',
    'permissoes-papeis-perfis-acesso',
    'Como funciona o modelo de permissoes, criar papeis customizados e atribuir aos colaboradores.',
    $md$
# Permissoes, papeis e perfis

O Orkiestri usa um modelo de **permissoes granulares** agrupadas em **papeis** (roles). Cada colaborador recebe um ou mais papeis, herdando todas as permissoes contidas.

## 1. Conceitos

| Termo            | O que e                                                  |
|------------------|----------------------------------------------------------|
| **Permissao**    | String tecnica que libera uma acao (ex.: `chamados:criar`) |
| **Papel (Role)** | Grupo de permissoes (ex.: "Atendente N1")                |
| **isMaster**     | Papel especial — concede `*` (todas as permissoes) no tenant |
| **isSuperAdmin** | Papel **GLOBAL** — apenas `administrator@orkiestri.com`  |

## 2. Convencoes de nomes

Permissoes seguem o padrao `<modulo>:<acao>`:

- `chamados:ver` `chamados:criar` `chamados:editar` `chamados:deletar`
- `orcamento:ver` `orcamento:aprovar`
- `workforce:ver` `workforce:editar`
- `clientes:ver` `clientes:criar` `clientes:editar`
- ... e assim por diante para todos os modulos

A permissao especial `*` libera **tudo no tenant**.

## 3. Criar um papel customizado

1. Acesse **Configuracoes -> Papeis e Permissoes**
2. **+ Novo Papel**
3. Defina:
   - **Nome** (ex.: "Atendente N1")
   - **Descricao**
   - **Permissoes**: marque os checkboxes
4. Salve

## 4. Atribuir papel a colaborador

No cadastro do usuario (ou ao aprovar uma solicitacao):

- Selecione o **Perfil** desejado
- O usuario passa a ter todas as permissoes do papel

Voce tambem pode atribuir **permissoes extras** (overrides) por colaborador sem mudar o papel base.

## 5. Master vs. Super Admin

| Papel             | Escopo                                              |
|-------------------|-----------------------------------------------------|
| **Master**        | Tudo dentro **deste** tenant (sua organizacao)       |
| **Super Admin**   | Acesso global — gerencia **todos** os tenants, criar organizacoes, impersonar Masters |

**O Super Admin global e UM unico usuario:** `administrator@orkiestri.com`. Nenhum outro tem esse poder.

## 6. Boas praticas

- Crie papeis por **funcao** (ex.: "Suporte N1", "Gerente Financeiro"), nao por pessoa
- Use **principio do menor privilegio** — so de o que e necessario
- Master e poderoso — limite a 2-3 pessoas por organizacao
- Audite periodicamente quem tem `*` ou Master

## Permissoes

| Permissao                  | O que libera                          |
|----------------------------|---------------------------------------|
| `configuracoes:ver`        | Ver tela de papeis                    |
| `configuracoes:editar`     | Criar / editar papeis e permissoes    |
$md$,
    'publicado', v_cat_cfg, ARRAY['permissoes','papeis','seguranca','configuracao'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 11. Base de conhecimento meta
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Como criar e organizar artigos na base de conhecimento',
    'como-criar-organizar-artigos-kb',
    'Manual da base de conhecimento — criar categorias, escrever artigos em markdown e publicar.',
    $md$
# Base de Conhecimento

A **Base de Conhecimento** (modulo Conhecimento) e o repositorio de procedimentos, tutoriais e FAQs internos da organizacao. Reduz dependencia do time, acelera onboarding e e usada pelo modulo **Chamados** para sugerir respostas.

## 1. Estrutura

- **Categorias**: agrupam artigos por tema (ex.: Financeiro, Operacoes)
- **Artigos**: o conteudo em si, em markdown
- **Tags**: termos livres para busca cruzada

## 2. Criar uma categoria

1. Acesse **Conhecimento** -> botao **+** ao lado de Categorias
2. Preencha:
   - **Nome** (unico por organizacao)
   - **Descricao**
   - **Icone** (lucide-react)
   - **Cor** (hex)
   - **Ordem** (numero, menor = aparece primeiro)
3. Salve

## 3. Criar um artigo

1. **+ Novo Artigo**
2. Preencha:
   - **Titulo** (obrigatorio — gera o slug automaticamente)
   - **Categoria**
   - **Resumo** (1-2 linhas mostradas na lista)
   - **Conteudo** (markdown)
   - **Tags** (lista separada por virgula)
3. Status inicial: **rascunho**
4. Clique em **Publicar** quando estiver pronto

## 4. Sintaxe markdown suportada

```
# Titulo H1
## Titulo H2
### Titulo H3

**negrito**, *italico*, `codigo`

- item de lista
1. item ordenado

Paragrafos separados por linha em branco.
```

## 5. Sugestao automatica em chamados

Quando um usuario abre um chamado e digita o titulo, a base de conhecimento **busca artigos publicados** relacionados e sugere ate 3. Reduz tickets duplicados.

Para o artigo ser sugerido, ele precisa:
- Estar **publicado** (nao rascunho)
- Ter **tags** ou termos do titulo casando com a busca

## 6. Estatisticas

Cada artigo registra:
- **Visualizacoes** (incrementadas a cada abertura)
- **Categoria**
- **Autor**
- **Datas**

Util para identificar quais procedimentos sao mais consultados e investir em melhora-los.

## Permissoes

| Permissao                   | O que libera                       |
|-----------------------------|------------------------------------|
| `conhecimento:ver`          | Ler artigos publicados             |
| `conhecimento:criar`        | Criar rascunhos                    |
| `conhecimento:editar`       | Editar artigos (proprios e outros) |
| `conhecimento:publicar`     | Mover de rascunho para publicado   |
| `conhecimento:deletar`      | Remover artigos                    |

## Boas praticas

- **Um artigo = um problema** — evite procedimentos gigantes
- **Use exemplos** — codigo, screenshots (em breve), nomes reais
- **Atualize** — artigos desatualizados sao piores que ausencia de artigo
- **Tags consistentes** — combine com seu time uma taxonomia (ex.: `tutorial`, `faq`, `troubleshooting`)
$md$,
    'publicado', v_cat_cfg, ARRAY['conhecimento','meta','tutorial','documentacao'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 12. Configuração de WhatsApp por organização
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Configuracao de WhatsApp por organizacao',
    'configuracao-whatsapp-por-organizacao',
    'Como configurar a instancia WhatsApp do seu tenant para enviar notificacoes (chamados, OTP, alertas).',
    $md$
# Configuracao de WhatsApp por organizacao

O Orkiestri envia **notificacoes via WhatsApp** (chamados, OTP de senha, lembretes de agenda, alertas de SLA) atraves da **Evolution API**. Cada organizacao pode ter sua **propria instancia** — assim os clientes recebem mensagens com o numero da sua empresa, nao um numero generico.

## 1. Visao geral

- O Orkiestri tem uma instancia **padrao** (fallback)
- Cada organizacao pode cadastrar uma instancia **propria** (recomendado)
- Quando uma notificacao precisa ser enviada, o sistema usa:
  1. Instancia da organizacao (se configurada e conectada)
  2. Senao, a instancia default

## 2. Pre-requisitos

- Numero de WhatsApp dedicado (idealmente Business)
- Acesso ao painel Evolution API (configurado pelo Super Admin)

## 3. Cadastrar a instancia

1. Acesse **Configuracoes -> WhatsApp**
2. Clique em **+ Nova instancia**
3. Preencha:
   - **Nome da instancia** (ex.: `mello-prod`)
   - **Token** (gerado pelo Evolution)
4. Salve

## 4. Conectar (escanear QR Code)

1. Apos criar, clique em **Conectar**
2. Sistema mostra QR Code
3. No celular: WhatsApp -> Configuracoes -> Aparelhos conectados -> Conectar aparelho
4. Escaneie o QR Code
5. Aguarde mudar para **status: conectado**

> O QR Code expira em 60s. Se demorar, clique em **Gerar novo QR**.

## 5. Testar

1. Botao **Enviar teste**
2. Informe um numero (com DDI, ex.: 5511999999999)
3. Mensagem de teste e disparada
4. Confirme que chegou no aparelho

## 6. Notificacoes ativadas

Por padrao, o sistema envia mensagens para:

- **Chamado aberto** (notifica solicitante)
- **Chamado atribuido** (notifica atendente)
- **Mudanca de status** (notifica solicitante)
- **Chamado resolvido** (CSAT)
- **OTP de recuperacao de senha**
- **Alertas de SLA em risco / violado**
- **Lembretes de agenda**

Cada usuario pode **desabilitar individualmente** em **Perfil -> Notificacoes**.

## 7. Manutencao

- Se o numero **desconectar** (celular sem internet por horas), a instancia para
- O sistema mostra **status: desconectado** e tenta reconectar
- Se persistir, escaneie o QR novamente
- Logs de envio em **Configuracoes -> WhatsApp -> Historico**

## Permissoes

| Permissao                 | O que libera                   |
|---------------------------|--------------------------------|
| `configuracoes:editar`    | Cadastrar / conectar instancia |

## Erros comuns

- **"Numero invalido"** — formato deve ser DDI+DDD+numero, sem espacos (ex.: 5511999999999)
- **"Instancia nao conectada"** — escaneie o QR novamente
- **"Limite de mensagens"** — Evolution pode ter rate-limit; aguarde minutos
$md$,
    'publicado', v_cat_cfg, ARRAY['whatsapp','integracao','notificacoes','configuracao'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  RAISE NOTICE 'Seed conhecimento concluido. Org: %, autor: %', v_org_id, v_autor_id;
END $$;

-- Resumo do que foi criado
SELECT 'Categorias' AS tipo, COUNT(*) AS total FROM categorias_conhecimento WHERE organization_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Artigos publicados', COUNT(*) FROM artigos_conhecimento WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND status = 'publicado';
