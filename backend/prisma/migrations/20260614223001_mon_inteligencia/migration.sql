-- Monitoramento: inteligencia operacional (dependencia + baseline de latencia).
-- Supressao por dependencia e anomalia sao derivadas em read-time (sem coluna).
ALTER TABLE "mon_asset" ADD COLUMN "depende_de_id" TEXT;
ALTER TABLE "mon_asset" ADD COLUMN "latencia_base_ms" DOUBLE PRECISION;
ALTER TABLE "mon_asset"
  ADD CONSTRAINT "mon_asset_depende_de_id_fkey"
  FOREIGN KEY ("depende_de_id") REFERENCES "mon_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "mon_asset_depende_de_id_idx" ON "mon_asset"("depende_de_id");
