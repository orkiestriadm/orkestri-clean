import { Module, Controller, Get, Post, Body, Param, Query, UseGuards, Req, ForbiddenException, Sse, MessageEvent } from "@nestjs/common";
import { Observable, interval, from, switchMap, map, startWith } from "rxjs";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsBoolean } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";
import { AlertScheduler } from "./alert.scheduler";
import { AlertConfigModule } from "./alert-config.module";

class UpdatePhoneDto {
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsBoolean() whatsappAlertas?: boolean;
}

@Controller("notifications")
class NotificationsController {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private scheduler: AlertScheduler,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  async findAll(@Req() req: any) {
    return this.prisma.notification.findMany({
      where: { userId: req.user.id, lida: false },
      orderBy: { criadoEm: "desc" }, take: 20,
    });
  }

  @Get("history")
  @UseGuards(AuthGuard("jwt"))
  async history(@Req() req: any) {
    return this.prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { criadoEm: "desc" }, take: 50,
    });
  }

  @Post(":id/read")
  @UseGuards(AuthGuard("jwt"))
  async markRead(@Param("id") id: string, @Req() req: any) {
    await this.prisma.notification.updateMany({ where: { id, userId: req.user.id }, data: { lida: true } });
    return { ok: true };
  }

  @Post("read-all")
  @UseGuards(AuthGuard("jwt"))
  async markAllRead(@Req() req: any) {
    await this.prisma.notification.updateMany({ where: { userId: req.user.id, lida: false }, data: { lida: true } });
    return { ok: true };
  }

  @Get("upcoming-events")
  @UseGuards(AuthGuard("jwt"))
  async upcomingEvents(@Req() req: any) {
    const now = new Date();
    const in90min = new Date(now.getTime() + 90 * 60 * 1000);
    const events = await this.prisma.event.findMany({
      where: { userId: req.user.id, inicio: { gte: now, lte: in90min } },
      orderBy: { inicio: "asc" },
    });
    return events.map(e => ({
      id: e.id, titulo: e.titulo, inicio: e.inicio, cor: e.cor, tipo: e.tipo,
      minutosRestantes: Math.round((new Date(e.inicio).getTime() - now.getTime()) / 60000),
    }));
  }

  @Post("test-alert")
  @UseGuards(AuthGuard("jwt"))
  async testAlert(@Req() req: any) {
    // ForÃƒÂ§a verificacao imediata
    await this.scheduler.run();
    // Cria notificacao de teste
    await this.prisma.notification.create({
      data: {
        userId: req.user.id,
        tipo: "teste",
        titulo: "Ã°Å¸â€â€ Teste de notificacao",
        mensagem: "As notificacoes estao funcionando corretamente!",
      },
    });
    return { ok: true };
  }

  @Post("test-whatsapp")
  @UseGuards(AuthGuard("jwt"))
  async testWhatsApp(@Req() req: any) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile?.whatsapp) return { ok: false, message: "Numero nao configurado" };
    const sent = await this.wa.sendTest(profile.whatsapp);
    return { ok: sent, message: sent ? "Mensagem enviada!" : "Falha ao enviar. Verifique a conexao." };
  }

  @Get("password-requests")
  @UseGuards(AuthGuard("jwt"))
  async getPasswordRequests(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem acessar");
    return this.prisma.notification.findMany({
      where: { tipo: "reset_senha" },
      orderBy: { criadoEm: "desc" },
    });
  }

  @Post("password-requests/:id/resolve")
  @UseGuards(AuthGuard("jwt"))
  async resolveRequest(@Param("id") id: string, @Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem acessar");
    await this.prisma.notification.update({ where: { id }, data: { lida: true } });
    return { ok: true };
  }

  @Get("whatsapp/status")
  @UseGuards(AuthGuard("jwt"))
  async waStatus(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem acessar");
    return this.wa.getStatus();
  }

  @Get("whatsapp/qrcode")
  @UseGuards(AuthGuard("jwt"))
  async waQrCode(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem acessar");
    return this.wa.getQrCode();
  }

  @Post("whatsapp/connect")
  @UseGuards(AuthGuard("jwt"))
  async waConnect(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem acessar");
    return this.wa.createInstance();
  }

  @Post("whatsapp/disconnect")
  @UseGuards(AuthGuard("jwt"))
  async waDisconnect(@Req() req: any) {
    if (!req.user.isMaster) throw new ForbiddenException("Apenas masters podem acessar");
    return this.wa.disconnect();
  }

  @Post("profile/whatsapp")
  @UseGuards(AuthGuard("jwt"))
  async updatePhone(@Body() dto: UpdatePhoneDto, @Req() req: any) {
    await this.prisma.userProfile.upsert({
      where: { userId: req.user.id },
      update: { whatsapp: dto.whatsapp, whatsappAlertas: dto.whatsappAlertas ?? true },
      create: { userId: req.user.id, whatsapp: dto.whatsapp, whatsappAlertas: dto.whatsappAlertas ?? true },
    });
    return { ok: true };
  }

  @Get("profile/whatsapp")
  @UseGuards(AuthGuard("jwt"))
  async getPhone(@Req() req: any) {
    const p = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    return { whatsapp: p?.whatsapp || "", whatsappAlertas: p?.whatsappAlertas ?? false };
  }

  // SSE stream — token via query param because EventSource can't send headers
  @Sse("stream")
  stream(@Query("token") token: string): Observable<MessageEvent> {
    let userId: string;
    try {
      const secret = this.config.get("JWT_SECRET", "fallback_secret");
      const payload = this.jwtService.verify(token, { secret }) as any;
      userId = payload.sub;
    } catch {
      return new Observable(sub => {
        sub.next({ data: { error: "unauthorized" } } as MessageEvent);
        sub.complete();
      });
    }

    let lastCount = -1;
    return interval(8000).pipe(
      startWith(0),
      switchMap(() => from(
        this.prisma.notification.findMany({
          where: { userId, lida: false },
          orderBy: { criadoEm: "desc" },
          take: 20,
          select: { id: true, tipo: true, titulo: true, mensagem: true, lida: true, criadoEm: true, referenciaTipo: true, referenciaId: true },
        })
      )),
      map(notifs => {
        const count = notifs.length;
        if (count === lastCount) return { data: { ping: true } } as MessageEvent;
        lastCount = count;
        return { data: { notifs, count } } as MessageEvent;
      }),
    );
  }
}

import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    AlertConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.get("JWT_SECRET", "fallback_secret") }),
    }),
  ],
  providers: [WhatsAppService, AlertScheduler, ConfigService],
  controllers: [NotificationsController],
  exports: [WhatsAppService, AlertScheduler],
})
export class NotificationsModule {}