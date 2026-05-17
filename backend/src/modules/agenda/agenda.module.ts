import { Module, Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Req, NotFoundException, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsBoolean, IsDateString, IsArray, IsIn } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

class CreateEventDto {
  @IsString() titulo: string;
  @IsDateString() inicio: string;
  @IsOptional() @IsDateString() fim?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsBoolean() diaTodo?: boolean;
  @IsOptional() @IsArray() participantes?: string[];
  @IsOptional() @IsString() recorrencia?: string;
  @IsOptional() @IsString() recorrenciaFim?: string;
  @IsOptional() @IsString() ata?: string;
  @IsOptional() @IsString() local?: string;
}

class UpdateEventDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsDateString() inicio?: string;
  @IsOptional() @IsDateString() fim?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsBoolean() diaTodo?: boolean;
  @IsOptional() @IsString() ata?: string;
  @IsOptional() @IsString() local?: string;
}

function expandRecurring(event: any, from: Date, to: Date): any[] {
  if (!event.recorrencia) return [event];
  const results = [];
  const start = new Date(event.inicio);
  const end = event.fim ? new Date(event.fim) : null;
  const durMs = end ? end.getTime() - start.getTime() : 0;
  const recFim = event.recorrenciaFim ? new Date(event.recorrenciaFim) : new Date(to.getTime() + 365 * 24 * 60 * 60 * 1000);

  let cur = new Date(start);
  let count = 0;

  while (cur <= recFim && cur <= to && count < 200) {
    if (cur >= from) {
      results.push({
        ...event,
        id: event.id + "_" + count,
        inicio: cur.toISOString(),
        fim: end ? new Date(cur.getTime() + durMs).toISOString() : null,
        isRecurring: true,
        recurringParentId: event.id,
      });
    }
    count++;
    const next = new Date(cur);
    switch (event.recorrencia) {
      case "DIARIA":    next.setDate(next.getDate() + 1); break;
      case "SEMANAL":   next.setDate(next.getDate() + 7); break;
      case "QUINZENAL": next.setDate(next.getDate() + 14); break;
      case "MENSAL":    next.setMonth(next.getMonth() + 1); break;
      default: return results;
    }
    cur = next;
  }
  return results;
}

