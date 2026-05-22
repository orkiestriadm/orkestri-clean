-- AddColumns: organizations — cadastro completo da empresa-cliente
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "cnpj"            TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "nome_fantasia"   TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "segmento"        TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "site"            TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "email_contato"   TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "telefone"        TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "responsavel_nome" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "cep"             TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "endereco"        TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "cidade"          TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "estado"          TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "observacoes"     TEXT;
