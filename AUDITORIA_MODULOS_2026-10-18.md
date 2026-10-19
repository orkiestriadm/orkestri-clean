# Redução de escopo do Orkiestri — 18/10/2026

**Base:** `ad1d099` (1.35.0 — linha de produção / AWS) → **2.0.0**
**Branch:** `claude/orkiestri-modules-audit-cleanup-e877ca`
**Backup:** `C:\orkiestri_backup18102026` — verificado
**Estado:** executado e verificado. **Nada comitado, nada enviado ao GitHub, nada publicado.**

---

## 1. Backup (feito e conferido antes de qualquer exclusão)

| Item | Conteúdo | Verificação |
|---|---|---|
| `orkestri-clean\` | Árvore completa: 27.305 arquivos, 1,90 GB, **0 falhas** | Contagem de fontes confere com a origem (backend/src 299, frontend/src 265, website 112, docs 28, scripts 14) |
| `orkestri-clean\.git` | 124 MB | Presente |
| `orkestri-clean\.claude\worktrees` | 26 worktrees, com o trabalho não comitado das outras sessões | Presente |
| `.env`, `.env.production`, `.env.example` | Segredos e configuração | Presentes |
| `orkestri-all-refs.bundle` | 118 MB, **113 refs** — todas as branches e tags | `git bundle verify`: *"records a complete history"* |

Fora da cópia apenas `node_modules`, `.next`, `dist`, `.turbo`, `.cache`, `coverage` — 100% regeneráveis.

**Restaurar tudo:** `git clone C:\orkiestri_backup18102026\orkestri-all-refs.bundle`

---

## 2. Resultado

**375 arquivos removidos, 118.811 linhas apagadas.** Backend: 50 → **23 módulos**. Dashboard: 40 → **17 rotas**.

### Decisões que você tomou
1. **Orçamento fica**, agora dentro do Finance (era um grupo separado no menu).
2. **Banco intocado** — as tabelas dos módulos removidos seguem lá, paradas. Nenhuma migration destrutiva.
3. **Os quatro painéis agregadores saem** (Executivo, IA Operacional, Relatórios, Workforce).
4. **Integração Outlook / Microsoft 365 fica** — o Space depende dela.

---

## 3. O que FICOU

| Produto | Backend | Frontend |
|---|---|---|
| **Space** | `agenda`, `keep` | `agenda`, `keep` |
| **Projects** | `projects` | `projetos`, `projetos/concluidos`, `gantt` |
| **Finance** (com Budget dentro) | `financeiro`, `gastos`, `orcamento` | `financeiro`, `financeiro/gastos`, `financeiro/contas-a-pagar`, `orcamento` |
| **WhatsApp** (intocado) | `agenda/whatsapp-inbound`, `users/whatsapp`, `referral` | `whatsapp-config` |
| **Resend** (e-mail) | `notifications/email.service` | — |
| **Outlook / M365** | `integracoes` | `configuracoes/integracoes` |
| **Core** | `auth`, `users`, `rbac`, `cache`, `health`, `notifications`, `audit`, `organizations`, `sistema`, `setores`, `alertas`, `billing`, `cadastro-request`, `stats`, `automacoes` | `cadastros`, `alertas`, `automacoes`, `historico`, `configuracoes`, `billing`, `perfil`, `sobre` |
| **Plataforma** | `organizations` | `plataforma`, `superadmin` |

---

## 4. O que SAIU (27 módulos de backend, 26 rotas de frontend)

| Produto | Backend removido | Frontend removido |
|---|---|---|
| **People** — Pessoas/RH | `people`, `collaborators`, `ausencias`, `skills`, `squads`, `workforce` | `people`, `meu-rh`, `workforce` |
| **Fleet** — Frotas | `frota` | `frota`, `reservas` |
| **Compliance** — Obrigações | `compliance` | `compliance` |
| **Strategy** — Gestão Estratégica | `estrategico` | `estrategico` |
| **Service** — Chamados | `chamados`, `sla`, `csat`, `apontamentos`, `chamado-templates` | `chamados`, `catalogo`, `csat`, `apontamentos` |
| **Assets** — Ativos | `ativos`, `monitoramento`, `osa` | `ativos`, `cmdb`, `monitoramento` |
| **Relations** — Clientes | `clientes`, `contratos`, `faturas` | `clientes`, `contratos`, `faturas` |
| **Supply** — Suprimentos | `suppliers` | `cadastros/fornecedores` |
| **Quality** — Procedimentos | `conhecimento`, `capacity` | `conhecimento`, `processos`, `capacity`, `kb` (base pública) |
| **Approvals** — Aprovações | `workflows`, `workflow-templates` | `aprovacoes` |
| **Portal do cliente** | `portal` | `portal` |
| **Painéis agregadores** | `stats/relatorios.module.ts`, `GET /stats/executivo` | `relatorios`, `executivo`, `ia` |

Também removidos: `frontend/src/lib/{people,compliance,estrategico}`, `lib/monitoringSocket.ts`, `frontend/src/hooks/` (5 hooks do People, sem consumidor), `backend/src/common/permission-aliases.ts` (+ spec), `docs/{frota,people,estrategico}`, `docs/architecture/COMPLIANCE_*`, `docs/architecture/gestaodeobrigacoes.md`, 21 arquivos `PEOPLE_*` em `Orkiestri Core/`, 3 seeds de conhecimento em `scripts/`.

---

## 5. Três decisões de engenharia que tomei no caminho

### `automacoes` ficou, como infraestrutura do Core
Não é a tela do Service onde morava: é o motor que o **Projects** chama em `projeto_criado`, `tarefa_criada`, `tarefa_atribuida` e `tarefa_concluida`, e o **Users** em `usuario_criado`. Excluí-lo tiraria comportamento do Projects, que você mandou manter. Mantive o motor e **podei de dentro dele** o que era de Service: os gatilhos `chamado_*`, `contrato_*`, `workflow_*` e `ativo_*`, as ações que escreviam em chamado (atribuir atendente, mudar status/prioridade, escalar, tags, comentário, criar chamado) e o cron diário que varria contratos e garantias. O item de menu foi de Service para **Administração**.

### `cadastro-request` ficou
Ia na lista de exclusão até eu ver que o **superadmin** (Organizações) é quem usa `/cadastro-requests` para onboarding de organização — não era tela de People.

### O papel `cliente_portal` saiu do `ROLE_DEFAULTS`
Existia só para o portal do cliente. A sincronia de papéis é **somente aditiva** (cria papel e adiciona permissão, nunca remove), então quem já tem esse papel continua com ele no banco — apenas não é mais semeado. Os outros oito papéis mantiveram o nome: `administrador`, `gestor`, `analista`, `tecnico`, `visualizador`, `supervisor`, `operador`, `auditor`.

---

## 6. Dois bugs anteriores que apareceram e corrigi

1. **`automacoes` → ação "criar tarefa" nunca funcionou.** Gravava `priority`, mas o campo em `Task` sempre se chamou `prioridade`. O Prisma recusava o create e a ação falhava inteira — em silêncio, porque `executar()` engole a exceção no log da execução. Estava escondido pelo cast `as any` do `this.db`.
2. **A busca global nunca achou projeto.** `/stats/search` filtrava `Project` por `nome`; o campo é `titulo`. Mesmo cast `any`, mesmo silêncio. Agora o `select` é tipado e o compilador pegaria de novo.

---

## 7. O que foi reescrito (não só apagado)

- **Visão Geral** (`app/dashboard/page.tsx`): os 4 widgets de Chamados/Projetos/Aprovações/Ativos viraram 3 — **Projetos, Space e Finance**. Os alertas liam SLA violado, chamado urgente, aprovação pendente, garantia de ativo e contrato vencendo; hoje leem tarefa com prazo estourado, conta a pagar vencida ou a vencer, item de orçamento acima do previsto e compromisso do dia. O gráfico "Volume de Chamados" virou **tarefas concluídas nos últimos 14 dias**. A Atividade Recente virou as tarefas recentes dos seus projetos.
- **`GET /stats/dashboard`**: reescrito sobre Projects/Space/Finance (inclui `tasks.atrasadas`, `financeiro.contasVencidas/contasVencendo30`, `orcamento.itensEstourados`, `tarefasPorDia`, `tarefasRecentes`). `GET /stats/executivo` foi removido.
- **`GET /stats/search`** e a **busca global (Ctrl+K)**: procuravam chamados, clientes, contratos, faturas e artigos; agora procuram **projetos, tarefas e pessoas**.
- **`auth.service.ts`**: `ALL_PERMISSIONS` perdeu `crm`, `chamados`, `clientes`, `fornecedores`, `ativos`, `colaboradores`, `conhecimento`, `portal`, `sla`, `monitoramento`, `meurh`, `frota`, `reservas`, `relatorios` e os catálogos `people.*`, `compliance.*` e `estrategico.*`. Os oito papéis padrão foram podados junto.
- **`permissions.guard.ts`**: a tradução de permissão legada (`colaboradores:*` → `people.*`) existia só para o People; voltou a ser comparação direta de `recurso:acao`.
- **`notifications/alert.scheduler.ts`**: 741 → 224 linhas. Saíram SLA, faturas, frota (CNH, documentos, revisões, pneus, manutenções) e o envio agendado de relatórios da frota. Ficou o lembrete de agenda e o alerta de estouro de orçamento.
- **`notificacao-modulos.ts`**: 13 → 5 módulos notificáveis (`projects`, `budget`, `finance`, `space`, `core`). **Os slugs legados dos módulos removidos ficaram no mapa de tradução de propósito**: contas antigas têm `["frota"]` gravado em `UserProfile.modulos`, e traduzir continua devolvendo um id reconhecível em vez do slug cru — ele apenas não casa com módulo vivo, que é o resultado correto.
- **`cadastros`**: 3.003 → 1.945 linhas. Saíram as abas Colaboradores, Skills, Ausências e Squads e seus modais. Ficaram Usuários, Setores, Organograma, Papéis, Matriz, Solicitações, Testes e Organizações. O campo "Gestor direto" na aprovação de acesso saiu (listava colaboradores) e a matrícula, que era sugerida por `/collaborators/next-matricula`, agora é digitada.
- **`configuracoes`**: a aba SLA saiu.
- **`Topbar`**: o mapa de títulos perdeu 24 rotas e ganhou as do Finance.
- **`middleware.ts`**: `/reservas` saiu da proteção e do matcher.
- **`ModulesSection`** da landing: 8 módulos ofertados → 4 (Projetos, Agenda, Financeiro, Orçamentos).

---

## 8. Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` backend | **exit 0** |
| `tsc --noEmit` frontend | **exit 0** |
| `next build` | **exit 0** — 17 rotas do dashboard, só as que ficaram |
| `jest` backend | **272 passando**, 3 falhando |

