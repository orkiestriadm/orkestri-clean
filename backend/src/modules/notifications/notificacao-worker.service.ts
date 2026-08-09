import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "./whatsapp.service";
import { EmailService } from "./email.service";
import { resolverInstancia } from "./resolver-instancia";
import { MARCA } from "../../common/marca";

/**
 * Entrega o que o despachante enfileirou.
 *
 * O envio saiu do caminho do alerta de propósito. Antes, cada disparador
 * chamava `sendMessage(...).catch(() => {})` direto: se a instância estivesse
 * fora do ar naquele segundo, a mensagem morria ali — nem quando o WhatsApp
 * voltasse, minutos depois, ela seria reenviada. E ninguém ficava sabendo,
 * porque o `catch` vazio engolia tudo.
 *
 * Com a outbox, "instância caída" vira "entrega adiada" em vez de "mensagem
 * perdida".
 */

/** Teto de tentativas antes de desistir. 5 cobre uma queda de ~10 min com o
 *  intervalo atual; acima disso o problema não é transitório e insistir só
 *  consome o número. */
const MAX_TENTATIVAS = 5;

/** Envios mais velhos que isto são descartados em vez de entregues: alerta de
 *  ontem chegando hoje confunde mais do que ajuda. */
const VALIDADE_HORAS = 12;

/** Por quantos dias a trilha guarda um envio já concluído. 90 cobre uma
 *  auditoria trimestral, que é o horizonte em que alguém pergunta "essa
 *  mensagem chegou?". */
const RETENCAO_DIAS = 90;

/** O título e a mensagem vêm de dado do usuário (placa, descrição de OS) e vão
 *  para dentro de HTML no e-mail. Sem escapar, uma descrição com `<script>`
 *  viaja junto. */
function escaparHtml(v: any): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

