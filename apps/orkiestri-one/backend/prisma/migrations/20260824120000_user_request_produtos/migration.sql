-- Produtos do Orkiestri One escolhidos na landing page ao solicitar demonstração.
-- Aditivo e com default: as solicitações já existentes ganham um array vazio,
-- sem NOT NULL sem default nem FK — seguro mesmo com histórico divergente.
ALTER TABLE "user_requests" ADD COLUMN "produtos" TEXT[] NOT NULL DEFAULT '{}';
