# Matriz de migração — Orkiestri People

**Data:** 2026-07-28 · **Status:** Aprovada · Exigida por `PEOPLE_MIGRATION_ANALYSIS.md` §7 e §15

Classificação de toda funcionalidade existente relacionada a pessoas, conforme as quatro
categorias da especificação (§6): **KEEP** (compatível, continuar usando), **MOVE** (pertence
ao People Hub, realocar), **REFACTOR** (existe, precisa de ajuste arquitetural), **REMOVE**
(duplicado ou obsoleto — exige aprovação).

Nenhum item foi classificado como REMOVE.

---

## 1. Banco de dados

| Model | Local | Decisão | Ação | Fase |
|---|---|---|---|---|
| `Collaborator` | `schema.prisma:728` | **REFACTOR** | `userId` opcional; ganha identidade e dados pessoais próprios. Vira a entidade Employee. Ver [ADR-001](ADR-001-modelo-employee.md) | 1 |
| `Setor` | `schema.prisma:2234` | **KEEP** | Já é Department com hierarquia (`parentId`) e gestor (`responsavelId`). Ganha `codigo` para atender `PEOPLE_DATABASE.md` §8 | 1 |
| `Ausencia` | `schema.prisma:655` | **REFACTOR** | Já cobre férias e licenças (`ferias\|atestado\|folga\|licenca\|banco_horas`). Ganha período aquisitivo e saldo. **Não criar `vacation_requests` nem `leave_requests`** | 5 |
| `WorkflowRequest` | `schema.prisma:551` | **KEEP** | Motor de aprovação maduro: níveis, escalonamento, motivo de rejeição, lembretes | 5 |
| `WorkflowApproval` | `schema.prisma:587` | **KEEP** | Histórico de decisões por nível | 5 |
| `WorkflowTemplate` | `schema.prisma:605` | **KEEP** | Etapas em Json; já prevê `tipo: "rh"` | 5 |
| `AprovadorSetor` | `schema.prisma:630` | **KEEP** | Aprovador primário + backup com vigência. Cobre `PEOPLE_WORKFLOWS.md` §15 (escalonamento) melhor que a especificação pede |  5 |
| `Skill` / `CollaboratorSkill` | `schema.prisma:687,708` | **REFACTOR** | `CollaboratorSkill` já tem `certificadoEm` e `validade` — é o embrião de certificações. Absorvido por Treinamentos | 6 |
| `Squad` / `SquadMember` | `schema.prisma:513,533` | **MOVE** | Estrutura de time com alocação percentual. Passa a ser gerido em People | 3 |
| `UserRequest` | `schema.prisma:484` | **MOVE** | Já grava setor, gestor, jornada, senioridade e tipo de vínculo na aprovação — é onboarding | 4 |
| `CadastroRequest` | `schema.prisma:2436` | **MOVE** | Fluxo de solicitação de cadastro | 4 |
| `Notification` | `schema.prisma:1478` | **REFACTOR** | Só tem `lida`. `PEOPLE_NOTIFICATION_RULES.md` exige `channel`, `status`, `read_at`, `action_taken` e preferências por usuário | 4 |
| `AlertaRegra` | `schema.prisma:336` | **KEEP** | Canais (sistema/email/WhatsApp) e destinatários por organização. Reusar para vencimento de documento | 4 |
| `AuditLog` | `schema.prisma:1496` | **KEEP** | Modelo genérico adequado. ⚠️ O `AuditService` está quebrado — ver [ADR-004](ADR-004-auditoria-soft-delete.md) | 2 |
| `Role` / `Permission` | `schema.prisma:835,861` | **REFACTOR** | Aliases de compatibilidade `colaboradores:*` → `people.*`. `Role` org-scoped fica como dívida separada. Ver [ADR-003](ADR-003-modelo-permissoes.md) | 2 |
| `UserProfile` | `schema.prisma:815` | **REFACTOR** | Tem `cargo` e `setorId` duplicando `Collaborator`. Consolidar: dado funcional vive em `Collaborator`; `UserProfile` fica só com preferências de conta (2FA, WhatsApp, status online, módulos) | 3 |
| `ApontamentoHoras` | `schema.prisma:2367` | **KEEP** | Ligado a `User`, não a `Collaborator`. Fica em Horas/Capacidade. Ver consequência em [ADR-001](ADR-001-modelo-employee.md) | — |

