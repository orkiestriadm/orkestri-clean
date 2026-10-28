-- Adiciona coluna portal_token ao modelo Cliente
-- Necessaria porque o schema.prisma define `portalToken String? @unique @map("portal_token")`
-- mas nenhuma migration anterior cria a coluna no banco. Drift identificado em 2026-06-11
-- ao detectar que /api/clientes retornava 500 com erro "column clientes.portal_token does not exist".

ALTER TABLE "clientes" ADD COLUMN "portal_token" TEXT;

-- @unique no schema → indice unico
CREATE UNIQUE INDEX "clientes_portal_token_key" ON "clientes"("portal_token");
