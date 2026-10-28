import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { antesDeEfeito, execucaoWhats } from "../modules/agenda/whatsapp-execucao";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    this.$use(async (params, next) => {
      // Marcação conservadora ANTES da primeira gravação. Mesmo um rollback
      // exige revisão; nunca assumimos que um efeito parcial pode ser repetido.
      if (execucaoWhats.getStore() && params.model && !params.model.startsWith("Whatsapp") &&
        /^(?:create|createMany|update|updateMany|delete|deleteMany|upsert)$/.test(params.action)) {
        await antesDeEfeito();
      }
      return next(params);
    });
  }
  async onModuleInit() {
    await this.$connect();
    console.log("Prisma connected to PostgreSQL");
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
