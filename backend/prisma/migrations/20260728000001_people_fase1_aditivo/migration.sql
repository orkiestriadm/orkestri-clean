-- ============================================================================
-- Orkiestri People — Fase 1, Passo 1 (aditivo)
--
-- Dá identidade própria ao colaborador e cria as entidades que faltavam:
-- cargos, endereços, contatos de emergência e linha do tempo funcional.
--
-- Esta migration NÃO quebra nada: userId continua obrigatório e todo campo
-- novo é opcional ou tem default. Ver docs/people/ADR-001.
-- ============================================================================

-- ── 1. Identidade própria do colaborador ───────────────────────────────────
-- Necessário para representar funcionário sem acesso ao sistema (Passo 3).

ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "nome_completo"     TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "email_pessoal"     TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "celular"           TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "data_nascimento"   TIMESTAMP(3);
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "genero"            TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "estado_civil"      TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "nacionalidade"     TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "data_admissao"     TIMESTAMP(3);
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "data_desligamento" TIMESTAMP(3);
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "status"            TEXT NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "position_id"       TEXT;

-- Campos de auditoria (docs/people/ADR-004). `version` fica de fora: não há
-- optimistic locking em nenhuma tela do produto.
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "criado_por_id"     TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "atualizado_por_id" TEXT;
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "excluido_em"       TIMESTAMP(3);

-- ── 2. Backfill ────────────────────────────────────────────────────────────
-- Todo colaborador existente hoje tem User. Copiamos nome e status para que a
-- entidade passe a se sustentar sozinha antes de o vínculo virar opcional.

UPDATE "collaborators" c
   SET "nome_completo" = u."nome"
  FROM "users" u
 WHERE c."user_id" = u."id"
   AND c."nome_completo" IS NULL;

UPDATE "collaborators"
   SET "status" = CASE WHEN "ativo" THEN 'ATIVO' ELSE 'INATIVO' END
 WHERE "status" = 'ATIVO' AND "ativo" = false;

-- ── 3. Cargos ──────────────────────────────────────────────────────────────
-- `cargo` era string livre. A tabela não é populada aqui: o backfill a partir
-- dos valores distintos existentes é feito na Fase 2, junto com o serviço que
-- vai mantê-la — evita criar cargos órfãos sem dono.

CREATE TABLE IF NOT EXISTS "positions" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "titulo"            TEXT NOT NULL,
  "codigo"            TEXT,
  "descricao"         TEXT,
  "nivel"             TEXT,
  "ativo"             BOOLEAN NOT NULL DEFAULT true,
  "criado_em"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"     TEXT,
  "atualizado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  "excluido_em"       TIMESTAMP(3),
  CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "positions_organization_id_titulo_key"
  ON "positions"("organization_id", "titulo");
CREATE INDEX IF NOT EXISTS "positions_organization_id_idx"
  ON "positions"("organization_id");

ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "positions_organization_id_fkey";
ALTER TABLE "positions"
  ADD CONSTRAINT "positions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborators" DROP CONSTRAINT IF EXISTS "collaborators_position_id_fkey";
ALTER TABLE "collaborators"
  ADD CONSTRAINT "collaborators_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 4. Endereços ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "collaborator_addresses" (
  "id"              TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  "tipo"            TEXT NOT NULL DEFAULT 'residencial',
  "cep"             TEXT,
  "logradouro"      TEXT,
  "numero"          TEXT,
  "complemento"     TEXT,
  "bairro"          TEXT,
  "cidade"          TEXT,
  "estado"          TEXT,
  "pais"            TEXT NOT NULL DEFAULT 'BR',
  "principal"       BOOLEAN NOT NULL DEFAULT false,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaborator_addresses_collaborator_id_idx"
  ON "collaborator_addresses"("collaborator_id");

ALTER TABLE "collaborator_addresses" DROP CONSTRAINT IF EXISTS "collaborator_addresses_collaborator_id_fkey";
ALTER TABLE "collaborator_addresses"
  ADD CONSTRAINT "collaborator_addresses_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. Contatos de emergência ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "collaborator_contacts" (
  "id"              TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  "nome"            TEXT NOT NULL,
  "parentesco"      TEXT,
  "telefone"        TEXT,
  "email"           TEXT,
  "emergencia"      BOOLEAN NOT NULL DEFAULT false,
  "observacoes"     TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaborator_contacts_collaborator_id_idx"
  ON "collaborator_contacts"("collaborator_id");
CREATE INDEX IF NOT EXISTS "collaborator_contacts_collaborator_id_emergencia_idx"
  ON "collaborator_contacts"("collaborator_id", "emergencia");

ALTER TABLE "collaborator_contacts" DROP CONSTRAINT IF EXISTS "collaborator_contacts_collaborator_id_fkey";
ALTER TABLE "collaborator_contacts"
  ADD CONSTRAINT "collaborator_contacts_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 6. Linha do tempo funcional ────────────────────────────────────────────
-- Conteúdo de produto, não trilha técnica. Ver docs/people/ADR-004 §4.

CREATE TABLE IF NOT EXISTS "collaborator_history" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "collaborator_id"   TEXT NOT NULL,
  "evento"            TEXT NOT NULL,
  "campo"             TEXT,
  "valor_anterior"    TEXT,
  "valor_novo"        TEXT,
  "descricao"         TEXT,
  "vigencia_em"       TIMESTAMP(3),
  "registrado_por_id" TEXT,
  "registrado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaborator_history_collaborator_id_registrado_em_idx"
  ON "collaborator_history"("collaborator_id", "registrado_em" DESC);
CREATE INDEX IF NOT EXISTS "collaborator_history_organization_id_idx"
  ON "collaborator_history"("organization_id");
CREATE INDEX IF NOT EXISTS "collaborator_history_evento_idx"
  ON "collaborator_history"("evento");

ALTER TABLE "collaborator_history" DROP CONSTRAINT IF EXISTS "collaborator_history_organization_id_fkey";
ALTER TABLE "collaborator_history"
  ADD CONSTRAINT "collaborator_history_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborator_history" DROP CONSTRAINT IF EXISTS "collaborator_history_collaborator_id_fkey";
ALTER TABLE "collaborator_history"
  ADD CONSTRAINT "collaborator_history_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 7. Índices novos em collaborators ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS "collaborators_position_id_idx" ON "collaborators"("position_id");
CREATE INDEX IF NOT EXISTS "collaborators_status_idx"      ON "collaborators"("status");
CREATE INDEX IF NOT EXISTS "collaborators_excluido_em_idx" ON "collaborators"("excluido_em");

-- ── 8. Semente do histórico ────────────────────────────────────────────────
-- Registra a admissão de quem já está cadastrado, para que a aba "Histórico"
-- do perfil 360 não nasça vazia. Usa a data de criação do registro como
-- aproximação — não temos data de admissão real para os existentes.

INSERT INTO "collaborator_history"
  ("id", "organization_id", "collaborator_id", "evento", "descricao", "registrado_em")
SELECT
  gen_random_uuid()::text,
  c."organization_id",
  c."id",
  'admissao',
  'Registro anterior ao Orkiestri People (data aproximada pelo cadastro)',
  c."criado_em"
FROM "collaborators" c
WHERE NOT EXISTS (
  SELECT 1 FROM "collaborator_history" h
   WHERE h."collaborator_id" = c."id" AND h."evento" = 'admissao'
);
