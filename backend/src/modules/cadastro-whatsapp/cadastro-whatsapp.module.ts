import {
  Module, Controller, Post, Body, Req, Injectable, Logger,
  BadRequestException, ConflictException, HttpCode, HttpStatus,
} from "@nestjs/common";
import { IsString } from "class-validator";
import * as bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { semearPermissoes, semearPapeisDaOrganizacao } from "../auth/auth.service";

/**
 * Cadastro que começa no site e termina no WhatsApp.
 *
 * O site pede o mínimo para abrir a conversa — nome, CPF e WhatsApp — e a
 * Aurélia pergunta o resto, uma coisa por vez. Só no fim a conta existe.
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

// ── Limites ───────────────────────────────────────────────────────────────────
//
// Não são "boas práticas" genéricas: este é um endpoint PÚBLICO que dispara
// mensagem de WhatsApp a partir do número da empresa. Sem teto, ele é um canhão
// de spam apontado para o nosso próprio número — e quem apanha é a conta do
// WhatsApp, que é banida por envio em massa, não o servidor.
const VALIDADE_MIN       = 30;  // a conversa expira em 30 min
const MAX_POR_IP_HORA    = 3;   // cadastros que um mesmo IP abre por hora
const MAX_TENTATIVAS     = 5;   // respostas inválidas seguidas antes de encerrar

const STATUS_ABERTO = ["AGUARDANDO", "EM_CONVERSA"];

/** Deixa só os dígitos. */
function soDigitos(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

/**
 * Valida CPF pelos dois dígitos verificadores.
 *
 * Mesma regra do cadastro do Core. Checar só o formato não serve:
 * "111.111.111-11" tem 11 dígitos e é inválido, e aqui o CPF é o que distingue
 * uma pessoa de um cadastro de brincadeira.
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

/** Normaliza o número para o formato que o Evolution usa: dígitos com DDI 55. */
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

class IniciarCadastroDto {
  @IsString() nome: string;
  @IsString() cpf: string;
  @IsString() whatsapp: string;
}

@Injectable()
export class CadastroWhatsappService {
  private readonly logger = new Logger("CadastroWhatsapp");

  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
  ) {}

  // ── Início, a partir do site ────────────────────────────────────────────────

  async iniciar(dto: IniciarCadastroDto, ip?: string) {
    const nome = (dto.nome || "").trim();
    if (nome.length < 3) throw new BadRequestException("Informe seu nome completo.");
    if (!cpfValido(dto.cpf)) throw new BadRequestException("CPF inválido.");

    const cpf = soDigitos(dto.cpf);
    const whatsapp = normalizarWhatsapp(dto.whatsapp);
    // 55 + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos.
    if (whatsapp.length < 12 || whatsapp.length > 13) {
      throw new BadRequestException("WhatsApp inválido. Use DDD + número.");
    }

    // Já existe conta com este CPF? A resposta é deliberadamente a MESMA do
    // caminho feliz (ver o retorno lá embaixo): dizer "este CPF já tem conta"
    // transforma o endpoint público num verificador de quem é cliente.
    const jaTemConta = await (this.prisma as any).user.findFirst({ where: { cpf } });

    // Conversa já aberta para este número: devolve a mesma, sem abrir outra e
    // sem mandar mensagem de novo. Reenviar a cada clique é como um número é
    // marcado como spam.
    const aberta = await (this.prisma as any).cadastroWhatsapp.findFirst({
      where: { whatsapp, status: { in: STATUS_ABERTO }, expiraEm: { gt: new Date() } },
    });
    if (aberta) {
      return { ok: true, mensagem: "Já te mandamos uma mensagem no WhatsApp. Responda por lá para continuar." };
    }

    if (ip) {
      const umaHoraAtras = new Date(Date.now() - 3600_000);
      const doIp = await (this.prisma as any).cadastroWhatsapp.count({
        where: { ipOrigem: ip, criadoEm: { gt: umaHoraAtras } },
      });
      if (doIp >= MAX_POR_IP_HORA) {
        throw new BadRequestException("Muitas tentativas. Tente de novo daqui a pouco.");
      }
    }

    if (jaTemConta) {
      // Mesma resposta do caminho feliz, mas sem criar nada nem enviar nada.
      this.logger.log(`iniciar: CPF ja possui conta — ignorado em silencio (ip=${ip || "?"})`);
      return { ok: true, mensagem: "Te mandamos uma mensagem no WhatsApp. Responda por lá para continuar." };
    }

    const cadastro = await (this.prisma as any).cadastroWhatsapp.create({
      data: {
        id: randomUUID(), nome, cpf, whatsapp,
        status: "AGUARDANDO", etapa: "EMAIL",
        ipOrigem: ip || null,
        expiraEm: new Date(Date.now() + VALIDADE_MIN * 60_000),
      },
    });

    const enviou = await this.wa
      .sendMessage(whatsapp, this.msgAbertura(nome))
      .catch(() => false);

    if (!enviou) {
      // Falhou o envio: a linha fica, mas marcada. Sem isto o número ficaria
      // com uma conversa "aberta" que nunca começou, e o próximo clique seria
      // engolido pelo bloco de `aberta` ali em cima.
      await (this.prisma as any).cadastroWhatsapp.update({
        where: { id: cadastro.id },
        data: { status: "CANCELADO" },
      });
      throw new BadRequestException(
        "Não consegui enviar a mensagem para este WhatsApp. Confira o número e tente de novo."
      );
    }

    await (this.prisma as any).cadastroWhatsapp.update({
      where: { id: cadastro.id },
      data: { status: "EM_CONVERSA" },
    });

    return { ok: true, mensagem: "Te mandamos uma mensagem no WhatsApp. Responda por lá para continuar." };
  }

  // ── Conversa ────────────────────────────────────────────────────────────────

  /** A conversa aberta deste número, ou null. Consultado a cada mensagem. */
  async conversaAberta(whatsapp: string) {
    const num = normalizarWhatsapp(whatsapp);
    if (!num) return null;
    return (this.prisma as any).cadastroWhatsapp.findFirst({
      where: { whatsapp: num, status: { in: STATUS_ABERTO } },
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
      await this.responder(cadastro, "⌛ Esse cadastro expirou. Comece de novo pelo site quando quiser.", inst);
      return true;
    }

    if (/^(cancelar|sair|parar)$/i.test(resposta)) {
      await this.encerrar(cadastro.id, "CANCELADO");
      await this.responder(cadastro, "👋 Cadastro cancelado. Se mudar de ideia, é só começar de novo pelo site.", inst);
      return true;
    }

    const respostas = this.lerRespostas(cadastro);

    if (cadastro.etapa === "EMAIL") {
      if (!emailValido(resposta)) return this.invalida(cadastro, "📧 Preciso de um e-mail válido, assim: *nome@empresa.com*", inst);
      const email = resposta.toLowerCase();
      // Um e-mail = uma conta. Como cada cadastro cria uma organização nova, o
      // e-mail repetido deixaria a pessoa com duas contas e nenhuma pista de
      // qual usar para entrar.
      const existe = await (this.prisma as any).user.findFirst({ where: { email } });
      if (existe) return this.invalida(cadastro, "📧 Esse e-mail já tem conta. Me manda outro, ou entre pelo site com ele.", inst);
      respostas.email = email;
      await this.avancar(cadastro.id, "EMPRESA", respostas);
      await this.responder(cadastro, "🏢 Qual o *nome da sua empresa*?", inst);
      return true;
    }

    if (cadastro.etapa === "EMPRESA") {
      if (resposta.length < 2) return this.invalida(cadastro, "🏢 Me diga o nome da sua empresa.", inst);
      respostas.empresa = resposta;
      await this.avancar(cadastro.id, "CONFIRMACAO", respostas);
      await this.responder(cadastro, this.msgConfirmacao(cadastro.nome, cadastro.cpf, respostas), inst);
      return true;
    }

    if (cadastro.etapa === "CONFIRMACAO") {
      if (/^(1|sim|s|confirmar|ok)$/i.test(resposta)) {
        await this.concluir(cadastro, respostas, inst);
        return true;
      }
      if (/^(2|nao|não|n|corrigir)$/i.test(resposta)) {
        await this.avancar(cadastro.id, "EMAIL", {});
        await this.responder(cadastro, "🔁 Sem problema, vamos de novo.\n\n📧 Qual o seu *e-mail*?", inst);
        return true;
      }
      return this.invalida(cadastro, "Responda *1* para confirmar ou *2* para corrigir.", inst);
    }

    return false;
  }

  // ── Conclusão: é aqui que a conta passa a existir ───────────────────────────

  private async concluir(cadastro: any, respostas: any, inst?: string) {
    const senha = senhaProvisoria();
    const hash = await bcrypt.hash(senha, 12);

    // Slug da organização nova, único. O sufixo temporal evita colisão entre
    // duas empresas de mesmo nome sem obrigar ninguém a escolher outro.
    const base = String(respostas.empresa || cadastro.nome)
      .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "empresa";
    let slug = base;
    if (await (this.prisma as any).organization.findUnique({ where: { slug } })) {
      slug = `${base}-${Date.now().toString(36)}`;
    }

    const org = await (this.prisma as any).organization.create({
      data: {
        nome: respostas.empresa || cadastro.nome,
        slug, ativo: true,
        statusOperacional: "ativo", statusComercial: "ativo",
        modulosAtivos: [],
      },
    });

    const user = await (this.prisma as any).user.create({
      data: {
        id: randomUUID(), organizationId: org.id,
        nome: cadastro.nome, email: respostas.email, cpf: cadastro.cpf,
        senhaHash: hash, ativo: true, primeiroAcesso: true,
      },
    });

    // Papéis DA organização nova. Sem semear, o tenant nasce sem papel nenhum e
    // a pessoa entra sem ver nada.
    const permMap = await semearPermissoes(this.prisma);
    const masterRole = await semearPapeisDaOrganizacao(this.prisma, org.id, permMap);
    if (masterRole) {
      await (this.prisma as any).userRole.create({
        data: { userId: user.id, roleId: masterRole.id },
      });
    }

    await (this.prisma as any).userProfile.create({
      data: {
        id: randomUUID(), userId: user.id,
        whatsapp: cadastro.whatsapp,
        modulos: JSON.stringify([
          "agenda", "keep", "projetos", "gantt",
          "financeiro", "gastos", "orcamento",
          "chamados", "conhecimento", "whatsapp",
        ]),
      },
    });

    await (this.prisma as any).cadastroWhatsapp.update({
      where: { id: cadastro.id },
      data: {
        status: "CONCLUIDO", etapa: "CONCLUIDO",
        respostas: JSON.stringify(respostas),
        organizationId: org.id, userId: user.id,
        concluidoEm: new Date(),
      },
    });

    this.logger.log(`Cadastro concluido: org=${org.id} user=${user.id} via WhatsApp`);
    await this.responder(cadastro, this.msgPronto(cadastro.nome, respostas.email, senha), inst);
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

  private async avancar(id: string, etapa: string, respostas: any) {
    await (this.prisma as any).cadastroWhatsapp.update({
      where: { id },
      data: { etapa, respostas: JSON.stringify(respostas), tentativas: 0 },
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
      await this.responder(cadastro, "😕 Não consegui entender. Encerrei por aqui — comece de novo pelo site quando quiser.", inst);
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

  private msgAbertura(nome: string): string {
    const nm = primeiroNome(nome);
    return (
      `😊 *Oi${nm ? ", " + nm : ""}!* Eu sou a *Aurélia*.\n` +
      "Recebi seu cadastro e vou te ajudar a terminar por aqui mesmo — são duas perguntinhas.\n\n" +
      "📧 Para começar: qual o seu *e-mail*?\n\n" +
      "_(É com ele que você vai entrar no sistema. Se quiser parar, responda *cancelar*.)_"
    );
  }

  private msgConfirmacao(nome: string, cpf: string, r: any): string {
    const cpfFmt = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return (
      "✅ *Confere pra mim se está tudo certo:*\n\n" +
      `👤 Nome: *${nome}*\n` +
      `🪪 CPF: *${cpfFmt}*\n` +
      `📧 E-mail: *${r.email}*\n` +
      `🏢 Empresa: *${r.empresa}*\n\n` +
      "Responda *1* para confirmar ou *2* para corrigir."
    );
  }

  private msgPronto(nome: string, email: string, senha: string): string {
    const nm = primeiroNome(nome);
    return (
      `🎉 *Pronto${nm ? ", " + nm : ""}!* Sua conta está criada.\n\n` +
      `📧 E-mail: *${email}*\n` +
      `🔑 Senha provisória: *${senha}*\n\n` +
      "Entre em *orkiestri.com* e troque a senha no primeiro acesso.\n\n" +
      "Você já tem acesso a tudo: Agenda e Keep, Projetos, Financeiro, Chamados e Conhecimento.\n\n" +
      "_Guarde esta mensagem: a senha aparece só aqui._ 🧡"
    );
  }
}

@Controller("cadastro-whatsapp")
class CadastroWhatsappController {
  constructor(private service: CadastroWhatsappService) {}

  /**
   * Rota PÚBLICA, sem autenticação — é a porta de entrada de quem ainda não
   * tem conta. Os tetos estão no serviço, não aqui, para valerem também quando
   * alguém chamar o serviço de outro ponto.
   */
  @Post("iniciar")
  @HttpCode(HttpStatus.OK)
  async iniciar(@Body() dto: IniciarCadastroDto, @Req() req: any) {
    const ip =
      (req.headers?.["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.ip || req.connection?.remoteAddress || undefined;
    return this.service.iniciar(dto, ip);
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [CadastroWhatsappController],
  providers: [CadastroWhatsappService],
  exports: [CadastroWhatsappService],
})
export class CadastroWhatsappModule {}
