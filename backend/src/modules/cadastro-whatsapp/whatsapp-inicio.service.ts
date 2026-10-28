import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { mensagemInicioTesteAgenda } from "../prospects/lead-onboarding";
import { DIAS_DE_TESTE, VALOR_MENSALIDADE_LABEL } from "../auth/trial-renovacao";

export type UsuarioInicio = { id: string; organizationId: string; nome: string; telefone: string | null };
export type AcaoInicio = { tipo: "evento" | "gasto"; resumo: string; registro: any };
type ResultadoFluxo = { consumido: boolean; mensagem?: string; acao?: AcaoInicio };

export function acessosInicio(perms: string[]) {
  return { evento: perms.includes("*") || perms.includes("agenda:criar"),
    gasto: perms.includes("*") || perms.includes("gastos:registrar") || perms.includes("financeiro:gerenciar") };
}

@Injectable()
export class WhatsappInicioService {
  private readonly logger = new Logger("WhatsappInicio");
  private rodando = false;
  constructor(private prisma: PrismaService, private wa: WhatsAppService) {}

  async enfileirar(tx: any, userId: string, cadastroId: string, telefone: string, instancia: string) {
    await tx.$executeRaw`
      INSERT INTO whatsapp_boas_vindas (user_id,cadastro_id,telefone,instancia)
      VALUES (${userId},${cadastroId},${telefone},${instancia}) ON CONFLICT DO NOTHING
    `;
  }

  private mensagemAcesso(user: { nome: string; email: string }) {
    const convite = mensagemInicioTesteAgenda(user);
    if (convite) return convite;
    const app = (process.env.APP_URL || "http://localhost").replace(/\/$/, "");
    return `✅ *Sua conta está pronta, ${user.nome.split(/\s+/)[0]}!*\n\n` +
      `Você tem *${DIAS_DE_TESTE} dias* para usar tudo sem pagar nada. ` +
      `Quando estiver acabando eu te aviso por aqui, com as formas de pagar — são *${VALOR_MENSALIDADE_LABEL} por mês*, com todos os módulos.\n\n` +
      "Para usar aqui no WhatsApp, escreva *menu*. Eu mostro suas opções e faço uma pergunta por vez.\n\n" +
      `E-mail de acesso: *${user.email}*\n` +
      `Quer usar também o site? Crie sua senha em:\n${app}/recuperar-senha\n` +
      "Escolha receber o código pelo WhatsApp ou o link por e-mail.\n\n" +
      "No site, há também as opções avançadas. Definir uma senha é necessário apenas para entrar no site. Nunca envie sua senha nesta conversa.\n" +
      "Para receber estas orientações novamente, escreva *acesso*.";
  }

