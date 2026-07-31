# Auditoria — Orkiestri People

**Data:** 2026-07-28 · **Branch:** `claude/orkiestri-architecture-analysis-780cdd`
**Worktree:** `.claude/worktrees/bold-pare-e0883d`

Revisão do que foi construído nas Fases 0 a 4, com verificação contra o banco e
o código real — não contra a intenção do plano.

---

## 1. Estado atual

| Fase | Situação |
|---|---|
| 0 · Fundação documental | Completa — 4 ADRs + matriz de migração |
| 1 · Modelo de dados | Completa — 2 migrations, **não aplicadas** |
| 2 · Backend colaborador | Completo — CRUD, status, histórico, escopo |
| 3 · Frontend colaborador | Completo — lista, perfil 360, formulário, situação |
| 3b · Aba de Cadastros | Completa — só `colaboradores`; as outras 4 aguardam destino |
| 4 · Documentos (backend) | Completo — storage isolado, download autenticado |
| 4 · Documentos (frontend) | **Não iniciado** |

**Verificação:** 94 testes passando, `tsc` limpo nos dois lados, build do Next
passando. 17 testes de `auth` falham — quebra pré-existente, confirmada no HEAD
limpo antes de qualquer alteração.

**Nunca executado:** as 3 migrations não foram aplicadas em nenhum ambiente, e
nenhuma linha do módulo rodou fora de teste unitário. Tudo abaixo foi encontrado
por leitura de código e consulta ao banco — não por uso.

---

## 2. Problemas encontrados

Ordenados por gravidade.

### P1 · A API de documentos é inacessível — CRÍTICO

`people.document.*`, `people.report.*` e `people.employee.export` **não existem
na tabela `permissions`** (84 registros, nenhum `people.*`) e **não têm alias**
em `common/permission-aliases.ts`.

Consequência: todo endpoint da Fase 4 responde 403 para qualquer usuário que não
seja master. E o administrador não consegue conceder a permissão pela matriz,
porque ela não existe como item concedível.

`ALL_PEOPLE_PERMISSIONS` foi definido em `people.permissions.ts` e nunca é usado
por ninguém — a semente que ele existia para alimentar nunca foi escrita.

### P2 · Os papéis de RH não existem no sistema — CRÍTICO

`PeopleScopeService.PAPEIS_RH` lista
`["administrador", "rh_admin", "rh_analista", "hr_admin", "hr_analyst"]`.

Os papéis reais são: `administrador`, `analista`, `auditor`, `cliente_portal`,
`gestor`, `master`, `operador`, `supervisor`, `tecnico`, `visualizador`.

Quatro dos cinco nomes foram inventados. Só `administrador` casa.

Consequência: um analista de RH real (papel `analista`) recebe escopo `proprio` —
enxerga apenas o próprio cadastro. O módulo fica inutilizável para quem deveria
ser seu usuário principal, a menos que a pessoa seja administrador ou master.

### P3 · O legado ignora exclusão lógica — ALTO

Nenhuma consulta fora do People filtra `excluidoEm`. Oito pontos:

```
capacity.module.ts:147, 201, 272
workforce.module.ts:37
collaborators.module.ts:113, 138, 150, 184, 203
```

Consequência: colaborador excluído no People continua contando em Capacidade e
Workforce, e continua aparecendo na lista legada e nos seletores de Squad e
Ausência. A exclusão parece não ter efeito.

### P4 · `ativo` e `status` podem divergir — ALTO

`UpdateCollaboratorDto` (legado) ainda aceita `ativo` isolado. Um `PUT
/collaborators/:id` com `{ativo: false}` e sem `status` deixa `ativo=false` e
`status=ATIVO`.

Consequência: o perfil mostra "Ativo" enquanto Capacidade exclui a pessoa. Os
dois campos existem porque o ADR-001 optou por manter `ativo` para os
consumidores legados — mas a sincronia só foi garantida num sentido.

### P5 · Arquivo órfão no upload — MÉDIO

`document.service.ts:96` grava o arquivo em disco **antes** de
`repo.criar()` na linha 100. Se o insert falhar, o arquivo fica no volume sem
registro que o referencie — invisível para a aplicação e para qualquer rotina de
limpeza.

### P6 · Sem transação em operações compostas — MÉDIO

Não há `$transaction` em nenhum ponto do módulo. Criar colaborador executa
`repo.criar` → `historico.registrar` → `auditar` → `publish` em sequência solta.

Consequência: falha no meio deixa colaborador sem evento de admissão no
histórico, ou documento aprovado sem linha na timeline. A trilha fica com
buracos silenciosos.

### P7 · Escopo vazio se disfarça de lista vazia — MÉDIO

`PeopleScopeService` devolve `{id: {in: []}}` quando não há escopo, e a lista
responde 200 com zero itens. A tela exibe "Nenhum colaborador cadastrado".

