import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { DocumentRepository } from "../infrastructure/document.repository";
import { DocumentStorageService } from "../infrastructure/document-storage.service";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { PeopleEventsPublisher } from "../domain/people-events.publisher";
import { AuditService } from "../../audit/audit.module";
import {
  DocumentApproval, DOCUMENT_APPROVAL, canApprovalTransitionTo,
  allowedApprovalTransitions, exigeMotivo, isCategoriaSensivel,
  isMimeAceito, mimesAceitos, nomeSeguroDeArquivo, situacaoValidade,
  TAMANHO_MAXIMO_BYTES, DIAS_ALERTA_VENCIMENTO,
} from "../domain/document.entity";
import { EnviarDocumentoDto, DecidirDocumentoDto } from "./dto/document.dto";
import { PEOPLE_PERMISSIONS } from "../people.permissions";
import { expandLegacyPermissions } from "../../../common/permission-aliases";

/**
 * Casos de uso dos documentos de colaborador.
 *
 * Dois níveis de controle convivem aqui:
 *
 *  1. ESCOPO — quais colaboradores o usuário alcança (PeopleScopeService).
 *  2. SIGILO POR CATEGORIA — documento médico revela condição de saúde, dado
 *     sensível sob a LGPD. Gestor vê que existe, mas não abre nem baixa.
 *
 * Sem o segundo nível, um gestor com acesso legítimo à ficha do liderado leria
 * o atestado médico dele. Ver PEOPLE_PERMISSIONS.md §19 e §21.
 */

/**
 * Quem exerce função de RH — decidido por permissão, não por nome de papel.
 *
 * Antes comparava contra nomes que não existem no sistema (`rh_admin`,
 * `hr_admin`…). Quem pode aprovar documento exerce a função de RH: é a mesma
 * pessoa que legitimamente lê atestado médico.
 */
