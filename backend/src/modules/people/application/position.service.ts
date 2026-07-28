import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { IsString, IsOptional, IsBoolean, MaxLength } from "class-validator";
import { PositionRepository } from "../infrastructure/position.repository";
import { UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";

/**
 * Cargos.
 *
 * Antes do People, `cargo` era string livre em seis tabelas — o que impede
 * qualquer análise de distribuição por cargo, e faz "Analista de Sistemas",
 * "analista de sistemas" e "Analista Sistemas" virarem três coisas diferentes.
 *
 * Não há escopo por colaborador aqui: o catálogo de cargos é da organização,
 * não de uma pessoa. O isolamento é por `organizationId`, e só.
 */

export class CriarCargoDto {
  @IsString() @MaxLength(120) titulo!: string;
  @IsOptional() @IsString() @MaxLength(40) codigo?: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsString() @MaxLength(60) nivel?: string;
}

export class AtualizarCargoDto {
  @IsOptional() @IsString() @MaxLength(120) titulo?: string;
  @IsOptional() @IsString() @MaxLength(40) codigo?: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsString() @MaxLength(60) nivel?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

@Injectable()
export class PositionService {
  private readonly logger = new Logger(PositionService.name);

  constructor(
    private readonly repo: PositionRepository,
    private readonly audit: AuditService,
  ) {}

  async listar(user: UsuarioContexto, incluirInativos = false) {
    const organizationId = this.exigirOrganizacao(user);
    const cargos = await this.repo.listar(organizationId, incluirInativos);
    return {
      success: true,
      data: cargos.map((c: any) => ({
        ...c,
        colaboradores: c._count?.collaborators ?? 0,
        _count: undefined,
      })),
    };
  }

  async criar(user: UsuarioContexto, dto: CriarCargoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const titulo = dto.titulo.trim();
    if (!titulo) throw new BadRequestException("Informe o título do cargo");

    if (await this.repo.tituloEmUso(organizationId, titulo)) {
      throw new BadRequestException("Já existe um cargo com este título");
    }

    const criado = await this.repo.criar({
      organizationId,
      titulo,
      codigo: dto.codigo?.trim() || null,
      descricao: dto.descricao?.trim() || null,
      nivel: dto.nivel?.trim() || null,
      criadoPorId: user.id ?? null,
    });

    await this.auditar(user, criado.id, "criar", `Cargo "${titulo}" criado`);
    return { success: true, data: criado };
  }

  async atualizar(user: UsuarioContexto, id: string, dto: AtualizarCargoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obter(id, organizationId);
    if (!atual) throw new NotFoundException("Cargo não encontrado");

    if (dto.titulo && dto.titulo.trim() !== atual.titulo) {
      if (await this.repo.tituloEmUso(organizationId, dto.titulo.trim(), id)) {
        throw new BadRequestException("Já existe um cargo com este título");
      }
    }

    const atualizado = await this.repo.atualizar(id, {
      ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
      ...(dto.codigo !== undefined ? { codigo: dto.codigo?.trim() || null } : {}),
      ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
      ...(dto.nivel !== undefined ? { nivel: dto.nivel?.trim() || null } : {}),
      ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      atualizadoPorId: user.id ?? null,
    });

    await this.auditar(user, id, "editar", `Cargo "${atual.titulo}" atualizado`);
    return { success: true, data: atualizado };
  }

  async excluir(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.repo.obter(id, organizationId);
    if (!atual) throw new NotFoundException("Cargo não encontrado");

    // Excluir um cargo em uso deixaria colaboradores apontando para o nada.
    // Desativar mantém o histórico legível e some dos seletores.
    const emUso = await this.repo.contarColaboradores(id);
    if (emUso > 0) {
      throw new BadRequestException(
        `Este cargo está atribuído a ${emUso} colaborador(es). Desative-o em vez de excluir, ` +
        `ou mova os colaboradores para outro cargo antes.`,
      );
    }

    await this.repo.excluir(id, user.id ?? null);
    await this.auditar(user, id, "excluir", `Cargo "${atual.titulo}" excluído`);
    return { success: true, data: { id } };
  }

  /** Cargos que existem só como texto, com quantos colaboradores cada um tem. */
  async cargosSoltos(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    return { success: true, data: await this.repo.cargosSoltos(organizationId) };
  }

  /**
   * Converte os textos de `cargo` em cargos de verdade e vincula quem bate.
   *
   * Deliberadamente sob demanda, e não numa migration: exige decisão humana
   * sobre grafias divergentes, e rodar automaticamente criaria cargos duplicados
   * a partir de erros de digitação históricos.
   */
  async importarCargosSoltos(user: UsuarioContexto, titulos: string[]) {
    const organizationId = this.exigirOrganizacao(user);
    const resultado: { titulo: string; criado: boolean; vinculados: number }[] = [];

    for (const bruto of titulos) {
      const titulo = bruto.trim();
      if (!titulo) continue;

      let criado = false;
      let cargoId: string;

      const existente = await this.repo.tituloEmUso(organizationId, titulo);
      if (existente) {
        const lista = await this.repo.listar(organizationId, true);
        const achado = lista.find(
          (c: any) => c.titulo.toLowerCase() === titulo.toLowerCase(),
        );
        if (!achado) continue;
        cargoId = achado.id;
      } else {
        const novo = await this.repo.criar({
          organizationId,
          titulo,
          descricao: "Importado do cadastro anterior",
          criadoPorId: user.id ?? null,
        });
        cargoId = novo.id;
        criado = true;
      }

      const vinculados = await this.repo.vincularPorTitulo(organizationId, titulo, cargoId);
      resultado.push({ titulo, criado, vinculados });
    }

    const total = resultado.reduce((s, r) => s + r.vinculados, 0);
    await this.auditar(
      user, "importacao", "criar",
      `Importação de cargos: ${resultado.length} cargo(s), ${total} colaborador(es) vinculado(s)`,
    );

    return { success: true, data: resultado };
  }

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async auditar(user: UsuarioContexto, registroId: string, acao: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela: "positions",
        registroId,
        acao,
        descricao,
      } as any);
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
