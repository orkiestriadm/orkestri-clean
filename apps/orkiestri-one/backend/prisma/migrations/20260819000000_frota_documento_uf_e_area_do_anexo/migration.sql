-- CRLV: UF de registro no documento, e onde o anexo mora.
--
-- `uf` e anulavel de proposito: os documentos ja cadastrados nao tem estado, e
-- inventar um mudaria a regra de vencimento de registro que ninguem revisou.
--
-- `area` nasce com "uploads" para preservar os anexos ja gravados em
-- /app/uploads. So o CRLV, daqui pra frente, nasce em "secure" -- ele traz
-- CPF/CNPJ do proprietario, chassi e RENAVAM.
ALTER TABLE "documentos_veiculo" ADD COLUMN IF NOT EXISTS "uf" TEXT;
ALTER TABLE "documento_anexos"  ADD COLUMN IF NOT EXISTS "area" TEXT NOT NULL DEFAULT 'uploads';
