-- Plano anual: R$ 119,90 por doze meses, ao lado da mensalidade de R$ 11,90.
--
-- Até aqui toda cobrança valia um mês, e isso estava implícito em dois lugares:
-- `proximaValidade` somava sempre um mês, e o preapproval do Mercado Pago
-- nascia com `frequency: 1, frequency_type: "months"`. O plano passa a ser um
-- DADO da cobrança, em vez de uma suposição do código.
--
-- Aditiva e sem UPDATE em dado existente. As duas colunas entram NOT NULL com
-- DEFAULT 'MENSAL', então toda linha que já está no banco continua significando
-- exatamente o que significava antes desta migration — que é o que permite
-- aplicá-la com o sistema no ar.
--
-- O default também é a rede de segurança do código: `planoDe()` lê qualquer
-- coisa que não seja 'ANUAL' como mensal, de modo que uma linha antiga, um
-- valor nulo vindo de um banco de teste ou um enum futuro desconhecido nunca
-- concedem doze meses por engano. O erro possível é conceder um mês a quem
-- pagou um ano — visível, reclamável e corrigível — e nunca o contrário.

-- AlterTable
ALTER TABLE "assinatura_cobrancas" ADD COLUMN     "plano" TEXT NOT NULL DEFAULT 'MENSAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assinatura_plano" TEXT NOT NULL DEFAULT 'MENSAL';
