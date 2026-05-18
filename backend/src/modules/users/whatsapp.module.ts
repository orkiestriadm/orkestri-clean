import { Module, Controller, Get, Post, Patch, Body, UseGuards, Req, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";

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
  async updateWhatsApp(@Req() req: any, @Body() body: { whatsapp?: string; whatsappAlertas?: boolean }) {
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

  @Post("whatsapp/teste")
  @UseGuards(AuthGuard("jwt"))
  async testarWhatsApp(@Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile?.whatsapp) throw new BadRequestException("Numero nao configurado");
    const msg = "*Orkestri* - Teste\n\nOla, " + (user?.nome || "") + "!\n\nNotificacoes WhatsApp funcionando.";
    const ok = await this.wa.sendMessageForOrg(req.user.organizationId, profile.whatsapp, msg);
    if (!ok) throw new BadRequestException("Falha ao enviar. Verifique se o WhatsApp da organizacao esta conectado.");
    return { sucesso: true };
  }
}

@Module({
  controllers: [UserWhatsAppController],
  providers: [WhatsAppService],
})
export class UserWhatsAppModule {}