-- OSA passa a ler do Zabbix (auto-descoberta do item fadami.tag.recebido)

ALTER TABLE "osa_monitor" ALTER COLUMN "caminho" DROP NOT NULL;
ALTER TABLE "osa_monitor" ADD COLUMN "zabbix_host_id" TEXT;
ALTER TABLE "osa_monitor" ADD COLUMN "item_key" TEXT NOT NULL DEFAULT 'fadami.tag.recebido';
ALTER TABLE "osa_monitor" ADD COLUMN "valor_atual" TEXT;
ALTER TABLE "osa_monitor" ADD COLUMN "servico_estado" TEXT;

CREATE INDEX "osa_monitor_zabbix_host_id_idx" ON "osa_monitor"("zabbix_host_id");

-- Limpa qualquer erro antigo que possa ter vazado credencial SMB no texto
UPDATE "osa_monitor" SET "ultimo_erro" = NULL WHERE "ultimo_erro" IS NOT NULL;
