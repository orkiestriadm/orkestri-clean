-- Monitoramento: reconhecimento (ack) de eventos pelo operador no NOC.
ALTER TABLE "mon_status_event" ADD COLUMN "reconhecido_por_id" TEXT;
ALTER TABLE "mon_status_event" ADD COLUMN "reconhecido_em" TIMESTAMP(3);
