-- Monitoramento OSA (último arquivo .tag recebido, via SMB)

CREATE TABLE "osa_monitor" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "caminho" TEXT NOT NULL,
  "share" TEXT,
  "usuario" TEXT,
  "dominio" TEXT,
  "senha_cifrada" TEXT,
  "filtro" TEXT NOT NULL DEFAULT '*.tag',
  "tempo_max_min" INTEGER NOT NULL DEFAULT 5,
  "intervalo_seg" INTEGER NOT NULL DEFAULT 60,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ultimo_arquivo" TEXT,
  "serie" TEXT,
  "sequencial" TEXT,
  "ultima_atualizacao" TIMESTAMP(3),
  "ultimo_check_em" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'DESCONHECIDO',
  "ultimo_erro" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "osa_monitor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "osa_monitor_organization_id_ativo_idx" ON "osa_monitor"("organization_id", "ativo");

ALTER TABLE "osa_monitor" ADD CONSTRAINT "osa_monitor_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
