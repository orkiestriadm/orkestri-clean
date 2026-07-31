# ADR-003 — Modelo de permissões do People Hub

- **Status:** Aprovado
- **Data:** 2026-07-28
- **Decisores:** Guilherme
- **Relacionado:** [ADR-001](ADR-001-modelo-employee.md), [ADR-004](ADR-004-auditoria-soft-delete.md)

---

## Contexto

`PEOPLE_PERMISSIONS.md` §12 exige o formato `module.entity.action`:

```
people.employee.view · people.employee.create · people.document.approve
people.vacation.approve · people.request.process · …
```

O produto usa `recurso:acao`. Catálogo real em uso — 62 permissões:

```
agenda:*  ativos:*  automacoes:*  chamados:*  colaboradores:*  conhecimento:*
crm:*  financeiro:*  fornecedores:*  frota:*  keep:*  monitoramento:*
orcamento:*  projetos:*  reservas:*  sla:*  usuarios:*
```

O guard (`backend/src/modules/auth/permissions.guard.ts`) faz **comparação exata de string**:

```ts
if (user.isMaster) return true;
if (user.permissions.includes("*")) return true;
return required.every(p => userPerms.includes(p));
```

Não há wildcard por recurso (`colaboradores:*` não existe como conceito), nem hierarquia.
`isMaster` ignora tudo.

Três problemas concretos:

1. **`people.employee.view` nunca casaria com `colaboradores:ver`.** São strings diferentes;
   o guard não traduz.
2. **`Role` não tem `organizationId`** (`schema.prisma:835`). Papéis são globais no SaaS
   multi-tenant — um papel criado por um cliente é visível a todos.
