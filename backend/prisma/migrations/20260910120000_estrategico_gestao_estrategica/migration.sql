-- Orkiestri Strategy — Gestão Estratégica
--
-- Migration puramente ADITIVA: 14 tabelas novas com prefixo estrategico_, nenhum
-- ALTER e nenhum DROP em tabela existente. As FKs apontam para organizations e
-- users, mas as tabelas nascem vazias — a validação da FK é instantânea e não
-- trava a API (ver docs/people/ sobre o deploy que travou).
--
-- Gerada com `prisma migrate diff` contra o schema anterior.

-- CreateTable
CREATE TABLE "estrategico_catalogos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT,
    "natureza" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estrategico_catalogos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_casos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'assunto',
    "grupo_id" TEXT,
    "objetivo_id" TEXT,
    "esfera_id" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'em_analise',
    "estagio_oportunidade" TEXT,
    "prioridade" TEXT NOT NULL DEFAULT 'media',
    "area_executiva_id" TEXT,
    "area_operacional_id" TEXT,
    "responsavel_executivo_id" TEXT,
    "responsavel_operacional_id" TEXT,
    "proxima_acao" TEXT,
    "proxima_acao_responsavel_id" TEXT,
    "proxima_acao_responsavel_nome" TEXT,
    "proxima_acao_prazo" DATE,
    "proxima_acao_prioridade" TEXT,
    "prazo_final" DATE,
    "ultima_movimentacao_em" DATE,
    "classificacao_financeira" TEXT,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "valor_pretendido" DECIMAL(18,2),
    "valor_solicitado" DECIMAL(18,2),
    "valor_em_analise" DECIMAL(18,2),
    "valor_reconhecido" DECIMAL(18,2),
    "valor_alcancado" DECIMAL(18,2),
    "valor_recebido" DECIMAL(18,2),
    "valor_reequilibrio" DECIMAL(18,2),
    "valor_em_risco" DECIMAL(18,2),
    "valor_potencial" DECIMAL(18,2),
    "valores_referencia_em" DATE,
    "probabilidade" INTEGER,
    "impacto" INTEGER,
    "risco_financeiro" INTEGER,
    "risco_juridico" INTEGER,
    "risco_regulatorio" INTEGER,
    "risco_operacional" INTEGER,
    "risco_prazo" INTEGER,
    "plano_mitigacao" TEXT,
    "farol_calculado" TEXT NOT NULL DEFAULT 'verde',
    "farol_motivos" JSONB NOT NULL DEFAULT '[]',
    "farol_calculado_em" TIMESTAMP(3),
    "farol_manual" TEXT,
    "farol_justificativa" TEXT,
    "status_original" TEXT,
    "andamentos_originais" TEXT,
    "importacao_chave" TEXT,
    "importacao_dados" JSONB,
    "revisar_importacao" BOOLEAN NOT NULL DEFAULT false,
    "encerrado_em" TIMESTAMP(3),
    "criado_por_id" TEXT,
    "atualizado_por_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estrategico_casos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_caso_areas" (
    "id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,

    CONSTRAINT "estrategico_caso_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_eventos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'andamento',
    "data_evento" DATE NOT NULL,
    "precisao_data" TEXT NOT NULL DEFAULT 'dia',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "decisao" TEXT,
    "proximo_passo" TEXT,
    "responsavel_id" TEXT,
    "autor_id" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "documento_id" TEXT,
    "reuniao_id" TEXT,
    "revisar" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estrategico_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_tarefas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavel_id" TEXT,
    "prazo" DATE,
    "prioridade" TEXT NOT NULL DEFAULT 'media',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "dependencia" TEXT,
    "conclusao" TEXT,
    "concluida_em" TIMESTAMP(3),
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "reuniao_id" TEXT,
    "chave_automacao" TEXT,
    "criado_por_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estrategico_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_dependencias" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "catalogo_id" TEXT,
    "organizacao" TEXT,
    "contato" TEXT,
    "descricao" TEXT,
    "desde" DATE,
    "resposta_esperada_em" DATE,
    "ultimo_follow_up_em" DATE,
    "proximo_follow_up_em" DATE,
    "resolvida_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estrategico_dependencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_documentos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'outro',
    "titulo" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "arquivo_ref" TEXT NOT NULL,
    "mime" TEXT,
    "tamanho" INTEGER,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "documento_origem_id" TEXT,
    "evento_id" TEXT,
    "tarefa_id" TEXT,
    "observacoes" TEXT,
    "criado_por_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estrategico_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_comentarios" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estrategico_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_valores_historico" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valor_anterior" DECIMAL(18,2),
    "valor_novo" DECIMAL(18,2),
    "referencia_em" DATE,
    "observacao" TEXT,
    "user_id" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'web',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estrategico_valores_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_historico" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT NOT NULL,
    "user_id" TEXT,
    "acao" TEXT NOT NULL,
    "campo" TEXT,
    "valor_anterior" TEXT,
    "valor_novo" TEXT,
    "descricao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'web',
    "ip" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estrategico_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_reunioes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data_reuniao" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planejada',
    "participantes" JSONB NOT NULL DEFAULT '[]',
    "pauta" JSONB NOT NULL DEFAULT '[]',
    "anotacoes" JSONB NOT NULL DEFAULT '{}',
    "ata" TEXT,
    "referencia_desde" TIMESTAMP(3),
    "reuniao_anterior_id" TEXT,
    "criado_por_id" TEXT,
    "iniciada_em" TIMESTAMP(3),
    "encerrada_em" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estrategico_reunioes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_decisoes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT,
    "reuniao_id" TEXT,
    "descricao" TEXT NOT NULL,
    "decidido_em" TIMESTAMP(3) NOT NULL,
    "registrado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estrategico_decisoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "dias_atencao_sem_movimento" INTEGER NOT NULL DEFAULT 30,
    "dias_critico_sem_movimento" INTEGER NOT NULL DEFAULT 90,
    "dias_atraso_critico" INTEGER NOT NULL DEFAULT 15,
    "dias_dependencia_atencao" INTEGER NOT NULL DEFAULT 30,
    "dias_follow_up" INTEGER NOT NULL DEFAULT 30,
    "antecedencias_aviso" INTEGER[] DEFAULT ARRAY[15, 7, 3, 0]::INTEGER[],
    "dias_escalonamento" INTEGER NOT NULL DEFAULT 5,
    "limiar_valor_relevante" DECIMAL(18,2),
    "automacoes_ativas" BOOLEAN NOT NULL DEFAULT true,
    "notificar_email" BOOLEAN NOT NULL DEFAULT false,
    "gestores_escalonamento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "atualizado_por_id" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estrategico_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estrategico_alerta_envios" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "caso_id" TEXT,
    "tarefa_id" TEXT,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "destinatario_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estrategico_alerta_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estrategico_catalogos_organization_id_tipo_ativo_idx" ON "estrategico_catalogos"("organization_id", "tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "estrategico_catalogos_organization_id_tipo_nome_key" ON "estrategico_catalogos"("organization_id", "tipo", "nome");

-- CreateIndex
CREATE INDEX "estrategico_casos_organization_id_deleted_at_idx" ON "estrategico_casos"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "estrategico_casos_organization_id_etapa_idx" ON "estrategico_casos"("organization_id", "etapa");

-- CreateIndex
CREATE INDEX "estrategico_casos_organization_id_proxima_acao_prazo_idx" ON "estrategico_casos"("organization_id", "proxima_acao_prazo");

-- CreateIndex
CREATE INDEX "estrategico_casos_organization_id_importacao_chave_idx" ON "estrategico_casos"("organization_id", "importacao_chave");

-- CreateIndex
CREATE UNIQUE INDEX "estrategico_casos_organization_id_codigo_key" ON "estrategico_casos"("organization_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estrategico_caso_areas_caso_id_area_id_key" ON "estrategico_caso_areas"("caso_id", "area_id");

-- CreateIndex
CREATE INDEX "estrategico_eventos_caso_id_data_evento_idx" ON "estrategico_eventos"("caso_id", "data_evento" DESC);

-- CreateIndex
CREATE INDEX "estrategico_eventos_organization_id_data_evento_idx" ON "estrategico_eventos"("organization_id", "data_evento");

-- CreateIndex
CREATE INDEX "estrategico_tarefas_caso_id_deleted_at_idx" ON "estrategico_tarefas"("caso_id", "deleted_at");

-- CreateIndex
CREATE INDEX "estrategico_tarefas_organization_id_responsavel_id_status_idx" ON "estrategico_tarefas"("organization_id", "responsavel_id", "status");

-- CreateIndex
CREATE INDEX "estrategico_tarefas_organization_id_prazo_idx" ON "estrategico_tarefas"("organization_id", "prazo");

-- CreateIndex
CREATE UNIQUE INDEX "estrategico_tarefas_organization_id_chave_automacao_key" ON "estrategico_tarefas"("organization_id", "chave_automacao");

-- CreateIndex
CREATE INDEX "estrategico_dependencias_caso_id_resolvida_em_idx" ON "estrategico_dependencias"("caso_id", "resolvida_em");

-- CreateIndex
CREATE INDEX "estrategico_dependencias_organization_id_resolvida_em_idx" ON "estrategico_dependencias"("organization_id", "resolvida_em");

-- CreateIndex
CREATE INDEX "estrategico_documentos_caso_id_deleted_at_idx" ON "estrategico_documentos"("caso_id", "deleted_at");

-- CreateIndex
CREATE INDEX "estrategico_documentos_documento_origem_id_idx" ON "estrategico_documentos"("documento_origem_id");

-- CreateIndex
CREATE INDEX "estrategico_comentarios_caso_id_deleted_at_idx" ON "estrategico_comentarios"("caso_id", "deleted_at");

-- CreateIndex
CREATE INDEX "estrategico_valores_historico_caso_id_criado_em_idx" ON "estrategico_valores_historico"("caso_id", "criado_em");

-- CreateIndex
CREATE INDEX "estrategico_valores_historico_organization_id_criado_em_idx" ON "estrategico_valores_historico"("organization_id", "criado_em");

-- CreateIndex
CREATE INDEX "estrategico_historico_caso_id_criado_em_idx" ON "estrategico_historico"("caso_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "estrategico_historico_organization_id_criado_em_idx" ON "estrategico_historico"("organization_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "estrategico_reunioes_organization_id_data_reuniao_idx" ON "estrategico_reunioes"("organization_id", "data_reuniao" DESC);

-- CreateIndex
CREATE INDEX "estrategico_decisoes_organization_id_decidido_em_idx" ON "estrategico_decisoes"("organization_id", "decidido_em" DESC);

-- CreateIndex
CREATE INDEX "estrategico_decisoes_caso_id_idx" ON "estrategico_decisoes"("caso_id");

-- CreateIndex
CREATE INDEX "estrategico_decisoes_reuniao_id_idx" ON "estrategico_decisoes"("reuniao_id");

-- CreateIndex
CREATE UNIQUE INDEX "estrategico_configs_organization_id_key" ON "estrategico_configs"("organization_id");

-- CreateIndex
CREATE INDEX "estrategico_alerta_envios_organization_id_criado_em_idx" ON "estrategico_alerta_envios"("organization_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "estrategico_alerta_envios_organization_id_chave_key" ON "estrategico_alerta_envios"("organization_id", "chave");

-- AddForeignKey
ALTER TABLE "estrategico_catalogos" ADD CONSTRAINT "estrategico_catalogos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "estrategico_catalogos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "estrategico_catalogos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_esfera_id_fkey" FOREIGN KEY ("esfera_id") REFERENCES "estrategico_catalogos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_area_executiva_id_fkey" FOREIGN KEY ("area_executiva_id") REFERENCES "estrategico_catalogos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_area_operacional_id_fkey" FOREIGN KEY ("area_operacional_id") REFERENCES "estrategico_catalogos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_responsavel_executivo_id_fkey" FOREIGN KEY ("responsavel_executivo_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_responsavel_operacional_id_fkey" FOREIGN KEY ("responsavel_operacional_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_casos" ADD CONSTRAINT "estrategico_casos_proxima_acao_responsavel_id_fkey" FOREIGN KEY ("proxima_acao_responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_caso_areas" ADD CONSTRAINT "estrategico_caso_areas_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_caso_areas" ADD CONSTRAINT "estrategico_caso_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "estrategico_catalogos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_eventos" ADD CONSTRAINT "estrategico_eventos_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_eventos" ADD CONSTRAINT "estrategico_eventos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_tarefas" ADD CONSTRAINT "estrategico_tarefas_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_tarefas" ADD CONSTRAINT "estrategico_tarefas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_dependencias" ADD CONSTRAINT "estrategico_dependencias_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_dependencias" ADD CONSTRAINT "estrategico_dependencias_catalogo_id_fkey" FOREIGN KEY ("catalogo_id") REFERENCES "estrategico_catalogos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_documentos" ADD CONSTRAINT "estrategico_documentos_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_comentarios" ADD CONSTRAINT "estrategico_comentarios_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_comentarios" ADD CONSTRAINT "estrategico_comentarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_valores_historico" ADD CONSTRAINT "estrategico_valores_historico_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_historico" ADD CONSTRAINT "estrategico_historico_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_historico" ADD CONSTRAINT "estrategico_historico_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_reunioes" ADD CONSTRAINT "estrategico_reunioes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_decisoes" ADD CONSTRAINT "estrategico_decisoes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_decisoes" ADD CONSTRAINT "estrategico_decisoes_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "estrategico_casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_decisoes" ADD CONSTRAINT "estrategico_decisoes_reuniao_id_fkey" FOREIGN KEY ("reuniao_id") REFERENCES "estrategico_reunioes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrategico_configs" ADD CONSTRAINT "estrategico_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
