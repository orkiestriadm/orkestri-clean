# ADR-004 — Auditoria, soft delete e campos padrão

- **Status:** Aprovado
- **Data:** 2026-07-28
- **Decisores:** Guilherme
- **Relacionado:** [ADR-001](ADR-001-modelo-employee.md), [ADR-003](ADR-003-modelo-permissoes.md)

---

## Contexto

`PEOPLE_DATABASE.md` §3 exige, em toda tabela de negócio:

```
id · tenant_id · created_at · created_by · updated_at · updated_by · deleted_at · version
```

`MASTER.md` §"Database Principles" reforça: multi-tenancy, soft delete, auditoria, timestamps,
versionamento.

Nenhuma das ~130 tabelas do produto atende esse padrão hoje. O que existe:

| Campo exigido | Situação real |
|---|---|
| `id` | ✅ UUID em todas |
| `tenant_id` | ❌ Não existe. Isolamento é por `organizationId`; `Tenant` e `Organization` são a mesma entidade |
| `created_at` | ✅ `criadoEm` |
| `updated_at` | ✅ `atualizadoEm` (nem todas) |
| `created_by` | ❌ Ausente, salvo casos pontuais (`criadoPorId` em alguns models) |
| `updated_by` | ❌ Ausente |
| `deleted_at` | ❌ Não existe. Exclusão é física, com `onDelete: Cascade` |
| `version` | ❌ Não existe |

Existe uma tabela `AuditLog` (`schema.prisma:1496`) com `organizationId`, `userId`, `modulo`,
`tabela`, `registroId`, `acao`, `descricao`, `dados` (Json) e `ip` — modelo genérico e adequado.

### Achado: o serviço de auditoria não grava

`AuditService.log()` (`backend/src/modules/audit/audit.module.ts:13-38`) monta o `create` **sem
`organizationId`**, que é obrigatório no schema. A chamada falha em validação do Prisma e o erro
é engolido por um `catch {}` vazio na linha 37.

Os 7 call sites — todos em Frota — não gravam nada. Quem escreve direto na tabela passando
`organizationId` (`auth.service.ts:553`, `sistema.module.ts:253`) funciona normalmente.

O People Hub ia reutilizar essa infraestrutura. Ela precisa ser consertada antes.
Registrado como tarefa separada; não é escopo do People Hub corrigir Frota.

## Decisão

### 1. `tenant_id`: não criar

`Organization` **é** o tenant. Criar `tenantId` apenas para satisfazer a letra da especificação
significaria uma coluna duplicando `organizationId` em toda tabela nova, sem nenhum consumidor.

As tabelas do People Hub usam `organizationId`, como o resto do produto. A especificação será
corrigida (Fase 0) para refletir que tenant e organização são a mesma coisa nesta arquitetura.

Se um dia houver hierarquia real Tenant → múltiplas Organizations, isso é uma mudança de
plataforma inteira — não algo que o People Hub decide sozinho.

### 2. Campos padrão: aplicar só nas tabelas novas do People

Tabelas criadas pelo People Hub nascem com:

```prisma
organizationId  String
criadoEm        DateTime  @default(now())
criadoPorId     String?
atualizadoEm    DateTime  @updatedAt
atualizadoPorId String?
excluidoEm      DateTime?
```

`version` fica **de fora**. Ele serve para *optimistic locking*, e nenhuma tela do produto
implementa esse controle. Adicionar a coluna sem quem a leia é ruído. Entra quando houver
edição concorrente real (candidato: perfil do colaborador editado por RH e gestor ao mesmo tempo).

Retrofit das ~130 tabelas legadas está **fora de escopo** — é um projeto próprio.

### 3. Soft delete: sim, mas só onde importa

Soft delete via `excluidoEm` nas entidades com valor histórico ou obrigação legal:

| Entidade | Estratégia | Motivo |
|---|---|---|
| `Collaborator` | Soft delete | Registro funcional tem retenção legal; ADR-001 já muda `onDelete` para `SetNull` |
| `EmployeeDocument` | Soft delete | LGPD e trilha de auditoria |
| `EmployeeHistory` | Imutável, sem delete | É a própria trilha |
| `Position`, `Benefit` | `ativo: false` | Já é o padrão do produto (`Skill`, `Setor`) |
| `EmployeeAddress`, `EmployeeContact` | Delete físico | Dado corrente, sem valor histórico |

Toda consulta do People Hub filtra `excluidoEm: null` por padrão, no `PeopleScopeService`
(ADR-003) — não espalhado em cada `where`.

### 4. Auditoria: duas camadas com papéis distintos

Uma confusão a evitar: `AuditLog` e `EmployeeHistory` não são a mesma coisa.

**`AuditLog` — trilha técnica.** Quem fez o quê, quando, de qual IP. Genérica, para todo o
produto, consultada por auditor e compliance. O People Hub reusa a existente, sem model novo.
Grava em: criação, alteração, exclusão, aprovação, exportação e alteração de permissão.

