import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req,
  NotFoundException, ForbiddenException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { organizacaoDe } from "../../common/escopo-organizacao";

/**
 * Keep da tarefa — o que cada membro fez nela.
 *
 * Regras (pedido do usuário, 11/09/2026):
 *  - quem vê o projeto lê os registros;
 *  - só quem FAZ PARTE do projeto (criador, membro) escreve — master também;
 *  - cada registro é do autor: só ele edita, marca item e apaga. Master apaga
 *    registro de qualquer um, mas não edita: reescrever o relato de outra pessoa
 *    faria o registro dizer algo que o autor não disse.
 *
 * A rota exige só `projetos:ver`, e não `projetos:editar`: um membro que só tem
 * leitura no módulo precisa conseguir contar o que fez. A trava de escrita é o
 * vínculo com o projeto, conferido aqui dentro.
 */

const TAMANHO_TEXTO = 5000;
const TAMANHO_ITEM = 300;
const MAX_ITENS = 50;

/** As mesmas cores das notas do Keep pessoal; fora da lista vira "sem cor". */
const CORES = ["#581c87", "#164e63", "#14532d", "#713f12", "#7f1d1d"];

class CriarRegistroDto {
  @IsOptional() @IsString() @MaxLength(TAMANHO_TEXTO) conteudo?: string;
  @IsOptional() @IsString() cor?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_ITENS)
  @IsString({ each: true }) @MaxLength(TAMANHO_ITEM, { each: true })
  itens?: string[];
}

class EditarRegistroDto {
  @IsOptional() @IsString() @MaxLength(TAMANHO_TEXTO) conteudo?: string;
  @IsOptional() @IsString() cor?: string;
}

class CriarItemDto {
  @IsString() @MaxLength(TAMANHO_ITEM) descricao: string;
}

class EditarItemDto {
  @IsOptional() @IsBoolean() concluido?: boolean;
  @IsOptional() @IsString() @MaxLength(TAMANHO_ITEM) descricao?: string;
}

const SELECAO_REGISTRO = {
  id: true, conteudo: true, cor: true, criadoEm: true, atualizadoEm: true,
  autor: { select: { id: true, nome: true } },
  itens: {
    orderBy: [{ ordem: "asc" as const }, { criadoEm: "asc" as const }],
    select: { id: true, descricao: true, concluido: true, ordem: true },
  },
};

type ProjetoDaTask = { id: string; criadoPorId: string; members: { userId: string }[] };

