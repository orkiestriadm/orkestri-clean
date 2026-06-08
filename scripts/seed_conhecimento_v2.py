#!/usr/bin/env python3
"""
Seed v2 — FAQ, Troubleshooting, Glossário, Guias por Perfil, Quando Usar o Quê
"""
import json, subprocess, time, sys

BASE = "http://172.18.0.4:3000/api"

def api(method, path, body=None, token=None):
    headers = ["-H", "Content-Type: application/json"]
    if token:
        headers += ["-H", f"Authorization: Bearer {token}"]
    cmd = ["curl", "-s", "-X", method, BASE + path] + headers
    if body:
        cmd += ["-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    try:
        return json.loads(r.stdout)
    except:
        return {}

print("Autenticando...")
login = api("POST", "/auth/login", {"email": "administrator@orkiestri.com", "senha": "Baiano@1427*"})
token = login.get("accessToken", "")
if not token:
    print("ERRO:", login); sys.exit(1)
print(f"  Token: {token[:20]}...")

# ── Categorias novas ──────────────────────────────────────────────────────────
NOVAS_CATS = [
    {"nome": "FAQ — Perguntas Frequentes",   "icone": "❓", "cor": "#f59e0b", "ordem": 13, "descricao": "Respostas rápidas para as dúvidas mais comuns"},
    {"nome": "Solução de Problemas",          "icone": "🔧", "cor": "#ef4444", "ordem": 14, "descricao": "Diagnóstico e resolução de erros comuns"},
    {"nome": "Glossário",                     "icone": "📖", "cor": "#8b5cf6", "ordem": 15, "descricao": "Termos e conceitos do Orkiestri explicados"},
    {"nome": "Guias por Perfil",              "icone": "👤", "cor": "#10b981", "ordem": 16, "descricao": "Guias específicos para cada tipo de usuário"},
    {"nome": "Quando Usar o Quê",             "icone": "🔀", "cor": "#06b6d4", "ordem": 17, "descricao": "Como decidir qual módulo usar em cada situação"},
]

print("\nCriando categorias...")
cat_ids = {}

# Carrega categorias existentes
existing = api("GET", "/conhecimento/categorias", token=token)
if isinstance(existing, list):
    for c in existing:
        cat_ids[c["nome"]] = c["id"]

for c in NOVAS_CATS:
    if c["nome"] in cat_ids:
        print(f"  ~ Já existe: {c['nome']}")
        continue
    r = api("POST", "/conhecimento/categorias", c, token)
    if r.get("id"):
        cat_ids[r["nome"]] = r["id"]
        print(f"  ✓ {r['nome']}")
    else:
        print(f"  ✗ {c['nome']}: {r}")
    time.sleep(0.15)

# ── Artigos ───────────────────────────────────────────────────────────────────
ARTIGOS = [

  # ═══════════════════════════════════════════════════════
  # FAQ — PERGUNTAS FREQUENTES
  # ═══════════════════════════════════════════════════════
  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como redefinir minha senha?",
    "resumo": "Passo a passo para recuperar o acesso quando esquecer a senha.",
    "tags": ["senha", "redefinir senha", "recuperar acesso", "login"],
    "conteudo": """# Como redefinir minha senha?

## Se você está na tela de login

1. Clique em **Esqueci a senha** (abaixo do campo de senha)
2. Informe seu e-mail cadastrado
3. Clique em **Enviar código**
4. Verifique sua caixa de entrada (e spam)
5. Clique no link recebido ou informe o código OTP
6. Defina a nova senha (mín. 8 caracteres)
7. Faça login com a nova senha

## Se você está logado e quer trocar a senha

1. Clique no seu nome no canto inferior do menu
2. Vá em **Meu Perfil**
3. Clique em **Alterar senha**
4. Informe a senha atual e a nova senha
5. Salve

## Se você é Master e precisa resetar a senha de outro usuário

1. Vá em **Cadastros → Usuários**
2. Localize o usuário
3. Clique em **Editar**
4. Clique em **Resetar senha**
5. O usuário receberá um e-mail com instruções

## Minha conta está bloqueada

Após 5 tentativas erradas, o sistema bloqueia automaticamente. Peça para um **Master** desbloquear em **Cadastros → Usuários → Editar → Desbloquear**.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como abrir um chamado urgente?",
    "resumo": "Como criar e escalar um chamado com prioridade crítica.",
    "tags": ["chamado urgente", "prioridade", "crítico", "escalar"],
    "conteudo": """# Como abrir um chamado urgente?

## Criando um chamado urgente

1. Vá em **Menu → Chamados** ou **Menu → Catálogo**
2. Clique em **Novo Chamado**
3. No campo **Prioridade**, selecione **Crítica** ou **Alta**
4. Descreva o problema com clareza: o que aconteceu, quando começou, qual o impacto
5. Clique em **Criar**

## O que acontece depois

- O sistema calcula automaticamente o SLA (prazo de atendimento)
- **Crítica**: 30min para resposta, 2h para resolução
- **Alta**: 2h para resposta, 8h para resolução
- O atendente recebe notificação por e-mail e WhatsApp
- O chamado aparece em destaque na fila pública

## Se ninguém assumiu e é urgente

Se o chamado está na fila há mais de 30 minutos sem atendente:
1. Abra o chamado
2. Clique em **Assumir Chamado** (se você é técnico)
3. Ou contate um Master para atribuição imediata

## Acompanhar o SLA

Na página do chamado, a **barra de SLA** mostra o tempo restante. Quando fica vermelha, o prazo foi ultrapassado e o sistema notifica os Masters automaticamente.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como ver os chamados da minha equipe?",
    "resumo": "Como visualizar chamados de toda a equipe ou setor.",
    "tags": ["chamados equipe", "todos os chamados", "gestor", "fila"],
    "conteudo": """# Como ver os chamados da minha equipe?

## Para Gestores e Masters

1. Vá em **Menu → Chamados**
2. Clique na aba **Todos** (disponível para Masters)
3. Use os filtros de **Atendente** para selecionar um membro da equipe

## Para qualquer usuário

- Aba **Meus Chamados**: chamados onde você é solicitante ou atendente
- Aba **Fila Pública**: chamados abertos sem atendente

## Filtros disponíveis

- **Status**: Aberto / Em Atendimento / Aguardando / Resolvido / Fechado
- **Prioridade**: Baixa / Média / Alta / Crítica
- **Categoria**: tipo do chamado

## Compartilhar a visualização

Os filtros ficam na URL. Copie o endereço do navegador para compartilhar a mesma visualização com um colega.

## Relatório por atendente

Para ver métricas de produtividade por atendente, acesse **Relatórios → aba Atendentes**. Você verá volume, tempo médio de resolução e CSAT individual.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como criar um novo usuário no sistema?",
    "resumo": "Passo a passo para cadastrar um colaborador.",
    "tags": ["novo usuário", "cadastrar usuário", "acesso", "convite"],
    "conteudo": """# Como criar um novo usuário?

> Requer perfil **Master** ou **Administrador** com permissão `usuarios:criar`.

## Passo a Passo

1. Acesse **Menu → Cadastros → Usuários**
2. Clique em **Novo Usuário**
3. Preencha:
   - **Nome completo**
   - **E-mail** (será usado para login)
   - **Perfil de acesso**: Técnico / Analista / Gestor / Administrador / Master
   - **Setor**: departamento do colaborador
4. Clique em **Criar**

## O que acontece

- O usuário recebe um e-mail com link de primeiro acesso
- O link expira em 48 horas
- O usuário define sua própria senha no primeiro acesso

## Reenviar convite

Se o usuário não recebeu ou o link expirou:
1. Vá em **Cadastros → Usuários**
2. Clique no usuário
3. Clique em **Reenviar convite**

## Limite de usuários

O limite depende do plano contratado. Veja em **Menu → Assinatura**.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como configurar notificações por WhatsApp?",
    "resumo": "Como ativar e personalizar notificações via WhatsApp para sua conta.",
    "tags": ["WhatsApp", "notificações", "configurar", "telefone"],
    "conteudo": """# Como configurar notificações por WhatsApp?

## Passo 1: Cadastrar seu número

1. Clique no seu nome no rodapé do menu
2. Vá em **Meu Perfil**
3. No campo **Telefone WhatsApp**, informe seu número com DDD (ex: 11999990000)
4. Salve as alterações

## Passo 2: Verificar se a integração está ativa (Master)

Para que o WhatsApp funcione, um Master precisa ter configurado a integração em **Menu → WhatsApp**. O status deve estar **Conectado** (ponto verde).

## O que você vai receber

Com o número cadastrado e integração ativa, você receberá WhatsApp quando:
- Um chamado for atribuído a você
- Alguém comentar em um chamado seu
- Uma aprovação precisar da sua decisão
- Seu SLA estiver em risco (Masters)

## Não estou recebendo as mensagens

1. Verifique se o número está correto no perfil (com DDD, sem +55)
2. Confirme com o Master se a integração está ativa
3. Verifique se o WhatsApp não bloqueou a conta de notificações
4. Tente reenviar uma notificação de teste em **WhatsApp → Testar envio**
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como acompanhar o status de uma solicitação de aprovação?",
    "resumo": "Como ver em qual etapa está sua solicitação e quem precisa aprovar.",
    "tags": ["aprovação", "status", "solicitação", "acompanhar"],
    "conteudo": """# Como acompanhar o status de uma aprovação?

## Ver suas solicitações

1. Vá em **Menu → Aprovações**
2. Clique na aba **Minhas Solicitações**
3. Veja o status de cada solicitação:
   - 🟡 **Pendente**: aguardando decisão do aprovador
   - 🟢 **Aprovada**: aceita
   - 🔴 **Rejeitada**: recusada (veja o motivo clicando na solicitação)
   - ⚫ **Cancelada**: cancelada por você

## Detalhes da solicitação

Clique em qualquer solicitação para ver:
- Quem está aprovando
- Histórico de decisões anteriores
- Motivo de rejeição (se houver)
- Observações do aprovador

## Quanto tempo demora?

Depende do aprovador do seu setor. Se está demorando muito:
1. Fale diretamente com seu gestor
2. Masters podem escalar a aprovação para outro aprovador

## Recebi pedido de ajustes

Se o aprovador pediu ajustes, você receberá uma notificação. A solicitação continua **Pendente** — adicione as informações solicitadas como comentário no ticket original ou crie uma nova solicitação atualizada.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como exportar dados do sistema?",
    "resumo": "Como exportar chamados, relatórios e dados em CSV ou PDF.",
    "tags": ["exportar", "CSV", "relatório", "download"],
    "conteudo": """# Como exportar dados do sistema?

## Exportar lista de Chamados (CSV)

1. Vá em **Menu → Chamados**
2. Aplique os filtros desejados
3. Clique no botão **CSV** no topo direito
4. O arquivo baixa com todos os chamados visíveis

O CSV inclui: número, título, status, prioridade, categoria, solicitante, atendente, cliente, SLA, datas.

## Exportar Relatórios

1. Vá em **Menu → Relatórios**
2. Selecione a aba (Chamados, SLA, Horas, etc.)
3. Defina o período
4. Clique em **Exportar**

## Exportar Histórico de Auditoria

1. Vá em **Menu → Histórico**
2. Aplique os filtros de período e usuário
3. Clique em **Exportar CSV**

## Exportar Orçamento

1. Vá em **Menu → Orçamento**
2. Selecione o ciclo
3. Clique em **Exportar** na aba Dashboard

## Dica

Para exportações recorrentes (relatórios mensais, etc.), configure uma **Automação** com agendamento para enviar o relatório por e-mail automaticamente.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como atribuir um chamado a outro técnico?",
    "resumo": "Como transferir ou atribuir a responsabilidade de um chamado.",
    "tags": ["atribuir chamado", "transferir", "atendente", "responsável"],
    "conteudo": """# Como atribuir um chamado a outro técnico?

## Atribuir diretamente

1. Abra o chamado
2. Clique em **Editar**
3. No campo **Atendente**, selecione o técnico
4. Clique em **Salvar**

O técnico recebe notificação automática por e-mail e WhatsApp.

## Atribuição em lote (Master)

Para atribuir vários chamados de uma vez:
1. Vá em **Menu → Chamados**
2. Ative os **checkboxes** nos cards desejados
3. Na barra que aparece no rodapé, selecione o atendente
4. Clique em **Aplicar**

## Remover atribuição

No campo Atendente, selecione **Sem atendente** e salve. O chamado volta para a fila pública.

## Assumir da fila

Qualquer técnico pode assumir um chamado aberto sem atendente clicando em **Assumir Chamado** no card do kanban ou na página do chamado.

## Auditoria

Toda atribuição fica registrada no **Histórico de Auditoria** do chamado com data, hora e quem fez a alteração.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como adicionar membros a um projeto?",
    "resumo": "Como convidar colaboradores para participar de um projeto.",
    "tags": ["projeto", "membros", "equipe", "colaboradores"],
    "conteudo": """# Como adicionar membros a um projeto?

## Na criação do projeto

No formulário de **Novo Projeto**, há um campo **Membros**. Pesquise e adicione os colaboradores antes de salvar.

## Em um projeto existente

1. Abra o projeto
2. Clique em **Editar** ou no ícone de configurações
3. Localize a seção **Membros da equipe**
4. Clique em **Adicionar membro**
5. Pesquise o colaborador pelo nome
6. Confirme

## Permissões de membros

Todos os membros podem:
- Ver o projeto e suas tarefas
- Criar e editar tarefas
- Comentar
- Registrar horas

Apenas o **criador do projeto** e **Masters** podem editar configurações do projeto ou adicioná/remover membros.

## Notificações

Ao ser adicionado a um projeto, o colaborador recebe notificação e o projeto aparece na lista dele automaticamente.
"""
  },

  {
    "cat": "FAQ — Perguntas Frequentes",
    "titulo": "Como ver o histórico de alterações de um chamado?",
    "resumo": "Como acessar a trilha de auditoria completa de um chamado.",
    "tags": ["histórico chamado", "auditoria", "log", "alterações"],
    "conteudo": """# Como ver o histórico de um chamado?

## Acessar o histórico

1. Abra o chamado
2. Role a página para baixo
3. Encontre a seção **Histórico de Auditoria** (antes dos comentários)

## O que é registrado

- **Criação**: quando e quem criou
- **Atribuição**: quem assumiu ou foi atribuído
- **Mudança de status**: de qual para qual status
- **Mudança de prioridade**: de qual para qual prioridade
- **Transferência**: de um atendente para outro

Cada entrada mostra: ação, valor anterior → novo valor, usuário responsável e data/hora.

## Diferença: Histórico vs. Comentários

- **Comentários**: mensagens escritas por usuários (públicas ou internas)
- **Histórico**: registro automático de alterações no sistema (não editável)

## Histórico global

Para ver alterações de TODOS os chamados e módulos, acesse **Menu → Histórico**.
"""
  },

  # ═══════════════════════════════════════════════════════
  # SOLUÇÃO DE PROBLEMAS
  # ═══════════════════════════════════════════════════════
  {
    "cat": "Solução de Problemas",
    "titulo": "Não consigo fazer login — Credenciais inválidas",
    "resumo": "O que fazer quando o sistema rejeita email e senha.",
    "tags": ["login", "credenciais inválidas", "erro login", "acesso negado"],
    "conteudo": """# Não consigo fazer login

## Passo 1: Verificar email e senha

- Confirme que está usando o e-mail correto (verifique com o administrador)
- A senha é case-sensitive (maiúsculas e minúsculas importam)
- Desative o Caps Lock e tente novamente

## Passo 2: Redefinir senha

Se não lembra a senha:
1. Clique em **Esqueci a senha**
2. Informe o e-mail
3. Verifique o e-mail (inclusive a pasta Spam)
4. Clique no link e defina nova senha

## Passo 3: Conta bloqueada?

Após 5 tentativas erradas, a conta é bloqueada automaticamente. Sinais:
- Mensagem "Conta bloqueada" na tela de login
- O campo de senha não aceita nenhum valor

**Solução**: contate um Master para desbloquear em Cadastros → Usuários → Desbloquear.

## Passo 4: Conta inativa?

Se um administrador desativou sua conta:
- A mensagem pode ser "Usuário inativo" ou "Credenciais inválidas"
- Contate o Master da sua organização

## Ainda não funciona?

Limpe o cache do navegador (Ctrl+Shift+Delete) e tente novamente. Se persistir, use um navegador diferente.
"""
  },

  {
    "cat": "Solução de Problemas",
    "titulo": "Meu chamado não aparece na fila",
    "resumo": "Por que um chamado pode não aparecer na lista ou fila esperada.",
    "tags": ["chamado sumiu", "fila", "não aparece", "filtro"],
    "conteudo": """# Meu chamado não aparece na fila

## Causa 1: Filtros ativos

A causa mais comum. Verifique:
1. Vá em **Menu → Chamados**
2. Olhe os filtros de Status, Prioridade e Categoria
3. Se houver algum filtro ativo, clique em **Limpar**
4. Verifique se o chamado aparece agora

## Causa 2: Aba errada

- **Meus Chamados**: só mostra chamados onde VOCÊ é solicitante ou atendente
- **Fila Pública**: só mostra chamados ABERTOS e SEM atendente
- **Todos**: disponível apenas para Masters

Mude de aba e veja se o chamado aparece.

## Causa 3: Chamado com status diferente do esperado

Chamados com status **Resolvido**, **Fechado** ou **Cancelado** não aparecem nas abas padrão. Use o filtro de Status para incluí-los.

## Causa 4: Chamado foi atribuído a outra pessoa

Se o chamado estava na fila pública e outro técnico assumiu, ele saiu da fila. Verifique em **Todos** (Master) ou peça ao gestor para verificar.

## Chamado realmente sumiu (bug)

Em último caso, verifique o **Histórico de Auditoria** do chamado pelo número (#123). Se o chamado foi deletado por um Master, aparecerá no **Menu → Histórico**.
"""
  },

  {
    "cat": "Solução de Problemas",
    "titulo": "Notificação WhatsApp não está chegando",
    "resumo": "Diagnóstico para quando as mensagens WhatsApp não são recebidas.",
    "tags": ["WhatsApp", "notificação", "não recebo", "problema"],
    "conteudo": """# Notificação WhatsApp não está chegando

## Verificação 1: Número cadastrado?

1. Clique no seu nome no menu
2. Vá em **Meu Perfil**
3. Confirme se o campo **Telefone WhatsApp** está preenchido
4. Formato correto: apenas números com DDD, sem espaços (ex: 11999990000)
5. Salve se precisar corrigir

## Verificação 2: Integração ativa?

Peça a um **Master** para verificar:
1. **Menu → WhatsApp**
2. O status deve estar **Conectado** (ponto verde)
3. Se estiver desconectado, reconectar escaneando o QR Code

## Verificação 3: WhatsApp bloqueou?

O WhatsApp Business pode bloquear o número de notificação se receber muitas mensagens sem interação. Solução:
1. No seu WhatsApp, adicione o número do sistema aos contatos
2. Envie uma mensagem "Oi" para o número
3. Isso desbloqueia as notificações

## Verificação 4: Tipo de evento

Nem todo evento gera WhatsApp. Atualmente recebem:
- Chamado atribuído a você ✓
- Aprovação pendente ✓
- SLA violado (Masters) ✓
- Comentário em chamado ✓

## Testar envio

Masters podem testar em **WhatsApp → Testar envio manual**.
"""
  },

  {
    "cat": "Solução de Problemas",
    "titulo": "Erro ao criar item de orçamento",
    "resumo": "O que fazer quando aparece erro ao criar OPEX ou CAPEX.",
    "tags": ["orçamento", "erro", "OPEX", "CAPEX", "criar item"],
    "conteudo": """# Erro ao criar item de orçamento

## Erro: "Ciclo não encontrado"

É necessário ter um **ciclo orçamentário** criado antes de lançar itens.

1. Vá em **Orçamento → Dashboard**
2. Clique em **Novo Ciclo**
3. Informe o ano (ex: 2026)
4. Depois crie os itens dentro do ciclo

## Erro: "Categoria não encontrada"

Verifique se a categoria selecionada existe na organização.
1. Vá em **Orçamento → Configurações**
2. Confirme se a categoria está cadastrada e ativa

## Formulário não abre ou não salva

1. Verifique se todos os campos obrigatórios estão preenchidos (marcados com *)
2. O valor não pode ser negativo
3. Verifique sua conexão de internet

## Permissão negada

Para criar itens de orçamento, você precisa da permissão `orcamento:planejar`. Solicite ao Master que verifique seu perfil em **Configurações → Perfis de Acesso**.
"""
  },

  {
    "cat": "Solução de Problemas",
    "titulo": "Não consigo ver determinado módulo no menu",
    "resumo": "Por que alguns módulos ficam ocultos e como solicitar acesso.",
    "tags": ["módulo oculto", "permissão", "menu", "acesso negado"],
    "conteudo": """# Não consigo ver determinado módulo no menu

## Por que acontece

O Orkiestri controla o acesso por **perfil de usuário**. Se você não tem permissão para um módulo, ele simplesmente não aparece no menu.

## Como verificar suas permissões

1. Clique no seu nome no rodapé do menu
2. Vá em **Meu Perfil**
3. Veja seu **Perfil de acesso** (Técnico, Analista, Gestor, etc.)

## Como solicitar acesso

Fale com um **Master** ou **Administrador** da sua organização e peça para:
1. Ir em **Configurações → Perfis de Acesso**
2. Adicionar a permissão necessária ao seu perfil
3. OU alterar seu perfil para um com mais acesso

## Módulos e permissões necessárias

| Módulo | Permissão |
|--------|-----------|
| Chamados | `chamados:ver` |
| Projetos | `projetos:ver` |
| Relatórios | `relatorios:ver` |
| Orçamento | `orcamento:ver` |
| Ativos | `ativos:ver` |
| Conhecimento | `conhecimento:ver` |
| Histórico | `historico:ver` |

## Módulos sempre visíveis

**Command Center**, **Aprovações**, **Agenda**, **Keep** e **Workforce** são visíveis para todos os usuários ativos.
"""
  },

  {
    "cat": "Solução de Problemas",
    "titulo": "O SLA está sendo calculado errado",
    "resumo": "Como diagnosticar e corrigir problemas no cálculo de SLA.",
    "tags": ["SLA", "cálculo", "prazo errado", "configuração SLA"],
    "conteudo": """# O SLA está sendo calculado errado

## Causa 1: Sem regra configurada para a prioridade

Se não há regra de SLA para a prioridade do chamado, o sistema usa os valores padrão:
- Baixa: 72h | Média: 24h | Alta: 8h | Crítica: 2h

Para personalizar, vá em **Configurações → SLA** e crie regras específicas.

## Causa 2: Regra nova não aplicou aos chamados abertos

Ao alterar regras de SLA, os chamados já criados mantêm o prazo original.

Para recalcular todos os chamados abertos com as novas regras:
1. Vá em **Configurações → SLA**
2. Clique em **Recalcular SLA** (botão no rodapé)
3. Confirme a operação

## Causa 3: Fuso horário errado

Se os prazos estão fora do horário esperado, verifique o fuso em **Configurações → Organização → Fuso horário**.

## Causa 4: Chamado foi reaberto

Quando um chamado fechado é reaberto, o SLA é recalculado a partir do momento da reabertura, não da criação original.

## Ver o SLA de um chamado

Na página do chamado, a **barra SLA** mostra:
- Data de criação
- Prazo calculado
- Tempo restante (ou atraso)
- Status da primeira resposta
"""
  },

  # ═══════════════════════════════════════════════════════
  # GLOSSÁRIO
  # ═══════════════════════════════════════════════════════
  {
    "cat": "Glossário",
    "titulo": "Glossário Orkiestri — A a Z",
    "resumo": "Todos os termos técnicos e conceitos do sistema explicados.",
    "tags": ["glossário", "termos", "definições", "conceitos"],
    "conteudo": """# Glossário Orkiestri

## A

**Aprovação**: processo formal de autorização para uma solicitação (despesa, compra, etc.) percorrer uma hierarquia antes de ser executada.

**Atendente**: o usuário responsável por resolver um chamado. Também chamado de técnico ou analista.

**Ativo**: qualquer equipamento, software ou bem da empresa registrado no inventário (computadores, licenças, impressoras, etc.).

## C

**CAPEX** (Capital Expenditure): investimentos em ativos de longo prazo, como compra de equipamentos ou infraestrutura.

**CMDB** (Configuration Management Database): mapa de relacionamentos entre ativos, usuários, contratos e fornecedores.

**CSAT** (Customer Satisfaction): nota de satisfação dada pelo solicitante após o fechamento de um chamado. Escala de 1 a 5 estrelas.

## D

**Drag-and-drop**: arrastar e soltar. No kanban, arraste um card de chamado para outra coluna para mudar seu status.

## F

**Fila Pública**: conjunto de chamados abertos sem atendente atribuído. Qualquer técnico pode assumir um chamado da fila.

## K

**Kanban**: visualização em colunas onde cada coluna representa um status (Aberto, Em Atendimento, Aguardando, Resolvido, Fechado).

**KPI** (Key Performance Indicator): indicador-chave de performance. Ex: SLA compliance, CSAT médio, chamados abertos.

## M

**Master**: perfil de acesso máximo. Vê e gerencia tudo na organização, configura permissões e parâmetros do sistema.

**Multi-tenant**: arquitetura onde múltiplas organizações usam o mesmo sistema com dados completamente isolados entre si.

## O

**OPEX** (Operational Expenditure): gastos operacionais recorrentes, como assinaturas de software, manutenções mensais.

## R

**RBAC** (Role-Based Access Control): controle de acesso baseado em papéis/perfis. Cada perfil tem permissões específicas.

## S

**SLA** (Service Level Agreement): acordo de nível de serviço. Define prazos máximos de **resposta** (primeiro contato do atendente) e **resolução** (fechamento do chamado).

**SLA em Risco**: chamado onde o prazo vence em menos de 2 horas.

**SLA Violado**: chamado onde o prazo de resolução já foi ultrapassado sem fechamento.

**Squad**: grupo de colaboradores com uma finalidade específica (ex: Squad de Infraestrutura).

**Solicitante**: o usuário que criou o chamado ou solicitação.

## T

**Template**: modelo salvo de formulário para reutilização. Ex: template de chamado para onboarding.

**Ticket**: sinônimo de chamado. Registro de uma solicitação de suporte ou serviço.

## W

**Webhook**: notificação automática enviada para um sistema externo quando um evento ocorre (ex: chamado criado → POST para Slack).

**Workflow**: fluxo de trabalho com etapas definidas. No Orkiestri, pode ser um processo visual criado no módulo Processos.
"""
  },

  {
    "cat": "Glossário",
    "titulo": "O que é SLA e como funciona no Orkiestri?",
    "resumo": "Explicação completa do conceito de SLA e como ele é aplicado.",
    "tags": ["SLA", "o que é SLA", "prazo", "atendimento"],
    "conteudo": """# O que é SLA?

**SLA** (Service Level Agreement) é um **acordo de nível de serviço**: o compromisso de atender dentro de um prazo específico.

## Dois tipos de prazo no Orkiestri

### 1. SLA de Resposta
Tempo máximo para o **primeiro comentário** do atendente após a abertura do chamado.

Exemplo: SLA de resposta de 4h significa que o atendente deve dar um retorno inicial em até 4 horas.

### 2. SLA de Resolução
Tempo máximo para o chamado ser **fechado** (status Resolvido ou Fechado).

Exemplo: SLA de resolução de 24h significa que o problema deve ser solucionado em até 24 horas.

## Como é calculado

O prazo começa a contar a partir do **momento da criação** do chamado.

Se criado às 09:00 com SLA de 8h, o prazo de resolução é 17:00 do mesmo dia.

## Status do SLA

| Status | Significado | Ação |
|--------|-------------|------|
| ✅ Dentro do prazo | Tempo suficiente disponível | Nenhuma |
| ⚠️ Em Risco | Menos de 2h para vencer | Urgência no atendimento |
| 🔴 Violado | Prazo ultrapassado | Masters são notificados |

## Por que o SLA importa?

- Garante previsibilidade para o cliente/solicitante
- Permite medir a qualidade do atendimento
- Identifica gargalos na equipe
- Base para o relatório de compliance

## Configurar SLA

Masters configuram os prazos em **Configurações → SLA**, podendo criar regras diferentes por prioridade e categoria.
"""
  },

  {
    "cat": "Glossário",
    "titulo": "O que é CSAT?",
    "resumo": "Explicação do índice de satisfação e como ele é coletado.",
    "tags": ["CSAT", "satisfação", "avaliação", "o que é"],
    "conteudo": """# O que é CSAT?

**CSAT** significa Customer Satisfaction Score — índice de satisfação do cliente/usuário com o atendimento recebido.

## Como é coletado

Após um chamado ser **fechado**, o solicitante recebe a opção de avaliar:
- **1 estrela** ⭐ — Péssimo
- **2 estrelas** ⭐⭐ — Ruim
- **3 estrelas** ⭐⭐⭐ — Regular
- **4 estrelas** ⭐⭐⭐⭐ — Bom
- **5 estrelas** ⭐⭐⭐⭐⭐ — Excelente

Um comentário opcional pode acompanhar a nota.

## Onde ver os resultados

- **Command Center**: CSAT médio no widget de Chamados
- **Dashboard Executivo**: média e total de avaliações do mês
- **Menu → CSAT**: painel completo com distribuição e histórico
- **Relatórios → SLA & CSAT**: tendência ao longo do tempo

## Meta recomendada

| CSAT médio | Interpretação |
|------------|---------------|
| ≥ 4.5 | Excelente |
| 4.0 – 4.4 | Bom |
| 3.0 – 3.9 | Atenção |
| < 3.0 | Crítico |

## Quem pode avaliar

Apenas o **solicitante** do chamado pode avaliá-lo, e somente após o chamado estar fechado. A nota pode ser atualizada enquanto o chamado permanecer fechado.
"""
  },

  {
    "cat": "Glossário",
    "titulo": "O que é CAPEX e OPEX?",
    "resumo": "Diferença entre CAPEX e OPEX no contexto do orçamento empresarial.",
    "tags": ["CAPEX", "OPEX", "orçamento", "investimento", "despesa"],
    "conteudo": """# O que é CAPEX e OPEX?

## OPEX — Despesas Operacionais

**OPEX** (Operational Expenditure) são os gastos recorrentes necessários para manter a operação da empresa.

**Exemplos:**
- Assinatura de software (Microsoft 365, Adobe)
- Serviços de manutenção
- Salários e benefícios
- Aluguel de espaço
- Serviços de nuvem (AWS, Azure) mensais

No Orkiestri, itens OPEX são lançados como despesas recorrentes no módulo de Orçamento.

## CAPEX — Investimentos de Capital

**CAPEX** (Capital Expenditure) são investimentos em ativos que gerarão valor a longo prazo.

**Exemplos:**
- Compra de servidores
- Aquisição de equipamentos
- Desenvolvimento de software proprietário
- Reforma de instalações

No Orkiestri, itens CAPEX ficam separados do OPEX no orçamento e geralmente são vinculados a ativos cadastrados.

## Diferença prática

| | OPEX | CAPEX |
|-|------|-------|
| **Natureza** | Despesa | Investimento |
| **Recorrência** | Mensal/anual | Pontual |
| **Impacto contábil** | Resultado do período | Balanço patrimonial |
| **Exemplo** | Licença mensal | Compra de notebook |

## No módulo de Orçamento

Ao criar um item, você escolhe se é **OPEX** ou **CAPEX**. Cada tipo tem sua própria aba e os gráficos são separados para facilitar a análise.
"""
  },

  # ═══════════════════════════════════════════════════════
  # GUIAS POR PERFIL
  # ═══════════════════════════════════════════════════════
  {
    "cat": "Guias por Perfil",
    "titulo": "Guia do Técnico — Primeiros Passos",
    "resumo": "Tudo que um técnico precisa saber para começar a atender chamados.",
    "tags": ["técnico", "guia técnico", "atendimento", "primeiros passos"],
    "conteudo": """# Guia do Técnico — Primeiros Passos

Bem-vindo ao Orkiestri! Como técnico, seu foco é atender chamados e resolver problemas.

## Sua rotina diária

### 1. Verificar a Fila
Acesse **Menu → Chamados → aba Fila Pública**. Estes são chamados sem atendente aguardando seu olhar.

### 2. Assumir chamados
Clique em **Assumir Chamado** nos cards da fila pública. Você receberá os chamados que mais combinam com suas habilidades.

### 3. Atender chamados do seu painel
Em **Meus Chamados**, veja tudo que está sob sua responsabilidade. Priorize por SLA (itens em risco primeiro).

### 4. Atualizar status corretamente

| Ação | Status |
|------|--------|
| Começou a trabalhar | Em Atendimento |
| Aguardando resposta do cliente | Aguardando |
| Problema resolvido | Resolvido |

### 5. Registrar horas
Para cada chamado trabalhado, registre as horas em **Detalhe do chamado → Horas apontadas → Apontar**.

### 6. Usar notas internas
Para comunicações que o cliente não deve ver, use **Comentário Interno** (🔒).

## Dicas de produtividade

- Use `Ctrl+K` para busca rápida de chamados pelo número
- Atalho `Ctrl+Enter` no campo de comentário para enviar sem clicar
- O **Command Center** mostra os alertas mais urgentes logo ao entrar no sistema

## O que evitar

- ❌ Não deixe chamados em **Em Atendimento** por dias sem atualização
- ❌ Não feche chamados sem confirmar a solução com o solicitante
- ❌ Não esqueça de registrar as horas (serve para medir sua capacidade)
"""
  },

  {
    "cat": "Guias por Perfil",
    "titulo": "Guia do Gestor — Acompanhando a Equipe",
    "resumo": "Como um gestor monitora a equipe e garante a operação saudável.",
    "tags": ["gestor", "guia gestor", "equipe", "acompanhamento"],
    "conteudo": """# Guia do Gestor — Acompanhando a Equipe

Como gestor, você precisa garantir que a equipe entrega dentro dos prazos e com qualidade.

## Visão diária recomendada

### 1. Command Center (Dashboard principal)
Ao entrar, verifique:
- **Status bar**: há alertas críticos?
- **Widget Chamados**: quantos urgentes e SLA violados?
- **Widget Aprovações**: há itens aguardando SUA decisão?

### 2. Relatórios (semanal)
Em **Menu → Relatórios → aba Atendentes**:
- Quem está com mais chamados abertos?
- Quem tem pior tempo de resolução?
- Quem precisa de suporte?

### 3. Capacidade (semanal)
Em **Menu → Capacidade**:
- Alguém está sobrecarregado (>90% da capacidade)?
- Alguém está subutilizado (<30%)?
- Rebalancear a distribuição de chamados

## Gerenciar aprovações

Você receberá notificação quando houver solicitações aguardando sua aprovação:
- Verifique **Menu → Aprovações → Fila**
- Tome decisão em até 24h para evitar gargalos

## Acompanhar projetos

Em **Menu → Projetos**, filtre pelos projetos do seu setor e verifique o progresso. Use a **Linha do Tempo (Gantt)** para identificar atrasos.

## Indicadores que todo gestor deve monitorar

| Indicador | Meta sugerida |
|-----------|---------------|
| SLA Compliance | > 90% |
| CSAT médio | > 4.0 |
| Chamados urgentes abertos | < 3 |
| Chamados sem update > 3 dias | 0 |
"""
  },

  {
    "cat": "Guias por Perfil",
    "titulo": "Guia do Solicitante — Como Abrir e Acompanhar Solicitações",
    "resumo": "Para quem precisa solicitar suporte mas não é da equipe técnica.",
    "tags": ["solicitante", "abrir chamado", "acompanhar", "usuário final"],
    "conteudo": """# Guia do Solicitante

Você é um usuário que precisa de suporte ou serviço. Veja como usar o Orkiestri de forma simples.

## Como pedir ajuda

### Forma rápida: Catálogo
1. Acesse **Menu → Catálogo**
2. Encontre o serviço que precisa (TI, RH, Financeiro...)
3. Clique em **Solicitar**
4. Preencha os detalhes
5. Pronto! Sua solicitação foi criada

### Forma manual: Novo Chamado
1. Acesse **Menu → Chamados**
2. Clique em **Novo Chamado**
3. Descreva o problema com clareza
4. Informe a prioridade
5. Crie

## Como descrever bem um problema

Uma boa descrição acelera muito o atendimento. Inclua:
- **O que aconteceu**: descreva o erro ou necessidade
- **Quando começou**: data e hora aproximada
- **Impacto**: está impedindo seu trabalho? Afeta outras pessoas?
- **O que já tentou**: reiniciar, atualizar, etc.

## Acompanhar sua solicitação

1. Vá em **Chamados → Meus Chamados**
2. Veja o status atual do seu chamado
3. Você pode **adicionar comentários** para dar mais informações
4. Receberá notificações por e-mail quando houver atualização

## Avaliar o atendimento

Após o chamado ser fechado, você recebe a opção de avaliar. Isso é muito importante para melhorar o serviço — por favor, avalie!

## Boas práticas

- 📌 Um chamado por problema (não agrupe vários problemas)
- 📸 Se possível, anexe prints de erros
- 🔔 Responda rápido quando o técnico pedir informações (chamado em "Aguardando")
- ✅ Confirme quando o problema foi resolvido antes de avaliar
"""
  },

  {
    "cat": "Guias por Perfil",
    "titulo": "Guia do Master — Administrando a Plataforma",
    "resumo": "Responsabilidades e boas práticas para o administrador Master.",
    "tags": ["master", "administrador", "configuração", "organização"],
    "conteudo": """# Guia do Master — Administrando a Plataforma

Como Master, você tem acesso total e a responsabilidade de manter o sistema funcionando corretamente.

## Configuração inicial (one-time)

- [ ] Dados da organização em **Configurações → Organização**
- [ ] Criar setores em **Configurações → Setores**
- [ ] Configurar SLA em **Configurações → SLA**
- [ ] Criar perfis de acesso customizados se necessário
- [ ] Configurar WhatsApp (opcional)
- [ ] Cadastrar usuários em **Cadastros → Usuários**
- [ ] Definir aprovadores por setor em **Aprovações → Configurar**
- [ ] Cadastrar categorias de ativos em **Ativos → Configurações**

## Responsabilidades recorrentes

### Semanal
- Verificar **Command Center** para situações críticas
- Revisar chamados com SLA violado
- Verificar aprovações pendentes há mais de 48h

### Mensal
- Analisar **Relatórios** de CSAT e SLA
- Revisar usuários inativos (desativar se necessário)
- Verificar contratos vencendo no próximo mês
- Revisar o orçamento realizado vs. previsto

### Trimestral
- Revisar permissões de usuários
- Atualizar base de conhecimento
- Avaliar automações ativas
- Verificar integração WhatsApp

## Ações exclusivas do Master

- Deletar registros permanentemente
- Recalcular SLA em lote
- Ver todos os chamados (sem filtro de propriedade)
- Acessar o painel de auditoria completo
- Gerenciar perfis e permissões
- Configurar integrações externas
- Acessar dashboard de IA Operacional

## Dicas de segurança

- Nunca compartilhe credenciais Master
- Revise o **Histórico** periodicamente para detectar atividades suspeitas
- Mantenha mínimo de 2 Masters ativos por organização
- Desative imediatamente contas de colaboradores que saíram da empresa
"""
  },

  # ═══════════════════════════════════════════════════════
  # QUANDO USAR O QUÊ
  # ═══════════════════════════════════════════════════════
  {
    "cat": "Quando Usar o Quê",
    "titulo": "Chamado vs. Projeto vs. Aprovação — Qual usar?",
    "resumo": "Guia de decisão para escolher o módulo certo para cada situação.",
    "tags": ["chamado", "projeto", "aprovação", "decisão", "quando usar"],
    "conteudo": """# Chamado vs. Projeto vs. Aprovação

Três módulos distintos para situações distintas. Veja qual usar:

## 🎫 Use um CHAMADO quando...

- Você tem um **problema** que precisa ser resolvido
- É uma solicitação de **suporte técnico**
- É uma **demanda recorrente** do dia a dia
- Precisa de **SLA e rastreamento** de prazo
- É algo que **um técnico resolve** em horas ou dias

**Exemplos:**
- "Meu computador não liga"
- "Preciso de acesso ao sistema X"
- "O relatório está com erro"
- "Instalar software no meu notebook"

---

## 📁 Use um PROJETO quando...

- É uma **iniciativa com múltiplas etapas**
- Envolve **várias pessoas** trabalhando juntas
- Tem um **prazo e entregável** definido
- Requer **planejamento** e acompanhamento de progresso
- Dura **dias, semanas ou meses**

**Exemplos:**
- "Migração para nova infraestrutura cloud"
- "Implantação do novo ERP"
- "Desenvolvimento do portal do cliente"
- "Projeto de certificação ISO"

---

## ✅ Use uma APROVAÇÃO quando...

- Você precisa de **autorização** de alguém
- Envolve **gasto ou investimento** da empresa
- Há uma **hierarquia de decisão** a ser respeitada
- O processo precisa de **registro formal**

**Exemplos:**
- "Quero comprar um notebook de R$ 4.000"
- "Preciso fazer horas extras"
- "Quero tirar férias na semana X"
- "Precisamos contratar um fornecedor"

---

## Resumo rápido

| Situação | Módulo |
|----------|--------|
| Algo quebrado / suporte | Chamado |
| Pedido de serviço (TI, RH) | Catálogo → Chamado |
| Iniciativa com múltiplas etapas | Projeto |
| Precisa de autorização/gasto | Aprovação |
| Ideia ou nota pessoal | Keep |
| Reunião ou compromisso | Agenda |
"""
  },

  {
    "cat": "Quando Usar o Quê",
    "titulo": "Catálogo de Serviços vs. Novo Chamado — Qual a diferença?",
    "resumo": "Quando usar o Catálogo e quando criar um chamado manualmente.",
    "tags": ["catálogo", "novo chamado", "diferença", "serviços"],
    "conteudo": """# Catálogo vs. Novo Chamado

## Catálogo de Serviços

Use quando o que você precisa **já está mapeado** como um serviço padrão da empresa.

**Vantagens:**
- Formulário já pré-preenchido com as informações certas
- Categoria correta aplicada automaticamente
- SLA já configurado para aquele tipo de serviço
- Mais rápido (menos campos para preencher)
- Direciona para o setor certo imediatamente

**Use para:**
- Solicitações de TI padronizadas (novo usuário, acesso, equipamento)
- Solicitações de RH (férias, documentos, benefícios)
- Solicitações financeiras padrão (reembolso, nota fiscal)

## Novo Chamado

Use quando o problema ou solicitação é **específico, único ou não mapeado** no catálogo.

**Vantagens:**
- Flexibilidade total para descrever qualquer situação
- Pode ser mais detalhado
- Útil para bugs e problemas inesperados

**Use para:**
- Erros e bugs específicos
- Situações que não se encaixam em nenhuma categoria do catálogo
- Chamados criados por técnicos para si mesmos
- Situações urgentes que precisam de campo de descrição livre

## Regra geral

> Se está no Catálogo → use o Catálogo.
> Se não está → crie um Chamado manualmente.

Ambos geram o mesmo tipo de registro no sistema — a diferença é só na conveniência do formulário.
"""
  },

  {
    "cat": "Quando Usar o Quê",
    "titulo": "Keep vs. Agenda vs. Projetos — Organizando seu trabalho",
    "resumo": "Quando usar cada módulo de organização pessoal e colaborativa.",
    "tags": ["Keep", "Agenda", "Projetos", "organização", "produtividade"],
    "conteudo": """# Keep vs. Agenda vs. Projetos

## 📝 Keep — Para uso pessoal e imediato

O Keep é seu **bloco de notas digital pessoal**.

**Use o Keep para:**
- Anotações rápidas que só você vai ver
- Lista de tarefas do dia (tasks diárias)
- Ideias e rascunhos
- Lembretes pessoais
- Notas de reuniões para uso próprio

**Não use para:** trabalho colaborativo, nada que outros precisem acompanhar.

---

## 📅 Agenda — Para compromissos no tempo

A Agenda é para **eventos com data e hora específicos**.

**Use a Agenda para:**
- Reuniões e calls
- Compromissos externos
- Entregas com data específica
- Eventos que precisam aparecer no calendário da equipe
- Lembretes com data/hora (ex: renovar SSL em 26/05)

**Não use para:** tarefas sem prazo, projetos longos, atividades sem tempo definido.

---

## 📁 Projetos — Para iniciativas colaborativas

Projetos são para **trabalho em equipe com múltiplas etapas**.

**Use Projetos para:**
- Iniciativas com várias tarefas interdependentes
- Trabalho que envolve múltiplos colaboradores
- Entregas que levam dias ou semanas
- Quando precisa de kanban, progresso percentual e linha do tempo

**Não use para:** tarefas únicas simples, anotações pessoais, compromissos pontuais.

---

## Resumo

| Módulo | Para quem? | Para quando? | Colaborativo? |
|--------|-----------|--------------|---------------|
| Keep | Você mesmo | Qualquer hora | ❌ Não |
| Agenda | Equipe | Data/hora específica | ✅ Sim |
| Projetos | Equipe | Prazo longo | ✅ Sim |
"""
  },

  {
    "cat": "Quando Usar o Quê",
    "titulo": "Ativos vs. CMDB — Diferença e uso combinado",
    "resumo": "Entenda a diferença entre cadastrar ativos e usar o mapa de dependências.",
    "tags": ["ativos", "CMDB", "diferença", "inventário"],
    "conteudo": """# Ativos vs. CMDB

## 📦 Módulo de Ativos — O inventário

O módulo **Ativos** é o **cadastro** dos seus equipamentos e bens.

**O que você faz aqui:**
- Cadastrar novos equipamentos (notebooks, servidores, impressoras...)
- Registrar valor, data de compra e garantia
- Atribuir a um responsável
- Marcar status (ativo, manutenção, inativo)
- Gerenciar o ciclo de vida (ativo → manutenção → descarte)

**Analogia:** É como a planilha de inventário, mas mais poderosa.

---

## 🗺️ CMDB — O mapa de relacionamentos

O **CMDB** usa os dados dos ativos para mostrar **como tudo se conecta**.

**O que você vê aqui:**
- Qual usuário usa qual equipamento
- Qual contrato cobre qual ativo
- Qual fornecedor forneceu quais ativos
- Qual seria o impacto se um ativo sair de operação

**Analogia:** É o mapa do metrô — você vê não só as estações (ativos), mas as linhas que as conectam.

---

## Fluxo de uso combinado

```
1. Cadastre o equipamento em ATIVOS
   ↓
2. Atribua a um usuário, vincule contrato e fornecedor
   ↓
3. Use o CMDB para análise de impacto antes de manutenções
```

## Caso prático

**Cenário**: Servidor vai entrar em manutenção amanhã.

1. No **CMDB**, clique no servidor
2. Veja: 3 usuários dependem dele, 1 contrato de manutenção vinculado, 2 outros servidores do mesmo fornecedor
3. Comunique os 3 usuários antes de parar o servidor
4. Verifique o contrato para garantir que a manutenção está coberta
"""
  },

  {
    "cat": "Quando Usar o Quê",
    "titulo": "Automações vs. Workflows — Qual a diferença?",
    "resumo": "Quando configurar uma automação e quando criar um processo no Workflow Visual.",
    "tags": ["automações", "workflows", "processos", "diferença"],
    "conteudo": """# Automações vs. Workflows

Dois módulos diferentes para propósitos distintos.

## ⚡ Automações — Reações automáticas a eventos

Automações executam **ações imediatas** quando algo acontece no sistema.

**Lógica:** SE evento X ocorrer → ENTÃO execute ação Y

**Use automações para:**
- Notificar alguém quando um chamado urgente é criado
- Enviar WhatsApp quando SLA viola
- Chamar um webhook externo quando um chamado é resolvido
- Alterar status automaticamente em certas condições

**Característica:** A automação executa sozinha, sem intervenção humana.

---

## 🔀 Workflows (Processos) — Fluxos com etapas humanas

Workflows são **templates de processos** com etapas que pessoas precisam completar.

**Lógica:** Processo começa → Etapa 1 → (aprovação) → Etapa 2 → Conclusão

**Use workflows para:**
- Onboarding de novos funcionários (sequência de tarefas)
- Processo de compra (solicitar → aprovar → emitir pedido)
- Implantação de sistema (levantamento → desenvolvimento → testes → go live)
- Qualquer processo com etapas ordenadas e responsáveis definidos

**Característica:** O workflow guia humanos por um processo, com pontos de aprovação e responsabilidades.

---

## Resumo

| | Automação | Workflow |
|-|-----------|----------|
| **Quem executa** | O sistema | Pessoas |
| **Gatilho** | Evento automático | Início manual |
| **Duração** | Instantânea | Dias/semanas |
| **Etapas** | 1 ação | Múltiplas etapas |
| **Aprovações** | Pode notificar | Integrado ao processo |
| **Exemplo** | Notificar técnico ao criar chamado | Onboarding de colaborador |
"""
  },

  {
    "cat": "Quando Usar o Quê",
    "titulo": "Relatórios vs. IA Operacional — Análise histórica vs. preditiva",
    "resumo": "Quando usar os Relatórios e quando consultar a IA Operacional.",
    "tags": ["relatórios", "IA", "análise", "preditivo", "histórico"],
    "conteudo": """# Relatórios vs. IA Operacional

## 📊 Relatórios — O que JÁ aconteceu

Os **Relatórios** mostram dados históricos consolidados para análise.

**Use Relatórios para:**
- Reuniões de resultado (mensal, trimestral)
- Apresentações para diretoria
- Análise de tendência de longo prazo
- Comparativo entre períodos
- Medir performance da equipe

**Acesse:** Menu → Relatórios

**Abas:** Chamados, SLA & CSAT, Horas, Projetos, Atendentes, Comparativo

---

## 🤖 IA Operacional — O que está ACONTECENDO agora

A **IA Operacional** analisa o estado atual em tempo real e gera alertas e recomendações.

**Use a IA para:**
- Identificar problemas imediatos que precisam de ação
- Verificar a saúde geral da operação (score)
- Detectar anomalias (picos inesperados de chamados)
- Priorizar o que precisa de atenção agora

**Acesse:** Menu → IA Operacional

**Principais recursos:** Score operacional, Matriz de riscos, Tendência 14 dias, Recomendações

---

## Uso combinado

```
Manhã (diário):
→ Abra o Command Center ou IA Operacional
→ Veja o score e alertas críticos
→ Tome ações imediatas

Sexta-feira (semanal):
→ Abra Relatórios → Chamados
→ Analise a semana
→ Identifique padrões

Início do mês:
→ Relatórios → Comparativo
→ Compare com mês anterior
→ Prepare apresentação para gestão
```
"""
  },

]

