import {
  Module, Controller, Get, Post, Param, Query, Headers, Body, UseGuards,
  Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException,
  HttpCode, HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ConfigService } from "@nestjs/config";
// Mesma regra de acesso do gestor de leads: é o que já define "Super Admin"
// no backend. Um guard novo aqui seria uma segunda definição do mesmo papel.
import { ProspectSaGuard } from "../prospects/prospects.module";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  VALOR_MENSALIDADE, VALOR_MENSALIDADE_LABEL, PIX_VALIDADE_MS,
  faseDaConta, podeRenovar, proximaValidade, cicloDe, produtoLabel,
  montarCobranca, montarPixCopiaECola, montarPagamentoConfirmado, montarCobrancaFalhou,
} from "../auth/trial-renovacao";
import { lerTokenCheckout, urlCheckout } from "./checkout-token";
import { MercadoPagoClient, MercadoPagoError, pixCopiaECola, statusCobranca } from "./mercadopago";
import { conferirAssinatura, tipoNotificacao } from "./webhook-assinatura";

// Mensalidade de R$ 11,90 — cobrança pelo Mercado Pago.
//
// A regra que manda em tudo aqui: ACESSO SÓ COM PAGAMENTO CONFIRMADO. O "1" no
// WhatsApp abre a cobrança; quem estica o `assinaturaValidaAte` é uma função só
// (`aplicarPagamentoConfirmado`), chamada pelo webhook. Nenhum outro caminho
// concede mês.

type UsuarioCobravel = {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  organizationId: string;
  isTrial: boolean;
  trialExpiraEm: Date | null;
  trialModulo: string | null;
  assinaturaEm: Date | null;
  assinaturaValidaAte: Date | null;
  trialLembreteEm: Date | null;
  assinaturaRenovacaoAuto: boolean;
  assinaturaPreapprovalId: string | null;
  profile: { whatsapp: string | null } | null;
};

@Injectable()
export class AssinaturaService {
  private readonly logger = new Logger(AssinaturaService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private wa: WhatsAppService,
  ) {}

  // ── Infra ─────────────────────────────────────────────────────────────────

  /** Cliente do MP, ou null quando não há token — o sistema não cai por isso. */
  private mp(): MercadoPagoClient | null {
    const token = this.config.get<string>("MP_ACCESS_TOKEN");
    if (!token) {
      this.logger.warn("MP_ACCESS_TOKEN não configurado — nenhuma cobrança será criada.");
      return null;
    }
    return new MercadoPagoClient(token);
  }

  private appUrl(): string {
    return this.config.get<string>("APP_URL") || "https://www.orkiestri.com";
  }

  linkDePagamento(userId: string): string {
    return urlCheckout(this.appUrl(), userId);
  }