  async enviarAcesso(userId: string, instancia: string): Promise<boolean> {
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user?.ativo || user.bloqueado || !user.profile?.whatsapp) return false;
    return this.wa.sendMessage(user.profile.whatsapp, this.mensagemAcesso(user), instancia);
  }

  async temFluxo(conversa: string, instancia: string): Promise<boolean> {
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT 1 FROM whatsapp_inicio WHERE conversa=${conversa} AND instancia=${instancia}
        AND expira_em > CURRENT_TIMESTAMP LIMIT 1
    `;
    return rows.length > 0;
  }

  async entregar(userId: string): Promise<void> {
    const tentativa = randomUUID();
    const rows: any[] = await this.prisma.$queryRaw`
      UPDATE whatsapp_boas_vindas SET estado='ENVIANDO', tentativas=tentativas+1,
        tentativa_id=${tentativa}, atualizado_em=CURRENT_TIMESTAMP
      WHERE user_id=${userId} AND tentativas < 5 AND expira_em > CURRENT_TIMESTAMP
        AND proxima_tentativa <= CURRENT_TIMESTAMP
        AND (estado='PENDENTE' OR (estado='ENVIANDO' AND atualizado_em < CURRENT_TIMESTAMP - INTERVAL '5 minutes'))
      RETURNING *
    `;
    if (!rows.length) return;
    const row = rows[0];
    let ok = false, descartada = false;
    try {
      const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, include: { profile: true } });
      descartada = !user?.ativo || user.bloqueado || !user.profile?.whatsapp ||
        user.profile.whatsapp.replace(/\D/g, "") !== row.telefone.replace(/\D/g, "");
      if (!descartada) ok = await this.wa.sendMessage(row.telefone, this.mensagemAcesso(user), row.instancia);
    } catch { this.logger.warn("Falha de envio de boas-vindas; tentativa registrada."); }
    const estado = descartada ? "DESCARTADA" : ok ? "ACEITA" : row.tentativas >= 5 ? "FALHOU" : "PENDENTE";
    const proxima = new Date(Date.now() + Math.min(900000, 30000 * 2 ** row.tentativas));
    await this.prisma.$executeRaw`
      UPDATE whatsapp_boas_vindas SET estado=${estado}, proxima_tentativa=${proxima}, atualizado_em=CURRENT_TIMESTAMP
      WHERE user_id=${userId} AND tentativa_id=${tentativa}
    `;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processarPendentes() {
    if (this.rodando) return;
    this.rodando = true;
    try {
      await this.prisma.$executeRaw`DELETE FROM whatsapp_inicio WHERE expira_em < CURRENT_TIMESTAMP`;
      await this.prisma.$executeRaw`
        UPDATE whatsapp_boas_vindas SET estado='EXPIRADA', atualizado_em=CURRENT_TIMESTAMP
        WHERE estado IN ('PENDENTE','ENVIANDO') AND expira_em < CURRENT_TIMESTAMP
      `;
      // A última tentativa pode ter sido interrompida antes de registrar o resultado.
      await this.prisma.$executeRaw`
        UPDATE whatsapp_boas_vindas SET estado='FALHOU', atualizado_em=CURRENT_TIMESTAMP
        WHERE estado='ENVIANDO' AND tentativas >= 5 AND atualizado_em < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
      `;
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT user_id FROM whatsapp_boas_vindas WHERE tentativas < 5 AND expira_em > CURRENT_TIMESTAMP
          AND proxima_tentativa <= CURRENT_TIMESTAMP
          AND (estado='PENDENTE' OR (estado='ENVIANDO' AND atualizado_em < CURRENT_TIMESTAMP - INTERVAL '5 minutes'))
        ORDER BY proxima_tentativa LIMIT 10
      `;
      for (const row of rows) await this.entregar(row.user_id);
    } catch { this.logger.error("Não foi possível processar a fila de boas-vindas."); }
    finally { this.rodando = false; }
  }

  async fluxo(user: UsuarioInicio, conversa: string, instancia: string, texto: string, perms: string[],
    preparar: (tipo: "evento" | "gasto", dados: any) => AcaoInicio | null,
    executar: (acao: AcaoInicio) => Promise<void>): Promise<boolean> {
    const t = texto.trim(), normal = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const acesso = acessosInicio(perms);
    const menu = "Vamos organizar algo? Responda:\n" +
      (acesso.evento ? "*1* — compromisso\n" : "") + (acesso.gasto ? "*2* — gasto\n" : "") +
      "*0* — cancelar\n\nVocê também pode enviar *menu* a qualquer momento.";
    const resultado: ResultadoFluxo = await this.prisma.$transaction(async (tx: any) => {
      // Serializa somente as transições de estado, sem manter lock durante envios.
      const lock = `${user.id}|${instancia}|${conversa}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))`;
      const rows = await tx.$queryRaw`
        SELECT etapa,dados FROM whatsapp_inicio WHERE user_id=${user.id} AND instancia=${instancia}
          AND conversa=${conversa} AND expira_em > CURRENT_TIMESTAMP
      `;
      const state = rows[0];
      const limpar = () => tx.$executeRaw`DELETE FROM whatsapp_inicio WHERE user_id=${user.id} AND instancia=${instancia} AND conversa=${conversa}`;
      const salvar = (etapa: string, dados: any) => tx.$executeRaw`
        INSERT INTO whatsapp_inicio(user_id,instancia,conversa,etapa,dados)
        VALUES (${user.id},${instancia},${conversa},${etapa},${JSON.stringify(dados)}::jsonb)
        ON CONFLICT(user_id,instancia,conversa) DO UPDATE SET etapa=EXCLUDED.etapa,dados=EXCLUDED.dados,
          expira_em=CURRENT_TIMESTAMP + INTERVAL '30 minutes'
      `;
      const abrir = /^(comecar|primeiros passos|organizar)$/.test(normal);
      if (!abrir && !state) return { consumido: false };
      if (/^(menu|ajuda|help)(?: principal)?[.!?]*$/.test(normal) || /^(evento|agenda|gasto|nota|projeto|chamado|conta|relatorio|vincular)\s*[:]/i.test(t)) {
        await limpar(); return { consumido: false };
      }
      if (/^(0|cancelar|sair|parar)$/.test(normal)) {
        await limpar(); return { consumido: true, mensagem: "Conversa guiada encerrada. Envie *começar* quando quiser organizar algo." };
      }
      if (!acesso.evento && !acesso.gasto) {
        await limpar(); return { consumido: true, mensagem: "Sua conta precisa de acesso à Agenda ou ao Financeiro para usar esse passo a passo. Envie *menu* para ver seus recursos." };
      }
      if (abrir || normal === "voltar") {
        await salvar("ESCOLHA", {}); return { consumido: true, mensagem: menu };
      }
      const dados = state.dados;
      if (dados.tipo && !acesso[dados.tipo as "evento" | "gasto"]) {
        await limpar(); return { consumido: true, mensagem: "Seu acesso a esse recurso mudou. Envie *menu* para continuar." };
      }
      const responder = (mensagem: string) => ({ consumido: true, mensagem });
      if (state.etapa === "ESCOLHA") {
        if (t === "1" && acesso.evento) { await salvar("TITULO", { tipo: "evento" }); return responder("Qual é o compromisso? Por exemplo: *Dentista*."); }
        if (t === "2" && acesso.gasto) { await salvar("DESCRICAO", { tipo: "gasto" }); return responder("Com o que você gastou? Por exemplo: *Mercado*."); }
        return responder(menu);
      }
      if (state.etapa === "TITULO" || state.etapa === "DESCRICAO") {
        if (t.length < 2 || t.length > 120 || /[\r\n]/.test(t)) return responder("Escreva uma descrição entre 2 e 120 caracteres, em uma linha.");
        await salvar(dados.tipo === "evento" ? "QUANDO" : "VALOR", { ...dados, titulo: t });
        return responder(dados.tipo === "evento" ? "Qual o dia e horário? Por exemplo: *amanhã 14h* ou *25/10 09:30*." : "Qual foi o valor total? Por exemplo: *48,90*. Não informe as parcelas neste passo.");
      }
      if (state.etapa === "VALOR") {
        if (!/^(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?$/.test(t)) return responder("Informe apenas o valor total, como *48,90* ou *1.250,00*.");
        await salvar("FORMA", { ...dados, valor: t.replace(/^R\$\s*/i, "") });
        return responder("Como pagou? Responda *pix*, *crédito*, *débito*, *dinheiro* ou *boleto*.");
      }
      if (state.etapa === "QUANDO" || state.etapa === "FORMA") {
        if (state.etapa === "FORMA" && !/^(pix|credito|debito|dinheiro|boleto)$/.test(normal)) return responder("Escolha *pix*, *crédito*, *débito*, *dinheiro* ou *boleto*.");
        const acao = preparar(dados.tipo, { ...dados, resposta: t });
        if (!acao) return responder(state.etapa === "QUANDO" ? "Não consegui validar a data. Tente *amanhã 14h* ou *25/10 09:30*, para um compromisso sem repetição." : "Não consegui validar o valor. Envie *voltar* para recomeçar.");
        await salvar("CONFIRMAR", { ...dados, acao });
        return responder(acao.resumo + "\n\n*1* — confirmar\n*2* — corrigir\n*0* — cancelar");
      }
      if (state.etapa === "CONFIRMAR") {
        if (/^(1|sim|confirmar)$/.test(normal)) { await limpar(); return { consumido: true, acao: dados.acao }; }
        if (/^(2|corrigir)$/.test(normal)) {
          await salvar(dados.tipo === "evento" ? "QUANDO" : "VALOR", { tipo: dados.tipo, titulo: dados.titulo });
          return responder(dados.tipo === "evento" ? "Qual o dia e horário corretos?" : "Qual o valor total correto?");
        }
        return responder("Responda *1* para confirmar, *2* para corrigir ou *0* para cancelar.");
      }
      await limpar(); return responder("Vamos começar de novo? Envie *começar*.");
    });
    if (resultado.mensagem) {
      if (user.telefone) await this.wa.sendMessage(user.telefone, resultado.mensagem, instancia);
      else await this.wa.sendToJid(conversa, resultado.mensagem, instancia);
    }
    if (resultado.acao) await executar(resultado.acao);
    return resultado.consumido;
  }
}
