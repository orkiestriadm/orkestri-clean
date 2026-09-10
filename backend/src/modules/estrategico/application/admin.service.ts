import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { CasoRepository } from "../infrastructure/caso.repository";
import { Usuario, CONFIG_PADRAO } from "./contexto";
import { ESTRATEGICO_PERFIS, ESTRATEGICO_PERMISSION_CATALOG } from "../estrategico.permissions";
import { CatalogoDto, ConfigDto } from "./dto/estrategico.dto";

/** Catálogos, parâmetros e perfis do Strategy. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CasoRepository,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async catalogos(user: Usuario) {
    const orgId = user.organizationId;
    await this.repo.garantirPadroes(orgId);
    const [itens, casos, apoios, dependencias] = await Promise.all([
      this.repo.catalogos(orgId),
      this.db.estrategicoCaso.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { grupoId: true, objetivoId: true, esferaId: true, areaExecutivaId: true, areaOperacionalId: true },
      }),
      this.db.estrategicoCasoArea.findMany({ where: { caso: { organizationId: orgId, deletedAt: null } }, select: { areaId: true } }),
      this.db.estrategicoDependencia.findMany({ where: { organizationId: orgId, resolvidaEm: null }, select: { catalogoId: true } }),
    ]);
    const uso = new Map<string, number>();
    const contar = (id?: string | null) => { if (id) uso.set(id, (uso.get(id) ?? 0) + 1); };
    for (const c of casos) { contar(c.grupoId); contar(c.objetivoId); contar(c.esferaId); contar(c.areaExecutivaId); contar(c.areaOperacionalId); }
    for (const a of apoios) contar(a.areaId);
    for (const d of dependencias) contar(d.catalogoId);
    return itens.map((i: any) => ({ ...i, emUso: uso.get(i.id) ?? 0 }));
  }

  async criarCatalogo(user: Usuario, dto: CatalogoDto) {
    if (!dto.tipo || !dto.nome?.trim()) throw new BadRequestException("Informe o tipo e o nome.");
    try {
      const c = await this.db.estrategicoCatalogo.create({
        data: {
          organizationId: user.organizationId, tipo: dto.tipo, nome: dto.nome.trim(), descricao: dto.descricao ?? null,
          cor: dto.cor ?? null, natureza: dto.tipo === "dependencia" ? dto.natureza ?? "externa" : null,
          ordem: dto.ordem ?? 0, ativo: dto.ativo ?? true,
        },
      });
      await this.audit.log({
        organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_catalogos",
        registroId: c.id, acao: "criar", descricao: `${c.tipo}: ${c.nome}`,
      });
      return c;
    } catch (e: any) {
      if (e?.code === "P2002") throw new ConflictException(`Já existe "${dto.nome.trim()}" neste catálogo.`);
      throw e;
    }
  }

  async atualizarCatalogo(user: Usuario, id: string, dto: CatalogoDto) {
    const atual = await this.db.estrategicoCatalogo.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!atual) throw new NotFoundException("Item não encontrado");
    const data: any = {};
    if (dto.nome !== undefined) {
      if (!dto.nome?.trim()) throw new BadRequestException("O nome não pode ficar vazio.");
      data.nome = dto.nome.trim();
    }
    for (const k of ["descricao", "cor", "ordem", "ativo"] as const) if (dto[k] !== undefined) data[k] = dto[k];
    if (dto.natureza !== undefined && atual.tipo === "dependencia") data.natureza = dto.natureza;
    try {
      const c = await this.db.estrategicoCatalogo.update({ where: { id }, data });
      await this.audit.log({
        organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_catalogos",
        registroId: id, acao: "editar", descricao: `${atual.tipo}: ${atual.nome}${data.nome && data.nome !== atual.nome ? ` → ${data.nome}` : ""}`,
        dados: data,
      });
      return c;
    } catch (e: any) {
      if (e?.code === "P2002") throw new ConflictException(`Já existe "${data.nome}" neste catálogo.`);
      throw e;
    }
  }

  async config(user: Usuario) {
    return this.repo.config(user.organizationId);
  }

  async salvarConfig(user: Usuario, dto: ConfigDto) {
    const atual = await this.repo.config(user.organizationId);
    const mesclado = { ...atual, ...dto };
    if (mesclado.diasCriticoSemMovimento <= mesclado.diasAtencaoSemMovimento) {
      throw new BadRequestException("O limite crítico sem movimentação precisa ser maior que o de atenção.");
    }
    if (dto.gestoresEscalonamento?.length) {
      const validos = await this.db.user.count({
        where: { id: { in: dto.gestoresEscalonamento }, organizationId: user.organizationId, ativo: true },
      });
      if (validos !== new Set(dto.gestoresEscalonamento).size) throw new BadRequestException("Gestor de escalonamento inválido.");
    }
    const dados: any = { ...dto, atualizadoPorId: user.id };
    if (dto.antecedenciasAviso) dados.antecedenciasAviso = [...new Set(dto.antecedenciasAviso)].sort((a, b) => b - a);
    const salvo = await this.db.estrategicoConfig.upsert({
      where: { organizationId: user.organizationId },
      create: { ...CONFIG_PADRAO, ...dados, organizationId: user.organizationId },
      update: dados,
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_configs",
      registroId: salvo.id, acao: "configurar", descricao: "Parâmetros do farol e das automações", dados: dto as any,
    });
    return salvo;
  }

  perfis() {
    return {
      perfis: ESTRATEGICO_PERFIS,
      permissoes: ESTRATEGICO_PERMISSION_CATALOG.map(p => ({ permissao: `${p.recurso}:${p.acao}`, descricao: p.descricao })),
    };
  }
}
