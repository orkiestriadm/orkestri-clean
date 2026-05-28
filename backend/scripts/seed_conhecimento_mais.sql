-- ─────────────────────────────────────────────────────────────────────────────
-- Seed adicional: 10 procedimentos cobrindo Orcamento, Projetos, Apontamentos,
-- Ausencias, Workforce, CRM, Configuracoes (papeis e SLA).
-- Idempotente via UNIQUE(organization_id, slug).
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_org_id    TEXT := '00000000-0000-0000-0000-000000000001';
  v_autor_id  TEXT;
  v_cat_op    TEXT;
  v_cat_fin   TEXT;
  v_cat_pes   TEXT;
  v_cat_com   TEXT;
  v_cat_cfg   TEXT;
BEGIN
  SELECT id INTO v_autor_id FROM users WHERE organization_id = v_org_id AND nome ILIKE '%Guilherme%' LIMIT 1;
  IF v_autor_id IS NULL THEN SELECT id INTO v_autor_id FROM users WHERE organization_id = v_org_id LIMIT 1; END IF;
  IF v_autor_id IS NULL THEN RAISE EXCEPTION 'Nenhum usuario na org %', v_org_id; END IF;

  SELECT id INTO v_cat_op  FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Operacoes';
  SELECT id INTO v_cat_fin FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Financeiro';
  SELECT id INTO v_cat_pes FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Pessoas';
  SELECT id INTO v_cat_com FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Comercial';
  SELECT id INTO v_cat_cfg FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Configuracoes';

  -- ═══════════════════════════════════════════════════════════════════════════
  --  ORCAMENTO — 2 procedimentos detalhados
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 1. Lançar valor realizado mensal
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Lancar valor realizado mensal no orcamento',
    'lancar-valor-realizado-mensal-orcamento',
    'Procedimento operacional para fechamento mensal — lancar despesas reais por item, observacoes, comprovantes e tratamento de estouro.',
    $md$
# Lancar valor realizado mensal no orcamento

Procedimento que tipicamente acontece **uma vez por mes** (fechamento). Para cada item do orcamento ativo, registre o que efetivamente foi gasto.

## 1. Quando lancar

- **No fechamento do mes** (recomendado entre dia 1 e 5 do mes seguinte)
- Apos receber **todas as notas fiscais** do mes anterior
- Antes da reuniao de revisao orcamentaria

## 2. Pre-requisitos

- Ciclo do ano em status **aprovado** ou **em execucao**
- Itens cadastrados na categoria correta
- Permissao `orcamento:editar`

## 3. Acessar a tela de lancamento

1. **Operacoes -> Orcamento**
2. Selecione o **ano** no topo (ex.: 2026)
3. Aba **OPEX** ou **CAPEX** (conforme o item)
4. Encontre o item (use filtros de categoria, centro de custo, fornecedor se a lista for grande)
5. Clique no item para abrir o detalhe

## 4. Lancar valor do mes

No detalhe do item, voce ve a tabela de 12 meses:

| Mes      | Previsto | Realizado | Execucao % | Status      |
|----------|----------|-----------|------------|-------------|
| Jan/2026 | R$ 5.000 | R$ 4.800  | 96%        | ok          |
| Fev/2026 | R$ 5.000 | R$ 5.300  | 106%       | **estouro** |
| Mar/2026 | R$ 5.000 | —         | —          | pendente    |

Para lancar o mes pendente:

1. Clique no **mes** (ex.: Marco)
2. Modal abre
3. Informe:
   - **Valor realizado** (em reais, ex.: 5200.50)
   - **Observacoes** (texto livre — recomendado!)
4. Clique em **Lancar**

## 5. Boas observacoes

A observacao e crucial para auditoria futura. Inclua:

- **Numero da NF** ou referencia do documento
- **Fornecedor** (se diferente do cadastrado)
- **Justificativa** se passou do previsto
- **Link/anexo** do comprovante (se relevante)

Exemplos:
- ✅ "NF 12345 - Fornecedor X - mensalidade Slack abril 2026"
- ✅ "Compra extraordinaria de licencas adicionais (5 novos colaboradores) - NF 67890"
- ❌ "lancamento"
- ❌ "ver email do contas a pagar"

## 6. Lancamento parcial / multiplos lancamentos no mesmo mes

Em alguns casos voce tem mais de uma NF no mes (ex.: 3 fornecedores fragmentados). Voce pode:

- **Somar tudo** e lancar um valor unico (recomendado para itens simples)
- **Adicionar lancamentos parciais** — clique de novo no mes e some ao valor anterior

A timeline do item registra cada movimentacao.

## 7. Quando o lancamento gera ESTOURO (>100%)

Conforme o artigo "Aprovacao de estouro de orcamento":

1. Sistema lanca **mas marca como estouro**
2. **Cria aprovacao pendente** automaticamente
3. **Notifica gestores** com permissao `orcamento:aprovar`
4. Status do mes vira **estouro** (vermelho)

Voce pode lancar mesmo sabendo que vai estourar — o sistema nao bloqueia. So pede ratificacao do gestor depois.

## 8. Corrigir um lancamento errado

Se lancou valor errado:

1. Clique de novo no mes
2. Sobrescreva o valor
3. Adicione observacao **"Correcao: valor anterior X, novo Y, motivo Z"**

> Sistema **nao deleta** o historico — toda alteracao fica na timeline do item.

## 9. Multipla currencia

Se a organizacao trabalha com fornecedor em USD:

1. Sempre lance em **BRL** convertido
2. Coloque na observacao: **"USD 1.500 @ 5,15 = BRL 7.725"**
3. (Em breve: modulo cambio nativo)

## 10. Apos lancar todos os itens do mes

1. Verifique a aba **Dashboard** do orcamento
2. Confira:
   - Total previsto vs. realizado do mes
   - Categorias com pior execucao
   - Estouros pendentes de aprovacao
3. Resolva aprovacoes (ver artigo de aprovacao de estouro)
4. Faca a reuniao de revisao com base no dashboard

## Permissoes

| Permissao             | O que libera                  |
|-----------------------|-------------------------------|
| `orcamento:editar`    | Lancar e corrigir valores     |
| `orcamento:aprovar`   | Resolver estouros             |
| `orcamento:ver`       | Visualizar dashboard          |

## Boas praticas

- **Calendario fixo** — defina dia 5 (ou outro) como deadline mensal
- **Observacoes consistentes** — padronize formato com o time financeiro
- **Conferencia cruzada** — alguem revisa antes da reuniao
- **Lance mesmo zerado** — itens sem despesa no mes ficam "ok" (0%)
- **Cuidado com R$** — use ponto como separador decimal (5200.50, nao 5200,50)

## Erros comuns