function exerceFuncaoDeRh(user: UsuarioContexto): boolean {
  const perms = expandLegacyPermissions(user.permissions ?? []);
  return perms.has("*") || perms.has(PEOPLE_PERMISSIONS.documento.aprovar);
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly repo: DocumentRepository,
    private readonly storage: DocumentStorageService,
    private readonly historico: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly eventos: PeopleEventsPublisher,
    private readonly audit: AuditService,
  ) {}

  async listar(user: UsuarioContexto, collaboratorId: string) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    const [documentos, refs] = await Promise.all([
      this.repo.listarDoColaborador(collaboratorId, organizationId),
      this.repo.refsDoColaborador(collaboratorId, organizationId),
    ]);
    const podeAbrirSensivel = await this.podeVerSensivel(user, collaboratorId);

    // A referência entra só neste mapa e morre aqui: `CAMPOS_LISTA` não a traz
    // justamente para o caminho no armazenamento não sair em JSON.
    const porId = new Map<string, string>(refs.map((r: any) => [r.id, r.arquivoRef]));

    return {
      success: true,
      data: documentos.map((d: any) => {
        // O arquivo pode não estar mais lá.
        //
        // Aconteceu de verdade: o diretório de documentos vivia na camada
        // gravável do container, sem volume, e todo deploy o recriava vazio —
        // as linhas continuavam no banco apontando para o nada. A lista mostrava
        // tudo normal e o erro só aparecia no clique, sem dizer quais.
        //
        // A checagem é um `existsSync` por linha, sobre um punhado de
        // documentos por perfil: barato perto de descobrir a perda tarde demais.
        const ref = porId.get(d.id);
        const arquivoDisponivel = !!ref && this.storage.existe(ref);

        return {
          ...d,
          situacaoValidade: situacaoValidade(d.dataValidade),
          arquivoDisponivel,
          // O documento sensível aparece na lista (o gestor precisa saber que a
          // pendência foi resolvida), mas sem permitir abrir.
          podeBaixar:
            arquivoDisponivel && (podeAbrirSensivel || !isCategoriaSensivel(d.categoria)),
          restrito: isCategoriaSensivel(d.categoria),
        };
      }),
    };
  }

  async enviar(
    user: UsuarioContexto,
    collaboratorId: string,
    dto: EnviarDocumentoDto,
    arquivo: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
  ) {
    const organizationId = this.exigirOrganizacao(user);
    await this.exigirEscopo(user, collaboratorId);

    if (!arquivo) throw new BadRequestException("Envie o arquivo do documento");
    if (!isMimeAceito(arquivo.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não aceito. Aceitos: ${mimesAceitos().join(", ")}`,
      );
    }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new BadRequestException(
        `Arquivo acima do limite de ${Math.round(TAMANHO_MAXIMO_BYTES / 1024 / 1024)} MB`,
      );
    }
    if (dto.dataValidade && dto.dataEmissao
        && new Date(dto.dataValidade) < new Date(dto.dataEmissao)) {
      throw new BadRequestException("Validade anterior à data de emissão");
    }

    // O id sai antes da gravação para nomear o arquivo: o nome enviado pelo
    // cliente nunca vira caminho em disco.
    const id = randomUUID();
    const nomeEmDisco = nomeSeguroDeArquivo(arquivo.originalname, id);
    const arquivoRef = await this.storage.gravar(
      organizationId, collaboratorId, nomeEmDisco, arquivo.buffer,
    );

    // O arquivo já está em disco. Se o registro falhar daqui em diante, ele
    // ficaria órfão — invisível para a aplicação e para qualquer limpeza. O
    // catch desfaz a gravação antes de propagar o erro.
    let criado: any;
    try {
      criado = await this.repo.criarComHistorico({
        documento: {
          id,
          organizationId,
          collaboratorId,
          categoria: dto.categoria,
          titulo: dto.titulo,
          descricao: dto.descricao ?? null,
          arquivoRef,
          nomeArquivo: arquivo.originalname,
          mimeType: arquivo.mimetype,
          tamanhoBytes: arquivo.size,
          dataEmissao: dto.dataEmissao ? new Date(dto.dataEmissao) : null,
          dataValidade: dto.dataValidade ? new Date(dto.dataValidade) : null,
          aprovacao: DOCUMENT_APPROVAL.PENDENTE,
          enviadoPorId: user.id ?? null,
        },
        historico: {
          organizationId,
          collaboratorId,
          evento: "outro",
          descricao: `Documento enviado: ${dto.titulo}`,
          registradoPorId: user.id ?? null,
        },
      });
    } catch (erro) {
      await this.storage.remover(arquivoRef);
      throw erro;
    }
    await this.auditar(user, id, "criar", `Documento "${dto.titulo}" enviado (${dto.categoria})`);

    this.eventos.publish("employee.document.uploaded", {
      organizationId, employeeId: collaboratorId, documentId: id,
      atorId: user.id ?? null, ocorridoEm: new Date(), categoria: dto.categoria,
    });

    return { success: true, data: { ...criado, situacaoValidade: situacaoValidade(criado.dataValidade) } };
  }

  /**
   * Prepara o download.
   *
   * Devolve a referência para o controller fazer o stream — o serviço não
   * conhece Response HTTP. Toda checagem acontece aqui, nunca no controller.
   */
  async prepararDownload(user: UsuarioContexto, documentId: string) {
    const organizationId = this.exigirOrganizacao(user);

    const doc = await this.repo.obterParaDownload(documentId, organizationId);
    if (!doc) throw new NotFoundException("Documento não encontrado");

    await this.exigirEscopo(user, doc.collaboratorId);

    if (isCategoriaSensivel(doc.categoria) && !(await this.podeVerSensivel(user, doc.collaboratorId))) {
      throw new ForbiddenException(
        "Documento de categoria restrita: acesso limitado ao RH e ao próprio colaborador",
      );
    }

    if (!this.storage.existe(doc.arquivoRef)) {
      // Registro sem arquivo é inconsistência de dados, não "não encontrado".
      this.logger.error(`Arquivo ausente para o documento ${documentId}: ${doc.arquivoRef}`);
      throw new NotFoundException("Arquivo indisponível. Acione o suporte.");
    }

    // Download de dado restrito é auditado sempre: quem baixou, o quê e quando.
    await this.auditar(user, documentId, "exportar", `Download do documento "${doc.titulo}"`);

    return {
      stream: this.storage.abrirLeitura(doc.arquivoRef),
      nomeArquivo: doc.nomeArquivo,
      mimeType: doc.mimeType ?? "application/octet-stream",
    };
  }

  async decidir(user: UsuarioContexto, documentId: string, dto: DecidirDocumentoDto) {
    const organizationId = this.exigirOrganizacao(user);
    const doc = await this.repo.obterParaValidacao(documentId, organizationId);
    if (!doc) throw new NotFoundException("Documento não encontrado");
    await this.exigirEscopo(user, doc.collaboratorId);

    const de = doc.aprovacao as DocumentApproval;
    const para = dto.aprovacao as DocumentApproval;

    if (!canApprovalTransitionTo(de, para)) {
      const validas = allowedApprovalTransitions(de);
      throw new BadRequestException(
        validas.length
          ? `Não é possível ir de ${de} para ${para}. Válidas: ${validas.join(", ")}`
          : `${de} é estado final`,
      );
    }
    if (exigeMotivo(para) && !dto.motivo?.trim()) {
      throw new BadRequestException("Rejeição exige o motivo — é o que orienta a correção");
    }

    const atualizado = await this.repo.atualizarComHistorico({
      id: documentId,
      dados: {
        aprovacao: para,
        aprovadoPorId: para === DOCUMENT_APPROVAL.APROVADO ? (user.id ?? null) : null,
        aprovadoEm: para === DOCUMENT_APPROVAL.APROVADO ? new Date() : null,
        motivoRejeicao: para === DOCUMENT_APPROVAL.REJEITADO ? dto.motivo!.trim() : null,
        atualizadoPorId: user.id ?? null,
      },
      historico: {
        organizationId,
        collaboratorId: doc.collaboratorId,
        evento: "outro",
        campo: "documento",
        valorAnterior: de,
        valorNovo: para,
        descricao: `Documento "${doc.titulo}": ${de} → ${para}`
          + (dto.motivo?.trim() ? ` — ${dto.motivo.trim()}` : ""),
        registradoPorId: user.id ?? null,
      },
    });
    await this.auditar(user, documentId, "editar", `Documento "${doc.titulo}": ${de} → ${para}`);

    this.eventos.publish("employee.document.reviewed", {
      organizationId, employeeId: doc.collaboratorId, documentId,
      atorId: user.id ?? null, ocorridoEm: new Date(), de, para,
    });

    return { success: true, data: atualizado };
  }

  async excluir(user: UsuarioContexto, documentId: string) {
    const organizationId = this.exigirOrganizacao(user);
    const doc = await this.repo.obterParaValidacao(documentId, organizationId);
    if (!doc) throw new NotFoundException("Documento não encontrado");
    await this.exigirEscopo(user, doc.collaboratorId);

    await this.repo.excluir(documentId, user.id ?? null);
    // Registro fica (retenção e trilha); o arquivo sai, como a LGPD espera de
    // um pedido de eliminação.
    await this.storage.remover(doc.arquivoRef);

    await this.historico.registrar({
      organizationId,
      collaboratorId: doc.collaboratorId,
      evento: "outro",
      descricao: `Documento removido: ${doc.titulo}`,
      registradoPorId: user.id ?? null,
    });
    await this.auditar(user, documentId, "excluir", `Documento "${doc.titulo}" removido`);

    return { success: true, data: { id: documentId } };
  }

  /** Painel de conformidade documental (PEOPLE_ANALYTICS_SPECIFICATION.md §7). */
  async conformidade(user: UsuarioContexto) {
    const organizationId = this.exigirOrganizacao(user);
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo === "nenhum") throw new ForbiddenException("Sem escopo de acesso");

    const ids = escopo.tipo === "organizacao" ? undefined : escopo.collaboratorIds;

    const limite = new Date();
    limite.setDate(limite.getDate() + DIAS_ALERTA_VENCIMENTO);

    const [porAprovacao, vencendo, todos] = await Promise.all([
      this.repo.contarPorAprovacao(organizationId, ids),
      this.repo.vencendoAte(organizationId, limite, ids),
      this.repo.referenciasDeArquivo(organizationId, ids),
    ]);

    /**
     * Documento cuja linha existe e cujo arquivo não.
     *
     * Não é hipótese: o diretório de documentos ficou sem volume e todo deploy
     * o recriava vazio. Sem esta contagem a perda só aparecia um clique por
     * vez, e o RH não tinha como saber o tamanho do estrago nem a quem pedir
     * reenvio.
     */
    const semArquivo = todos
      .filter((d: any) => !this.storage.existe(d.arquivoRef))
      .map((d: any) => ({
        id: d.id,
        titulo: d.titulo,
        categoria: d.categoria,
        colaborador: d.collaborator?.nomeCompleto ?? d.collaborator?.user?.nome ?? null,
        collaboratorId: d.collaboratorId,
      }));

    const agora = new Date();
    return {
      success: true,
      data: {
        // A tela precisa saber se "12 pendentes" é da organização ou só da sua
        // equipe. Sem a marca, o mesmo número significa duas coisas diferentes
        // e quem lê não tem como distinguir.
        escopoOrganizacional: ids === undefined,
        porAprovacao,
        vencendo: vencendo.map((d: any) => ({
          ...d,
          situacaoValidade: situacaoValidade(d.dataValidade, agora),
        })),
        semArquivo,
        janelaDias: DIAS_ALERTA_VENCIMENTO,
      },
    };
  }

  // ── Auxiliares ────────────────────────────────────────────────────────────

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async exigirEscopo(user: UsuarioContexto, collaboratorId: string) {
    if (!(await this.escopo.podeAcessar(user, collaboratorId))) {
      // 404 e não 403: confirmar que o colaborador existe já é vazamento.
      throw new NotFoundException("Colaborador não encontrado");
    }
  }

  /**
   * Quem pode abrir documento de categoria sensível.
   *
   * RH e master, por função; e o próprio colaborador, sobre os próprios
   * documentos. Gestor não entra — enxerga a pendência, não o conteúdo.
   */
  private async podeVerSensivel(user: UsuarioContexto, collaboratorId: string): Promise<boolean> {
    if (user.isMaster || exerceFuncaoDeRh(user)) return true;

    // Ser o titular, e não o FORMATO do escopo. Checar `tipo === "proprio"`
    // trancava o gestor fora do próprio atestado: quem lidera alguém tem escopo
    // "equipe", que inclui o próprio cadastro mas não casava com a condição.
    return this.escopo.ehOProprio(user, collaboratorId);
  }

  private async auditar(user: UsuarioContexto, registroId: string, acao: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela: "collaborator_documents",
        registroId,
        acao,
        descricao,
      });
    } catch (erro) {
      this.logger.error(`Falha ao auditar ${acao} de ${registroId}`, erro as Error);
    }
  }
}
