-- Renovação pelo WhatsApp, do teste e da mensalidade (R$ 27/mês): quando saiu o
-- último aviso de vencimento, o que a pessoa respondeu (RENOVOU / RECUSOU) e até
-- quando vale o mês pago.
--
-- Aditiva: 4 colunas NULÁVEIS em users, sem default — não reescreve a tabela nem
-- revalida FKs (a base tem linhas órfãs sob constraints NOT VALID). Sem backfill:
-- quem já foi efetivado à mão fica sem `assinatura_valida_ate` e, por isso, fora
-- do ciclo mensal (não recebe aviso nem é bloqueado); trial que já está no
-- último dia recebe o aviso na próxima rodada do agendador.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assinatura_valida_ate" TIMESTAMP(3),
ADD COLUMN     "trial_lembrete_em" TIMESTAMP(3),
ADD COLUMN     "trial_renovacao_resposta" TEXT,
ADD COLUMN     "trial_renovacao_resposta_em" TIMESTAMP(3);