### Tabelas a criar

Nenhuma delas tem equivalente no produto.

| Nova tabela | Justificativa | Fase |
|---|---|---|
| `Position` | `cargo` é string livre em 6 tabelas (`Collaborator`, `UserProfile`, `UserRequest`, `Cliente`, `Motorista`, `SupplierContact`). Sem entidade não há análise de cargos | 1 |
| `EmployeeAddress` | Não existe endereço de pessoa no produto | 1 |
| `EmployeeContact` | Contato de emergência — obrigatório em RH | 1 |
| `EmployeeHistory` | Timeline funcional. Absorve também `employee_assignments` da especificação. Ver [ADR-004](ADR-004-auditoria-soft-delete.md) | 1 |
| `EmployeeDocument` + categorias | Só existem anexos por domínio (`ChamadoAnexo`, `DocumentoVeiculo`, `SupplierDocument`, `MotoristaAnexo`, `ContratoAnexo`) — nenhum com validade e aprovação | 4 |
| `Benefit` / `EmployeeBenefit` | Inexistente | 6 |
| `TrainingCourse` / `EmployeeTraining` | Inexistente | 6 |
| `PerformanceReview` | Inexistente | 6 |

---

## 2. Backend

| Módulo | Arquivo | Decisão | Ação |
|---|---|---|---|
| `collaborators` | `collaborators.module.ts` | **MOVE** | Absorvido por `people`. Remover o `throw` de `userId obrigatório` (linha 128) |
| `ausencias` | `ausencias.module.ts` | **MOVE** | Vira Férias e Licenças dentro de `people` |
| `skills` | `skills.module.ts` | **MOVE** | Vira base de Treinamentos |
| `squads` | `squads.module.ts` | **MOVE** | Estrutura organizacional |
| `setores` | `setores.module.ts` | **MOVE** | Vira Departamentos |
| `workforce` | `workforce.module.ts` | **MOVE** | Vira o dashboard do People. ⚠️ Corrigir agregação por `userId` (linha 73) para `collaborator.id` |
| `workflows` | `workflows.module.ts` | **KEEP** | Motor genérico, serve todos os módulos. People consome, não move |
| `capacity` | `capacity.module.ts` | **KEEP** | Fica em Projetos/Horas. ⚠️ Blindar `collab.user.nome` (linhas 179, 242, 299) |
| `rbac` | `rbac.module.ts` | **REFACTOR** | Resolvedor de aliases no guard |
| `audit` | `audit.module.ts` | **REFACTOR** | Corrigir `organizationId` ausente e o `catch {}` vazio antes da Fase 2 |
| `notifications` | `notifications/` | **REFACTOR** | Estender canais e estados |
| `users` | `users.module.ts` | **KEEP** | Identidade e acesso são Core, não People |
| `auth` | `auth.service.ts` | **KEEP** | ⚠️ Linha 751 cria `Collaborator` no cadastro — validar após ADR-001 |

**Novo:** `backend/src/modules/people/`, em camadas conforme `BACKEND.md` §4 — o primeiro módulo
do repositório a seguir o padrão documentado. Serve de referência; não implica refatorar os 40
módulos existentes.

---

## 3. Frontend