@Controller("agenda")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class AgendaController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Permissions("agenda:ver")
  async findAll(@Req() req: any, @Query("inicio") inicio?: string, @Query("fim") fim?: string, @Query("mes") mes?: string, @Query("ano") ano?: string) {
    const userId = req.user.id;
    let from: Date, to: Date;

    if (inicio && fim) {
      from = new Date(inicio); to = new Date(fim);
    } else if (mes && ano) {
      from = new Date(Number(ano), Number(mes) - 1, 1);
      to = new Date(Number(ano), Number(mes), 0, 23, 59, 59);
    } else {
      from = new Date(); from.setDate(1);
      to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59);
    }

    // Busca eventos do periodo + eventos recorrentes que podem se expandir no periodo
    const events = await this.prisma.event.findMany({
      where: {
        userId,
        OR: [
          { inicio: { gte: from, lte: to } },
          { recorrencia: { not: null }, inicio: { lte: to } },
        ],
      },
      include: { participants: { include: { user: { select: { id: true, nome: true, email: true } } } } },
      orderBy: { inicio: "asc" },
    });

    // Expande eventos recorrentes
    const expanded = events.flatMap(e => expandRecurring(e, from, to));
    return expanded;
  }

  @Get("disponibilidade")
  @Permissions("agenda:ver")
  async disponibilidade(@Query("userIds") userIds: string, @Query("data") data: string) {
    if (!userIds || !data) throw new BadRequestException("userIds e data sao obrigatorios");
    const ids = userIds.split(",");
    const day = new Date(data);
    const dayEnd = new Date(data); dayEnd.setHours(23, 59, 59);

    const events = await this.prisma.event.findMany({
      where: { userId: { in: ids }, inicio: { gte: day, lte: dayEnd } },
      select: { userId: true, inicio: true, fim: true, titulo: true, diaTodo: true },
    });

    const slots: Record<string, any[]> = {};
    for (const id of ids) { slots[id] = []; }
    for (const ev of events) { slots[ev.userId]?.push(ev); }

    return { data, usuarios: slots };
  }

  @Post()
  @Permissions("agenda:criar")
  async create(@Body() dto: CreateEventDto, @Req() req: any) {
    const userId = req.user.id;
    const event = await this.prisma.event.create({
      data: {
        titulo: dto.titulo,
        inicio: new Date(dto.inicio),
        fim: dto.fim ? new Date(dto.fim) : null,
        descricao: dto.descricao,
        tipo: (dto.tipo || "PESSOAL") as any,
        cor: dto.cor || "#a78bfa",
        diaTodo: dto.diaTodo || false,
        local: dto.local,
        ata: dto.ata,
        recorrencia: dto.recorrencia as any,
        recorrenciaFim: dto.recorrenciaFim ? new Date(dto.recorrenciaFim) : null,
        userId,
        criadoPorId: userId,
        organizationId: req.user?.organizationId,
      } as any,
    });

    if (dto.participantes?.length) {
      await this.prisma.eventParticipant.createMany({
        data: dto.participantes.map(uid => ({ eventId: event.id, userId: uid, status: "pendente" })),
        skipDuplicates: true,
      });
      for (const uid of dto.participantes) {
        if (uid === userId) continue;
        await this.prisma.event.create({
          data: {
            titulo: dto.titulo, inicio: new Date(dto.inicio),
            fim: dto.fim ? new Date(dto.fim) : null,
            descricao: dto.descricao, tipo: (dto.tipo || "PESSOAL") as any,
            cor: dto.cor || "#a78bfa", diaTodo: dto.diaTodo || false,
            local: dto.local, recorrencia: dto.recorrencia as any,
            userId: uid, criadoPorId: userId,
            origemTipo: "evento_compartilhado", origemId: event.id, confirmado: false,
            organizationId: req.user?.organizationId,
          } as any,
        });
        await this.prisma.notification.create({
          data: {
            userId: uid, tipo: "evento_convidado",
            titulo: "Voce foi convidado: " + dto.titulo,
            mensagem: new Date(dto.inicio).toLocaleDateString("pt-BR"),
            referenciaTipo: "event", referenciaId: event.id,
          },
        });
      }
    }

    return this.prisma.event.findUnique({
      where: { id: event.id },
      include: { participants: { include: { user: { select: { id: true, nome: true } } } } },
    });
  }

  @Put(":id")
  @Permissions("agenda:editar")
  async update(@Param("id") id: string, @Body() dto: UpdateEventDto, @Req() req: any) {
    const realId = id.includes("_") ? id.split("_")[0] : id;
    const event = await this.prisma.event.findUnique({ where: { id: realId } });
    if (!event) throw new NotFoundException("Evento nao encontrado");
    if (event.userId !== req.user.id && !req.user.isMaster) throw new BadRequestException("Sem permissao");
    return this.prisma.event.update({
      where: { id: realId },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.inicio && { inicio: new Date(dto.inicio) }),
        ...(dto.fim && { fim: new Date(dto.fim) }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.tipo && { tipo: dto.tipo as any }),
        ...(dto.cor && { cor: dto.cor }),
        ...(dto.diaTodo !== undefined && { diaTodo: dto.diaTodo }),
        ...(dto.ata !== undefined && { ata: dto.ata }),
        ...(dto.local !== undefined && { local: dto.local }),
      },
    });
  }

  @Delete(":id")
  @Permissions("agenda:deletar")
  async remove(@Param("id") id: string, @Req() req: any) {
    const realId = id.includes("_") ? id.split("_")[0] : id;
    const event = await this.prisma.event.findUnique({ where: { id: realId } });
    if (!event) throw new NotFoundException("Evento nao encontrado");
    if (event.userId !== req.user.id && !req.user.isMaster) throw new BadRequestException("Sem permissao");
    await this.prisma.event.delete({ where: { id: realId } });
    return { message: "Evento removido" };
  }

  @Patch(":id/ata")
  @Permissions("agenda:editar")
  async updateAta(@Param("id") id: string, @Body() body: { ata: string }, @Req() req: any) {
    const realId = id.includes("_") ? id.split("_")[0] : id;
    return this.prisma.event.update({ where: { id: realId }, data: { ata: body.ata } });
  }
  @Patch("respond-by-ref")
  @Permissions("agenda:editar")
  async respondByRef(@Body() body: { referenciaTipo: string; referenciaId: string; status: "aceito" | "recusado" }, @Req() req: any) {
    const origemMap: Record<string, string> = {
      event: "evento_compartilhado", task: "task", project: "projeto",
    };
    const origemTipo = origemMap[body.referenciaTipo] || body.referenciaTipo;
    const userEvent = await this.prisma.event.findFirst({
      where: { userId: req.user.id, origemTipo, origemId: body.referenciaId, confirmado: false },
    });
    if (!userEvent) throw new NotFoundException("Convite nao encontrado ou ja respondido");
    return this.respondEvent(userEvent.id, body.status, req);
  }

  @Patch(":id/respond")
  @Permissions("agenda:editar")
  async respond(@Param("id") id: string, @Body() body: { status: "aceito" | "recusado" }, @Req() req: any) {
    return this.respondEvent(id, body.status, req);
  }

  private async respondEvent(id: string, status: "aceito" | "recusado", req: any) {
    const realId = id.includes("_") ? id.split("_")[0] : id;
    const event = await this.prisma.event.findUnique({ where: { id: realId } });
    if (!event) throw new NotFoundException("Evento nao encontrado");
    if (event.userId !== req.user.id) throw new BadRequestException("Sem permissao");

    const aceito = status === "aceito";

    if (aceito) {
      await this.prisma.event.update({ where: { id: realId }, data: { confirmado: true } });
    } else {
      await this.prisma.event.delete({ where: { id: realId } });
    }

    if (event.origemTipo && event.origemId) {
      if (event.origemTipo === "evento_compartilhado") {
        await this.prisma.eventParticipant.updateMany({
          where: { eventId: event.origemId, userId: req.user.id },
          data: { status },
        });
      } else if (event.origemTipo === "task" && !aceito) {
        await this.prisma.task.update({
          where: { id: event.origemId },
          data: { assigneeId: null },
        }).catch(() => {}); // ignore if task deleted
      } else if (event.origemTipo === "projeto" && !aceito) {
        await this.prisma.projectMember.deleteMany({
          where: { projectId: event.origemId, userId: req.user.id },
        });
      }
    }

    if (event.criadoPorId && event.criadoPorId !== req.user.id) {
      const me = await this.prisma.user.findUnique({ where: { id: req.user.id } });
      const verb = aceito ? "aceitou" : "recusou";
      await this.prisma.notification.create({
        data: {
          userId: event.criadoPorId,
          tipo: "resposta_convite",
          titulo: `${me?.nome || "Um usuário"} ${verb} o convite`,
          mensagem: `Para: ${event.titulo}`,
          referenciaTipo: event.origemTipo || "event",
          referenciaId: event.origemId || event.id,
        },
      });
    }

    return { message: "Resposta registrada" };
  }
}

@Module({ controllers: [AgendaController] })
export class AgendaModule {}