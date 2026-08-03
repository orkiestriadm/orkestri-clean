import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from "@nestjs/common";
import { IsInt, IsOptional, IsString, Min, Max, MaxLength } from "class-validator";
import { PrismaService } from "../../../prisma/prisma.service";
import { DocumentStorageService } from "../infrastructure/document-storage.service";
import { EmployeeHistoryRepository } from "../infrastructure/employee-history.repository";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { AuditService } from "../../audit/audit.module";
import {
  ANOS_GUARDA_PADRAO, EXPLICACAO_INELEGIBILIDADE, avaliarElegibilidade, valoresAnonimos,
} from "../domain/privacidade.entity";
import { collaboratorDisplayName } from "../../../common/collaborator";

/**
 * Privacidade — eliminação do dado pessoal de ex-colaborador.
 *
 * O módulo tinha soft delete e mais nada, o que não é privacidade: CPF,
 * endereço, data de nascimento e documentos digitalizados continuavam inteiros
 * no banco, de gente que saiu há anos. A LGPD manda eliminar quando a
 * finalidade acaba (art. 15), ressalvada a guarda obrigatória (art. 16, I).
 *
 * TRÊS DECISÕES QUE MOLDAM ESTE SERVIÇO.
 *
 * 1. NÃO EXISTE EXPURGO AUTOMÁTICO. O prazo é indício, não autorização: uma
 *    reclamação trabalhista em curso obriga a guardar tudo, e o sistema não
 *    sabe que ela existe. Um cron que apagasse sozinho destruiria a prova da
 *    defesa da empresa sem ninguém perceber, e sem volta. Aqui se calcula quem
 *    está elegível; quem decide é gente, e a decisão fica auditada.
 *
 * 2. O ESQUELETO DO VÍNCULO SOBREVIVE. Datas, cargo, setor e histórico
 *    salarial ficam: são o que prova tempo de serviço à previdência e o que
 *    responde a fiscalização. Some o que identifica a PESSOA.
 *
 * 3. OS ARQUIVOS SÃO APAGADOS DO DISCO. Anonimizar a linha e deixar o PDF do
 *    RG no volume seria teatro: o dado pessoal está no arquivo, não no
 *    registro que aponta para ele.
 */

export class AnonimizarDto {
  /** Exigido e livre: obriga a registrar POR QUE, e a auditoria fica legível. */
  @IsString() @MaxLength(500) justificativa!: string;
}

