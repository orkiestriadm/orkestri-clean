import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";
import {
  modulosVisiveis, severidadeAtende, ehCritico, Severidade,
} from "./notificacao-modulos";

/**
 * Ponto ÚNICO por onde toda notificação passa.
 *
 * Antes existiam três caminhos independentes escolhendo destinatário:
 *   · Frota    → todos os masters da organização (hardcoded no scheduler)
 *   · Orçamento→ lista fixa em `AlertaRegra.destinatarios`
 *   · Chamado  → o atendente atribuído
 *
 * Enquanto forem três, qualquer regra de permissão vale só onde foi aplicada, e
 * o vazamento volta pela porta que ficou de fora. Por isso o despachante veio
 * antes da regra: ele é o pré-requisito, não um refinamento.
 *
 * Aqui nada é enviado de imediato. Tudo vira linha em `notificacao_envios`
 * (outbox) e quem entrega é o worker. Isso dá, de graça: trilha do que foi
 * despachado, retentativa quando a instância está fora do ar, silêncio noturno
 * e controle de vazão — nenhum dos quais existia.
 */

export type PedidoNotificacao = {
  organizationId: string;
  /** Id de produto: fleet | projects | service | ... */
  modulo: string;
  /** Identificador fino do evento (frota_cnh_venc, orc_estouro...). */
  tipo: string;
  titulo: string;
  mensagem: string;
  severidade?: Severidade;
  /** Quando informado, restringe a estes usuários (ex.: o atendente do chamado).
   *  A preferência de cada um AINDA é aplicada por cima. */
  usuariosAlvo?: string[];
  referenciaTipo?: string;
  referenciaId?: string;
  /** De-duplicação: mesma chave não é enfileirada de novo. */
  chave?: string;
};

@Injectable()
export class NotificacaoDispatcher {
  private readonly logger = new Logger(NotificacaoDispatcher.name);

  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  /**
   * Resolve destinatários, grava a notificação no sino e enfileira os envios
   * externos. Devolve quantos usuários foram atingidos por canal.
   */
  async despachar(p: PedidoNotificacao): Promise<{ sistema: number; whatsapp: number; email: number }> {
    const severidade: Severidade = p.severidade || "info";
    const resultado = { sistema: 0, whatsapp: 0, email: 0 };

    const candidatos = await this.destinatarios(p, severidade);
    if (!candidatos.length) {
      this.logger.debug(`Sem destinatário para ${p.modulo}/${p.tipo} (org ${p.organizationId})`);
      return resultado;
    }

    const cfg = await this.configOrg(p.organizationId);
    const agendadoPara = this.aplicarSilencio(cfg, severidade);

    for (const c of candidatos) {
      if (c.pref.sistema) {
        // O sino é imediato: é dentro do próprio sistema, não gasta canal
        // externo e não corre risco de banimento.
        await this.db.notification.create({
          data: {
            userId: c.userId, tipo: p.tipo, modulo: p.modulo,
            titulo: p.titulo, mensagem: p.mensagem,
            referenciaTipo: p.referenciaTipo || null, referenciaId: p.referenciaId || null,
          },
        }).catch(() => {});
        resultado.sistema++;
      }

      if (c.pref.whatsapp && c.telefone) {
        const ok = await this.enfileirar({
          ...p, severidade, canal: "whatsapp", destino: c.telefone,
          userId: c.userId, agendadoPara,
        });
        if (ok) resultado.whatsapp++;
      }

      if (c.pref.email && c.email) {
        const ok = await this.enfileirar({
          ...p, severidade, canal: "email", destino: c.email,
          userId: c.userId, agendadoPara,
        });
        if (ok) resultado.email++;
      }
    }

    return resultado;
  }

  /**
   * Quem recebe.
   *
   * NEGAÇÃO POR PADRÃO: sem linha em `notificacao_preferencias`, a pessoa não
   * recebe. É a decisão que separa este desenho do anterior — antes o alerta de
   * Frota ia para todos os masters, quisessem ou não, cuidassem de frota ou não.
   *
   * O acesso ao módulo é checado ALÉM da preferência: se alguém perder o acesso
   * a Projetos, para de receber de Projetos na hora, sem depender de o master
   * lembrar de apagar a preferência.
   */
  private async destinatarios(p: PedidoNotificacao, severidade: Severidade) {
    const where: any = { organizationId: p.organizationId, modulo: p.modulo };
    if (p.usuariosAlvo?.length) where.userId = { in: p.usuariosAlvo };

    const prefs = await this.db.notificacaoPreferencia.findMany({ where }).catch(() => []);
    if (!prefs.length) return [];

    const users = await this.db.user.findMany({
      where: { id: { in: prefs.map((x: any) => x.userId) }, ativo: true },
      select: {
        id: true, email: true,
        profile: { select: { whatsapp: true, whatsappVerificado: true, modulos: true } },
      },
    }).catch(() => []);
    const porId = new Map(users.map((u: any) => [u.id, u]));

    const lista: Array<{ userId: string; telefone: string | null; email: string | null; pref: any }> = [];
    for (const pref of prefs) {
      if (!severidadeAtende(severidade, pref.severidadeMin)) continue;

      const u: any = porId.get(pref.userId);
      if (!u) continue; // inativo ou removido

      // Segunda barreira: o módulo precisa estar no acesso da pessoa.
      if (!modulosVisiveis(u.profile?.modulos).includes(p.modulo)) continue;

      // Número não confirmado não recebe. Sem isto, um dígito errado no
      // cadastro faz alerta interno da empresa chegar a um desconhecido — e
      // ninguém descobre, porque não há retorno de entrega.
      const telefone = u.profile?.whatsappVerificado ? (u.profile?.whatsapp || null) : null;

      lista.push({ userId: pref.userId, telefone, email: u.email || null, pref });
    }
    return lista;
  }

