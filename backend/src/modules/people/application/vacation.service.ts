import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { IsString, IsOptional, IsDateString, MaxLength } from "class-validator";
import { VacationRepository } from "../infrastructure/vacation.repository";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { PeopleEventsPublisher } from "../domain/people-events.publisher";
import { AuditService } from "../../audit/audit.module";
import {
  periodosAquisitivos, statusDoPeriodo, saldoDoPeriodo, saldoDisponivel,
  periodosVencendo, validarJanela, escolherPeriodoParaDebito, diffEmDias,
  VACATION_PERIOD_STATUS, DIAS_ALERTA_VENCIMENTO_FERIAS, PeriodoAquisitivo,
} from "../domain/vacation.entity";
import { EMPLOYEE_STATUS } from "../domain/employee.entity";

/**
 * Férias — períodos aquisitivos e saldo.
 *
 * O CRUD e o fluxo de aprovação de ausência continuam em AusenciasService: são
 * genéricos e servem atestado, folga e licença também. Este serviço acrescenta
 * o que só férias têm — período aquisitivo, saldo e prazo concessivo — e cria a
 * solicitação já validada e vinculada ao período que ela debita.
 *
 * A aprovação segue pelo fluxo existente. `diasGozados` é recalculado a cada
 * consulta a partir das ausências, então nenhuma sincronização é necessária
 * quando alguém aprova ou cancela por lá.
 */

export class SolicitarFeriasDto {
  @IsDateString() dataInicio!: string;
  @IsDateString() dataFim!: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
}

@Injectable()
export class VacationService {
  private readonly logger = new Logger(VacationService.name);

  constructor(
    private readonly repo: VacationRepository,
    private readonly historico: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly eventos: PeopleEventsPublisher,
    private readonly audit: AuditService,
  ) {}

  /**
   * Situação de férias do colaborador.
   *
   * Sincroniza os períodos antes de responder: quem completou mais um ano desde
   * a última consulta precisa ver o período novo sem depender de rotina noturna.
   */
  async situacao(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const colaborador = await this.repo.dataAdmissao(collaboratorId, organizationId);
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");

    if (!colaborador.dataAdmissao) {
      // Sem admissão não há como calcular período — é dado faltando, não erro.
      return {
        success: true,
        data: {
          semDataAdmissao: true,
          saldoDisponivel: 0,
          periodos: [],
          // Número, igual ao outro ramo: o mesmo campo não pode mudar de tipo
          // conforme o caminho — o consumidor não tem como saber qual recebeu.
          vencendo: 0,
        },
      };
    }

    const periodos = await this.sincronizarEResolver(organizationId, collaboratorId, colaborador.dataAdmissao);
    const hoje = new Date();

    return {
      success: true,
      data: {
        semDataAdmissao: false,
        saldoDisponivel: saldoDisponivel(periodos.map(p => p.calculado), hoje),
        periodos: periodos.map(p => ({
          id: p.id,
          inicio: p.calculado.inicio,
          fim: p.calculado.fim,
          limiteConcessivo: p.calculado.limiteConcessivo,
          diasDireito: p.calculado.diasDireito,
          diasGozados: p.calculado.diasGozados,
          saldo: saldoDoPeriodo(p.calculado),
          status: statusDoPeriodo(p.calculado, hoje),
          diasParaVencer: diffEmDias(hoje, p.calculado.limiteConcessivo),
        })),
        vencendo: periodosVencendo(periodos.map(p => p.calculado), hoje).length,
      },
    };
  }

  async solicitar(user: UsuarioContexto, collaboratorId: string, dto: SolicitarFeriasDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const colaborador = await this.repo.dataAdmissao(collaboratorId, organizationId);
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");

    // Desligado não tira férias; afastado tampouco. PEOPLE_WORKFLOWS.md §6.
    if (colaborador.status !== EMPLOYEE_STATUS.ATIVO) {
      throw new BadRequestException(
        `Colaborador com situação ${colaborador.status} não pode solicitar férias.`,
      );
    }
    if (!colaborador.dataAdmissao) {
      throw new BadRequestException(
        "Colaborador sem data de admissão: não há como calcular o período aquisitivo.",
      );
    }

    const periodos = await this.sincronizarEResolver(organizationId, collaboratorId, colaborador.dataAdmissao);
    const hoje = new Date();

    // Janela primeiro: data invertida, fracionamento e conflito de agenda não
    // dependem de saldo, e diagnosticá-los antes evita mensagem enganosa.
    const ocupados = await this.repo.ausenciasAtivas(collaboratorId);
    const validacao = validarJanela({
      inicio: new Date(dto.dataInicio),
      fim: new Date(dto.dataFim),
      ocupados,
    });
    if (!validacao.valido) throw new BadRequestException(validacao.detalhe);

    const dias = validacao.dias!;
    const calculados = periodos.map(p => p.calculado);
    const escolhido = escolherPeriodoParaDebito(calculados, dias, hoje);

    if (!escolhido) {
      const total = saldoDisponivel(calculados, hoje);
      throw new BadRequestException(
        total === 0
          ? "Nenhum período aquisitivo com saldo disponível."
          : `Nenhum período aquisitivo comporta ${dias} dias de uma vez. ` +
            `Saldo total de ${total} dias, distribuído entre períodos — solicite períodos menores.`,
      );
    }

    const alvo = periodos.find(p => p.calculado === escolhido)!;

    const criada = await this.repo.criarSolicitacaoFerias({
      organizationId,
      collaboratorId,
      tipo: "ferias",
      dataInicio: new Date(dto.dataInicio),
      dataFim: new Date(dto.dataFim),
      diaInteiro: true,
      descricao: dto.observacao?.trim() || null,
      status: "PENDENTE",
      solicitadaPorId: user.id ?? null,
      vacationPeriodId: alvo.id,
    });

    await this.historico.registrar({
      organizationId,
      collaboratorId,
      evento: "outro",
      descricao:
        `Férias solicitadas: ${validacao.dias} dias ` +
        `(${new Date(dto.dataInicio).toLocaleDateString("pt-BR")} a ` +
        `${new Date(dto.dataFim).toLocaleDateString("pt-BR")})`,
      registradoPorId: user.id ?? null,
    });
    await this.auditar(user, criada.id, "criar", `Solicitação de férias: ${validacao.dias} dias`);

    this.eventos.publish("vacation.requested", {
      organizationId, employeeId: collaboratorId, ausenciaId: criada.id,
      atorId: user.id ?? null, ocorridoEm: new Date(),
      dias: validacao.dias, periodoId: alvo.id,
    });

    return { success: true, data: { ...criada, dias: validacao.dias, saldoRestante: saldoDoPeriodo(alvo.calculado) - validacao.dias! } };
  }

