import {
  Module, Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Req, BadRequestException, NotFoundException, Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { v4 as uuid } from "uuid";

class CreateTemplateDto { nome: string; titulo: string; descricao?: string; prioridade?: string; categoria?: string; tags?: string; }
class UpdateTemplateDto { nome?: string; titulo?: string; descricao?: string; prioridade?: string; categoria?: string; tags?: string; }

@Injectable()
export class ChamadoTemplatesService {
  constructor(private prisma: PrismaService) {}
  private db() { return this.prisma as any; }
  private scope(user: any) { return user?.organizationId ? { organizationId: user.organizationId } : {}; }

  findAll(user: any) {
    return this.db().chamadoTemplate.findMany({ where: this.scope(user), orderBy: { nome: "asc" }, include: { criadoPor: { select: { id: true, nome: true } } } });
  }
  async create(dto: CreateTemplateDto, user: any) {
    if (!dto.nome?.trim() || !dto.titulo?.trim()) throw new BadRequestException("Nome e título obrigatórios");
    return this.db().chamadoTemplate.create({ data: { id: uuid(), organizationId: user.organizationId, criadoPorId: user.id, nome: dto.nome.trim(), titulo: dto.titulo.trim(), descricao: dto.descricao || null, prioridade: dto.prioridade || "media", categoria: dto.categoria || null, tags: dto.tags || null } });
  }
  async update(id: string, dto: UpdateTemplateDto, user: any) {
    const t = await this.db().chamadoTemplate.findFirst({ where: { id, ...this.scope(user) } });
    if (!t) throw new NotFoundException("Template não encontrado");
    return this.db().chamadoTemplate.update({ where: { id }, data: { ...dto } });
  }
  async remove(id: string, user: any) {
    const t = await this.db().chamadoTemplate.findFirst({ where: { id, ...this.scope(user) } });
    if (!t) throw new NotFoundException("Template não encontrado");
    return this.db().chamadoTemplate.delete({ where: { id } });
  }
}

@Controller("chamado-templates")
@UseGuards(AuthGuard("jwt"))
export class ChamadoTemplatesController {
  constructor(private svc: ChamadoTemplatesService) {}
  @Get()     findAll(@Req() req: any)                             { return this.svc.findAll(req.user); }
  @Post()    create(@Req() req: any, @Body() dto: CreateTemplateDto) { return this.svc.create(dto, req.user); }
  @Put(":id") update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTemplateDto) { return this.svc.update(id, dto, req.user); }
  @Delete(":id") remove(@Req() req: any, @Param("id") id: string)   { return this.svc.remove(id, req.user); }
}

@Module({ controllers: [ChamadoTemplatesController], providers: [ChamadoTemplatesService], exports: [ChamadoTemplatesService] })
export class ChamadoTemplatesModule {}
