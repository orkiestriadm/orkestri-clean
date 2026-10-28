import { WhatsappInicioService } from "./whatsapp-inicio.service";
import { concluirCadastroAtomico } from "./cadastro-atomico";
import { dadosTesteAgenda, interesseConviteAgenda, ORIGEM_CONVITE_AGENDA } from '../prospects/lead-onboarding';
import { MARCA } from "../../common/marca";
import { Module, Injectable, Logger } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { semearPermissoes, semearPapeisDaOrganizacao } from "../auth/auth.service";

/**
 * Cadastro feito INTEIRO pelo WhatsApp.
 *
 * A pessoa clica no site, o WhatsApp abre já na conversa com a Aurélia, e ela
 * pergunta nome, CPF, e-mail e empresa — uma coisa por vez. O número de
 * WhatsApp não é perguntado: é aquele de onde a mensagem veio.
 *
 * QUEM INICIA É A PESSOA
 *
 * Nunca sai mensagem para quem não escreveu primeiro. Isso não é só educação:
 * disparo não solicitado em massa é o que faz o WhatsApp banir um número, e o
 * número aqui é o da empresa. A versão anterior deste fluxo começava num
 * formulário do site e o sistema escrevia para a pessoa — mais barreiras antes
 * (CPF validado antes de gastar mensagem, limite por IP), mas o risco de
 * banimento era real. Aqui a troca é consciente: perdemos a barreira prévia e
 * ganhamos a garantia de só responder.
 *
 * ONDE A CONTA NASCE, E POR QUÊ
 *
 * Cada cadastro cria uma ORGANIZAÇÃO PRÓPRIA, e a pessoa vira master dela.
 * Decisão do usuário em 20/10/2026, e é o que separa este fluxo de um
 * vazamento: os caminhos públicos que já existiam (teste pela landing, demo)
 * jogam todo mundo na organização principal, e só não expõem a empresa porque
 * `resolvePermissions` tem um ramo dedicado ao `isTrial` que ignora papel e
 * libera um módulo só. Aqui a pessoa recebe acesso de verdade aos cinco
 * produtos; se isso acontecesse dentro do tenant da empresa, qualquer um com
 * um número de WhatsApp leria os projetos, chamados e o financeiro reais.
 */

// ── Limites, agora POR NÚMERO ────────────────────────────────────────────────
//
// O limite por IP morreu com o formulário: não há mais requisição HTTP de onde
// tirar origem. O que resta, e é o que de fato identifica quem insiste, é o
// número de WhatsApp — que o remetente não escolhe à toa, porque precisa de um
// chip para cada um.
const VALIDADE_MIN        = 30; // a conversa expira em 30 min
const MAX_TENTATIVAS      = 5;  // respostas inválidas seguidas antes de encerrar
const MAX_ABANDONOS_DIA   = 3;  // conversas canceladas/expiradas por número por dia

const STATUS_ABERTO = ["AGUARDANDO", "EM_CONVERSA"];

/** A pessoa quer se cadastrar? Aceita o texto do link e variações digitadas. */
export function pareceInteresseEmCadastro(texto: string): boolean {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return interesseConviteAgenda(texto) || /\b(cadastr|criar (minha )?conta|quero (uma )?conta|abrir conta|me inscrever)/.test(t);
}

function soDigitos(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

/**
 * Valida CPF pelos dois dígitos verificadores.
 *
 * Checar só o formato não serve: "111.111.111-11" tem 11 dígitos e é inválido.
 * Aqui o CPF é o que distingue uma pessoa de um cadastro de brincadeira.
 */
function cpfValido(bruto?: string | null): boolean {
  const cpf = soDigitos(bruto);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (const corte of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < corte; i++) soma += Number(cpf[i]) * (corte + 1 - i);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(cpf[corte])) return false;
  }
  return true;
}

/** E-mail: checagem deliberadamente frouxa — quem erra, erra no próprio acesso. */
function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());
}