  /** Painel de passivo: quem tem período prestes a vencer. */
  async passivo(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo === "nenhum") throw new ForbiddenException("Sem escopo de acesso");

    const ids = escopo.tipo === "organizacao" ? undefined : escopo.collaboratorIds;
    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ALERTA_VENCIMENTO_FERIAS);

    const periodos = await this.repo.periodosVencendoAte(organizationId, limite, ids);
    const hoje = new Date();

    return {
      success: true,
      data: {
        janelaDias: DIAS_ALERTA_VENCIMENTO_FERIAS,
        periodos: periodos.map((p: any) => ({
          id: p.id,
          colaborador: {
            id: p.collaborator.id,
            nome: p.collaborator.nomeCompleto || p.collaborator.user?.nome || "—",
          },
          limiteConcessivo: p.limiteConcessivo,
          diasParaVencer: diffEmDias(hoje, p.limiteConcessivo),
          saldo: Math.max(0, p.diasDireito - p.diasGozados),
        })),
      },
    };
  }

  // ── Auxiliares ────────────────────────────────────────────────────────────

  /**
   * Garante que os períodos existem no banco e devolve cada um com o cálculo
   * atualizado de dias gozados.
   *
   * `diasGozados` vem das ausências, não da coluna: assim aprovar ou cancelar
   * pelo fluxo antigo de ausências reflete no saldo sem nenhuma integração.
   */
  /**
   * Materializa os periodos de todos os ativos.
   *
   * Sem isto, periodo so existe depois que alguem abre a aba do colaborador —
   * e o passivo de ferias, que e a razao de o modulo existir, ficava invisivel
   * para quem ninguem olhou.
   */
  async sincronizarQuadro(): Promise<{ sincronizados: number; falhas: number }> {
    const pessoas = await this.repo.colaboradoresParaSincronizar();
    let sincronizados = 0;
    let falhas = 0;
    for (const p of pessoas as any[]) {
      try {
        // Usa o MESMO caminho da tela: criar o periodo sem materializar
        // status deixava tudo como EM_AQUISICAO, e o painel de passivo — que
        // consulta por status — continuava vazio mesmo com periodo vencido.
        await this.sincronizarEResolver(p.organizationId, p.id, p.dataAdmissao);
        sincronizados += 1;
      } catch (erro) {
        // Uma pessoa com dado inconsistente nao pode derrubar a varredura das
        // outras: o valor esta em cobrir o quadro inteiro.
        falhas += 1;
        this.logger.error(`Falha ao sincronizar ferias de ${p.id}`, erro as Error);
      }
    }
    return { sincronizados, falhas };
  }

  private async sincronizarEResolver(
    organizationId: string,
    collaboratorId: string,
    dataAdmissao: Date,
  ): Promise<{ id: string; calculado: PeriodoAquisitivo }[]> {
    const calculados = periodosAquisitivos(dataAdmissao);
    await this.repo.sincronizar(organizationId, collaboratorId, calculados);

    const [persistidos, comprometidos] = await Promise.all([
      this.repo.listarPeriodos(collaboratorId, organizationId),
      this.repo.diasComprometidosPorPeriodo(collaboratorId),
    ]);

    const hoje = new Date();
    const resultado = persistidos.map((p: any) => {
      const calculado: PeriodoAquisitivo = {
        inicio: p.inicio,
        fim: p.fim,
        limiteConcessivo: p.limiteConcessivo,
        // `diasDireito` vem do banco: admite ajuste manual por faltas ou abono.
        diasDireito: p.diasDireito,
        diasGozados: comprometidos.get(p.id) ?? 0,
      };
      return { id: p.id, calculado, statusPersistido: p.status, diasGozadosPersistido: p.diasGozados };
    });

    // Materializa status e dias gozados quando divergirem, para que consulta
    // por status (painel de passivo) não precise recalcular a regra em SQL.
    await Promise.all(
      resultado
        .filter(r => {
          const s = statusDoPeriodo(r.calculado, hoje);
          return s !== r.statusPersistido || r.calculado.diasGozados !== r.diasGozadosPersistido;
        })
        .map(r =>
          this.repo
            .atualizarStatus(r.id, statusDoPeriodo(r.calculado, hoje), r.calculado.diasGozados)
            .catch(erro => this.logger.error(`Falha ao materializar período ${r.id}`, erro as Error)),
        ),
    );

    return resultado.map(({ id, calculado }) => ({ id, calculado }));
  }

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async exigirEscopo(user: UsuarioContexto, collaboratorId: string) {
    if (!(await this.escopo.podeAcessar(user, collaboratorId))) {
      throw new NotFoundException("Colaborador não encontrado");
    }
  }

  private async auditar(user: UsuarioContexto, registroId: string, acao: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela: "ausencias",
        registroId,
        acao,
        descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
