import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PeopleScopeService, UsuarioContexto } from "./people-scope.service";
import { EmployeeService } from "./employee.service";
import { VacationService, SolicitarFeriasDto } from "./vacation.service";
import { DocumentService } from "./document.service";
import { DevelopmentService } from "./development.service";
import { CareerService } from "./career.service";
import { ChecklistService } from "./checklist.service";
import { BenefitService } from "./benefit.service";
import { FeedbackService } from "./feedback.service";
import { EnviarDocumentoDto } from "./dto/document.dto";
import { REVIEW_STATUS } from "../domain/development.entity";

/**
 * Meu RH — o módulo visto pelo próprio colaborador.
 *
 * Tudo no People foi construído para RH e gestor: toda rota recebe um
 * `collaboratorId` e é guardada por uma permissão `people.*`. O efeito é que
 * um colaborador comum não conseguia consultar o próprio saldo de férias sem
 * que o RH lhe concedesse `people.ferias:ver` — e conceder essa permissão o
 * fazia enxergar mais do que a si. Não havia caminho certo, só o menos errado.
 *
 * DUAS DECISÕES SUSTENTAM ESTE SERVIÇO.
 *
 * 1. NENHUM MÉTODO ACEITA `collaboratorId`. O alvo é sempre resolvido a partir
 *    do `userId` do token. Não é conveniência: é o que torna impossível pedir o
 *    dado de outra pessoa por aqui. A rota não tem onde escrever o id do
 *    colega, então nenhuma checagem pode ser esquecida.
 *
 * 2. AS ROTAS NÃO EXIGEM PERMISSÃO `people.*`, só autenticação. Ver o próprio
 *    saldo de férias não é privilégio a conceder; exigir concessão para isso
 *    inverteria o sentido do controle de acesso, que existe para proteger o
 *    dado DOS OUTROS.
 *
 * O QUE FICA DE FORA, DE PROPÓSITO:
 *
 *  - REMUNERAÇÃO. A pessoa conhece o próprio salário pelo holerite, mas o
 *    módulo trata salário como concessão explícita (`people.salario:ver` fica
 *    fora de todo perfil padrão). Abri-lo aqui seria mudar essa política de
 *    lado, sem que ninguém tivesse decidido.
 *  - FEEDBACK PRIVADO. `visibilidade: privado` é a anotação que o gestor faz
 *    para si antes de uma conversa. Publicá-la ao avaliado acabaria com o
 *    registro — passaria a ser escrito para ser lido, ou deixaria de existir.
 *  - AVALIAÇÃO EM RASCUNHO. Nota que ainda pode mudar não é resultado; é
 *    trabalho em curso do gestor.
 */
@Injectable()
export class SelfServiceService {
  constructor(
    private readonly escopo: PeopleScopeService,
    private readonly employees: EmployeeService,
    private readonly ferias: VacationService,
    private readonly documentos: DocumentService,
    private readonly desenvolvimento: DevelopmentService,
    private readonly carreira: CareerService,
    private readonly checklists: ChecklistService,
    private readonly beneficios: BenefitService,
    private readonly feedbacks: FeedbackService,
  ) {}

  /**
   * Resolve o colaborador do usuário logado.
   *
   * Falhar aqui é comum e não é erro do sistema: usuário administrativo,
   * integração, conta de serviço. A mensagem precisa dizer o que fazer, porque
   * quem a lê não sabe o que é "vínculo de colaborador".
   */
  private async eu(user: UsuarioContexto): Promise<string> {
    if (!user?.organizationId) throw new ForbiddenException("Contexto de organização ausente");

    // Pelo VÍNCULO do usuário, nunca pelo escopo. O escopo de um gestor é
    // "equipe" e o de um RH é "organizacao": tomar o primeiro id da lista daria
    // o cadastro de outra pessoa, e a tela chamaria isso de "meus dados".
    const proprio = await this.escopo.proprioCollaboratorId(user);
    if (!proprio) {
      throw new NotFoundException(
        "Seu usuário não está vinculado a um cadastro de colaborador. " +
        "Peça ao RH para fazer o vínculo — sem ele não há dados seus a exibir.",
      );
    }
    return proprio;
  }

  /* ── Painel de entrada ──────────────────────────────────────────────────── */