/** Normaliza para o formato que o Evolution usa: dígitos com DDI 55. */
function normalizarWhatsapp(v: string): string {
  const d = soDigitos(v);
  if (!d) return "";
  return d.startsWith("55") ? d : "55" + d;
}

/** Senha provisória sem caractere ambíguo — ela é LIDA num WhatsApp. */
function senhaProvisoria(): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alfabeto[randomInt(alfabeto.length)]).join("") + "A9!";
}

function primeiroNome(nome: string): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

function formatarCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

@Injectable()
export class CadastroWhatsappService {
  private readonly logger = new Logger("CadastroWhatsapp");

  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private inicio: WhatsappInicioService,
  ) {}

  // ── Início, a partir da própria conversa ────────────────────────────────────

  /**
   * Abre o formulário para um número que escreveu querendo se cadastrar.
   *
   * Devolve `true` quando assumiu a conversa. Só é chamado para número que
   * NÃO tem conta — quem já é usuário cai nos comandos normais.
   */
  async iniciarPeloChat(whatsapp: string, inst?: string, texto = '', conversa = ''): Promise<boolean> {
    const num = normalizarWhatsapp(whatsapp);
    if (!num) return false;

    // Já existe conta com este número? Então não é cadastro, é alguém pedindo
    // ajuda — deixa seguir para os comandos.
    const perfil = await (this.prisma as any).userProfile.findFirst({ where: { whatsapp: num } });
    if (perfil) {
      await this.inicio.enviarAcesso(perfil.userId, inst || process.env.EVOLUTION_INSTANCE || "orkestri-default");
      return true;
    }

    // Muitas conversas abandonadas no mesmo dia: a pessoa (ou o robô) fica sem
    // resposta em vez de reabrir o formulário indefinidamente.
    const umDiaAtras = new Date(Date.now() - 24 * 3600_000);
    const abandonos = await (this.prisma as any).cadastroWhatsapp.count({
      where: { whatsapp: num, status: { in: ["CANCELADO", "EXPIRADO"] }, criadoEm: { gt: umDiaAtras } },
    });
    if (abandonos >= MAX_ABANDONOS_DIA) {
      this.logger.warn(`cadastro ignorado — ${abandonos} abandonos em 24h (numero ...${num.slice(-4)})`);
      return true; // consome a mensagem, sem responder: não alimenta quem insiste
    }

    const lead = await (this.prisma as any).prospectLead?.findUnique({ where: { telefone: num } }).catch(() => null);
    const testeAgenda = interesseConviteAgenda(texto) || !!lead;
    await (this.prisma as any).cadastroWhatsapp.create({
      data: {
        id: randomUUID(), whatsapp: num,
        status: "EM_CONVERSA", etapa: "NOME",
        respostas: JSON.stringify({ ...(testeAgenda ? { origem: ORIGEM_CONVITE_AGENDA } : {}), ...(conversa.endsWith('@lid') ? { whatsappLid: conversa.split('@')[0] } : {}) }),
        expiraEm: new Date(Date.now() + VALIDADE_MIN * 60_000),
      },
    });

    await this.wa.sendMessage(num, this.msgAbertura(testeAgenda), inst as any).catch(() => false);
    this.logger.log(`cadastro iniciado pelo chat (numero ...${num.slice(-4)})`);
    return true;
  }

  // ── Conversa ────────────────────────────────────────────────────────────────

  /** Só interpreta 1/2 quando existe convite enviado e ainda sem resposta. */
  async tratarConvite(whatsapp: string, texto: string, inst: string, conversa = ''): Promise<boolean> {
    const opcao = texto.trim().match(/^([12])[.!]?$/)?.[1];
    const num = normalizarWhatsapp(whatsapp);
    if (!opcao || !num) return false;
    // Quem já tem conta continua nos menus normais da Aurélia.
    if (await (this.prisma as any).userProfile.findFirst({ where: { whatsapp: num } })) return false;
    const db = this.prisma as any;
    const convite = await db.prospectMessage.findFirst({
      where: { status: 'ENVIADO', conviteTelefone: num, instancia: inst, conviteEstado: 'PENDENTE' },
      orderBy: { criadoEm: 'desc' }, include: { lead: true },
    });
    if (!convite) return false;
    const estado = opcao === '1' ? 'INICIANDO' : 'FINALIZADO';
    const claim = await db.prospectMessage.updateMany({ where: { id: convite.id, conviteEstado: 'PENDENTE' }, data: { conviteEstado: estado, conviteRespondidoEm: new Date() } });
    if (!claim.count) return true;
    if (opcao === '2' || convite.lead?.bloqueado || convite.lead?.arquivado) {
      await db.prospectMessage.updateMany({ where: { leadId: convite.leadId, instancia: inst, conviteEstado: { in: ['PENDENTE', 'INICIANDO'] } }, data: { conviteEstado: 'FINALIZADO', conviteRespondidoEm: new Date() } });
      await this.wa.sendMessage(num, 'Tudo bem! Finalizei este convite. Nenhuma conta foi criada. Se quiser começar em outro momento, envie *CADASTRO AGENDA* aqui nesta conversa.', inst);
      return true;
    }
    try {
      const iniciado = await this.iniciarPeloChat(num, inst, 'CADASTRO AGENDA', conversa);
      if (!iniciado) throw new Error('Não foi possível iniciar o cadastro.');
      await db.prospectMessage.updateMany({ where: { id: convite.id, conviteEstado: 'INICIANDO' }, data: { conviteEstado: 'INICIADO' } });
      await db.prospectMessage.updateMany({ where: { leadId: convite.leadId, instancia: inst, conviteEstado: 'PENDENTE' }, data: { conviteEstado: 'SUPERADO', conviteRespondidoEm: new Date() } });
      return true;
    } catch (e) {
      await db.prospectMessage.updateMany({ where: { id: convite.id, conviteEstado: 'INICIANDO' }, data: { conviteEstado: 'PENDENTE', conviteRespondidoEm: null } });
      throw e;
    }
  }

  /** A conversa aberta deste número, ou null. Consultado a cada mensagem. */
  async conversaAberta(whatsapp: string, conversa = '') {
    const num = normalizarWhatsapp(whatsapp);
    const lid = conversa.endsWith('@lid') ? conversa.split('@')[0] : '';
    if (!num && !lid) return null;
    return (this.prisma as any).cadastroWhatsapp.findFirst({
      where: { ...(num ? { whatsapp: num } : { respostas: { contains: JSON.stringify({ whatsappLid: lid }).slice(1, -1) } }), status: { in: STATUS_ABERTO } },
      orderBy: { criadoEm: "desc" },
    });
  }

  /**
   * Trata a mensagem como resposta do formulário.
   *
   * Devolve `true` quando consumiu a mensagem — o inbound não deve seguir para
   * os comandos normais, senão "meu@email.com" viraria tentativa de criar
   * evento e a pessoa receberia "não entendi" no meio do cadastro.
   */
  async tratarResposta(cadastro: any, texto: string, inst?: string): Promise<boolean> {
    const resposta = (texto || "").trim();

    if (new Date(cadastro.expiraEm).getTime() < Date.now()) {
      await this.encerrar(cadastro.id, "EXPIRADO");
      await this.responder(cadastro, "⌛ Esse cadastro expirou. É só me mandar *cadastro* de novo quando quiser.", inst);
      return true;
    }

    if (/^(cancelar|sair|parar)$/i.test(resposta)) {
      await this.encerrar(cadastro.id, "CANCELADO");
      await this.responder(cadastro, "👋 Cadastro cancelado. Se mudar de ideia, me mande *cadastro*.", inst);
      return true;
    }

    const respostas = this.lerRespostas(cadastro);

    if (cadastro.etapa === "NOME") {
      if (resposta.length < 3 || !resposta.includes(" ")) {
        return this.invalida(cadastro, "👤 Me manda seu *nome completo*, com sobrenome.", inst);
      }
      await this.avancar(cadastro.id, "CPF", respostas, { nome: resposta });
      await this.responder(cadastro, "🪪 Agora o seu *CPF* (só os números).", inst);
      return true;
    }

    if (cadastro.etapa === "CPF") {
      if (!cpfValido(resposta)) {
        return this.invalida(cadastro, "🪪 Esse CPF não confere. Confira os números e me manda de novo.", inst);
      }
      const cpf = soDigitos(resposta);
      const existe = await (this.prisma as any).user.findFirst({ where: { cpf } });
      if (existe) {
        // Aqui dizer "já existe" é seguro, ao contrário do endpoint público que
        // existia antes: quem está falando É o dono do número, não um
        // desconhecido sondando a base.
        await this.encerrar(cadastro.id, "CANCELADO");
        await this.responder(cadastro, `✅ Esse CPF já tem conta no ${MARCA}. Entre no site — se esqueceu a senha, use *Esqueci a senha*.`, inst);
        return true;
      }
      await this.avancar(cadastro.id, "EMAIL", respostas, { cpf });
      await this.responder(cadastro, "📧 Qual o seu *e-mail*? É com ele que você vai entrar no sistema.", inst);
      return true;
    }

    if (cadastro.etapa === "EMAIL") {
      if (!emailValido(resposta)) {
        return this.invalida(cadastro, "📧 Preciso de um e-mail válido, assim: *nome@empresa.com*", inst);
      }
      const email = resposta.toLowerCase();
      // Um e-mail = uma conta. Como cada cadastro cria uma organização nova, o
      // e-mail repetido deixaria a pessoa com duas contas e nenhuma pista de
      // qual usar para entrar.
      const existe = await (this.prisma as any).user.findFirst({ where: { email } });
      if (existe) {
        return this.invalida(cadastro, "📧 Esse e-mail já tem conta. Me manda outro, ou entre em *orkiestri.com* com ele.", inst);
      }
      respostas.email = email;
      await this.avancar(cadastro.id, "EMPRESA", respostas);
      await this.responder(cadastro, "🏢 E o *nome da sua empresa*?", inst);
      return true;
    }

    if (cadastro.etapa === "EMPRESA") {
      if (resposta.length < 2) return this.invalida(cadastro, "🏢 Me diga o nome da sua empresa.", inst);
      respostas.empresa = resposta;
      await this.avancar(cadastro.id, "CONFIRMACAO", respostas);
      const atual = await (this.prisma as any).cadastroWhatsapp.findUnique({ where: { id: cadastro.id } });
      await this.responder(cadastro, this.msgConfirmacao(atual.nome, atual.cpf, respostas), inst);
      return true;
    }

    if (cadastro.etapa === "CONFIRMACAO") {
      if (/^(1|sim|s|confirmar|ok)$/i.test(resposta)) {
        const atual = await (this.prisma as any).cadastroWhatsapp.findUnique({ where: { id: cadastro.id } });
        await this.concluir(atual, respostas, inst);
        return true;
      }
      if (/^(2|nao|não|n|corrigir)$/i.test(resposta)) {
        await this.avancar(cadastro.id, "NOME", { ...(respostas.origem ? { origem: respostas.origem } : {}), ...(respostas.whatsappLid ? { whatsappLid: respostas.whatsappLid } : {}) }, { nome: null, cpf: null });
        await this.responder(cadastro, "🔁 Sem problema, vamos de novo.\n\n👤 Qual o seu *nome completo*?", inst);
        return true;
      }
      return this.invalida(cadastro, "Responda *1* para confirmar ou *2* para corrigir.", inst);
    }

    return false;
  }

  // ── Conclusão: é aqui que a conta passa a existir ───────────────────────────

  private async concluir(cadastro: any, _respostas: any, inst?: string) {
    const senha = senhaProvisoria();
    const hash = await bcrypt.hash(senha, 12);
    let resultado;
    try {
      resultado = await concluirCadastroAtomico(this.prisma, cadastro.id, async (tx, cadastro, respostas) => {
        const testeAgenda = (respostas as any).origem === ORIGEM_CONVITE_AGENDA;
        // Slug da organização nova, único. O sufixo temporal evita colisão entre
        // duas empresas de mesmo nome sem obrigar ninguém a escolher outro.
        const base = String(respostas.empresa || cadastro.nome)
          .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "empresa";
        let slug = base;
        if (await tx.organization.findUnique({ where: { slug } })) {
          slug = `${base}-${Date.now().toString(36)}`;
        }

        const org = await tx.organization.create({
          data: {
            nome: respostas.empresa || cadastro.nome,
            slug, ativo: true,
            statusOperacional: "ativo", statusComercial: testeAgenda ? "teste" : "ativo",
            modulosAtivos: [],
          },
        });

        const user = await tx.user.create({
          data: {
            id: randomUUID(), organizationId: org.id,
            nome: cadastro.nome, email: respostas.email, cpf: cadastro.cpf,
            senhaHash: hash, ativo: true, primeiroAcesso: false,
            ...(testeAgenda ? dadosTesteAgenda() : {}),
          },
        });

        // Papéis DA organização nova. Sem semear, o tenant nasce sem papel nenhum e
        // a pessoa entra sem ver nada.
        const permMap = await semearPermissoes(tx);
        const masterRole = await semearPapeisDaOrganizacao(tx, org.id, permMap);
        if (!masterRole) throw new Error("Não foi possível criar o papel administrador.");
        const papel = testeAgenda ? await tx.role.findFirst({ where: { organizationId: org.id, nome: 'visualizador', isMaster: false } }) : masterRole;
        if (!papel) throw new Error('Não foi possível liberar a agenda.');
        if (papel) {
          await tx.userRole.create({
            data: { userId: user.id, roleId: papel.id },
          });
        }

        await tx.userProfile.create({
          data: {
            id: randomUUID(), userId: user.id,
            whatsapp: cadastro.whatsapp,
            ...((respostas as any).whatsappLid ? { whatsappLid: (respostas as any).whatsappLid } : {}),
            modulos: JSON.stringify(testeAgenda ? ['agenda'] : [
              "agenda", "keep", "projetos", "gantt",
              "financeiro", "gastos", "orcamento",
              "chamados", "conhecimento", "whatsapp",
            ]),
          },
        });

        if (testeAgenda) await tx.prospectLead.updateMany({ where: { telefone: cadastro.whatsapp, etapa: { not: 'PAGANTE' } }, data: { etapa: 'EM_TESTE' } });
        await tx.cadastroWhatsapp.update({
          where: { id: cadastro.id },
          data: {
            status: "CONCLUIDO", etapa: "CONCLUIDO",
            respostas: JSON.stringify(respostas),
            organizationId: org.id, userId: user.id,
            concluidoEm: new Date(),
          },
        });
        await this.inicio.enfileirar(tx, user.id, cadastro.id, cadastro.whatsapp, inst || process.env.EVOLUTION_INSTANCE || "orkestri-default");
        return { organizationId: org.id, userId: user.id, email: respostas.email };
      });
    } catch (e: any) {
      this.logger.error("Falha ao concluir cadastro: " + cadastro.id);
      await this.responder(cadastro, "Não consegui concluir seu cadastro agora. Seus dados foram preservados. Responda *1* para tentar novamente, *2* para revisar os dados ou *cancelar* para sair.", inst);
      return;
    }
    if (resultado.status === "ja_concluido") {
      if (cadastro.userId) await this.inicio.enviarAcesso(cadastro.userId, inst || process.env.EVOLUTION_INSTANCE || "orkestri-default");
      else await this.responder(cadastro, "✅ Sua conta já foi criada. Envie *acesso* para receber as orientações.", inst);
      return;
    }
    if (resultado.status !== "criado") {
      await this.responder(cadastro, "Este cadastro não está aguardando confirmação ou expirou. Envie *cadastro* para continuar.", inst);
      return;
    }
    this.logger.log("Cadastro concluido: org=" + resultado.conta.organizationId + " user=" + resultado.conta.userId);
    // A fila foi gravada junto com a conta. Uma falha de entrega não desfaz o cadastro.
    await this.inicio.entregar(resultado.conta.userId).catch(() => this.logger.warn("Boas-vindas permanecem na fila."));
  }

  // ── Expiração ───────────────────────────────────────────────────────────────

  /** Fecha o que passou da validade. Chamado pelo agendador. */
  async expirarVencidos(): Promise<number> {
    const r = await (this.prisma as any).cadastroWhatsapp.updateMany({
      where: { status: { in: STATUS_ABERTO }, expiraEm: { lt: new Date() } },
      data: { status: "EXPIRADO" },
    });
    if (r.count) this.logger.log(`Cadastros expirados: ${r.count}`);
    return r.count;
  }

  // ── Apoio ───────────────────────────────────────────────────────────────────

  private lerRespostas(cadastro: any): any {
    try { return JSON.parse(cadastro.respostas || "{}"); } catch { return {}; }
  }

  /** Avança a etapa. `colunas` grava nome/cpf, que têm coluna própria. */
  private async avancar(id: string, etapa: string, respostas: any, colunas: any = {}) {
    await (this.prisma as any).cadastroWhatsapp.update({
      where: { id },
      data: { etapa, respostas: JSON.stringify(respostas), tentativas: 0, ...colunas },
    });
  }

  private async encerrar(id: string, status: string) {
    await (this.prisma as any).cadastroWhatsapp.update({ where: { id }, data: { status } });
  }

  /** Resposta inválida: conta a tentativa e encerra no teto. */
  private async invalida(cadastro: any, msg: string, inst?: string): Promise<boolean> {
    const tentativas = (cadastro.tentativas || 0) + 1;
    if (tentativas >= MAX_TENTATIVAS) {
      await this.encerrar(cadastro.id, "CANCELADO");
      await this.responder(cadastro, "😕 Não consegui entender. Encerrei por aqui — me mande *cadastro* quando quiser tentar de novo.", inst);
      return true;
    }
    await (this.prisma as any).cadastroWhatsapp.update({
      where: { id: cadastro.id }, data: { tentativas },
    });
    await this.responder(cadastro, msg, inst);
    return true;
  }

  private async responder(cadastro: any, msg: string, inst?: string) {
    await this.wa.sendMessage(cadastro.whatsapp, msg, inst as any).catch(() => false);
  }

  // ── Textos ──────────────────────────────────────────────────────────────────

  private msgAbertura(testeAgenda = false): string {
    return (
      `😊 *Oi! Eu sou a Aurélia*, do ${MARCA}.\n` +
      (testeAgenda ? "Vou criar seu teste da *agenda por 7 dias grátis*, aqui mesmo e sem aprovação manual. Depois te ajudo com o primeiro compromisso. São quatro perguntas rápidas; se for uso pessoal, informe *Pessoal* quando eu perguntar a empresa.\n\n" : "Vou criar sua conta aqui mesmo, por mensagem — são quatro perguntinhas rápidas.\n\n") +
      "👤 Para começar: qual o seu *nome completo*?\n\n" +
      "_(Se quiser parar a qualquer momento, responda *cancelar*.)_"
    );
  }

  private msgConfirmacao(nome: string, cpf: string, r: any): string {
    return (
      "✅ *Confere pra mim se está tudo certo:*\n\n" +
      `👤 Nome: *${nome}*\n` +
      `🪪 CPF: *${formatarCpf(cpf)}*\n` +
      `📧 E-mail: *${r.email}*\n` +
      `🏢 Empresa: *${r.empresa}*\n\n` +
      "Responda *1* para confirmar ou *2* para corrigir."
    );
  }


}

@Module({
  imports: [NotificationsModule],
  providers: [CadastroWhatsappService, WhatsappInicioService],
  exports: [CadastroWhatsappService, WhatsappInicioService],
})
export class CadastroWhatsappModule {}
