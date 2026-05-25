-- ─────────────────────────────────────────────────────────────────────────────
-- Workflow: rastreio de lembretes e escalonamento automatico
-- Adiciona 2 colunas em workflow_requests:
--   ultimo_lembrete_em: timestamp do ultimo lembrete enviado (NULL = nenhum)
--   escalado_em       : timestamp quando foi escalado automaticamente (NULL = nao)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "workflow_requests" ADD COLUMN IF NOT EXISTS "ultimo_lembrete_em" TIMESTAMP;
ALTER TABLE "workflow_requests" ADD COLUMN IF NOT EXISTS "escalado_em"        TIMESTAMP;

CREATE INDEX IF NOT EXISTS "workflow_requests_pendentes_idx"
  ON "workflow_requests" ("status", "criado_em")
  WHERE "status" = 'PENDENTE';