- **"Sem permissao"** — peca `orcamento:editar` ao Master
- **"Mes ja lancado e bloqueado"** — fechamento contabil ja foi feito; converse com financeiro
- **Lancamento aparece como estouro inesperado** — confira se o previsto do mes esta certo
$md$,
    'publicado', v_cat_fin, ARRAY['orcamento','lancamento','realizado','fechamento','procedimento'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 2. Categorias e centros de custo
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Cadastrar categorias de orcamento e centros de custo',
    'cadastrar-categorias-orcamento-centros-custo',
    'Estrutura basica do orcamento — categorias funcionais (TI, RH, Marketing) e centros de custo (unidade, projeto, filial). Como criar e quando usar cada uma.',
    $md$
# Categorias de orcamento e Centros de Custo

Antes de cadastrar itens, o orcamento precisa de **categorias** (o que e o gasto) e, opcionalmente, **centros de custo** (onde o gasto e atribuido). Sao dimensoes diferentes — combinadas, permitem relatorios cruzados.

## 1. Diferenca entre os dois

| Conceito           | O que e                                  | Exemplo                                  |
|--------------------|------------------------------------------|------------------------------------------|
| **Categoria**      | A **natureza** do gasto                   | "Salarios", "Software", "Marketing"      |
| **Centro de Custo**| **Onde** o gasto e alocado contabilmente  | "Filial SP", "Projeto Cliente X", "TI"   |

Um mesmo item pode pertencer a uma categoria + um centro:

> Item "Licenca Slack TI" → Categoria: **Software** → Centro: **TI Corporativo**

## 2. Quando criar centros de custo

Se sua empresa:

- Tem multiplas **filiais** ou **unidades de negocio**
- Cobra orcamento de **projetos a preco fixo**
- Quer ver gasto por **diretoria** ou **time**
- Faz **rateio** de despesas comuns entre setores

Sem centros de custo, o orcamento ainda funciona — todos os itens caem na "unidade unica" da organizacao.

## 3. Criar uma categoria de orcamento

1. **Configuracoes -> Orcamento -> Categorias**
2. Clique em **+ Nova Categoria**
3. Preencha:
   - **Nome** (obrigatorio, unico)
   - **Tipo**: OPEX (despesa recorrente) / CAPEX (investimento) / RECEITA
   - **Descricao**
   - **Cor** (visual nos relatorios)
   - **Ordem** (numero — define ordem de exibicao)
4. Salve

### Categorias OPEX tipicas
- Salarios e Encargos
- Software e Licencas
- Marketing e Publicidade
- Viagens
- Manutencao
- Servicos Terceirizados

### Categorias CAPEX tipicas
- Equipamentos de TI
- Mobiliario
- Reformas
- Aquisicao de Software (one-time)

### Categorias RECEITA (se a org usa orcamento bidirecional)
- Vendas
- Servicos Prestados
- Receitas Financeiras

## 4. Criar um centro de custo

1. **Cadastros -> Centros de Custo**
2. Clique em **+ Novo Centro**
3. Preencha:
   - **Codigo** (obrigatorio, unico — ex.: CC001, TI-SP)
   - **Nome** (ex.: "TI Corporativo Sao Paulo")
   - **Responsavel** (gestor que aprova despesas desse centro)
   - **Ativo** (boolean)
4. Salve

## 5. Vincular item ao centro de custo

No cadastro / edicao do item de orcamento:
1. Campo **Centro de Custo** (dropdown)
2. Selecione o centro
3. Salve

> O vinculo e **opcional**. Itens sem centro caem no "geral" da organizacao.

## 6. Relatorios cruzados

Apos vincular, os relatorios filtram por:

- **Por categoria** (visao tradicional — Software, Marketing, etc.)
- **Por centro de custo** (visao gerencial — TI, Comercial, etc.)
- **Por categoria + centro** (matriz cruzada — quanto Marketing gastou no Centro SP vs. Centro RJ)

Acesse em **Relatorios -> Orcamento -> Matriz Categoria x Centro**.

## 7. Inativar (nao deletar)

Recomendado **inativar** ao inves de deletar:

- Itens historicos vinculados nao perdem referencia
- Dados ficam consistentes para auditoria
- Reativar e simples (toggle)

Para inativar:
1. Abra a categoria / centro
2. Desmarque **Ativo**
3. Salve

## 8. Migracao de itens entre categorias

Quando voce reorganiza:

1. Abra cada item da categoria origem
2. Mude o campo **Categoria**
3. Salve

Para muitos itens:
- Use **bulk edit** (selecionar varios + acao em massa)
- OU peca ao Super Admin um script de migracao

## Permissoes

| Permissao              | O que libera                          |
|------------------------|---------------------------------------|
| `orcamento:editar`     | Criar / editar categorias e centros   |
| `orcamento:ver`        | Visualizar lista                      |

## Boas praticas

- **Padronize nomes** — use convencoes (sem abreviacoes inconsistentes)
- **Limite a ~15 categorias** — muitas viram bagunca; menos viram falta de granularidade
- **Codigos curtos** para centros (CC001, CC002) — economiza tela em relatorios
- **Revise no fim do ano** — categorias / centros nao usados? Inative
$md$,
    'publicado', v_cat_fin, ARRAY['orcamento','categorias','centros-custo','configuracao'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  PROJETOS — 2 procedimentos
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 3. Criar projeto do zero
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Criar um projeto do zero — cadastro, equipe e milestones',
    'criar-projeto-zero-cadastro-equipe-milestones',
    'Tutorial completo para abrir um projeto no Orkiestri — dos dados basicos a configuracao de equipe, milestones, tasks e rituais de acompanhamento.',
    $md$
# Criar um projeto do zero

Procedimento detalhado para abrir um projeto novo. Cobre desde **dados basicos** ate o **kickoff** com equipe configurada e milestones definidos.

## 1. Tipos de projeto no Orkiestri

| Tipo            | Caracteristica                                             | Exemplo                              |
|-----------------|------------------------------------------------------------|--------------------------------------|
| **PROJETO**     | Entregavel com prazo definido                              | Implantacao ERP cliente X            |
| **OPERACIONAL** | Esforco continuo sem prazo                                 | Sustentacao mensal de cliente        |
| **INICIATIVA**  | Esforco interno, melhoria de processo, R&D                 | Refatoracao backend                  |

A escolha afeta como o sistema trata os relatorios e a linha do tempo.

## 2. Antes de criar

Tenha definido:

- [ ] **Cliente** (interno ou externo)
- [ ] **Datas** previstas (inicio + fim)
- [ ] **Owner** (quem responde pelo projeto)
- [ ] **Lider tecnico** (se diferente do owner)
- [ ] **Membros** iniciais
- [ ] **Milestones** (marcos principais)
- [ ] **Orcamento estimado** (opcional)

## 3. Criar o projeto

1. **Operacoes -> Projetos**
2. Botao **+ Novo Projeto** (canto superior direito)
3. Preencha:
   - **Titulo** (obrigatorio, ex.: "Implantacao Sistema Y - Cliente Z")
   - **Tipo**: PROJETO / OPERACIONAL / INICIATIVA
   - **Cliente** (dropdown — se nao tiver, cadastre antes em Cadastros -> Clientes)
   - **Descricao** (objetivos, escopo, fora-de-escopo)
   - **Status inicial**: PLANEJAMENTO
   - **Prioridade**: BAIXA / MEDIA / ALTA / CRITICA
   - **Data inicio** + **Data fim**
   - **Valor** (R$, se for contrato a preco fixo)
   - **Cor** (identifica nos kanbans)
4. **Criar**

## 4. Adicionar membros

Apos criar, abra o projeto:

1. Aba **Equipe**
2. **+ Adicionar membro**
3. Selecione **colaborador** + **papel**:

| Papel    | Permissao no projeto                                |
|----------|-----------------------------------------------------|
| Owner    | Tudo — edita projeto, adiciona/remove membros       |
| Lider    | Edita tasks, atribui, muda status, edita milestones |
| Membro   | Executa tasks atribuidas, comenta, aponta horas     |

> Membros **so veem o projeto se forem adicionados**. Master ve todos.

## 5. Definir milestones

Milestones sao **marcos** importantes (entregas, validacoes, go-live).

1. Aba **Milestones**
2. **+ Novo milestone**
3. Preencha:
   - **Titulo** (ex.: "MVP entregue", "Homologacao aprovada", "Go-live")
   - **Data prevista**
   - **Descricao**
4. Salve

Conforme as tasks vinculadas vao para DONE, o **progresso do milestone** avanca automaticamente.

### Milestones comuns
- Kickoff
- Levantamento concluido
- MVP / Alpha / Beta
- Homologacao do cliente
- Go-live
- Estabilizacao
- Encerramento / aceite formal

## 6. Adicionar tasks iniciais

Tasks sao o **trabalho efetivo**. Comece com o "backbone":

1. Aba **Tasks**
2. **+ Nova task** para cada item
3. Preencha:
   - **Titulo** + descricao
   - **Responsavel** (qualquer membro)
   - **Milestone** (opcional, mas recomendado)
   - **Prazo**
   - **Prioridade**
   - **Horas estimadas** (alimenta a Capacidade — sempre preencha)
4. Status inicial: **TODO**

### Subtasks
Tasks complexas podem ser quebradas em subtasks:
1. Abra a task
2. **+ Subtask**
3. Cada subtask tem responsavel + prazo proprios

## 7. Kickoff e divulgacao

1. Mude status do projeto de PLANEJAMENTO -> EM_ANDAMENTO
2. Notifique a equipe (mensagem manual + sistema notifica automatico)
3. Faca a reuniao de kickoff
4. **Documente** decisoes na descricao do projeto ou em comentario fixado

## 8. Acompanhamento

### Diario
- Cada membro **aponta horas** nas tasks que executa
- Move tasks de **TODO -> IN_PROGRESS -> REVIEW -> DONE**
- Comenta progressos / bloqueios

### Semanal
- Owner / Lider revisa kanban
- Atualiza milestones
- Ajusta prazos se necessario
- Reuniao de status (15-30min)

### Mensal
- Dashboard do projeto: progresso geral, horas, custo realizado
- Linha do Tempo: visao macro de todos os projetos da organizacao
- Reuniao de revisao com cliente (se externo)

## 9. Linha do tempo (Gantt)

Acesse **Operacoes -> Linha do Tempo** para visao **gantt** de todos os projetos com prazos, milestones, dependencias.

## 10. Encerrar

Quando todas as tasks estao DONE e milestones cumpridos:

1. Status projeto -> **CONCLUIDO** (ou CANCELADO se interrompido)
2. **Aceite formal** do cliente (se aplicavel) — documente em comentario / anexo
3. Lessons learned (escreva um artigo na KB!)
4. Arquivamento — projeto fica no historico, **nao deletado**

## Permissoes

| Permissao            | O que libera                       |
|----------------------|------------------------------------|
| `projetos:ver`       | Ver projetos onde e membro         |
| `projetos:criar`     | Abrir projetos                     |
| `projetos:editar`    | Editar (owner/lider)               |
| `projetos:deletar`   | Remover (apenas Master)            |

## Boas praticas

- **Titulo descritivo** — "Implantacao Sistema X" e melhor que "Projeto Cliente Y"
- **Milestones a cada 2-4 semanas** — visibilidade frequente
- **Horas estimadas SEMPRE** — sem isso, capacidade fica imprecisa
- **Owner ≠ executor** — Owner gerencia, time executa
- **Documente decisoes** — comentario fixado ajuda futuras consultas
- **Cliente externo: comunique-se via projeto** (e nao so chamados) — fica registrado
$md$,
    'publicado', v_cat_op, ARRAY['projetos','criar','equipe','milestones','tutorial'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 4. Gerenciar tasks no kanban
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Gerenciar tasks no kanban — workflow do executor',
    'gerenciar-tasks-kanban-workflow-executor',
    'Como pegar tasks, mover entre colunas, criar subtasks, vincular apontamentos e revisar antes de fechar.',
    $md$
# Gerenciar tasks no kanban

Manual do executor de tasks. Cobre o ciclo **TODO -> IN_PROGRESS -> REVIEW -> DONE** com as boas praticas em cada etapa.

## 1. Estrutura do kanban

Dentro de um projeto, aba **Tasks**, voce ve 4 colunas:

| Coluna       | Significado                                              |
|--------------|----------------------------------------------------------|
| **TODO**     | A fazer — task atribuida mas nao iniciada                |
| **IN_PROGRESS** | Em andamento — voce esta trabalhando ativamente       |
| **REVIEW**   | Em revisao — voce concluiu, alguem precisa validar       |
| **DONE**     | Concluida e aprovada                                     |

## 2. Pegar uma task

1. Abra o projeto
2. Na coluna **TODO**, encontre uma task atribuida a voce
3. Clique e leia:
   - Descricao
   - Subtasks (se houver)
   - Comentarios anteriores
   - Horas estimadas
4. Se voce concorda em comecar, **arraste para IN_PROGRESS** (ou clique no botao **Iniciar**)

## 3. Tasks nao atribuidas

Algumas tasks nascem **sem responsavel** (similar a fila publica de chamados):

1. Filtre por **"Sem responsavel"**
2. Veja prioridade e prazo
3. Se voce pode pegar, clique em **Assumir** (similar ao **Assumir Chamado**)

## 4. Apontar horas

Conforme trabalha, **registre tempo**:

1. Botao **Apontar horas** dentro da task (atalho)
2. Informe horas + minutos + descricao breve
3. Sistema vincula automaticamente a task + projeto
4. Horas entram em:
   - **Capacidade** (sua utilizacao)
   - **Custo do projeto** (relatorio financeiro)
   - **Faturamento** (se cliente externo)

> Faca apontamentos **em tempo real** — esperar sexta-feira leva a esquecimento.

## 5. Subtasks

Tasks grandes (>16h estimadas) sao melhor quebradas:

1. Dentro da task, **+ Subtask**
2. Cada subtask tem:
   - Titulo + descricao
   - Responsavel (pode ser outro)
   - Prazo
   - Horas estimadas
3. Status: TODO / IN_PROGRESS / DONE

A task pai so vira **DONE** quando todas as subtasks estao DONE.

## 6. Comentarios

Use comentarios para:

- Reportar progresso ("50% concluido, prazo mantido")
- Sinalizar bloqueio ("Bloqueado, aguardando acesso ao servidor")
- Pedir review ("Pronto para validacao @joao")
- Documentar decisoes ("Optei pela abordagem X porque Y")

Bloqueios sao especialmente importantes — **comunique cedo**.

## 7. Mover para REVIEW

Quando voce concluiu o trabalho mas precisa de **validacao**:

1. Arraste para **REVIEW**
2. Mencione o revisor no comentario (@nome)
3. Descreva o que foi feito + como testar / validar
4. Sistema notifica o revisor

### O que precisa REVIEW?
- Codigo (code review por outro dev)
- Documento (revisao por lider)
- Entrega ao cliente (homologacao)
- Configuracao critica

### Pode ir direto para DONE?
Sim, tasks **simples sem necessidade de revisao** (ex.: "atualizar documentacao", "subir release patch").

## 8. Aprovar review e mover para DONE

Quando voce e o revisor:

1. Veja a task em **REVIEW**
2. Valide a entrega
3. Se aprovado: **arraste para DONE** + comentario "Aprovado"
4. Se precisar ajuste: comente o que falta + **arraste de volta para IN_PROGRESS**

## 9. Quando a task fica parada

Se uma task ja tem **>1 semana sem update**:

- Sistema sinaliza como **estagnada** (badge amarelo)
- Owner / Lider deve perguntar status no daily/weekly
- Razoes comuns: bloqueio nao reportado, sub-priorizada, dependencia externa

Acoes:
- Bloqueio: marca como **REVIEW** e detalhe o bloqueio (ou comente)
- Sub-priorizada: realmente cancele se nao for prioridade
- Dependencia: linke a outra task ou item

## 10. Filtros uteis no kanban

| Filtro              | Quando usar                          |
|---------------------|--------------------------------------|
| **Minhas tasks**    | Foco no que voce executa             |
| **Por milestone**   | Acompanhar um marco especifico       |
| **Por prazo**       | Tasks vencendo essa semana           |
| **Sem responsavel** | Identificar tasks orfas              |
| **Estagnadas**      | Limpeza periodica                    |

## Permissoes

| Permissao            | O que libera                       |
|----------------------|------------------------------------|
| `projetos:ver`       | Ver tasks de projetos onde e membro |
| `projetos:editar`    | Criar / atribuir / mover tasks     |
| `horas:criar`        | Apontar horas em tasks             |

## Boas praticas

- **Uma task por dia minimo** mudando de coluna
- **Apontar horas ao terminar** (nao deixa pra sexta)
- **Comentarios objetivos** (status, bloqueio, decisao)
- **Quebre tasks > 16h** em subtasks
- **DONE = realmente entregue** — nao DONE de "fiz mas falta deploy"
$md$,
    'publicado', v_cat_op, ARRAY['projetos','tasks','kanban','workflow','procedimento'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  APONTAMENTOS — 1 procedimento (aprovacao)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 5. Aprovar horas (gestor)
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Aprovar horas do time — workflow do gestor',
    'aprovar-horas-time-workflow-gestor',
    'Como gestor, como revisar apontamentos do time, aprovar/rejeitar/devolver e impacto no faturamento de clientes.',
    $md$
# Aprovar horas do time

Se sua organizacao tem **workflow de aprovacao de horas** ativado, todo apontamento de colaborador entra como `pendente`. Cabe ao **gestor direto** revisar e aprovar para que as horas entrem no relatorio definitivo / faturamento.

## 1. Configurar o workflow

O workflow de aprovacao de horas e **configuravel por organizacao**:

1. **Configuracoes -> Workflows -> Horas**
2. Toggle **Ativo**
3. Define quem aprova:
   - Gestor direto do colaborador (padrao)
   - Lider do projeto (alternativa)
   - Comite (multi-aprovador)
4. Define prazo de aprovacao (ex.: 7 dias)
5. Salve

Sem workflow ativo, horas entram automaticamente como **aprovadas**.

## 2. Receber notificacao de pendencia

Quando seu liderado aponta horas:

- Voce recebe **notificacao via sino** + e-mail
- Aparece no **Dashboard -> Pendencias**
- Tambem em **Operacoes -> Horas -> Aprovacoes**

## 3. Revisar apontamentos

1. Acesse **Operacoes -> Horas -> Aprovacoes**
2. Lista mostra:
   - Colaborador
   - Data
   - Horas
   - Vinculo (chamado / projeto / task)
   - Descricao
   - Status: pendente / aprovado / rejeitado

### O que conferir
- **Total de horas no dia faz sentido?** (apontou 14h num dia? Talvez erro)
- **Vinculo correto?** (apontou em "Chamado X" mas chamado nao existe ou nao e dele)
- **Descricao satisfatoria?** (consegue justificar pro cliente?)
- **Conflito com folga / atestado?** (se aprovou ausencia, nao deveria ter apontamento)

## 4. Aprovar

Para cada apontamento:

1. Veja o detalhe
2. Botao **Aprovar**
3. (Opcional) Comentario
4. Sistema:
   - Marca como `aprovado`
   - Horas entram em relatorios definitivos
   - Se cliente externo: vai para faturamento

## 5. Rejeitar

Quando algo nao bate:

1. Botao **Rejeitar**
2. **Informe o motivo** (obrigatorio — o colaborador precisa saber o que corrigir)
3. Sistema:
   - Marca como `rejeitado`
   - Notifica o colaborador
   - Apontamento **nao conta** em relatorios

Colaborador pode editar e re-submeter.

## 6. Devolver para correcao

Se faltou so um detalhe (ex.: descricao vaga):

1. Botao **Devolver**
2. Comentario com o que precisa
3. Status volta para **rascunho** (colaborador edita)

## 7. Aprovacao em lote

Para muitos apontamentos do mesmo periodo:

1. Filtro: colaborador X, semana Y
2. **Selecionar todos**
3. **Aprovar em lote**
4. Confirma

> **Cuidado**: aprovar em lote sem revisar individualmente derrota o proposito do workflow. Faca apenas se voce ja revisou caso a caso.

## 8. Impacto no faturamento

Para apontamentos vinculados a **chamados/projetos de clientes externos**:

- Apontamento `pendente` → **nao entra** em fatura
- Apontamento `aprovado` → **entra automaticamente** quando voce gerar a fatura mensal
- Apontamento `rejeitado` → ignorado permanentemente

## 9. Apontamentos fora do prazo

Se o prazo de aprovacao venceu (ex.: 7 dias):

- Sistema marca como **vencido**
- Notifica o gestor com prioridade
- Em alguns casos, aprovacao automatica (configuravel)

## 10. Relatorio de horas aprovadas

Apos aprovar:

1. **Relatorios -> Horas**
2. Filtros: por colaborador, projeto, cliente, periodo
3. Exporte Excel / CSV
4. Use para:
   - Calculo de banco de horas
   - Faturamento ao cliente
   - Capacidade real do time

## Permissoes

| Permissao            | O que libera                          |
|----------------------|---------------------------------------|
| `horas:aprovar`      | Aprovar / rejeitar / devolver horas   |
| `horas:ver`          | Listar apontamentos                   |
| `horas:editar`       | Editar apontamentos antes de aprovar  |

## Boas praticas

- **Revise semanal** — nao acumule um mes de pendencias
- **Motivo claro ao rejeitar** — colaborador nao deve adivinhar
- **Em lote so se ja revisou** — caso contrario o workflow vira teatro
- **Apontamentos antigos vencidos viram divida tecnica** — limpe periodicamente
- **Comunique mudancas de regra** — se voce mudar criterio de aprovacao, informe o time antes

## Erros comuns

- **"Apontamento ja aprovado"** — outro gestor (cobrindo voce) ja resolveu
- **"Sem permissao"** — colaborador nao e seu liderado direto
- **"Workflow inativo"** — apontamento foi aprovado automaticamente
$md$,
    'publicado', v_cat_op, ARRAY['horas','apontamento','aprovacao','gestor','workflow'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  PESSOAS — 2 procedimentos
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 6. Ausências
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Registrar ausencia — ferias, atestado e folgas',
    'registrar-ausencia-ferias-atestado-folgas',
    'Como colaborador solicita ausencia, gestor aprova e o impacto na capacidade, agenda e SLA de chamados.',
    $md$
# Registrar ausencia

O modulo **Ausencias** controla **ferias**, **atestados medicos**, **folgas** e **licencas** dos colaboradores. Alimenta a **capacidade** (descontando dias indisponiveis) e ajusta automaticamente os calendarios de chamados / projetos.

## 1. Tipos de ausencia

| Tipo            | Caracteristica                                   | Aprovacao                         |
|-----------------|--------------------------------------------------|-----------------------------------|
| **Ferias**      | Periodo legal de descanso, planejado             | Gestor + RH                       |
| **Atestado**    | Doenca, com atestado medico                       | Gestor (RH valida documento)      |
| **Folga**       | Compensacao de banco de horas, ponto facultativo | Gestor                            |
| **Licenca**     | Maternidade, paternidade, luto, casamento, etc.  | Gestor + RH                       |
| **Treinamento** | Curso, congresso, workshop                       | Gestor                            |

## 2. Solicitar uma ausencia (colaborador)

1. Acesse **Pessoas -> Ausencias** (ou icone de calendario no perfil)
2. **+ Nova Ausencia**
3. Preencha:
   - **Tipo**
   - **Data inicio** + **Data fim**
   - **Dias uteis** (calculado automaticamente)
   - **Observacoes** (motivo, se aplicavel)
   - **Anexo** (atestado para tipo "atestado")
4. Salve

Status inicial: **pendente** → aguardando gestor

## 3. Aprovacao do gestor

Gestor direto recebe notificacao + entrada em **Aprovacoes**:

1. Abre a solicitacao
2. Confere:
   - Datas conflitam com prazos de projeto?
   - Time vai ficar coberto durante a ausencia?
   - Saldo de ferias compativel (RH valida)?
3. **Aprovar** ou **Rejeitar** (com motivo)

## 4. Impacto na capacidade

Apos aprovar:

- Dias indisponiveis sao **descontados da jornada do mes**
- Exemplo: jornada 176h/mes, ausencia de 5 dias uteis → jornada cai para 136h
- Heatmap de capacidade reflete imediatamente
- Sugestao de atendente em chamados **desconsidera** quem esta ausente

## 5. Impacto em chamados

Se colaborador esta ausente e tem chamados em aberto:

- Sistema **alerta** na visualizacao do gestor
- Gestor pode usar **transferencia em massa**:
  1. Cadastros -> Usuarios -> abra o colaborador ausente
  2. **Transferir chamados durante ausencia**
  3. Escolhe novo atendente
  4. Sistema atribui todos os chamados pendentes
  5. Quando o colaborador volta, gestor pode reverter

## 6. Impacto em projetos

Tasks com prazo durante a ausencia:

- Sistema sinaliza no kanban (badge amarelo "responsavel ausente")
- Owner do projeto deve reatribuir ou postergar
- Linha do tempo do projeto reflete

## 7. Ausencia retroativa

Para registrar algo que ja aconteceu (ex.: atestado de ontem):

1. Mesmo fluxo, datas no passado
2. Sistema permite mas marca como **retroativa**
3. Gestor decide

## 8. Cancelar ausencia

Antes de iniciar:

1. Abra a ausencia
2. Botao **Cancelar**
3. Status vira `cancelada`
4. Capacidade restaurada

Apos iniciar (em pleno periodo):
- Apenas Gestor / RH pode encurtar
- Datas reais ficam registradas

## 9. Calendario integrado

Veja o time no **calendario coletivo**:

1. **Pessoas -> Ausencias -> Calendario**
2. Visao mensal com todos os colaboradores
3. Cores por tipo (ferias verde, atestado amarelo, folga azul, etc.)
4. Filtros por setor / squad / cargo

Util para planejar reunioes, viagens, lancamentos.

## 10. Relatorios

- **Banco de horas vs. folgas**: balanço por colaborador
- **Saldo de ferias**: dias acumulados vs. tirados
- **Indice de absenteismo**: % de dias ausentes por equipe (medico)
- **Sazonalidade**: meses com mais ausencias (planejamento de contratacao temporaria)

## Permissoes

| Permissao              | O que libera                          |
|------------------------|---------------------------------------|
| `ausencias:criar`      | Solicitar para si proprio             |
| `ausencias:ver`        | Ver proprias + do time (gestor)        |
| `ausencias:aprovar`    | Aprovar / rejeitar (gestor)            |
| `workforce:editar`     | Ajustes administrativos (RH)          |

## Boas praticas

- **Solicite ferias com 30 dias de antecedencia** (CLT exige)
- **Atestado: anexe o documento** — RH pode pedir depois
- **Coordene com o time** — evite varias ausencias simultaneas no mesmo setor
- **Comunique chamados/projetos abertos** — transfira antes de sair
- **Acompanhe saldo de ferias** — vencidas viram passivo trabalhista

## Erros comuns

- **"Saldo insuficiente"** — verifique com RH se ha periodo aquisitivo elegivel
- **"Conflito com data X"** — outro membro do setor ja esta ausente; coordene
- **Capacidade ainda mostra dias ausentes** — aguarde 1h pra recalculo, ou peca refresh manual ao Master
$md$,
    'publicado', v_cat_pes, ARRAY['ausencias','ferias','atestado','folga','workforce'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 7. Skills
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Cadastrar skills e atribuir aos colaboradores',
    'cadastrar-skills-atribuir-colaboradores',
    'Como modelar competencias tecnicas (skills + niveis) e atribuir aos colaboradores — base para o algoritmo de sugestao de atendente.',
    $md$
# Skills (competencias) e atribuicao

O modulo **Skills** modela **o que cada colaborador sabe fazer e em que nivel**. Combinado com Capacidade e Senioridade, alimenta o algoritmo de **Sugestao de atendente** em chamados.

## 1. Conceito

Cada skill e uma **competencia tecnica nominal**. Cada atribuicao a um colaborador tem um **nivel**:

| Nivel    | Significado                                                 |
|----------|-------------------------------------------------------------|
| **Junior**  | Conhece o basico, precisa de supervisao                    |
| **Pleno**   | Trabalha independente, resolve problemas medios            |
| **Senior**  | Resolve problemas complexos, mentora juniors               |
| **Staff**   | Referencia tecnica, define padroes                         |

> Skills devem ser **tecnicas e mensuraveis**. Evite "proatividade" ou "comunicacao" — use para conhecimento tecnico (ferramenta, linguagem, dominio).

## 2. Cadastrar skills da organizacao

1. **Cadastros -> Skills**
2. Botao **+ Nova Skill**
3. Preencha:
   - **Nome** (ex.: "PostgreSQL", "Salesforce", "Lei LGPD")
   - **Descricao** (opcional)
   - **Categoria** (Backend / Frontend / DevOps / Dominio / etc.)
   - **Cor** (visual)
4. Salve

### Exemplos por categoria

**Backend**
- Node.js, TypeScript, Python, Java, Go, .NET
- PostgreSQL, MongoDB, Redis
- REST API, GraphQL

**Frontend**
- React, Vue, Svelte, Angular
- HTML/CSS, Tailwind, design system
- Mobile (RN, Flutter)

**DevOps / Infra**
- AWS, GCP, Azure
- Docker, Kubernetes
- CI/CD (GitHub Actions, GitLab)
- Terraform, Ansible

**Dominio de negocio**
- Contabilidade, RH, Logistica
- LGPD, SOX, ISO
- Industria (Manufatura, Saude, Educacao)

**Ferramentas**
- Salesforce, HubSpot, SAP
- Jira, Notion, Slack admin

## 3. Atribuir skill a colaborador

### Pelo Master / RH
1. **Workforce -> Colaboradores**
2. Abra o colaborador
3. Aba **Skills**
4. **+ Adicionar skill**
5. Selecione skill + **nivel**
6. (Opcional) **Anos de experiencia**
7. Salve

### Auto-cadastro (colaborador)
Se a organizacao permite:
1. Colaborador acessa **Perfil -> Skills**
2. Adiciona skills + niveis que ele tem
3. Master valida (modo aprovacao opcional)

## 4. Usar skills em chamados

Ao abrir / editar um chamado:

1. Campo **Skill requerida** (dropdown)
2. Campo **Nivel minimo** (junior / pleno / senior)
3. Salve

Quando alguem clica em **Sugerir** atendente:

1. Sistema filtra colaboradores que tem essa skill **>= nivel minimo**
2. Ordena por:
   - Match exato de nivel (peso alto)
   - Carga atual (menos chamados abertos)
   - Senioridade geral
3. Retorna **top 5**

## 5. Usar skills em tasks de projeto

Mesma logica — tasks podem ter skill + nivel minimo. Ao atribuir, sistema sugere quem qualifica.

## 6. Relatorio de skills (cobertura)

**Pessoas -> Skills -> Cobertura**:

- Por skill: quantos colaboradores tem e em que nivel
- Por colaborador: quais skills domina
- **Gap analysis**: skills criticas com cobertura baixa (so 1 senior, por exemplo)

Identifica risco — se "Pessoa X" ferida, quem cobre?

## 7. Plano de desenvolvimento

A partir do gap:

1. Defina skills criticas
2. Identifique juniors com potencial para subir
3. Crie plano de mentoria / treinamento
4. Atualize nivel conforme evolui

## 8. Atualizar nivel

Quando colaborador evolui:

1. Workforce -> Colaboradores -> abra
2. Aba Skills
3. Edite o nivel (junior -> pleno, etc.)
4. Comentario (opcional, documenta motivo: "Aprovou certificacao AWS")
5. Salve

Auditoria registra a mudanca.

## 9. Skills inativas

Quando uma tecnologia fica obsoleta (ex.: Flash, jQuery legacy):

1. Skill -> **Inativar** (nao deletar)
2. Atribuicoes existentes ficam no historico
3. Skill nao aparece mais em novos cadastros

## 10. Importacao em massa

Para popular skills de um time grande:

1. Master pode usar **planilha CSV** (consulte Super Admin)
2. Formato: `usuario_email,skill_nome,nivel,anos_exp`
3. Sistema valida e cria

## Permissoes

| Permissao              | O que libera                          |
|------------------------|---------------------------------------|
| `workforce:editar`     | Cadastrar skills, atribuir aos colaboradores |
| `workforce:ver`        | Ver lista de skills                   |

## Boas praticas

- **Tecnico, nao soft** — skills devem ser objetivas
- **Categorias consistentes** — evite "JS", "javascript", "JavaScript" (3 skills diferentes)
- **Revise nivel anualmente** — pessoas evoluem, modele que evoluem
- **Foque cobertura** — uma skill com 1 senior so e risco; mire 2-3 com cobertura
- **Documente niveis** — combinem o que e junior vs. pleno na pratica
$md$,
    'publicado', v_cat_pes, ARRAY['skills','workforce','competencias','sugestao'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  COMERCIAL — 1 procedimento (CRM Pipeline)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 8. CRM Pipeline
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'CRM Pipeline — gestao de oportunidades',
    'crm-pipeline-gestao-oportunidades',
    'Como gerenciar prospects no kanban do pipeline, mover entre estagios, registrar atividades e converter em cliente ao fechar.',
    $md$
# CRM Pipeline

O **Pipeline** do CRM e o kanban onde voce gerencia **oportunidades comerciais** (prospects, leads, propostas). Cada card e uma negociacao caminhando entre estagios ate fechar (ganho ou perdido).

## 1. Estrutura do pipeline

Estagios padrao (configuravel):

| Estagio        | O que significa                                    |
|----------------|----------------------------------------------------|
| **Novo**       | Lead recem-chegado, ainda nao qualificado          |
| **Contato**    | Voce ja falou; entendeu necessidade basica         |
| **Proposta**   | Proposta comercial enviada                         |
| **Negociacao** | Discutindo valor, prazo, escopo                    |
| **Ganho**      | Fechou! Conversao para cliente automatica          |
| **Perdido**    | Nao avancou — registre o motivo                    |

Voce pode customizar estagios em **Configuracoes -> CRM -> Pipeline**.

## 2. Cadastrar uma oportunidade

1. **CRM -> Pipeline**
2. Botao **+ Nova Oportunidade**
3. Preencha:
   - **Titulo** (ex.: "Cliente X - Implantacao ERP")
   - **Empresa** (potencial cliente, com CNPJ se disponivel)
   - **Contato** (nome + e-mail + telefone do interlocutor)
   - **Valor estimado** (R$)
   - **Probabilidade %** (0-100)
   - **Data prevista fechamento**
   - **Responsavel** (vendedor / executivo de contas)
   - **Origem** (Indicacao / Site / Inbound / Outbound / etc.)
   - **Estagio inicial**: Novo
4. Salve

## 3. Mover entre estagios

No kanban, **arraste o card** para o proximo estagio. Cada movimentacao:

- Registra timestamp + responsavel
- Atualiza **probabilidade** (sugestao baseada no estagio)
- Notifica gestor (se configurado)
- Gera linha na **timeline da oportunidade**

## 4. Atividades e historico

Dentro do card de oportunidade, voce registra:

- **Ligacoes** (data, duracao, resumo)
- **Reunioes** (presencial / remota, participantes)
- **E-mails enviados** (anexar se relevante)
- **Documentos** (proposta, contrato, NDA)
- **Comentarios internos** (estrategia, observacoes)
- **Tarefas futuras** (lembrete: "follow-up dia 15")

Cada atividade aparece na **timeline cronologica**.

## 5. Forecast (previsao)

O sistema calcula automaticamente o **forecast do mes / trimestre**:

- Soma `valor x probabilidade` de oportunidades com fechamento previsto no periodo
- Ex.: oportunidade de R$100k @ 70% = R$70k no forecast

**Dashboard -> CRM -> Forecast** mostra:
- Total previsto
- Pipeline cobrindo meta
- Top oportunidades

## 6. Converter em cliente (estagio Ganho)

Quando voce move para **Ganho**:

1. Sistema pergunta: **converter para cliente?**
2. Se sim:
   - Cria registro em **Cadastros -> Clientes** com dados ja preenchidos
   - Linka oportunidade ao cliente
   - (Opcional) Cria projeto automaticamente
3. Status do prospect: **convertido**

Voce pode entao:
- Gerar **contrato**
- Abrir **projeto de implantacao**
- Criar **fatura inicial**

## 7. Perder uma oportunidade

Ao mover para **Perdido**:

1. Modal pede:
   - **Motivo** (preco / prazo / concorrencia / sem fit / sem orcamento)
   - **Concorrente** (se aplicavel)
   - **Comentario** (rica de aprendizado)
2. Salve

Relatorio de **perdidas** ajuda a calibrar pitch + posicionamento.

## 8. Reabrir uma oportunidade

As vezes "Perdido" volta a vida (6 meses depois):

1. Filtre por "Perdidas"
2. Abra o card
3. Botao **Reabrir**
4. Move de volta para estagio anterior
5. Continua negociacao

## 9. Filtros uteis

- **Por responsavel** (meu pipeline)
- **Por estagio** (foco em proposta / negociacao)
- **Por valor** (top 10 oportunidades)
- **Vencendo essa semana** (urgencia)
- **Sem atividade ha 14 dias** (oportunidades esquecidas)

## 10. Indicadores chave

| KPI                          | O que mede                                            |
|------------------------------|-------------------------------------------------------|
| **Win rate**                 | % de oportunidades ganhas / total fechado             |
| **Ciclo medio de venda**     | Tempo medio entre criacao e fechamento                |
| **Ticket medio**             | Valor medio das oportunidades ganhas                  |
| **Conversao por estagio**    | % que avanca de cada estagio para o proximo           |
| **Fontes top**               | Quais origens tem maior win rate / ticket             |

## Permissoes

| Permissao             | O que libera                          |
|-----------------------|---------------------------------------|
| `crm:ver`             | Ver pipeline (proprio / time)         |
| `crm:criar`           | Cadastrar oportunidades               |
| `crm:editar`          | Mover, registrar atividades           |
| `crm:converter`       | Mover para Ganho e criar cliente      |

## Boas praticas

- **Cadastre o quanto antes** — nao deixa lead esfriar no email
- **Atividades semanais** — pipeline sem update = pipeline morto
- **Probabilidade realista** — 90% so apos contrato assinado
- **Sempre registre motivo da perda** — vira inteligencia comercial
- **Revise pipeline na reuniao semanal** — gestor + vendedor
- **Limpe periodicamente** — leads com 90+ dias sem atividade = arquivar
$md$,
    'publicado', v_cat_com, ARRAY['crm','pipeline','vendas','oportunidades','prospects'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  CONFIGURACOES — 2 procedimentos
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 9. Criar papel customizado
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Criar papel customizado de permissoes',
    'criar-papel-customizado-permissoes',
    'Como modelar um papel novo combinando permissoes granulares e atribuir a colaboradores — alternativa ao Master para gestao de risco.',
    $md$
# Criar papel customizado de permissoes

Papel (role) e um **conjunto pre-definido de permissoes** que voce atribui a colaboradores. Em vez de ligar/desligar 50+ permissoes individuais, voce cria papeis e atribui em bloco.

## 1. Quando criar um papel novo

- Time grande com varias funcoes distintas (ex.: "Suporte N1", "Suporte N2", "Gerente de Conta")
- Quer separar quem **ve** financeiro de quem **edita** financeiro
- Quer um papel intermediario entre membro comum e Master
- Cliente externo precisa acesso limitado (so chamados dele + portal)

## 2. Papeis pre-existentes (sugeridos)

O Orkiestri ja vem com alguns papeis prontos:

- **Master** — todas as permissoes (`*`)
- **Atendente** — chamados:* + conhecimento:ver + horas:criar
- **Analista** — Atendente + projetos:editar
- **Gerente** — Analista + capacidade:ver + workforce:editar + relatorios:ver
- **Financeiro** — orcamento:* + faturas:* + contratos:*
- **Comercial** — crm:* + clientes:* + propostas:*

Voce pode usar como base e **clonar** para criar variacoes.

## 3. Criar um papel novo

1. **Configuracoes -> Papeis e Permissoes**
2. Botao **+ Novo Papel**
3. Preencha:
   - **Nome** (ex.: "Suporte N1")
   - **Descricao** (ex.: "Atendimento de chamados de primeiro nivel, sem acesso a financeiro")
   - **Cor** (visual no perfil dos colaboradores)
4. **Permissoes**: lista de checkboxes agrupados por modulo

## 4. Estrutura das permissoes

Permissoes seguem o padrao `<modulo>:<acao>`:

| Modulo          | Acoes tipicas                            |
|-----------------|------------------------------------------|
| chamados        | ver, criar, editar, deletar              |
| projetos        | ver, criar, editar, deletar              |
| orcamento       | ver, criar, editar, aprovar, deletar     |
| workforce       | ver, editar                              |
| cadastros       | ver, criar, editar, deletar              |
| clientes        | ver, criar, editar, deletar              |
| crm             | ver, criar, editar, converter            |
| horas           | ver, criar, editar, aprovar, deletar     |
| relatorios      | ver                                      |
| configuracoes   | ver, editar                              |
| conhecimento    | ver, criar, editar, publicar, deletar    |

Permissao especial **`*`** = tudo. **Apenas no papel Master**.

## 5. Exemplo concreto: papel "Suporte N1"

**Objetivo**: atendente que pega chamados da fila publica, comenta, resolve. Nao acessa financeiro, nao gerencia equipe.

**Permissoes a marcar**:
- ✅ `chamados:ver`
- ✅ `chamados:criar`
- ✅ `chamados:editar` (necessario para Assumir)
- ✅ `horas:criar` (apontar horas no chamado)
- ✅ `horas:ver` (so as proprias)
- ✅ `conhecimento:ver`
- ✅ `clientes:ver` (consulta para entender contexto)
- ❌ `orcamento:*`
- ❌ `workforce:editar`
- ❌ `cadastros:*`
- ❌ `chamados:deletar`

## 6. Exemplo: "Suporte N2"

Extende N1 com:
- ✅ `chamados:deletar`
- ✅ `conhecimento:criar` + `conhecimento:editar` (documentar solucoes)
- ✅ `projetos:ver`
- ✅ `relatorios:ver`

## 7. Exemplo: "Gerente Comercial"

- ✅ `crm:*`
- ✅ `clientes:*`
- ✅ `contratos:*`
- ✅ `propostas:*` (se modulo ativo)
- ✅ `relatorios:ver`
- ✅ `horas:aprovar` (do time comercial)
- ❌ `orcamento:editar` (so ve)
- ❌ `workforce:editar` (RH faz)

## 8. Atribuir papel a colaborador

### Novo colaborador
Durante aprovacao de solicitacao (ou criacao direta), escolha o papel no campo **Perfil / Papel**.

### Colaborador existente
1. **Workforce -> Colaboradores -> abra**
2. Aba **Permissoes**
3. Mude **Papel** (dropdown)
4. Sistema atualiza permissoes imediatamente
5. Colaborador precisa **fazer logout/login** para refletir

## 9. Override de permissoes (permissoes extras)

Voce pode adicionar permissoes **individuais** sem mudar o papel:

1. Colaborador -> Permissoes
2. Aba **Overrides**
3. Adicione `projetos:editar` (extra)
4. Colaborador agora tem papel **+ a extra**

Util para casos pontuais sem criar papel novo.

## 10. Auditoria

Toda mudanca de papel / override fica registrada:
- Quem mudou
- De qual papel para qual
- Data/hora

**Configuracoes -> Auditoria -> filtro acao = "papel_alterado"**.

## Permissoes para gerenciar permissoes

| Permissao                | O que libera                          |
|--------------------------|---------------------------------------|
| `configuracoes:ver`      | Ver lista de papeis                   |
| `configuracoes:editar`   | Criar / editar papeis                 |
| (apenas Master)          | Conceder `*` (Master)                 |

## Boas praticas

- **Principio do menor privilegio** — so de o que e necessario
- **Nomes claros** — "Suporte N1" e melhor que "Papel A"
- **Documente cada papel** — descricao detalhada vira referencia
- **Revise trimestralmente** — papeis nao usados? Inative
- **Cuidado com `*`** — limite a 2-3 pessoas; e poder absoluto
- **Treine antes de promover** — colaborador novo no papel pode quebrar coisa
- **Audite mudancas** — quem virou Master quando e por que

## Erros comuns

- **Usuario nao ve o que deveria** — pediu logout/login? Permissao foi adicionada de fato?
- **"Sem permissao"** persistente — confira se o papel atual realmente tem a permissao listada
- **Cascata: criou papel mas ninguem tem** — atribua a alguem para testar
$md$,
    'publicado', v_cat_cfg, ARRAY['permissoes','papeis','rbac','seguranca','configuracao'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 10. SLA por categoria
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Configurar regras de SLA por categoria',
    'configurar-regras-sla-categoria',
    'Como criar regras de SLA customizadas combinando prioridade x categoria — definir prazos de resposta e resolucao diferenciados.',
    $md$
# Configurar regras de SLA por categoria

O Orkiestri tem **SLA padrao por prioridade** (Baixa=72h, Media=24h, Alta=8h, Critica=2h). Mas voce pode criar **regras customizadas** combinando **prioridade + categoria** para granularidade maior.

## 1. Por que customizar SLA

Casos comuns:
- Chamados de **"Infraestrutura"** sao mais criticos que "Duvida" mesmo na mesma prioridade
- Cliente **gold** tem SLA mais agressivo que cliente padrao
- Chamados de **"Financeiro"** podem aguardar mais que "TI" em alta prioridade
- Time interno vs. cliente externo

## 2. Dois tipos de SLA

| SLA              | O que mede                                              |
|------------------|---------------------------------------------------------|
| **Resposta**     | Tempo entre abertura e **primeiro comentario** do atendente |
| **Resolucao**    | Tempo entre abertura e mudanca para status **resolvido**    |

Ambos contam **horas corridas** desde a criacao (incluindo fim de semana). Se voce trabalha so em horario comercial, ajuste prazos para considerar isso.

## 3. Criar uma regra de SLA

1. **Configuracoes -> SLA -> Regras**
2. Botao **+ Nova Regra**
3. Preencha:
   - **Nome** (ex.: "Infra-Alta")
   - **Prioridade**: baixa / media / alta / critica
   - **Categoria** (opcional; vazio = vale para qualquer categoria com essa prioridade)
   - **SLA Resposta (horas)** — ex.: 1
   - **SLA Resolucao (horas)** — ex.: 4
   - **Ativo**
4. Salve

## 4. Hierarquia de aplicacao

Quando um chamado e criado, o sistema busca a regra **mais especifica**:

1. **Prioridade + Categoria especifica** (ex.: "Critica + Infraestrutura")
2. **Prioridade + Categoria vazia** (ex.: "Critica + qualquer")
3. **SLA padrao do sistema** (fallback)

Garante que voce pode ter regras gerais + excecoes.

## 5. Exemplos praticos

### Cliente Gold (SLA agressivo)
| Prioridade  | Categoria         | Resposta | Resolucao |
|-------------|-------------------|----------|-----------|
| Critica     | (qualquer)        | 30min    | 1h        |
| Alta        | (qualquer)        | 1h       | 2h        |
| Media       | (qualquer)        | 4h       | 8h        |
| Baixa       | (qualquer)        | 8h       | 24h       |

### Time interno (SLA padrao + ajuste)
| Prioridade  | Categoria         | Resposta | Resolucao |
|-------------|-------------------|----------|-----------|
| Critica     | Infraestrutura    | 1h       | 4h        |
| Critica     | (outros)          | 2h       | 4h        |
| Alta        | TI                | 2h       | 6h        |
| Alta        | (outros)          | 4h       | 12h       |

## 6. Diferenciar por cliente (CSAT premium)

Se a regra precisa variar por **cliente** (e nao so categoria):

- (Em breve: regras por cliente — versao 2)
- **Workaround atual**: crie **categorias** que mapeiam ao tipo de cliente
  - "Atendimento Gold - Infra"
  - "Atendimento Gold - Suporte"
  - "Atendimento Padrao - Infra"
  - etc.

## 7. Acompanhar SLA em tempo real

No card do chamado, **badges visuais**:

- **(sem badge)**: SLA OK
- 🟡 **SLA em Risco**: ja consumiu 80%+ do prazo
- 🔴 **SLA Violado**: passou do prazo, ainda nao resolveu

Cron a cada hora recalcula e dispara **alertas** para:
- Atendente
- Gestor direto
- Master da organizacao

## 8. Relatorio de SLA

**Relatorios -> SLA**:
- **Taxa de cumprimento**: % de chamados dentro do prazo
- **Por atendente**: quem cumpre / viola mais
- **Por categoria**: gargalos por tipo
- **Por mes**: tendencia
- **Top violados**: chamados mais atrasados (acao corretiva)

Usado para SLA contratual com clientes externos (acordos formais).

## 9. Pause / Resume do SLA

Em casos onde **aguardando cliente** justifica pausar o contador:

- Mude status para `aguardando` → **pausa o SLA de resolucao**
- Solicitante responde / atualizamos → status volta para `em_atendimento` → SLA volta a contar

> Importante: SLA de **resposta** so conta ate o primeiro comentario; nao pausa.

## 10. Desativar uma regra

Para suspender temporariamente:

1. Configuracoes -> SLA -> Regras
2. Abra a regra
3. Toggle **Ativo** para off
4. Chamados criados a partir de agora usam a proxima regra na hierarquia

## Permissoes

| Permissao              | O que libera                          |
|------------------------|---------------------------------------|
| `configuracoes:editar` | Criar / editar regras de SLA          |
| `configuracoes:ver`    | Ver regras                            |
| `chamados:editar`      | Mudar status (afeta SLA)              |

## Boas praticas

- **Comece com SLA padrao** — so customize quando ver necessidade real
- **Documente regras contratuais** — vincule a contratos (SLA legal)
- **Revise prazos a cada 6 meses** — realidade muda, time cresce
- **Alertas configurados** — sem alerta, SLA violado vira surpresa ruim
- **Conte horas corridas, nao uteis** — clientes externos entendem assim
- **Reduzir SLA aos poucos** — agressivo demais quebra o time

## Erros comuns

- **Chamado "errado" com SLA estranho** — confira regra ativa e categoria do chamado
- **SLA nao atualizou apos mudar prioridade** — UPDATE re-aplica regra; recarregue
- **Relatorio mostra violacao indevida** — confirme se status estava em "aguardando" no periodo
$md$,
    'publicado', v_cat_cfg, ARRAY['sla','configuracao','chamados','prazo'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  RAISE NOTICE 'Seed 3 (orcamento+projetos+pessoas+crm+config) concluido.';
END $$;

SELECT 'Total publicados na Default' AS info, COUNT(*)::text AS valor
  FROM artigos_conhecimento WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND status = 'publicado';
