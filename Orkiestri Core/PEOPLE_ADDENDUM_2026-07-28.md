# ============================================================================
# ORKIESTRI MODULE
# DOCUMENT: PEOPLE_ADDENDUM_2026-07-28.md
# ============================================================================

Version: 1.0.0
Status: Official — Authoritative Errata
Category: Specification Correction
Owner: Orkiestri Product Engineering
Date: 2026-07-28

===============================================================================

# 1. PURPOSE

Este documento corrige pontos das especificações `PEOPLE_*.md` que divergem da
arquitetura real da plataforma, identificados na análise de arquitetura de
2026-07-28 exigida por `PEOPLE_CLOUD_EXECUTION_PROMPT.md` §6.

**Em caso de conflito, este documento prevalece sobre os originais** nos pontos
listados aqui. Nos demais pontos, os originais permanecem válidos e integrais.

As decisões de engenharia correspondentes estão registradas em ADRs no
repositório do produto, em `docs/people/`.

---

# 2. CORREÇÃO 1 — Autoridade de design system

## O que as especificações dizem

Onze documentos apontam `/orkiestri-design-system` como autoridade visual
obrigatória, com 19 referências no total:

```
DESIGN_SYSTEM.md · FRONTEND.md · MODULE_BLUEPRINT.md · FORM_BLUEPRINT.md
PEOPLE_FRONTEND.md · PEOPLE_CLOUD_EXECUTION_PROMPT.md
PEOPLE_IMPLEMENTATION_PLAN.md · PEOPLE_MIGRATION_ANALYSIS.md
PEOPLE_AI_SPECIFICATION.md · PEOPLE_ANALYTICS_SPECIFICATION.md
PEOPLE_TEST_STRATEGY.md
```

## Por que está incorreto

`/orkiestri-design-system` contém 21 arquivos markdown e **nenhum código**. Não
há componentes nem tokens exportáveis. E o conteúdo é o brand book do **site
institucional** (Project Phoenix), com identidade incompatível com a do produto:

| | design-system (site) | Produto |
|---|---|---|
| Cor primária | Laranja `#F97316` | Vermelho `#dc2626` |
| Fundo | "Sempre branco. Nunca escuro." | Light e dark, em produção |
| Tipografia | Inter | Syne + Inter + JetBrains Mono |
| Radius de card | 20px | 12px |

Seguir a especificação ao pé da letra produziria um módulo laranja de fundo branco
dentro de um produto vermelho com dark mode — violando o princípio central de
`DESIGN_SYSTEM.md` §19.

## Correção

A autoridade visual do **produto** é `frontend/src/styles/globals.css` (tokens) e
`frontend/src/components/data-ui.tsx` (primitivas).

`/orkiestri-design-system` permanece autoritativo **apenas** para o Project Phoenix
(site institucional).

Onde as especificações disserem `/orkiestri-design-system` em contexto de tela de
produto, leia-se **design system do produto**.

Referência: `docs/people/ADR-002-autoridade-design-system.md`

---

# 3. CORREÇÃO 2 — Entidade Employee

## O que a especificação diz

`PEOPLE_DATABASE.md` §5 especifica uma tabela `employees` nova.

## Por que está incorreto

Já existe `Collaborator`, cobrindo matrícula, cargo, departamento, setor, gestor,
jornada, turno, escala, tipo de vínculo, senioridade e skills — com relações
estabelecidas para Setor, Ausência, Skill, Squad e hierarquia de gestão.

Criar `employees` violaria `PEOPLE_MIGRATION_ANALYSIS.md` §6 e
`PEOPLE_CLOUD_EXECUTION_PROMPT.md` §13, que proíbem duplicar funcionalidade
existente.

## Correção

`Collaborator` **é** a entidade Employee do People Hub.

Duas alterações: `userId` passa a ser opcional (permitindo colaborador sem acesso
ao sistema) e a entidade ganha identidade própria com os campos pessoais de
`PEOPLE_DATABASE.md` §5.

