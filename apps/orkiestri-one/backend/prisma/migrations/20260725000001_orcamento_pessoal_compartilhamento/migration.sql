-- Orçamento pessoal + compartilhamento
-- Ciclos ganham dono (owner_id NULL = corporativo; preenchido = pessoal).
-- Nova tabela de compartilhamento: presença = pode ver E editar.

-- 1. Coluna owner_id em orcamento_ciclos
ALTER TABLE "orcamento_ciclos" ADD COLUMN IF NOT EXISTS "owner_id" TEXT;

-- 2. Troca a trava única de (org, ano) para (org, owner_id, ano)
DROP INDEX IF EXISTS "orcamento_ciclos_organization_id_ano_key";
CREATE UNIQUE INDEX IF NOT EXISTS "orcamento_ciclos_organization_id_owner_id_ano_key"
  ON "orcamento_ciclos"("organization_id", "owner_id", "ano");
CREATE INDEX IF NOT EXISTS "orcamento_ciclos_organization_id_idx"
  ON "orcamento_ciclos"("organization_id");

-- 3. FK do dono -> users. Cascade: remover o usuário remove o orçamento pessoal dele.
ALTER TABLE "orcamento_ciclos" DROP CONSTRAINT IF EXISTS "orcamento_ciclos_owner_id_fkey";
ALTER TABLE "orcamento_ciclos"
  ADD CONSTRAINT "orcamento_ciclos_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Tabela de compartilhamento
CREATE TABLE IF NOT EXISTS "orcamento_compartilhamentos" (
  "id" TEXT NOT NULL,
  "ciclo_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "criado_por_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orcamento_compartilhamentos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "orcamento_compartilhamentos_ciclo_id_user_id_key"
  ON "orcamento_compartilhamentos"("ciclo_id", "user_id");
CREATE INDEX IF NOT EXISTS "orcamento_compartilhamentos_user_id_idx"
  ON "orcamento_compartilhamentos"("user_id");

ALTER TABLE "orcamento_compartilhamentos" DROP CONSTRAINT IF EXISTS "orcamento_compartilhamentos_ciclo_id_fkey";
ALTER TABLE "orcamento_compartilhamentos"
  ADD CONSTRAINT "orcamento_compartilhamentos_ciclo_id_fkey"
  FOREIGN KEY ("ciclo_id") REFERENCES "orcamento_ciclos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orcamento_compartilhamentos" DROP CONSTRAINT IF EXISTS "orcamento_compartilhamentos_user_id_fkey";
ALTER TABLE "orcamento_compartilhamentos"
  ADD CONSTRAINT "orcamento_compartilhamentos_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
