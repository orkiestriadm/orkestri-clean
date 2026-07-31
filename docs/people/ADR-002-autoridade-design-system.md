# ADR-002 — Autoridade de design system do produto

- **Status:** Aprovado
- **Data:** 2026-07-28
- **Decisores:** Guilherme
- **Relacionado:** [ADR-001](ADR-001-modelo-employee.md)

---

## Contexto

Onze documentos de `Orkiestri Core` (19 referências no total) apontam `/orkiestri-design-system`
como autoridade visual obrigatória:

```
DESIGN_SYSTEM.md · FRONTEND.md · MODULE_BLUEPRINT.md · FORM_BLUEPRINT.md
PEOPLE_FRONTEND.md · PEOPLE_CLOUD_EXECUTION_PROMPT.md · PEOPLE_IMPLEMENTATION_PLAN.md
PEOPLE_MIGRATION_ANALYSIS.md · PEOPLE_AI_SPECIFICATION.md
PEOPLE_ANALYTICS_SPECIFICATION.md · PEOPLE_TEST_STRATEGY.md
```

`PEOPLE_FRONTEND.md` §20 é explícito: *"Use components from /orkiestri-design-system"*.

Inspecionando a pasta: **21 arquivos markdown, nenhum código.** Não há componentes, tokens
exportáveis, nem pacote instalável. E o conteúdo é o brand book do **site institucional**
(Project Phoenix), não do produto — `00-README.md` abre com *"Project Phoenix is the complete
reconstruction of the Orkiestri institutional website."*

As duas identidades são incompatíveis:

| | `/orkiestri-design-system` (site) | Produto (`frontend/src/styles/globals.css`) |
|---|---|---|
| Cor primária | Laranja `#F97316` | Vermelho `#dc2626` (var. `--accent-violet`) |
| Fundo | *"Sempre branco. Nunca utilizar fundo escuro."* | Light **e** dark, ambos em produção |
| Tipografia | Inter | Syne (display) + Inter (corpo) + JetBrains Mono (dados) |
| Radius de card | 20px | 12px (`--radius: 0.75rem`) |
| Altura de input | 52px | Densidade de aplicação, não de landing page |
| Stack | Tailwind v4 + shadcn/ui | Tailwind 3 + CSS vars + estilos inline |
| Hero | 100vh, título 72px | Não se aplica |

## Decisão

**`/orkiestri-design-system` não é autoridade visual do produto.** É o brand book do site,
e permanece autoritativo apenas para o Project Phoenix.

A autoridade visual do produto é `frontend/src/styles/globals.css` (tokens) mais as primitivas
em `frontend/src/components/data-ui.tsx`. O People Hub segue essas, sem exceção.

Onde a especificação disser "/orkiestri-design-system" em contexto de tela de produto,
leia-se "design system do produto".

## Alternativas descartadas

**Seguir a especificação ao pé da letra.** Produziria um módulo laranja de fundo branco dentro
de um produto vermelho com dark mode. Violaria o princípio central do próprio `DESIGN_SYSTEM.md`
§19 — *"o usuário deve sempre sentir: isto é Orkiestri"* — em nome de obedecer à letra de um
documento que contradiz o próprio espírito.

**Migrar o produto inteiro para a paleta do site.** Consistência máxima entre site e produto,
mas são 65 páginas e várias semanas. É um projeto próprio, não um pré-requisito do People Hub.
Fica registrado como opção futura, não descartada em definitivo.

## Estado real das primitivas

Correção a uma avaliação inicial: o produto **tem** uma base de componentes maior do que
parecia à primeira vista. `data-ui.tsx` (308 linhas) já entrega:

```
PageBody · PageHeader · BackLink · Tabs
KpiCard · KpiGrid · StatCard · StatGrid
Toolbar · SearchInput · SelectFilter
TableCard · RowActions · RowAction
EmptyState · LoadingRows · useCountUp
```

Isso cobre bem o padrão de **página de listagem** — que é exatamente o que
`LIST_PAGE_BLUEPRINT.md` pede. O trabalho de extração da Fase 3 é menor do que o previsto
no plano original.

O que ainda falta, e o People Hub vai precisar construir:

| Primitiva | Necessária para | Fase |
|---|---|---|
| `Form` / `Field` / `FormSection` | `FORM_BLUEPRINT.md`, cadastro de colaborador | 3 |
| `Modal` / `Drawer` | Ações de linha, upload de documento | 3 |
| `ErrorState` | Estado obrigatório em `FRONTEND.md` §20 | 3 |
| `PermissionDenied` | Estado obrigatório em `PEOPLE_FRONTEND.md` §23 | 3 |
| `DetailLayout` / `Timeline` | `DETAIL_PAGE_BLUEPRINT.md`, perfil 360 | 3 |
| `FileUpload` / `FilePreview` | Documentos do colaborador | 4 |
| `WorkflowStatus` | Visualização de workflow | 5 |

Todas nascem em `frontend/src/components/data-ui.tsx` (ou irmãos), sobre os tokens do produto,
disponíveis para os demais módulos — não dentro da pasta do People Hub.

## Consequências

**Boas.** O People Hub nasce visualmente consistente com o resto do produto. As primitivas
novas beneficiam os outros 40 módulos. Nenhum trabalho jogado fora.

**Ruins — assumidas.** A especificação escrita continuará divergindo do que o código faz até
que os 11 documentos sejam corrigidos (tarefa da Fase 0, ver `MIGRATION_MATRIX`). Enquanto
isso, qualquer pessoa — ou IA — que leia `PEOPLE_FRONTEND.md` isoladamente vai concluir a
coisa errada. Este ADR é a contramedida, e precisa estar referenciado nos documentos corrigidos.

Existirão duas identidades Orkiestri em paralelo: laranja no site, vermelha no produto. É uma
decisão de marca que precisa ser tomada conscientemente em algum momento — não por omissão.

## Revisitar quando

- O Project Phoenix entrar no ar e a divergência site/produto ficar visível ao cliente.
- Houver decisão de marca unificando as paletas.
