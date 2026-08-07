import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { EmailService } from "../../notifications/email.service";
import { WhatsAppService } from "../../notifications/whatsapp.service";
import { ObrigacaoRepository } from "../infrastructure/obrigacao.repository";
import { CatalogoRepository } from "../infrastructure/catalogo.repository";
import { EnvioRepository, HistoricoRepository } from "../infrastructure/arquivo.repository";
import { camposComoTexto, ROTULO_SITUACAO } from "./obrigacao.presenter";
import {
  marcoVigente, dataBaseDe, degrauEscalonamento, renderizarTemplate,
  mensagemPadrao, chaveEnvio, diasAte, ContextoMensagem, Marco,
} from "../domain/alerta.entity";
import { situacaoPrazo, diasEntreSeguro } from "./notificacao.helpers";

type Destino = {
  canal: string;
  endereco: string;
  userId?: string | null;
  nome: string;
};

/**
 * Motor de alertas do Compliance.
 *
 * É o diferencial que a especificação nomeia e o que a planilha não tinha: lá,
 * a coluna "Observação" era digitada à mão, e no dia da análise três licenças
 * estavam com o prazo estourado sem que ninguém tivesse sido avisado.
 *
 * Três garantias sustentam o motor:
 *
 *  1. NÃO PERDE MARCO. `marcoVigente` devolve o limiar mais recentemente
 *     cruzado, não o que casa exatamente com hoje. Varredura que não rodou por
 *     três dias (deploy, container parado) recupera o aviso ao voltar.
 *
 *  2. NÃO REPETE. Cada envio grava uma chave única (obrigação + marco + canal +
 *     destino). A repetição colide no índice e é descartada — sem isso, o mesmo
 *     "faltam 30 dias" chegaria todo dia por trinta dias e ninguém leria mais.
 *
 *  3. NÃO INVENTA DESTINATÁRIO. Só quem está nomeado como responsável, mais os
 *     e-mails/WhatsApps extras da régua. "Avisar o RH" exigiria resolver quem
 *     tem a permissão em tempo de execução, e avisar todo mundo é ruído.
 */
