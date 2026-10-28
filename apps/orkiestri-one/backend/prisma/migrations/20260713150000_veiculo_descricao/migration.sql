-- Campo Descrição no veículo.
ALTER TABLE "veiculos" ADD COLUMN IF NOT EXISTS "descricao" TEXT;
