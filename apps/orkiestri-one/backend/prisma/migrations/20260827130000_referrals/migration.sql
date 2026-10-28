-- Efetivação (assinatura) marcada à mão no painel de Indicações.
ALTER TABLE "users" ADD COLUMN "assinatura_em" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "assinatura_valor" INTEGER;

-- Indicações (referral) — MVP manual.
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "codigo_usado" TEXT NOT NULL,
    "indicador_user_id" TEXT NOT NULL,
    "indicado_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "efetivado_em" TIMESTAMP(3),
    "assinatura_valor" INTEGER,
    "comissao_valor" INTEGER,
    "comissao_status" TEXT,
    "comissao_paga_em" TIMESTAMP(3),
    "notas" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referrals_indicado_user_id_key" ON "referrals"("indicado_user_id");
CREATE INDEX "referrals_indicador_user_id_idx" ON "referrals"("indicador_user_id");
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

ALTER TABLE "referrals" ADD CONSTRAINT "referrals_indicador_user_id_fkey" FOREIGN KEY ("indicador_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_indicado_user_id_fkey" FOREIGN KEY ("indicado_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