O contrato externo da API segue a especificação: `/api/v1/people/employees`.

Referência: `docs/people/ADR-001-modelo-employee.md`

---

# 4. CORREÇÃO 3 — `tenant_id`

## O que a especificação diz

`PEOPLE_DATABASE.md` §3 exige `tenant_id` **e** `organization_id` em toda tabela.
`MULTITENANT.md` §4 descreve a hierarquia Tenant → Organization → Department.

## Por que está incorreto

Na arquitetura real, `Organization` **é** o tenant. Não existe entidade Tenant
separada, e o isolamento de todas as ~130 tabelas é feito por `organizationId`.

Criar `tenantId` significaria uma coluna duplicando `organizationId` em toda tabela
nova, sem nenhum consumidor.

## Correção

Tabelas do People Hub usam `organizationId`. `tenant_id` não será criado.

Uma hierarquia real Tenant → múltiplas Organizations é uma mudança de plataforma,
não uma decisão do módulo People.

Referência: `docs/people/ADR-004-auditoria-soft-delete.md` §1

---

# 5. CORREÇÃO 4 — Escopo da versão 1.0

## O conflito

Três documentos discordam sobre férias no MVP:

| Documento | Posição |
|---|---|
| `PEOPLE_HUB_BLUEPRINT.md` §4 | Férias no escopo inicial |
| `PEOPLE_IMPLEMENTATION_PLAN.md` §4 | Férias na Fase 5 |
| `PEOPLE_RELEASE_PLAN.md` §4 e §6 | Férias **fora** do v1.0, movidas para v1.5 |

## Correção

**A v1.0 inclui férias e licenças.**

Escopo aprovado da v1.0 (Fases 0 a 5):

```
Fase 0 · Fundação documental (ADRs, matriz de migração)
Fase 1 · Modelo de dados
Fase 2 · Backend people
Fase 3 · Navegação e perfil 360 do colaborador
Fase 4 · Documentos
Fase 5 · Férias, licenças e autosserviço
```

Justificativa: `Ausencia` já existe e funciona em produção, cobrindo férias,
atestado, folga, licença e banco de horas. Adiar para v1.5 não economiza trabalho.

Benefícios, treinamentos, desempenho, analytics e IA (Fases 6 a 8) ficam para
depois da v1.0, replanejados com o aprendizado do piloto.

`PEOPLE_RELEASE_PLAN.md` §4 e §6 ficam corrigidos por este item.

---

# 6. CORREÇÃO 5 — Vacation e Leave não são tabelas novas

## O que a especificação diz

`PEOPLE_DATABASE.md` §16 e §17 especificam `vacation_requests` e `leave_requests`
como tabelas separadas.

## Correção

Ambas são atendidas por `Ausencia`, que já discrimina o tipo
(`ferias | atestado | folga | licenca | banco_horas`) e já tem ciclo de aprovação
com solicitante, aprovador, data de aprovação e motivo de rejeição.

`Ausencia` será estendida com período aquisitivo e saldo. Nenhuma tabela nova.

---

# 7. CORREÇÃO 6 — `employee_assignments`

## O que a especificação diz

`PEOPLE_DATABASE.md` §10 especifica `employee_assignments` para histórico de
vínculo, com um registro novo a cada mudança.

## Correção

Os campos correntes (setor, cargo, gestor, tipo de vínculo) permanecem em
`Collaborator`, e as mudanças são registradas em `EmployeeHistory`.

Mesma informação, uma tabela a menos, e a timeline do colaborador passa a ter uma
fonte única em vez de duas.

---

# 8. CORREÇÃO 7 — Formato de permissões e compatibilidade

## O que a especificação diz

`PEOPLE_PERMISSIONS.md` §12 exige `module.entity.action`.

## Situação real

