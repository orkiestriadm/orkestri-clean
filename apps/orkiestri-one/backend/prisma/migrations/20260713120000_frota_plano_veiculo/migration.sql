-- Plano de revisão pode ser vinculado a um veículo específico (senão, aplica por modelo).
ALTER TABLE "planos_revisao" ADD COLUMN IF NOT EXISTS "veiculo_id" TEXT;
CREATE INDEX IF NOT EXISTS "planos_revisao_veiculo_id_idx" ON "planos_revisao" ("veiculo_id");