As 3 falhas são **anteriores a esta mudança e não têm relação com ela**: `marca-nao-fica-fixa` e `corpo-declarado` acusam `modules/agenda/whatsapp-inbound.module.ts` e `modules/referral/referral.module.ts` — dois arquivos que **não foram tocados** (confirmado por `git status`). A correção deles está nos commits `8028a83` e `2f16189` (1.49.1 / 1.49.2), que vivem na **linha do Hub** e nunca entraram na linha de produção. O número é idêntico ao da linha de base antes de eu começar.

---

## 9. ⚠️ O Hub compartilha este repositório

O Hub Transbrasiliana (homologação) roda do **mesmo repositório**, em branch `hub/*`, e **usa** Fleet, Compliance, People, Strategy e Processos. Esta limpeza está numa branch baseada na **linha de produção** (`ad1d099` = 1.35.0), então o Hub não foi afetado.

**Regra que passa a valer:** esta branch **nunca** pode ser mesclada em `hub/*`, e um merge da linha de produção para o Hub depois disto apagaria os módulos do Hub.

---

## 10. O que ficou de fora, e por quê

1. **A landing (marketing) ainda anuncia módulos que não existem.** `HeroSection`, `DemoSection`, `DifferentialsSection`, `FaqSection`, `PricingSection` e `UnderstandSection` têm telas simuladas e texto de venda com Chamados, SLA, CSAT, Ativos, CRM e Service Desk. Só o `ModulesSection` (catálogo de módulos, dado puro) foi podado. O resto é reescrita de marketing e de mockup visual — decisão sua, não de limpeza de código, e você já me disse que direção de design não se decide por build. Em produção o `/` é servido pelo container do site (`website/`), não por esta landing, então nada está no ar errado agora.
2. **O banco.** As ~143 tabelas dos módulos removidos seguem lá, sem uso e sem código apontando para elas. Limpá-las é etapa própria: exige migration destrutiva, janela de deploy e divergiria mais o schema de homologação.
3. **Nada foi comitado, enviado nem publicado.** As 375 exclusões estão no índice (`git rm`) e as 19 edições no diretório de trabalho.
4. **Nada rodou de verdade.** Os gates foram compilação e teste. Login chegando ao dashboard novo, Visão Geral com dado real e o lembrete de agenda saindo no WhatsApp só se provam rodando — e o `auth.service` mexeu no catálogo de permissões, que é exatamente o que encurta o JWT e já derrubou o nginx por buffer antes.
