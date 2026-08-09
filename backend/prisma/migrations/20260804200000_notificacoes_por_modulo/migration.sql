-- ============================================================================
-- Notificações por módulo, outbox e verificação de número
--
-- PROBLEMA: não existia "uma" regra de destinatário — existiam três, e nenhuma
-- olhava para módulo:
--   · Frota    → TODOS os masters da organização (hardcoded no scheduler)
--   · Orçamento→ lista fixa em `alerta_regras.destinatarios`
--   · Chamado  → o atendente atribuído
-- E a pessoa tinha um único interruptor global (`whatsapp_alertas`). Resultado:
-- quem cuida de Frotas recebia alerta de Projetos.
--
-- DECISÃO CENTRAL: negação por padrão. A ausência de linha em
-- `notificacao_preferencias` significa NÃO RECEBER. Numa regra de permissão o
-- modo seguro de falhar é calar, não vazar. A contrapartida — ninguém recebe
-- nada até o master configurar — foi decidida explicitamente.
--
-- Migration puramente aditiva: só CREATE TABLE e ADD COLUMN com default.
-- Nenhuma linha existente é reescrita, nenhuma constraint é validada contra
-- dado legado (a base de produção tem histórico de FK quebrada).
-- ============================================================================

-- ── Preferência: uma pessoa, um módulo ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "notificacao_preferencias" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "user_id"           TEXT NOT NULL,
  -- Id do produto no menu (fleet, projects, service...), igual ao NAV do
  -- frontend, para a tela de configuração falar a mesma língua que o menu.
  "modulo"            TEXT NOT NULL,
  "sistema"           BOOLEAN NOT NULL DEFAULT true,
  "whatsapp"          BOOLEAN NOT NULL DEFAULT false,
  "email"             BOOLEAN NOT NULL DEFAULT false,
  -- info | aviso | critico — recebe deste nível para cima.
  "severidade_min"    TEXT NOT NULL DEFAULT 'info',
  "criado_em"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  CONSTRAINT "notificacao_preferencias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notificacao_preferencias_user_id_modulo_key"
  ON "notificacao_preferencias" ("user_id", "modulo");
CREATE INDEX IF NOT EXISTS "notificacao_preferencias_organization_id_modulo_idx"
  ON "notificacao_preferencias" ("organization_id", "modulo");

-- ── Outbox + trilha de envio ────────────────────────────────────────────────
-- Antes não havia registro nenhum: todo `sendMessage()` era chamado com
-- `.catch(() => {})`, então falha sumia em silêncio e não havia como responder
-- "essa mensagem foi enviada?". Também não havia retentativa.
CREATE TABLE IF NOT EXISTS "notificacao_envios" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id"         TEXT,
  "canal"           TEXT NOT NULL,
  -- Telefone/e-mail no momento do envio: o cadastro muda e a trilha precisa
  -- dizer para onde FOI, não para onde iria hoje.
  "destino"         TEXT NOT NULL,
  "modulo"          TEXT NOT NULL,
  "tipo"            TEXT NOT NULL,
  "severidade"      TEXT NOT NULL DEFAULT 'info',
  "titulo"          TEXT NOT NULL,
  "mensagem"        TEXT NOT NULL,
  -- pendente | enviada | falhou | descartada | agrupada
  "status"          TEXT NOT NULL DEFAULT 'pendente',
  "tentativas"      INTEGER NOT NULL DEFAULT 0,
  "ultimo_erro"     TEXT,
  "agendado_para"   TIMESTAMP(3),
  "enviado_em"      TIMESTAMP(3),
  "chave"           TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notificacao_envios_pkey" PRIMARY KEY ("id")
);

-- Índice da consulta quente do worker: o que está pendente e já pode sair.
CREATE INDEX IF NOT EXISTS "notificacao_envios_status_agendado_para_idx"
  ON "notificacao_envios" ("status", "agendado_para");
CREATE INDEX IF NOT EXISTS "notificacao_envios_organization_id_criado_em_idx"
  ON "notificacao_envios" ("organization_id", "criado_em");
CREATE INDEX IF NOT EXISTS "notificacao_envios_user_id_criado_em_idx"
  ON "notificacao_envios" ("user_id", "criado_em");
-- De-duplicação: a mesma chave não é enfileirada duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS "notificacao_envios_organization_id_chave_key"
  ON "notificacao_envios" ("organization_id", "chave");

-- ── Silêncio e vazão por organização ────────────────────────────────────────
-- A vazão não é conforto: o WhatsApp bane conta que dispara em rajada, e o
-- sistema mandaria dezenas de mensagens seguidas se muitos documentos
-- vencessem no mesmo dia.
CREATE TABLE IF NOT EXISTS "org_notificacao_configs" (
  "id"                      TEXT NOT NULL,
  "organization_id"         TEXT NOT NULL,
  "silencio_inicio"         INTEGER NOT NULL DEFAULT 21,
  "silencio_fim"            INTEGER NOT NULL DEFAULT 7,
  "silencio_ignora_critico" BOOLEAN NOT NULL DEFAULT true,
  "max_por_minuto"          INTEGER NOT NULL DEFAULT 12,
  "agrupar_por_modulo"      BOOLEAN NOT NULL DEFAULT true,
  "atualizado_em"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_notificacao_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_notificacao_configs_organization_id_key"
  ON "org_notificacao_configs" ("organization_id");

-- ── Verificação do número ───────────────────────────────────────────────────
-- Hoje o telefone é digitado à mão e usado direto. Um dígito errado manda
-- alerta interno da empresa para um desconhecido, e ninguém descobre porque
-- não existe retorno de entrega.
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "whatsapp_verificado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "whatsapp_codigo" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "whatsapp_codigo_expira" TIMESTAMP(3);
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "whatsapp_tentativas" INTEGER NOT NULL DEFAULT 0;

-- As FKs ficam de fora de propósito. O padrão do projeto para tabelas novas de
-- notificação é resolver o vínculo na aplicação: a base de produção já derrubou
-- a API por 20 minutos num deploy anterior por causa de linha órfã encontrada
-- na validação de constraint.
