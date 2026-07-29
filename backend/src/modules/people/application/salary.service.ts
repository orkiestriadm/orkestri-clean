import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import {
  IsString, IsOptional, IsNumber, IsDateString, IsIn, MaxLength, Min,
} from "class-validator";
import { SalaryRepository } from "../infrastructure/salary.repository";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import {
  MOTIVOS_SALARIO, validarMudanca, salarioVigente, historicoComVariacao,
  posicaoNaFaixa, percentualNaFaixa, faixaValida, mesesDesde,
  MESES_ALERTA_SEM_REAJUSTE,
} from "../domain/salary.entity";
import { collaboratorDisplayName } from "../../../common/collaborator";
import { dataBR } from "../../../common/datas";

/**
 * Remuneração.
 *
 * O dado mais sensível do módulo: `people.salario:ver` fica FORA de qualquer
 * perfil padrão de leitura. Gestor que enxerga a equipe não vê salário só por
 * ser gestor — precisa da concessão explícita.
 *
 * Registro salarial, não folha: cálculo, imposto e eSocial seguem fora de
 * escopo (PEOPLE_HUB_BLUEPRINT.md §4).
 */

/** Rótulo do motivo para a linha do tempo funcional. */
const ROTULO_MOTIVO: Record<string, string> = {
  admissao: "admissão", merito: "mérito", promocao: "promoção",
  dissidio: "dissídio", enquadramento: "enquadramento",
  reducao: "redução", outro: "outro",
};

export class RegistrarSalarioDto {
  @IsNumber() @Min(0.01) valor!: number;
  @IsDateString() vigenciaInicio!: string;
  @IsIn(MOTIVOS_SALARIO as unknown as string[]) motivo!: string;
  @IsOptional() @IsString() @MaxLength(500) observacoes?: string;
}

