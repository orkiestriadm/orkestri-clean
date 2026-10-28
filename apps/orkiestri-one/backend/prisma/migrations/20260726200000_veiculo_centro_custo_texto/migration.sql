-- Corrige drift: schema.prisma declara Veiculo.centroCusto (texto) desde a
-- refatoração da Frota, mas nenhuma migration criou a coluna. Sem ela, o
-- Prisma Client falha em QUALQUER consulta de veículo (seleciona todos os
-- escalares), deixando o módulo Frota inoperante.
-- A coluna legada centro_custo_id é preservada para não quebrar dados antigos.
ALTER TABLE "veiculos" ADD COLUMN IF NOT EXISTS "centro_custo" TEXT;

-- Mesmo drift em reservas_veiculo (ReservaVeiculo.centroCusto).
ALTER TABLE "reservas_veiculo" ADD COLUMN IF NOT EXISTS "centro_custo" TEXT;
