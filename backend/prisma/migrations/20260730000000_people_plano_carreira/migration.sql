-- ============================================================================
-- Orkiestri People — plano de carreira
--
-- DECISÃO CENTRAL: a trilha ORDENA CARGOS DO CATÁLOGO. Não existe um segundo
-- eixo de "nível dentro do cargo".
--
-- A tentação era criar níveis internos (Analista I, II, III dentro do cargo
-- "Analista"), mas o catálogo de cargos já carrega o nível e a FAIXA SALARIAL
-- está amarrada ao cargo. Um segundo eixo criaria duas verdades sobre a mesma
-- pergunta — "que nível essa pessoa é?" — e a faixa não saberia a qual das duas
-- responder. Progredir na carreira, aqui, é passar a ocupar o próximo cargo da
-- trilha; e isso já move a faixa, o organograma e o histórico funcional juntos,
-- porque é o mesmo campo que sempre governou essas três coisas.
--
-- O QUE TORNA ISTO ÚTIL não é a trilha desenhada — é a PRONTIDÃO: dado o
-- degrau atual e os requisitos do próximo, o que a pessoa já cumpre e o que
-- falta. Trilha sem essa conta é organograma bonito em PDF; com ela, a
-- conversa de carreira tem pauta.
-- ============================================================================

-- ── Trilha ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "career_tracks" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "nome"             TEXT NOT NULL,
  "descricao"        TEXT,
  "ativo"            BOOLEAN NOT NULL DEFAULT true,
  "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"    TEXT,
  "atualizado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  CONSTRAINT "career_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "career_tracks_organization_id_nome_key"
  ON "career_tracks"("organization_id", "nome");

CREATE INDEX IF NOT EXISTS "career_tracks_organization_id_idx"
  ON "career_tracks"("organization_id");

-- ── Degrau ──────────────────────────────────────────────────────────────────
-- Um degrau é (trilha, cargo, posição na ordem). `meses_minimos` e
-- `nota_minima` ficam aqui e não na tabela de requisitos porque são singulares
-- por degrau: não existe "dois tempos mínimos".
CREATE TABLE IF NOT EXISTS "career_track_steps" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "track_id"        TEXT NOT NULL,
  "position_id"     TEXT NOT NULL,
  "ordem"           INTEGER NOT NULL,
  -- Tempo mínimo NO DEGRAU antes de poder progredir. Nulo = sem exigência de
  -- tempo, que é diferente de zero: zero seria uma regra dizendo "nenhum
  -- tempo", e nulo diz "esta trilha não usa tempo como critério".
  "meses_minimos"   INTEGER,
  -- Nota mínima na última avaliação finalizada. DECIMAL(3,2) acompanha a escala
  -- de `performance_reviews`.
  "nota_minima"     DECIMAL(3,2),
  "observacoes"     TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  CONSTRAINT "career_track_steps_pkey" PRIMARY KEY ("id")
);

-- Ordem única por trilha: dois degraus na mesma posição tornam "o próximo"
-- ambíguo, e é essa pergunta que a tela existe para responder.
CREATE UNIQUE INDEX IF NOT EXISTS "career_track_steps_track_ordem_key"
  ON "career_track_steps"("track_id", "ordem");

-- O mesmo cargo não aparece duas vezes na trilha: o degrau atual é descoberto
-- pelo cargo do colaborador, e repetição faria essa descoberta empatar.
CREATE UNIQUE INDEX IF NOT EXISTS "career_track_steps_track_position_key"
  ON "career_track_steps"("track_id", "position_id");

CREATE INDEX IF NOT EXISTS "career_track_steps_organization_id_idx"
  ON "career_track_steps"("organization_id");

CREATE INDEX IF NOT EXISTS "career_track_steps_position_id_idx"
  ON "career_track_steps"("position_id");