  private async carregar(userId: string): Promise<UsuarioCobravel> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, nome: true, email: true, cpf: true, organizationId: true,
        isTrial: true, trialExpiraEm: true, trialModulo: true,
        assinaturaEm: true, assinaturaValidaAte: true, trialLembreteEm: true,
        assinaturaRenovacaoAuto: true, assinaturaPreapprovalId: true,
        profile: { select: { whatsapp: true } },
      } as any,
    });
    if (!u) throw new NotFoundException("Conta não encontrada.");
    return u as any;
  }

  private async falar(u: UsuarioCobravel, texto: string): Promise<boolean> {
    if (!u.profile?.whatsapp) return false;
    const inst = await this.wa.resolveInstance(u.organizationId).catch(() => undefined);
    return this.wa.sendMessage(u.profile.whatsapp, texto, inst).catch(() => false);
  }

  // ── Cobrança ──────────────────────────────────────────────────────────────

  /**
   * O mês que a próxima cobrança compra. Conta do fim do período atual quando
   * ele ainda não acabou: quem paga três dias antes não perde os três dias.
   */
  private proximoPeriodo(u: UsuarioCobravel, agora: Date): Date {
    const f = faseDaConta(u as any);
    return proximaValidade(f ? f.limite : null, agora);
  }

  /** A cobrança pendente deste ciclo, se já existir e ainda valer. */
  private async pendenteDoCiclo(userId: string, ciclo: string, agora: Date) {
    const abertas = await (this.prisma as any).assinaturaCobranca.findMany({
      where: { userId, ciclo, status: "pendente" },
      orderBy: { criadoEm: "desc" },
    });
    return abertas.find((c: any) => !c.expiraEm || new Date(c.expiraEm).getTime() > agora.getTime()) || null;
  }

  /**
   * O último pagamento que já concedeu acesso.
   *
   * Existe por causa de um buraco achado no primeiro pagamento real: a tela só
   * dizia "confirmado" enquanto a aba ficava aberta. Quem pagava e recarregava
   * voltava a ver o botão de pagar, sem nenhum sinal de que o dinheiro entrou —
   * e o próximo passo natural de quem acha que falhou é pagar de novo.
   */
  private async ultimoPagamento(userId: string) {
    return (this.prisma as any).assinaturaCobranca.findFirst({
      where: { userId, status: "pago", validadeConcedidaAte: { not: null } },
      orderBy: { validadeConcedidaAte: "desc" },
    });
  }

  /**
   * Abre (ou reaproveita) a cobrança do próximo mês e devolve os meios de
   * pagamento. Chamado pelo "1" do WhatsApp e pela página de checkout.
   *
   * Reaproveitar é o que impede dois "1" seguidos de gerarem dois Pix e duas
   * conversas de suporte.
   */
  async abrirCobranca(userId: string, agora = new Date()) {
    const u = await this.carregar(userId);
    const f = faseDaConta(u as any);
    if (!f) throw new BadRequestException("Esta conta está fora do ciclo de mensalidade.");
    if (!podeRenovar(u as any, agora)) throw new BadRequestException("prazo_encerrado");

    const validadeAlvo = this.proximoPeriodo(u, agora);
    const ciclo = cicloDe(validadeAlvo);

    const existente = await this.pendenteDoCiclo(u.id, ciclo, agora);
    if (existente) return { usuario: u, cobranca: existente, reaproveitada: true };

    const cobranca = await (this.prisma as any).assinaturaCobranca.create({
      data: { userId: u.id, valor: VALOR_MENSALIDADE, ciclo, status: "pendente" },
    });
    return { usuario: u, cobranca, reaproveitada: false };
  }

  /** Gera o Pix da cobrança — ou devolve o que já existe. */
  async gerarPix(userId: string, agora = new Date()) {
    const { usuario, cobranca } = await this.abrirCobranca(userId, agora);
    if (cobranca.pixQrCode) return { cobranca, usuario };

    const mp = this.mp();
    if (!mp) throw new BadRequestException("Pagamento indisponível no momento. Fale com a nossa equipe.");

    const expiraEm = new Date(agora.getTime() + PIX_VALIDADE_MS);
    const [primeiroNome, ...resto] = (usuario.nome || "Cliente").trim().split(/\s+/);

    let pagamento;
    try {
      pagamento = await mp.criarPagamentoPix({
        valorCentavos: cobranca.valor,
        descricao: `${produtoLabel(usuario.trialModulo)} — mensalidade ${cobranca.ciclo}`,
        payerEmail: usuario.email,
        primeiroNome,
        sobrenome: resto.join(" ") || undefined,
        cpf: usuario.cpf,
        externalReference: cobranca.id,
        expiraEm,
        // Duas chamadas para a mesma cobrança não geram dois Pix no MP.
        idempotencia: `pix-${cobranca.id}`,
      });
    } catch (e) {
      this.logger.error(`Pix não gerado para cobranca=${cobranca.id}: ${(e as Error).message}`);
      throw new BadRequestException(
        e instanceof MercadoPagoError && !e.rede
          ? "Não foi possível gerar o Pix agora. Tente o cartão ou fale com a nossa equipe."
          : "Pagamento indisponível no momento. Tente de novo em alguns minutos.",
      );
    }

    const copiaECola = pixCopiaECola(pagamento);
    const atualizada = await (this.prisma as any).assinaturaCobranca.update({
      where: { id: cobranca.id },
      data: {
        meio: "pix",
        mpPaymentId: String(pagamento.id),
        pixQrCode: copiaECola,
        expiraEm,
      },
    });

    return { cobranca: atualizada, usuario, qrCodeBase64: pagamento.point_of_interaction?.transaction_data?.qr_code_base64 || null };
  }

  /**
   * O painel de billing: quem está no ciclo e como cada um está.
   *
   * O estado NÃO é coluna guardada — é derivado de `faseDaConta` e da data, as
   * mesmas funções que decidem o bloqueio no login. Uma coluna "inadimplente"
   * criaria uma segunda verdade, que cedo ou tarde discorda da que barra a
   * pessoa na porta.
   */
  async painel(agora = new Date()) {
    const contas = await this.prisma.user.findMany({
      where: { ativo: true } as any,
      select: {
        id: true, nome: true, email: true, criadoEm: true,
        isTrial: true, trialExpiraEm: true, trialModulo: true,
        assinaturaEm: true, assinaturaValidaAte: true,
        assinaturaRenovacaoAuto: true,
        organization: { select: { nome: true } },
        profile: { select: { whatsapp: true } },
      } as any,
      orderBy: { criadoEm: "desc" },
    });

    const cobrancas = await (this.prisma as any).assinaturaCobranca.findMany({
      where: { status: { in: ["pago", "pendente"] } },
      orderBy: { criadoEm: "desc" },
    });
    const porUsuario = new Map<string, any[]>();
    for (const c of cobrancas) porUsuario.set(c.userId, [...(porUsuario.get(c.userId) || []), c]);

    const linhas = (contas as any[]).map((u) => {
      const f = faseDaConta(u as any);
      const minhas = porUsuario.get(u.id) || [];
      const ultimoPago = minhas.find((c: any) => c.status === "pago" && c.validadeConcedidaAte);
      const pendente = minhas.find((c: any) => c.status === "pendente");
      const vencido = !!f && f.limite.getTime() < agora.getTime();

      // A ordem importa: "fora do ciclo" vem primeiro, senão uma conta sem
      // fase nenhuma apareceria como se estivesse em dia.
      const estado = !f ? "FORA_DO_CICLO"
        : vencido ? (podeRenovar(u as any, agora) ? "INADIMPLENTE" : "ENCERRADO")
        : f.fase === "TESTE" ? "EM_TESTE"
        : "EM_DIA";

      return {
        id: u.id, nome: u.nome, email: u.email, whatsapp: u.profile?.whatsapp || null,
        organizacao: u.organization?.nome || null, produto: produtoLabel(u.trialModulo),
        estado, fase: f?.fase ?? null, venceEm: f?.limite ?? null,
        criadoEm: u.criadoEm, clienteDesde: u.assinaturaEm, renovacaoAuto: !!u.assinaturaRenovacaoAuto,
        ultimoPagamento: ultimoPago
          ? { pagoEm: ultimoPago.pagoEm, valorCentavos: ultimoPago.valor, meio: ultimoPago.meio }
          : null,
        cobrancaPendente: pendente ? { ciclo: pendente.ciclo, meio: pendente.meio, expiraEm: pendente.expiraEm } : null,
        totalPagoCentavos: minhas.filter((c: any) => c.status === "pago").reduce((s: number, c: any) => s + c.valor, 0),
      };
    });

    const quantos = (e: string) => linhas.filter((l) => l.estado === e).length;
    return {
      valorMensalLabel: VALOR_MENSALIDADE_LABEL,
      resumo: {
        emDia: quantos("EM_DIA"), emTeste: quantos("EM_TESTE"),
        inadimplentes: quantos("INADIMPLENTE"), encerrados: quantos("ENCERRADO"),
        foraDoCiclo: quantos("FORA_DO_CICLO"),
        noCartao: linhas.filter((l) => l.renovacaoAuto).length,
        recebidoCentavos: linhas.reduce((s, l) => s + l.totalPagoCentavos, 0),
      },
      contas: linhas,
    };
  }

  /**
   * Libera meses SEM pagamento — a cortesia da equipe.
   *
   * Passa pela mesma porta de todo mundo (`aplicarPagamentoConfirmado`), e não
   * por um UPDATE na validade: assim a cortesia herda a idempotência, avisa a
   * pessoa no WhatsApp e, principalmente, FICA NO HISTÓRICO. Uma cobrança de
   * valor 0 com meio "cortesia" é a prova de quem liberou e quando — antes
   * disso, renovar de graça era SQL na mão e não sobrava registro nenhum.
   */
  async liberarCortesia(userId: string, meses: number, motivo: string, agora = new Date()) {
    const quantos = Math.min(12, Math.max(1, Math.floor(meses || 1)));
    const u = await this.carregar(userId);
    if (!faseDaConta(u as any) && !u.isTrial) {
      throw new BadRequestException("Esta conta está fora do ciclo de mensalidade — a cortesia não teria o que estender.");
    }

    const concedidos: string[] = [];
    for (let i = 0; i < quantos; i++) {
      const validadeAlvo = this.proximoPeriodo(await this.carregar(userId), agora);
      const cobranca = await (this.prisma as any).assinaturaCobranca.create({
        // Sem campo de observação na tabela, e não vale uma migration em
        // produção só por isso: o motivo fica no log, e a linha já diz o que
        // importa — valor 0 e meio "cortesia".
        data: { userId, valor: 0, ciclo: cicloDe(validadeAlvo), meio: "cortesia", status: "pendente" },
      });
      const r = await this.aplicarPagamentoConfirmado(cobranca.id, agora);
      if (!r) break;
      concedidos.push(cobranca.id);
    }

    this.logger.warn(`Cortesia de ${concedidos.length} mês(es) para user=${userId}. Motivo: ${motivo || "não informado"}`);
    const final = await this.carregar(userId);
    return { meses: concedidos.length, validaAte: final.assinaturaValidaAte, cobrancas: concedidos };
  }

  /** Cria a assinatura de cartão e devolve o endereço do checkout do MP. */
  async assinarNoCartao(userId: string, agora = new Date()) {
    const u = await this.carregar(userId);
    const f = faseDaConta(u as any);
    if (!f) throw new BadRequestException("Esta conta está fora do ciclo de mensalidade.");

    const mp = this.mp();
    if (!mp) throw new BadRequestException("Pagamento indisponível no momento. Fale com a nossa equipe.");

    // Reaproveita a assinatura que já está esperando autorização.
    //
    // Sem isto, cada clique cria um preapproval novo no Mercado Pago. Se a
    // pessoa abrir o link duas vezes e autorizar as duas, são DUAS assinaturas
    // mensais no mesmo cartão — e nós só guardamos o id da última, então a
    // primeira cobraria todo mês sem ninguém olhando para ela.
    //
    // Reaproveitar também fixa o dia do ciclo: o Mercado Pago marca a cobrança
    // pela data de criação do preapproval, então o dia é o do primeiro clique,
    // não o de uma tentativa repetida.
    if (u.assinaturaPreapprovalId) {
      const atual = await mp.consultarPreapproval(u.assinaturaPreapprovalId).catch(() => null);
      if (atual?.status === "pending" && atual.init_point) {
        return { initPoint: atual.init_point, preapprovalId: atual.id, reaproveitada: true };
      }
    }

    let preapproval;
    try {
      preapproval = await mp.criarPreapproval({
        valorCentavos: VALOR_MENSALIDADE,
        razao: `${produtoLabel(u.trialModulo)} — ${VALOR_MENSALIDADE_LABEL}/mês`,
        payerEmail: u.email,
        backUrl: `${this.linkDePagamento(u.id)}?retorno=cartao`,
        externalReference: u.id,
      });
    } catch (e) {
      this.logger.error(`Preapproval não criado para user=${u.id}: ${(e as Error).message}`);
      throw new BadRequestException("Não foi possível abrir o pagamento no cartão agora. Tente o Pix ou fale com a nossa equipe.");
    }

    if (!preapproval.init_point) {
      this.logger.error(`Preapproval ${preapproval.id} veio sem init_point.`);
      throw new BadRequestException("O Mercado Pago não devolveu o endereço do checkout. Fale com a nossa equipe.");
    }

    // Guarda o preapproval já aqui: se a pessoa autorizar e o webhook chegar
    // antes de qualquer outra coisa, nós sabemos de quem é.
    await this.prisma.user.update({
      where: { id: u.id },
      data: { assinaturaPreapprovalId: preapproval.id } as any,
    });

    return { initPoint: preapproval.init_point, preapprovalId: preapproval.id };
  }

  // ── O coração: conceder o mês ─────────────────────────────────────────────

  /**
   * Única porta de entrada do acesso pago. Idempotente: `validadeConcedidaAte`
   * na cobrança é a prova de que ela já foi aplicada.
   *
   * Isso não é zelo exagerado — o Mercado Pago reenvia notificação como REGRA
   * (retentativa, reenvio manual do painel, o mesmo evento por dois tópicos).
   * Sem essa marca, o mesmo pagamento somaria dois meses de acesso.
   *
   * Devolve null quando não havia nada a fazer.
   */
  async aplicarPagamentoConfirmado(cobrancaId: string, agora = new Date()) {
    const resultado = await this.prisma.$transaction(async (tx: any) => {
      const c = await tx.assinaturaCobranca.findUnique({ where: { id: cobrancaId } });
      if (!c) return null;
      if (c.validadeConcedidaAte) return null; // já aplicada

      const u = await tx.user.findUnique({
        where: { id: c.userId },
        select: {
          id: true, isTrial: true, trialExpiraEm: true, assinaturaEm: true,
          assinaturaValidaAte: true, trialLembreteEm: true, assinaturaRenovacaoAuto: true,
        },
      });
      if (!u) return null;

      const f = faseDaConta(u as any);
      const novaValidade = proximaValidade(f ? f.limite : null, agora);

      // Reserva: se outra transação aplicou esta cobrança no meio do caminho,
      // o WHERE não casa e saímos sem conceder nada.
      const reserva = await tx.assinaturaCobranca.updateMany({
        where: { id: cobrancaId, validadeConcedidaAte: null },
        data: { status: "pago", pagoEm: c.pagoEm ?? agora, validadeConcedidaAte: novaValidade },
      });
      if (reserva.count === 0) return null;

      await tx.user.update({
        where: { id: u.id },
        data: {
          assinaturaEm: u.assinaturaEm ?? agora,
          assinaturaValor: c.valor,
          assinaturaValidaAte: novaValidade,
          trialAvisadoSuporte: false,
          trialRenovacaoResposta: "PAGOU",
          trialRenovacaoRespostaEm: agora,
        } as any,
      });

      return { novaValidade, userId: u.id, primeiroMes: !u.assinaturaEm };
    });

    if (!resultado) return null;

    this.logger.log(
      `Pagamento aplicado: cobranca=${cobrancaId} user=${resultado.userId} ` +
        `acesso até ${resultado.novaValidade.toISOString()}`,
    );

    // Avisa a pessoa. Falha de WhatsApp não desfaz pagamento aplicado.
    const u = await this.carregar(resultado.userId).catch(() => null);
    if (u) {
      await this.falar(
        u,
        montarPagamentoConfirmado({
          nome: u.nome,
          modulo: u.trialModulo,
          validaAte: resultado.novaValidade,
          renovacaoAuto: u.assinaturaRenovacaoAuto,
        }),
      ).catch(() => false);
    }

    return resultado;
  }

  /**
   * Monta a cobrança para mandar no WhatsApp: a mensagem com os caminhos e,
   * quando há Pix, o copia-e-cola SEPARADO — código no meio de texto corrido
   * não se copia com um toque no celular.
   *
   * Quem envia é o chamador, de propósito: na conversa de entrada a resposta
   * precisa sair pelo mesmo caminho que trata `@lid`, que é do módulo do
   * WhatsApp, não daqui.
   */
  async prepararCobranca(userId: string, agora = new Date()): Promise<{
    texto: string; pixCopiaECola: string | null; usuario: UsuarioCobravel;
  }> {
    let qr: string | null = null;
    let usuario: UsuarioCobravel;
    try {
      const r = await this.gerarPix(userId, agora);
      qr = r.cobranca.pixQrCode || null;
      usuario = r.usuario;
    } catch (e) {
      // Sem Pix (MP fora, ou conta exigindo dado que não temos) a cobrança
      // ainda vale: a página de checkout resolve no cartão. Só não vale ficar
      // calado — se nem a cobrança abriu, o erro sobe.
      this.logger.warn(`Cobrança sem Pix para user=${userId}: ${(e as Error).message}`);
      await this.abrirCobranca(userId, agora);
      usuario = await this.carregar(userId);
    }

    return {
      texto: montarCobranca({
        nome: usuario.nome,
        modulo: usuario.trialModulo,
        urlCheckout: this.linkDePagamento(usuario.id),
        temPix: !!qr,
      }),
      pixCopiaECola: qr ? montarPixCopiaECola(qr) : null,
      usuario,
    };
  }

  /** Manda a cobrança por conta própria — usado fora da conversa de entrada. */
  async enviarCobrancaPorWhatsApp(userId: string, agora = new Date()): Promise<boolean> {
    const c = await this.prepararCobranca(userId, agora);
    const ok = await this.falar(c.usuario, c.texto);
    if (ok && c.pixCopiaECola) await this.falar(c.usuario, c.pixCopiaECola).catch(() => false);
    return ok;
  }

  // ── Página de checkout (sem login) ────────────────────────────────────────

  async estadoCheckout(token: string, agora = new Date()) {
    const userId = lerTokenCheckout(token);
    if (!userId) throw new NotFoundException("Link inválido ou expirado.");
    const u = await this.carregar(userId);
    const f = faseDaConta(u as any);

    const pendente = f
      ? await this.pendenteDoCiclo(u.id, cicloDe(this.proximoPeriodo(u, agora)), agora)
      : null;

    const pago = await this.ultimoPagamento(u.id);

    return {
      nome: u.nome,
      produto: produtoLabel(u.trialModulo),
      valorCentavos: VALOR_MENSALIDADE,
      valorLabel: VALOR_MENSALIDADE_LABEL,
      fase: f?.fase ?? null,
      venceEm: f?.limite ?? null,
      vencido: !!f && f.limite.getTime() < agora.getTime(),
      podeRenovar: podeRenovar(u as any, agora),
      renovacaoAuto: u.assinaturaRenovacaoAuto,
      proximoPeriodoAte: f ? this.proximoPeriodo(u, agora) : null,
      pix: pendente?.pixQrCode ? { copiaECola: pendente.pixQrCode, expiraEm: pendente.expiraEm } : null,
      ultimoPagamento: pago
        ? {
            pagoEm: pago.pagoEm,
            valorCentavos: pago.valor,
            meio: pago.meio,
            liberouAte: pago.validadeConcedidaAte,
          }
        : null,
    };
  }

  async checkoutCartao(token: string) {
    const userId = lerTokenCheckout(token);
    if (!userId) throw new NotFoundException("Link inválido ou expirado.");
    return this.assinarNoCartao(userId);
  }

  async checkoutPix(token: string) {
    const userId = lerTokenCheckout(token);
    if (!userId) throw new NotFoundException("Link inválido ou expirado.");
    const r = await this.gerarPix(userId);
    return {
      copiaECola: r.cobranca.pixQrCode,
      qrCodeBase64: (r as any).qrCodeBase64 ?? null,
      expiraEm: r.cobranca.expiraEm,
      valorCentavos: r.cobranca.valor,
    };
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

  /**
   * Processa a notificação do MP. A conferência da assinatura acontece ANTES,
   * no controller, e nada roda sem ela.
   */
  async processarNotificacao(tipo: string, dataId: string) {
    const mp = this.mp();
    if (!mp) return;

    const t = tipoNotificacao({ type: tipo });
    if (!t) {
      this.logger.log(`Notificação MP ignorada (tipo não tratado): ${tipo}`);
      return;
    }

    if (t === "payment") return this.doPagamento(mp, dataId);
    if (t === "subscription_authorized_payment") return this.doPagamentoDeAssinatura(mp, dataId);
    return this.doPreapproval(mp, dataId);
  }

  /**
   * Pagamento avulso (Pix) — o `external_reference` é o id da cobrança.
   *
   * CADA FLUXO DE DINHEIRO TEM UMA FONTE SÓ. Uma cobrança mensal de cartão
   * chega ao nosso webhook por DOIS tópicos: `payment` e
   * `subscription_authorized_payment`. Se os dois concedessem mês, um pagamento
   * de R$ 11,90 viraria dois meses de acesso — e sem erro nenhum no log, porque
   * são ids diferentes e a trava de idempotência (que é por cobrança) não veria
   * relação entre eles.
   *
   * Então: Pix é tratado aqui, cartão é tratado só em
   * `doPagamentoDeAssinatura`. Um `payment` de assinatura cai no `return` de
   * baixo de propósito.
   */
  private async doPagamento(mp: MercadoPagoClient, paymentId: string) {
    const pagamento = await mp.consultarPagamento(paymentId);
    const status = statusCobranca(pagamento.status);

    const cobranca = await (this.prisma as any).assinaturaCobranca.findFirst({
      where: { OR: [{ mpPaymentId: String(pagamento.id) }, { id: pagamento.external_reference || "__nenhum__" }] },
    });

    if (!cobranca) {
      if (pagamento.preapproval_id) {
        this.logger.log(
          `Pagamento ${paymentId} é de assinatura de cartão (preapproval=${pagamento.preapproval_id}); ` +
            `quem trata é subscription_authorized_payment.`,
        );
        return;
      }
      this.logger.warn(`Pagamento ${paymentId} (${pagamento.status}) sem cobrança correspondente.`);
      return;
    }

    await (this.prisma as any).assinaturaCobranca.update({
      where: { id: cobranca.id },
      data: {
        mpPaymentId: String(pagamento.id),
        meio: cobranca.meio ?? (pagamento.payment_type_id === "credit_card" ? "cartao" : "pix"),
        ...(status === "pago" ? {} : { status }),
        ...(pagamento.date_approved ? { pagoEm: new Date(pagamento.date_approved) } : {}),
      },
    });

    if (status === "pago") await this.aplicarPagamentoConfirmado(cobranca.id);
    else this.logger.log(`Cobrança ${cobranca.id} → ${status} (MP: ${pagamento.status}/${pagamento.status_detail || "-"})`);
  }

  /**
   * Cobrança mensal gerada por uma assinatura de cartão — o único caminho que
   * concede mês no cartão.
   *
   * A chave é o id do `authorized_payment`, não o do pagamento: é ele que
   * identifica "a cobrança de novembro desta assinatura" de forma estável,
   * mesmo quando o MP recicla a tentativa e troca o pagamento por baixo.
   */
  private async doPagamentoDeAssinatura(mp: MercadoPagoClient, authorizedPaymentId: string) {
    const ap = await mp.consultarAuthorizedPayment(authorizedPaymentId);
    if (!ap.preapproval_id) return;

    const statusPagamento = ap.payment?.status || (ap.status === "processed" ? "approved" : ap.status);
    const aprovado = statusCobranca(statusPagamento) === "pago";

    if (!aprovado) {
      this.logger.warn(
        `Cobrança de assinatura ${authorizedPaymentId} não aprovada (ap=${ap.status}, pagamento=${statusPagamento}) ` +
          `— preapproval=${ap.preapproval_id}`,
      );
      // `recycling` é o Mercado Pago tentando de novo nos próximos dias: avisar
      // a cada tentativa seria alarmar quem ainda vai ser cobrado sem problema.
      // Só falamos quando ele desiste.
      if (ap.status === "recycling" || ap.status === "scheduled") return;

      const u = await this.prisma.user.findFirst({
        where: { assinaturaPreapprovalId: ap.preapproval_id } as any,
        select: { id: true },
      });
      if (!u) return;
      const conta = await this.carregar(u.id).catch(() => null);
      const f = conta ? faseDaConta(conta as any) : null;
      if (!conta || !f) return;

      await this.falar(
        conta,
        montarCobrancaFalhou({ nome: conta.nome, limite: f.limite, urlCheckout: this.linkDePagamento(conta.id) }),
      ).catch(() => false);
      return;
    }

    const cobranca = await this.cobrancaDoPreapproval(ap.preapproval_id, `ap-${authorizedPaymentId}`);
    if (!cobranca) return;

    await (this.prisma as any).assinaturaCobranca.update({
      where: { id: cobranca.id },
      data: { meio: "cartao", pagoEm: new Date() },
    });
    await this.aplicarPagamentoConfirmado(cobranca.id);
  }

  /**
   * Acha (ou abre) a cobrança de uma cobrança mensal de cartão.
   *
   * A chave de idempotência é o id que o MP dá àquela cobrança do mês: na
   * segunda notificação do mesmo id, encontramos a linha que já existe e
   * `aplicarPagamentoConfirmado` sai sem conceder nada.
   */
  private async cobrancaDoPreapproval(preapprovalId: string, chaveMp: string) {
    const u = await this.prisma.user.findFirst({
      where: { assinaturaPreapprovalId: preapprovalId } as any,
      select: { id: true },
    });
    if (!u) {
      this.logger.warn(`Preapproval ${preapprovalId} não está ligado a nenhuma conta.`);
      return null;
    }

    const jaExiste = await (this.prisma as any).assinaturaCobranca.findFirst({
      where: { mpPaymentId: chaveMp },
    });
    if (jaExiste) return jaExiste;

    let cobranca: any;
    try {
      ({ cobranca } = await this.abrirCobranca(u.id));
    } catch (e) {
      // Não engolir: um pagamento de cartão que não achou onde ser registrado é
      // dinheiro recebido sem acesso liberado, e alguém precisa saber.
      this.logger.error(
        `Cartão pago (preapproval=${preapprovalId}, mp=${chaveMp}) mas a cobrança não abriu ` +
          `para user=${u.id}: ${(e as Error).message}`,
      );
      return null;
    }

    return (this.prisma as any).assinaturaCobranca.update({
      where: { id: cobranca.id },
      data: { meio: "cartao", mpPreapprovalId: preapprovalId, mpPaymentId: chaveMp },
    });
  }

  /** A assinatura de cartão mudou de estado (autorizada, pausada, cancelada). */
  private async doPreapproval(mp: MercadoPagoClient, preapprovalId: string) {
    const pre = await mp.consultarPreapproval(preapprovalId);
    const userId = pre.external_reference;

    const u = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
      : await this.prisma.user.findFirst({ where: { assinaturaPreapprovalId: preapprovalId } as any, select: { id: true } });
    if (!u) {
      this.logger.warn(`Preapproval ${preapprovalId} sem conta correspondente.`);
      return;
    }

    const autorizada = pre.status === "authorized";
    await this.prisma.user.update({
      where: { id: u.id },
      data: {
        assinaturaPreapprovalId: preapprovalId,
        assinaturaRenovacaoAuto: autorizada,
      } as any,
    });
    this.logger.log(`Preapproval ${preapprovalId} → ${pre.status} (user=${u.id}, renovação auto=${autorizada})`);
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * Checkout PÚBLICO de propósito: quem precisa pagar está com o acesso vencido e
 * não consegue fazer login. O token do link é a identificação.
 */
@Controller("assinatura/checkout")
export class AssinaturaCheckoutController {
  constructor(private svc: AssinaturaService) {}

  @Get(":token")
  estado(@Param("token") token: string) {
    return this.svc.estadoCheckout(token);
  }

  @Post(":token/cartao")
  @HttpCode(HttpStatus.OK)
  cartao(@Param("token") token: string) {
    return this.svc.checkoutCartao(token);
  }

  @Post(":token/pix")
  @HttpCode(HttpStatus.OK)
  pix(@Param("token") token: string) {
    return this.svc.checkoutPix(token);
  }
}

@Controller("assinatura/webhook")
export class AssinaturaWebhookController {
  private readonly logger = new Logger(AssinaturaWebhookController.name);

  constructor(
    private svc: AssinaturaService,
    private config: ConfigService,
  ) {}

  /**
   * Webhook do Mercado Pago.
   *
   * Responde 200 depois de processar: o MP trata não-200 como falha e reenvia,
   * e reenvio é inofensivo aqui (aplicar pagamento é idempotente). O que NÃO
   * pode é processar sem conferir a assinatura — por isso 403 trava antes.
   */
  @Post("mp")
  @HttpCode(HttpStatus.OK)
  async mp(
    @Query("data.id") dataIdQuery: string,
    @Query("id") idQuery: string,
    @Query("type") typeQuery: string,
    @Headers("x-signature") xSignature: string,
    @Headers("x-request-id") xRequestId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const dataId = dataIdQuery || idQuery || ((body?.data as any)?.id ? String((body.data as any).id) : "");
    const tipo = (body?.type as string) || typeQuery || "";

    const conferencia = conferirAssinatura({
      xSignature,
      xRequestId,
      dataId,
      secret: this.config.get<string>("MP_WEBHOOK_SECRET"),
    });

    if (!conferencia.valida) {
      // Não dá pista de qual parte falhou para quem está do lado de fora.
      this.logger.warn(`Webhook MP RECUSADO (${conferencia.motivo}) — tipo=${tipo} data.id=${dataId}`);
      throw new ForbiddenException("Assinatura inválida.");
    }

    this.logger.log(`Webhook MP aceito: tipo=${tipo} data.id=${dataId}`);
    await this.svc.processarNotificacao(tipo, dataId).catch((e) =>
      this.logger.error(`Falha ao processar notificação MP (tipo=${tipo} id=${dataId}): ${e?.message || e}`),
    );

    return { recebido: true };
  }
}

class CortesiaDto {
  @IsOptional() @IsInt() @Min(1) @Max(12) meses?: number;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}

/**
 * Painel de billing — exclusivo do Super Admin.
 *
 * Fica aqui, e não no `billing` legado, porque quem conhece o ciclo é este
 * módulo: o legado ainda fala de planos de R$ 99,90 e R$ 199,90, que não
 * existem mais. Hoje é um preço só.
 */
@Controller("superadmin/billing")
@UseGuards(AuthGuard("jwt"), ProspectSaGuard)
export class AssinaturaAdminController {
  constructor(private svc: AssinaturaService) {}

  @Get()
  painel() {
    return this.svc.painel();
  }

  @Post(":userId/cortesia")
  @HttpCode(HttpStatus.OK)
  cortesia(@Param("userId") userId: string, @Body() body: CortesiaDto) {
    return this.svc.liberarCortesia(userId, body.meses ?? 1, body.motivo || "");
  }

  /** O link de pagamento, para a equipe reenviar a quem perdeu a mensagem. */
  @Get(":userId/link")
  link(@Param("userId") userId: string) {
    return { link: this.svc.linkDePagamento(userId) };
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [AssinaturaCheckoutController, AssinaturaWebhookController, AssinaturaAdminController],
  providers: [AssinaturaService, ProspectSaGuard],
  exports: [AssinaturaService],
})
export class AssinaturaModule {}
