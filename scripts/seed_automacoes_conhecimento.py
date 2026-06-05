#!/usr/bin/env python3
"""
Seed da Base de Conhecimento — Módulo de Automações do Orkiestri.
Cria a categoria "Automações & Webhooks" e 7 artigos didáticos.

Uso:
  ORKESTRI_EMAIL=admin@empresa.com ORKESTRI_SENHA=suasenha python3 seed_automacoes_conhecimento.py
  python3 seed_automacoes_conhecimento.py --base http://localhost:3000/api --email admin@empresa.com --senha suasenha
"""

import json, subprocess, sys, argparse, os

# ── Config ────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--base",  default=os.environ.get("ORKESTRI_BASE",  "http://api:3000/api"))
parser.add_argument("--email", default=os.environ.get("ORKESTRI_EMAIL", ""))
parser.add_argument("--senha", default=os.environ.get("ORKESTRI_SENHA", ""))
args = parser.parse_args()

if not args.email or not args.senha:
    print("ERRO: forneça --email e --senha ou defina ORKESTRI_EMAIL / ORKESTRI_SENHA")
    sys.exit(1)

BASE = args.base

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
    except Exception:
        print(f"  [ERRO] {method} {path}: {result.stdout[:300]}")
        return {}

# ── Login ─────────────────────────────────────────────────────────────────────
print("Autenticando...")
login = api("POST", "/auth/login", {"email": args.email, "senha": args.senha})
token = login.get("accessToken", "")
if not token:
    print("ERRO: login falhou:", login)
    sys.exit(1)
print(f"  OK — token obtido: {token[:20]}...")

# ── Categoria ─────────────────────────────────────────────────────────────────
print("\nCriando categoria 'Automações & Webhooks'...")
cat = api("POST", "/conhecimento/categorias", {
    "nome":     "Automações & Webhooks",
    "descricao": "Aprenda a automatizar o Orkiestri sem escrever código",
    "icone":    "⚡",
    "cor":      "#7c3aed",
    "ordem":    20,
}, token)
cat_id = cat.get("id", "")
if not cat_id:
    print("  [AVISO] Buscando categoria existente...")
    cats = api("GET", "/conhecimento/categorias", token=token)
    if isinstance(cats, list):
        for c in cats:
            if c.get("nome", "").startswith("Automações"):
                cat_id = c["id"]
                print(f"  Usando existente: {cat_id}")
                break
if not cat_id:
    print("ERRO: não foi possível obter ID da categoria.")
    sys.exit(1)
print(f"  Categoria ID: {cat_id}")

