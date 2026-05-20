-- AddForeignKey: cadastro_requests.organization_id → organizations
ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: cadastro_requests.cliente_id → clientes (nullable, SET NULL on delete)
ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: cadastro_requests.aprovado_por_id → users (nullable, SET NULL on delete)
ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_aprovado_por_id_fkey"
  FOREIGN KEY ("aprovado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: cadastro_requests.criado_por_id → users (nullable, SET NULL on delete)
ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