| Origem | Destino | Decisão |
|---|---|---|
| `/dashboard/cadastros` aba **colaboradores** | `/dashboard/people` | ✅ **MOVIDO** (2026-07-28) |
| `/dashboard/cadastros` aba **skills** | `/dashboard/people/treinamentos` | **MOVE** — só na Fase 6, quando houver destino |
| `/dashboard/cadastros` aba **ausencias** | `/dashboard/people/ausencias` | **MOVE** — só na Fase 5 |
| `/dashboard/cadastros` aba **squads** | `/dashboard/people/organizacao` | **MOVE** — aguarda tela de organização |
| `/dashboard/cadastros` aba **organograma** | `/dashboard/people/organizacao` | **MOVE** — aguarda tela de organização |
| `/dashboard/cadastros` aba **setores** | `/dashboard/people/organizacao` | **MOVE** — aguarda tela de organização |

> **Correção ao plano original.** A Fase 3 previa mover as cinco abas de uma vez.
> Só `colaboradores` tinha destino pronto: skills, ausências, squads e organograma
> não têm equivalente no People ainda, e movê-las agora removeria funcionalidade
> sem substituto. Cada uma sai quando sua tela existir.

### Estado da aba colaboradores

O conteúdo foi substituído por um painel que aponta para `/dashboard/people`.
A aba continua visível de propósito — quem conhece o caminho antigo precisa
encontrar o novo. Sai da barra quando o tráfego migrar.

Removido junto, por ficar órfão: `CollabForm` (172 linhas), os três modais de
colaborador, `filteredCollabs`, o filtro ativos/inativos, a busca da aba e quatro
constantes. Saldo: −292 linhas.
| `/dashboard/cadastros` abas **usuarios, papeis, matriz, organizacoes** | permanecem | **KEEP** — são administração de plataforma |
| `/dashboard/cadastros` aba **solicitacoes** | `/dashboard/people/solicitacoes` | **MOVE** |
| `/dashboard/workforce` | `/dashboard/people` | **MOVE** — vira o dashboard do módulo |
| `/dashboard/aprovacoes` | permanece | **KEEP** — central de aprovações transversal |
| `/dashboard/capacity` | permanece | **KEEP** |
| `components/data-ui.tsx` | permanece e cresce | **KEEP** — ver [ADR-002](ADR-002-autoridade-design-system.md) |

`cadastros/page.tsx` tem **2.932 linhas** com 11 abas. A migração é **uma aba por vez**, com a
rota antiga redirecionando para a nova — nunca num único movimento.

---

## 4. Riscos da migração

| Risco | Onde | Mitigação |
|---|---|---|
| Quebra em Capacidade ao tornar `userId` opcional | `capacity.module.ts:179,242,299` | Passo 2 do [ADR-001](ADR-001-modelo-employee.md): blindar antes de mudar o schema |
| Agregação de ausências colapsa em chave nula | `workforce.module.ts:73` | Chavear por `collaborator.id`; correção vale mesmo sem o ADR-001 |
| Regressão em telas admin durante a migração de `cadastros` | `cadastros/page.tsx` | Uma aba por vez, com redirect e verificação em homologação entre cada uma |
| Auditoria nasce quebrada | `audit.module.ts:37` | Pré-requisito da Fase 2 |
| Duplicação de dado funcional | `UserProfile.cargo` × `Collaborator.cargo` | Consolidar na Fase 3, `Collaborator` como fonte única |
| Perda de acesso de usuários no deploy | guard de permissões | Aliases de compatibilidade, permissões antigas depreciadas e não removidas |
| Dado pessoal exposto sem *field-level security* | documentos, atestados | Definir antes do primeiro upload (Fase 4), não depois |

---

## 5. Resumo

**~40% do escopo da v1.0 já existe** no produto, disperso e sem identidade de módulo.
O trabalho predominante é consolidação e migração, não construção.

| Decisão | Itens |
|---|---|
| KEEP | 11 |
| MOVE | 16 |
| REFACTOR | 10 |
| REMOVE | 0 |
| Criar do zero | 8 tabelas |
