-- CreateTable: contas_pagar (módulo Financeiro - Contas a Pagar)
CREATE TABLE "contas_pagar" (
    "id"                      TEXT          NOT NULL,
    "organization_id"         TEXT          NOT NULL,
    "fornecedor_codigo"       TEXT,
    "fornecedor_nome"         TEXT          NOT NULL,
    "prefixo"                 TEXT,
    "numero"                  TEXT          NOT NULL,
    "parcela"                 TEXT,
    "tipo"                    TEXT          NOT NULL,
    "natureza"                TEXT,
    "data_emissao"            TIMESTAMP(3),
    "data_vencto"             TIMESTAMP(3),
    "data_vencto_real"        TIMESTAMP(3),
    "data_pagamento"          TIMESTAMP(3),
    "valor_original"          DECIMAL(15,2),
    "valor_vencido_nominal"   DECIMAL(15,2),
    "valor_vencido_corrigido" DECIMAL(15,2),
    "valor_a_vencer_nominal"  DECIMAL(15,2),
    "valor_juros"             DECIMAL(15,2),
    "valor_pago"              DECIMAL(15,2),
    "portador"                TEXT,
    "dias_atraso"             INTEGER,
    "historico"               TEXT,
    "classe_valor"            TEXT,
    "observacao"              TEXT,
    "pedido"                  TEXT,
    "cta_contab"              TEXT,
    "centro_custo"            TEXT,
    "criado_em"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importado_em"            TIMESTAMP(3),

    CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contas_pagar_organization_id_idx"              ON "contas_pagar"("organization_id");
CREATE INDEX "contas_pagar_organization_id_data_vencto_real" ON "contas_pagar"("organization_id", "data_vencto_real");
CREATE INDEX "contas_pagar_organization_id_fornecedor_nome"  ON "contas_pagar"("organization_id", "fornecedor_nome");

ALTER TABLE "contas_pagar"
    ADD CONSTRAINT "contas_pagar_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
