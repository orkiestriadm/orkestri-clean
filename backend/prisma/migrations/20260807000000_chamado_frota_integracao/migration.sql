-- Integração chamado <-> frota
--
-- Um chamado pode apontar para um veículo (e aí pode virar OS de manutenção),
-- e uma OS pode ter nascido de um chamado. Também registra QUEM atribuiu o
-- chamado, que antes só existia como evento de histórico.
--
-- POR QUE ESTA MIGRATION É ESCRITA AGORA, e não copiada:
--
-- Estas colunas já existem no banco de HOMOLOGAÇÃO, mas nenhuma migration as
-- cria — foram aplicadas por `db push` ou à mão. Produção, que é montada pelas
-- migrations, não as tem. Sem esta migration, o código que as usa quebraria em
-- produção com "column does not exist".
--
-- IDEMPOTENTE de propósito: em homologação as colunas e talvez as constraints
-- já estão lá, e um ADD COLUMN cru abortaria o boot do container.

-- AlterTable
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "atribuido_por_id" TEXT;
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "veiculo_id" TEXT;

-- AlterTable
ALTER TABLE "manutencoes_veiculo" ADD COLUMN IF NOT EXISTS "chamado_id" TEXT;

-- AddForeignKey
--
-- Todas as colunas nascem NULL, então não há linha órfã para a validação
-- rejeitar. O DO/IF existe apenas para o caso de a constraint já ter sido
-- criada em homologação junto com a coluna.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_atribuido_por_id_fkey') THEN
    ALTER TABLE "chamados"
      ADD CONSTRAINT "chamados_atribuido_por_id_fkey"
      FOREIGN KEY ("atribuido_por_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamados_veiculo_id_fkey') THEN
    ALTER TABLE "chamados"
      ADD CONSTRAINT "chamados_veiculo_id_fkey"
      FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manutencoes_veiculo_chamado_id_fkey') THEN
    ALTER TABLE "manutencoes_veiculo"
      ADD CONSTRAINT "manutencoes_veiculo_chamado_id_fkey"
      FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chamados_veiculo_id_idx" ON "chamados"("veiculo_id");
CREATE INDEX IF NOT EXISTS "manutencoes_veiculo_chamado_id_idx" ON "manutencoes_veiculo"("chamado_id");