3. **Não existe ABAC.** `PEOPLE_PERMISSIONS.md` §3 e §20 exigem escopo por dado ("gestor vê
   apenas seus liderados diretos e indiretos", "colaborador vê apenas a si"). O guard atual só
   responde sim/não por rota, sem noção de *quais registros*.

## Decisão

### 1. Formato: adotar `people.*` para o módulo novo

Permissões do People Hub nascem no formato da especificação. O catálogo v1.0:

```
people.employee.view          people.employee.create
people.employee.update        people.employee.delete
people.employee.export        people.employee.status.update

people.department.view        people.department.manage
people.position.view          people.position.manage

people.document.view          people.document.upload
people.document.update        people.document.delete
people.document.approve       people.document.export

people.vacation.view          people.vacation.request
people.vacation.approve       people.vacation.reject
people.vacation.cancel

people.request.create         people.request.view
people.request.process        people.request.close

people.report.view            people.report.export
```

Benefícios, treinamentos e desempenho entram nas Fases 6–7, não agora.

### 2. Compatibilidade: mapa de equivalência no guard, não renomeação

O guard ganha um **resolvedor de aliases**, aplicado antes da comparação:

```
colaboradores:ver     → people.employee.view
colaboradores:criar   → people.employee.create
colaboradores:editar  → people.employee.update
colaboradores:excluir → people.employee.delete
solicitacoes:aprovar  → people.request.process
```

Quem hoje tem `colaboradores:ver` continua enxergando a tela, sem intervenção do administrador.
As permissões antigas ficam **depreciadas, não removidas** — remover exigiria reconfigurar
todos os perfis de todos os clientes num único deploy.

Os aliases valem apenas no sentido antigo → novo. Nada de tradução bidirecional: código novo
declara só `people.*`.

### 3. Escopo por dado (ABAC): resolver no serviço, não no guard

O guard continua respondendo "esta rota é permitida?". O **escopo de dados** é responsabilidade
do serviço, via um `PeopleScopeService` que devolve o filtro Prisma aplicável ao usuário:

| Papel | Escopo resolvido |
|---|---|
| `HR_ADMIN` | todos os colaboradores da organização |
| `HR_ANALYST` | escopo organizacional configurado (setores atribuídos) |
| `MANAGER` | `gestorId` = seu colaborador, recursivamente (diretos e indiretos) |
| `EMPLOYEE` | apenas o próprio registro |

A hierarquia já existe: `Collaborator.gestorId` com auto-relação (`schema.prisma:760`).

**Nenhuma consulta do People Hub monta `where` manualmente.** Todas partem do filtro devolvido
pelo `PeopleScopeService`. Isso é testável isoladamente e é onde os testes de isolamento vão bater.

### 4. `Role` org-scoped: fora do escopo desta fase

`Role` ganhar `organizationId` é correto e necessário, mas toca autenticação, o painel de
super admin e os perfis de todos os clientes em produção. Não é trabalho do People Hub.

Fica **registrado como dívida crítica** e proposto como ADR próprio, a ser tratado antes do
People Hub ir a produção multi-cliente. Mitigação no meio-tempo: os papéis `HR_*` do People
serão criados com nome prefixado (`People — RH Administrador`) para reduzir colisão, e o
`PeopleScopeService` filtra por organização em toda consulta, independentemente do papel.

## Alternativas descartadas

**Renomear as 62 permissões para `module.entity.action`.** Alinharia tudo, mas quebra os
perfis configurados de todos os clientes em produção, exige migration de dados em
`RolePermission` e `UserPermissionOverride`, e não traz benefício funcional. O ganho é
cosmético fora do People.

**Usar `colaboradores:*` no People Hub e ignorar a especificação.** Evitaria o mapa de
aliases, mas o catálogo antigo não tem granularidade para documentos, férias, aprovação
e exportação — precisaríamos inventar `colaboradores:documento:aprovar`, que é o formato
novo com sintaxe antiga. Pior dos dois mundos.

**Implementar ABAC no guard.** O guard não tem acesso ao registro sendo consultado — ele roda
antes do serviço. Escopo por dado no guard exigiria carregar dados no guard, o que inverte
responsabilidades e duplica queries.

## Consequências

**Boas.** Módulo novo nasce no formato correto. Ninguém perde acesso no deploy. O escopo por
dado fica num único ponto testável em vez de espalhado por `where` manuais. É o primeiro
módulo do produto com ABAC de verdade.

**Ruins — assumidas.** Duas convenções de permissão convivendo no produto por tempo
indeterminado. O mapa de aliases é uma camada de indireção que alguém vai esquecer que existe
— precisa estar comentado no guard e testado.

`Role` global continua sendo um risco multi-tenant real, apenas mitigado, não resolvido. Se o
People Hub for para produção com mais de um cliente antes desse ADR, a mitigação por prefixo
de nome é frágil.

`isMaster` continua ignorando todas as permissões, inclusive as de dado sensível LGPD. Para
documentos de colaborador (atestados médicos, documentos pessoais) isso é questionável — um
administrador técnico não deveria ver atestado médico por padrão. Fica registrado para a
Fase 4, onde o *field-level security* será definido.

## Correção 2026-07-28 — o formato escolhido era inarmazenável

Este ADR adotou `module.entity.action` (`people.employee.view`) copiando
`PEOPLE_PERMISSIONS.md` §12. **Não funciona nesta plataforma.**

A tabela `permissions` tem duas colunas — `recurso` e `acao` — e a string
efetiva é sempre `${recurso}:${acao}` (`auth.service.ts:434`). Uma permissão com
três segmentos separados por ponto jamais existiria no banco: seria
inconcedível pela matriz e o guard nunca casaria com ela.

O defeito era silencioso: os controllers declaravam `people.document.view`,
ninguém possuía essa string, e todo endpoint da Fase 4 respondia 403 — inclusive
para o administrador.

**Formato corrigido:** `recurso` = `people.<entidade>`, `acao` em português.

```
people.colaborador:ver        people.colaborador:ver_todos
people.documento:aprovar      people.relatorio:ver
```

O namespace do módulo — que era a intenção da especificação — fica preservado,
e a ação usa a mesma língua das outras 84 permissões. Isso importa porque a
matriz de permissões é uma tela que o administrador lê.

O catálogo agora vive em `modules/people/people.permissions.ts` e é injetado em
`ALL_PERMISSIONS` de `auth.service.ts`, que já semeia a tabela e sincroniza os
papéis padrão a cada boot.

## Correção 2026-07-28 — escopo por permissão, não por nome de papel

A primeira versão do `PeopleScopeService` concedia escopo organizacional a
`["administrador", "rh_admin", "rh_analista", "hr_admin", "hr_analyst"]`.

Quatro desses cinco nomes **não existem**. Os papéis reais são `administrador`,
`analista`, `auditor`, `cliente_portal`, `gestor`, `master`, `operador`,
`supervisor`, `tecnico`, `visualizador`. Os nomes inventados vieram de
`PEOPLE_PERMISSIONS.md` §4, que descreve papéis conceituais.

Consequência: um analista de RH real (papel `analista`) enxergava apenas o
próprio cadastro — o módulo ficava inútil para seu usuário principal.

**Corrigido:** o escopo organizacional passa a depender da permissão
`people.colaborador:ver_todos`. Cada cliente decide quem é RH sem depender de o
nome do papel casar com uma lista fixa no código. Concedida por padrão a
`administrador` e `auditor`.

A mesma troca foi feita no `DocumentService`, onde o sigilo de categoria
sensível agora depende de `people.documento:aprovar` — quem aprova documento
exerce a função de RH.

## Revisitar quando

- `Role` ganhar `organizationId` (ADR próprio).
- A Fase 4 definir *field-level security* e o comportamento de `isMaster` sobre dado restrito.
- Fases 6–7 acrescentarem benefícios, treinamentos e desempenho ao catálogo.
