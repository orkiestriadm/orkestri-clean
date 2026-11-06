CREATE TABLE "aurelia_memorias" ("id" TEXT NOT NULL,"organization_id" TEXT NOT NULL,"user_id" TEXT NOT NULL,"chave" TEXT NOT NULL,"valor" TEXT NOT NULL,"consentimento" BOOLEAN NOT NULL DEFAULT false,"expira_em" TIMESTAMP(3),"criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"atualizado_em" TIMESTAMP(3) NOT NULL,CONSTRAINT "aurelia_memorias_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "aurelia_memorias_user_id_chave_key" ON "aurelia_memorias"("user_id","chave");
CREATE INDEX "aurelia_memorias_organization_id_user_id_idx" ON "aurelia_memorias"("organization_id","user_id");
ALTER TABLE "aurelia_memorias" ADD CONSTRAINT "aurelia_memorias_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aurelia_memorias" ADD CONSTRAINT "aurelia_memorias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
