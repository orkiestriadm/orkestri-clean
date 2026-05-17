import { Module, Controller, Get, Post, Put, Body, Param, UseGuards, Req, OnModuleInit } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsInt, IsBoolean, IsOptional, Min, Max } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Injectable, Logger } from "@nestjs/common";

const DEFAULT_CONFIGS = [
  { minutos: 60, ativo: true, emoji: "ðŸ””", titulo: "Lembrete â€” 1 hora",    mensagem: "Voce tem um evento em 60 minutos:\n\nðŸ“… *{evento}*\nðŸ• {horario}\n\nðŸ”— {url}" },
  { minutos: 15, ativo: true, emoji: "â°", titulo: "Lembrete â€” 15 minutos", mensagem: "Atencao! Seu evento comeca em 15 minutos:\n\nðŸ“… *{evento}*\nðŸ• {horario}\n\nPrepare-se! ðŸ”— {url}" },
  { minutos: 5,  ativo: true, emoji: "âš ï¸", titulo: "URGENTE â€” 5 minutos",   mensagem: "URGENTE! Faltam apenas 5 minutos:\n\nðŸš¨ *{evento}*\nðŸ• {horario}\n\nNao perca! ðŸ”— {url}" },
  { minutos: 0,  ativo: true, emoji: "ðŸš¨", titulo: "Acontecendo AGORA",     mensagem: "Seu evento esta acontecendo AGORA:\n\nðŸš¨ *{evento}*\n\nBoa reuniao! ðŸ”— {url}" },
];

@Injectable()
export class AlertConfigService implements OnModuleInit {
  private readonly logger = new Logger(AlertConfigService.name);
  constructor(private prisma: PrismaService) {}

  private readonly DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

  async onModuleInit() {
    try {
      const count = await this.prisma.alertConfig.count();
      if (count === 0) {
        const data = DEFAULT_CONFIGS.map(c => ({ ...c, organizationId: this.DEFAULT_ORG }));
        await (this.prisma.alertConfig as any).createMany({ data });
        this.logger.log("Configuracoes de alerta padrao criadas");
      }
    } catch (e) { this.logger.warn("AlertConfig seed: " + e.message); }
  }

  async findAll() { return this.prisma.alertConfig.findMany({ orderBy: { minutos: "desc" } }); }

  async update(id: string, data: any) {
    return this.prisma.alertConfig.update({ where: { id }, data });
  }

  async getActive() {
    return this.prisma.alertConfig.findMany({ where: { ativo: true }, orderBy: { minutos: "desc" } });
  }
}

class UpdateConfigDto {
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsString() emoji?: string;
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() mensagem?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1440) minutos?: number;
}

@Controller("alert-configs")
class AlertConfigController {
  constructor(private svc: AlertConfigService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  findAll() { return this.svc.findAll(); }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"))
  update(@Param("id") id: string, @Body() dto: UpdateConfigDto, @Req() req: any) {
    if (!req.user.isMaster) throw new Error("Apenas masters");
    return this.svc.update(id, dto);
  }
}

@Module({
  providers: [AlertConfigService],
  controllers: [AlertConfigController],
  exports: [AlertConfigService],
})
export class AlertConfigModule {}