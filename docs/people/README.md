# Orkiestri People — Documentação de Arquitetura

Registros de decisão e artefatos de planejamento do módulo **People Hub** (código `PEOPLE`).

## Contexto

As especificações funcionais do módulo vivem fora do repositório, em `Orkiestri Core/PEOPLE_*.md`.
Esta pasta contém as **decisões de engenharia** tomadas ao confrontar aquelas especificações
com a arquitetura real do produto — incluindo os pontos onde optamos, deliberadamente,
por divergir da especificação.

## Índice

| Documento | Assunto |
|---|---|
| [ADR-001](ADR-001-modelo-employee.md) | Modelo Employee — evoluir `Collaborator` em vez de criar `employees` |
| [ADR-002](ADR-002-autoridade-design-system.md) | Qual design system o produto segue |
| [ADR-003](ADR-003-modelo-permissoes.md) | Catálogo de permissões `people.*` e compatibilidade |
| [ADR-004](ADR-004-auditoria-soft-delete.md) | Auditoria, soft delete e campos padrão |
| [MIGRATION_MATRIX](MIGRATION_MATRIX.md) | Classificação KEEP / MOVE / REFACTOR de tudo que já existe |

## Escopo aprovado da v1.0

Fases 0 a 5: colaboradores, estrutura organizacional, documentos, solicitações e
férias/licenças. Benefícios, treinamentos, desempenho, analytics e IA ficam para
depois da v1.0, replanejados com o aprendizado do piloto.

## Status

| Fase | Situação |
|---|---|
| 0 · Fundação documental | Concluída — ADRs e matriz de migração |
| 1 · Modelo de dados | Concluída — migrations `20260728000001` a `...004` |
| 2 · Backend `people` | Base entregue — colaborador (CRUD, status, histórico), escopo ABAC, eventos |
| 3 · Navegação e perfil 360 | Entregue — lista, perfil, cadastro, edição e mudança de situação |
| 3b · Consolidar aba Colaboradores | Concluída — as outras abas aguardam suas telas |
| 4 · Documentos | Completa — backend, aba no perfil, envio, aprovação e download |
| 5 · Férias | Completa — período aquisitivo, saldo, solicitação e passivo |

**Aplicado em produção:** migrations `...001` a `...003`.
A `20260728000004` (férias) está só no banco local — a Fase 5 ainda não subiu.

### O que já existe no backend

```
backend/src/modules/people/
├── domain/            regras puras: status, ciclo de gestão, eventos
├── application/       casos de uso, DTOs, PeopleScopeService (ABAC)
├── infrastructure/    repositórios — único ponto que fala Prisma
└── presentation/      controller /api/v1/people/employees
```

Rotas ativas: `GET|POST /api/v1/people/employees`, `GET|PUT|DELETE .../:id`,
`PATCH .../:id/status`, `GET .../:id/historico`,
`GET|POST .../:id/documentos`, `GET|POST .../:id/ferias`,
`GET /api/v1/people/ferias/passivo`.

Aprovar, rejeitar e cancelar **férias** continuam em `/api/ausencias`: o fluxo é
genérico e serve atestado e licença também. `diasGozados` é derivado das ausências
a cada consulta, então o fluxo antigo reflete no saldo sem integração entre os
módulos.

O módulo legado `/api/collaborators` continua no ar. Só será aposentado na Fase 3,
quando o frontend do People assumir.

### Glossário

A especificação diz **Employee**; o model no banco chama-se **Collaborator**.
São a mesma coisa — ver [ADR-001](ADR-001-modelo-employee.md). O contrato externo
da API usa `employees`; o model interno permanece `Collaborator`.

---

## Formato dos ADRs

Cada ADR registra: contexto, decisão, alternativas descartadas, consequências
(incluindo as ruins) e o que precisa ser verdade para revisitá-la.
Um ADR aprovado não é reaberto sem novo ADR que o substitua.