@Controller("projects/:projectId/tasks/:taskId/registros")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class TaskRegistrosController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Permissions("projetos:ver")
  async listar(@Param("projectId") projectId: string, @Param("taskId") taskId: string, @Req() req: any) {
    const projeto = await this.exigirTask(projectId, taskId, req);
    const registros = await this.prisma.taskRegistro.findMany({
      where: { taskId },
      orderBy: { criadoEm: "desc" },
      select: SELECAO_REGISTRO,
    });
    // A tela usa para decidir se mostra o campo de escrever — mostrar a quem
    // leva 403 no clique é pior que não mostrar.
    return { podeEscrever: this.fazParte(projeto, req), registros };
  }

  @Post()
  @Permissions("projetos:ver")
  async criar(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Body() dto: CriarRegistroDto, @Req() req: any,
  ) {
    const projeto = await this.exigirTask(projectId, taskId, req);
    this.exigirQueFazParte(projeto, req);

    const conteudo = dto.conteudo?.trim() || null;
    const itens = (dto.itens ?? []).map(i => i.trim()).filter(Boolean);
    if (!conteudo && !itens.length) {
      throw new BadRequestException("Escreva o que foi feito ou adicione ao menos um item.");
    }

    return this.prisma.taskRegistro.create({
      data: {
        taskId,
        autorId: req.user.id,
        conteudo,
        cor: this.corValida(dto.cor),
        itens: { create: itens.map((descricao, ordem) => ({ descricao, ordem })) },
      },
      select: SELECAO_REGISTRO,
    });
  }

  @Patch(":registroId")
  @Permissions("projetos:ver")
  async editar(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Param("registroId") registroId: string, @Body() dto: EditarRegistroDto, @Req() req: any,
  ) {
    const registro = await this.exigirRegistroDoAutor(projectId, taskId, registroId, req);

    const data: { conteudo?: string | null; cor?: string | null } = {};
    if (dto.conteudo !== undefined) {
      data.conteudo = dto.conteudo.trim() || null;
      if (!data.conteudo && registro._count.itens === 0) {
        throw new BadRequestException("O registro ficaria vazio. Para tirá-lo, apague o registro.");
      }
    }
    if (dto.cor !== undefined) data.cor = this.corValida(dto.cor);

    return this.prisma.taskRegistro.update({ where: { id: registroId }, data, select: SELECAO_REGISTRO });
  }

  @Delete(":registroId")
  @Permissions("projetos:ver")
  async apagar(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Param("registroId") registroId: string, @Req() req: any,
  ) {
    await this.exigirRegistroDoAutor(projectId, taskId, registroId, req, { masterPode: true });
    await this.prisma.taskRegistro.delete({ where: { id: registroId } });
    return { message: "Registro removido" };
  }

  /* ── Checklist do registro ─────────────────────────────────────────────── */

  @Post(":registroId/itens")
  @Permissions("projetos:ver")
  async criarItem(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Param("registroId") registroId: string, @Body() dto: CriarItemDto, @Req() req: any,
  ) {
    const registro = await this.exigirRegistroDoAutor(projectId, taskId, registroId, req);
    const descricao = dto.descricao.trim();
    if (!descricao) throw new BadRequestException("O item está vazio.");
    if (registro._count.itens >= MAX_ITENS) {
      throw new BadRequestException(`O registro já tem ${MAX_ITENS} itens. Crie um registro novo.`);
    }

    const ultimo = await this.prisma.taskRegistroItem.findFirst({
      where: { registroId }, orderBy: { ordem: "desc" }, select: { ordem: true },
    });
    return this.prisma.taskRegistroItem.create({
      data: { registroId, descricao, ordem: (ultimo?.ordem ?? -1) + 1 },
      select: { id: true, descricao: true, concluido: true, ordem: true },
    });
  }

  @Patch(":registroId/itens/:itemId")
  @Permissions("projetos:ver")
  async editarItem(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Param("registroId") registroId: string, @Param("itemId") itemId: string,
    @Body() dto: EditarItemDto, @Req() req: any,
  ) {
    await this.exigirRegistroDoAutor(projectId, taskId, registroId, req);
    await this.exigirItem(registroId, itemId);

    const descricao = dto.descricao?.trim();
    if (dto.descricao !== undefined && !descricao) throw new BadRequestException("O item está vazio.");

    return this.prisma.taskRegistroItem.update({
      where: { id: itemId },
      data: {
        ...(dto.concluido !== undefined && { concluido: dto.concluido }),
        ...(descricao && { descricao }),
      },
      select: { id: true, descricao: true, concluido: true, ordem: true },
    });
  }

  @Delete(":registroId/itens/:itemId")
  @Permissions("projetos:ver")
  async apagarItem(
    @Param("projectId") projectId: string, @Param("taskId") taskId: string,
    @Param("registroId") registroId: string, @Param("itemId") itemId: string, @Req() req: any,
  ) {
    const registro = await this.exigirRegistroDoAutor(projectId, taskId, registroId, req);
    await this.exigirItem(registroId, itemId);
    if (registro._count.itens <= 1 && !registro.conteudo) {
      throw new BadRequestException("Este é o único conteúdo do registro. Para tirá-lo, apague o registro.");
    }
    await this.prisma.taskRegistroItem.delete({ where: { id: itemId } });
    return { message: "Item removido" };
  }

  /* ── Travas ────────────────────────────────────────────────────────────── */

  /**
   * A task DENTRO do projeto da URL e da organização do token.
   *
   * Id solto não serve: foi assim que as rotas de tarefa ficaram editáveis por
   * outro tenant até 21/08. 404 e não 403 para quem está fora — para essa
   * pessoa, o projeto não existe.
   */
  private async exigirTask(projectId: string, taskId: string, req: any): Promise<ProjetoDaTask> {
    const projeto = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: organizacaoDe(req) },
      select: { id: true, criadoPorId: true, members: { select: { userId: true } } },
    });
    if (!projeto) throw new NotFoundException("Projeto não encontrado.");
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException("Tarefa não encontrada.");
    return projeto;
  }

  private fazParte(projeto: ProjetoDaTask, req: any): boolean {
    if (req.user?.isMaster) return true;
    if (projeto.criadoPorId === req.user?.id) return true;
    return projeto.members.some(m => m.userId === req.user?.id);
  }

  private exigirQueFazParte(projeto: ProjetoDaTask, req: any) {
    if (!this.fazParte(projeto, req)) {
      throw new ForbiddenException("Só quem faz parte do projeto registra o que foi feito na tarefa.");
    }
  }

  /**
   * O registro, desde que seja da task e o autor seja quem pede.
   *
   * O autor também precisa CONTINUAR no projeto: quem saiu não altera mais o
   * que ficou registrado. `masterPode` libera o master só para apagar.
   */
  private async exigirRegistroDoAutor(
    projectId: string, taskId: string, registroId: string, req: any,
    opcoes: { masterPode?: boolean } = {},
  ) {
    const projeto = await this.exigirTask(projectId, taskId, req);
    const registro = await this.prisma.taskRegistro.findFirst({
      where: { id: registroId, taskId },
      select: { id: true, autorId: true, conteudo: true, _count: { select: { itens: true } } },
    });
    if (!registro) throw new NotFoundException("Registro não encontrado.");

    if (opcoes.masterPode && req.user?.isMaster) return registro;
    if (registro.autorId !== req.user?.id) {
      throw new ForbiddenException("Só quem escreveu o registro pode alterá-lo.");
    }
    this.exigirQueFazParte(projeto, req);
    return registro;
  }

  private async exigirItem(registroId: string, itemId: string) {
    const item = await this.prisma.taskRegistroItem.findFirst({ where: { id: itemId, registroId }, select: { id: true } });
    if (!item) throw new NotFoundException("Item não encontrado.");
  }

  private corValida(cor?: string | null): string | null {
    return cor && CORES.includes(cor) ? cor : null;
  }
}