# ── Criar artigos ─────────────────────────────────────────────────────────────
print(f"\nCriando {len(ARTIGOS)} artigos...")
ok = erros = 0

for art in ARTIGOS:
    cid = cat_ids.get(art["cat"], "")
    if not cid:
        print(f"  ✗ Categoria não encontrada: {art['cat']}")
        erros += 1
        continue
    body = {
        "titulo": art["titulo"],
        "resumo": art["resumo"],
        "conteudo": art["conteudo"],
        "categoriaId": cid,
        "tags": art.get("tags", []),
        "status": "rascunho",
    }
    r = api("POST", "/conhecimento", body, token)
    aid = r.get("id", "")
    if not aid:
        print(f"  ✗ Falha: {art['titulo'][:50]}")
        erros += 1
        continue
    api("PATCH", f"/conhecimento/{aid}/publicar", {"publicar": True}, token)
    ok += 1
    print(f"  ✓ [{art['cat'][:22]}] {art['titulo'][:55]}")
    time.sleep(0.12)

print(f"\n{'='*65}")
print(f"Concluído: {ok} artigos | {erros} erros | Categorias: {len(cat_ids)}")
print(f"Total acumulado na base: {len(ARTIGOS)} novos + 30 anteriores = ~{len(ARTIGOS)+30} artigos")
