# ADR-001 — Modelo Employee: evoluir `Collaborator`

- **Status:** Aprovado
- **Data:** 2026-07-28
- **Decisores:** Guilherme
- **Substitui:** —
- **Relacionado:** [ADR-004](ADR-004-auditoria-soft-delete.md), [MIGRATION_MATRIX](MIGRATION_MATRIX.md)

---

## Contexto

`PEOPLE_DATABASE.md` §5 especifica uma tabela `employees` nova, com identidade própria e
campos pessoais completos (nascimento, gênero, estado civil, nacionalidade, e-mail pessoal,
foto, data de admissão e desligamento).

O produto já tem `Collaborator` (`backend/prisma/schema.prisma:728`), que cobre boa parte disso:

```
matricula, fotoUrl, emailCorporativo, telefone,
cargo, departamento, setorId, squad, especialidade, senioridade, gestorId,
jornadaHorasDia, jornadaHorasMes, turno, escala, tipoVinculo,
skills (Json), certificacoes (Json), ativo
```

Com relações já estabelecidas para `Setor`, `Ausencia`, `CollaboratorSkill`, `Squad`,
`SquadMember` e hierarquia recursiva via `gestorId`.

O bloqueio está em uma linha:

```prisma
userId  String  @unique @map("user_id")
user    User    @relation("UserCollaborator", fields: [userId], references: [id], onDelete: Cascade)
```

`userId` é **obrigatório e único**. Na prática, todo colaborador cadastrado hoje é
necessariamente um usuário com login. O People Hub precisa gerenciar o quadro completo —
uma empresa de 150 funcionários pode ter 20 com acesso ao sistema.

`PEOPLE_MIGRATION_ANALYSIS.md` §6 e `PEOPLE_CLOUD_EXECUTION_PROMPT.md` §13 estabelecem que,
se a funcionalidade já existe, ela deve ser movida e refatorada — nunca duplicada.

## Decisão

**`Collaborator` é a entidade Employee do People Hub.** Não criaremos tabela `employees`.

Duas mudanças estruturais:

1. `userId` passa a ser **opcional** (`String?`), mantendo `@unique` (um usuário continua
   vinculado a no máximo um colaborador). `onDelete` muda de `Cascade` para `SetNull` —
   excluir o login de alguém não pode apagar o registro funcional da pessoa.
2. `Collaborator` ganha **identidade própria**: `nomeCompleto`, `emailPessoal` e os campos
   pessoais de `PEOPLE_DATABASE.md`. Hoje o nome vem sempre de `user.nome`; um colaborador
   sem login precisa de nome próprio.

O nome de exibição passa a ser `collaborator.nomeCompleto ?? collaborator.user?.nome`.

O nome da tabela (`collaborators`) e do model permanecem. Renomear para `employees` custaria
uma migration de alto risco em 6 relações e 10 módulos de backend, em troca de alinhamento
puramente nominal com a especificação.

## Alternativas descartadas

**Criar `employees` do zero, mantendo `Collaborator`.**
Descartada: cria dois cadastros de pessoa convivendo no mesmo banco. Viola diretamente a
regra de não-duplicação da própria especificação e garante divergência de dados a médio prazo.

**Criar `employees` e migrar `Collaborator` inteiro para lá.**
Descartada por relação risco/benefício. Exigiria reapontar Capacidade, Apontamentos e Squads
— três módulos em produção — para ganhar apenas o nome correto da tabela. O ganho é cosmético;
o risco, real.

## Superfície de impacto (verificada no código)

Pontos que assumem `Collaborator.user` presente e **quebram** com `userId` nulo:

