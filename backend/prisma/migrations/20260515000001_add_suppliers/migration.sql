-- CreateTable: suppliers
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "razao_social" TEXT NOT NULL,
  "nome_fantasia" TEXT,
  "cnpj" TEXT,
  "inscricao_estadual" TEXT,
  "inscricao_municipal" TEXT,
  "tipo_empresa" TEXT NOT NULL DEFAULT 'LTDA',
  "categorias" TEXT[] NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'ativo',
  "contato_nome" TEXT,
  "contato_cargo" TEXT,
  "contato_telefone" TEXT,
  "contato_telefone2" TEXT,
  "contato_whatsapp" TEXT,
  "contato_email" TEXT,
  "contato_email_financeiro" TEXT,
  "site" TEXT,
  "cep" TEXT,
  "logradouro" TEXT,
  "numero" TEXT,
  "complemento" TEXT,
  "bairro" TEXT,
  "cidade" TEXT,
  "estado" TEXT,
  "pais" TEXT DEFAULT 'Brasil',
  "banco" TEXT,
  "agencia" TEXT,
  "conta" TEXT,
  "tipo_conta" TEXT,
  "pix_chave" TEXT,
  "condicao_pagamento" TEXT,
  "prazo_medio" INTEGER,
  "moeda" TEXT NOT NULL DEFAULT 'BRL',
  "observacoes" TEXT,
  "criado_por_id" TEXT,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_cnpj_key" ON "suppliers"("cnpj") WHERE "cnpj" IS NOT NULL;

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: supplier_contacts
CREATE TABLE IF NOT EXISTS "supplier_contacts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "supplier_id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cargo" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "principal" BOOLEAN NOT NULL DEFAULT false,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: supplier_documents
CREATE TABLE IF NOT EXISTS "supplier_documents" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "supplier_id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" TEXT,
  "url" TEXT NOT NULL,
  "tamanho" INTEGER,
  "criado_por_id" TEXT,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: supplier_history
CREATE TABLE IF NOT EXISTS "supplier_history" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "supplier_id" TEXT NOT NULL,
  "usuario_id" TEXT,
  "acao" TEXT NOT NULL,
  "detalhes" JSONB,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "supplier_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_history" ADD CONSTRAINT "supplier_history_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_history" ADD CONSTRAINT "supplier_history_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add supplier_id to itens_orcamento
ALTER TABLE "itens_orcamento" ADD COLUMN IF NOT EXISTS "supplier_id" TEXT;

ALTER TABLE "itens_orcamento" ADD CONSTRAINT "itens_orcamento_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
