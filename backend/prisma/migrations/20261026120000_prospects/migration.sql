CREATE TABLE "ProspectLead" (
 "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "telefone" TEXT NOT NULL UNIQUE,
 "email" TEXT NOT NULL DEFAULT '', "empresa" TEXT NOT NULL DEFAULT '', "lista" TEXT NOT NULL,
 "etapa" TEXT NOT NULL DEFAULT 'NOVO', "observacoes" TEXT NOT NULL DEFAULT '',
 "bloqueado" BOOLEAN NOT NULL DEFAULT false, "proximoContato" TIMESTAMP(3),
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ProspectLead_etapa_lista_idx" ON "ProspectLead"("etapa", "lista");
CREATE TABLE "ProspectMessage" (
 "id" TEXT PRIMARY KEY, "leadId" TEXT NOT NULL REFERENCES "ProspectLead"("id"),
 "campanha" TEXT NOT NULL, "texto" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDENTE',
 "erro" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "enviadoEm" TIMESTAMP(3)
);
CREATE INDEX "ProspectMessage_status_criadoEm_idx" ON "ProspectMessage"("status", "criadoEm");
