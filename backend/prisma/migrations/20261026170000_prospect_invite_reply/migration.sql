ALTER TABLE "ProspectMessage"
  ADD COLUMN "instancia" TEXT,
  ADD COLUMN "conviteTelefone" TEXT,
  ADD COLUMN "conviteEstado" TEXT,
  ADD COLUMN "conviteRespondidoEm" TIMESTAMP(3);
CREATE INDEX "ProspectMessage_conviteTelefone_instancia_conviteEstado_idx"
ON "ProspectMessage"("conviteTelefone", "instancia", "conviteEstado");
