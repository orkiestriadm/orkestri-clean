-- Vínculo do WhatsApp por LID (o WhatsApp esconde o telefone de quem envia).
ALTER TABLE "user_profiles" ADD COLUMN "whatsapp_lid" TEXT;
CREATE UNIQUE INDEX "user_profiles_whatsapp_lid_key" ON "user_profiles"("whatsapp_lid");