export class ElegiveisQuery {
  @IsOptional() @IsInt() @Min(1) @Max(30) anosGuarda?: number;
}

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentStorageService,
    private readonly historico: EmployeeHistoryRepository,
    private readonly escopo: PeopleScopeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Quem já passou do prazo de guarda.
   *
   * Ordenado pelo desligamento mais antigo: é a fila de quem está guardado
   * há mais tempo sem finalidade, que é o risco que a lei mira.
   */
  async elegiveis(user: UsuarioContexto, anosGuarda = ANOS_GUARDA_PADRAO) {
    const organizationId = this.exigirOrganizacao(user);
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo !== "organizacao") {
      // Deliberadamente restrito a quem enxerga a organização: eliminar dado é
      // decisão de quem responde pelo tratamento, não de quem lidera um time.
      throw new ForbiddenException(
        "Só quem enxerga a organização inteira pode conduzir a eliminação de dados pessoais.",
      );
    }

    const desligados = await (this.prisma as any).collaborator.findMany({
      where: { organizationId, status: "DESLIGADO", anonimizadoEm: null },
      select: {
        id: true, nomeCompleto: true, matricula: true, status: true,
        dataDesligamento: true, anonimizadoEm: true,
        user: { select: { nome: true } },
        position: { select: { titulo: true } },
        setor: { select: { nome: true } },
      },
      orderBy: { dataDesligamento: "asc" },
    });

    const hoje = new Date();
    const linhas = desligados.map((c: any) => {
      const e = avaliarElegibilidade(c, hoje, anosGuarda);
      return {
        id: c.id,
        nome: collaboratorDisplayName(c),
        matricula: c.matricula,
        cargo: c.position?.titulo ?? null,
        setor: c.setor?.nome ?? null,
        dataDesligamento: c.dataDesligamento,
        elegivel: e.elegivel,
        liberaEm: e.liberaEm,
        diasParaLiberar: e.diasParaLiberar,
        motivo: e.motivo,
        explicacao: e.motivo ? EXPLICACAO_INELEGIBILIDADE[e.motivo] : null,
      };
    });

    return {
      success: true,
      data: {
        anosGuarda,
        elegiveis: linhas.filter((l: any) => l.elegivel),
        aguardando: linhas.filter((l: any) => !l.elegivel),
      },
    };
  }

  /**
   * Prévia: o que exatamente some, e o que fica.
   *
   * Obrigatória na tela antes do botão. A ação não tem volta, e "tem certeza?"
   * sem dizer o que vai acontecer não é confirmação — é só um obstáculo.
   */
  async previa(user: UsuarioContexto, collaboratorId: string, anosGuarda = ANOS_GUARDA_PADRAO) {
    const organizationId = this.exigirOrganizacao(user);
    const c = await this.carregar(user, collaboratorId, organizationId);
    const e = avaliarElegibilidade(c, new Date(), anosGuarda);

    return {
      success: true,
      data: {
        colaborador: { id: c.id, nome: collaboratorDisplayName(c) },
        elegivel: e.elegivel,
        motivo: e.motivo,
        explicacao: e.motivo ? EXPLICACAO_INELEGIBILIDADE[e.motivo] : null,
        liberaEm: e.liberaEm,
        seraEliminado: {
          identificacao: "Nome, matrícula, data de nascimento, gênero, estado civil e nacionalidade",
          contato: "E-mail pessoal e corporativo, telefone, celular e foto",
          enderecos: c._count?.enderecos ?? 0,
          contatos: c._count?.contatos ?? 0,
          documentos: c._count?.documentos ?? 0,
          acessoAoSistema: !!c.userId,
        },
        seraPreservado: [
          "As datas de admissão e desligamento",
          "O cargo e o setor ocupados",
          "O histórico salarial e de mudanças funcionais",
          "Os registros de férias, benefícios e treinamentos, sem identificação",
        ],
      },
    };
  }

  /**
   * Elimina o dado pessoal. Sem volta.
   *
   * Ordem importa: os ARQUIVOS primeiro. Se o banco fosse escrito antes e a
   * remoção do disco falhasse, sobraria um PDF de RG órfão que ninguém mais
   * relaciona a ninguém — invisível para o sistema e presente no volume. O
   * inverso é recuperável: os arquivos somem e a linha continua identificável
   * até alguém repetir a operação.
   */
  async anonimizar(user: UsuarioContexto, collaboratorId: string, dto: AnonimizarDto, anosGuarda = ANOS_GUARDA_PADRAO) {
    const organizationId = this.exigirOrganizacao(user);
    const c = await this.carregar(user, collaboratorId, organizationId);

    const e = avaliarElegibilidade(c, new Date(), anosGuarda);
    if (!e.elegivel) {
      throw new BadRequestException(
        EXPLICACAO_INELEGIBILIDADE[e.motivo!] ?? "Este cadastro ainda não pode ser anonimizado.",
      );
    }

    const justificativa = dto.justificativa?.trim();
    if (!justificativa) {
      throw new BadRequestException("Informe a justificativa — ela fica registrada na auditoria.");
    }

    const nomeAnterior = collaboratorDisplayName(c);

    const docs = await (this.prisma as any).collaboratorDocument.findMany({
      where: { collaboratorId },
      select: { id: true, arquivoRef: true },
    });

    let arquivosRemovidos = 0;
    for (const d of docs) {
      if (!d.arquivoRef) continue;
      try {
        await this.storage.remover(d.arquivoRef);
        arquivosRemovidos++;
      } catch (erro) {
        // Não aborta: um arquivo que já sumiu do volume não pode impedir a
        // eliminação do resto. Fica no log para conferência.
        this.logger.warn(`Arquivo ${d.arquivoRef} não pôde ser removido: ${(erro as Error).message}`);
      }
    }

    const referencia = collaboratorId.slice(0, 8);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.collaboratorDocument.deleteMany({ where: { collaboratorId } });
      await tx.collaboratorAddress.deleteMany({ where: { collaboratorId } });
      await tx.collaboratorContact.deleteMany({ where: { collaboratorId } });

      await tx.collaborator.update({
        where: { id: collaboratorId },
        data: {
          ...valoresAnonimos(referencia),
          anonimizadoEm: new Date(),
          atualizadoPorId: user.id ?? null,
        },
      });

      // A linha do tempo funcional FICA — é registro do vínculo —, mas as
      // descrições foram escritas por gente e podem citar o nome. Trocar é mais
      // honesto que apagar: o evento continua provando o que aconteceu.
      await tx.collaboratorHistory.updateMany({
        where: { collaboratorId, descricao: { contains: nomeAnterior } },
        data: { descricao: "Registro funcional (descrição anonimizada)" },
      });
    });

    await this.historico.registrar({
      organizationId, collaboratorId,
      evento: "outro",
      descricao: `Dados pessoais eliminados (LGPD). Justificativa: ${justificativa}`,
      registradoPorId: user.id ?? null,
    });

    await this.auditar(
      user, collaboratorId,
      `Dados pessoais de "${nomeAnterior}" eliminados. ` +
      `${docs.length} documento(s), ${arquivosRemovidos} arquivo(s) removidos do armazenamento. ` +
      `Justificativa: ${justificativa}`,
    );

    this.logger.log(`Colaborador ${collaboratorId} anonimizado por ${user.id ?? "?"}`);

    return {
      success: true,
      data: {
        id: collaboratorId,
        documentosRemovidos: docs.length,
        arquivosRemovidos,
      },
    };
  }

  /* ── Auxiliares ─────────────────────────────────────────────────────────── */

  private async carregar(user: UsuarioContexto, collaboratorId: string, organizationId: string) {
    const escopo = await this.escopo.resolve(user);
    if (escopo.tipo !== "organizacao") {
      throw new ForbiddenException(
        "Só quem enxerga a organização inteira pode conduzir a eliminação de dados pessoais.",
      );
    }

    const c = await (this.prisma as any).collaborator.findFirst({
      where: { id: collaboratorId, organizationId },
      select: {
        id: true, nomeCompleto: true, userId: true, status: true,
        dataDesligamento: true, anonimizadoEm: true,
        user: { select: { nome: true } },
        _count: { select: { enderecos: true, contatos: true, documentos: true } },
      },
    });
    if (!c) throw new NotFoundException("Colaborador não encontrado");
    return c;
  }

  private exigirOrganizacao(user: UsuarioContexto): string {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");
    return user.organizationId;
  }

  private async auditar(user: UsuarioContexto, registroId: string, descricao: string) {
    try {
      await this.audit.log({
        organizationId: user.organizationId,
        userId: user.id ?? null,
        modulo: "people",
        tabela: "collaborators",
        registroId,
        acao: "anonimizar",
        descricao,
      });
    } catch (erro) {
      // Auditoria é a única prova de que a eliminação foi deliberada e por
      // quem. Falhar aqui é grave — sobe no log como erro, não como aviso.
      this.logger.error(`Falha ao auditar anonimização de ${registroId}`, erro as Error);
    }
  }
}
