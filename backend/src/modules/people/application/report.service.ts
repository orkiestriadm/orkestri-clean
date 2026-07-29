import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import { ReportRepository } from "../infrastructure/report.repository";
import { DevelopmentRepository } from "../infrastructure/development.repository";
import { BenefitRepository } from "../infrastructure/benefit.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import {
  turnover, tempoMedioDeCasaMeses, distribuicao, montarCsv, arredondar,
} from "../domain/report.entity";
import { EMPLOYEE_STATUS } from "../domain/employee.entity";
import { collaboratorDisplayName } from "../../../common/collaborator";

/**
 * Painéis de pessoas.
 *
 * Todo número aqui respeita o escopo do usuário: gestor vê a equipe, RH vê a
 * organização. Um indicador que ignore escopo vaza headcount e distribuição
 * salarial indireta de área que a pessoa não deveria enxergar.
 */

const JANELA_PADRAO_MESES = 12;

@Injectable()
export class ReportService {
  constructor(
    private readonly repo: ReportRepository,
    private readonly desenvolvimento: DevelopmentRepository,
    private readonly beneficios: BenefitRepository,
    private readonly escopo: PeopleScopeService,
  ) {}

  /** Painel principal: quadro, movimentação e pendências. */
  async visaoGeral(user: UsuarioContexto, meses = JANELA_PADRAO_MESES) {
    const { organizationId, ids } = await this.contexto(user);

    if (meses < 1 || meses > 60) {
      throw new BadRequestException("A janela deve estar entre 1 e 60 meses.");
    }

    const hoje = new Date();
    const de = new Date(hoje);
    de.setMonth(de.getMonth() - meses);

    const [
      porStatus, porSetor, porCargo, porVinculo, setores, cargos,
      admissoes, desligamentos, efetivoInicial, docsPorAprovacao, docsVencendo, periodos,
    ] = await Promise.all([
      this.repo.contarPorStatus(organizationId, ids),
      this.repo.contarPorSetor(organizationId, ids),
      this.repo.contarPorCargo(organizationId, ids),
      this.repo.contarPorVinculo(organizationId, ids),
      this.repo.nomesDeSetor(organizationId),
      this.repo.nomesDeCargo(organizationId),
      this.repo.admissoesNoPeriodo(organizationId, de, hoje, ids),
      this.repo.desligamentosNoPeriodo(organizationId, de, hoje, ids),
      this.repo.ativosAntesDe(organizationId, de, ids),
      this.repo.contarDocumentosPorAprovacao(organizationId, ids),
      this.repo.documentosVencendo(organizationId, this.emDias(30), ids),
      this.repo.periodosParaSaldo(organizationId, ids),
    ]);

    const contagem = (lista: any[], chave: string) =>
      lista.map(l => ({ chave: l[chave] as string | null, total: l._count._all as number }));

    const ativos = porStatus.find((s: any) => s.status === EMPLOYEE_STATUS.ATIVO)?._count._all ?? 0;
    const total = porStatus.reduce((s: number, x: any) => s + x._count._all, 0);

    // Efetivo final = ativos de hoje. Comparar com o de N meses atrás é o que
    // dá sentido ao turnover.
    const rotatividade = turnover({
      admissoes: admissoes.length,
      desligamentos: desligamentos.length,
      efetivoInicial,
      efetivoFinal: ativos,
    });

    const linhasAdmissao = await this.repo.linhasParaExportar(organizationId, ids);
    const tempoMedio = tempoMedioDeCasaMeses(
      linhasAdmissao
        .filter((c: any) => c.status === EMPLOYEE_STATUS.ATIVO)
        .map((c: any) => c.dataAdmissao),
      hoje,
    );

    const saldoFerias = periodos.reduce(
      (s: number, p: any) => s + Math.max(0, p.diasDireito - p.diasGozados), 0,
    );
    const passivoVencido = periodos
      .filter((p: any) => p.limiteConcessivo < hoje && p.diasDireito > p.diasGozados)
      .reduce((s: number, p: any) => s + (p.diasDireito - p.diasGozados), 0);

    return {
      success: true,
      data: {
        janelaMeses: meses,
        escopoOrganizacional: ids === undefined,
        quadro: {
          total,
          ativos,
          porStatus: porStatus.map((s: any) => ({ status: s.status, total: s._count._all })),
          tempoMedioCasaMeses: tempoMedio,
        },
        movimentacao: {
          admissoes: admissoes.length,
          desligamentos: desligamentos.length,
          saldo: admissoes.length - desligamentos.length,
          turnoverPercentual: rotatividade,
          efetivoInicial,
        },
        distribuicoes: {
          porSetor: distribuicao(
            contagem(porSetor, "setorId"),
            new Map(setores.map((s: any) => [s.id, s.nome])),
            "Sem setor",
          ),
          porCargo: distribuicao(
            contagem(porCargo, "positionId"),
            new Map(cargos.map((c: any) => [c.id, c.titulo])),
            "Sem cargo no catálogo",
          ),
          porVinculo: distribuicao(contagem(porVinculo, "tipoVinculo"), new Map()),
        },
        documentos: {
          porAprovacao: docsPorAprovacao.map((d: any) => ({
            aprovacao: d.aprovacao, total: d._count._all,
          })),
          vencendoEm30Dias: docsVencendo,
        },
        ferias: {
          saldoTotalDias: saldoFerias,
          passivoVencidoDias: passivoVencido,
        },
      },
    };
  }

