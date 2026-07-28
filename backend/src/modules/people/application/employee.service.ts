import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { EmployeeRepository } from "../infrastructure/employee.repository";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { PeopleEventsPublisher } from "../domain/people-events.publisher";
import { AuditService } from "../../audit/audit.module";
import { collaboratorDisplayName } from "../../../common/collaborator";
import {
  EmployeeStatus, EMPLOYEE_STATUS, canTransitionTo, allowedTransitionsFrom,
  isAtivo, temIdentidadeValida, exigeDataDesligamento, ficariaComCicloDeGestao,
} from "../domain/employee.entity";
import { PEOPLE_EVENTS } from "../domain/employee.events";
import {
  CriarColaboradorDto, AtualizarColaboradorDto, MudarStatusDto, ListarColaboradoresQuery,
} from "./dto/employee.dto";

/**
 * Casos de uso de colaborador.
 *
 * Orquestra: valida regra de domínio → persiste → registra histórico de negócio
 * → grava auditoria técnica → publica evento. Nenhuma consulta monta escopo
 * própria: tudo parte do PeopleScopeService.
 */

const PADRAO_PAGINA = 1;
const PADRAO_TAMANHO = 25;

/** Campos cuja mudança merece linha na timeline do colaborador. */
const CAMPOS_HISTORICOS: Record<string, { evento: string; rotulo: string }> = {
  setorId: { evento: "mudanca_setor", rotulo: "Setor" },
  positionId: { evento: "mudanca_cargo", rotulo: "Cargo" },
  cargo: { evento: "mudanca_cargo", rotulo: "Cargo (texto)" },
  gestorId: { evento: "mudanca_gestor", rotulo: "Gestor" },
  senioridade: { evento: "promocao", rotulo: "Senioridade" },
  tipoVinculo: { evento: "outro", rotulo: "Tipo de vínculo" },
};

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly repo: EmployeeRepository,
    private readonly historico: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly eventos: PeopleEventsPublisher,
    private readonly audit: AuditService,
  ) {}

  async listar(user: UsuarioContexto, query: ListarColaboradoresQuery) {
    const escopo = await this.escopo.resolve(user);
    // Sem escopo, a lista viria vazia e a tela diria "nenhum colaborador
    // cadastrado" — afirmando que não existe cadastro quando o caso é o
    // usuário não alcançar nenhum. São coisas diferentes para quem lê.
    if (escopo.tipo === "nenhum") {
      throw new ForbiddenException(
        "Seu usuário não está vinculado a um colaborador, então não há quadro a exibir. " +
        "Peça ao RH para vincular seu cadastro.",
      );
    }

    const where = await this.escopo.whereColaborador(user);
    const pagina = query.pagina ?? PADRAO_PAGINA;
    const tamanho = query.tamanho ?? PADRAO_TAMANHO;

    const { total, itens } = await this.repo.listar({
      where,
      busca: query.busca,
      status: query.status,
      setorId: query.setorId,
      positionId: query.positionId,
      gestorId: query.gestorId,
      pagina,
      tamanho,
      ordenarPor: query.ordenarPor ?? "nomeCompleto",
      direcao: query.direcao ?? "asc",
    });

    return {
      success: true,
      data: itens.map((c: any) => this.apresentar(c)),
      meta: { total, pagina, tamanho, paginas: Math.ceil(total / tamanho) },
    };
  }

  async obter(user: UsuarioContexto, id: string) {
    const where = await this.escopo.whereColaborador(user);
    const colaborador = await this.repo.obter(id, where);
    // 404, não 403: revelar que o registro existe mas está fora do escopo já é
    // vazamento de informação.
    if (!colaborador) throw new NotFoundException("Colaborador não encontrado");
    return { success: true, data: this.apresentar(colaborador) };
  }

  async historicoDe(user: UsuarioContexto, id: string) {
    if (!(await this.escopo.podeAcessar(user, id))) {
      throw new NotFoundException("Colaborador não encontrado");
    }
    const eventos = await this.historico.listar(id, user.organizationId!);
    return { success: true, data: eventos };
  }

  async criar(user: UsuarioContexto, dto: CriarColaboradorDto) {
    const organizationId = this.exigirOrganizacao(user);

    if (!temIdentidadeValida(dto)) {
      throw new BadRequestException(
        "Informe o nome completo ou vincule um usuário do sistema",
      );
    }

    if (dto.userId) {
      if (!(await this.repo.usuarioPertenceA(dto.userId, organizationId))) {
        throw new BadRequestException("Usuário não encontrado nesta organização");
      }
      if (await this.repo.usuarioJaVinculado(dto.userId)) {
        throw new BadRequestException("Este usuário já está vinculado a um colaborador");
      }
    }

    if (dto.matricula && (await this.repo.matriculaEmUso(organizationId, dto.matricula))) {
      throw new BadRequestException("Matrícula já existe nesta organização");
    }

    if (dto.gestorId) await this.validarGestor(organizationId, null, dto.gestorId);

    const status = (dto.status as EmployeeStatus) ?? EMPLOYEE_STATUS.ATIVO;

    // Id gerado aqui, não pelo banco: dentro da transação o evento de admissão
    // precisa referenciar o colaborador que está sendo criado no mesmo lote.
    const id = randomUUID();
    const criado = await this.repo.criarComHistorico({
      colaborador: {
        id,
        ...this.normalizarDatas(dto),
        organizationId,
        status,
        ativo: isAtivo(status),
        criadoPorId: user.id ?? null,
      },
      historico: {
        organizationId,
        collaboratorId: id,
        evento: "admissao",
        descricao: dto.dataAdmissao
          ? `Admissão registrada para ${new Date(dto.dataAdmissao).toLocaleDateString("pt-BR")}`
          : "Colaborador cadastrado",
        vigenciaEm: dto.dataAdmissao ? new Date(dto.dataAdmissao) : null,
        registradoPorId: user.id ?? null,
      },
    });

    const nome = collaboratorDisplayName(criado);

    await this.auditar(user, criado.id, "criar", `Colaborador ${nome} cadastrado`);

    this.eventos.publish(PEOPLE_EVENTS.employeeCreated, {
      organizationId,
      employeeId: criado.id,
      atorId: user.id ?? null,
      ocorridoEm: new Date(),
      nome,
      temAcessoAoSistema: !!criado.userId,
    });

    return { success: true, data: this.apresentar(criado) };
  }

  async atualizar(user: UsuarioContexto, id: string, dto: AtualizarColaboradorDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.exigirAcesso(user, id);

    // Colaborador sem usuário depende do nome próprio para ser exibido.
    if (dto.nomeCompleto !== undefined && !dto.nomeCompleto?.trim() && !atual.userId) {
      throw new BadRequestException(
        "Colaborador sem usuário vinculado precisa de nome completo",
      );
    }

    if (dto.matricula && dto.matricula !== atual.matricula) {
      if (await this.repo.matriculaEmUso(organizationId, dto.matricula, id)) {
        throw new BadRequestException("Matrícula já existe nesta organização");
      }
    }

    if (dto.gestorId !== undefined) {
      await this.validarGestor(organizationId, id, dto.gestorId);
    }

    const alteracoes = this.diffHistorico(atual, dto);
    const atualizado = await this.repo.atualizarComHistorico({
      id,
      dados: { ...this.normalizarDatas(dto), atualizadoPorId: user.id ?? null },
      historico: alteracoes.map((a) => ({
        organizationId,
        collaboratorId: id,
        evento: a.evento,
        campo: a.campo,
        valorAnterior: a.de,
        valorNovo: a.para,
        descricao: `${a.rotulo}: ${a.de ?? "—"} → ${a.para ?? "—"}`,
        registradoPorId: user.id ?? null,
      })),
    });

    const camposAlterados = Object.keys(dto);
    await this.auditar(
      user, id, "editar",
      `Colaborador atualizado (${camposAlterados.join(", ") || "sem alterações"})`,
    );

    this.eventos.publish(PEOPLE_EVENTS.employeeUpdated, {
      organizationId,
      employeeId: id,
      atorId: user.id ?? null,
      ocorridoEm: new Date(),
      camposAlterados,
    });

    // Eventos específicos permitem que consumidores reajam sem inspecionar diff.
    if (alteracoes.some((a) => a.campo === "setorId")) {
      this.eventos.publish(PEOPLE_EVENTS.employeeDepartmentChanged, {
        organizationId, employeeId: id, atorId: user.id ?? null, ocorridoEm: new Date(),
        setorAnteriorId: atual.setorId ?? null, setorNovoId: dto.setorId ?? null,
      });
    }
    if (alteracoes.some((a) => a.campo === "positionId")) {
      this.eventos.publish(PEOPLE_EVENTS.employeePositionChanged, {
        organizationId, employeeId: id, atorId: user.id ?? null, ocorridoEm: new Date(),
        positionAnteriorId: atual.positionId ?? null, positionNovoId: dto.positionId ?? null,
      });
    }

    return { success: true, data: this.apresentar(atualizado) };
  }

  async mudarStatus(user: UsuarioContexto, id: string, dto: MudarStatusDto) {
    const organizationId = this.exigirOrganizacao(user);
    const atual = await this.exigirAcesso(user, id);

    const de = (atual.status ?? EMPLOYEE_STATUS.ATIVO) as EmployeeStatus;
    const para = dto.status as EmployeeStatus;

    if (!canTransitionTo(de, para)) {
      const permitidas = allowedTransitionsFrom(de);
      throw new BadRequestException(
        permitidas.length
          ? `Não é possível mudar de ${de} para ${para}. Transições válidas: ${permitidas.join(", ")}`
          : `${de} é um estado final e não permite mudança de status`,
      );
    }

    if (exigeDataDesligamento(para) && !dto.dataDesligamento) {
      throw new BadRequestException("Desligamento exige a data de desligamento");
    }

    const dataDesligamento = dto.dataDesligamento ? new Date(dto.dataDesligamento) : null;
    const atualizado = await this.repo.atualizar(id, {
      status: para,
      ativo: isAtivo(para),
      ...(dataDesligamento ? { dataDesligamento } : {}),
      atualizadoPorId: user.id ?? null,
    });

    await this.historico.registrar({
      organizationId,
      collaboratorId: id,
      evento: para === EMPLOYEE_STATUS.DESLIGADO ? "desligamento" : "mudanca_status",
      campo: "status",
      valorAnterior: de,
      valorNovo: para,
      descricao: dto.motivo?.trim() || `Status alterado de ${de} para ${para}`,
      vigenciaEm: dataDesligamento,
      registradoPorId: user.id ?? null,
    });

    await this.auditar(user, id, "editar", `Status: ${de} → ${para}`);

    this.eventos.publish(PEOPLE_EVENTS.employeeStatusChanged, {
      organizationId, employeeId: id, atorId: user.id ?? null, ocorridoEm: new Date(),
      statusAnterior: de, statusNovo: para,
    });

    if (para === EMPLOYEE_STATUS.DESLIGADO && dataDesligamento) {
      this.eventos.publish(PEOPLE_EVENTS.employeeTerminated, {
        organizationId, employeeId: id, atorId: user.id ?? null, ocorridoEm: new Date(),
        dataDesligamento,
      });
    }

    return { success: true, data: this.apresentar(atualizado) };
  }

  async excluir(user: UsuarioContexto, id: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirAcesso(user, id);

    await this.repo.excluir(id, user.id ?? null);
    await this.historico.registrar({
      organizationId,
      collaboratorId: id,
      evento: "outro",
      descricao: "Registro excluído (exclusão lógica)",
      registradoPorId: user.id ?? null,
    });
    await this.auditar(user, id, "excluir", "Colaborador excluído (lógico)");

    return { success: true, data: { id } };
  }

  // ── Auxiliares ────────────────────────────────────────────────────────────

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async exigirAcesso(user: UsuarioContexto, id: string) {
    if (!(await this.escopo.podeAcessar(user, id))) {
      throw new NotFoundException("Colaborador não encontrado");
    }
    const atual = await this.repo.obterParaValidacao(id, user.organizationId!);
    if (!atual) throw new NotFoundException("Colaborador não encontrado");
    return atual;
  }

  private async validarGestor(
    organizationId: string,
    colaboradorId: string | null,
    gestorId: string | null | undefined,
  ) {
    if (!gestorId) return;
    if (colaboradorId && gestorId === colaboradorId) {
      throw new BadRequestException("Colaborador não pode ser gestor de si mesmo");
    }
    const gestor = await this.repo.obterParaValidacao(gestorId, organizationId);
    if (!gestor) throw new BadRequestException("Gestor não encontrado nesta organização");

    if (colaboradorId) {
      const mapa = await this.repo.mapaDeGestores(organizationId);
      if (ficariaComCicloDeGestao(colaboradorId, gestorId, mapa)) {
        throw new BadRequestException(
          "Hierarquia inválida: este gestor criaria um ciclo, ou já pertence a um. " +
          "Revise a cadeia de gestão antes de prosseguir.",
        );
      }
    }
  }

  /** DTOs trafegam datas como string ISO; o banco quer Date. */
  private normalizarDatas<T extends Record<string, any>>(dto: T): Record<string, any> {
    const campos = ["dataNascimento", "dataAdmissao", "dataDesligamento"];
    const saida: Record<string, any> = { ...dto };
    for (const campo of campos) {
      if (saida[campo]) saida[campo] = new Date(saida[campo]);
    }
    return saida;
  }

  private diffHistorico(atual: Record<string, any>, dto: Record<string, any>) {
    const alteracoes: { campo: string; evento: string; rotulo: string; de: string | null; para: string | null }[] = [];
    for (const [campo, meta] of Object.entries(CAMPOS_HISTORICOS)) {
      if (dto[campo] === undefined) continue;
      const de = atual[campo] ?? null;
      const para = dto[campo] ?? null;
      if (de === para) continue;
      alteracoes.push({ campo, evento: meta.evento, rotulo: meta.rotulo, de, para });
    }
    return alteracoes;
  }

  /**
   * Auditoria técnica. Falha aqui não pode derrubar a operação de negócio, mas
   * também não pode passar em silêncio — o AuditService engolia erro com catch
   * vazio, e por isso a trilha de Frota ficou vazia sem ninguém notar.
   */
  private async auditar(user: UsuarioContexto, registroId: string, acao: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela: "collaborators",
        registroId,
        acao,
        descricao,
      } as any);
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }

  /** Achata o nome de exibição para o cliente não precisar conhecer a regra. */
  private apresentar(colaborador: any) {
    return { ...colaborador, nomeExibicao: collaboratorDisplayName(colaborador) };
  }
}