Consequência: a mensagem afirma que não existe cadastro, quando o correto seria
dizer que o usuário não alcança nenhum. Alguém vai abrir chamado dizendo que os
dados sumiram.

### P8 · `positionId` não tem como ser preenchido — MÉDIO

A tabela `positions` foi criada, `Collaborator.positionId` existe, os DTOs
aceitam o campo e a listagem devolve `position` — mas **não há endpoint de
cargos**. Nada cria, lista ou edita `Position`.

Consequência: o campo é inutilizável pela interface, e a migration de Fase 1
previa um backfill dos `cargo` string que nunca foi escrito.

### P9 · `AuditService` continua quebrado — ALTO (externo)

Verificado no checkout principal em 2026-07-28: `AuditService.log()` segue sem
`organizationId` e com `catch {}` vazio. Está sendo corrigido em sessão separada.

Consequência para o People: toda auditoria do módulo — inclusive o registro de
quem baixou documento restrito — cai no `catch` e desaparece.

### P10 · `<tr role="link">` — BAIXO

`app/dashboard/people/page.tsx` aplica `role="link"` a uma linha de tabela.
Combinação não prevista pela especificação ARIA; leitores de tela tratam de forma
inconsistente.

---

## 3. O que NÃO foi encontrado

Verificado e correto:

- Schema Prisma e as 3 migrations estão consistentes campo a campo.
- Isolamento entre organizações no `PeopleScopeService` — coberto por teste.
- Travessia de diretório no armazenamento de documentos — coberto por teste.
- Alias de permissão não concede a mais do que deveria — coberto por teste.
- `collaboratorDisplayName` protege todos os consumidores conhecidos de
  `Collaborator.user`.
- Volume `people_docs_data` declarado e referenciado corretamente.

---

## 4. Correções aplicadas — 2026-07-28

| | Problema | Como foi resolvido |
|---|---|---|
| P1 | API de documentos inacessível | Catálogo `PEOPLE_PERMISSION_CATALOG` injetado em `ALL_PERMISSIONS` de `auth.service.ts`, que já semeia a tabela e sincroniza papéis a cada boot. Concedidas a `administrador` (automático), `gestor`, `supervisor`, `visualizador` e `auditor`. **Formato corrigido**: `people.<entidade>:<acao>` — o formato com pontos do ADR-003 era inarmazenável |
| P2 | Papéis de RH inventados | Escopo organizacional passa a depender da permissão `people.colaborador:ver_todos`, não de nome de papel. Mesma troca no sigilo de categoria sensível, que agora usa `people.documento:aprovar` |
| P3 | Legado ignora exclusão lógica | `excluidoEm: null` no escopo de `collaborators`, `capacity` e `workforce`. Em capacity foi preciso um `collabScope` separado — o `orgScope` também serve apontamentos, chamados e projetos, que não têm a coluna |
| P4 | `ativo` e `status` divergem | `sincronizarSituacao()` mantém os dois coerentes em qualquer sentido de escrita. Desativar pelo caminho legado gera `INATIVO`, nunca `DESLIGADO` |
| P5 | Arquivo órfão no upload | Falha após a gravação desfaz o arquivo antes de propagar o erro |
| P6 | Sem transação | `criarComHistorico` e `atualizarComHistorico` em ambos os repositórios. O id passou a ser gerado na aplicação — dentro da transação o histórico precisa referenciar o registro do mesmo lote |
| P7 | Escopo vazio mentia | Lista devolve 403 com orientação ("peça ao RH para vincular seu cadastro") em vez de "nenhum colaborador cadastrado" |
| P8 | `positionId` sem API | CRUD de cargos em `/api/v1/people/cargos`, mais importação dos `cargo` texto existentes. Excluir cargo em uso é recusado com contagem |
| P10 | `<tr role="link">` | Removido; o nome virou link de verdade |

**P9** (`AuditService`) permanece — está sendo corrigido em sessão separada.

Verificação: 104 testes passando (eram 94), `tsc` limpo, build do Next passando.
As 17 falhas de `auth` continuam pré-existentes.

### Um erro cometido durante a correção

Ao aplicar o P3, comecei adicionando `excluidoEm: null` ao `orgScope` de
`capacity.module.ts`. Aquele helper é usado por `apontamentoHoras`, `chamado` e
`project` — tabelas sem a coluna. Teria quebrado três consultas. Encontrado ao
conferir os pontos de uso antes de rodar; daí o `collabScope` separado.

---

## 5. Ordem sugerida de correção

1. **P1 + P2 juntos** — sem eles o módulo não funciona para ninguém além do
   master. São a diferença entre "código escrito" e "produto utilizável".
2. **P9** — pré-requisito de qualquer coisa auditável (em andamento fora daqui).
3. **P3 + P4** — coerência de dado entre People e legado.
4. **P5 + P6** — robustez.
5. **P7 + P8 + P10** — experiência e completude.
6. Só então: aplicar migrations em homologação e verificar de fato.