  /** Painel de desenvolvimento: treinamentos e desempenho. */
  async desenvolvimentoGeral(user: UsuarioContexto) {
    const { organizationId, ids } = await this.contexto(user);

    const [porStatus, mediaCiclos, vencendo] = await Promise.all([
      this.desenvolvimento.contarParticipacoesPorStatus(organizationId, ids),
      this.desenvolvimento.mediaPorCiclo(organizationId, ids),
      this.desenvolvimento.certificacoesVencendoAte(organizationId, this.emDias(60), ids),
    ]);

    return {
      success: true,
      data: {
        treinamentos: porStatus.map((t: any) => ({ status: t.status, total: t._count._all })),
        certificacoesVencendo: vencendo.length,
        desempenhoPorCiclo: mediaCiclos.map((c: any) => ({
          ciclo: c.ciclo,
          media: c._avg.nota === null ? null : arredondar(c._avg.nota),
          avaliacoes: c._count._all,
        })),
      },
    };
  }

  /** Painel de benefícios: custo mensal por benefício e cobertura. */
  async beneficiosGeral(user: UsuarioContexto) {
    const { organizationId, ids } = await this.contexto(user);
    const vigentes = await this.beneficios.concessoesVigentes(organizationId, ids);

    const porBeneficio = new Map<string, { nome: string; categoria: string; pessoas: number; custo: number }>();
    const pessoasCobertas = new Set<string>();

    for (const c of vigentes as any[]) {
      pessoasCobertas.add(c.collaboratorId);
      const atual = porBeneficio.get(c.benefit.id) ?? {
        nome: c.benefit.nome, categoria: c.benefit.categoria, pessoas: 0, custo: 0,
      };
      atual.pessoas += 1;
      atual.custo += c.valor ?? 0;
      porBeneficio.set(c.benefit.id, atual);
    }

    const itens = [...porBeneficio.values()].sort((a, b) => b.custo - a.custo);

    return {
      success: true,
      data: {
        pessoasCobertas: pessoasCobertas.size,
        custoMensalTotal: arredondar(itens.reduce((s, i) => s + i.custo, 0)),
        porBeneficio: itens.map(i => ({ ...i, custo: arredondar(i.custo) })),
      },
    };
  }

  /**
   * Exportação do quadro em CSV.
   *
   * CSV e não XLSX de propósito: o consumidor é planilha, o arquivo precisa
   * abrir em qualquer ferramenta, e gerar XLSX exigiria dependência nova para
   * resolver um problema que não existe.
   */
  async exportarQuadro(user: UsuarioContexto): Promise<{ nome: string; conteudo: string }> {
    const { organizationId, ids } = await this.contexto(user);
    const linhas = await this.repo.linhasParaExportar(organizationId, ids);

    const cabecalho = [
      "Matrícula", "Nome", "E-mail corporativo", "Situação", "Cargo", "Setor",
      "Gestor", "Admissão", "Desligamento", "Vínculo", "Senioridade", "Acesso ao sistema",
    ];

    const corpo = linhas.map((c: any) => [
      c.matricula,
      collaboratorDisplayName(c),
      c.emailCorporativo ?? c.user?.email ?? null,
      c.status,
      // O cargo do catálogo prevalece sobre o texto livre: quando os dois
      // existem, o texto é resquício do cadastro antigo.
      c.position?.titulo ?? c.cargo ?? null,
      c.setor?.nome ?? null,
      c.gestor ? collaboratorDisplayName(c.gestor) : null,
      c.dataAdmissao,
      c.dataDesligamento,
      c.tipoVinculo,
      c.senioridade,
      c.user ? "Sim" : "Não",
    ]);

    const hoje = new Date().toISOString().slice(0, 10);
    return {
      nome: `colaboradores-${hoje}.csv`,
      conteudo: montarCsv(cabecalho, corpo),
    };
  }

  /* ── Auxiliares ───────────────────────────────────────────────────────── */

  private async contexto(user: UsuarioContexto) {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo === "nenhum") throw new ForbiddenException("Sem escopo de acesso");
    return {
      organizationId: user.organizationId,
      ids: escopo.tipo === "organizacao" ? undefined : escopo.collaboratorIds,
    };
  }

  private emDias(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d;
  }
}
