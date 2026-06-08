#!/usr/bin/env python3
"""
Seed do módulo de Conhecimento do Orkiestri.
Cria categorias e artigos de documentação para cada módulo do sistema.
"""

import json, subprocess, time, sys

BASE = "http://api:3000/api"

def api(method, path, body=None, token=None):
    headers = ["-H", "Content-Type: application/json"]
    if token:
        headers += ["-H", f"Authorization: Bearer {token}"]
    cmd = ["curl", "-s", "-X", method, BASE + path] + headers
    if body:
        cmd += ["-d", json.dumps(body)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    try:
        return json.loads(result.stdout)
    except:
        print(f"  [ERRO] {method} {path}: {result.stdout[:200]}")
        return {}

# 1. Login
print("Autenticando...")
login = api("POST", "/auth/login", {"email": "administrator@orkiestri.com", "senha": "Baiano@1427*"})
token = login.get("accessToken", "")
if not token:
    print("ERRO: login falhou:", login)
    sys.exit(1)
print(f"  Token obtido: {token[:20]}...")

# 2. Criar categorias
CATEGORIAS = [
    {"nome": "Primeiros Passos",        "icone": "🚀", "cor": "#a78bfa", "ordem": 1,  "descricao": "Como começar a usar o Orkiestri"},
    {"nome": "Command Center",           "icone": "🖥️", "cor": "#3b82f6", "ordem": 2,  "descricao": "Dashboard principal e visão operacional"},
    {"nome": "Service Desk & Chamados", "icone": "🎫", "cor": "#f59e0b", "ordem": 3,  "descricao": "Gestão de chamados e atendimento"},
    {"nome": "Projetos & Tarefas",      "icone": "📁", "cor": "#10b981", "ordem": 4,  "descricao": "Gerenciamento de projetos e kanban"},
    {"nome": "Agenda & Eventos",        "icone": "📅", "cor": "#06b6d4", "ordem": 5,  "descricao": "Calendário e compromissos"},
    {"nome": "Ativos & CMDB",           "icone": "💻", "cor": "#8b5cf6", "ordem": 6,  "descricao": "Gestão de equipamentos e dependências"},
    {"nome": "Orçamento & Financeiro",  "icone": "💰", "cor": "#f97316", "ordem": 7,  "descricao": "CAPEX, OPEX e gestão financeira"},
    {"nome": "CRM & Comercial",         "icone": "🤝", "cor": "#ec4899", "ordem": 8,  "descricao": "Clientes, contratos e faturas"},
    {"nome": "Aprovações & Processos",  "icone": "✅", "cor": "#34d399", "ordem": 9,  "descricao": "Fluxos de aprovação e workflow"},
    {"nome": "People & Workforce",      "icone": "👥", "cor": "#fbbf24", "ordem": 10, "descricao": "Gestão de equipe e colaboradores"},
    {"nome": "IA & Automações",         "icone": "🤖", "cor": "#60a5fa", "ordem": 11, "descricao": "Inteligência operacional e automações"},
    {"nome": "Administração",           "icone": "⚙️", "cor": "#94a3b8", "ordem": 12, "descricao": "Configurações, usuários e permissões"},
]

print("\nCriando categorias...")
cat_ids = {}
for c in CATEGORIAS:
    r = api("POST", "/conhecimento/categorias", c, token)
    cid = r.get("id", "")
    if cid:
        cat_ids[c["nome"]] = cid
        print(f"  ✓ {c['nome']} ({cid[:8]}...)")
    else:
        print(f"  ✗ Falha: {c['nome']} → {r}")
    time.sleep(0.2)

# 3. Artigos por categoria
ARTIGOS = [

  # ── PRIMEIROS PASSOS ──────────────────────────────────────────────────────
  {
    "cat": "Primeiros Passos",
    "titulo": "Bem-vindo ao Orkiestri — Visão Geral da Plataforma",
    "resumo": "O que é o Orkiestri, seus módulos principais e como navegar.",
    "tags": ["introdução", "overview", "navegação"],
    "conteudo": """# Bem-vindo ao Orkiestri

O **Orkiestri** é uma plataforma corporativa de gestão operacional que centraliza chamados, projetos, equipes, ativos, financeiro e inteligência artificial em uma única solução.

## Estrutura da Plataforma

A plataforma é organizada em grupos no menu lateral esquerdo:

| Grupo | Módulos |
|-------|---------|
| **Visão Geral** | Command Center, Executivo, IA Operacional, Relatórios |
| **Service Desk** | Catálogo, Chamados, Horas, CSAT, Conhecimento |
| **Operações** | Projetos, Gantt, Agenda, Ativos, CMDB, Processos, Workforce, Capacidade, Aprovações, Orçamento, Keep |
| **CRM** | Clientes, Contratos, Faturas |
| **Admin** | Cadastros, Fornecedores, Automações, WhatsApp, Histórico, Configurações |

## Navegação Básica

- **Menu lateral**: clique em qualquer item para navegar
- **Busca global**: `Ctrl+K` (ou botão Buscar no topo) para pesquisa rápida
- **Tema**: botão ☀️/🌙 no canto superior direito alterna entre claro e escuro
- **Perfil**: clique no avatar no rodapé do menu

## Conceitos Fundamentais

**Multi-tenant**: cada organização tem seus dados completamente isolados. Um usuário vê apenas os dados da sua organização.

**Permissões por perfil**: cada usuário tem um papel (Master, Administrador, Gestor, Analista, Técnico) que define o que pode ver e fazer.

**SLA**: prazo máximo de resolução de chamados, calculado automaticamente por prioridade e configurável por regras.
"""
  },

  {
    "cat": "Primeiros Passos",
    "titulo": "Primeiro Acesso — Configuração Inicial",
    "resumo": "Passo a passo para configurar o sistema no primeiro acesso.",
    "tags": ["primeiro acesso", "setup", "configuração"],
    "conteudo": """# Primeiro Acesso — Configuração Inicial

## 1. Definir sua Senha

Ao receber o convite, acesse o link e defina sua senha. A senha deve ter no mínimo 8 caracteres, com letras e números.

## 2. Completar o Perfil

Vá em **Menu → seu nome → Meu Perfil** e preencha:
- Nome completo
- Telefone (para notificações WhatsApp)
- Avatar (opcional)

## 3. Configurar a Organização (Masters)

Se você é o **Master** da organização:

1. Acesse **Configurações → Organização**
2. Preencha CNPJ, endereço e dados comerciais
3. Ative os módulos necessários em **Módulos Ativos**

## 4. Cadastrar Usuários

1. Vá em **Cadastros → Usuários**
2. Clique em **Novo Usuário**
3. Informe nome, e-mail e perfil de acesso
4. O usuário receberá um e-mail com instruções de acesso

## 5. Configurar SLA

1. Acesse **Configurações → SLA**
2. Defina prazos de resposta e resolução por prioridade
3. Recomendado: Urgente 2h, Alta 8h, Média 24h, Baixa 72h

## 6. Definir Aprovadores

1. Vá em **Aprovações → Configurar Aprovadores**
2. Associe um aprovador por setor/departamento
3. Configure backup para períodos de ausência

## 7. Testar o Sistema

Crie um chamado de teste via **Catálogo de Serviços → Suporte Técnico** para verificar o fluxo completo de notificações.
"""
  },

  {
    "cat": "Primeiros Passos",
    "titulo": "Perfis de Acesso e Permissões",
    "resumo": "Entenda os perfis disponíveis e o que cada um pode fazer.",
    "tags": ["permissões", "perfis", "acesso", "RBAC"],
    "conteudo": """# Perfis de Acesso e Permissões

O Orkiestri utiliza controle de acesso baseado em papéis (RBAC). Cada usuário tem um perfil que define suas permissões.

## Perfis Disponíveis

### 🔴 Master
Acesso total ao sistema. Pode:
- Gerenciar todos os usuários e perfis
- Ver todos os dados da organização
- Configurar SLA, automações e integrações
- Acessar relatórios completos
- Fazer override em qualquer processo

### 🟠 Administrador
Acesso administrativo. Pode:
- Gerenciar usuários (exceto Masters)
- Configurar módulos operacionais
- Ver relatórios de toda a organização
- Criar e editar todos os registros

### 🟡 Gestor
Acesso gerencial. Pode:
- Ver e gerenciar sua equipe
- Aprovar solicitações do setor
- Ver relatórios do setor
- Criar projetos e atribuir tarefas

### 🔵 Analista
Acesso operacional avançado. Pode:
- Criar e editar chamados, projetos e tarefas
- Registrar horas
- Ver base de conhecimento

### 🟢 Técnico
Acesso operacional básico. Pode:
- Atender chamados atribuídos
- Registrar horas
- Comentar em chamados

## Permissões por Módulo

Cada módulo tem permissões granulares: `ver`, `criar`, `editar`, `deletar`.
O Master pode personalizar as permissões de cada perfil em **Configurações → Perfis**.

## Dica

Para conceder acesso temporário a um módulo específico sem mudar o perfil do usuário, use **Configurações → Permissões Individuais**.
"""
  },

  # ── COMMAND CENTER ────────────────────────────────────────────────────────
  {
    "cat": "Command Center",
    "titulo": "Command Center — Central Operacional",
    "resumo": "Como usar o dashboard principal para monitorar todas as operações em tempo real.",
    "tags": ["dashboard", "command center", "KPI", "tempo real"],
    "conteudo": """# Command Center — Central Operacional

O **Command Center** é a tela principal do Orkiestri. Acesse em **Menu → Visão Geral**.

## Status Bar

A barra no topo indica a saúde geral da operação:
- 🟢 **OPERACIONAL**: tudo dentro dos parâmetros
- 🟡 **ATENÇÃO NECESSÁRIA**: alertas de média prioridade
- 🟠 **ALERTAS ATIVOS**: problemas que requerem ação
- 🔴 **ESTADO CRÍTICO**: SLA violados ou urgências abertas

## Sector Widgets (4 quadrantes)

### 🎫 Chamados
- **Abertos**: chamados aguardando ou em atendimento
- **Em Atendimento**: chamados com atendente trabalhando
- **Urgentes**: prioridade urgente em aberto (ação imediata)
- **SLA Violados**: chamados fora do prazo (crítico)
- **SLA Compliance**: percentual dentro do prazo (meta: >90%)
- **CSAT médio**: nota de satisfação dos clientes

### 📁 Projetos
- **Projetos Ativos**: em planejamento ou em andamento
- **Concluídos/mês**: fechados no mês atual
- **Tasks total/concluídas**: progresso geral das tarefas

### ✅ Aprovações
- **Aguardando minha aprovação**: ação necessária de você
- **Minhas pendentes**: suas solicitações aguardando
- Badge **AGIR** aparece quando há itens para sua decisão

### 🖥️ Ativos
- **Total/Em manutenção**: inventário e disponibilidade
- **Garantias vencidas/a vencer**: alertas de manutenção
- **Contratos vencendo**: próximos 30 dias

## IA Insights

Painel à esquerda com alertas computados automaticamente:
- SLA violados
- Urgentes em aberto
- Garantias vencidas
- Contratos próximos do vencimento

Os alertas são ordenados por severidade (vermelho → laranja → amarelo → azul).

## Widget Management

Clique em **Widgets** (canto superior direito) para ocultar/mostrar cada seção. A configuração é salva por usuário.

## Auto-refresh

Os dados atualizam automaticamente a cada **3 minutos**. Clique em **Atualizar** para forçar.
"""
  },

  {
    "cat": "Command Center",
    "titulo": "Dashboard Executivo — KPIs Consolidados",
    "resumo": "Visão executiva com indicadores de performance da operação.",
    "tags": ["executivo", "KPI", "relatório executivo"],
    "conteudo": """# Dashboard Executivo

Acesse em **Menu → Executivo**.

## O que é mostrado

O Dashboard Executivo apresenta uma visão consolidada de toda a operação em um único painel, ideal para reuniões gerenciais e acompanhamento de performance.

## Seções

### Chamados
- Total aberto, urgentes, hoje
- Em atendimento e resolvidos no mês
- SLA violados e compliance %
- CSAT médio e total de avaliações

### Projetos
- Projetos ativos e concluídos no mês

### Ativos
- Total ativo, em manutenção
- Garantias em risco e vencidas

### Contratos
- Total, vigentes, vencendo em 30 dias, vencidos
- Valor total dos contratos ativos

### Horas
- Total de horas apontadas no mês
- Número de registros

### Conhecimento
- Artigos publicados
- Total de visualizações

## Período

Os dados refletem o **mês atual** para métricas de contagem (resolvidos/mês, horas/mês) e o estado atual para contagens em tempo real (abertos, urgentes).
"""
  },

  # ── SERVICE DESK ─────────────────────────────────────────────────────────
  {
    "cat": "Service Desk & Chamados",
    "titulo": "Catálogo de Serviços — Como Solicitar Suporte",
    "resumo": "Use o Catálogo para solicitar serviços de TI, RH, Financeiro e outros departamentos.",
    "tags": ["catálogo", "solicitação", "serviços", "portal"],
    "conteudo": """# Catálogo de Serviços

Acesse em **Menu → Catálogo**. Esta é a forma mais rápida de abrir uma solicitação.

## Como Usar

1. Navegue pelas categorias ou use a **busca** no topo
2. Encontre o serviço que precisa
3. Clique em **Solicitar**
4. Preencha o formulário (título e descrição são obrigatórios)
5. Clique em **Abrir Chamado**

O sistema criará automaticamente um chamado com a categoria e SLA corretos.

## Categorias Disponíveis

### 💻 TI
- **Novo Usuário**: criar conta em sistemas e e-mail
- **Notebook/Desktop**: solicitação ou troca de equipamento
- **Acesso a Sistema**: concessão de permissões
- **E-mail Corporativo**: criação ou configuração
- **VPN**: acesso remoto

### 👥 RH
- **Férias**: agendamento e aprovação
- **Alteração Cadastral**: atualização de dados pessoais
- **Declaração/Documento**: solicitação de documentos
- **Benefícios**: dúvidas e alterações

### 💰 Financeiro
- **Reembolso**: ressarcimento de despesas
- **Nota Fiscal**: emissão e consulta
- **Pagamento**: solicitação de pagamentos

### ⚖️ Jurídico
- **Análise de Contrato**: revisão jurídica
- **Procuração**: emissão de documentos

### 🏢 Facilities
- **Manutenção**: solicitação de reparo
- **Reserva de Sala**: agendamento de espaço

## Dica

Se o serviço que precisa não está no catálogo, abra diretamente em **Chamados → Novo Chamado** e escolha a categoria mais próxima.
"""
  },

  {
    "cat": "Service Desk & Chamados",
    "titulo": "Chamados — Guia Completo",
    "resumo": "Tudo sobre criação, atendimento, SLA e fluxo de chamados.",
    "tags": ["chamados", "tickets", "SLA", "atendimento", "kanban"],
    "conteudo": """# Chamados — Guia Completo

Acesse em **Menu → Chamados**.

## Visualização Kanban

Os chamados são exibidos em colunas por status:
- **Aberto**: recém criados, aguardando atendente
- **Em Atendimento**: sendo trabalhados
- **Aguardando**: aguardando retorno do solicitante
- **Resolvido**: solução aplicada, aguardando confirmação
- **Fechado**: encerrado com avaliação CSAT

## Criando um Chamado

1. Clique em **Novo Chamado**
2. Preencha:
   - **Título**: objetivo claro (ex: "Computador não liga")
   - **Descrição**: detalhe o problema, passos para reproduzir, impacto
   - **Prioridade**: Baixa / Média / Alta / Crítica
   - **Categoria**: tipo do chamado
   - **Cliente**: empresa relacionada (opcional)
3. Clique em **Criar**

### Templates
Salve formulários frequentes como templates clicando em **Salvar como template** ao criar um chamado.

## Abas de Visualização

- **Meus Chamados**: chamados onde você é solicitante ou atendente
- **Fila Pública**: chamados abertos sem atendente — qualquer técnico pode assumir
- **Todos** (Master): visão completa da organização

## Assumir da Fila

Clique em **Assumir Chamado** em qualquer card da Fila Pública. A operação é atômica — se dois técnicos clicarem ao mesmo tempo, apenas um assume.

## Drag-and-Drop

Arraste um card entre as colunas do kanban para mudar o status diretamente.

## SLA e Alertas

- **Badge amarelo**: chamado sem atualização há 1-3 dias
- **Badge vermelho**: chamado sem atualização há mais de 3 dias
- **SLA em Risco**: menos de 2h para vencer o prazo
- **SLA Violado**: prazo já ultrapassado

Se um chamado violar o SLA, o sistema notifica automaticamente os Masters por e-mail e WhatsApp.

## Filtros e Busca

Use os filtros de status, prioridade e categoria. Os filtros ficam salvos na URL — compartilhe o link para que outros vejam a mesma visualização.

## Export CSV

Clique em **CSV** no topo para exportar a lista atual filtrada.

## Ações em Lote (Master)

Selecione múltiplos chamados com o checkbox e use a barra de ações para:
- Alterar status em massa
- Reatribuir para outro atendente
"""
  },

  {
    "cat": "Service Desk & Chamados",
    "titulo": "Detalhe do Chamado — Todas as Ações",
    "resumo": "Como usar a página de detalhe: comentários, horas, CSAT, SLA.",
    "tags": ["chamado detalhe", "comentários", "horas", "CSAT"],
    "conteudo": """# Detalhe do Chamado

Clique em qualquer chamado para abrir o detalhe.

## Sidebar Direito — Informações

Mostra: solicitante, atendente, cliente, categoria, horas estimadas, skill requerida, datas importantes e SLA.

No **modo edição** (botão Editar): altere status, prioridade, categoria, tags e atendente.

## Ações Rápidas

Botões contextuais baseados no status atual:
- **Aberto** → Em atendimento | Aguardando | Cancelar
- **Em Atendimento** → Aguardando | Resolvido | Cancelar
- **Aguardando** → Em Atendimento | Resolvido
- **Resolvido** → Fechar | Reabrir

## Comentários

- **Público**: visível para o solicitante e todos
- **Nota Interna** (🔒): visível apenas para a equipe técnica

Atalho: `Ctrl+Enter` para enviar comentário.

## Apontamento de Horas

1. Clique em **Apontar**
2. Informe horas, minutos e data
3. Descrição é opcional
4. O total acumulado aparece no título da seção

## CSAT (Avaliação)

Após o chamado ser fechado, o **solicitante** pode avaliar o atendimento com 1 a 5 estrelas. A nota alimenta o painel de CSAT e o dashboard executivo.

## SLA Bar

Exibe visualmente:
- Prazo de resposta (primeira interação do atendente)
- Prazo de resolução
- Status: dentro do prazo / em risco / violado
- Quando fechado: tempo real de resolução vs prazo

## Histórico de Auditoria

Role até o final para ver todas as alterações: criação, atribuições, mudanças de status e prioridade com data, hora e responsável.
"""
  },

  {
    "cat": "Service Desk & Chamados",
    "titulo": "SLA — Configuração e Monitoramento",
    "resumo": "Como configurar regras de SLA e acompanhar o compliance.",
    "tags": ["SLA", "prazo", "compliance", "configuração SLA"],
    "conteudo": """# SLA — Configuração e Monitoramento

## O que é SLA

SLA (Service Level Agreement) define os prazos máximos para **resposta** (primeira interação do atendente) e **resolução** (fechamento do chamado).

## Configurar Regras de SLA

1. Acesse **Configurações → SLA**
2. Clique em **Nova Regra**
3. Defina:
   - **Prioridade**: Baixa / Média / Alta / Crítica
   - **Categoria**: (opcional) regra específica por tipo
   - **Prazo de Resposta**: horas até a primeira resposta
   - **Prazo de Resolução**: horas até o fechamento

### Valores Recomendados

| Prioridade | Resposta | Resolução |
|------------|----------|-----------|
| Baixa | 24h | 72h |
| Média | 8h | 24h |
| Alta | 2h | 8h |
| Crítica | 30min | 2h |

## Recalcular SLA

Após alterar as regras, clique em **Recalcular SLA** para atualizar os prazos de todos os chamados abertos com as novas regras.

## Monitoramento

No **Dashboard Executivo** e no **Command Center** você vê em tempo real:
- Total de SLA violados
- SLA em risco (próximas 2h)
- Compliance percentual do mês

## Escalação Automática

O sistema verifica a cada 30 minutos os chamados com SLA violado. Chamados com mais de 1h de atraso disparam:
- Notificação in-app para os Masters
- Mensagem WhatsApp (se configurado)
- Registro no histórico do chamado
"""
  },

  {
    "cat": "Service Desk & Chamados",
    "titulo": "CSAT — Pesquisa de Satisfação",
    "resumo": "Como funciona a avaliação de atendimento e como interpretar os resultados.",
    "tags": ["CSAT", "satisfação", "avaliação", "NPS"],
    "conteudo": """# CSAT — Pesquisa de Satisfação

Acesse em **Menu → CSAT**.

## Como Funciona

Após um chamado ser **fechado**, o solicitante recebe a opção de avaliar o atendimento com:
- **1 a 5 estrelas** (1 = Péssimo, 5 = Excelente)
- **Comentário** (opcional)

## Avaliar um Chamado

1. Abra o chamado já fechado
2. Role até a seção **Avaliação do Atendimento**
3. Clique nas estrelas
4. (Opcional) escreva um comentário
5. Clique em **Enviar avaliação**

A avaliação pode ser atualizada enquanto o chamado estiver fechado.

## Painel CSAT

Em **Menu → CSAT** você vê:
- Média geral de satisfação
- Distribuição das notas (gráfico de barras)
- Lista de avaliações recentes com comentários
- Ranking de atendentes por nota média

## Interpretação

| Nota média | Significado |
|------------|-------------|
| 4.5 – 5.0 | Excelente — equipe de alta performance |
| 4.0 – 4.4 | Bom — pequenas melhorias necessárias |
| 3.0 – 3.9 | Regular — atenção ao processo |
| < 3.0 | Crítico — revisão urgente do atendimento |
"""
  },

  {
    "cat": "Service Desk & Chamados",
    "titulo": "Apontamento de Horas",
    "resumo": "Como registrar horas trabalhadas em chamados e projetos.",
    "tags": ["horas", "apontamento", "timesheet"],
    "conteudo": """# Apontamento de Horas

Acesse em **Menu → Horas** para ver o painel geral, ou registre diretamente em um chamado.

## Registrar Horas em um Chamado

1. Abra o chamado
2. Role até **Horas apontadas**
3. Clique em **Apontar**
4. Informe: horas, minutos, data e descrição (opcional)
5. Clique em **Salvar**

## Painel Geral de Horas

Em **Menu → Horas** você vê:
- Total de horas apontadas no período
- Distribuição por colaborador
- Distribuição por chamado/projeto
- Filtro por data, usuário e tipo

## Relatório de Horas

Use o filtro de período e exporte os dados para análise de produtividade da equipe.

## Deleção

O responsável pelo apontamento ou um Master pode deletar um registro de horas clicando no ícone de lixeira.
"""
  },

  # ── PROJETOS ──────────────────────────────────────────────────────────────
  {
    "cat": "Projetos & Tarefas",
    "titulo": "Projetos — Criação e Gestão",
    "resumo": "Como criar projetos, gerenciar tarefas e acompanhar o progresso.",
    "tags": ["projetos", "kanban", "tarefas", "gestão"],
    "conteudo": """# Projetos — Criação e Gestão

Acesse em **Menu → Projetos**.

## Criar um Projeto

1. Clique em **Novo Projeto**
2. Preencha:
   - **Nome**: nome claro e objetivo
   - **Descrição**: escopo e objetivos
   - **Status**: Planejamento / Em Andamento / Concluído / Cancelado
   - **Prioridade**: Baixa / Média / Alta / Urgente
   - **Prazo**: data de conclusão esperada
   - **Membros**: adicione os colaboradores do projeto
3. Clique em **Criar**

## Kanban de Tarefas

Cada projeto tem um kanban com colunas customizáveis. As tarefas padrão são:
- **A Fazer**: backlog do projeto
- **Em Andamento**: trabalho em progresso
- **Em Revisão**: aguardando validação
- **Concluída**: finalizado
- **Cancelada**: descartado

## Criar Tarefas

1. Clique em **+** em qualquer coluna
2. Informe título, responsável, prazo e prioridade
3. Adicione descrição, checklist e anexos

## Linha do Tempo (Gantt)

Acesse **Menu → Linha do Tempo** para visualização Gantt de todos os projetos ativos. Veja dependências, datas e progresso.

## Relatório de Projetos

Em **Menu → Relatórios → aba Projetos** você vê:
- Tasks por status e membro
- Progresso por projeto
- Chamados associados
- Gráfico de tasks concluídas por dia
"""
  },

  {
    "cat": "Projetos & Tarefas",
    "titulo": "Keep — Notas e Tasks Pessoais",
    "resumo": "Como usar o Keep para organizar notas e tarefas do dia.",
    "tags": ["keep", "notas", "tarefas diárias", "produtividade"],
    "conteudo": """# Keep — Notas e Tasks Pessoais

Acesse em **Menu → Keep**.

## Para que Serve

O Keep é seu espaço pessoal de organização: notas rápidas e tasks do dia. Diferente dos projetos (que são colaborativos), o Keep é individual.

## Tasks Diárias

Na aba **Tasks**, você vê as tarefas do dia atual.

### Criar uma Task
1. Clique em **+ Nova task**
2. Informe o título
3. Escolha o tipo: **Tarefa**, **Compromisso** ou **Hábito**
4. (Opcional) adicione data e hora

### Concluir uma Task
Clique no checkbox à esquerda da task. O progresso do dia aparece na barra percentual.

### Task Rápida no Command Center
No Command Center (dashboard principal), há um campo de entrada rápida no fundo do widget de tasks. Digite e pressione Enter.

## Notas

Na aba **Notas**, crie e organize anotações livres com texto formatado, listas e links.

### Criar uma Nota
1. Clique em **Nova Nota**
2. Escreva o conteúdo (suporta Markdown)
3. Adicione etiquetas para organização

### Organizar por Etiquetas
Use etiquetas (tags) para agrupar notas por tema. Filtre pelo painel lateral.
"""
  },

  # ── AGENDA ────────────────────────────────────────────────────────────────
  {
    "cat": "Agenda & Eventos",
    "titulo": "Agenda — Calendário e Eventos",
    "resumo": "Como criar eventos, configurar recorrência e convidar participantes.",
    "tags": ["agenda", "calendário", "eventos", "reuniões"],
    "conteudo": """# Agenda — Calendário e Eventos

Acesse em **Menu → Agenda**.

## Visualizações

- **Mês**: visão mensal com todos os eventos
- **Semana**: detalhamento semanal
- **Dia**: agenda detalhada do dia

## Criar um Evento

1. Clique em qualquer dia do calendário
2. Preencha:
   - **Título**: nome do evento
   - **Descrição**: detalhes
   - **Local**: sala, endereço ou link de videoconferência
   - **Início e Fim**: data e hora
   - **Dia todo**: marque para eventos sem hora específica
   - **Tipo**: Pessoal / Reunião / Projeto / Compromisso / Lembrete
   - **Recorrência**: Não repetir / Diária / Semanal / Quinzenal / Mensal
   - **Cor**: para identificação visual
   - **Participantes**: outros usuários da organização
3. Clique em **Criar evento**

## Tipos de Evento

| Tipo | Uso |
|------|-----|
| **Pessoal** | Compromissos individuais |
| **Reunião** | Encontros com equipe ou clientes |
| **Projeto** | Marcos e entregas de projetos |
| **Compromisso** | Visitas externas e compromissos formais |
| **Lembrete** | Alertas e lembretes sem duração |

## Eventos Recorrentes

Ao criar um evento com recorrência, você pode editar uma única ocorrência ou toda a série.

## Convidar Participantes

Na seção **Participantes**, selecione outros usuários da organização. Eles recebem notificação e o evento aparece na agenda deles.

## Disponibilidade

Acesse **Agenda → Disponibilidade** para ver os horários livres de toda a equipe e encontrar o melhor horário para reuniões.
"""
  },

  # ── ATIVOS & CMDB ─────────────────────────────────────────────────────────
  {
    "cat": "Ativos & CMDB",
    "titulo": "Ativos — Gestão de Equipamentos",
    "resumo": "Como cadastrar, categorizar e controlar o ciclo de vida dos ativos.",
    "tags": ["ativos", "equipamentos", "inventário", "garantia"],
    "conteudo": """# Ativos — Gestão de Equipamentos

Acesse em **Menu → Ativos**.

## Cadastrar um Ativo

1. Clique em **Novo Ativo**
2. Preencha:
   - **Código**: identificador único (ex: NB-001, SV-002)
   - **Nome**: descrição do equipamento
   - **Categoria**: Computadores / Hardware / Periféricos / Rede / Software / Mobiliário
   - **Status**: Ativo / Em Manutenção / Inativo / Descartado
   - **Responsável**: usuário que usa o equipamento
   - **Fornecedor**: empresa fornecedora
   - **Data de Compra** e **Valor**
   - **Garantia até**: data de vencimento da garantia
   - **Número de Série** e **IMEI** (para mobile)
3. Clique em **Salvar**

## Status dos Ativos

| Status | Significado |
|--------|-------------|
| **Ativo** | Em uso normal |
| **Em Manutenção** | Indisponível temporariamente |
| **Inativo** | Fora de uso, aguardando descarte |
| **Descartado** | Baixado do inventário |

## Alertas de Garantia

O sistema alerta automaticamente quando:
- **Garantia vence em 30 dias**: badge amarelo no dashboard
- **Garantia já venceu**: badge vermelho no dashboard executivo

## Filtros

Use o painel lateral para filtrar por categoria. O contador no topo mostra Total / Ativo / Manutenção / Inativo.

## Vincular a Chamado

Em um chamado, você pode informar o ativo relacionado para rastreamento de histórico de problemas por equipamento.
"""
  },

  {
    "cat": "Ativos & CMDB",
    "titulo": "CMDB — Mapa de Dependências",
    "resumo": "Como visualizar relacionamentos entre ativos, usuários, contratos e fornecedores.",
    "tags": ["CMDB", "dependências", "mapa", "impacto"],
    "conteudo": """# CMDB — Configuration Management Database

Acesse em **Menu → CMDB**.

## O que é CMDB

O CMDB (Configuration Management Database) mostra os **relacionamentos** entre os ativos e outros elementos da organização, permitindo análise de impacto.

## Como Usar

1. Na **lista à esquerda**, encontre o ativo pelo nome ou código
2. Use os filtros de status para refinar
3. Clique no ativo para selecionar
4. O **grafo de dependências** aparece à direita

## Grafo Hub-and-Spoke

O ativo selecionado fica no centro. Ao redor aparecem os elementos conectados:
- **Responsável** (usuário): quem usa o equipamento
- **Contrato**: contrato de manutenção ou licença
- **Fornecedor**: empresa que vendeu/mantém
- **Ativos correlacionados**: outros equipamentos do mesmo responsável

## Painel de Impacto

Abaixo do grafo, veja:
- **Responsável**: quem será afetado se o ativo sair
- **Status de garantia**: ok / vencendo em 30 dias / vencida
- **Contratos relacionados**: contratos que envolvem este ativo
- **Dependências de fornecedor**: outros ativos do mesmo fornecedor

## Caso de Uso

Antes de fazer manutenção num servidor, clique nele no CMDB para ver:
- Quais usuários dependem dele
- Quais contratos estão vinculados
- Quais outros ativos serão impactados se ele sair
"""
  },

  # ── ORÇAMENTO ─────────────────────────────────────────────────────────────
  {
    "cat": "Orçamento & Financeiro",
    "titulo": "Orçamento — Gestão CAPEX e OPEX",
    "resumo": "Como criar ciclos orçamentários, lançar itens e acompanhar a execução.",
    "tags": ["orçamento", "CAPEX", "OPEX", "financeiro", "planejamento"],
    "conteudo": """# Orçamento — Gestão CAPEX e OPEX

Acesse em **Menu → Orçamento**.

## Conceitos

- **OPEX** (Operational Expenditure): gastos operacionais recorrentes (ex: licenças de software, manutenção)
- **CAPEX** (Capital Expenditure): investimentos em ativos (ex: compra de equipamentos, infraestrutura)
- **Ciclo Orçamentário**: período anual de planejamento (ex: 2026)

## Criar um Ciclo Orçamentário

1. Na aba **Dashboard**, clique em **Novo Ciclo**
2. Informe o ano (ex: 2026)
3. Adicione uma descrição opcional
4. Clique em **Criar**

## Adicionar Itens Orçamentários

1. Com o ciclo selecionado, clique em **Novo Item OPEX** ou **Novo Item CAPEX**
2. Preencha:
   - **Nome do item**: ex: "Microsoft 365"
   - **Categoria**: Manutenção de Softwares / Infraestrutura / Serviços / etc.
   - **Centro de Custo**: departamento responsável
   - **Fornecedor**: empresa (opcional)
   - **Periodicidade**: Mensal / Trimestral / Anual
   - **Valores mensais previstos**: informe o valor para cada mês
3. Clique em **Criar Item**

## Dashboard

O dashboard mostra:
- **Total Previsto**: soma de todos os itens planejados no ano
- **Total Realizado**: soma dos valores efetivamente lançados
- **Execução Global**: % do orçamento consumido
- **Estouros**: itens onde o realizado superou o previsto
- **Gráfico de evolução**: previsto × realizado por mês
- **Distribuição por categoria**: % de cada categoria no orçamento

## Lançar Realizado

Para registrar o valor efetivamente gasto:
1. Clique no item orçamentário
2. Selecione o mês
3. Informe o valor realizado
4. Salve

## Aprovações

Itens com valor acima do limite configurado requerem aprovação antes de serem confirmados.
"""
  },

  # ── CRM ───────────────────────────────────────────────────────────────────
  {
    "cat": "CRM & Comercial",
    "titulo": "Clientes — Gestão do CRM",
    "resumo": "Como cadastrar e gerenciar clientes, oportunidades e histórico.",
    "tags": ["CRM", "clientes", "empresas", "contatos"],
    "conteudo": """# Clientes — Gestão do CRM

Acesse em **Menu → Clientes**.

## Cadastrar um Cliente

1. Clique em **Novo Cliente**
2. Preencha:
   - **Nome** e **Empresa**
   - **CNPJ/CPF**
   - **E-mail** e **Telefone**
   - **Segmento** (TI, Saúde, Educação, etc.)
   - **Status**: Ativo / Inativo / Prospect
   - **Endereço completo**
3. Clique em **Salvar**

## Perfil do Cliente

Na página do cliente você vê:
- **Dados cadastrais** completos
- **Chamados** associados ao cliente
- **Contratos** vigentes e histórico
- **Faturas** emitidas
- **Linha do tempo**: histórico de interações

## Vincular Chamados

Ao criar um chamado, selecione o cliente no campo **Cliente**. O chamado aparecerá no perfil do cliente para rastreamento.

## Filtros e Busca

Use a busca para encontrar por nome, empresa, CNPJ ou e-mail. Filtre por status e segmento.

## Importar Clientes

Para importar uma lista de clientes, use o template CSV disponível em **Clientes → Importar**.
"""
  },

  {
    "cat": "CRM & Comercial",
    "titulo": "Contratos — Gestão Comercial",
    "resumo": "Como criar e acompanhar contratos, vigências e renovações.",
    "tags": ["contratos", "comercial", "vigência", "renovação"],
    "conteudo": """# Contratos — Gestão Comercial

Acesse em **Menu → Contratos**.

## Criar um Contrato

1. Clique em **Novo Contrato**
2. Preencha:
   - **Título**: identificação do contrato
   - **Cliente**: empresa contratante
   - **Tipo**: Prestação de Serviço / Licença / Manutenção / SLA / Outro
   - **Valor**: valor mensal ou total
   - **Vigência**: datas de início e fim
   - **Status**: Ativo / Suspenso / Encerrado
   - **Responsável**: gestor do contrato
3. Clique em **Salvar**

## Alertas de Vencimento

O sistema monitora os contratos e alerta quando:
- **Vence em 30 dias**: badge no Command Center e Dashboard Executivo
- **Já vencido**: indicador vermelho na lista

## Renovação

Ao editar um contrato, atualize a **data de vigência** para registrar a renovação.

## Vinculação com Ativos

No CMDB, é possível associar contratos a ativos específicos (ex: contrato de manutenção do servidor X).
"""
  },

  {
    "cat": "CRM & Comercial",
    "titulo": "Faturas — Cobranças e Pagamentos",
    "resumo": "Como emitir e controlar faturas para clientes.",
    "tags": ["faturas", "cobrança", "pagamento", "financeiro"],
    "conteudo": """# Faturas — Cobranças e Pagamentos

Acesse em **Menu → Faturas**.

## Criar uma Fatura

1. Clique em **Nova Fatura**
2. Preencha:
   - **Cliente**: destinatário
   - **Contrato**: (opcional) vincule ao contrato
   - **Valor**: total a cobrar
   - **Vencimento**: data de pagamento
   - **Descrição**: detalhamento dos serviços
   - **Status**: Pendente / Paga / Vencida / Cancelada
3. Clique em **Salvar**

## Controle de Status

| Status | Significado |
|--------|-------------|
| **Pendente** | Emitida, aguardando pagamento |
| **Paga** | Pagamento confirmado |
| **Vencida** | Passou do prazo sem pagamento |
| **Cancelada** | Fatura cancelada |

## Relatório Financeiro

Use os filtros de período e status para gerar relatórios de recebimentos e inadimplência.
"""
  },

  # ── APROVAÇÕES ────────────────────────────────────────────────────────────
  {
    "cat": "Aprovações & Processos",
    "titulo": "Aprovações — Central de Aprovações",
    "resumo": "Como solicitar, aprovar, rejeitar e delegar aprovações.",
    "tags": ["aprovações", "solicitações", "fluxo de aprovação"],
    "conteudo": """# Aprovações — Central de Aprovações

Acesse em **Menu → Aprovações**.

## Criar uma Solicitação

1. Clique em **Nova Solicitação**
2. Escolha o **tipo**:
   - 💰 Despesa
   - ⏱️ Horas Extra
   - ✏️ Alteração Cadastral
   - 🏖️ Folga Compensatória
   - 🛒 Compra
   - ✈️ Viagem
   - ❓ Outro
3. Preencha título, justificativa e valor (para despesas/compras)
4. Clique em **Enviar solicitação**

A solicitação vai automaticamente para o **aprovador do seu setor** (configurado em Aprovações → Configurar Aprovadores).

## Abas de Visualização

- **Fila de Aprovações**: itens aguardando SUA decisão (prioridade)
- **Minhas Solicitações**: o que você enviou para aprovação
- **Histórico** (Master): todas as solicitações da organização

## Ações Disponíveis

### ✅ Aprovar
Confirma a solicitação. O solicitante é notificado por e-mail e WhatsApp.

### ❌ Rejeitar
Rejeita com motivo obrigatório. O solicitante recebe o motivo da rejeição.

### 👥 Delegar
Transfere a responsabilidade de aprovação para outro usuário.

### 💬 Solicitar Ajustes
Pede informações adicionais ao solicitante sem aprovar ou rejeitar.

## Alertas de Urgência

Solicitações sem decisão após 24h aparecem com borda âmbar e indicador de tempo na fila.

## Hierarquia de Aprovação

Valores acima de R$ 5.000 sobem automaticamente um nível na hierarquia de aprovação.

## Configurar Aprovadores

Em **Aprovações → Configurar Aprovadores** (Masters), defina:
- Aprovador primário por setor
- Aprovador backup com período de vigência
"""
  },

  {
    "cat": "Aprovações & Processos",
    "titulo": "Processos — Workflow Visual",
    "resumo": "Como criar e usar templates de processos visuais step-by-step.",
    "tags": ["processos", "workflow", "fluxo", "automação"],
    "conteudo": """# Processos — Workflow Visual

Acesse em **Menu → Processos**.

## O que são Processos

Processos são templates visuais de fluxo de trabalho que definem etapas padronizadas para procedimentos recorrentes (onboarding, compras, implantações, etc.).

## Templates Padrão

O sistema inclui 4 templates pré-configurados:
- **Onboarding de Funcionário** (RH)
- **Offboarding de Funcionário** (RH)
- **Solicitação de Compra** (Compras)
- **Implantação de Sistema** (TI)

## Criar um Novo Processo

1. Clique em **Novo processo**
2. Informe nome, categoria e descrição
3. Clique em **Criar**
4. O editor visual se abre

## Editor Visual de Etapas

### Tipos de Etapa

| Tipo | Ícone | Uso |
|------|-------|-----|
| **Início** | ▶️ | Ponto de partida do processo |
| **Tarefa** | ☑️ | Ação a ser executada |
| **Aprovação** | 🛡️ | Decisão de aprovação/rejeição |
| **Notificação** | 🔔 | Envio de comunicado |
| **Condição** | 🔀 | Bifurcação baseada em critério |
| **Fim** | 🏁 | Conclusão do processo |

### Adicionar Etapas
Clique no botão **+** entre ou após as etapas para inserir uma nova. Selecione o tipo no popup.

### Editar Etapas
Clique em qualquer etapa para expandir e editar: nome, responsável, prazo em dias e descrição.

### Remover Etapas
Clique no **×** no canto superior da etapa.

## Salvar Alterações

Após editar, clique em **Salvar** no topo do editor. O botão fica destacado em violeta quando há alterações não salvas.
"""
  },

  # ── PEOPLE & WORKFORCE ────────────────────────────────────────────────────
  {
    "cat": "People & Workforce",
    "titulo": "Workforce — Visão da Equipe",
    "resumo": "Como monitorar a equipe, produtividade e alocação de capacidade.",
    "tags": ["workforce", "equipe", "colaboradores", "produtividade"],
    "conteudo": """# Workforce — Visão da Equipe

Acesse em **Menu → Workforce**.

## O que é Mostrado

O Workforce consolida em uma única tela a visão de toda a equipe operacional:
- Colaboradores ativos e seus setores
- Chamados abertos por colaborador
- Horas apontadas no período
- Score de performance

## Squads e Setores

Colaboradores são agrupados por **Setor**. Cada setor tem um responsável e pode ter skills específicas.

## Capacidade

Acesse **Menu → Capacidade** para ver:
- Utilização de cada colaborador (%)
- Comparação entre capacidade nominal e consumo real
- Identificação de sobrecarregados vs. subutilizados

## Ausências

Registre e gerencie ausências da equipe (férias, licenças, afastamentos) em **Workforce → Ausências**.

## Habilidades (Skills)

Cadastre as habilidades de cada colaborador em **Cadastros → Colaboradores**. O sistema usa as skills para:
- Sugestão de atendente na triagem de chamados
- Score de compatibilidade (chamado × habilidade requerida)
"""
  },

  # ── IA & AUTOMAÇÕES ────────────────────────────────────────────────────────
  {
    "cat": "IA & Automações",
    "titulo": "IA Operacional — Análises e Insights",
    "resumo": "Como interpretar o score operacional, riscos e recomendações da IA.",
    "tags": ["IA", "inteligência artificial", "insights", "risco"],
    "conteudo": """# IA Operacional

Acesse em **Menu → IA Operacional**.

## Score Operacional

O score (0–100) representa a saúde geral da operação, calculado com base em:
- SLA compliance dos chamados
- Volume de urgentes abertos
- Chamados sem resposta há muito tempo
- Garantias vencidas
- Contratos próximos do vencimento

| Score | Cor | Interpretação |
|-------|-----|---------------|
| 80–100 | 🟢 Verde | Operação saudável |
| 60–79 | 🟡 Amarelo | Atenção necessária |
| 40–59 | 🟠 Laranja | Problemas significativos |
| 0–39 | 🔴 Vermelho | Situação crítica |

## Matriz de Riscos

Classificação dos alertas em 4 quadrantes:
- **Crítico** (alta probabilidade + alto impacto): ação imediata
- **Alto** (alta probabilidade + baixo impacto): monitorar de perto
- **Médio** (baixa probabilidade + alto impacto): planejar mitigação
- **Baixo** (baixa probabilidade + baixo impacto): informativo

## Gráfico de Tendência

Mostra o volume de chamados dos últimos 14 dias com a **média móvel de 7 dias**. Picos acima de 1.5 sigma são marcados como anomalias.

## Recomendações

A IA gera recomendações contextuais baseadas nos dados reais. Exemplo:
- "4 chamados urgentes aguardando atribuição — designe um técnico disponível"
- "SLA de 3 chamados críticos vence em 2h — tome ação imediata"

Cada recomendação tem um link direto para a ação necessária.

## Tabela KPI

Visão detalhada por módulo com status (✅ ok / ⚠️ atenção / 🚨 crítico) para:
- SLA compliance
- Volume de chamados
- Projetos atrasados
- Aprovações pendentes
- Garantias vencidas
"""
  },

  {
    "cat": "IA & Automações",
    "titulo": "Automações — Regras e Gatilhos",
    "resumo": "Como criar automações para executar ações automáticas em eventos do sistema.",
    "tags": ["automações", "regras", "gatilhos", "webhooks"],
    "conteudo": """# Automações — Regras e Gatilhos

Acesse em **Menu → Automações**.

## O que são Automações

Automações executam ações automaticamente quando um evento ocorre no sistema, sem intervenção manual.

## Criar uma Automação

1. Clique em **Nova Automação**
2. Configure:
   - **Nome**: descrição da automação
   - **Gatilho (Trigger)**: o evento que dispara
   - **Condições**: filtros opcionais (ex: apenas chamados urgentes)
   - **Ações**: o que executar quando o gatilho ocorre
3. Ative a automação

## Gatilhos Disponíveis

- `chamado_criado`: novo chamado aberto
- `chamado_resolvido`: chamado marcado como resolvido
- `chamado_atribuido`: atendente atribuído
- `sla_risco`: SLA entrando em risco
- `sla_violado`: SLA ultrapassado

## Ações Disponíveis

- **Notificar usuário**: envia notificação in-app
- **Enviar e-mail**: dispara e-mail para destinatários configurados
- **Enviar WhatsApp**: mensagem WhatsApp (requer integração configurada)
- **Chamar webhook**: POST para URL externa (integração com outros sistemas)
- **Alterar status**: muda o status do chamado

## Webhooks

Para integrar com sistemas externos (Slack, Teams, ERP, etc.):
1. Crie uma automação com ação **Chamar webhook**
2. Informe a URL do endpoint receptor
3. Configure o payload (formato JSON) com as variáveis disponíveis

## Histórico de Execução

Cada automação registra suas execuções com data, hora e resultado (sucesso/erro) para auditoria.
"""
  },

  {
    "cat": "IA & Automações",
    "titulo": "WhatsApp — Notificações via WhatsApp Business",
    "resumo": "Como configurar e usar notificações via WhatsApp na sua organização.",
    "tags": ["WhatsApp", "notificações", "integração"],
    "conteudo": """# WhatsApp — Notificações via WhatsApp Business

## Configurar a Integração

Acesse **Menu → WhatsApp** (requer permissão de configuração).

1. Informe o número do WhatsApp Business da organização
2. Conecte via QR Code
3. Aguarde o status **Conectado** (ponto verde)

## Notificações Automáticas

Uma vez conectado, os usuários com número cadastrado recebem WhatsApp para:
- Novo chamado atribuído a você
- Chamado assumido por outro técnico
- Comentário em chamado que você participa
- SLA violado (para Masters)
- Aprovação pendente aguardando sua decisão
- Resultado de aprovação (aprovado/rejeitado)

## Cadastrar Número do Usuário

Cada usuário deve cadastrar seu número em **Meu Perfil → Telefone WhatsApp**.

## Boas Práticas

- Use um número dedicado para notificações (não o pessoal do gestor)
- Teste com uma notificação manual antes de ativar em produção
- Configure silenciamento noturno para não perturbar fora do horário comercial
"""
  },

  # ── ADMINISTRAÇÃO ──────────────────────────────────────────────────────────
  {
    "cat": "Administração",
    "titulo": "Cadastros — Usuários e Permissões",
    "resumo": "Como gerenciar usuários, perfis de acesso e permissões granulares.",
    "tags": ["usuários", "cadastros", "permissões", "perfis"],
    "conteudo": """# Cadastros — Usuários e Permissões

Acesse em **Menu → Cadastros**.

## Criar Usuário

1. Clique em **Novo Usuário**
2. Preencha:
   - **Nome completo**
   - **E-mail** (usado para login)
   - **Perfil**: Master / Administrador / Gestor / Analista / Técnico
   - **Setor**: departamento do colaborador
3. Clique em **Criar**

O usuário recebe um e-mail com link para definir sua senha.

## Editar Usuário

Clique no usuário na lista para:
- Alterar perfil de acesso
- Ativar/desativar conta
- Resetar senha
- Ver histórico de atividade

## Bloquear Usuário

Usuários com mais de 5 tentativas de login falhas são bloqueados automaticamente. Desbloqueie em **Editar Usuário → Desbloquear**.

## Perfis e Permissões

Em **Configurações → Perfis de Acesso** (Master), customize as permissões de cada perfil:
- `chamados:ver`, `chamados:criar`, `chamados:editar`, `chamados:deletar`
- `projetos:ver`, `projetos:criar`, etc.
- `*` concede acesso total a um módulo

## Fornecedores

Acesse **Cadastros → Fornecedores** para gerenciar empresas fornecedoras vinculadas a ativos, orçamentos e contratos.
"""
  },

  {
    "cat": "Administração",
    "titulo": "Configurações — Preferências do Sistema",
    "resumo": "Como configurar o sistema, integrações e preferências da organização.",
    "tags": ["configurações", "preferências", "sistema"],
    "conteudo": """# Configurações

Acesse em **Menu → Configurações**.

## Organização

- **Dados da empresa**: razão social, CNPJ, endereço
- **Logo e identidade visual**
- **Módulos ativos**: ative/desative funcionalidades
- **Fuso horário e idioma**

## SLA

Configure as regras de prazo de atendimento por prioridade e categoria. Ver artigo específico de SLA.

## Notificações

- **E-mail**: configure SMTP para envio de notificações
- **WhatsApp**: configure a integração (ver artigo WhatsApp)
- **Alertas**: defina quais eventos geram notificações automáticas

## Perfis de Acesso

Customize as permissões de cada perfil de usuário (Master only).

## Integrações

- **Webhooks**: configure endpoints externos para receber eventos
- **API Key**: gere chaves de acesso para integração via API REST

## Aparência

- **Tema**: claro/escuro (configuração global para novos usuários)
- **Cores da marca**: personalize a identidade visual
"""
  },

  {
    "cat": "Administração",
    "titulo": "Histórico — Auditoria de Atividades",
    "resumo": "Como usar o log de auditoria para rastrear todas as ações do sistema.",
    "tags": ["histórico", "auditoria", "log", "rastreamento"],
    "conteudo": """# Histórico — Auditoria de Atividades

Acesse em **Menu → Histórico**.

## O que é Registrado

O Orkiestri mantém um log completo de todas as ações realizadas no sistema:
- Criação, edição e exclusão de registros
- Login e logout de usuários
- Mudanças de status em chamados e projetos
- Alterações de permissões
- Configurações do sistema

## Filtros

- **Por usuário**: veja todas as ações de um colaborador específico
- **Por tipo de ação**: criação / edição / exclusão / login
- **Por módulo**: chamados / projetos / ativos / etc.
- **Por período**: defina data inicial e final

## Campos de Cada Registro

- **Data/Hora**: timestamp preciso da ação
- **Usuário**: quem realizou a ação
- **Ação**: o que foi feito
- **Módulo**: onde foi feito
- **Detalhe**: de/para (valor anterior vs. novo)
- **IP**: endereço de origem

## Uso em Auditoria

O histórico serve para:
- Investigar incidentes de segurança
- Comprovar conformidade (LGPD, ISO)
- Rastrear alterações não autorizadas
- Gerar evidências para auditorias externas

## Exportar

Clique em **Exportar** para gerar um arquivo CSV do período selecionado.
"""
  },

  {
    "cat": "Administração",
    "titulo": "Relatórios — Analytics e Métricas",
    "resumo": "Como usar os relatórios para análise de desempenho operacional.",
    "tags": ["relatórios", "analytics", "métricas", "KPI"],
    "conteudo": """# Relatórios — Analytics e Métricas

Acesse em **Menu → Relatórios**.

## Abas Disponíveis

### Chamados
- KPIs: total, abertos, resolvidos, SLA
- Gráfico de volume por dia
- Distribuição por status e prioridade
- Ranking de atendentes

### SLA & CSAT
- Compliance de resposta e resolução
- Tendência de satisfação
- Violações por período

### Horas
- Total de horas por colaborador
- Distribuição por projeto/chamado
- Tendência mensal

### Projetos
- Tasks por status e membro
- Progresso por projeto
- Gráfico de conclusão por dia

### Atendentes
- Volume por atendente
- Tempo médio de resolução
- CSAT individual

### Comparativo
- Comparação mês a mês
- Variação percentual

## Filtros

Use o seletor de período no topo para definir o intervalo de análise. Os gráficos atualizam automaticamente.

## Exportar

Clique em **Exportar** em qualquer aba para baixar os dados em CSV ou PDF.
"""
  },

]

# 4. Criar artigos
print(f"\nCriando {len(ARTIGOS)} artigos...")
ok = 0
erros = 0
for art in ARTIGOS:
    cat_id = cat_ids.get(art["cat"], "")
    if not cat_id:
        print(f"  ✗ Categoria não encontrada: {art['cat']}")
        erros += 1
        continue
    body = {
        "titulo": art["titulo"],
        "resumo": art["resumo"],
        "conteudo": art["conteudo"],
        "categoriaId": cat_id,
        "tags": art.get("tags", []),
        "status": "rascunho",
    }
    r = api("POST", "/conhecimento", body, token)
    art_id = r.get("id", "")
    if not art_id:
        print(f"  ✗ Falha: {art['titulo'][:50]} → {r}")
        erros += 1
        continue
    # Publicar
    api("PATCH", f"/conhecimento/{art_id}/publicar", {"publicar": True}, token)
    ok += 1
    print(f"  ✓ [{art['cat'][:20]}] {art['titulo'][:55]}")
    time.sleep(0.15)

print(f"\n{'='*60}")
print(f"Concluído: {ok} artigos criados e publicados | {erros} erros")
print(f"Categorias criadas: {len(cat_ids)}")
