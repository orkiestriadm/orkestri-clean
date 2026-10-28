import { Module, Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, OnModuleInit, BadRequestException, ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsInt, IsBoolean, IsOptional, Min, Max } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Injectable, Logger } from "@nestjs/common";

const DEFAULT_CONFIGS = [
  { minutos: 60, ativo: true, emoji: "🔔", titulo: "Lembrete — 1 hora",     mensagem: "Você tem um evento em 60 minutos:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}" },
  { minutos: 30, ativo: true, emoji: "⏰", titulo: "Lembrete — 30 minutos", mensagem: "Seu evento começa em 30 minutos:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}" },
  { minutos: 15, ativo: true, emoji: "⏰", titulo: "Lembrete — 15 minutos", mensagem: "Atenção! Seu evento começa em 15 minutos:\n\n📅 *{evento}*\n🕐 {horario}\n\nPrepare-se! 🔗 {url}" },
  { minutos: 5,  ativo: true, emoji: "⚠️", titulo: "URGENTE — 5 minutos",   mensagem: "URGENTE! Faltam apenas 5 minutos:\n\n🚨 *{evento}*\n🕐 {horario}\n\nNão perca! 🔗 {url}" },
  { minutos: 0,  ativo: true, emoji: "🚨", titulo: "Acontecendo AGORA",     mensagem: "Seu evento está acontecendo AGORA:\n\n🚨 *{evento}*\n\nBoa reunião! 🔗 {url}" },
];

@Injectable()
export class AlertConfigService implements OnModuleInit {
  private readonly logger = new Logger(AlertConfigService.name);
  constructor(private prisma: PrismaService) {}

  private readonly DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

  /**
   * Cria os lembretes padrão que FALTAM (por [org, minutos]), sem tocar nos que
   * já existem — assim um lembrete novo no catálogo (ex.: 30 min) aparece após o
   * deploy, mas as edições do admin nos demais são preservadas.
   */
  async onModuleInit() {
    try {
      for (const c of DEFAULT_CONFIGS) {
        const existe = await this.prisma.alertConfig.findFirst({
          where: { organizationId: this.DEFAULT_ORG, minutos: c.minutos },
        });
        if (!existe) {
          await this.prisma.alertConfig.create({ data: { ...c, organizationId: this.DEFAULT_ORG } });
          this.logger.log(`Lembrete padrão criado: ${c.minutos} min`);
        }
      }
    } catch (e: any) { this.logger.warn("AlertConfig seed: " + e.message); }
  }

  async findAll(orgId?: string) {
    return this.prisma.alertConfig.findMany({
      where: orgId ? { organizationId: orgId } : {},
      orderBy: { minutos: "desc" },
    });
  }

  async create(orgId: string, data: { minutos: number; titulo: string; mensagem: string; emoji?: string; ativo?: boolean }) {
    const jaExiste = await this.prisma.alertConfig.findFirst({ where: { organizationId: orgId, minutos: data.minutos } });
    if (jaExiste) throw new BadRequestException(`Já existe um lembrete de ${data.minutos} minutos.`);
    return this.prisma.alertConfig.create({
      data: {
        organizationId: orgId, minutos: data.minutos, titulo: data.titulo, mensagem: data.mensagem,
        emoji: data.emoji || "🔔", ativo: data.ativo ?? true,
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.alertConfig.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.alertConfig.delete({ where: { id } });
    return { message: "Lembrete removido." };
  }

  async getActive() {
    return this.prisma.alertConfig.findMany({ where: { ativo: true }, orderBy: { minutos: "desc" } });
  }
}

class CreateConfigDto {
  @IsInt() @Min(0) @Max(1440) minutos: number;
  @IsString() titulo: string;
  @IsString() mensagem: string;
  @IsOptional() @IsString() emoji?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
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
  findAll(@Req() req: any) { return this.svc.findAll(req.user.organizationId); }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  create(@Body() dto: CreateConfigDto, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    return this.svc.create(req.user.organizationId, dto);
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"))
  update(@Param("id") id: string, @Body() dto: UpdateConfigDto, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  remove(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters");
    return this.svc.remove(id);
  }
}

@Module({
  providers: [AlertConfigService],
  controllers: [AlertConfigController],
  exports: [AlertConfigService],
})
export class AlertConfigModule {}