  /**
   * O resumo que abre a tela: quem sou eu aqui e o que exige ação minha.
   *
   * Ordenado por "o que depende de mim" e não por módulo. Um resumo que apenas
   * repete as abas obriga a pessoa a abrir sete telas para descobrir que não
   * tinha nada a fazer.
   */
  async resumo(user: UsuarioContexto) {
    const id = await this.eu(user);

    const [perfil, ferias, documentos, checklists, carreira] = await Promise.all([
      this.employees.obter(user, id),
      this.ferias.situacao(user, id),
      this.documentos.listar(user, id),
      this.checklists.doColaborador(user, id),
      this.carreira.situacao(user, id).catch(() => null),
    ]);

    const docs = documentos.data ?? [];
    const rejeitados = docs.filter((d: any) => d.aprovacao === "REJEITADO");
    const vencendo = docs.filter((d: any) => d.situacaoValidade === "vence_em_breve" || d.situacaoValidade === "vencido");

    // Só os itens de checklist que são MEUS: o resumo é sobre a minha ação.
    // Listar o que o RH deve fazer viraria cobrança sem destinatário.
    const minhasPendencias = (checklists.data ?? [])
      .flatMap((c: any) => (c.itens ?? []).map((i: any) => ({ ...i, checklist: c.evento })))
      .filter((i: any) => i.responsavel === "colaborador" && i.situacao !== "concluido");

    const p = perfil.data;
    return {
      success: true,
      data: {
        colaborador: {
          id: p.id,
          nome: p.nomeExibicao,
          cargo: p.position?.titulo ?? p.cargo ?? null,
          setor: p.setor?.nome ?? null,
          gestor: p.gestor ? (p.gestor.nomeCompleto || p.gestor.user?.nome || null) : null,
          dataAdmissao: p.dataAdmissao,
          matricula: p.matricula,
          fotoUrl: p.fotoUrl,
          status: p.status,
        },
        ferias: {
          saldoDisponivel: ferias.data.saldoDisponivel,
          vencendo: ferias.data.vencendo,
          semDataAdmissao: ferias.data.semDataAdmissao,
        },
        documentos: {
          total: docs.length,
          rejeitados: rejeitados.length,
          vencendo: vencendo.length,
        },
        pendencias: minhasPendencias.map((i: any) => ({
          id: i.id,
          titulo: i.titulo,
          evento: i.checklist,
          situacao: i.situacao,
          diasParaPrazo: i.diasParaPrazo,
        })),
        carreira: carreira
          ? {
              trilha: carreira.data.trilha?.nome ?? null,
              proximoCargo: carreira.data.proximoDegrau?.cargo ?? null,
              percentual: carreira.data.prontidao?.percentual ?? null,
            }
          : null,
      },
    };
  }

  /* ── Abas ───────────────────────────────────────────────────────────────── */

  async minhasFerias(user: UsuarioContexto) {
    return this.ferias.situacao(user, await this.eu(user));
  }

  async solicitarFerias(user: UsuarioContexto, dto: SolicitarFeriasDto) {
    return this.ferias.solicitar(user, await this.eu(user), dto);
  }

  async meusDocumentos(user: UsuarioContexto) {
    return this.documentos.listar(user, await this.eu(user));
  }

  async enviarDocumento(
    user: UsuarioContexto,
    dto: EnviarDocumentoDto,
    arquivo: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
  ) {
    return this.documentos.enviar(user, await this.eu(user), dto, arquivo);
  }

  async meuDesenvolvimento(user: UsuarioContexto) {
    const id = await this.eu(user);
    const [treinamentos, avaliacoes] = await Promise.all([
      this.desenvolvimento.listarTreinamentos(user, id),
      this.desenvolvimento.listarAvaliacoes(user, id),
    ]);

    return {
      success: true,
      data: {
        treinamentos: treinamentos.data,
        // Rascunho é trabalho em curso do gestor, não resultado. Mostrar uma
        // nota que ainda vai mudar gera conversa sobre um número provisório.
        avaliacoes: (avaliacoes.data ?? []).filter(
          (a: any) => a.status === REVIEW_STATUS.FINALIZADA,
        ),
      },
    };
  }

  async minhaCarreira(user: UsuarioContexto) {
    return this.carreira.situacao(user, await this.eu(user));
  }

  async meusChecklists(user: UsuarioContexto) {
    return this.checklists.doColaborador(user, await this.eu(user));
  }

  async meusBeneficios(user: UsuarioContexto) {
    return this.beneficios.listarDoColaborador(user, await this.eu(user));
  }

  async meusFeedbacks(user: UsuarioContexto) {
    // `false` fixo: o parâmetro existe para o gestor, e aqui nunca há motivo
    // para o avaliado ler a anotação privada feita sobre ele.
    return this.feedbacks.listar(user, await this.eu(user), false);
  }
}
