-- Sprint 1.4: SLA Engine — rules table + chamados SLA tracking fields

CREATE TABLE IF NOT EXISTS sla_regras (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  categoria TEXT,
  prazo_resposta_h INT NOT NULL DEFAULT 4,
  prazo_resolucao_h INT NOT NULL DEFAULT 24,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prioridade, categoria)
);

ALTER TABLE chamados ADD COLUMN IF NOT EXISTS sla_regra_id TEXT;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS sla_resposta_at TIMESTAMPTZ;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS sla_resolucao_at TIMESTAMPTZ;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS primeira_resposta_em TIMESTAMPTZ;

ALTER TABLE chamados
  ADD CONSTRAINT fk_chamado_sla_regra
  FOREIGN KEY (sla_regra_id) REFERENCES sla_regras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chamados_sla_resolucao ON chamados(sla_resolucao_at) WHERE sla_resolucao_at IS NOT NULL;

-- Default SLA rules for all priorities
INSERT INTO sla_regras (id, nome, prioridade, prazo_resposta_h, prazo_resolucao_h)
VALUES
  (gen_random_uuid(), 'SLA Baixa',    'baixa',   8,  72),
  (gen_random_uuid(), 'SLA Media',    'media',   4,  24),
  (gen_random_uuid(), 'SLA Alta',     'alta',    2,   8),
  (gen_random_uuid(), 'SLA Critica',  'critica', 1,   4)
ON CONFLICT (prioridade, categoria) DO NOTHING;
