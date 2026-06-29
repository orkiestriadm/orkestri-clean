-- Abastecimento: custo por km (calculado entre abastecimentos). Idempotente.
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS custo_km DOUBLE PRECISION;
