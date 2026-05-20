-- AlterTable: chamados (capacity forecasting)
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "horas_estimadas" DOUBLE PRECISION;

-- AlterTable: tasks (capacity forecasting)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "horas_estimadas" DOUBLE PRECISION;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "data_inicio"     TIMESTAMP(3);