# ── Artigos ───────────────────────────────────────────────────────────────────
ARTIGOS = [

{
"titulo": "O que são Automações? — Guia para iniciantes",
"resumo": "Entenda o conceito de automações no Orkiestri e como elas eliminam tarefas repetitivas do seu time.",
"tags": ["introdução", "conceitos", "iniciante"],
"conteudo": """# O que são Automações?

Automações são **regras que o Orkiestri executa sozinho**, sem precisar que ninguém clique em nada.

Você define **quando** algo deve acontecer, **em quais condições** e **o que fazer**. O sistema cuida do resto — 24 horas por dia.

---

## A lógica de toda automação

Toda automação segue a mesma estrutura de 3 blocos:

```
GATILHO  →  CONDIÇÕES  →  AÇÕES
```

| Bloco | Pergunta | Exemplo |
|---|---|---|
| **Gatilho** | Quando isso deve rodar? | "Quando um chamado for criado" |
| **Condições** | Em quais casos? | "Se a prioridade for Alta" |
| **Ações** | O que fazer? | "Atribuir ao João e enviar WhatsApp" |

---

## Exemplo do dia a dia

Imagine que toda vez que um chamado crítico é aberto, o gerente precisa ser avisado.

**Sem automação:**
1. Chamado é aberto
2. Alguém percebe que é crítico
3. Alguém lembra de avisar o gerente
4. Gerente recebe a informação — com atraso

**Com automação:**
1. Chamado é aberto
2. ✅ Orkiestri detecta, verifica que é crítico e avisa o gerente — instantaneamente

---

## O que você pode automatizar

| Ação | O que faz |
|---|---|
| 📨 Notificações | Avisa pessoas certas na hora certa |
| 📱 WhatsApp | Mensagens automáticas para solicitantes e atendentes |
| 👤 Atribuições | Direciona chamados para o profissional certo |
| 🔄 Status e prioridade | Atualiza campos automaticamente |
| 🏷️ Tags | Classifica chamados sem esforço manual |
| ✅ Tarefas | Cria itens de trabalho em projetos automaticamente |
| 💬 Comentários | Registra informações nos chamados |

---

## Por onde começar?

Acesse **Dashboard → Automações** no menu lateral. Você verá dois recursos:

- **Automações** — as regras inteligentes (este guia)
- **Webhooks** — integrações com sistemas externos (Zapier, n8n, Slack)

> 💡 **Dica:** Comece com algo simples. Por exemplo: quando um chamado for criado com prioridade Alta, criar uma notificação para o responsável. Leva menos de 2 minutos.
"""
},

{
"titulo": "Criando sua primeira automação — passo a passo",
"resumo": "Tutorial completo para criar uma automação do zero em menos de 5 minutos.",
"tags": ["tutorial", "iniciante", "passo a passo"],
"conteudo": """# Criando sua primeira automação

Vamos criar juntos: **toda vez que um chamado de prioridade Alta for aberto, o gerente será notificado automaticamente**.

Tempo estimado: **3–5 minutos**.

---

## Passo 1 — Acessar o módulo

1. No menu lateral, clique em **Automações**
2. Clique no botão **Nova automação** (canto superior direito)

---

## Passo 2 — Dar um nome

No campo **Nome**, escreva algo descritivo:

> `Alerta de chamado de alta prioridade`

✅ Um bom nome deixa claro o que a automação faz sem precisar abrir ela.

---

## Passo 3 — Escolher o Gatilho

O **gatilho** define *quando* a automação será executada.

No seletor **Gatilho**, escolha: **Chamado criado**

Isso significa: "execute toda vez que um novo chamado for aberto".

---

## Passo 4 — Definir uma Condição

1. Clique em **+ Condição** dentro do Grupo 1
2. Campo: **Prioridade**
3. Operador: **é igual a**
4. Valor: **alta**

```
Prioridade  é igual a  alta
```

---

## Passo 5 — Adicionar uma Ação

1. Clique em **+ Ação**
2. Tipo: **🔔 Criar notificação**
3. Para: **Masters**
4. Título: `Chamado de alta prioridade aberto: {{titulo}}`
5. Mensagem: `Chamado #{{numero}} foi aberto com prioridade {{prioridade}}.`

> 💡 Os textos entre `{{ }}` são **variáveis** substituídas automaticamente. `{{titulo}}` vira o título real do chamado.

---

## Passo 6 — Salvar

Clique em **Salvar automação**. Pronto! 🎉

---

## Verificando se funcionou

Abra um chamado de prioridade **Alta** e verifique se a notificação aparece.

Para ver o histórico de execuções, clique em **Histórico** no card da automação.

---

## Gerenciando suas automações

| Quer... | Como fazer |
|---|---|
| Pausar temporariamente | Clique em **Pausar** no card |
| Ver se executou | Clique em **Histórico** |
| Editar | Clique em **Editar** |
| Remover | Clique em **Remover** (apenas masters) |
"""
},

{
"titulo": "Gatilhos: quando as automações disparam",
"resumo": "Lista completa de todos os eventos que podem iniciar uma automação no Orkiestri.",
"tags": ["gatilhos", "triggers", "referência"],
"conteudo": """# Gatilhos disponíveis

O **gatilho** é o evento que inicia a automação — a faísca que acende o processo.

---

## Gatilhos de Chamados

| Gatilho | Quando dispara |
|---|---|
| **Chamado criado** | Assim que um novo chamado é aberto |
| **Chamado atualizado** | Quando qualquer campo é alterado |
| **Chamado resolvido** | Quando o status muda para "Resolvido" |
| **Chamado fechado** | Quando o status muda para "Fechado" |

### Qual usar para cada situação?

- **Chamado criado** → Triagem automática, atribuição inicial, notificação de abertura
- **Chamado atualizado** → Reagir a mudanças de status ou prioridade
- **Chamado resolvido** → Follow-up de satisfação, criar tarefas pós-atendimento
- **Chamado fechado** → Registros finais, comentários de encerramento

---

## Gatilhos de Contratos

| Gatilho | Quando dispara |
|---|---|
| **Contrato vencendo** | Contrato próximo do vencimento |
| **Contrato vencido** | Contrato passou da data sem renovação |

---

## Gatilhos de Ativos

| Gatilho | Quando dispara |
|---|---|
| **Garantia de ativo vencendo** | Garantia de equipamento próxima do fim |

---

## Variáveis disponíveis nas mensagens

Use `{{nome_da_variavel}}` nos títulos, mensagens e textos das ações:

| Variável | O que mostra |
|---|---|
| `{{titulo}}` | Título do chamado |
| `{{numero}}` | Número do chamado (ex: 42) |
| `{{prioridade}}` | Prioridade (baixa/media/alta/critica) |
| `{{status}}` | Status atual |
| `{{categoria}}` | Categoria do chamado |
| `{{cliente}}` | Nome do cliente |
| `{{atendente}}` | Nome do atendente responsável |
| `{{solicitante}}` | Nome de quem abriu o chamado |
| `{{data}}` | Data atual (dd/mm/aaaa) |
| `{{hora}}` | Hora atual (hh:mm) |

**Exemplo:**

```
Chamado #{{numero}} — {{titulo}}
Aberto por {{solicitante}} com prioridade {{prioridade}}.
Data: {{data}} às {{hora}}
```

Resulta em:

```
Chamado #47 — Impressora não funciona
Aberto por Maria Silva com prioridade alta.
Data: 05/06/2026 às 14:32
```
"""
},

{
"titulo": "Condições: filtrando quando a automação executa",
"resumo": "Como usar condições simples e grupos OR/AND para criar regras precisas sem complicar.",
"tags": ["condições", "filtros", "OR", "AND", "grupos"],
"conteudo": """# Condições: filtrando a execução

As condições evitam que a automação rode para *todos* os eventos — só para os que importam.

---

## Sem condições

Sem condições, a automação executa **sempre** que o gatilho disparar.

✅ Use quando a ação deve acontecer para todo e qualquer evento do gatilho.

---

## Condição simples

Verifica se um campo corresponde a um valor.

```
Prioridade  é igual a  alta
```

Só executa se a prioridade for exatamente "alta".

---

## Operadores disponíveis

| Operador | Significado |
|---|---|
| **é igual a** | Valor exato |
| **é diferente de** | Qualquer valor exceto |
| **está em (lista)** | Um dos valores |
| **não está em** | Nenhum dos valores |
| **está vazio** | Campo sem valor |
| **não está vazio** | Campo tem algum valor |
| **contém** | Texto inclui a palavra |
| **começa com** | Texto começa com |
| **termina com** | Texto termina com |
| **maior que** | Comparação numérica |
| **menor que** | Comparação numérica |

---

## Múltiplas condições (lógica E)

Quando há mais de uma condição no **mesmo grupo**, **todas** precisam ser verdadeiras.

```
Prioridade  é igual a  alta
E
Status  é igual a  aberto
```

Só dispara se for **prioridade alta** E **status aberto** ao mesmo tempo.

---

## Grupos de condições (lógica OU)

Para cenários mais complexos, crie **múltiplos grupos**. Basta **um grupo** ser verdadeiro.

**Exemplo: "VIP ou Crítico"**

```
┌─ Grupo 1 ──────────────────────┐
│ Prioridade  é igual a  critica │
└─────────────────────────────────┘
              OU
┌─ Grupo 2 ──────────────────────┐
│ Tags  contém  vip              │
└─────────────────────────────────┘
```

Dispara se o chamado for crítico **OU** tiver a tag "vip".

---

## Como criar grupos na interface

1. No editor, clique em **+ Grupo**
2. Um novo bloco aparece com o rótulo **OU**
3. Adicione condições dentro de cada grupo normalmente

---

## Exemplos práticos

**"Chamados sem atendente"**
```
Status = aberto
E
AtendenteId está vazio
```

**"Alta prioridade e não resolvido"**
```
Prioridade está em: alta, critica
E
Status é diferente de: resolvido
```

**"VIP ou cliente prioritário"**
```
Grupo 1: Tags contém vip
OU
Grupo 2: Categoria começa com [PRIORITÁRIO]
```
"""
},

{
"titulo": "Ações disponíveis: o que o Orkiestri pode fazer automaticamente",
"resumo": "Guia completo de todas as ações que o Orkiestri executa nas suas automações.",
"tags": ["ações", "referência", "WhatsApp", "tarefas", "notificações"],
"conteudo": """# Ações disponíveis

As ações são **o que o Orkiestri faz** quando a automação dispara. Você pode encadear várias — elas executam em sequência.

---

## 👤 Atribuir atendente

Atribui o chamado a um usuário e muda o status para "Em atendimento".

**Quando usar:** Direcionar chamados de uma categoria para o especialista certo.

---

## 🔄 Mudar status

Altera o status do chamado.

**Valores:** aberto, em_atendimento, aguardando, resolvido, fechado

---

## ⚡ Mudar prioridade

Altera a prioridade do chamado.

**Valores:** baixa, media, alta, critica

---

## 🚨 Escalar chamado

Aumenta a prioridade **e notifica os masters** automaticamente.

**Quando usar:** Chamados críticos que precisam de atenção imediata.

---

## 🏷️ Adicionar / Remover tag

Adiciona ou remove uma tag sem sobrescrever as existentes.

**Exemplos:**
- Adicionar `sla-risco` quando prioridade sobe
- Remover `pendente` quando o chamado é atendido

---

## 💬 Adicionar comentário

Registra um comentário no chamado — **interno** (só equipe) ou público.

Suporta variáveis: `{{atendente}}`, `{{data}}`, `{{hora}}`, etc.

**Exemplo de texto:**
```
Chamado escalado automaticamente em {{data}} às {{hora}}.
Responsável: {{atendente}}.
```

---

## 🔔 Criar notificação

Envia uma notificação dentro do Orkiestri.

**Para quem:**
- **Solicitante** — quem abriu o chamado
- **Atendente** — quem está responsável
- **Masters** — todos os administradores
- **Usuário específico** — escolha uma pessoa

---

## 📱 Enviar WhatsApp

Envia uma mensagem WhatsApp para um usuário do sistema.

> ⚠️ O usuário precisa ter WhatsApp cadastrado no perfil e notificações ativadas.

Suporta **negrito** com `*texto*` e _itálico_ com `_texto_`, além de todas as variáveis.

**Exemplo:**
```
*Orkiestri — Chamado #{{numero}}*

Seu chamado foi atribuído a {{atendente}}.
Assunto: {{titulo}}
Prioridade: {{prioridade}}
```

---

## ✅ Criar tarefa no projeto

Cria uma nova tarefa em um projeto existente do Orkiestri.

**Configuração:**
- **Projeto** — em qual projeto criar
- **Título** — suporta variáveis
- **Descrição** — detalhes opcionais
- **Prioridade** — padrão: mesma do chamado
- **Atribuir a** — padrão: atendente do chamado

**Quando usar:**
- Criar tarefa de follow-up após resolução
- Criar tarefa de renovação ao detectar garantia vencendo
- Criar tarefa de revisão de conta ao fechar chamado VIP

**Exemplo de título:**
```
Follow-up: {{titulo}} — Cliente: {{cliente}}
```

---

## Encadeando ações

Combine múltiplas ações na mesma automação:

**Exemplo — Atendimento VIP completo:**
1. ⚡ Mudar prioridade → alta
2. 👤 Atribuir ao Gerente de Contas
3. 📱 WhatsApp para Gerente: `"Novo chamado VIP: {{titulo}}"`
4. 🔔 Notificação para Masters
5. 🏷️ Adicionar tag: `vip-ativo`
"""
},

{
"titulo": "15 exemplos prontos de automações para o seu time",
"resumo": "Receitas prontas que você pode copiar e adaptar para triagem, comunicação, contratos, qualidade e muito mais.",
"tags": ["exemplos", "receitas", "casos de uso", "boas práticas"],
"conteudo": """# 15 exemplos prontos de automações

Copie, adapte e use. Cada exemplo indica o gatilho, as condições e as ações necessárias.

---

## Triagem e Atribuição

### 1. Chamados de TI para o time certo
- **Gatilho:** Chamado criado
- **Condição:** Categoria = Infraestrutura
- **Ações:** Atribuir → Time TI + Adicionar tag `ti`

### 2. Alerta imediato para chamado crítico
- **Gatilho:** Chamado criado
- **Condição:** Prioridade = critica
- **Ações:** Notificação para Masters + WhatsApp para Masters: `*URGENTE* — Chamado #{{numero}}: {{titulo}}`

### 3. Alerta de chamado sem atendente
- **Gatilho:** Chamado atualizado
- **Condições:** Status = aberto E AtendenteId está vazio
- **Ações:** Notificação para Masters: `Chamado #{{numero}} sem atendente: {{titulo}}`

### 4. Atendimento VIP
- **Gatilho:** Chamado criado
- **Condição:** Tags contém `vip`
- **Ações:** Mudar prioridade → alta + Atribuir → Gerente + WhatsApp para Gerente

---

## Comunicação Automática

### 5. Confirmação de abertura para o solicitante
- **Gatilho:** Chamado criado *(sem condições)*
- **Ações:** WhatsApp para Solicitante:
```
*Chamado registrado* ✅
Seu chamado *#{{numero}}* foi recebido.
Assunto: {{titulo}} | Prioridade: {{prioridade}}
```

### 6. Aviso quando entra em atendimento
- **Gatilho:** Chamado atualizado
- **Condição:** Status = em_atendimento
- **Ações:** WhatsApp para Solicitante: `{{atendente}} está cuidando do seu chamado #{{numero}}.`

### 7. Chamado aguardando resposta
- **Gatilho:** Chamado atualizado
- **Condição:** Status = aguardando
- **Ações:** WhatsApp para Solicitante: `Seu chamado #{{numero}} aguarda sua resposta. Acesse o sistema.`

---

## Pós-Resolução e Qualidade

### 8. Follow-up de satisfação
- **Gatilho:** Chamado resolvido *(sem condições)*
- **Ações:** Criar tarefa no projeto `Qualidade`: `"Pesquisa de satisfação: {{titulo}} — {{cliente}}"` + WhatsApp para Solicitante

### 9. Comentário automático ao fechar
- **Gatilho:** Chamado fechado *(sem condições)*
- **Ações:** Adicionar comentário interno: `Chamado encerrado em {{data}} às {{hora}}. Atendente: {{atendente}}`

### 10. Escalação automática
- **Gatilho:** Chamado atualizado
- **Condições (Grupo 1 OU Grupo 2):** Prioridade = critica | OU | Tags contém `escalar`
- **Ações:** Escalar chamado + Notificação para Masters

---

## Contratos e Ativos

### 11. Alerta de contrato vencendo
- **Gatilho:** Contrato vencendo *(sem condições)*
- **Ações:** Notificação para Masters + WhatsApp para Masters: `Contrato com {{cliente}} vence em breve!`

### 12. Garantia de equipamento expirando
- **Gatilho:** Garantia de ativo vencendo *(sem condições)*
- **Ações:** Criar tarefa no projeto `Infraestrutura`: `"Verificar/renovar garantia do ativo"` + Notificação para Masters

---

## Organização e Processos

### 13. Classificar chamados por palavra-chave
- **Gatilho:** Chamado criado
- **Condições:** Título contém `senha` | OU | Título contém `acesso`
- **Ações:** Adicionar tag `autenticacao` + Mudar prioridade → media

### 14. Onboarding automático de novo cliente
- **Gatilho:** Chamado criado
- **Condição:** Tags contém `novo-cliente`
- **Ações:** Criar tarefa `"Configurar ambiente para {{cliente}}"` + Criar tarefa `"Apresentar sistema ao cliente"` + Adicionar tag `onboarding`

### 15. Notificação de chamado de alta prioridade em atendimento
- **Gatilho:** Chamado atualizado
- **Condições:** Prioridade está em alta, critica E Status = em_atendimento
- **Ações:** Notificação para Atendente: `Atenção: chamado #{{numero}} de alta prioridade em andamento`

---

## Construindo as suas

1. **Identifique** uma tarefa repetitiva do time
2. **Pergunte:** Quando? (gatilho) → Em quais casos? (condições) → O que fazer? (ações)
3. **Crie** a automação — leva menos de 5 minutos

> 💡 **Regra de ouro:** Se você faz a mesma coisa mais de 3 vezes por semana, é um bom candidato para automação.
"""
},

{
"titulo": "Webhooks: conectando o Orkiestri a sistemas externos",
"resumo": "Como usar webhooks para integrar com Zapier, n8n, Slack e outros sistemas via HTTP.",
"tags": ["webhooks", "integração", "API", "Zapier", "n8n"],
"conteudo": """# Webhooks: conectando ao mundo externo

Enquanto as **automações** trabalham dentro do Orkiestri, os **webhooks** enviam dados para **sistemas externos** quando eventos acontecem.

---

## O que é um webhook?

Quando um evento ocorre no Orkiestri, o sistema envia automaticamente um HTTP POST com os dados para uma URL que você configurar.

```
Evento no Orkiestri  →  POST com dados JSON  →  Seu sistema externo
```

---

## Quando usar webhooks vs automações

| Situação | Use |
|---|---|
| Receber dados em Slack, ERP, CRM | Webhook |
| Disparar ações no n8n, Zapier, Make | Webhook |
| Enviar dados para seu próprio backend | Webhook |
| Notificar, atribuir, criar tarefas dentro do Orkiestri | Automação |

---

## Eventos disponíveis

| Evento | Quando dispara |
|---|---|
| `chamado.criado` | Novo chamado aberto |
| `chamado.atualizado` | Chamado editado |
| `chamado.resolvido` | Status → resolvido |
| `chamado.fechado` | Status → fechado |
| `contrato.vencendo` | Contrato próximo do vencimento |
| `contrato.vencido` | Contrato vencido |
| `ativo.garantia_vencendo` | Garantia de ativo vencendo |
| `projeto.concluido` | Projeto marcado como concluído |
| `usuario.criado` | Novo usuário cadastrado |

---

## Criando um webhook

1. Acesse **Automações → aba Webhooks**
2. Clique em **+ Novo webhook**
3. Preencha:
   - **Nome:** identificação interna
   - **Evento:** qual evento dispara
   - **URL:** para onde enviar
   - **Secret:** chave HMAC para validar autenticidade (recomendado)

---

## Formato dos dados enviados

O Orkiestri envia um JSON via POST:

```json
{
  "evento": "chamado.criado",
  "timestamp": "2026-06-05T14:32:00.000Z",
  "id": "abc123",
  "numero": 47,
  "titulo": "Impressora não funciona",
  "prioridade": "alta",
  "status": "aberto"
}
```

---

## Integrando com ferramentas populares

### Zapier
1. Crie um Zap com trigger **"Webhooks by Zapier → Catch Hook"**
2. Copie a URL gerada
3. Cole no Orkiestri como URL do webhook
4. Faça um teste — o Zapier captura o payload de exemplo

### n8n
1. Adicione um nó **Webhook** no seu workflow
2. Copie a URL do nó
3. Cole no Orkiestri
4. Configure as ações seguintes no n8n

### Slack (Incoming Webhooks)
1. Crie um Incoming Webhook no Slack (via App Settings)
2. Cole a URL diretamente no Orkiestri

---

## Monitorando as entregas

Em **Automações → Webhooks**, clique em **Logs** para ver:
- Histórico de envios com timestamp
- Status HTTP de cada entrega (200 = OK)
- Mensagem de erro em caso de falha

---

## Testando

Clique em **Testar** no card do webhook. O Orkiestri envia um payload de teste imediatamente e você vê o resultado nos Logs.

---

## Dica: combine automações + webhooks

Use **automações** para lógica interna (atribuir, notificar, criar tarefas) e **webhooks** para comunicar com sistemas externos. Os dois trabalham em paralelo e se complementam.
"""
},

]

# ── Criar artigos ─────────────────────────────────────────────────────────────
print(f"\nCriando {len(ARTIGOS)} artigos...")
created = 0
for art in ARTIGOS:
    print(f"  → {art['titulo'][:65]}...")
    result = api("POST", "/conhecimento", {
        "titulo":      art["titulo"],
        "resumo":      art["resumo"],
        "conteudo":    art["conteudo"],
        "categoriaId": cat_id,
        "tags":        art.get("tags", []),
        "status":      "rascunho",
    }, token)
    art_id = result.get("id", "")
    if not art_id:
        print(f"    [AVISO] Erro ou já existe: {str(result)[:100]}")
        continue
    pub = api("PATCH", f"/conhecimento/{art_id}/publicar", {"publicar": True}, token)
    status = pub.get("status", "")
    print(f"    {'✅ Publicado' if status == 'publicado' else '⚠️  Criado, não publicado'} (ID: {art_id[:8]}...)")
    created += 1

print(f"\n{'='*60}")
print(f"✅ Concluído: {created}/{len(ARTIGOS)} artigos")
print(f"   Categoria: Automações & Webhooks")
print(f"   Acesse: Dashboard → Base de Conhecimento")
print(f"{'='*60}")
