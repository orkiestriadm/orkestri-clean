-- Compartilhamento de orçamento POR CENTRO DE CUSTO
--
-- Antes, compartilhar um ciclo dava acesso ao ciclo inteiro. Agora dá para
-- compartilhar um centro de custo específico dele, e com papel (editor ou
-- leitor) em vez de acesso único.
--
-- Resgatado de homologação, onde já estava no ar. Ver
-- docs/architecture/CONVERGENCIA_AMBIENTES.md.
--
-- IDEMPOTENTE: em homologação isto já existe.
--
-- ATENÇÃO à mudança da unique. Ela sai de (ciclo, user) e vai para
-- (ciclo, user, centro_custo). No Postgres, NULLs são distintos numa unique,
-- então (ciclo, user, NULL) pode repetir — ou seja, a chave nova NÃO impede
-- dois compartilhamentos do ciclo inteiro para a mesma pessoa, coisa que a
-- antiga impedia. É o preço de permitir vários centros de custo por pessoa;
-- quem cria o compartilhamento é que precisa barrar a duplicata.

-- AlterTable
ALTER TABLE "orcamento_compartilhamentos" ADD COLUMN IF NOT EXISTS "centro_custo_id" TEXT;
ALTER TABLE "orcamento_compartilhamentos" ADD COLUMN IF NOT EXISTS "papel" TEXT NOT NULL DEFAULT 'editor';

-- DropIndex
DROP INDEX IF EXISTS "orcamento_compartilhamentos_user_id_idx";
DROP INDEX IF EXISTS "orcamento_compartilhamentos_ciclo_id_user_id_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "orcamento_compartilhamentos_ciclo_id_user_id_centro_custo_i_key"
  ON "orcamento_compartilhamentos"("ciclo_id", "user_id", "centro_custo_id");

-- AddForeignKey
--
-- A coluna nasce NULL, então não há linha órfã para a validação rejeitar. O
-- DO/IF cobre o caso de a constraint já existir em homologação.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orcamento_compartilhamentos_centro_custo_id_fkey') THEN
    ALTER TABLE "orcamento_compartilhamentos"
      ADD CONSTRAINT "orcamento_compartilhamentos_centro_custo_id_fkey"
      FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
