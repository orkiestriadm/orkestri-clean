-- AlterTable: Cliente — add ativo, responsavel_id, saude_score
ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "ativo"          BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "responsavel_id" TEXT,
  ADD COLUMN IF NOT EXISTS "saude_score"    INTEGER   NOT NULL DEFAULT 100;

-- AddForeignKey: clientes.responsavel_id -> users.id
ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_responsavel_id_fkey"
  FOREIGN KEY ("responsavel_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: contratos
CREATE TABLE IF NOT EXISTS "contratos" (
  "id"               TEXT        NOT NULL,
  "cliente_id"       TEXT        NOT NULL,
  "tipo"             TEXT        NOT NULL DEFAULT 'servico',
  "plano"            TEXT,
  "sla_horas"        INTEGER,
  "vigencia_inicio"  TIMESTAMP(3),
  "vigencia_fim"     TIMESTAMP(3),
  "valor"            DOUBLE PRECISION,
  "ativo"            BOOLEAN     NOT NULL DEFAULT true,
  "observacoes"      TEXT,
  "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contratos_cliente_id_idx" ON "contratos"("cliente_id");
ALTER TABLE "contratos"
  ADD CONSTRAINT "contratos_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: cliente_timeline
CREATE TABLE IF NOT EXISTS "cliente_timeline" (
  "id"               TEXT         NOT NULL,
  "cliente_id"       TEXT         NOT NULL,
  "tipo"             TEXT         NOT NULL,
  "titulo"           TEXT         NOT NULL,
  "descricao"        TEXT,
  "referencia_tipo"  TEXT,
  "referencia_id"    TEXT,
  "user_id"          TEXT,
  "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cliente_timeline_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cliente_timeline_cliente_id_criado_em_idx"
  ON "cliente_timeline"("cliente_id", "criado_em");
ALTER TABLE "cliente_timeline"
  ADD CONSTRAINT "cliente_timeline_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_timeline"
  ADD CONSTRAINT "cliente_timeline_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
