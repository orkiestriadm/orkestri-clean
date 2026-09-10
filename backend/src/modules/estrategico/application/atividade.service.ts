import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { CasoRepository, includeCaso } from "../infrastructure/caso.repository";
import { CasoService } from "./caso.service";
import { AvisoService } from "./aviso.service";
import { apresentarCaso, ordenarPorGravidade } from "./presenter";
import {
  Usuario, paraData, hojeData, dataBr, parametrosDe, podeEditarCaso, podeRegistrar, verFinanceiro,
} from "./contexto";
import { tem, ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { TAREFA_ABERTA, TIPOS_EVENTO, diasEntre, ROTULO_PRIORIDADE } from "../domain/caso.entity";
import {
  CriarEventoDto, AtualizarEventoDto, CriarTarefaDto, AtualizarTarefaDto, ComentarDto, DependenciaDto,
} from "./dto/estrategico.dto";

const pessoa = { select: { id: true, nome: true, avatar: true } };
const rotuloEvento = (t: string) => TIPOS_EVENTO.find(x => x.id === t)?.rotulo ?? t;

/**
 * Timeline, tarefas, comentários e dependências.
 *
 * A última movimentação do caso é DERIVADA da timeline (a data do andamento
 * mais recente) e recalculada a cada escrita aqui — é ela que alimenta o aging.
 * Por isso concluir uma tarefa gera um andamento de sistema: é movimento real,
 * e sem o registro na timeline o aging o ignoraria.
 */
@Injectable()
export class AtividadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CasoRepository,
    private readonly casos: CasoService,
    private readonly aviso: AvisoService,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  private async validarUsuario(orgId: string, userId?: string | null) {
    if (!userId) return;
    const u = await this.db.user.findFirst({ where: { id: userId, organizationId: orgId, ativo: true }, select: { id: true } });
    if (!u) throw new BadRequestException("Responsável não encontrado ou inativo nesta organização.");
  }

  private async atualizarUltimaMovimentacao(casoId: string) {
    const agg = await this.db.estrategicoEvento.aggregate({
      where: { casoId, deletedAt: null },
      _max: { dataEvento: true },
    });
    await this.db.estrategicoCaso.update({
      where: { id: casoId },
      data: { ultimaMovimentacaoEm: agg._max.dataEvento ?? null },
    });
  }

  /* ── Timeline ──────────────────────────────────────────────────────────── */

  async eventos(user: Usuario, casoId: string) {
    await this.casos.exigir(user, casoId);
    return this.db.estrategicoEvento.findMany({
      where: { casoId, organizationId: user.organizationId, deletedAt: null },
      include: { responsavel: pessoa },
      orderBy: [{ dataEvento: "desc" }, { criadoEm: "desc" }],
    });
  }

  async criarEvento(user: Usuario, casoId: string, dto: CriarEventoDto, ip?: string) {
    const caso = await this.casos.exigir(user, casoId);
    if (!podeRegistrar(user, caso)) throw new ForbiddenException("Sem permissão para registrar andamentos neste assunto.");
    await this.validarUsuario(user.organizationId, dto.responsavelId);

    const dataEvento = paraData(dto.dataEvento)!;
    const amanha = new Date(hojeData().getTime() + 86_400_000);
    if (dataEvento >= amanha) {
      throw new BadRequestException("Andamento é o que já aconteceu. Para o que vai acontecer, use a próxima ação ou uma tarefa.");
    }

    const ev = await this.db.estrategicoEvento.create({
      data: {
        organizationId: user.organizationId, casoId, tipo: dto.tipo, dataEvento,
        titulo: dto.titulo.trim(), descricao: dto.descricao ?? null, decisao: dto.decisao ?? null,
        proximoPasso: dto.proximoPasso ?? null, responsavelId: dto.responsavelId ?? null,
        documentoId: dto.documentoId ?? null, autorId: user.id, origem: "manual",
      },
    });
    if (dto.tipo === "decisao" && dto.decisao?.trim()) {
      await this.db.estrategicoDecisao.create({
        data: {
          organizationId: user.organizationId, casoId, descricao: dto.decisao.trim(),
          decididoEm: dataEvento, registradoPorId: user.id,
        },
      });
    }
    await this.atualizarUltimaMovimentacao(casoId);
    await this.repo.historico(user.organizationId, casoId, {
      userId: user.id, acao: "evento", ip,
      descricao: `${rotuloEvento(dto.tipo)} em ${dataBr(dataEvento)}: ${dto.titulo.trim()}`,
    });
    await this.casos.recalcularFarol(user.organizationId, casoId);
    return ev;
  }

  async atualizarEvento(user: Usuario, eventoId: string, dto: AtualizarEventoDto, ip?: string) {
    const ev = await this.db.estrategicoEvento.findFirst({ where: { id: eventoId, organizationId: user.organizationId, deletedAt: null } });
    if (!ev) throw new NotFoundException("Andamento não encontrado");
    const caso = await this.casos.exigir(user, ev.casoId);
    if (!(podeEditarCaso(user, caso) || (ev.autorId === user.id && tem(user, P.tarefa.executar)))) {
      throw new ForbiddenException("Sem permissão para alterar este andamento.");
    }
    const data: any = {};
    for (const k of ["tipo", "titulo", "descricao", "decisao", "proximoPasso", "revisar"] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.dataEvento !== undefined) data.dataEvento = paraData(dto.dataEvento);
    const atualizado = await this.db.estrategicoEvento.update({ where: { id: eventoId }, data });
    await this.atualizarUltimaMovimentacao(ev.casoId);
    await this.repo.historico(user.organizationId, ev.casoId, {
      userId: user.id, acao: "evento", ip, descricao: `Andamento de ${dataBr(ev.dataEvento)} editado: ${atualizado.titulo}`,
    });
    await this.casos.recalcularFarol(user.organizationId, ev.casoId);
    return atualizado;
  }

  async excluirEvento(user: Usuario, eventoId: string, ip?: string) {
    const ev = await this.db.estrategicoEvento.findFirst({ where: { id: eventoId, organizationId: user.organizationId, deletedAt: null } });
    if (!ev) throw new NotFoundException("Andamento não encontrado");
    const caso = await this.casos.exigir(user, ev.casoId);
    if (!podeEditarCaso(user, caso)) throw new ForbiddenException("Sem permissão para excluir andamentos.");
    await this.db.estrategicoEvento.update({ where: { id: eventoId }, data: { deletedAt: new Date() } });
    await this.atualizarUltimaMovimentacao(ev.casoId);
    await this.repo.historico(user.organizationId, ev.casoId, {
      userId: user.id, acao: "evento", ip, descricao: `Andamento de ${dataBr(ev.dataEvento)} excluído: ${ev.titulo}`,
    });
    await this.casos.recalcularFarol(user.organizationId, ev.casoId);
    return { ok: true };
  }

  /* ── Tarefas ───────────────────────────────────────────────────────────── */

  async tarefas(user: Usuario, casoId: string) {
    await this.casos.exigir(user, casoId);
    const lista = await this.db.estrategicoTarefa.findMany({
      where: { casoId, organizationId: user.organizationId, deletedAt: null },
      include: { responsavel: pessoa },
      orderBy: [{ prazo: "asc" }, { criadoEm: "asc" }],
    });
    return lista.map((t: any) => this.apresentarTarefa(t))
      .sort((a: any, b: any) => Number(!a.aberta) - Number(!b.aberta));
  }

  private apresentarTarefa(t: any) {
    const aberta = TAREFA_ABERTA.includes(t.status);
    const diasPrazo = t.prazo ? diasEntre(new Date(), t.prazo) : null;
    return { ...t, aberta, diasPrazo, vencida: aberta && diasPrazo != null && diasPrazo < 0 };
  }

  async minhas(user: Usuario) {
    const orgId = user.organizationId;
    const [tarefas, casos, config] = await Promise.all([
      this.db.estrategicoTarefa.findMany({
        where: { organizationId: orgId, responsavelId: user.id, deletedAt: null, status: { in: TAREFA_ABERTA }, caso: { deletedAt: null } },
        include: { caso: { select: { id: true, codigo: true, titulo: true } }, responsavel: pessoa },
        orderBy: [{ prazo: "asc" }],
      }),
      this.db.estrategicoCaso.findMany({
        where: {
          organizationId: orgId, deletedAt: null,
          OR: [{ proximaAcaoResponsavelId: user.id }, { responsavelOperacionalId: user.id }, { responsavelExecutivoId: user.id }],
        },
        include: includeCaso(),
      }),
      this.repo.config(orgId),
    ]);
    const ctx = { hoje: new Date(), parametros: parametrosDe(config), verFinanceiro: verFinanceiro(user) };
    const ativos = casos.map((c: any) => apresentarCaso(c, ctx)).filter((c: any) => c.ativo);
    const nulosNoFim = (a: number | null, b: number | null) => (a == null ? 1 : b == null ? -1 : a - b);
    return {
      acoes: ativos.filter((c: any) => c.proximaAcaoResponsavel?.id === user.id)
        .sort((a: any, b: any) => nulosNoFim(a.diasProximaAcao, b.diasProximaAcao)),
      responsavelDe: ativos.filter((c: any) => c.proximaAcaoResponsavel?.id !== user.id).sort(ordenarPorGravidade),
      tarefas: tarefas.map((t: any) => this.apresentarTarefa(t)),
    };
  }

  async criarTarefa(
    user: Usuario, casoId: string, dto: CriarTarefaDto,
    extra: { origem?: string; reuniaoId?: string; chaveAutomacao?: string } = {}, ip?: string,
  ) {
    const caso = await this.casos.exigir(user, casoId);
    if (!podeRegistrar(user, caso)) throw new ForbiddenException("Sem permissão para criar tarefas neste assunto.");
    await this.validarUsuario(user.organizationId, dto.responsavelId);

    const tarefa = await this.db.estrategicoTarefa.create({
      data: {
        organizationId: user.organizationId, casoId, titulo: dto.titulo.trim(), descricao: dto.descricao ?? null,
        responsavelId: dto.responsavelId ?? null, prazo: paraData(dto.prazo) ?? null,
        prioridade: dto.prioridade ?? "media", dependencia: dto.dependencia ?? null,
        origem: extra.origem ?? "manual", reuniaoId: extra.reuniaoId ?? null,
        chaveAutomacao: extra.chaveAutomacao ?? null, criadoPorId: user.id,
      },
      include: { responsavel: pessoa },
    });
    await this.repo.historico(user.organizationId, casoId, {
      userId: user.id, acao: "tarefa", ip, origem: extra.origem === "reuniao" ? "reuniao" : "web",
      descricao: `Tarefa criada: ${tarefa.titulo}${tarefa.responsavel ? ` — ${tarefa.responsavel.nome}` : ""}${tarefa.prazo ? ` — até ${dataBr(tarefa.prazo)}` : ""}`,
    });
    if (tarefa.responsavelId && tarefa.responsavelId !== user.id) {
      const config = await this.repo.config(user.organizationId);
      await this.aviso.avisar({
        organizationId: user.organizationId, userId: tarefa.responsavelId, tipo: "estrategico_tarefa",
        titulo: `Nova tarefa estratégica — ${caso.codigo}`,
        mensagem: `${tarefa.titulo}${tarefa.prazo ? ` (até ${dataBr(tarefa.prazo)})` : ""}`,
        casoId, tarefaId: tarefa.id, chave: `tarefa-atribuida:${tarefa.id}:${tarefa.responsavelId}`,
      }, config);
    }
    await this.casos.recalcularFarol(user.organizationId, casoId);
    return this.apresentarTarefa(tarefa);
  }

  async atualizarTarefa(user: Usuario, tarefaId: string, dto: AtualizarTarefaDto, ip?: string) {
    const t = await this.db.estrategicoTarefa.findFirst({
      where: { id: tarefaId, organizationId: user.organizationId, deletedAt: null },
      include: { responsavel: pessoa },
    });
    if (!t) throw new NotFoundException("Tarefa não encontrada");
    const caso = await this.casos.exigir(user, t.casoId);

    const podeTudo = podeEditarCaso(user, caso);
    const executa = tem(user, P.tarefa.executar) && (t.responsavelId === user.id || t.criadoPorId === user.id);
    if (!podeTudo && !executa) throw new ForbiddenException("Sem permissão para alterar esta tarefa.");
    if (!podeTudo && dto.responsavelId !== undefined && dto.responsavelId !== t.responsavelId) {
      throw new ForbiddenException("Só quem edita o assunto pode reatribuir a tarefa.");
    }
    await this.validarUsuario(user.organizationId, dto.responsavelId);

    const data: any = {};
    for (const k of ["titulo", "descricao", "responsavelId", "prioridade", "status", "dependencia", "conclusao"] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.prazo !== undefined) data.prazo = paraData(dto.prazo);

    const concluindo = dto.status === "concluida" && t.status !== "concluida";
    const reabrindo = dto.status !== undefined && dto.status !== "concluida" && t.status === "concluida";
    if (concluindo) data.concluidaEm = new Date();
    if (reabrindo) data.concluidaEm = null;

    const atualizada = await this.db.estrategicoTarefa.update({ where: { id: tarefaId }, data, include: { responsavel: pessoa } });

    const partes: string[] = [];
    if (dto.status !== undefined && dto.status !== t.status) partes.push(`status ${t.status} → ${dto.status}`);
    if (dto.prazo !== undefined && (t.prazo?.toISOString() ?? null) !== (data.prazo?.toISOString() ?? null)) {
      partes.push(`prazo ${dataBr(t.prazo)} → ${dataBr(data.prazo)}`);
    }
    if (dto.responsavelId !== undefined && dto.responsavelId !== t.responsavelId) {
      partes.push(`responsável ${t.responsavel?.nome ?? "—"} → ${atualizada.responsavel?.nome ?? "—"}`);
    }
    if (dto.prioridade !== undefined && dto.prioridade !== t.prioridade) {
      partes.push(`prioridade ${ROTULO_PRIORIDADE[t.prioridade]} → ${ROTULO_PRIORIDADE[dto.prioridade]}`);
    }
    await this.repo.historico(user.organizationId, t.casoId, {
      userId: user.id, acao: "tarefa", ip,
      descricao: `Tarefa "${atualizada.titulo}"${partes.length ? `: ${partes.join("; ")}` : " editada"}.`,
    });

    if (concluindo) {
      const followUp = t.chaveAutomacao?.startsWith("followup:");
      const hoje = hojeData();
      await this.db.estrategicoEvento.create({
        data: {
          organizationId: user.organizationId, casoId: t.casoId, tipo: followUp ? "cobranca" : "andamento",
          dataEvento: hoje, titulo: `Tarefa concluída: ${atualizada.titulo}`,
          descricao: dto.conclusao ?? atualizada.conclusao ?? null, autorId: user.id, origem: "sistema",
        },
      });
      await this.atualizarUltimaMovimentacao(t.casoId);
      if (followUp) {
        const dependenciaId = t.chaveAutomacao!.split(":")[1];
        const config = await this.repo.config(user.organizationId);
        await this.db.estrategicoDependencia.updateMany({
          where: { id: dependenciaId, organizationId: user.organizationId },
          data: { ultimoFollowUpEm: hoje, proximoFollowUpEm: new Date(hoje.getTime() + config.diasFollowUp * 86_400_000) },
        });
      }
    }

    if (dto.responsavelId && dto.responsavelId !== t.responsavelId && dto.responsavelId !== user.id) {
      const config = await this.repo.config(user.organizationId);
      await this.aviso.avisar({
        organizationId: user.organizationId, userId: dto.responsavelId, tipo: "estrategico_tarefa",
        titulo: `Tarefa estratégica atribuída — ${caso.codigo}`, mensagem: atualizada.titulo,
        casoId: t.casoId, tarefaId: t.id, chave: `tarefa-atribuida:${t.id}:${dto.responsavelId}`,
      }, config);
    }

    await this.casos.recalcularFarol(user.organizationId, t.casoId);
    return this.apresentarTarefa(atualizada);
  }

  async excluirTarefa(user: Usuario, tarefaId: string, ip?: string) {
    const t = await this.db.estrategicoTarefa.findFirst({ where: { id: tarefaId, organizationId: user.organizationId, deletedAt: null } });
    if (!t) throw new NotFoundException("Tarefa não encontrada");
    const caso = await this.casos.exigir(user, t.casoId);
    if (!podeEditarCaso(user, caso)) throw new ForbiddenException("Sem permissão para excluir tarefas.");
    await this.db.estrategicoTarefa.update({ where: { id: tarefaId }, data: { deletedAt: new Date() } });
    await this.repo.historico(user.organizationId, t.casoId, { userId: user.id, acao: "tarefa", ip, descricao: `Tarefa excluída: ${t.titulo}` });
    await this.casos.recalcularFarol(user.organizationId, t.casoId);
    return { ok: true };
  }

  /* ── Comentários ───────────────────────────────────────────────────────── */

  async comentarios(user: Usuario, casoId: string) {
    await this.casos.exigir(user, casoId);
    return this.db.estrategicoComentario.findMany({
      where: { casoId, organizationId: user.organizationId, deletedAt: null },
      include: { user: pessoa },
      orderBy: { criadoEm: "desc" },
    });
  }

  async comentar(user: Usuario, casoId: string, dto: ComentarDto, ip?: string) {
    const caso = await this.casos.exigir(user, casoId);
    if (!podeRegistrar(user, caso)) throw new ForbiddenException("Sem permissão para comentar neste assunto.");
    if (!dto.conteudo?.trim()) throw new BadRequestException("Comentário vazio.");
    const c = await this.db.estrategicoComentario.create({
      data: { organizationId: user.organizationId, casoId, userId: user.id, conteudo: dto.conteudo.trim() },
      include: { user: pessoa },
    });
    await this.repo.historico(user.organizationId, casoId, {
      userId: user.id, acao: "comentou", ip, descricao: dto.conteudo.trim().slice(0, 300),
    });
    return c;
  }

  async excluirComentario(user: Usuario, id: string) {
    const c = await this.db.estrategicoComentario.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!c) throw new NotFoundException("Comentário não encontrado");
    const caso = await this.casos.exigir(user, c.casoId);
    if (c.userId !== user.id && !podeEditarCaso(user, caso)) throw new ForbiddenException("Só o autor pode excluir o comentário.");
    await this.db.estrategicoComentario.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  /* ── Dependências ──────────────────────────────────────────────────────── */

  async dependencias(user: Usuario, casoId: string) {
    await this.casos.exigir(user, casoId);
    const lista = await this.db.estrategicoDependencia.findMany({
      where: { casoId, organizationId: user.organizationId },
      include: { catalogo: { select: { id: true, nome: true, natureza: true } } },
      orderBy: { criadoEm: "asc" },
    });
    return lista
      .map((d: any) => ({ ...d, nome: d.catalogo?.nome ?? d.organizacao ?? "Terceiro", dias: d.desde ? diasEntre(d.desde, new Date()) : null }))
      .sort((a: any, b: any) => Number(!!a.resolvidaEm) - Number(!!b.resolvidaEm));
  }

  private async validarCatalogoDependencia(orgId: string, catalogoId?: string | null) {
    if (!catalogoId) return null;
    const c = await this.db.estrategicoCatalogo.findFirst({ where: { id: catalogoId, organizationId: orgId, tipo: "dependencia" } });
    if (!c) throw new BadRequestException("Tipo de dependência inválido.");
    return c;
  }

  async criarDependencia(user: Usuario, casoId: string, dto: DependenciaDto, ip?: string) {
    const caso = await this.casos.exigir(user, casoId);
    if (!podeEditarCaso(user, caso)) throw new ForbiddenException("Sem permissão para registrar dependências.");
    if (!dto.catalogoId && !dto.organizacao?.trim()) throw new BadRequestException("Informe de quem o assunto depende.");
    const cat = await this.validarCatalogoDependencia(user.organizationId, dto.catalogoId);
    const d = await this.db.estrategicoDependencia.create({
      data: {
        organizationId: user.organizationId, casoId, catalogoId: dto.catalogoId ?? null,
        organizacao: dto.organizacao?.trim() || null, contato: dto.contato ?? null, descricao: dto.descricao ?? null,
        desde: paraData(dto.desde) ?? hojeData(), respostaEsperadaEm: paraData(dto.respostaEsperadaEm) ?? null,
        ultimoFollowUpEm: paraData(dto.ultimoFollowUpEm) ?? null, proximoFollowUpEm: paraData(dto.proximoFollowUpEm) ?? null,
      },
    });
    await this.repo.historico(user.organizationId, casoId, {
      userId: user.id, acao: "dependencia", ip,
      descricao: `Dependência registrada: aguardando ${cat?.nome ?? d.organizacao} desde ${dataBr(d.desde)}.`,
    });
    await this.casos.recalcularFarol(user.organizationId, casoId);
    return d;
  }

  async atualizarDependencia(user: Usuario, id: string, dto: DependenciaDto, ip?: string) {
    const d = await this.db.estrategicoDependencia.findFirst({
      where: { id, organizationId: user.organizationId }, include: { catalogo: true },
    });
    if (!d) throw new NotFoundException("Dependência não encontrada");
    const caso = await this.casos.exigir(user, d.casoId);
    if (!podeEditarCaso(user, caso)) throw new ForbiddenException("Sem permissão para alterar dependências.");
    if (dto.catalogoId !== undefined) await this.validarCatalogoDependencia(user.organizationId, dto.catalogoId);

    const data: any = {};
    for (const k of ["catalogoId", "organizacao", "contato", "descricao"] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    for (const k of ["desde", "respostaEsperadaEm", "ultimoFollowUpEm", "proximoFollowUpEm"] as const) {
      if (dto[k] !== undefined) data[k] = paraData(dto[k]);
    }
    if (dto.resolvida !== undefined) data.resolvidaEm = dto.resolvida ? d.resolvidaEm ?? new Date() : null;

    const atualizada = await this.db.estrategicoDependencia.update({ where: { id }, data });
    const nome = d.catalogo?.nome ?? d.organizacao ?? "terceiro";
    await this.repo.historico(user.organizationId, d.casoId, {
      userId: user.id, acao: "dependencia", ip,
      descricao: dto.resolvida === true && !d.resolvidaEm
        ? `Dependência de ${nome} resolvida.`
        : dto.resolvida === false && d.resolvidaEm ? `Dependência de ${nome} reaberta.` : `Dependência de ${nome} atualizada.`,
    });
    await this.casos.recalcularFarol(user.organizationId, d.casoId);
    return atualizada;
  }

  async excluirDependencia(user: Usuario, id: string, ip?: string) {
    const d = await this.db.estrategicoDependencia.findFirst({ where: { id, organizationId: user.organizationId }, include: { catalogo: true } });
    if (!d) throw new NotFoundException("Dependência não encontrada");
    const caso = await this.casos.exigir(user, d.casoId);
    if (!podeEditarCaso(user, caso)) throw new ForbiddenException("Sem permissão para excluir dependências.");
    await this.db.estrategicoDependencia.delete({ where: { id } });
    await this.repo.historico(user.organizationId, d.casoId, {
      userId: user.id, acao: "dependencia", ip,
      descricao: `Dependência de ${d.catalogo?.nome ?? d.organizacao ?? "terceiro"} excluída (registro indevido).`,
    });
    await this.casos.recalcularFarol(user.organizationId, d.casoId);
    return { ok: true };
  }
}
