import { Module, Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsOptional, IsBoolean } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";

class CreateNoteDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() conteudo?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsString() tipo?: string;
}

class UpdateNoteDto {
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() conteudo?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsBoolean() fixado?: boolean;
  @IsOptional() @IsBoolean() arquivado?: boolean;
  @IsOptional() @IsBoolean() lixeira?: boolean;
}

class CreateDailyTaskDto {
  @IsString() titulo: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() data?: string;
}

@Controller("keep")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class KeepController {
  constructor(private prisma: PrismaService) {}

  @Get("notes")
  @Permissions("keep:ver")
  async getNotes(@Req() req: any, @Query("arquivado") arquivado?: string) {
    return this.prisma.note.findMany({
      where: { userId: req.user.id, arquivado: arquivado === "true", lixeira: false },
      include: { checklists: { include: { items: { orderBy: { ordem: "asc" } } }, orderBy: { ordem: "asc" } } },
      orderBy: [{ fixado: "desc" }, { atualizadoEm: "desc" }],
    });
  }

  @Post("notes")
  @Permissions("keep:criar")
  async createNote(@Body() dto: CreateNoteDto, @Req() req: any) {
    return this.prisma.note.create({
      data: { userId: req.user.id, titulo: dto.titulo, conteudo: dto.conteudo, cor: dto.cor || null, tipo: (dto.tipo || "TEXTO") as any, organizationId: req.user?.organizationId } as any,
      include: { checklists: { include: { items: true } } },
    });
  }

  @Put("notes/:id")
  @Permissions("keep:editar")
  async updateNote(@Param("id") id: string, @Body() dto: UpdateNoteDto, @Req() req: any) {
    await this.prisma.note.findFirstOrThrow({ where: { id, userId: req.user.id } });
    return this.prisma.note.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.conteudo !== undefined && { conteudo: dto.conteudo }),
        ...(dto.cor !== undefined && { cor: dto.cor }),
        ...(dto.fixado !== undefined && { fixado: dto.fixado }),
        ...(dto.arquivado !== undefined && { arquivado: dto.arquivado }),
        ...(dto.lixeira !== undefined && { lixeira: dto.lixeira }),
      },
      include: { checklists: { include: { items: true } } },
    });
  }

  @Delete("notes/:id")
  @Permissions("keep:deletar")
  async deleteNote(@Param("id") id: string, @Req() req: any) {
    await this.prisma.note.findFirstOrThrow({ where: { id, userId: req.user.id } });
    await this.prisma.note.delete({ where: { id } });
    return { message: "Nota removida" };
  }

  @Post("notes/:id/checklist")
  @Permissions("keep:editar")
  async addChecklistItem(@Param("id") noteId: string, @Body() body: { descricao: string }, @Req() req: any) {
    await this.prisma.note.findFirstOrThrow({ where: { id: noteId, userId: req.user.id } });
    let checklist = await this.prisma.checklist.findFirst({ where: { noteId } });
    if (!checklist) checklist = await this.prisma.checklist.create({ data: { noteId } });
    return this.prisma.checklistItem.create({ data: { checklistId: checklist.id, descricao: body.descricao } });
  }

  @Patch("notes/:id/checklist/:itemId")
  @Permissions("keep:editar")
  async updateChecklistItem(@Param("id") noteId: string, @Param("itemId") itemId: string, @Body() body: { concluido?: boolean; descricao?: string }, @Req() req: any) {
    // Verifica ownership da nota
    await this.prisma.note.findFirstOrThrow({ where: { id: noteId, userId: req.user.id } });
    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(body.concluido !== undefined && { concluido: body.concluido }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
      },
    });
  }

  @Delete("notes/:id/checklist/:itemId")
  @Permissions("keep:editar")
  async deleteChecklistItem(@Param("id") noteId: string, @Param("itemId") itemId: string, @Req() req: any) {
    // Verifica ownership da nota
    await this.prisma.note.findFirstOrThrow({ where: { id: noteId, userId: req.user.id } });
    await this.prisma.checklistItem.delete({ where: { id: itemId } });
    return { message: "Item removido" };
  }

  @Get("daily")
  @Permissions("keep:ver")
  async getDailyTasks(@Req() req: any, @Query("data") data?: string) {
    const date = data ? new Date(data) : new Date();
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return this.prisma.dailyTask.findMany({
      where: { userId: req.user.id, data: { gte: date, lt: nextDay } },
      orderBy: [{ concluido: "asc" }, { prioridade: "desc" }, { criadoEm: "asc" }],
    });
  }

  @Post("daily")
  @Permissions("keep:criar")
  async createDailyTask(@Body() dto: CreateDailyTaskDto, @Req() req: any) {
    const date = dto.data ? new Date(dto.data) : new Date();
    date.setHours(0, 0, 0, 0);
    return this.prisma.dailyTask.create({
      data: { userId: req.user.id, titulo: dto.titulo, tipo: dto.tipo || "TAREFA", data: date, concluido: false },
    });
  }

  @Patch("daily/:id")
  @Permissions("keep:editar")
  async updateDailyTask(@Param("id") id: string, @Body() body: { concluido?: boolean; titulo?: string }, @Req() req: any) {
    // Verifica ownership
    await this.prisma.dailyTask.findFirstOrThrow({ where: { id, userId: req.user.id } });
    return this.prisma.dailyTask.update({
      where: { id },
      data: {
        ...(body.concluido !== undefined && { concluido: body.concluido }),
        ...(body.titulo !== undefined && { titulo: body.titulo }),
      },
    });
  }

  @Delete("daily/:id")
  @Permissions("keep:deletar")
  async deleteDailyTask(@Param("id") id: string, @Req() req: any) {
    // Verifica ownership
    await this.prisma.dailyTask.findFirstOrThrow({ where: { id, userId: req.user.id } });
    await this.prisma.dailyTask.delete({ where: { id } });
    return { message: "Task removida" };
  }
}

@Module({ controllers: [KeepController] })
export class KeepModule {}