  /**
   * Enfileira uma mensagem JÁ FORMATADA para um destino conhecido, sem passar
   * pelo filtro de preferência por módulo.
   *
   * Existe para dois casos em que o filtro não se aplica, mas a FILA sim:
   *
   *  · Automações e Workflows — o destinatário é escolhido a dedo por quem
   *    montou a automação. Bloquear por preferência de módulo seria errado (a
   *    pessoa pediu explicitamente aquele envio), mas passar direto significava
   *    ficar fora do limite de vazão: uma automação mal configurada dispara em
   *    rajada e o WhatsApp bane o número da empresa.
   *
   *  · Chamados — a permissão já foi aplicada antes (em `getUserPhone`), e as
   *    mensagens têm texto próprio por evento (assunto, prioridade, prazo) que
   *    o formato genérico do `despachar` perderia. Aqui elas mantêm o texto e
   *    ganham retentativa e silêncio noturno.
   *
   * O que este caminho NÃO faz: decidir quem recebe. Quem chama já decidiu.
   */
  async enfileirarDireto(p: {
    organizationId: string;
    canal: "whatsapp" | "email";
    destino: string;
    modulo: string;
    tipo: string;
    titulo: string;
    mensagem: string;
    severidade?: Severidade;
    userId?: string | null;
    chave?: string;
    /** Transacional (código de acesso, senha) não espera o amanhecer. */
    ignorarSilencio?: boolean;
  }): Promise<boolean> {
    if (!p.destino) return false;
    const severidade: Severidade = p.severidade || "info";
    const cfg = await this.configOrg(p.organizationId);
    const agendadoPara = p.ignorarSilencio ? null : this.aplicarSilencio(cfg, severidade);

    return this.enfileirar({
      organizationId: p.organizationId,
      userId: p.userId || null,
      canal: p.canal,
      destino: p.destino,
      modulo: p.modulo,
      tipo: p.tipo,
      severidade,
      titulo: p.titulo,
      mensagem: p.mensagem,
      chave: p.chave,
      agendadoPara,
    });
  }

  /** Grava na outbox. Devolve false quando a chave já existia (de-dup). */
  private async enfileirar(e: any): Promise<boolean> {
    // A chave inclui canal e usuário: o mesmo evento vira uma linha por
    // destinatário, senão o de-dup entregaria só para a primeira pessoa.
    const chave = e.chave ? `${e.chave}::${e.canal}::${e.userId}` : null;
    try {
      await this.db.notificacaoEnvio.create({
        data: {
          id: crypto.randomUUID(),
          organizationId: e.organizationId,
          userId: e.userId,
          canal: e.canal,
          destino: e.destino,
          modulo: e.modulo,
          tipo: e.tipo,
          severidade: e.severidade,
          titulo: e.titulo,
          mensagem: e.mensagem,
          status: "pendente",
          agendadoPara: e.agendadoPara,
          chave,
        },
      });
      return true;
    } catch (err: any) {
      // Violação da unique (org, chave) = já enfileirado. Não é erro.
      if (String(err?.code) === "P2002") return false;
      this.logger.error(`Falha ao enfileirar ${e.canal} para ${e.userId}: ${err?.message}`);
      return false;
    }
  }

  private async configOrg(organizationId: string) {
    const cfg = await this.db.orgNotificacaoConfig.findUnique({ where: { organizationId } }).catch(() => null);
    return cfg || {
      silencioInicio: 21, silencioFim: 7, silencioIgnoraCritico: true,
      maxPorMinuto: 12, agruparPorModulo: true,
    };
  }

  /**
   * Adia a entrega quando cai na janela de silêncio.
   *
   * Devolve `null` quando pode sair agora. Crítico fura o silêncio se a
   * organização assim configurar — um veículo sinistrado às 2h da manhã não
   * pode esperar até as 7h.
   */
  private aplicarSilencio(cfg: any, severidade: Severidade): Date | null {
    const ini = Number(cfg.silencioInicio), fim = Number(cfg.silencioFim);
    if (ini === fim) return null;                                  // silêncio desligado
    if (ehCritico(severidade) && cfg.silencioIgnoraCritico) return null;

    const agora = new Date();
    const h = agora.getHours();
    // A janela pode cruzar a meia-noite (ex.: 21h → 7h).
    const dentro = ini < fim ? (h >= ini && h < fim) : (h >= ini || h < fim);
    if (!dentro) return null;

    const saida = new Date(agora);
    saida.setMinutes(0, 0, 0);
    saida.setHours(fim);
    // Se o fim já passou hoje, é amanhã.
    if (saida.getTime() <= agora.getTime()) saida.setDate(saida.getDate() + 1);
    return saida;
  }
}