@Injectable()
export class NotificacaoWorker {
  private readonly logger = new Logger(NotificacaoWorker.name);
  private rodando = false;

  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private email: EmailService,
  ) {}
  private get db() { return this.prisma as any; }

  /**
   * Retenção da trilha.
   *
   * `notificacao_envios` cresce a cada alerta e nada a limpava — em uma frota
   * com dezenas de veículos isso vira milhões de linhas em poucos anos, e a
   * consulta da tela de trilha (ordenada por data) degrada junto.
   *
   * Só o que já terminou é apagado. Pendente nunca é removido por idade: quem
   * decide descartar é o `VALIDADE_HORAS`, com registro do motivo.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async limparAntigos() {
    const corte = new Date(Date.now() - RETENCAO_DIAS * 86400000);
    const r = await this.db.notificacaoEnvio.deleteMany({
      where: { criadoEm: { lt: corte }, status: { in: ["enviada", "descartada", "agrupada", "falhou"] } },
    }).catch(() => ({ count: 0 }));
    if (r.count) this.logger.log(`Trilha de notificações: ${r.count} registro(s) com mais de ${RETENCAO_DIAS} dias removidos`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processar() {
    // Guarda de reentrada: o tick é de 1 min e uma rodada com muitos envios
    // pode passar disso. Sem isto, duas rodadas pegariam as mesmas linhas e a
    // pessoa receberia a mensagem duplicada.
    if (this.rodando) return;
    this.rodando = true;
    try {
      const agora = new Date();
      const pendentes = await this.db.notificacaoEnvio.findMany({
        where: {
          status: "pendente",
          OR: [{ agendadoPara: null }, { agendadoPara: { lte: agora } }],
        },
        orderBy: [{ severidade: "desc" }, { criadoEm: "asc" }],
        take: 200,
      }).catch(() => []);
      if (!pendentes.length) return;

      // Agrupa por organização: vazão e configuração são por organização, e
      // uma org com muitos alertas não pode atrasar as outras.
      const porOrg = new Map<string, any[]>();
      for (const e of pendentes) {
        if (!porOrg.has(e.organizationId)) porOrg.set(e.organizationId, []);
        porOrg.get(e.organizationId)!.push(e);
      }

      for (const [orgId, envios] of porOrg) {
        await this.processarOrg(orgId, envios, agora).catch(err =>
          this.logger.error(`Org ${orgId}: ${err?.message}`));
      }
    } finally {
      this.rodando = false;
    }
  }

  private async processarOrg(orgId: string, envios: any[], agora: Date) {
    const cfg = await this.db.orgNotificacaoConfig.findUnique({ where: { organizationId: orgId } })
      .catch(() => null);
    const maxPorMinuto = Number(cfg?.maxPorMinuto ?? 12);
    const agrupar = cfg?.agruparPorModulo ?? true;

    // Expira o que ficou velho demais para ser útil.
    const limite = new Date(agora.getTime() - VALIDADE_HORAS * 3600000);
    const vencidos = envios.filter(e => new Date(e.criadoEm) < limite);
    if (vencidos.length) {
      await this.db.notificacaoEnvio.updateMany({
        where: { id: { in: vencidos.map(e => e.id) } },
        data: { status: "descartada", ultimoErro: `Expirado (> ${VALIDADE_HORAS}h sem envio)` },
      }).catch(() => {});
    }
    let fila = envios.filter(e => new Date(e.criadoEm) >= limite);
    if (!fila.length) return;

    // ── E-mail sai sem agrupamento e sem teto de vazão ──────────────────────
    // Não há risco de banimento como no WhatsApp, e mensagens separadas na
    // caixa de entrada são mais fáceis de arquivar do que um bloco só.
    const emails = fila.filter(e => e.canal === "email");
    for (const e of emails) await this.entregarEmail(e);

    let whats = fila.filter(e => e.canal === "whatsapp");
    if (!whats.length) return;

    // ── Agrupamento ────────────────────────────────────────────────────────
    // Cinco alertas de frota para a mesma pessoa viram UMA mensagem. Além de
    // ser menos ruim de ler, é o que mantém o disparo longe do padrão que faz
    // o WhatsApp banir o número.
    if (agrupar) whats = await this.agrupar(whats);

    const instancia = await resolverInstancia(this.wa, orgId);
    if (!instancia) {
      this.logger.warn(`Org ${orgId} sem instância WhatsApp — ${whats.length} envio(s) seguem pendentes`);
      return;
    }

    // Se a instância está fora do ar, nem tenta: deixa pendente para a próxima
    // rodada. É exatamente o caso que antes perdia a mensagem.
    const status = await this.wa.getStatus(instancia).catch(() => null);
    if (!status?.connected) {
      this.logger.warn(`Instância ${instancia} desconectada — ${whats.length} envio(s) adiado(s)`);
      return;
    }

    let enviados = 0;
    for (const e of whats) {
      if (enviados >= maxPorMinuto) break; // o resto sai no próximo minuto
      await this.entregarWhatsapp(e, instancia);
      enviados++;
    }
  }

  /**
   * Junta os envios pendentes do mesmo (usuário, módulo) numa mensagem só.
   * As linhas absorvidas ficam como `agrupada` — some da fila mas continua na
   * trilha, para quem for auditar entender por que não houve envio próprio.
   */
  private async agrupar(envios: any[]): Promise<any[]> {
    const grupos = new Map<string, any[]>();
    for (const e of envios) {
      const k = `${e.userId}|${e.modulo}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(e);
    }

    const saida: any[] = [];
    for (const [, itens] of grupos) {
      if (itens.length === 1) { saida.push(itens[0]); continue; }

      const principal = itens[0];
      const extras = itens.slice(1);
      const linhas = itens.map(i => `• ${i.titulo}`).join("\n");
      saida.push({
        ...principal,
        titulo: `${itens.length} avisos`,
        mensagem: linhas,
        _agrupou: extras.map(e => e.id),
      });
    }
    return saida;
  }

  private async entregarWhatsapp(e: any, instancia: string) {
    // Mensagem que já vem com cabeçalho próprio (começa com negrito do
    // WhatsApp) sai como está. É o caso de Chamados e Automações, que passaram
    // a usar a fila mas mantêm os textos formatados de cada evento — prefixar
    // de novo produziria duas marcas empilhadas.
    const jaFormatada = String(e.mensagem || "").trimStart().startsWith("*");
    const texto = jaFormatada ? e.mensagem : `*${MARCA}*\n\n${e.titulo}\n${e.mensagem}`;
    let ok = false, erro: string | null = null;
    try {
      ok = await this.wa.sendMessage(e.destino, texto, instancia);
    } catch (err: any) {
      erro = err?.message || String(err);
    }
    await this.registrar(e, ok, erro);
  }

  private async entregarEmail(e: any) {
    let ok = false, erro: string | null = null;
    try {
      const corpo = `<p><strong>${escaparHtml(e.titulo)}</strong></p><p>${escaparHtml(e.mensagem).replace(/\n/g, "<br>")}</p>`;
      ok = await this.email.enviarNotificacao(e.destino, e.titulo, corpo);
      if (!ok) erro = "Serviço de e-mail indisponível ou recusou o envio";
    } catch (err: any) {
      erro = err?.message || String(err);
    }
    await this.registrar(e, ok, erro);
  }

  private async registrar(e: any, ok: boolean, erro: string | null) {
    const tentativas = (e.tentativas || 0) + 1;
    // Só desiste no teto. Antes do teto continua "pendente" e volta na próxima
    // rodada — é isso que transforma queda de instância em atraso, não perda.
    const status = ok ? "enviada" : (tentativas >= MAX_TENTATIVAS ? "falhou" : "pendente");

    await this.db.notificacaoEnvio.update({
      where: { id: e.id },
      data: {
        status, tentativas,
        enviadoEm: ok ? new Date() : null,
        ultimoErro: ok ? null : (erro || "Envio não confirmado pelo provedor"),
      },
    }).catch(() => {});

    if (ok && e._agrupou?.length) {
      await this.db.notificacaoEnvio.updateMany({
        where: { id: { in: e._agrupou } },
        data: { status: "agrupada", enviadoEm: new Date() },
      }).catch(() => {});
    }

    if (!ok && status === "falhou") {
      this.logger.error(`Envio ${e.canal} para ${e.destino} falhou definitivamente: ${erro}`);
    }
  }
}
