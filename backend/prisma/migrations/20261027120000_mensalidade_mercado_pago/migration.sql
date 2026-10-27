-- Mensalidade de R$ 11,90 cobrada no Mercado Pago.
--
-- Até aqui o acesso pago era concedido na palavra da pessoa ("1" no WhatsApp) e
-- o pagamento era combinado à mão depois. Agora cada mês nasce como COBRANÇA e
-- só vira acesso quando o Mercado Pago confirma.
--
-- Aditiva de ponta a ponta: duas tabelas novas e duas colunas NULÁVEIS/com
-- default em `users`. Nada de UPDATE em dado existente — quem já tem
-- `assinatura_valida_ate` mantém a data e o preço novo só vale da próxima
-- renovação; quem foi efetivado antes da mensalidade existir continua fora do
-- ciclo, como já estava.
--
-- As FKs entram com ON DELETE CASCADE e referenciam `users(id)`, que é PK — não
-- há risco de órfão aqui, ao contrário das constraints NOT VALID que a base
-- carrega em outras tabelas.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assinatura_preapproval_id" TEXT,
ADD COLUMN     "assinatura_renovacao_auto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "assinatura_cobrancas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "ciclo" TEXT NOT NULL,
    "meio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "mp_payment_id" TEXT,
    "mp_preapproval_id" TEXT,
    "pix_qr_code" TEXT,
    "checkout_url" TEXT,
    "expira_em" TIMESTAMP(3),
    "pago_em" TIMESTAMP(3),
    "validade_concedida_ate" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinatura_cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinatura_avisos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "limite" TIMESTAMP(3) NOT NULL,
    "marco" INTEGER NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinatura_avisos_pkey" PRIMARY KEY ("id")
);

-- O UNIQUE do pagamento é o que faz webhook repetido do Mercado Pago ser
-- inofensivo: a mesma notificação não cria uma segunda cobrança.
-- CreateIndex
CREATE UNIQUE INDEX "assinatura_cobrancas_mp_payment_id_key" ON "assinatura_cobrancas"("mp_payment_id");

-- CreateIndex
CREATE INDEX "assinatura_cobrancas_user_id_status_idx" ON "assinatura_cobrancas"("user_id", "status");

-- CreateIndex
CREATE INDEX "assinatura_cobrancas_status_idx" ON "assinatura_cobrancas"("status");

-- CreateIndex
CREATE INDEX "assinatura_cobrancas_mp_preapproval_id_idx" ON "assinatura_cobrancas"("mp_preapproval_id");

-- CreateIndex
CREATE INDEX "assinatura_avisos_user_id_idx" ON "assinatura_avisos"("user_id");

-- Esta UNIQUE é a trava do aviso: duas rodadas do agendador na mesma hora
-- disputam o INSERT e só uma ganha. É o banco que decide, não o código.
-- CreateIndex
CREATE UNIQUE INDEX "assinatura_avisos_user_id_limite_marco_key" ON "assinatura_avisos"("user_id", "limite", "marco");

-- AddForeignKey
ALTER TABLE "assinatura_cobrancas" ADD CONSTRAINT "assinatura_cobrancas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_avisos" ADD CONSTRAINT "assinatura_avisos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
