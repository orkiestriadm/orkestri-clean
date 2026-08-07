import {
  Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { CatalogoRepository } from "../infrastructure/catalogo.repository";
import { ObrigacaoRepository } from "../infrastructure/obrigacao.repository";
import { HistoricoRepository } from "../infrastructure/arquivo.repository";
import { DecidirAprovacaoDto } from "./dto/configuracao.dto";

type Usuario = { id: string; organizationId: string; roles?: string[]; isMaster?: boolean };

/**
 * Fluxo de aprovação.
 *
 * O fluxo é do administrador: ele desenha as etapas (analista → supervisor →
 * gerente → diretor, ou duas, ou nenhuma) e amarra a uma categoria. Categoria
 * sem fluxo publica direto — obrigar aprovação onde ninguém a pediu só criaria
 * uma fila que ninguém olha.
 */
@Injectable()
export class FluxoService {
  private readonly logger = new Logger(FluxoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogo: CatalogoRepository,
    private readonly obrigacoes: ObrigacaoRepository,
    private readonly historico: HistoricoRepository,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  /**
   * Coloca a obrigação na primeira etapa do fluxo da categoria.
   *
   * Sem fluxo configurado, não faz nada e devolve `null` — o chamador segue em
   * frente. É o caminho da maioria: fluxo é exceção, não regra.
   */
  async iniciar(user: Usuario, obrigacaoId: string) {
    const obrigacao = await this.exigir(user, obrigacaoId);

    const fluxo = await this.catalogo.fluxoDaCategoria(user.organizationId, obrigacao.categoriaId);
    if (!fluxo?.etapas?.length) return null;

    const primeira = fluxo.etapas[0];
    await this.entrarNaEtapa(user, obrigacao, primeira);
    return this.situacao(user, obrigacaoId);
  }

  /**
   * Registra a decisão de uma etapa e avança.
   *
   * Rejeitar sem motivo deixa quem cadastrou sem saber o que corrigir — a regra
   * está aqui e não no DTO porque é regra de negócio, não de formato.
   */
  async decidir(user: Usuario, obrigacaoId: string, dto: DecidirAprovacaoDto, ip?: string) {
    const obrigacao = await this.exigir(user, obrigacaoId);
    if (!obrigacao.etapaId) {
      throw new BadRequestException("Esta obrigação não está em nenhuma etapa de aprovação.");
    }
    if (dto.decisao === "rejeitado" && !dto.motivo?.trim()) {
      throw new BadRequestException("Informe o motivo da rejeição.");
    }

    const etapa = await this.catalogo.obterEtapa(user.organizationId, obrigacao.etapaId);
    if (!etapa) throw new NotFoundException("Etapa não encontrada");

    this.exigirPapel(user, etapa);

    const pendente = await this.catalogo.aprovacaoPendente(obrigacaoId, etapa.id);
    if (!pendente) throw new BadRequestException("Não há aprovação pendente nesta etapa.");

    await this.catalogo.atualizarAprovacao(pendente.id, {
      decisao: dto.decisao,
      aprovadorId: user.id,
      motivo: dto.motivo ?? null,
      decididoEm: new Date(),
    });

    if (dto.decisao === "rejeitado") {
      // Rejeitar tira do fluxo e suspende: a obrigação volta para quem a
      // cadastrou corrigir, não fica presa numa etapa esperando alguém mudar
      // de ideia.
      await this.obrigacoes.atualizar(obrigacaoId, {
        etapaId: null, status: "suspensa", atualizadoPorId: user.id,
      });
      await this.registrar(user, obrigacaoId, "rejeitou",
        `Etapa "${etapa.nome}" rejeitada. Motivo: ${dto.motivo}`, ip);
      await this.auditar(user, obrigacaoId, "rejeitar",
        `Obrigação ${obrigacao.codigo} rejeitada na etapa ${etapa.nome}`, ip);
      return this.situacao(user, obrigacaoId);
    }

    await this.registrar(user, obrigacaoId, "aprovou", `Etapa "${etapa.nome}" aprovada.`, ip);
    await this.auditar(user, obrigacaoId, "aprovar",
      `Obrigação ${obrigacao.codigo} aprovada na etapa ${etapa.nome}`, ip);

    const proxima = (etapa.fluxo?.etapas ?? [])
      .filter((e: any) => e.ordem > etapa.ordem)
      .sort((a: any, b: any) => a.ordem - b.ordem)[0];

    if (proxima) {
      await this.entrarNaEtapa(user, { ...obrigacao, etapaId: etapa.id }, proxima);
    } else {
      // Última etapa aprovada: sai do fluxo e vira ativa, com a data de
      // aprovação preenchida — é o campo que a especificação pede e que o
      // auditor procura.
      await this.obrigacoes.atualizar(obrigacaoId, {
        etapaId: null, status: "ativa", dataAprovacao: new Date(), atualizadoPorId: user.id,
      });
      await this.registrar(user, obrigacaoId, "aprovou",
        "Fluxo de aprovação concluído — obrigação ativa.", ip);
    }

    return this.situacao(user, obrigacaoId);
  }

  /** Fila de aprovações pendentes do usuário — o que ESPERA por ele. */
  async pendentes(user: Usuario) {
    const todas = await this.catalogo.listarAprovacoesPendentes(user.organizationId);
    if (user.isMaster) return todas;

    const papeis = user.roles ?? [];
    // Etapa sem papel definido é aberta a quem tem a permissão de aprovar; o
    // guard do controller já garantiu que ele a tem.
    return todas.filter((a: any) =>
      !a.etapa?.papelAprovador || papeis.includes(a.etapa.papelAprovador));
  }

  async situacao(user: Usuario, obrigacaoId: string) {
    const obrigacao = await this.exigir(user, obrigacaoId);
    const aprovacoes = await this.db.complianceAprovacao.findMany({
      where: { obrigacaoId },
      orderBy: { criadoEm: "asc" },
      include: {
        etapa: { select: { id: true, nome: true, ordem: true, papelAprovador: true } },
        aprovador: { select: { id: true, nome: true, avatar: true } },
      },
    });

    return {
      obrigacaoId,
      etapaAtualId: obrigacao.etapaId,
      status: obrigacao.status,
      dataAprovacao: obrigacao.dataAprovacao,
      aprovacoes,
    };
  }

  /* ── Auxiliares ────────────────────────────────────────────────────────── */

  private async entrarNaEtapa(user: Usuario, obrigacao: any, etapa: any) {
    await this.obrigacoes.atualizar(obrigacao.id, {
      etapaId: etapa.id,
      ...(etapa.statusAoEntrar ? { status: etapa.statusAoEntrar } : {}),
      atualizadoPorId: user.id,
    });

    // Etapa que não exige aprovação é só uma marcação de estado — não cria
    // pendência, senão a fila encheria de itens que ninguém precisa decidir.
    if (!etapa.exigeAprovacao) return;

    await this.catalogo.criarAprovacao({
      id: randomUUID(),
      organizationId: user.organizationId,
      obrigacaoId: obrigacao.id,
      etapaId: etapa.id,
      decisao: "pendente",
    });

    await this.registrar(user, obrigacao.id, "mudou_status",
      `Entrou na etapa "${etapa.nome}" do fluxo de aprovação.`);
  }

  private exigirPapel(user: Usuario, etapa: any) {
    if (user.isMaster) return;
    if (!etapa.papelAprovador) return;
    if ((user.roles ?? []).includes(etapa.papelAprovador)) return;
    throw new ForbiddenException(
      `Esta etapa só pode ser decidida por quem tem o papel "${etapa.papelAprovador}".`,
    );
  }

  private async exigir(user: Usuario, obrigacaoId: string) {
    const o = await this.obrigacoes.obterCru(user.organizationId, obrigacaoId);
    if (!o) throw new NotFoundException("Obrigação não encontrada");
    return o;
  }

  private async registrar(
    user: Usuario, obrigacaoId: string, acao: string, descricao: string, ip?: string,
  ) {
    try {
      await this.historico.registrar({
        organizationId: user.organizationId,
        obrigacaoId, userId: user.id, acao, descricao, ip: ip ?? null,
      });
    } catch (erro) {
      this.logger.error(`Falha ao gravar histórico de fluxo em ${obrigacaoId}`, erro as Error);
    }
  }

  private async auditar(
    user: Usuario, registroId: string, acao: string, descricao: string, ip?: string,
  ) {
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "compliance",
      tabela: "compliance_aprovacoes", registroId, acao, descricao, ip: ip ?? null,
    });
  }
}