| Arquivo | Linha | Uso | Efeito com `user` nulo |
|---|---|---|---|
| `backend/src/modules/capacity/capacity.module.ts` | 179 | `collab.user.nome` | `TypeError` |
| `backend/src/modules/capacity/capacity.module.ts` | 242 | `c.user.nome` | `TypeError` |
| `backend/src/modules/capacity/capacity.module.ts` | 299 | `c.user.nome` | `TypeError` |
| `backend/src/modules/workforce/workforce.module.ts` | 73 | `a.collaborator.userId` como chave de agregação | Chaves nulas colidem num único balde |
| `backend/src/modules/ausencias/ausencias.module.ts` | 61, 96, 141, 176 | `include: { user: ... }` | Retorna `null`, sem crash |
| `backend/src/modules/skills/skills.module.ts` | 55 | `include: { user: ... }` | Retorna `null`, sem crash |
| `backend/src/modules/squads/squads.module.ts` | 148 | `include: { user: ... }` | Retorna `null`, sem crash |
| `backend/src/modules/collaborators/collaborators.module.ts` | 128 | `if (!dto.userId) throw` | Impede o caso de uso novo |
| `backend/src/modules/auth/auth.service.ts` | 751 | cria `Collaborator` no cadastro | Continua válido, sem mudança |

Frontend que consome nome via `user`: `cadastros`, `capacity`, `workforce`, `chamados`, `projetos`.

## Estratégia de migração (3 passos, reversíveis)

**Passo 1 — aditivo, sem quebra.**
Adicionar `nomeCompleto`, `emailPessoal` e campos pessoais como opcionais. `userId` continua
obrigatório. Backfill: `nomeCompleto = user.nome` para todos os registros existentes.
*Neste ponto nada quebra e nada muda de comportamento.*

**Passo 2 — blindar os consumidores.**
Trocar todo `collab.user.nome` por um helper `displayName(collab)`. Corrigir a agregação de
`workforce.module.ts:73` para chavear por `collaborator.id`, não por `userId` — semanticamente
mais correto mesmo hoje. Cobrir com teste.
*Ainda sem mudança de schema. Passo isolado e verificável.*

**Passo 3 — relaxar a restrição.**
`userId` → opcional, `onDelete: SetNull`. Remover o `throw` de `collaborators.module.ts:128`.
Formulário de colaborador passa a aceitar "sem acesso ao sistema".

Rollback: cada passo é uma migration independente. O passo 3 só é irreversível depois que
existir o primeiro colaborador sem `userId` — antes disso, reverter é trivial.

## Consequências

**Boas.** Zero duplicação de cadastro de pessoa. Nenhuma migração de dados entre tabelas.
Capacidade, Apontamentos, Ausências, Skills e Squads continuam funcionando sem serem tocados
estruturalmente. O passo 2 corrige um bug latente de agregação.

**Ruins — assumidas conscientemente.**

O model chama-se `Collaborator` e a especificação chama-se `Employee`. Toda a documentação do
People Hub fala em "employee"; o código fala em "colaborador". Isso vai gerar atrito de
leitura permanente. Mitigação: glossário no `README.md` desta pasta e nomes de API em
`/api/v1/people/employees` (contrato externo segue a especificação; o model interno, não).

Capacidade e Apontamentos são calculados a partir de `User`, não de `Collaborator`. Um
colaborador sem login terá capacidade nominal mas **nunca** horas realizadas. Isso é
semanticamente correto — quem não usa o sistema não aponta horas — mas vai aparecer como
"0% de utilização" nos relatórios. Precisa ser tratado na UI da Fase 7 com um estado
explícito ("sem acesso ao sistema"), não como zero.

`Collaborator.skills` e `Collaborator.certificacoes` são `Json` legados, redundantes com
`CollaboratorSkill`. Não serão usados pelo People Hub. Removê-los é trabalho da Fase 6,
quando Treinamentos absorver as certificações.

## Revisitar quando

- For necessário um colaborador com **mais de um** vínculo empregatício simultâneo
  (hoje `Collaborator` assume um vínculo; `employee_assignments` da especificação prevê
  histórico, tratado no ADR-004 via `EmployeeHistory`).
- O atrito de nomenclatura Collaborator/Employee provar-se mais caro que a migration
  que evitamos.
