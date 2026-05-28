-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Procedimentos detalhados de Chamados e Cadastros — Default org
-- Idempotente: ON CONFLICT DO NOTHING via UNIQUE(organization_id, slug)
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_org_id    TEXT := '00000000-0000-0000-0000-000000000001';
  v_autor_id  TEXT;
  v_cat_op    TEXT;
  v_cat_pes   TEXT;
  v_cat_cfg   TEXT;
BEGIN
  SELECT id INTO v_autor_id FROM users WHERE organization_id = v_org_id AND nome ILIKE '%Guilherme%' LIMIT 1;
  IF v_autor_id IS NULL THEN SELECT id INTO v_autor_id FROM users WHERE organization_id = v_org_id LIMIT 1; END IF;
  IF v_autor_id IS NULL THEN RAISE EXCEPTION 'Nenhum usuario na org %', v_org_id; END IF;

  SELECT id INTO v_cat_op  FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Operacoes';
  SELECT id INTO v_cat_pes FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Pessoas';
  SELECT id INTO v_cat_cfg FROM categorias_conhecimento WHERE organization_id = v_org_id AND nome = 'Configuracoes';

  -- ═══════════════════════════════════════════════════════════════════════════
  --  CHAMADOS — 4 procedimentos detalhados
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 1. Como abrir um chamado (solicitante)
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Como abrir um chamado — passo a passo do solicitante',
    'como-abrir-um-chamado-passo-a-passo',
    'Tutorial completo para abrir um chamado de forma que ele seja atendido rapido — titulo claro, prioridade certa, contexto suficiente.',
    $md$
# Como abrir um chamado

Este guia e para quem **precisa de ajuda** — abrir um chamado bem escrito acelera muito a resolucao. Atendentes amam chamados claros.

## 1. Antes de abrir: consulte a base de conhecimento

O Orkiestri ja tem uma **base de conhecimento** com solucoes para problemas comuns. Antes de abrir um chamado:

1. Acesse **Conhecimento** no menu lateral
2. Pesquise pela palavra-chave do seu problema
3. Se encontrar artigo que resolve — perfeito, voce poupou seu tempo e do time

> Dica: ao digitar o titulo de um novo chamado, o sistema **automaticamente sugere artigos relacionados** da KB. Sempre olhe.

## 2. Acessar o modulo

1. No menu lateral, clique em **Operacoes -> Chamados**
2. Voce vera o kanban com 5 colunas (Aberto / Em Atendimento / Aguardando / Resolvido / Fechado)
3. Clique no botao **+ Novo Chamado** no canto superior direito

## 3. Preencher o formulario

### Titulo (obrigatorio)
Seja **especifico**. Compare:

| ❌ Ruim                  | ✅ Bom                                                    |
|--------------------------|----------------------------------------------------------|
| "Sistema travado"        | "Erro 500 ao salvar contrato cliente X"                  |
| "Nao consigo entrar"     | "Login falha com 401 mesmo com senha correta — Chrome"   |
| "Duvida"                 | "Como configurar SLA por categoria no modulo orcamento"  |

### Descricao (obrigatoria)
Inclua:

- **O que voce estava tentando fazer**
- **O que aconteceu** (mensagem de erro, comportamento)
- **O que voce esperava que acontecesse**
- **Passos para reproduzir** (se aplicavel)
- **Quando comecou** (data/hora ajudam debugar)
- **Modulo / tela afetada**

### Prioridade

| Nivel    | Quando usar                                                  | SLA  |
|----------|--------------------------------------------------------------|------|
| Baixa    | Duvida, melhoria, nada urgente                               | 72h  |
| Media    | Funcao prejudicada mas tem workaround                        | 24h  |
| Alta     | Bloqueio em tarefa importante, sem workaround                | 8h   |
| Critica  | Sistema fora do ar, perda de dados, impacto no faturamento   | 2h   |

**Nao infle a prioridade.** Usar "Critica" em tudo so atrasa quem realmente precisa. O time aprende e ignora.

### Categoria (opcional, recomendado)
Escolha entre: Suporte Tecnico / Financeiro / Comercial / RH / TI / Infraestrutura / Duvida / Solicitacao / Reclamacao / Outro.

### Cliente (opcional)
Se o chamado e em nome de um cliente externo, selecione. Isso linka o atendimento ao historico do cliente.

## 4. Salvar como template

Se voce abre chamados parecidos com frequencia (ex.: "Solicitacao de acesso a sistema X"), clique em **+ Salvar como template** depois de preencher. Da proxima vez, escolha o template no dropdown e os campos sao pre-preenchidos.

## 5. Anexar artigo da KB ao chamado

Se voce viu um artigo da KB que descreve seu problema mas a solucao nao funcionou:

1. Clique no artigo sugerido (aparece abaixo do titulo conforme voce digita)
2. O artigo fica linkado ao chamado
3. Atendente ve o link e sabe que voce ja tentou — economiza tempo

## 6. Apos abrir