@Injectable()
export class NotificacaoService {
  private readonly logger = new Logger(NotificacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly obrigacoes: ObrigacaoRepository,
    private readonly catalogo: CatalogoRepository,
    private readonly envios: EnvioRepository,
    private readonly historico: HistoricoRepository,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  /**
   * Varredura diária.
   *
   * 07:00 e não meia-noite: aviso criado de madrugada some no meio dos outros
   * antes de a pessoa abrir o sistema. Mesmo horário do People, de propósito —
   * quem cuida das duas coisas recebe tudo de uma vez.
   */
  @Cron("0 7 * * *")
  async varrerPrazos() {
    this.logger.log("Varredura de prazos do Compliance iniciada");
    const inicio = Date.now();
    try {
      const resultado = await this.executarVarredura();
      this.logger.log(
        `Varredura concluída em ${Date.now() - inicio}ms: ` +
        `${resultado.examinadas} obrigações examinadas, ${resultado.enviados} avisos enviados, ` +
        `${resultado.escalonamentos} escalonamentos, ${resultado.marcadasVencidas} marcadas como vencidas.`,
      );
      return resultado;
    } catch (erro) {
      this.logger.error("Varredura de prazos do Compliance falhou", erro as Error);
      throw erro;
    }
  }

  /** Exposto para a tela de configuração disparar uma varredura sob demanda. */
  async executarVarredura(hoje: Date = new Date()) {
    // O status declarado precisa acompanhar a data, senão a lista filtrada por
    // "ativa" continuaria exibindo licença vencida como ativa.
    const marcadasVencidas = await this.obrigacoes.marcarVencidas(hoje);

    // Janela: o maior marco "antes" que faz sentido (365 dias) e o maior
    // "depois" (365). Fora disso não há régua que dispare, e varrer a carteira
    // inteira todo dia seria trabalho jogado fora.
    const inferior = new Date(hoje.getTime()); inferior.setDate(inferior.getDate() - 365);
    const superior = new Date(hoje.getTime()); superior.setDate(superior.getDate() + 365);

    const obrigacoes = await this.obrigacoes.paraVarredura(inferior, superior);

    let enviados = 0;
    let escalonamentos = 0;

    for (const o of obrigacoes) {
      try {
        enviados += await this.avaliarObrigacao(o, hoje);
        escalonamentos += await this.avaliarEscalonamento(o, hoje);
      } catch (erro) {
        // Uma obrigação problemática não pode derrubar a varredura das outras.
        this.logger.error(`Falha ao avaliar a obrigação ${o.codigo}`, erro as Error);
      }
    }

    return { examinadas: obrigacoes.length, enviados, escalonamentos, marcadasVencidas };
  }

  /* ── Régua ─────────────────────────────────────────────────────────────── */

  private async avaliarObrigacao(o: any, hoje: Date): Promise<number> {
    // Prorrogada por protocolo tempestivo não é cobrada: a empresa fez a parte
    // dela e agora depende do órgão. Cobrar aqui seria treinar o destinatário
    // a ignorar o alerta.
    if (o.prorrogacaoVigente) return 0;

    const regra = await this.regraDe(o);
    if (!regra) return 0;

    const base = dataBaseDe(regra.baseData, o);
    if (!base) return 0;

    const dias = diasAte(base, hoje);
    const marco = marcoVigente(dias, regra.diasAntes ?? [], regra.diasDepois ?? []);
    if (!marco) return 0;

    const destinos = await this.resolverDestinos(o, regra);
    if (destinos.length === 0) {
      this.logger.warn(
        `Obrigação ${o.codigo} atingiu o marco ${marco.id} e não tem destinatário configurado.`,
      );
      return 0;
    }

    const contexto = this.montarContexto(o, dias, hoje);
    let enviados = 0;

    for (const destino of destinos) {
      const chave = chaveEnvio(o.id, marco.id, destino.canal, destino.endereco);

      // Reserva a chave ANTES de enviar. Se dois processos correrem juntos, só
      // um passa; o outro descobre aqui e não duplica a mensagem.
      const inedito = await this.envios.registrarSeInedito({
        organizationId: o.organizationId,
        obrigacaoId: o.id,
        regraId: regra.id ?? null,
        marco: marco.id,
        canal: destino.canal,
        destino: destino.endereco,
        chave,
      });
      if (!inedito) continue;

      const ok = await this.entregar(o, destino, regra, contexto, marco);
      if (ok) enviados++;
      else await this.envios.marcarFalha(chave, `Falha na entrega por ${destino.canal}`);
    }

    if (enviados > 0) {
      await this.registrarNoHistorico(o, marco, destinos.length, enviados);
    }
    return enviados;
  }

  /**
   * Régua aplicável, da mais específica para a mais genérica.
   *
   * Obrigação vence categoria, que vence organização. Sem essa precedência,
   * configurar uma exceção para uma licença exigiria desligar a régua de toda
   * a categoria.
   */
  private async regraDe(o: any): Promise<any | null> {
    const candidatas = await this.catalogo.regrasAplicaveis(
      o.organizationId, o.id, o.categoriaId,
    );
    if (candidatas.length === 0) return null;

    return candidatas.find((r: any) => r.obrigacaoId === o.id)
      ?? candidatas.find((r: any) => r.categoriaId === o.categoriaId && !r.obrigacaoId)
      ?? candidatas.find((r: any) => !r.categoriaId && !r.obrigacaoId)
      ?? null;
  }

  /**
   * Quem recebe, por canal.
   *
   * Destino sem endereço é descartado em silêncio (responsável sem e-mail
   * cadastrado, usuário sem WhatsApp no perfil) — não é erro, é dado
   * incompleto, e travar a varredura por isso deixaria os outros sem aviso.
   *
   * O opt-in de WhatsApp do usuário (`whatsappAlertas`) é respeitado: quem
   * desligou no perfil não recebe, mesmo estando na régua.
   */
  private async resolverDestinos(o: any, regra: any): Promise<Destino[]> {
    const papeis: string[] = regra.destinatarios ?? [];
    const canais: string[] = regra.canais ?? [];
    const destinos: Destino[] = [];
    const vistos = new Set<string>();

    const adicionar = (d: Destino) => {
      const chave = `${d.canal}|${d.endereco.toLowerCase()}`;
      if (!d.endereco || vistos.has(chave)) return;
      vistos.add(chave);
      destinos.push(d);
    };

    const responsaveis = (o.responsaveis ?? []).filter((r: any) => {
      if (!r.notificar) return false;
      if (papeis.includes("equipe")) return true;
      if (papeis.includes("responsavel") && r.papel === "principal") return true;
      if (papeis.includes("gestor") && r.papel === "gestor") return true;
      return false;
    });

    for (const r of responsaveis) {
      const nome = r.user?.nome ?? r.nome ?? r.email ?? "responsável";

      if (canais.includes("interno") && r.user?.id && r.user?.ativo !== false) {
        adicionar({ canal: "interno", endereco: r.user.id, userId: r.user.id, nome });
      }
      if (canais.includes("email")) {
        const email = r.email ?? r.user?.email;
        if (email) adicionar({ canal: "email", endereco: email, userId: r.user?.id ?? null, nome });
      }
      if (canais.includes("whatsapp")) {
        const doPerfil = r.user?.profile?.whatsappAlertas ? r.user?.profile?.whatsapp : null;
        const numero = r.telefone ?? doPerfil;
        if (numero) adicionar({ canal: "whatsapp", endereco: numero, userId: r.user?.id ?? null, nome });
      }
    }

    if (papeis.includes("administrador") && canais.includes("interno")) {
      for (const admin of await this.administradoresDa(o.organizationId)) {
        adicionar({ canal: "interno", endereco: admin.id, userId: admin.id, nome: admin.nome });
      }
    }

    if (canais.includes("email")) {
      for (const extra of regra.emailsExtras ?? []) {
        adicionar({ canal: "email", endereco: extra, nome: extra });
      }
    }
    if (canais.includes("whatsapp")) {
      for (const extra of regra.whatsappsExtras ?? []) {
        adicionar({ canal: "whatsapp", endereco: extra, nome: extra });
      }
    }

    return destinos;
  }

  /**
   * Administradores da organização.
   *
   * Resolvidos pelo papel, não por permissão: verificar `compliance.obrigacao:ver`
   * em tempo de execução para cada usuário custaria uma consulta por pessoa a
   * cada obrigação da varredura.
   */
  private async administradoresDa(organizationId: string) {
    return this.db.user.findMany({
      where: {
        organizationId, ativo: true,
        userRoles: { some: { role: { nome: "administrador" } } },
      },
      select: { id: true, nome: true, email: true },
      take: 20,
    });
  }

  private montarContexto(o: any, dias: number, hoje: Date): ContextoMensagem {
    const principal = (o.responsaveis ?? []).find((r: any) => r.papel === "principal");
    const situacao = situacaoPrazo(o, hoje);

    return {
      nomeObrigacao: o.nome,
      codigo: o.codigo,
      categoria: o.categoria?.nome ?? "",
      sigla: o.sigla,
      numeroDocumento: o.numeroDocumento,
      responsavel: principal?.user?.nome ?? principal?.nome ?? "responsável",
      orgao: o.orgao?.nome ?? null,
      unidade: o.unidade,
      dataValidade: o.dataValidade,
      prazoInterno: o.prazoInternoEm,
      prazoFatal: o.prazoFatalEm,
      dias,
      situacao: ROTULO_SITUACAO[situacao] ?? situacao,
      link: this.linkPara(o.id),
      campos: camposComoTexto(o),
    };
  }

  private linkPara(obrigacaoId: string): string {
    const base = (process.env.APP_URL || "").replace(/\/+$/, "");
    return `${base}/dashboard/compliance/obrigacoes/${obrigacaoId}`;
  }

  private async entregar(
    o: any, destino: Destino, regra: any, contexto: ContextoMensagem, marco: Marco,
  ): Promise<boolean> {
    const template = regra.template;
    const padrao = mensagemPadrao(contexto);

    const titulo = template?.assunto
      ? renderizarTemplate(template.assunto, contexto)
      : padrao.titulo;
    const corpo = template?.corpo
      ? renderizarTemplate(template.corpo, contexto)
      : padrao.corpo;

    try {
      switch (destino.canal) {
        case "interno":
          await this.db.notification.create({
            data: {
              id: randomUUID(),
              userId: destino.endereco,
              tipo: marco.tipo === "depois" ? "compliance_vencida" : "compliance_a_vencer",
              titulo,
              mensagem: corpo,
              referenciaTipo: "compliance",
              referenciaId: o.id,
            },
          });
          return true;

        case "email":
          return await this.email.sendGeneric(destino.endereco, destino.nome, titulo, corpo);

        case "whatsapp":
          return await this.whatsapp.sendMessageForOrg(
            o.organizationId, destino.endereco, `*${titulo}*\n\n${corpo}`,
          );

        default:
          // `webhook` está no vocabulário do schema mas ainda não tem entrega.
          // Registrar como ignorado é honesto; fingir que enviou não é.
          this.logger.warn(`Canal "${destino.canal}" ainda não implementado — envio ignorado.`);
          return false;
      }
    } catch (erro) {
      this.logger.error(
        `Falha ao entregar aviso de ${o.codigo} por ${destino.canal} para ${destino.endereco}`,
        erro as Error,
      );
      return false;
    }
  }

  private async registrarNoHistorico(o: any, marco: Marco, tentados: number, enviados: number) {
    try {
      await this.historico.registrar({
        organizationId: o.organizationId,
        obrigacaoId: o.id,
        userId: null,
        acao: "notificou",
        descricao:
          `Aviso do marco ${marco.tipo === "antes" ? `${marco.dias} dias antes` : `${marco.dias} dias após`} ` +
          `enviado para ${enviados} de ${tentados} destinatário(s).`,
        origem: "sistema",
      });
    } catch (erro) {
      this.logger.error(`Falha ao registrar notificação no histórico de ${o.codigo}`, erro as Error);
    }
  }

  /* ── Escalonamento ─────────────────────────────────────────────────────── */

  /**
   * Ninguém renovou — sobe um degrau.
   *
   * A referência é o prazo INTERNO, não a validade: quando a validade estoura,
   * escalar já não resolve. E o degrau é sempre o mais alto já cruzado, um só —
   * quem chegou ao diretor não precisa mais do aviso ao gestor.
   */
  private async avaliarEscalonamento(o: any, hoje: Date): Promise<number> {
    if (o.prorrogacaoVigente) return 0;
    if (["renovada", "cancelada", "arquivada"].includes(o.status)) return 0;
    if (!o.prazoInternoEm) return 0;

    const atraso = -diasEntreSeguro(hoje, o.prazoInternoEm);
    if (atraso <= 0) return 0;

    const degraus = await this.catalogo.listarEscalonamentos(o.organizationId, o.categoriaId);
    if (degraus.length === 0) return 0;

    const degrau = degrauEscalonamento(degraus as any[], atraso);
    if (!degrau) return 0;

    const alvos = await this.destinosDoDegrau(o, degrau as any);
    if (alvos.length === 0) return 0;

    const contexto = this.montarContexto(o, diasAte(o.prazoInternoEm, hoje), hoje);
    const marcoId = `escalonamento:${(degrau as any).aposDias}`;
    let enviados = 0;

    for (const alvo of alvos) {
      const chave = chaveEnvio(o.id, marcoId, alvo.canal, alvo.endereco);
      const inedito = await this.envios.registrarSeInedito({
        organizationId: o.organizationId,
        obrigacaoId: o.id,
        marco: marcoId,
        canal: alvo.canal,
        destino: alvo.endereco,
        chave,
      });
      if (!inedito) continue;

      const titulo = `Escalonamento: ${o.nome} sem renovação há ${atraso} dias`;
      const corpo =
        `A obrigação ${o.codigo} — ${o.nome} passou do prazo interno de renovação ` +
        `há ${atraso} dias e continua sem movimentação.\n\n${contexto.link ?? ""}`;

      const ok = alvo.canal === "interno"
        ? await this.entregarInterno(alvo.endereco, titulo, corpo, o.id)
        : await this.email.sendGeneric(alvo.endereco, alvo.nome, titulo, corpo);

      if (ok) enviados++;
      else await this.envios.marcarFalha(chave, "Falha na entrega do escalonamento");
    }

    if (enviados > 0) {
      await this.historico.registrar({
        organizationId: o.organizationId,
        obrigacaoId: o.id,
        userId: null,
        acao: "notificou",
        descricao: `Escalonado após ${atraso} dias de atraso para ${(degrau as any).alvo}.`,
        origem: "sistema",
      });
    }
    return enviados;
  }

  private async entregarInterno(userId: string, titulo: string, mensagem: string, refId: string) {
    try {
      await this.db.notification.create({
        data: {
          id: randomUUID(), userId, tipo: "compliance_escalonamento",
          titulo, mensagem, referenciaTipo: "compliance", referenciaId: refId,
        },
      });
      return true;
    } catch (erro) {
      this.logger.error(`Falha ao criar notificação interna para ${userId}`, erro as Error);
      return false;
    }
  }

  private async destinosDoDegrau(o: any, degrau: any): Promise<Destino[]> {
    const saida: Destino[] = [];

    if (degrau.alvo === "gestor") {
      for (const r of o.responsaveis ?? []) {
        if (r.papel !== "gestor") continue;
        if (r.user?.id) saida.push({ canal: "interno", endereco: r.user.id, nome: r.user.nome });
        else if (r.email) saida.push({ canal: "email", endereco: r.email, nome: r.nome ?? r.email });
      }
      return saida;
    }

    if (degrau.alvo === "administrador") {
      for (const a of await this.administradoresDa(o.organizationId)) {
        saida.push({ canal: "interno", endereco: a.id, nome: a.nome });
      }
      return saida;
    }

    if (degrau.alvo === "usuario" && degrau.userId) {
      saida.push({
        canal: "interno", endereco: degrau.userId,
        nome: degrau.user?.nome ?? "responsável",
      });
      return saida;
    }

    for (const email of degrau.emails ?? []) {
      saida.push({ canal: "email", endereco: email, nome: email });
    }
    return saida;
  }

  /* ── Consulta ──────────────────────────────────────────────────────────── */

  async historicoDeEnvios(organizationId: string, obrigacaoId?: string) {
    return this.envios.listar(organizationId, obrigacaoId);
  }

  /**
   * Prévia de uma régua: o que ela dispararia hoje, sem enviar nada.
   *
   * Existe porque configurar régua às cegas é como a planilha era — só se
   * descobre que está errada quando o aviso não chega.
   */
  async previa(organizationId: string, hoje: Date = new Date()) {
    const inferior = new Date(hoje.getTime()); inferior.setDate(inferior.getDate() - 365);
    const superior = new Date(hoje.getTime()); superior.setDate(superior.getDate() + 365);

    const obrigacoes = await this.obrigacoes.paraVarredura(inferior, superior);
    const previstos: any[] = [];

    for (const o of obrigacoes) {
      if (o.organizationId !== organizationId) continue;
      if (o.prorrogacaoVigente) continue;

      const regra = await this.regraDe(o);
      if (!regra) continue;

      const base = dataBaseDe(regra.baseData, o);
      if (!base) continue;

      const dias = diasAte(base, hoje);
      const marco = marcoVigente(dias, regra.diasAntes ?? [], regra.diasDepois ?? []);
      if (!marco) continue;

      const destinos = await this.resolverDestinos(o, regra);
      previstos.push({
        obrigacaoId: o.id,
        codigo: o.codigo,
        nome: o.nome,
        marco: marco.id,
        diasParaBase: dias,
        regra: regra.nome,
        destinatarios: destinos.map(d => ({ canal: d.canal, nome: d.nome })),
        semDestinatario: destinos.length === 0,
      });
    }

    return { hoje: hoje.toISOString(), previstos };
  }
}