**`EmployeeHistory` — linha do tempo de negócio.** Eventos da vida funcional da pessoa:
mudou de setor, mudou de cargo, mudou de gestor, mudou de status, foi admitido, foi desligado.
É conteúdo de produto — aparece na aba "Histórico" do perfil 360 e é lido pelo RH, não pelo
auditor. Especificado em `PEOPLE_DATABASE.md` §22.

Um evento pode gerar os dois. Mudança de setor gera `AuditLog` (rastreabilidade) **e**
`EmployeeHistory` (aparece na timeline do colaborador). São escritos por serviços diferentes,
com finalidades diferentes, e nenhum substitui o outro.

`EmployeeHistory` absorve também o papel de `employee_assignments` (`PEOPLE_DATABASE.md` §10):
em vez de uma tabela de vínculos com vigência, os campos correntes ficam em `Collaborator` e
as mudanças ficam registradas no histórico. Menos uma tabela, mesma informação.

### 5. Exportação: auditada obrigatoriamente

`PEOPLE_PERMISSIONS.md` §23 exige permissão, auditoria, motivo e validação de tenant em toda
exportação. Toda exportação do People Hub grava `AuditLog` com `acao: "exportar"`, a quantidade
de registros e os filtros aplicados. Sem exceção — é dado pessoal saindo do sistema.

## Alternativas descartadas

**Retrofit dos campos padrão em todas as tabelas.** Alinharia o produto à especificação, mas
são ~130 tabelas, migrations de alto risco e nenhum consumidor imediato dos campos novos.
Trabalho grande, benefício zero no curto prazo.

**Usar só `AuditLog` e dispensar `EmployeeHistory`.** Tentador — a tabela existe e tem `dados`
Json. Descartada: misturar trilha técnica com conteúdo de produto significa que a aba "Histórico"
do colaborador teria que filtrar e traduzir registros técnicos em tempo de leitura, e qualquer
mudança no formato de auditoria quebraria uma tela de negócio.

**Delete físico com trilha em `AuditLog`.** Insuficiente para LGPD e para restauração —
`AuditLog.dados` não garante o registro completo, e o `onDelete: Cascade` levaria junto ausências,
skills e documentos.

## Consequências

**Boas.** Tabelas novas nascem auditáveis e restauráveis. Reuso da infraestrutura de auditoria
existente, sem model novo. A separação trilha técnica × timeline de negócio evita acoplar uma
tela de produto ao formato de log.

**Ruins — assumidas.** O produto passa a ter dois padrões de tabela: as legadas sem soft delete
nem autoria, e as do People com. Quem ler o schema vai ver inconsistência — é dívida conhecida,
documentada aqui, não acidente.

`version` ausente significa que edição concorrente sobrescreve sem aviso. Aceitável na v1.0
(o volume de edição simultânea num cadastro de RH é baixo), mas é uma aposta. Se aparecer
relato de "minha alteração sumiu", este é o primeiro lugar a olhar.

A correção do `AuditService` é **pré-requisito** da Fase 2. Se ela não acontecer, o People Hub
nasce com auditoria silenciosamente quebrada — exatamente como Frota está hoje.

## Adendo 2026-07-28 — armazenamento de documentos

Ao implementar a Fase 4 apareceu um problema que este ADR não previa.

`backend/src/main.ts:25` publica `UPLOAD_DIR` com `useStaticAssets` sob `/uploads`,
e `nginx/nginx.conf:116` proxia esse caminho para a API. **Todo arquivo ali é
servido sem autenticação e sem checagem de organização** — quem tem a URL, baixa.

Documento de colaborador é classificado como Restrito em `PEOPLE_PERMISSIONS.md`
§21, e atestado médico é dado sensível sob a LGPD. Colocá-los ali seria vazamento
por construção.

**Decisão:** documentos do People ficam em raiz própria (`PEOPLE_DOCS_DIR`,
volume `people_docs_data`), nunca publicada estaticamente. Todo acesso passa por
`GET /api/v1/people/documents/:id/download`, que valida escopo, permissão, sigilo
por categoria e grava auditoria. `Content-Disposition: attachment` e `nosniff`
impedem que o arquivo seja renderizado no contexto da aplicação.

O layout no disco começa pelo id da organização (`{org}/{colaborador}/{arquivo}`)
para que o isolamento seja visível e o backup por cliente seja trivial.

A exposição de `/uploads` para os demais módulos permanece — está registrada
como tarefa separada, fora do escopo do People.

### Sigilo por categoria

Escopo (quem alcança o colaborador) não basta para documento. Um gestor tem
acesso legítimo à ficha do liderado, mas não deve ler o atestado médico dele.
`DocumentService` aplica um segundo nível: categorias sensíveis só abrem para RH,
master e o próprio colaborador. O gestor vê que o documento existe — precisa
saber se a pendência foi resolvida — sem poder baixá-lo.

## Revisitar quando

- Houver hierarquia real Tenant → múltiplas Organizations.
- Aparecer conflito de edição concorrente (introduzir `version`).
- Alguém decidir fazer o retrofit das tabelas legadas.
