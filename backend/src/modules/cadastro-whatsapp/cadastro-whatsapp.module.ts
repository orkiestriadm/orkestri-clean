import { WhatsappInicioService } from "./whatsapp-inicio.service";
import { concluirCadastroAtomico } from "./cadastro-atomico";
import { comandoCadastroGeral, consultarNumeroCadastro, mensagemPrimeiroContato, numeroCadastro } from './whatsapp-entrada';
import { dadosTesteAgenda, interesseConviteAgenda, ORIGEM_CONVITE_AGENDA, ORIGEM_CONVITE_GRATUITO } from "../prospects/lead-onboarding";
import { identificarExecucao, execucaoWhats } from "../agenda/whatsapp-execucao";
import { MARCA } from "../../common/marca";
import { Module, Injectable, Logger } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { semearPermissoes, semearPapeisDaOrganizacao } from "../auth/auth.service";
import { fimDoTeste, PRODUTO_PADRAO } from "../auth/trial-renovacao";

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
  return numeroCadastro(v);
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
  async iniciarPeloChat(whatsapp: string, inst?: string, texto = "", conversa = ""): Promise<boolean> {
    return this.iniciarCadastro(whatsapp, inst, texto, conversa);
  }

  private async iniciarCadastro(whatsapp: string, inst?: string, texto = "", conversa = "", conviteGratuito = false, apresentar = false): Promise<boolean> {
    const num = normalizarWhatsapp(whatsapp);
    if (!num) return false;

    // Já existe conta com este número? Então não é cadastro, é alguém pedindo
    // ajuda — deixa seguir para os comandos.
    const situacao = await consultarNumeroCadastro(this.prisma, num, conversa);
    if (situacao.tipo !== 'novo') {
      await this.wa.sendMessage(num, mensagemPrimeiroContato(situacao.tipo), inst as any);
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
      await this.wa.sendMessage(num, 'Você já começou alguns cadastros hoje. Para continuar, tente novamente mais tarde ou fale com nossa equipe pelo site.', inst as any);
      return true;
    }

    const testeAgenda = !conviteGratuito && interesseConviteAgenda(texto);
    const aberta = await this.conversaAberta(num, conversa);
    if (aberta && aberta.etapa === 'INICIO' && new Date(aberta.expiraEm) > new Date() && !apresentar) {
      const respostas = this.lerRespostas(aberta);
      if (conviteGratuito) respostas.origem = ORIGEM_CONVITE_GRATUITO;
      await this.avancar(aberta.id,'NOME',respostas);
      await this.wa.sendMessage(num,this.msgAbertura(testeAgenda),inst as any);return true;
    }
    await (this.prisma as any).cadastroWhatsapp.create({
      data: {
        id: randomUUID(), whatsapp: num,
        status: "EM_CONVERSA", etapa: apresentar ? "INICIO" : "NOME",
        respostas: JSON.stringify({ ...(testeAgenda ? { origem: ORIGEM_CONVITE_AGENDA } : conviteGratuito ? { origem: ORIGEM_CONVITE_GRATUITO } : {}), ...(conversa.endsWith("@lid") ? { whatsappLid: conversa.split("@")[0] } : {}) }),
        expiraEm: new Date(Date.now() + VALIDADE_MIN * 60_000),
      },
    });

    await this.wa.sendMessage(num, apresentar ? mensagemPrimeiroContato('novo') : this.msgAbertura(testeAgenda), inst as any).catch(() => false);
    this.logger.log(`cadastro iniciado pelo chat (numero ...${num.slice(-4)})`);
    return true;
  }

  async orientarPrimeiroContato(whatsapp: string, conversa: string, inst: string, texto = ''): Promise<void> {
    const situacao = await consultarNumeroCadastro(this.prisma, whatsapp, conversa);
    const jaTemConta = /^j[aá] tenho (?:uma )?conta[.!?]*$/i.test(texto.trim());
    if (situacao.tipo === 'novo' && !jaTemConta && normalizarWhatsapp(whatsapp)) {
      const aberta = await this.conversaAberta(whatsapp,conversa);
      if (!aberta) {await this.iniciarCadastro(whatsapp,inst,'',conversa,false,true);return;}
    }
    await this.wa.sendToJid(conversa, mensagemPrimeiroContato(situacao.tipo, jaTemConta), inst);
  }

  // ── Conversa ────────────────────────────────────────────────────────────────

  /** Só interpreta 1/2 quando existe convite enviado e ainda sem resposta. */
  async tratarConvite(whatsapp: string, texto: string, inst: string, conversa = ''): Promise<boolean> {
    const opcao = texto.trim().match(/^([12])[.!]?$/)?.[1];
    const num = normalizarWhatsapp(whatsapp);
    if (!opcao || !num) return false;
    // Quem já tem conta continua nos menus normais da Aurélia.
    if ((await consultarNumeroCadastro(this.prisma, num, conversa)).tipo !== 'novo') return false;
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
      await this.wa.sendMessage(num, 'Tudo bem! Finalizei este convite. Nenhuma conta foi criada. Se quiser começar em outro momento, envie *CADASTRO* aqui nesta conversa.', inst);
      return true;
    }
    try {
      const iniciado = await this.iniciarCadastro(num, inst, 'CADASTRO', conversa, true);
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
  async conversaAberta(whatsapp: string, conversa = "") {
    const num = normalizarWhatsapp(whatsapp);
    const lid = conversa.endsWith("@lid") ? conversa.split("@")[0] : "";
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
    let resposta = (texto || "").trim();

    if (new Date(cadastro.expiraEm).getTime() < Date.now()) {
      await this.encerrar(cadastro.id, "EXPIRADO");
      if (comandoCadastroGeral(resposta) || interesseConviteAgenda(resposta)) {
        const anteriores = this.lerRespostas(cadastro);
        await this.iniciarPeloChat(cadastro.whatsapp, inst, resposta, anteriores.whatsappLid ? `${anteriores.whatsappLid}@lid` : '');
        return true;
      }
      await this.responder(cadastro, "⌛ Esse cadastro expirou. É só me mandar *cadastro* de novo quando quiser.", inst);
      return true;
    }

    if (/^(0|cancelar|sair|parar)$/i.test(resposta)) {
      await this.encerrar(cadastro.id, "CANCELADO");
      await this.responder(cadastro, "👋 Cadastro cancelado. Se mudar de ideia, me mande *cadastro*.", inst);
      return true;
    }

    const respostas = this.lerRespostas(cadastro);
    if(/^manter$/i.test(resposta)) {
      const atual=({NOME:cadastro.nome,CPF:cadastro.cpf,EMAIL:respostas.email,EMPRESA:respostas.empresa,EMPRESA_NOME:respostas.empresa} as any)[cadastro.etapa];
      if(atual)resposta=atual;
    }

    const perguntas:Record<string,string>={NOME:'Como é seu *nome completo*?',CPF:'Qual é seu *CPF*? Envie os 11 números. Uso esse dado para identificar sua conta.',EMAIL:'Qual é seu *e-mail*? Exemplo: *nome@gmail.com*. Ele será seu acesso ao site.',EMPRESA:'Você vai usar para você ou para uma empresa?\n*1* — Só para mim\n*2* — Para uma empresa',EMPRESA_NOME:'Qual é o nome da empresa?'};
    if (cadastro.etapa === 'INICIO' && !comandoCadastroGeral(resposta) && !interesseConviteAgenda(resposta)) {
      if(resposta==='1') {
        if(await this.tratarConvite(cadastro.whatsapp,'1',inst||process.env.EVOLUTION_INSTANCE||'orkestri-default',respostas.whatsappLid?`${respostas.whatsappLid}@lid`:''))return true;
        await this.avancar(cadastro.id,'NOME',respostas);await this.responder(cadastro,this.msgAbertura(false),inst);return true;
      }
      if(resposta==='2'||/^j[aá] tenho (?:uma )?conta$/i.test(resposta)){await this.encerrar(cadastro.id,'CANCELADO');await this.responder(cadastro,mensagemPrimeiroContato('vincular'),inst);return true;}
      if(resposta==='3'){await this.responder(cadastro,`Você conversa comigo para marcar compromissos, fazer anotações, anotar gastos e organizar projetos e tarefas.\n\nPara criar sua conta gratuita, responda *1*. Para conhecer o site: https://www.orkiestri.com\n*0* — Sair`,inst);return true;}
      await this.responder(cadastro,'Para criar sua conta, responda *1*. Se já tem uma conta, responda *2*. Para conhecer o sistema, responda *3*.\n*0* — Sair',inst);return true;
    }
    if (/^voltar$/i.test(resposta)) {
      const anterior:any={NOME:'INICIO',CPF:'NOME',EMAIL:'CPF',EMPRESA:'EMAIL',EMPRESA_NOME:'EMPRESA',CONFIRMACAO:'EMPRESA',CORRIGIR_DADO:'CONFIRMACAO'};
      const etapa=anterior[cadastro.etapa]||'NOME';delete respostas._revisando;
      await this.avancar(cadastro.id,etapa,respostas);
      await this.responder(cadastro,etapa==='INICIO'?mensagemPrimeiroContato('novo'):etapa==='CONFIRMACAO'?this.msgConfirmacao(cadastro.nome,cadastro.cpf,respostas):perguntas[etapa]+'\n\nO que você já informou foi preservado. Se estiver correto, envie *manter*.\n*Cancelar* — Parar o cadastro',inst);return true;
    }
    if(cadastro.etapa==='CORRIGIR_DADO') {
      const etapa=({'1':'NOME','2':'CPF','3':'EMAIL','4':'EMPRESA'} as any)[resposta];
      if(!etapa){await this.responder(cadastro,'Qual informação quer corrigir?\n*1* — Nome\n*2* — CPF\n*3* — E-mail\n*4* — Uso pessoal ou empresa\n*Voltar* — Conferir os dados',inst);return true;}
      respostas._revisando=true;await this.avancar(cadastro.id,etapa,respostas);await this.responder(cadastro,perguntas[etapa]+'\n\n*Voltar* — Pergunta anterior · *Cancelar* — Sair',inst);return true;
    }

    // Reabrir o link não transforma CADASTRO em nome/CPF nem perde respostas.
    // A escolha explícita pelo cadastro geral substitui a origem de teste de
    // uma conversa ainda não concluída; contas existentes nunca são alteradas.
    if (comandoCadastroGeral(resposta) || interesseConviteAgenda(resposta)) {
      const testeSolicitado = interesseConviteAgenda(resposta);
      if (testeSolicitado) respostas.origem = ORIGEM_CONVITE_AGENDA;
      else if(respostas.origem!==ORIGEM_CONVITE_GRATUITO) delete respostas.origem;
      if(cadastro.etapa==='INICIO') await this.avancar(cadastro.id,'NOME',respostas);
      await (this.prisma as any).cadastroWhatsapp.update({ where: { id: cadastro.id }, data: { respostas: JSON.stringify(respostas) } });
      const pergunta: Record<string, string> = {
        INICIO: this.msgAbertura(testeSolicitado),
        NOME: this.msgAbertura(testeSolicitado),
        CPF: `Vamos continuar seu cadastro no ${MARCA}. Qual é o seu *CPF*?`,
        EMAIL: `Vamos continuar seu cadastro no ${MARCA}. Qual é o seu *e-mail*?`,
        EMPRESA: `Vamos continuar seu cadastro no ${MARCA}. Qual é o nome da sua *empresa*? Para uso pessoal, responda *Pessoal*.`,
        CONFIRMACAO: this.msgConfirmacao(cadastro.nome || '', cadastro.cpf || '', respostas),
      };
      await this.responder(cadastro, pergunta[cadastro.etapa] || this.msgAbertura(testeSolicitado), inst);
      return true;
    }

    if (cadastro.etapa === "NOME") {
      if (resposta.length < 3 || !resposta.includes(" ")) {
        return this.invalida(cadastro, "👤 Me manda seu *nome completo*, com sobrenome.", inst);
      }
      await this.avancar(cadastro.id, "CPF", respostas, { nome: resposta });
      if(await this.corrigido(cadastro,respostas,inst))return true;
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
      if(await this.corrigido(cadastro,respostas,inst))return true;
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
      if(await this.corrigido(cadastro,respostas,inst))return true;
      await this.responder(cadastro, perguntas.EMPRESA, inst);
      return true;
    }

    if (cadastro.etapa === "EMPRESA" || cadastro.etapa === 'EMPRESA_NOME') {
      if(cadastro.etapa==='EMPRESA'&&resposta==='2'){await this.avancar(cadastro.id,'EMPRESA_NOME',respostas);await this.responder(cadastro,perguntas.EMPRESA_NOME+'\n\n*Voltar* — Escolher uso pessoal',inst);return true;}
      const empresa=cadastro.etapa==='EMPRESA'&&resposta==='1'?'Pessoal':resposta;
      if (empresa.length < 2) return this.invalida(cadastro, perguntas.EMPRESA, inst);
      respostas.empresa = empresa;
      delete respostas._revisando;
      await this.avancar(cadastro.id, "CONFIRMACAO", respostas);
      const atual = await (this.prisma as any).cadastroWhatsapp.findUnique({ where: { id: cadastro.id } });
      await this.responder(cadastro, this.msgConfirmacao(atual.nome, atual.cpf, respostas), inst);
      return true;
    }

    if (cadastro.etapa === "CONFIRMACAO") {
      if (/^(1|sim|s|confirmar|confirmo(?: meus dados)?|ok)[.!]?$/i.test(resposta)) {
        const atual = await (this.prisma as any).cadastroWhatsapp.findUnique({ where: { id: cadastro.id } });
        await this.concluir(atual, respostas, inst);
        return true;
      }
      if (/^(2|nao|não|n|corrigir)$/i.test(resposta)) {
        await this.avancar(cadastro.id,'CORRIGIR_DADO',respostas);
        await this.responder(cadastro,'Qual informação quer corrigir?\n*1* — Nome\n*2* — CPF\n*3* — E-mail\n*4* — Uso pessoal ou empresa\n*Voltar* — Conferir os dados',inst);
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
        const conviteGratuito = (respostas as any).origem === ORIGEM_CONVITE_GRATUITO;
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
            statusOperacional: "ativo", statusComercial: testeAgenda || conviteGratuito ? "teste" : "ativo",
            modulosAtivos: [],
          },
        });

        // A conta nasce com a gratuidade CORRENDO, com data de fim.
        //
        // Sem `trialExpiraEm`, `faseDaConta` devolve null e a conta fica fora
        // do ciclo: não recebe aviso de vencimento, não recebe cobrança e o
        // acesso nunca termina. Era o que acontecia com todo mundo que entrava
        // por aqui — a cobrança só alcançava quem vinha pelo site.
        //
        // Marcar `isTrial` não reduz o que a pessoa enxerga: ela recebe o papel
        // master da organização nova, e `resolvePermissions` devolve "*" para
        // quem é master ANTES de olhar o ramo de teste. O convite de agenda é
        // que entra com papel restrito, e por isso mantém as regras próprias.
        const user = await tx.user.create({
          data: {
            id: randomUUID(), organizationId: org.id,
            nome: cadastro.nome, email: respostas.email, cpf: cadastro.cpf,
            senhaHash: hash, ativo: true, primeiroAcesso: false,
            // O convite gratuito fica de fora: é cortesia declarada, e a
            // própria mensagem de boas-vindas diz que "o acesso nesta fase é
            // gratuito". Dar prazo a ele seria desdizer o que foi prometido a
            // quem foi convidado.
            ...(testeAgenda
              ? dadosTesteAgenda()
              : conviteGratuito
                ? {}
                : {
                    isTrial: true,
                    trialModulo: PRODUTO_PADRAO,
                    trialExpiraEm: fimDoTeste(),
                    trialAvisadoSuporte: false,
                  }),
          },
        });

        // Papéis DA organização nova. Sem semear, o tenant nasce sem papel nenhum e
        // a pessoa entra sem ver nada.
        const permMap = await semearPermissoes(tx);
        const masterRole = await semearPapeisDaOrganizacao(tx, org.id, permMap);
        if (!masterRole) throw new Error("Não foi possível criar o papel administrador.");
        const papel = testeAgenda ? await tx.role.findFirst({ where: { organizationId: org.id, nome: "visualizador", isMaster: false } }) : masterRole;
        if (!papel) throw new Error("Nao foi possivel liberar a agenda");
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
            modulos: JSON.stringify(testeAgenda ? ["agenda"] : [
              "agenda", "keep", "projetos", "gantt",
              "financeiro", "gastos", "orcamento",
              "chamados", "conhecimento", "whatsapp",
            ]),
          },
        });

        if (testeAgenda || conviteGratuito) await tx.prospectLead.updateMany({ where: { telefone: cadastro.whatsapp, etapa: { not: "PAGANTE" } }, data: { etapa: "EM_TESTE" } });
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
    await identificarExecucao({ id: resultado.conta.userId, organizationId: resultado.conta.organizationId }, "PESSOAL");
    const execucao = execucaoWhats.getStore();
    if (execucao) execucao.tipo = "CADASTRO";
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

  private async corrigido(cadastro:any,respostas:any,inst?:string):Promise<boolean> {
    if(!respostas._revisando)return false;
    delete respostas._revisando;
    await this.avancar(cadastro.id,'CONFIRMACAO',respostas);
    const atual=await (this.prisma as any).cadastroWhatsapp.findUnique({where:{id:cadastro.id}});
    await this.responder(cadastro,this.msgConfirmacao(atual.nome,atual.cpf,respostas),inst);return true;
  }

  /** Resposta inválida: conta a tentativa e encerra no teto. */
  private async invalida(cadastro: any, msg: string, inst?: string): Promise<boolean> {
    const tentativas = (cadastro.tentativas || 0) + 1;
    if (tentativas >= MAX_TENTATIVAS) {
      await (this.prisma as any).cadastroWhatsapp.update({where:{id:cadastro.id},data:{tentativas:0}});
      await this.responder(cadastro,msg+'\n\nSuas respostas foram preservadas. Para rever a pergunta anterior, envie *voltar*. Para parar, envie *cancelar*.',inst);
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
      `Oi! Eu sou a *Aurélia*. Vamos fazer seu cadastro no *${MARCA}*, uma pergunta por vez. 😊\n\n` +
      "O cadastro e o acesso nesta fase são gratuitos, sem cartão. Avisaremos antes de qualquer mudança nas condições.\n\n" +
      "Como é o seu *nome completo*?\n\n" +
      "*Voltar* — Pergunta anterior\n*Cancelar* — Parar o cadastro"
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