Voce recebe:
- **Numero do chamado** (ex.: #142)
- **Notificacao WhatsApp** (se WhatsApp ativado no seu perfil)
- **E-mail** de confirmacao

Acompanhe o chamado em **Operacoes -> Chamados -> Meus Chamados**.

## 7. Conversar com o atendente

Quando o atendente comentar, voce recebe notificacao. Para responder:

1. Abra o chamado
2. Role ate o final, area de **Comentarios**
3. Escreva sua resposta
4. **Ctrl+Enter** envia (atalho)

> Atencao: comentarios marcados como **"interno"** sao visiveis apenas a equipe interna. Voce nao ve esses.

## 8. Quando o chamado e resolvido

1. Atendente marca como **Resolvido**
2. Voce recebe notificacao pedindo **avaliacao (CSAT)**
3. Avalie de 1 a 5 estrelas + comentario (opcional)
4. Chamado vira **Fechado**

Veja o artigo **"Como avaliar um atendimento (CSAT)"** para detalhes.

## Checklist final antes de abrir

- [ ] Pesquisei na KB?
- [ ] Titulo e especifico?
- [ ] Descricao tem o erro completo + passos?
- [ ] Prioridade reflete o impacto real?
- [ ] Categoria correta?
- [ ] Cliente vinculado (se for o caso)?

## Permissoes

| Permissao         | O que libera                  |
|-------------------|-------------------------------|
| `chamados:criar`  | Abrir novos chamados          |
| `chamados:ver`    | Acompanhar seus chamados      |
$md$,
    'publicado', v_cat_op, ARRAY['chamados','abrir','tutorial','solicitante','helpdesk'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 2. Como atender um chamado (atendente)
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Como atender um chamado — workflow do atendente',
    'como-atender-um-chamado-workflow-atendente',
    'Manual completo do atendente: assumir da fila, comentarios publicos vs internos, mudanca de status, apontamento de horas e resolucao.',
    $md$
# Como atender um chamado

Manual do atendente. Cobre desde pegar o chamado na fila ate marca-lo como resolvido. Siga este fluxo e voce nao esquece de nada.

## 1. Pegar um chamado da fila

### Pela fila publica
1. Acesse **Operacoes -> Chamados**
2. Clique na aba **Fila Publica** (no topo do board)
3. Veja chamados ordenados por prioridade (criticos primeiro)
4. Clique no card que voce vai pegar
5. No drawer ou no card, clique em **Assumir Chamado**

O sistema:
- Coloca seu nome como **atendente**
- Muda status para **em_atendimento**
- Remove da fila publica
- Notifica o solicitante

> Operacao **atomica**: se outra pessoa clicar no mesmo card ao mesmo tempo, apenas uma assume. A outra recebe "Chamado ja foi assumido por X".

### Atribuicao direta
Master ou solicitante pode atribuir um chamado diretamente a voce. Voce recebe notificacao **WhatsApp + e-mail + sino**.

## 2. Entender o chamado

Antes de comentar, leia tudo:

1. **Titulo + descricao** (problema)
2. **Comentarios anteriores** (contexto se houver)
3. **Historico** (icone de relogio no topo do drawer) — quem fez o que e quando
4. **Solicitante** (clique no nome para ver perfil — outros chamados, contexto)
5. **Cliente vinculado** (se aplicavel)
6. **Artigos KB linkados** (o solicitante pode ter linkado)

## 3. Primeiro comentario = SLA de resposta

O **SLA de Resposta** mede o tempo entre criacao e seu primeiro comentario. Comente **rapido**, mesmo que so para dizer:

- "Recebido, estou olhando"
- "Vou precisar de mais informacoes para continuar (ver perguntas abaixo)"

Isso para o cronometro do SLA de Resposta e tranquiliza o solicitante.

## 4. Comentarios publicos vs internos

Voce tem dois tipos de comentario:

### Publico (default)
- Visivel ao solicitante
- Notifica via WhatsApp + e-mail
- Use para: perguntas, atualizacoes, instrucoes

### Interno
- Marque a checkbox **"Comentario interno"**
- Visivel apenas a Masters e outros atendentes
- Use para: discussao tecnica, suposicoes, escalonar duvida ao time

> Cuidado: solicitante **nao ve** comentarios internos. Tudo que voce quer que ele saiba precisa ser publico.

## 5. Mudar status conforme avanca

Status fluem assim:

```
aberto -> em_atendimento -> aguardando -> resolvido -> fechado
```

| De              | Para               | Quando usar                                          |
|-----------------|--------------------|------------------------------------------------------|
| aberto          | em_atendimento     | Voce assumiu (automatico ao clicar Assumir)          |
| em_atendimento  | aguardando         | Voce esta esperando algo do solicitante / terceiro   |
| aguardando      | em_atendimento     | Recebeu resposta, voltou a trabalhar                 |
| em_atendimento  | resolvido          | Voce resolveu — solicitante precisa confirmar        |
| resolvido       | fechado            | Solicitante avaliou (CSAT) — ciclo encerrado         |

**Nao esquente direto para "fechado"** — quem fecha e o solicitante ao avaliar.

## 6. Transferir / escalar

Se o chamado nao e seu (skill errada, esta sobrecarregado, etc.):

1. No drawer, vah ate **Atendente** (so visivel para Master)
2. Selecione novo atendente

Se voce **nao e Master**, pede para o Master transferir. Ou cria comentario @marcando ele.

> Atalho: Masters podem usar o botao **Sugerir** que mostra top 5 colaboradores com a skill certa e menor carga.

## 7. Apontar horas

Conforme trabalha no chamado, registre o tempo:

1. No drawer do chamado, clique em **+ Apontar horas** (ou va em Operacoes -> Horas)
2. Informe horas + minutos + descricao breve
3. As horas:
   - Entram na sua **capacidade** (utilizacao do mes)
   - Sao consideradas para **faturamento ao cliente** (se cliente vinculado)
   - Ficam no relatorio de hora-homem por chamado

## 8. Resolver

Quando voce concluiu:

1. Faca um **comentario publico de fechamento** explicando o que foi feito
2. Mude status para **resolvido**
3. Solicitante recebe notificacao + pedido de avaliacao

Se voce precisa **documentar a solucao** para futuros chamados parecidos:

1. Crie um artigo na **Base de Conhecimento** (modulo Conhecimento)
2. Use a descricao do problema + passos da solucao
3. Publique
4. Da proxima vez, o sistema sugere automaticamente

## 9. CSAT e fechamento

- Solicitante avalia (1-5 estrelas)
- Status vira **fechado** automaticamente
- Notas baixas (<= 3) alimentam o modulo **CSAT** para analise

## Boas praticas

- **Comente rapido** — protege o SLA de resposta
- **Atualize status com clareza** — solicitante nao precisa adivinhar
- **Use comentarios internos** para discussao tecnica, mas mantenha o solicitante informado
- **Aponte horas em tempo real** — fica perdido se voce esperar a sexta-feira
- **Documente** — todo chamado pode virar artigo na KB

## Permissoes

| Permissao            | O que libera                    |
|----------------------|---------------------------------|
| `chamados:ver`       | Ver chamados onde e atendente   |
| `chamados:editar`    | Assumir, comentar, mudar status |
| `horas:criar`        | Apontar horas no chamado        |
$md$,
    'publicado', v_cat_op, ARRAY['chamados','atendimento','workflow','procedimento','sla'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 3. Transferência e escalonamento
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Transferencia e escalonamento de chamados',
    'transferencia-escalonamento-chamados',
    'Quando e como transferir um chamado para outro atendente, escalar para nivel superior ou devolver para a fila publica.',
    $md$
# Transferencia e escalonamento

Nem sempre o chamado que voce assumiu e o que voce deveria atender. Este artigo explica **quando** e **como** transferir.

## 1. Quando transferir

Transfira sempre que:

- **Skill errada** — voce nao tem o conhecimento tecnico (ex.: chamado de SQL caiu no atendente de redes)
- **Sobrecarga** — voce ja esta em 90%+ de utilizacao
- **Conflito de interesse** — voce e parte interessada (chamado de cliente que voce gerencia)
- **Disponibilidade** — vai entrar de ferias / atestado

**Nao transfira** so para se livrar — fica registrado no historico.

## 2. Quando escalar (vs transferir)

| Acao         | Quando usar                                                              |
|--------------|--------------------------------------------------------------------------|
| Transferir   | Outro atendente do **mesmo nivel** consegue resolver                     |
| Escalar      | Precisa de **nivel superior** (gestor, especialista, fornecedor externo) |

Escalar formalmente:

1. Comente publicamente no chamado: "Escalando para [nome]" com o motivo
2. Atribua para o novo responsavel
3. Mude prioridade se aplicavel (escalonamento geralmente sobe um nivel)

## 3. Como transferir (Master ou solicitante)

1. Abra o chamado
2. Localize o campo **Atendente** (drawer ou pagina detalhe)
3. Mude o dropdown para o novo nome
4. Sistema:
   - Atualiza atendente
   - Notifica novo atendente (WhatsApp + e-mail + sino)
   - Registra na **auditoria** como `transferencia` com `de -> para`
5. (Recomendado) Adicione um comentario explicando o motivo da transferencia

## 4. Como devolver para a fila publica

As vezes voce assumiu e percebeu que outro pode pegar:

1. Abra o chamado
2. No campo **Atendente**, mude para **"Nao atribuido"** (apenas Master / solicitante)
3. Status volta para **aberto**
4. Chamado reaparece na **Fila Publica** para qualquer um assumir

> Apenas Master e o solicitante podem fazer isso. Atendente comum precisa pedir.

## 5. Sugestao automatica (Sugerir)

Master pode usar o botao **Sugerir** ao atribuir:

1. Define a **Skill requerida** + **Nivel minimo** no chamado
2. Clica em **Sugerir** ao lado do dropdown de Atendente
3. Sistema retorna top 5 colaboradores ranqueados por:
   - Match de skill (nivel >= minimo)
   - Carga atual (menos chamados = melhor)
   - Senioridade (desempate)

Cada sugestao mostra: nome, cargo, setor, **% de utilizacao**, **chamados abertos** e **horas alocadas/jornada**.

## 6. Auditoria de transferencias

Toda transferencia fica registrada na **timeline do chamado**:

- Quem transferiu
- De quem para quem
- Data/hora
- Motivo (se comentado)

Acesse pelo icone de **relogio** no topo do drawer.

## 7. Quando escalar para fornecedor externo

Se a solucao depende de terceiros (Microsoft, AWS, fabricante):

1. Mude status para **aguardando**
2. Comente publico: "Aguardando resposta do fornecedor X — chamado deles #12345"
3. Mantenha o chamado **atribuido a voce** (voce e o ponto focal)
4. Atualize com a evolucao
5. Quando resolver, volte para **em_atendimento -> resolvido**

## Boas praticas

- **Comunique antes de transferir** — fale com o novo atendente
- **Justifique no comentario** — futuras consultas agradecem
- **Nao transfira no fim do expediente** — colega sem contexto vai sofrer
- **Escalonamento e ferramenta de qualidade, nao fuga** — escalar evita SLA estourado

## Permissoes

| Permissao            | Quem pode transferir          |
|----------------------|-------------------------------|
| `chamados:editar`    | Master, atendente atual, solicitante |
$md$,
    'publicado', v_cat_op, ARRAY['chamados','transferencia','escalonamento','sla'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 4. CSAT
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Como avaliar um atendimento (CSAT)',
    'como-avaliar-atendimento-csat',
    'Guia do solicitante para avaliar a qualidade de um chamado resolvido — nota, comentario e impacto no time.',
    $md$
# Como avaliar um atendimento (CSAT)

CSAT (**Customer Satisfaction Score**) e a metrica que mede a qualidade percebida do atendimento. **Apenas o solicitante** pode avaliar — e so depois que o atendente marcar como **resolvido**.

## 1. Quando voce pode avaliar

- Chamado precisa estar com status **resolvido**
- Voce precisa ser o **solicitante** (quem abriu)
- Cada chamado e avaliado **uma vez** (sem regravar)

## 2. Como avaliar

1. Quando o atendente resolve, voce recebe **notificacao WhatsApp + e-mail + sino**
2. Abra o chamado
3. Veja a caixa de **avaliacao** no topo (estrelas)
4. Escolha de **1 a 5 estrelas**:

| Estrelas | Significado                                              |
|----------|----------------------------------------------------------|
| ⭐        | Muito insatisfeito — problema nao resolvido / experiencia ruim |
| ⭐⭐       | Insatisfeito — resolvido com dificuldade ou demora       |
| ⭐⭐⭐      | Neutro — resolvido, mas sem destaque                    |
| ⭐⭐⭐⭐     | Satisfeito — bom atendimento                            |
| ⭐⭐⭐⭐⭐    | Muito satisfeito — atendimento excelente                |

5. **Comentario** (opcional, mas muito util): explique a nota
6. Clique em **Enviar avaliacao**

## 3. Apos enviar

- Status do chamado vira **fechado** automaticamente
- Voce **nao consegue mais** comentar nem reabrir
- A nota fica visivel ao atendente e ao gestor dele
- Alimenta os relatorios CSAT do modulo

## 4. E se o problema voltou?

**Nao avalie um chamado nao resolvido.** Se a solucao falhou:

1. **Antes de avaliar**: volte ao chamado e comente "Problema voltou, X e Y"
2. Pede ao atendente para mover status de volta para **em_atendimento**
3. Se ja avaliou e fechou: abra um **novo chamado** mencionando o anterior (#numero)

## 5. CSAT honesto e melhor que CSAT educado

- Avaliacoes infladas mascaram problemas reais
- Atendentes precisam de feedback honesto para melhorar
- Nota baixa nao e ataque pessoal — e dado de gestao

> Se voce sempre da 5 estrelas, o relatorio CSAT perde valor. Calibre.

## 6. Como o CSAT alimenta a gestao

- **Dashboard CSAT** (modulo CSAT): media por atendente, por categoria, por cliente
- **Identificacao de chamados problematicos**: nota <= 2 vira alerta para o gestor
- **Avaliacao de fornecedores externos**: chamados que envolveram terceiros
- **Reconhecimento**: atendentes com CSAT alto recorrente sao destacados

## 7. Visualizar CSAT do time (gestor)

Se voce e Master ou tem permissao `csat:ver`:

1. Acesse **Service Desk -> CSAT**
2. Veja:
   - Media geral
   - Top atendentes
   - Categorias com pior nota (oportunidade de melhoria)
   - Chamados com nota baixa para revisar
   - Tendencia mes a mes

## Permissoes

| Permissao        | Quem pode               |
|------------------|-------------------------|
| (proprio chamado) | Apenas solicitante avalia  |
| `csat:ver`       | Gestor / Master ve relatorio |
$md$,
    'publicado', v_cat_op, ARRAY['chamados','csat','avaliacao','qualidade'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  CADASTROS — 4 procedimentos detalhados
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 5. Aprovar solicitação de acesso (passo a passo do Master)
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Aprovar solicitacao de acesso — passo a passo do Master',
    'aprovar-solicitacao-acesso-passo-a-passo',
    'Modal de 3 etapas: identificacao, provisionamento Workforce e envio de credenciais. Inclui criterios de aprovacao e dicas de seguranca.',
    $md$
# Aprovar uma solicitacao de acesso

Este e o procedimento detalhado para Master / Admin aprovar uma nova solicitacao de acesso ao sistema. O fluxo tem 3 etapas no modal e gera automaticamente: usuario, perfil Workforce e envio de credenciais.

## 1. Localizar a solicitacao

1. Faca login como **Master** da organizacao
2. Acesse **Cadastros -> Solicitacoes**
3. Veja a lista de pendentes (status **pendente**)

Cada card mostra:
- Nome, e-mail, WhatsApp
- Cargo, departamento, empresa
- Motivacao (texto livre que o candidato escreveu)
- Data da solicitacao

## 2. Avaliar antes de aprovar

Faca essas perguntas antes de clicar em **Aprovar**:

- [ ] **A pessoa e da minha empresa?** (confira pelo e-mail corporativo)
- [ ] **O cargo bate com o que vou liberar?** (gerente nao deve ter acesso pleno se vai operar como analista)
- [ ] **Tenho gestor para ela?** (precisa ser pre-cadastrado para aparecer no select)
- [ ] **Tenho setor cadastrado?** (Cadastros -> Setores)
- [ ] **Existe papel adequado?** (Configuracoes -> Papeis)

Se faltar algo, **cadastre antes** ou pause a aprovacao.

## 3. Etapa 1 — Identificacao

Clique em **Aprovar** no card. Modal abre com **Etapa 1: Identificacao**.

Confirme/edite:
- **Nome completo**
- **E-mail** (sera o login — atencao a digitacao)
- **WhatsApp** (com DDI, ex.: +55 11 98765-4321)
- **Cargo**
- **Departamento**
- **Empresa**

Clique em **Proximo**.

## 4. Etapa 2 — Provisionamento Workforce

Esta e a etapa **mais importante**. Define como o colaborador aparece na estrutura.

### Setor (obrigatorio)
Setor que o colaborador pertence. Define hierarquia e visibilidade. Ex.: TI, Comercial, Operacoes.

### Gestor (obrigatorio)
Quem **aprova** horas, ausencias, despesas dele. Tipicamente o head do setor ou supervisor direto.

### Perfil / Papel de permissoes (obrigatorio)
Define o que ele acessa. Exemplos comuns:
- **Atendente N1**: chamados:* + conhecimento:ver
- **Analista**: + projetos:editar + horas:criar
- **Gerente**: + relatorios:ver + capacidade:ver + workforce:editar
- **Master**: `*` (todas as permissoes)

> **Cuidado com o Master**: nao distribua de graca. Limite a 2-3 pessoas confiaveis por organizacao.

### Squad (opcional)
Equipe transversal — ex.: "Squad Produto", "Squad Cliente Premium". Util para times de produto.

### Matricula
Gerada **automaticamente** pelo sistema: 3 letras da organizacao + 4 digitos sequenciais. Ex.: `DEF0001`, `MEL0042`.

### Senioridade (recomendado)
- **Junior** — < 3 anos de experiencia
- **Pleno** — 3-7 anos
- **Senior** — 7+ anos
- **Staff** — referencia tecnica / especialista

Alimenta o algoritmo de **Sugestao de atendente** em chamados.

### Tipo de vinculo
- **CLT** / **PJ** / **Estagio** / **Terceiro** — para relatorios de RH.

### Jornada (h/dia)
Padrao 8h. Reduza para estagiarios (4-6h), aumente para escala 12x36 etc. Usado para calculo de **capacidade**.

Clique em **Proximo**.

## 5. Etapa 3 — Confirmacao e envio

Modal mostra resumo. Confira tudo. Se algo errado, volte com **Anterior**.

Quando estiver certo, clique em **Aprovar**.

### O que acontece automaticamente:

1. Sistema **gera senha temporaria** aleatoria (12 caracteres, mix de letras+numeros+simbolos)
2. **Cria usuario** com a senha temporaria
3. **Cria perfil Workforce** (setor, gestor, papel, etc.)
4. **Aplica permissoes** do papel
5. **Envia credenciais** por:
   - WhatsApp (se preenchido)
   - E-mail
6. Marca solicitacao como **aprovada**

### Tela de sucesso

Apos aprovar, voce ve:
- E-mail e senha temporaria (em destaque, para conferencia)
- Status do envio:
  - ✓ E-mail entregue / ⚠ E-mail nao entregue
  - ✓ WhatsApp entregue / ⚠ WhatsApp nao entregue
- Botao **Copiar credenciais** (para caso voce queira enviar manual)

> **Se nenhum dos dois entregou**, copie e envie manualmente por outro canal seguro. Nunca envie senha por canal aberto (Slack publico, chat de Teams).

## 6. Apos aprovar

- O colaborador faz login com a senha temporaria
- No **primeiro login**, sistema **forca troca de senha** (minimo 8 caracteres)
- Apos trocar, acessa o sistema normalmente
- Voce pode acompanhar em **Cadastros -> Usuarios** (status: ativo)

## 7. Rejeitar uma solicitacao

Se nao deve ser aprovada:

1. Clique em **Rejeitar** no card
2. Informe o **motivo** (opcional, mas profissional)
3. Sistema notifica o candidato por e-mail com o motivo

Solicitacao rejeitada **nao deleta** — fica como historico (status `rejeitada`).

## Permissoes

| Permissao              | O que libera                            |
|------------------------|-----------------------------------------|
| `cadastros:ver`        | Listar solicitacoes                     |
| `cadastros:editar`     | Aprovar / rejeitar                      |
| `cadastros:criar`      | Criar usuario direto (sem solicitacao)  |

## Erros comuns

- **"E-mail ja cadastrado"** — usuario existe (em qualquer tenant). Use **Cadastros -> Usuarios** para reativar
- **"Setor obrigatorio"** — cadastre setores antes
- **"WhatsApp invalido"** — formato correto: +55DDDNUMERO sem espacos no envio
- **Senha nao chegou** — verifique se WhatsApp da organizacao esta conectado (Configuracoes -> WhatsApp); copie manual pela tela de sucesso
$md$,
    'publicado', v_cat_pes, ARRAY['cadastro','aprovacao','onboarding','master'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 6. Criar usuário direto (sem solicitação)
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Criar usuario diretamente (sem solicitacao publica)',
    'criar-usuario-diretamente-sem-solicitacao',
    'Atalho do Master para criar usuarios sem passar pelo formulario publico — util para colaboradores ja contratados ou bulk loading.',
    $md$
# Criar usuario diretamente

O fluxo padrao e: candidato solicita acesso, Master aprova. Mas as vezes voce **ja sabe** quem vai entrar (contratacao formal, migracao em massa) e nao faz sentido esperar a solicitacao publica.

Este artigo cobre o **atalho de criacao direta**.

## 1. Quando usar

- Colaborador ja foi contratado (RH informou)
- Migracao em massa (planilha de N pessoas)
- Convite formal a um cliente / parceiro externo
- Re-criacao de usuario apagado

## 2. Pre-requisitos

Cadastre antes:
- **Setores** (Cadastros -> Setores)
- **Papeis e permissoes** (Configuracoes -> Papeis)
- **Gestores** (precisam ser usuarios ja ativos)

## 3. Criar um usuario

1. Acesse **Cadastros -> Usuarios**
2. Clique em **+ Novo Usuario** (canto superior)
3. Modal abre com **as 2 etapas** (Identificacao + Workforce):

### Identificacao
- **Nome completo** (obrigatorio)
- **E-mail** (obrigatorio, sera o login)
- **WhatsApp** (recomendado — habilita OTP de senha e notificacoes)
- **Cargo / Departamento / Empresa**

### Workforce
- **Setor** (obrigatorio)
- **Gestor** (obrigatorio)
- **Papel / Perfil de permissoes** (obrigatorio)
- **Squad** (opcional)
- **Senioridade** (recomendado)
- **Tipo de vinculo** (recomendado)
- **Jornada h/dia** (default 8)

4. Clique em **Criar**

## 4. O que acontece

Identico ao fluxo de aprovacao de solicitacao:

1. Senha temporaria aleatoria gerada (12 caracteres)
2. Usuario criado com permissoes do papel
3. Perfil Workforce gerado
4. **Credenciais enviadas** por WhatsApp + e-mail
5. Tela de sucesso mostra senha + status de envio + botao **Copiar credenciais**

## 5. Bulk loading (varios de uma vez)

Para criar muitos usuarios:

1. Crie um por um pela interface (modal)
2. Ou peca ao **Super Admin** um endpoint de importacao via CSV (nao publico)

> **Atencao**: importacao por CSV pula validacoes de UI. Use apenas com dados confiaveis.

## 6. Convidar Master

Para criar **outro Master** da sua organizacao:

1. Mesmo fluxo de criacao direta
2. Escolha o papel **Master** na etapa Workforce
3. Sistema gera credenciais e envia

> **Limite a 2-3 Masters por organizacao.** Master tem `*` — pode tudo. Risco de seguranca em excesso.

## 7. Criar usuario sem WhatsApp

Permitido. Apenas e-mail recebe a senha. **Recomendacao**: peca para o colaborador cadastrar WhatsApp no perfil dele depois — habilita OTP e notificacoes.

## 8. Resetar senha do usuario que voce acabou de criar

Se o usuario nao recebeu / perdeu a senha:

### Opcao 1 — Re-enviar credenciais
1. Cadastros -> Usuarios -> abra o usuario
2. Clique em **Reenviar credenciais** (gera nova senha temporaria + envia)

### Opcao 2 — Pedir para o usuario usar "Esqueci minha senha"
Veja o artigo **"Redefinir senha — esqueci-senha e OTP via WhatsApp"**.

## 9. Diferenca: Criar direto vs. Aprovar solicitacao

| Aspecto                  | Solicitacao + Aprovacao            | Criacao direta              |
|--------------------------|------------------------------------|------------------------------|
| Quem inicia              | Candidato                          | Master                       |
| Etapas                   | 2 (candidato + Master)             | 1 (so Master)                |
| Motivacao registrada     | Sim (texto do candidato)           | Nao                          |
| Velocidade               | Depende do candidato responder     | Imediato                     |
| Auditoria                | Mais rica (solicitacao + decisao)  | Apenas o registro de criacao |

## Permissoes

| Permissao             | O que libera                |
|-----------------------|------------------------------|
| `cadastros:criar`     | Criar usuarios diretamente   |
| `cadastros:editar`    | Editar dados                 |
| `cadastros:ver`       | Listar usuarios              |

## Erros comuns

- **"E-mail ja existe"** — usuario ja foi criado, busque na lista
- **"Gestor invalido"** — gestor selecionado nao esta ativo / nao existe
- **"Setor obrigatorio"** — cadastre antes
- **WhatsApp invalido** — formato deve ser +55 + DDD + numero
$md$,
    'publicado', v_cat_pes, ARRAY['cadastro','usuario','criar','master','onboarding'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 7. Redefinir senha
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Redefinir senha — esqueci-senha e OTP via WhatsApp',
    'redefinir-senha-esqueci-otp-whatsapp',
    'Dois fluxos para recuperar acesso quando esqueceu a senha: link por e-mail e codigo OTP por WhatsApp.',
    $md$
# Redefinir senha

Se voce esqueceu a senha, o Orkiestri tem **dois fluxos** para recuperar acesso. Use o que for mais conveniente.

## Fluxo 1 — Link por e-mail (esqueci-senha)

### Quando usar
- Voce tem acesso ao **e-mail cadastrado** no sistema

### Passos
1. Acesse a tela de login
2. Clique em **"Esqueci minha senha"**
3. Informe seu **e-mail**
4. Clique em **Enviar**
5. Verifique sua caixa de entrada (e a pasta de spam)
6. Voce recebe um e-mail com **link** + **token** (valido por 1h)
7. Clique no link
8. Defina sua **nova senha** (minimo 8 caracteres)
9. Faca login com a nova

### Rate-limit
- 5 solicitacoes por **15 minutos** por IP
- Excedeu? Aguarde 15 minutos

## Fluxo 2 — Codigo OTP via WhatsApp

### Quando usar
- Voce **nao tem mais acesso ao e-mail** (esqueceu / saiu da empresa anterior / etc.)
- Voce tem WhatsApp cadastrado no perfil
- Voce tem o celular em maos

### Passos
1. Acesse a tela de login
2. Clique em **"Esqueci minha senha"**
3. Mude a aba para **"Por WhatsApp"**
4. Informe seu numero (com DDI, ex.: +55 11 98765-4321)
5. Clique em **Enviar OTP**
6. WhatsApp recebe um codigo de **6 digitos** (valido por 10 minutos)
7. Volte ao site
8. Informe o codigo recebido
9. Defina sua **nova senha**
10. Faca login

### Rate-limit
- 5 envios de OTP por 15 minutos por IP
- 10 tentativas de verificacao por 15 minutos por IP

## 3. O que NAO usar

- ❌ **Pedir senha por Slack/Teams para um colega** — comprometido
- ❌ **Pedir Master para "te passar a senha"** — Master nao tem sua senha, so pode resetar
- ❌ **Usar senha de outro sistema** — cada sistema separado, sem reuso

## 4. Master nao consegue ver sua senha

Senhas sao **hash bcrypt irreversivel**. Nem o Master nem o desenvolvedor podem ver. Quando Master "reseta sua senha", ele gera uma nova **aleatoria** e te envia.

## 5. Bloqueio por tentativas erradas

Se voce errar a senha **5 vezes**, sua conta e **bloqueada por 15 minutos** por IP. Aparece a mensagem "Muitas tentativas. Aguarde X minuto(s).".

Apos 15 minutos, o contador zera. Voce pode tentar de novo ou usar **Esqueci minha senha**.

## 6. Conta travada mesmo apos 15 minutos

Pode estar travada por motivo administrativo (Master suspendeu). Veja o artigo **"Desbloquear usuario travado"**.

## 7. Trocar senha quando voce LEMBRA a atual

Se voce sabe a senha mas quer trocar (boa pratica):

1. Faca login normalmente
2. Acesse **Perfil -> Seguranca**
3. Informe senha atual + nova
4. Salve

## Permissoes

Tudo neste fluxo e **publico** — voce nao precisa de permissao. So precisa do canal:
- E-mail cadastrado, ou
- WhatsApp cadastrado

## Erros comuns

- **"E-mail nao encontrado"** — confirme se voce digitou correto; sistema nao revela se existe (anti-enumeracao)
- **"WhatsApp nao cadastrado"** — voce nao tem WhatsApp no perfil; use o fluxo de e-mail
- **"Codigo invalido"** — codigo expirou (10 min) ou digitou errado; gere novo
- **"Token invalido"** — link de e-mail expirou (1h) ou ja foi usado; gere novo
- **"Muitas tentativas"** — rate-limit; aguarde 15 minutos
- **OTP nao chegou** — WhatsApp da organizacao pode estar desconectado; tente o fluxo de e-mail

## Seguranca

- Tokens e codigos **expiram** rapido (1h / 10min)
- Tokens sao **single-use** (usado uma vez, invalidado)
- Senha nova precisa ter **minimo 8 caracteres**
- Recomendado: mistura de letras, numeros e simbolos
- **Nao reuse** senha de outros sistemas
$md$,
    'publicado', v_cat_pes, ARRAY['senha','recuperacao','otp','whatsapp','login'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  -- 8. Desbloquear usuário
  INSERT INTO artigos_conhecimento
    (id, organization_id, titulo, slug, resumo, conteudo, status, categoria_id, tags, visualizacoes, autor_id, publicado_em, criado_em, atualizado_em)
  VALUES (gen_random_uuid()::text, v_org_id,
    'Desbloquear usuario travado',
    'desbloquear-usuario-travado',
    'Como o Master destrava colaborador apos bloqueio por tentativas de senha, suspensao administrativa ou conta inativa.',
    $md$
# Desbloquear usuario travado

Ha tres tipos de "travamento" no Orkiestri. Cada um tem origem e solucao distinta. Este artigo cobre os tres.

## Tipo 1 — Rate-limit de login (5 tentativas erradas)

### Sintoma
Usuario relata: **"Esta dando 'Muitas tentativas. Aguarde X minuto(s)'."**

### Causa
Sistema detectou 5 senhas erradas no mesmo IP em janela de 15 minutos. **Anti-brute-force**.

### Solucao
**Espere 15 minutos.** Nao precisa Master fazer nada. O contador zera automaticamente apos a janela.

Se urgente: usuario pode usar **"Esqueci minha senha"** que **nao bloqueia** (caminho separado).

## Tipo 2 — Suspensao administrativa

### Sintoma
Login retorna **"Conta suspensa"** ou usuario nao consegue logar mas a senha esta correta.

### Causa
Master suspendeu o acesso intencionalmente (saida da empresa, ferias longas, suspeita de seguranca).

### Solucao
1. Master acessa **Cadastros -> Usuarios**
2. Filtra por **status: suspenso**
3. Abre o usuario
4. Clica em **Reativar conta**
5. Sistema:
   - Marca como ativo
   - Notifica o usuario por e-mail / WhatsApp

Em alguns casos, ao reativar e recomendado **resetar a senha** (botao **Reenviar credenciais**).

## Tipo 3 — Bloqueio por inatividade

### Sintoma
Usuario que nao acessa ha muitos meses recebe alerta de **"Conta inativa, contate o Master"**.

### Causa
Politica de seguranca da organizacao (configuravel) bloqueia contas sem login ha **N dias** (default: 180 dias).

### Solucao
Mesmo procedimento do Tipo 2 — reativar via Cadastros -> Usuarios.

## Endpoint de desbloqueio rapido

Master pode usar:

1. **Cadastros -> Usuarios**
2. Selecione o usuario
3. Menu **Acoes** (tres pontinhos)
4. **Desbloquear**

Equivalente a chamada `PATCH /auth/desbloquear/:id` (apenas Master / `cadastros:editar`).

## Como diferenciar os tipos

| Sintoma                                | Tipo               | Acao                             |
|----------------------------------------|--------------------|----------------------------------|
| "Muitas tentativas, aguarde X min"     | Rate-limit         | Esperar 15 min OU "Esqueci senha"|
| "Conta suspensa"                       | Suspensao admin    | Master reativa                   |
| "Conta inativa"                        | Inatividade        | Master reativa                   |
| "Credenciais invalidas" persistente    | Senha esquecida    | Usar "Esqueci minha senha"       |

## E se o usuario nao lembra mais a senha apos destravar?

1. Master destrava (Tipo 2 ou 3)
2. Usuario tenta logar — nao lembra senha
3. Usuario usa **Esqueci minha senha** (e-mail ou OTP WhatsApp)
4. Define nova senha
5. Acessa normalmente

OU Master pode **resetar e enviar nova senha temporaria**:

1. Cadastros -> Usuarios -> abra usuario
2. **Reenviar credenciais**
3. Sistema gera senha nova + envia por WhatsApp/e-mail
4. Usuario faz login e troca no primeiro acesso

## Auditoria

Toda acao de desbloqueio fica registrada:
- Quem desbloqueou
- Quando
- Qual usuario foi desbloqueado
- IP de origem

Acesse **Configuracoes -> Auditoria** para consultar.

## Permissoes

| Permissao             | O que libera                          |
|-----------------------|---------------------------------------|
| `cadastros:editar`    | Suspender / reativar / desbloquear    |
| `cadastros:ver`       | Listar usuarios e status              |

## Boas praticas

- **Rate-limit nao requer Master** — espere 15 min ou guie ao "Esqueci senha"
- **Suspenda saidas de funcionarios no mesmo dia** — risco de acesso indevido
- **Documente o motivo da suspensao** (comentario / observacao no perfil)
- **Revise suspensos mensalmente** — usuarios suspensos ha muito tempo devem ser **deletados** (LGPD)
- **Auditoria habilitada sempre** — exigencia de compliance
$md$,
    'publicado', v_cat_pes, ARRAY['usuario','desbloqueio','suspensao','seguranca','rate-limit'], 0,
    v_autor_id, NOW(), NOW(), NOW())
  ON CONFLICT (organization_id, slug) DO NOTHING;

  RAISE NOTICE 'Seed chamados+cadastros concluido. Autor: %', v_autor_id;
END $$;

-- Resumo final
SELECT 'Total publicados na Default' AS info, COUNT(*)::text AS valor
  FROM artigos_conhecimento WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND status = 'publicado';
