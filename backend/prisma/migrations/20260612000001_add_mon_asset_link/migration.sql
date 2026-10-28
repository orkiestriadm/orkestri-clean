-- Adiciona campo link (URL externa) ao mon_asset.
-- Usado pra abrir interface web do equipamento (camera, switch, NVR) em nova aba via duplo-clique.
ALTER TABLE "mon_asset" ADD COLUMN "link" TEXT;
