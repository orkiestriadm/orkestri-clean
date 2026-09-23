-- Veiculo excluido na tela e SOFT delete: a linha fica, so ganha deleted_at.
-- Os indices unique de placa e codigo nao tinham filtro, entao a placa de um
-- veiculo "excluido" continuava ocupada e o recadastro batia em P2002 --
-- que o frota.module.ts traduz para "Registro duplicado", sem dizer que o
-- conflito e com um registro invisivel na lista.
--
-- Aconteceu em 22/09/2026, no primeiro dia de uso da empresa: 59 placas
-- importadas foram excluidas e nenhuma delas aceitava cadastro de novo.
--
-- O indice parcial mantem a protecao real (duas linhas ATIVAS com a mesma
-- placa continuam recusadas) e solta a placa quando o veiculo e excluido.
--
-- Prisma nao expressa indice unique parcial: o schema.prisma segue com
-- @@unique([organizationId, placa]) e o banco fica com o predicado. A
-- divergencia e proposital -- ver o comentario no model Veiculo.

DROP INDEX IF EXISTS "uq_veiculos_org_placa";
CREATE UNIQUE INDEX "uq_veiculos_org_placa"
  ON "veiculos" ("organization_id", "placa") WHERE "deleted_at" IS NULL;

DROP INDEX IF EXISTS "uq_veiculos_org_codigo";
CREATE UNIQUE INDEX "uq_veiculos_org_codigo"
  ON "veiculos" ("organization_id", "codigo") WHERE "deleted_at" IS NULL;

-- Mesma armadilha em categorias_veiculo: excluir uma categoria e recriar com o
-- mesmo nome batia no unique. Reproduzido em transacao no dia 22/09/2026.
DROP INDEX IF EXISTS "uq_categorias_veiculo_org_nome";
CREATE UNIQUE INDEX "uq_categorias_veiculo_org_nome"
  ON "categorias_veiculo" ("organization_id", "nome") WHERE "deleted_at" IS NULL;

-- NAO coberto aqui, de proposito: "veiculos_ativo_id_key" ON (ativo_id) tambem
-- e total, entao um veiculo excluido que tinha ativo vinculado segura aquele
-- ativo. Hoje a tabela "ativos" esta vazia e o campo e sempre NULL (e NULL nao
-- conflita em unique), por isso nao urge. Mexer ali toca o modulo de Ativos.