-- ── Requisito do degrau ─────────────────────────────────────────────────────
-- Três naturezas na mesma tabela, discriminadas por `tipo`:
--
--   competencia — skill do catálogo em nível mínimo. Verificável.
--   treinamento — curso concluído. Verificável.
--   manual      — texto livre ("liderar um projeto de ponta a ponta").
--
-- O texto livre existe porque a parte que mais importa numa promoção raramente
-- é automatizável, e um sistema que só aceita o que sabe medir empurra a
-- decisão real para fora dele. Mas ele NÃO é contado como atendido
-- automaticamente: aparece como conferência de quem decide.
CREATE TABLE IF NOT EXISTS "career_step_requirements" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "step_id"         TEXT NOT NULL,
  "tipo"            TEXT NOT NULL DEFAULT 'manual',
  "skill_id"        TEXT,
  -- junior | pleno | senior | especialista — mesma escala de collaborator_skills
  "nivel_minimo"    TEXT,
  "training_id"     TEXT,
  "descricao"       TEXT,
  -- Requisito não obrigatório é diferencial: conta a favor na prontidão sem
  -- travar a progressão.
  "obrigatorio"     BOOLEAN NOT NULL DEFAULT true,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  CONSTRAINT "career_step_requirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "career_step_requirements_step_id_idx"
  ON "career_step_requirements"("step_id");

CREATE INDEX IF NOT EXISTS "career_step_requirements_organization_id_idx"
  ON "career_step_requirements"("organization_id");

-- ── Trilha do colaborador ───────────────────────────────────────────────────
-- Opcional. Nulo significa "não definida", e nesse caso o serviço INFERE a
-- trilha pelo cargo atual — se o cargo aparece em exatamente uma trilha, é
-- aquela. Exigir o preenchimento obrigaria a uma migração de todo o quadro
-- antes de a primeira trilha existir, o que é a ordem inversa do uso real.
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "career_track_id" TEXT;

CREATE INDEX IF NOT EXISTS "collaborators_career_track_id_idx"
  ON "collaborators"("career_track_id");

-- ── Chaves estrangeiras ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_tracks_organization_id_fkey') THEN
    ALTER TABLE "career_tracks" ADD CONSTRAINT "career_tracks_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_track_steps_organization_id_fkey') THEN
    ALTER TABLE "career_track_steps" ADD CONSTRAINT "career_track_steps_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- CASCADE: apagar a trilha apaga os degraus. O degrau não tem vida própria —
  -- ele é a trilha.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_track_steps_track_id_fkey') THEN
    ALTER TABLE "career_track_steps" ADD CONSTRAINT "career_track_steps_track_id_fkey"
      FOREIGN KEY ("track_id") REFERENCES "career_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- RESTRICT: apagar um cargo que é degrau de trilha abriria um buraco no meio
  -- da progressão, e o "próximo degrau" de quem está abaixo passaria a apontar
  -- para o degrau errado, silenciosamente. Quem quer sumir com o cargo desfaz
  -- a trilha primeiro — decisão consciente, não efeito colateral.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_track_steps_position_id_fkey') THEN
    ALTER TABLE "career_track_steps" ADD CONSTRAINT "career_track_steps_position_id_fkey"
      FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_step_requirements_organization_id_fkey') THEN
    ALTER TABLE "career_step_requirements" ADD CONSTRAINT "career_step_requirements_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_step_requirements_step_id_fkey') THEN
    ALTER TABLE "career_step_requirements" ADD CONSTRAINT "career_step_requirements_step_id_fkey"
      FOREIGN KEY ("step_id") REFERENCES "career_track_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- CASCADE na competência e no curso: se o item do catálogo deixa de existir,
  -- o requisito que aponta para ele não tem mais o que exigir. Diferente do
  -- cargo, aqui não há buraco na progressão — só um critério a menos.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_step_requirements_skill_id_fkey') THEN
    ALTER TABLE "career_step_requirements" ADD CONSTRAINT "career_step_requirements_skill_id_fkey"
      FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'career_step_requirements_training_id_fkey') THEN
    ALTER TABLE "career_step_requirements" ADD CONSTRAINT "career_step_requirements_training_id_fkey"
      FOREIGN KEY ("training_id") REFERENCES "training_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- NOT VALID e SET NULL: a base de produção tem linha com FK quebrada apesar
  -- das constraints, e uma validação retroativa aqui derrubaria a subida da API
  -- como já aconteceu no deploy do People. `NOT VALID` vale para o que entrar
  -- de agora em diante, que é o que precisa estar correto.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborators_career_track_id_fkey') THEN
    ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_career_track_id_fkey"
      FOREIGN KEY ("career_track_id") REFERENCES "career_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE
      NOT VALID;
  END IF;
END $$;