O produto usa `recurso:acao`, com 62 permissões em uso, e o guard faz comparação
exata de string — `people.employee.view` nunca casaria com `colaboradores:ver`.

## Correção

O People Hub adota `people.*` conforme a especificação. Um mapa de aliases no guard
traduz as permissões antigas, para que ninguém perca acesso no deploy:

```
colaboradores:ver     → people.employee.view
colaboradores:criar   → people.employee.create
colaboradores:editar  → people.employee.update
colaboradores:excluir → people.employee.delete
solicitacoes:aprovar  → people.request.process
```

As permissões antigas ficam depreciadas, não removidas.

O escopo por dado (ABAC de `PEOPLE_PERMISSIONS.md` §3 e §20) é resolvido em
serviço, não no guard.

Referência: `docs/people/ADR-003-modelo-permissoes.md`

---

# 9. CORREÇÃO 8 — Nomenclatura de produto

## O conflito

A plataforma é chamada de três formas nos documentos:

| Nome | Onde |
|---|---|
| Orkiestri Hub | `PROJECT_CONTEXT.md`, `VISION.md` |
| Orkiestri One | `MASTER_PROMPT.md`, `11-orkiestri-one.md` |
| Orkiestri HUB | `PEOPLE_COMMERCIAL_MODEL.md` §4 |

## Correção

**Orkiestri One** é o nome da plataforma, conforme `11-orkiestri-one.md`.

O módulo de RH chama-se **Orkiestri People**, seguindo a convenção do portfólio
(Desk, Projects, Fleet, Assets, Finance, Budget, CRM, Flow, Observe, Supply, Core).

"People Hub" permanece aceitável em documentação técnica interna. O nome comercial
é Orkiestri People.

---

# 10. CORREÇÃO 9 — Ausência no portfólio de produtos

`12-products.md` lista onze aplicações e **não inclui People**. `MASTER_PROMPT.md`
também não o cita entre os módulos apresentados como produtos independentes.

Orkiestri People deve ser incluído no portfólio quando o Project Phoenix for
construído.

Correção adicional no mesmo documento: `12-products.md` lista "Tema Escuro
(Roadmap)" — o tema escuro já está em produção.

---

# 11. CORREÇÃO 10 — Estrutura de pastas

## O que a especificação diz

`PEOPLE_IMPLEMENTATION_PLAN.md` §6 propõe:

```
modules/people/{backend,frontend,database,services,workflows,tests}
```

## Correção

O repositório separa `backend/` e `frontend/` na raiz. O módulo segue essa
separação:

```
backend/src/modules/people/     (em camadas, conforme BACKEND.md §4)
frontend/src/app/dashboard/people/
docs/people/                    (ADRs e decisões)
```

---

# 12. OBSERVAÇÃO — Dívidas conhecidas expostas pelo módulo

Não são correções à especificação, mas divergências entre o que ela exige e o que a
plataforma faz hoje. Ficam registradas para não serem confundidas com escopo do
People Hub.

| Exigência | Situação | Tratamento |
|---|---|---|
| `BACKEND.md` §3-4: Clean Architecture + DDD + Repository | Não seguido: um `*.module.ts` por módulo com DTO+Service+Controller juntos; Prisma direto no service | People nasce no padrão correto; legado não será refatorado agora |
| Testes unitários, integração, permissão e isolamento por fase | 2 arquivos de teste no backend inteiro | People nasce com testes; legado fica como está |
| Permissões tenant-scoped (`MULTITENANT.md` §10) | `Role` é global, sem `organizationId` | Dívida crítica, ADR próprio, antes de produção multi-cliente |
| Soft delete, `created_by`, `updated_by`, `version` | Ausentes em todas as ~130 tabelas | Aplicado só nas tabelas novas do People |
| Auditoria obrigatória | `AuditService.log()` não grava — falta `organizationId` e o erro é engolido por `catch {}` vazio | Correção é pré-requisito da Fase 2 |

===============================================================================

# END OF DOCUMENT
