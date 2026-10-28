import { MARCA } from "../../common/marca";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Module, Controller, Get, Post, Patch, Body, UseGuards, Req, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";

// ── DTOs gerados: sem classe, o ValidationPipe global nao tem metadata e a
//    rota aceita qualquer JSON. Campos derivados do tipo inline anterior.
class UpdateWhatsAppWhatsappDto {
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsBoolean() whatsappAlertas?: boolean;
}

@Controller("users/me")
class UserWhatsAppController {
  constructor(private prisma: PrismaService, private wa: WhatsAppService) {}

  @Get("whatsapp")
  @UseGuards(AuthGuard("jwt"))
  async getWhatsApp(@Req() req: any) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    return { whatsapp: profile?.whatsapp || "", whatsappAlertas: profile?.whatsappAlertas || false };
  }

  @Patch("whatsapp")
  @UseGuards(AuthGuard("jwt"))
  async updateWhatsApp(@Req() req: any, @Body() body: UpdateWhatsAppWhatsappDto) {
    await this.prisma.userProfile.upsert({
      where: { userId: req.user.id },
      update: {
        ...(body.whatsapp !== undefined && { whatsapp: body.whatsapp }),
        ...(body.whatsappAlertas !== undefined && { whatsappAlertas: body.whatsappAlertas }),
      },
      create: { userId: req.user.id, whatsapp: body.whatsapp || "", whatsappAlertas: body.whatsappAlertas || false },
    });
    return { sucesso: true };
  }

  /** Status da instância WhatsApp da organização — acessível a todos os usuários */
  @Get("whatsapp/org-status")
  @UseGuards(AuthGuard("jwt"))
  async orgStatus(@Req() req: any) {
    const status = await this.wa.getOrgStatus(req.user.organizationId);
    return { connected: status.connected, status: status.status };
  }

  @Post("whatsapp/teste")
  @UseGuards(AuthGuard("jwt"))
  async testarWhatsApp(@Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile?.whatsapp) throw new BadRequestException("Numero nao configurado");

    // Verifica conexão antes de tentar enviar
    const orgStatus = await this.wa.getOrgStatus(req.user.organizationId);
    if (!orgStatus.connected) {
      throw new BadRequestException(
        "O WhatsApp da organização não está conectado. " +
        (req.user.isMaster
          ? "Acesse Configurações → WhatsApp e conecte a instância."
          : "Solicite ao administrador que conecte o WhatsApp da organização.")
      );
    }

    const msg = `*${MARCA}* - Teste\n\nOla, ${user?.nome || ""}!\n\nNotificacoes WhatsApp funcionando corretamente!`;
    const ok = await this.wa.sendMessageForOrg(req.user.organizationId, profile.whatsapp, msg);
    if (!ok) throw new BadRequestException("Falha ao enviar. Verifique se o numero esta correto e cadastrado no WhatsApp.");
    return { sucesso: true };
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [UserWhatsAppController],
})
export class UserWhatsAppModule {}