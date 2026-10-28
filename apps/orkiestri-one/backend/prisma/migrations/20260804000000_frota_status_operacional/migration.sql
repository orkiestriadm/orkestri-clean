-- ============================================================================
-- Frotas — status operacional e farol de disponibilidade
--
-- A planilha FORFT_0005 controla a frota com três estados, não dois:
--   Operando (verde) · Operando com Avaria (amarelo) · Parado (vermelho)
--
-- O sistema só sabia representar dois: `veiculos.status` diz "ativo" ou
-- "manutencao". Faltava o estado do meio — o veículo que roda, mas carrega um
-- defeito aberto. Na frota real de hoje esse é o estado de ~23% dos veículos,
-- então tratá-lo como "ativo" esconde risco e tratá-lo como "parado" derruba a
-- disponibilidade artificialmente.
--
-- DECISÃO CENTRAL: o farol NÃO é um campo. É derivado das OS abertas, e o que
-- decide a cor é `imobiliza` — se aquela OS tira ou não o veículo de operação.
-- Guardar o farol como coluna exigiria um job diário reescrevendo a frota
-- inteira (é o que a planilha faz: 12.374 linhas para 130 dias) e passaria a
-- mentir assim que alguém corrigisse a data de uma OS retroativamente.
-- Derivando, o histórico de disponibilidade sai das próprias janelas de OS.
--
-- Migration puramente aditiva: só ADD COLUMN, todas nullable ou com DEFAULT.
-- Nenhuma linha existente é reescrita e nenhuma constraint nova é validada
-- contra dado legado.
-- ============================================================================

-- ── Apelido operacional do veículo ──────────────────────────────────────────
-- GL1, GP-2, TR04, IT08: como a operação chama o veículo. `codigo` já existe,
-- mas é o patrimônio interno (auto-gerado FRT-00001) e tem unique por org —
-- reaproveitá-lo para o apelido quebraria cadastros já existentes.
ALTER TABLE "veiculos" ADD COLUMN IF NOT EXISTS "identificacao" TEXT;

-- ── Campos de acompanhamento da OS ──────────────────────────────────────────
-- DEFAULT true preserva a leitura anterior: antes desta migration, toda OS
-- aberta era tratada como veículo indisponível pelo relatório de
-- disponibilidade. As OS históricas continuam contando exatamente igual.
ALTER TABLE "manutencoes_veiculo" ADD COLUMN IF NOT EXISTS "imobiliza" BOOLEAN NOT NULL DEFAULT true;

-- Onde o veículo está enquanto a OS corre (oficina, base, pátio).
ALTER TABLE "manutencoes_veiculo" ADD COLUMN IF NOT EXISTS "localizacao" TEXT;

-- Previsão de liberação prometida pela oficina. Convive com `data_fechamento`
-- (a realizada): as duas juntas medem atraso de fornecedor.
ALTER TABLE "manutencoes_veiculo" ADD COLUMN IF NOT EXISTS "previsao_liberacao" TIMESTAMP(3);

-- Índice para o farol: a consulta quente é "OS abertas desta organização".
CREATE INDEX IF NOT EXISTS "manutencoes_veiculo_org_status_imobiliza_idx"
  ON "manutencoes_veiculo" ("organization_id", "status", "imobiliza");