export class FaixaDto {
  @IsOptional() @IsNumber() @Min(0) minimo?: number | null;
  @IsOptional() @IsNumber() @Min(0) medio?: number | null;
  @IsOptional() @IsNumber() @Min(0) maximo?: number | null;
}

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    private readonly repo: SalaryRepository,
    private readonly historicoFuncional: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Situação salarial do colaborador: vigente, histórico e posição na faixa. */
  async situacao(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const registros = await this.repo.historico(collaboratorId, organizationId);
    const hoje = new Date();
    const vigente = salarioVigente(registros, hoje);

    const positionId = await this.repo.cargoAtual(collaboratorId);
    const faixa = await this.repo.faixaDoCargo(positionId, organizationId);

    return {
      success: true,
      data: {
        vigente: vigente
          ? {
              valor: vigente.valor,
              vigenciaInicio: vigente.vigenciaInicio,
              motivo: vigente.motivo,
              mesesDesdeMudanca: mesesDesde(vigente.vigenciaInicio, hoje),
            }
          : null,
        // Só faz sentido alertar quem já tem salário registrado.
        semReajusteHa: vigente && mesesDesde(vigente.vigenciaInicio, hoje) >= MESES_ALERTA_SEM_REAJUSTE
          ? mesesDesde(vigente.vigenciaInicio, hoje)
          : null,
        faixa: faixa
          ? {
              ...faixa,
              posicao: vigente ? posicaoNaFaixa(vigente.valor, faixa) : "sem_faixa",
              percentual: vigente ? percentualNaFaixa(vigente.valor, faixa) : null,
            }
          : null,
        historico: historicoComVariacao(registros).map((r: any) => ({
          id: r.id,
          valor: r.valor,
          vigenciaInicio: r.vigenciaInicio,
          motivo: r.motivo,
          observacoes: r.observacoes,
          variacaoPercentual: r.variacaoPercentual,
          cargo: r.position?.titulo ?? null,
        })),
      },
    };
  }

  async registrar(user: UsuarioContexto, collaboratorId: string, dto: RegistrarSalarioDto) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const historico = await this.repo.historico(collaboratorId, organizationId);
    const validacao = validarMudanca({
      valor: dto.valor,
      vigenciaInicio: new Date(dto.vigenciaInicio),
      motivo: dto.motivo,
      historico,
    });
    if (!validacao.valido) throw new BadRequestException(validacao.detalhe);

    const criado = await this.repo.criar({
      organizationId,
      collaboratorId,
      valor: dto.valor,
      vigenciaInicio: new Date(dto.vigenciaInicio),
      motivo: dto.motivo,
      // Cargo do momento: o cargo atual muda depois e faria o histórico
      // atribuir o salário antigo ao cargo novo.
      positionId: await this.repo.cargoAtual(collaboratorId),
      observacoes: dto.observacoes?.trim() || null,
      criadoPorId: user.id ?? null,
    });

    const anterior = salarioVigente(historico, new Date(dto.vigenciaInicio));
    await this.historicoFuncional.registrar({
      organizationId,
      collaboratorId,
      // `promocao` tem evento próprio na linha do tempo; o resto é registro.
      evento: dto.motivo === "promocao" ? "promocao" : "outro",
      // SEM valor em reais, pela mesma razão que a auditoria não leva: a linha
      // do tempo funcional é lida com `people.colaborador:ver`, enquanto o
      // salário exige `people.salario:ver`. Escrever o número aqui contornava a
      // permissão restrita usando a permissão ampla. O motivo pode ficar: diz
      // que houve mérito ou promoção sem revelar quanto.
      descricao:
        `Salário ${anterior ? "alterado" : "registrado"} (${ROTULO_MOTIVO[dto.motivo] ?? dto.motivo})`,
      registradoPorId: user.id ?? null,
    });

    await this.auditar(
      user, criado.id, "criar",
      // Valor NÃO vai para a descrição da auditoria: a trilha é lida por quem
      // administra o sistema, que não necessariamente pode ver salário.
      `Registro salarial criado (${dto.motivo})`,
    );

    return { success: true, data: { ...criado, valor: Number(criado.valor) } };
  }

  /**
   * Remove um registro salarial.
   *
   * Existe só para desfazer erro de digitação recente. O histórico é o produto
   * desta tabela, então a exclusão fica registrada na auditoria e na linha do
   * tempo — apagar em silêncio seria reescrever o passado.
   */
  async excluir(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    const registro = await this.repo.obter(id, organizationId);
    if (!registro) throw new NotFoundException("Registro salarial não encontrado");
    await this.exigirEscopo(user, registro.collaboratorId);

    await this.repo.excluir(id);
    await this.historicoFuncional.registrar({
      organizationId,
      collaboratorId: registro.collaboratorId,
      evento: "outro",
      descricao:
        `Registro salarial removido ` +
        `(vigência ${dataBR(registro.vigenciaInicio)})`,
      registradoPorId: user.id ?? null,
    });
    await this.auditar(user, id, "excluir", "Registro salarial removido");

    return { success: true, data: { id } };
  }

  async definirFaixa(user: UsuarioContexto, positionId: string, dto: FaixaDto) {
    const organizationId = this.exigirOrganizacao(user);
    const faixa = {
      minimo: dto.minimo ?? null,
      medio: dto.medio ?? null,
      maximo: dto.maximo ?? null,
    };

    if (!faixaValida(faixa)) {
      throw new BadRequestException(
        "Faixa incoerente: o mínimo não pode ser maior que o máximo, e o médio precisa ficar entre os dois.",
      );
    }

    const atual = await this.repo.faixaDoCargo(positionId, organizationId);
    if (!atual) throw new NotFoundException("Cargo não encontrado");

    await this.repo.definirFaixa(positionId, faixa, user.id ?? null);
    await this.auditar(
      user, positionId, "editar",
      `Faixa salarial de "${atual.titulo}" definida`, "positions",
    );

    return { success: true, data: { positionId, ...faixa } };
  }

  /** Faixa de todos os cargos do catálogo. */
  async faixas(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const itens = await this.repo.faixasDoCatalogo(organizationId);
    return {
      success: true,
      data: itens.map((c: any) => ({
        ...c,
        // Faixa incompleta não é erro — o cargo pode ter só o teto definido.
        // Mas a tela precisa distinguir "sem faixa" de "faixa pela metade".
        definida: c.minimo !== null || c.medio !== null || c.maximo !== null,
      })),
    };
  }

  /**
   * Painel de remuneração da organização.
   *
   * Três perguntas: quanto custa o quadro, quem está fora da faixa do próprio
   * cargo, e quem está há tempo demais sem reajuste. As três levam a ação.
   */
  async painel(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo === "nenhum") throw new ForbiddenException("Sem escopo de acesso");

    const ids = escopo.tipo === "organizacao" ? undefined : escopo.collaboratorIds;
    const registros = await this.repo.registrosDoQuadro(organizationId, ids);
    const hoje = new Date();

    // Agrupa por pessoa para que o domínio escolha o vigente de cada uma.
    const porPessoa = new Map<string, { colaborador: any; linhas: any[] }>();
    for (const r of registros as any[]) {
      const atual = porPessoa.get(r.collaboratorId) ?? { colaborador: r.collaborator, linhas: [] };
      atual.linhas.push({
        valor: Number(r.valor), vigenciaInicio: r.vigenciaInicio, motivo: r.motivo,
      });
      porPessoa.set(r.collaboratorId, atual);
    }

    let massa = 0;
    const foraDaFaixa: any[] = [];
    const semReajuste: any[] = [];
    let comSalario = 0;

    for (const [collaboratorId, { colaborador, linhas }] of porPessoa) {
      const vigente = salarioVigente(linhas, hoje);
      if (!vigente) continue;

      comSalario += 1;
      massa += vigente.valor;

      const nome = collaboratorDisplayName(colaborador);
      const p = colaborador.position;
      const faixa = p
        ? {
            minimo: p.salarioMinimo === null ? null : Number(p.salarioMinimo),
            medio: p.salarioMedio === null ? null : Number(p.salarioMedio),
            maximo: p.salarioMaximo === null ? null : Number(p.salarioMaximo),
          }
        : { minimo: null, medio: null, maximo: null };

      const posicao = posicaoNaFaixa(vigente.valor, faixa);
      if (posicao === "abaixo" || posicao === "acima") {
        foraDaFaixa.push({
          collaboratorId, nome, cargo: p?.titulo ?? null,
          valor: vigente.valor, posicao,
          limite: posicao === "abaixo" ? faixa.minimo : faixa.maximo,
        });
      }

      const meses = mesesDesde(vigente.vigenciaInicio, hoje);
      if (meses >= MESES_ALERTA_SEM_REAJUSTE) {
        semReajuste.push({
          collaboratorId, nome, cargo: p?.titulo ?? null,
          meses, desde: vigente.vigenciaInicio,
        });
      }
    }

    foraDaFaixa.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    semReajuste.sort((a, b) => b.meses - a.meses);

    return {
      success: true,
      data: {
        escopoOrganizacional: ids === undefined,
        massaSalarial: Math.round(massa * 100) / 100,
        comSalarioRegistrado: comSalario,
        // Média só informa se houver base; com zero pessoas seria divisão por zero.
        mediaSalarial: comSalario > 0 ? Math.round((massa / comSalario) * 100) / 100 : 0,
        foraDaFaixa,
        semReajuste,
        janelaMesesSemReajuste: MESES_ALERTA_SEM_REAJUSTE,
      },
    };
  }

  /* ── Auxiliares ───────────────────────────────────────────────────────── */

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async exigirEscopo(user: UsuarioContexto, collaboratorId: string) {
    if (!(await this.escopo.podeAcessar(user, collaboratorId))) {
      throw new NotFoundException("Colaborador não encontrado");
    }
  }

  /**
   * `tabela` é parâmetro, não constante.
   *
   * Fixa em `collaborator_salaries`, a definição de faixa — que altera um CARGO —
   * era arquivada como alteração de registro salarial: quem procurasse no
   * histórico do cargo quem mexeu na faixa não achava nada, e quem auditasse
   * salários via um evento sobre um id que não existe naquela tabela.
   */
  private async auditar(
    user: UsuarioContexto,
    registroId: string,
    acao: string,
    descricao: string,
    tabela = "collaborator_salaries",
  ) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela,
        registroId,
        acao,
        descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
