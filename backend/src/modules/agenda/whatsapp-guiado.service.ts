import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { WhatsappEquipeService } from "./whatsapp-equipe.service";
import { CalendarWritebackService } from "../integracoes/calendar/calendar-writeback.service";
import {
  antesDeEfeito,
  acaoUtil,
  identificarExecucao,
} from "./whatsapp-execucao";
import {
  camposGuia,
  validarCampo,
  simples,
  NAV,
  dataLegivel,
  diaLegivel,
  rotuloStatus,
} from "./whatsapp-guiado-formularios";
import { randomUUID } from "crypto";
import {
  dataTarefa,
  diaSaoPaulo,
  instanteSaoPaulo,
  somarDias,
} from "./whatsapp-rotina-datas";

type User = { id: string; organizationId: string; nome: string };
export type PortasGuia = {
  evento: (texto: string) => any;
  gasto: (texto: string) => any;
  outro: (acao: string, valores: any) => Promise<void>;
};
type Estado = { fase: string; v: any; historico?: any[]; mensagem?: string };
const permissao = (p: string[], r: string) => p.includes("*") || p.includes(r);
const dinheiro = (v: any) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

@Injectable()
export class WhatsappGuiadoService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    private auth: AuthService,
    private equipe: WhatsappEquipeService,
    private writeback: CalendarWritebackService,
  ) {}
  private scope(user: User) {
    return {
      organizationId: user.organizationId,
      OR: [
        { criadoPorId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    };
  }
  private required(acao: string) {
    if (acao === "demanda.status") return "projetos:ver";
    const recurso = acao.startsWith("evento.")
      ? "agenda"
      : acao.startsWith("nota.") || acao.startsWith("tarefa.")
        ? "keep"
        : acao.startsWith("gasto.")
          ? "gastos"
          : acao.startsWith("chamado.")
            ? "chamados"
            : acao.startsWith("conta.")
              ? "financeiro"
              : "projetos";
    const operacao = acao.endsWith(".criar")
      ? "criar"
      : acao.endsWith(".excluir")
        ? "deletar"
        : "editar";
    return recurso === "gastos"
      ? operacao === "criar"
        ? "gastos:registrar"
        : "gastos:editar"
      : recurso === "financeiro"
        ? "financeiro:gerenciar"
        : `${recurso}:${operacao}`;
  }
  private pode(p: string[], acao: string) {
    return (
      permissao(p, this.required(acao)) ||
      (acao.startsWith("gasto.") &&
        (permissao(p, "gastos:registrar") ||
          permissao(p, "financeiro:gerenciar")))
    );
  }
  private menu(p: string[]) {
    return (
      "Como posso ajudar? Responda o número:\n\n" +
      (permissao(p, "agenda:ver") ? "*1* — Meus compromissos\n" : "") +
      (permissao(p, "keep:ver") ? "*2* — Anotações\n" : "") +
      (permissao(p, "gastos:ver") || permissao(p, "financeiro:ver")
        ? "*3* — Meus gastos\n"
        : "") +
      (permissao(p, "projetos:ver")
        ? "*4* — Projetos e tarefas da equipe\n"
        : "") +
      (permissao(p, "keep:ver") ? "*5* — Minhas tarefas pessoais\n" : "") +
      "*6* — Mais opções e ajuda\n*0* — Sair"
    );
  }
  private submenu(grupo: string, p: string[]) {
    const nome: any = {
      evento: "Meus compromissos",
      nota: "Minhas anotações",
      gasto: "Meus gastos",
      tarefa: "Minhas tarefas pessoais",
      projeto: "Projetos e tarefas da equipe",
    };
    return (
      `*${nome[grupo]}*${grupo === "projeto" ? "\nEste espaço é da sua empresa. Você só verá os projetos aos quais tem acesso." : "\nEstes registros são seus."}\n\n` +
      (this.pode(p, grupo + ".criar")
        ? "*1* — " +
          (grupo === "evento"
            ? "Marcar compromisso"
            : grupo === "nota"
              ? "Fazer anotação"
              : grupo === "gasto"
                ? "Anotar gasto"
                : grupo === "tarefa"
                  ? "Criar tarefa"
                  : "Criar projeto") +
          "\n"
        : "") +
      "*2* — Ver e escolher da lista\n" +
      (grupo === "gasto" ? "*3* — Resumo dos meus gastos\n" : "") +
      NAV.trimStart()
    );
  }
  private campos(v: any) {
    return camposGuia(v.acao).filter(
      (c) =>
        (c.key !== "parcelas" || v.formaPagamento === "CREDITO") &&
        (c.key !== "recorrenciaFim" || !!v.recorrencia),
    );
  }
  private resumo(v: any) {
    const nomes: any = {
      "evento.criar": "Marcar compromisso",
      "evento.editar": "Alterar compromisso",
      "evento.excluir": "Excluir compromisso",
      "nota.criar": "Salvar anotação",
      "nota.editar": "Alterar anotação",
      "nota.excluir": "Mover anotação para a lixeira",
      "gasto.criar": "Anotar gasto",
      "gasto.editar": "Alterar gasto",
      "gasto.excluir": "Excluir gasto",
      "projeto.criar": "Criar projeto",
      "projeto.editar": "Alterar projeto",
      "projeto.excluir": "Excluir projeto e suas tarefas",
      "demanda.criar": "Criar tarefa no projeto",
      "demanda.editar": "Alterar tarefa do projeto",
      "demanda.excluir": "Excluir tarefa do projeto",
      "demanda.status": "Mudar situação da tarefa",
      "tarefa.criar": "Criar tarefa pessoal",
      "tarefa.editar": "Alterar tarefa pessoal",
      "tarefa.excluir": "Excluir tarefa pessoal",
      "tarefa.status": "Mudar situação da tarefa pessoal",
      "chamado.criar": "Pedir ajuda",
      "conta.criar": "Anotar conta a pagar",
    };
    const linhas = [`*${nomes[v.acao] || "Confira antes de salvar"}*`];
    if (/^(projeto|demanda|chamado|conta)\./.test(v.acao))
      linhas.push("Espaço da sua empresa.");
    if (v.projectNome) linhas.push("Projeto: " + v.projectNome);
    for (const c of this.campos(v)) {
      const valor = v[c.key];
      if (valor === undefined) continue;
      const rotulo =
        c.tipo === "pessoa"
          ? v.pessoaNome || "Sem responsável"
          : c.tipo === "quando"
            ? dataLegivel(valor)
            : c.tipo === "dia"
              ? valor
                ? diaLegivel(valor)
                : "Sem prazo"
              : c.tipo === "valor"
                ? dinheiro(valor)
                : c.tipo === "repeticao"
                  ? {
                      DIARIA: "Todos os dias",
                      SEMANAL: "Toda semana",
                      MENSAL: "Todo mês",
                    }[valor] || "Não"
                  : c.tipo === "pagamento"
                    ? {
                        PIX: "Pix",
                        CREDITO: "Crédito",
                        DEBITO: "Débito",
                        DINHEIRO: "Dinheiro",
                        BOLETO: "Boleto",
                      }[valor] || valor
                    : (valor ?? "Não informado");
      linhas.push(`${c.nome}: ${String(rotulo).slice(0, 2000)}`);
    }
    if (v.acao.endsWith(".excluir"))
      linhas.push(v.titulo || v.descricao || v.conteudo || "");
    if (v.status) linhas.push("Situação: " + rotuloStatus(v.status));
    if (v.acao.endsWith(".status") && v.titulo)
      linhas.push("Tarefa: " + v.titulo);
    if (v.concluido !== undefined)
      linhas.push(v.concluido ? "Tarefa concluída" : "Tarefa pendente");
    if (v.serie)
      linhas.push("Atenção: esta alteração afeta a série de compromissos.");
    return (
      linhas.join("\n") +
      "\n\n*1* — Confirmar\n*2* — Corrigir\n*Cancelar* — Não salvar" +
      NAV
    );
  }
  private async lista(
    tx: any,
    u: User,
    v: any,
  ): Promise<{ estado: Estado; mensagem: string }> {
    const acesso = await this.auth.resolvePermissions(u.id);
    const necessario = (
      {
        evento: "agenda:ver",
        nota: "keep:ver",
        gasto: "gastos:ver",
        tarefa: "keep:ver",
        projeto: "projetos:ver",
        demanda: "projetos:ver",
        pessoa: "projetos:ver",
      } as any
    )[v.grupo];
    if (
      !necessario ||
      (!permissao(acesso, necessario) &&
        !(v.grupo === "gasto" && permissao(acesso, "financeiro:gerenciar")))
    )
      return {
        estado: { fase: "MENU", v: {} },
        mensagem: "Você não tem acesso a essa lista.\n\n" + this.menu(acesso),
      };
    const skip = (v.pagina || 0) * 5,
      base = { userId: u.id, organizationId: u.organizationId };
    let rows: any[] = [];
    if (v.grupo === "evento")
      rows = await tx.event.findMany({
        where: {
          ...base,
          externalCancelled: false,
          OR: [
            { inicio: { gte: new Date(Date.now() - 86400000) } },
            {
              recorrencia: { not: null },
              OR: [
                { recorrenciaFim: null },
                { recorrenciaFim: { gte: new Date() } },
              ],
            },
          ],
        },
        orderBy: [{ inicio: "asc" }, { id: "asc" }],
        skip,
        take: 6,
      });
    if (v.grupo === "nota")
      rows = await tx.note.findMany({
        where: { ...base, lixeira: false, arquivado: false },
        orderBy: [{ atualizadoEm: "desc" }, { id: "asc" }],
        skip,
        take: 6,
      });
    if (v.grupo === "gasto")
      rows = await tx.gasto.findMany({
        where: base,
        orderBy: [{ dataGasto: "desc" }, { id: "asc" }],
        skip,
        take: 6,
      });
    if (v.grupo === "tarefa")
      rows = await tx.dailyTask.findMany({
        where: { userId: u.id, checklistItemId: null },
        orderBy: [{ data: "desc" }, { id: "asc" }],
        skip,
        take: 6,
      });
    if (v.grupo === "projeto")
      rows = await tx.project.findMany({
        where: this.scope(u),
        orderBy: [{ atualizadoEm: "desc" }, { id: "asc" }],
        skip,
        take: 6,
      });
    if (v.grupo === "demanda")
      rows = await tx.task.findMany({
        where: { projectId: v.projectId, project: this.scope(u) },
        include: { assignee: { select: { nome: true } } },
        orderBy: [{ atualizadoEm: "desc" }, { id: "asc" }],
        skip,
        take: 6,
      });
    if (v.grupo === "pessoa") {
      const project = await tx.project.findFirst({
        where: { ...this.scope(u), id: v.projectId },
      });
      if (project)
        rows = await tx.user.findMany({
          where: {
            organizationId: u.organizationId,
            ativo: true,
            bloqueado: false,
            OR: [
              { id: project.criadoPorId },
              { projectMembers: { some: { projectId: project.id } } },
            ],
          },
          select: { id: true, nome: true },
          orderBy: [{ nome: "asc" }, { id: "asc" }],
          skip,
          take: 6,
        });
    }
    const itens = rows.slice(0, 5).map((r) => ({
      id: r.id,
      nome:
        r.nome ||
        r.titulo ||
        r.descricao ||
        r.conteudo?.slice(0, 80) ||
        "Sem título",
      versao: r.atualizadoEm?.toISOString(),
      dados: r,
    }));
    const linhas = itens.map(
      (r, i) =>
        `*${i + 1}* — ${String(r.nome).slice(0, 120)}${v.grupo === "evento" ? " · " + dataLegivel(r.dados.inicio) : v.grupo === "gasto" ? " · " + dinheiro(r.dados.valor) : r.dados.status ? " · " + rotuloStatus(r.dados.status) : ""}`,
    );
    return {
      estado: { fase: "LISTA", v: { ...v, itens, mais: rows.length > 5 } },
      mensagem:
        (v.grupo === "pessoa"
          ? "Quem ficará responsável?\n*6* — Sem responsável\n\n"
          : "Escolha um item da lista:\n\n") +
        (linhas.join("\n") || "Não há itens nesta página.") +
        (rows.length > 5 ? "\n*8* — Próxima página" : "") +
        (skip ? "\n*7* — Página anterior" : "") +
        NAV,
    };
  }
  private async perguntar(
    tx: any,
    u: User,
    v: any,
  ): Promise<{ estado: Estado; mensagem: string }> {
    const campos = this.campos(v),
      campo = campos[v.indice || 0];
    if (!campo)
      return { estado: { fase: "CONFIRMAR", v }, mensagem: this.resumo(v) };
    if (campo.tipo === "pessoa")
      return this.lista(tx, u, { ...v, grupo: "pessoa", pagina: 0 });
    return {
      estado: { fase: "FORM", v },
      mensagem:
        campo.pergunta +
        (v[campo.key] != null
          ? "\nAtual: " +
            (campo.tipo === "quando"
              ? dataLegivel(v[campo.key])
              : String(v[campo.key]).slice(0, 160)) +
            "\nPara manter, envie *manter*."
          : "") +
        NAV,
    };
  }
  async tratar(
    u: User,
    texto: string,
    conversa: string,
    instancia: string,
    portas: PortasGuia,
  ): Promise<boolean> {
    const t = texto.trim(),
      n = simples(t),
      abrir =
        /^(menu|ajuda|oi|ola|bom dia|boa tarde|boa noite|comecar|primeiros passos|organizar|voltar ao menu)[.!?]*$/.test(
          n,
        );
    const atalhos: any = {
      agenda: "evento",
      compromissos: "evento",
      "meus compromissos": "evento",
      anotacoes: "nota",
      keep: "nota",
      "minhas notas": "nota",
      gastos: "gasto",
      "meus gastos": "gasto",
      projetos: "projeto",
      "minhas tarefas": "tarefa",
      "tarefas pessoais": "tarefa",
    };
    let externo = false,
      eventoSync: any = null,
      gravando = false;
    try {
      const p = await this.auth.resolvePermissions(u.id);
      const resultado = await this.prisma.$transaction(
        async (tx: any) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${u.id + "|" + instancia + "|" + conversa},0))`;
          const rows: any[] =
            await tx.$queryRaw`SELECT etapa,dados FROM whatsapp_inicio WHERE user_id=${u.id} AND instancia=${instancia} AND conversa=${conversa} AND expira_em>CURRENT_TIMESTAMP`;
          let state: Estado = rows[0]?.etapa?.startsWith("GUIA_")
            ? rows[0].dados
            : null;
          const limpar = () =>
            tx.$executeRaw`DELETE FROM whatsapp_inicio WHERE user_id=${u.id} AND instancia=${instancia} AND conversa=${conversa}`;
          const salvar = async (estado: Estado, mensagem: string) => {
            estado.mensagem=mensagem;
            await tx.$executeRaw`INSERT INTO whatsapp_inicio(user_id,instancia,conversa,etapa,dados) VALUES (${u.id},${instancia},${conversa},${"GUIA_" + estado.fase},${JSON.stringify(estado)}::jsonb)
            ON CONFLICT(user_id,instancia,conversa) DO UPDATE SET etapa=EXCLUDED.etapa,dados=EXCLUDED.dados,expira_em=CURRENT_TIMESTAMP+INTERVAL '30 minutes'`;
            return mensagem;
          };
          const principal = async (prefixo = "") =>
            salvar({ fase: "MENU", v: {} }, prefixo + this.menu(p));
          const passo = async (
            proximo: { estado: Estado; mensagem: string },
            voltar = true,
          ) => {
            proximo.estado.historico =
              voltar && state
                ? [
                    ...(state.historico || []),
                    { fase: state.fase, v: state.v, mensagem:state.mensagem },
                  ].slice(-20)
                : state?.historico || [];
            return salvar(proximo.estado, proximo.mensagem);
          };
          const form = async (acao: string, v: any = {}) => {
            if (!this.pode(p, acao))
              return principal(
                "Seu acesso não permite essa ação. Você pode escolher outra opção.\n\n",
              );
            return passo(
              await this.perguntar(tx, u, { ...v, acao, indice: 0 }),
            );
          };
          if (abrir) return principal();
          if (
            state &&
            /^(?:acesso|pessoal|empresa|cadastro|renovar\b|vincular\b)/.test(n)
          ) {
            await limpar();
            return null;
          }
          if (/^(0|sair|parar)$/.test(n) && state) {
            await limpar();
            return "Tudo bem. Encerrei esta conversa. Para voltar, escreva *menu*.";
          }
          if (n === "cancelar" && state)
            return principal("Cancelei o que ainda não estava salvo.\n\n");
          if ((n === "voltar" || n === "9") && state) {
            const anterior = (state.historico || []).pop();
            if (!anterior) return principal();
            if (anterior.v?.acao && anterior.v.acao === state.v?.acao) {
              for (const campo of camposGuia(state.v.acao))
                if (Object.prototype.hasOwnProperty.call(state.v, campo.key))
                  anterior.v[campo.key] = state.v[campo.key];
              if (state.v.pessoaNome)
                anterior.v.pessoaNome = state.v.pessoaNome;
            }
            state = { ...anterior, historico: state.historico };
            if (state.fase === "FORM") {
              const q = await this.perguntar(tx, u, state.v);
              return salvar(
                { ...q.estado, historico: state.historico },
                q.mensagem,
              );
            }
            if (state.fase === "LISTA") {
              const l = await this.lista(tx, u, state.v);
              return salvar(
                { ...l.estado, historico: state.historico },
                l.mensagem,
              );
            }
            if (state.fase === "GRUPO")
              return salvar(state, this.submenu(state.v.grupo, p));
            if(state.fase==='CONFIRMAR')return salvar(state,this.resumo(state.v));
            if(state.fase==='CORRIGIR')return salvar(state,'Qual informação quer corrigir?\n'+this.campos(state.v).map((c,i)=>`*${i+1}* — ${c.nome}`).join('\n')+NAV);
            if(state.fase!=='MENU' && state.mensagem)return salvar(state,state.mensagem);
            return principal();
          }
          if (atalhos[n] && !state)
            return passo({
              estado: { fase: "GRUPO", v: { grupo: atalhos[n] } },
              mensagem: this.submenu(atalhos[n], p),
            });
          if (!state) {
            const nota =
                t.match(/^(?:nota|anota[çc][aã]o|anotar)\s*[:\-]?\s+(.+)$/is) ||
                t.match(/^nota:\s*(.+)$/is),
              proj = t.match(
                /^(?:projeto|novo projeto|criar projeto)\s*[:\-]\s*(.+)$/is,
              );
            if (nota || proj) {
              const v: any = nota
                ? { acao: "nota.criar", conteudo: nota[1] }
                : { acao: "projeto.criar", titulo: proj[1] };
              if (!this.pode(p, v.acao))
                return principal(
                  "Esse recurso não está liberado para você.\n\n",
                );
              return passo({
                estado: { fase: "CONFIRMAR", v },
                mensagem: this.resumo(v),
              });
            }
            if (/^(?:evento|agendar|agenda|compromisso)\s*:/i.test(t)) {
              const e = portas.evento(t.replace(/^[^:]+:\s*/, ""));
              if (
                e &&
                e !== "sem_data_hora" &&
                new Date(e.inicio) > new Date()
              ) {
                const v = {
                  acao: "evento.criar",
                  titulo: e.titulo,
                  quando: new Date(e.inicio).toISOString(),
                  duracao: e.fim
                    ? Math.max(
                        1,
                        Math.round(
                          (new Date(e.fim).getTime() -
                            new Date(e.inicio).getTime()) /
                            60000,
                        ),
                      )
                    : 30,
                  recorrencia: e.recorrencia || null,
                  recorrenciaFim: e.recorrenciaFim
                    ? diaSaoPaulo(new Date(e.recorrenciaFim))
                    : null,
                  diaTodo: e.diaTodo,
                };
                return passo({
                  estado: { fase: "CONFIRMAR", v },
                  mensagem: this.resumo(v),
                });
              }
              return form("evento.criar");
            }
            if (/^gasto\s*:/i.test(t)) {
              const g = portas.gasto(t);
              if (g && g !== "sem_valor") {
                const v = {
                  acao: "gasto.criar",
                  ...g,
                  valor: Number(g.valor),
                  dataGasto: new Date(g.dataGasto).toISOString().slice(0, 10),
                };
                return passo({
                  estado: { fase: "CONFIRMAR", v },
                  mensagem: this.resumo(v),
                });
              }
              return form("gasto.criar");
            }
            if (/^tarefa\s*:/i.test(t)) {
              const tarefa = dataTarefa(
                t.replace(/^tarefa\s*:\s*/i, ""),
                new Date(),
              );
              if (tarefa) {
                const v = {
                  acao: "tarefa.criar",
                  titulo: tarefa.titulo,
                  data: tarefa.dia,
                };
                return passo({
                  estado: { fase: "CONFIRMAR", v },
                  mensagem: this.resumo(v),
                });
              }
              return form("tarefa.criar");
            }
            if (
              /^(?:excluir|apagar|remover|cancelar)\s+(?:o\s+|a\s+)?(?:compromisso|evento|nota|anotacao)\b/.test(
                n,
              )
            )
              return passo(
                await this.lista(tx, u, {
                  grupo: /nota|anotacao/.test(n) ? "nota" : "evento",
                  pagina: 0,
                }),
              );
            if (
              /^(?:apagar|apaga|desfazer|errei)$/.test(n) ||
              /^(?:corrig\w*\s+(?:o\s+)?ultimo|foi no)\b/.test(n)
            )
              return passo(
                await this.lista(tx, u, { grupo: "gasto", pagina: 0 }),
              );
            if (/^(?:concluir|reabrir) tarefa\b/.test(n))
              return passo(
                await this.lista(tx, u, { grupo: "tarefa", pagina: 0 }),
              );
            if (
              /^(?:demanda\s+p-|(?:iniciar|concluir|reabrir|revisar|atribuir)\s+d-)/.test(
                n,
              )
            )
              return passo({
                estado: { fase: "GRUPO", v: { grupo: "projeto" } },
                mensagem:
                  "Vamos escolher pelo nome, sem precisar copiar códigos.\n\n" +
                  this.submenu("projeto", p),
              });
            if (/^(?:conta|nova conta|lancar conta)\s*[:\-]/.test(n))
              return form("conta.criar");
            const chamado = t.match(
              /^(?:chamado|abrir chamado|suporte|ticket)\s*:\s*(.+)$/is,
            );
            if (chamado) {
              const v = { acao: "chamado.criar", descricao: chamado[1] };
              if (!this.pode(p, v.acao))
                return principal("Você não tem acesso a essa ação.\n\n");
              return passo({
                estado: { fase: "CONFIRMAR", v },
                mensagem: this.resumo(v),
              });
            }
            if (
              /\d/.test(t) &&
              /\b(pix|cr[eé]dito|d[eé]bito|dinheiro|boleto)\b/i.test(t)
            ) {
              const g = portas.gasto("Gasto: " + t);
              if (g && g !== "sem_valor") {
                const v = {
                  acao: "gasto.criar",
                  ...g,
                  valor: Number(g.valor),
                  dataGasto: new Date(g.dataGasto).toISOString().slice(0, 10),
                };
                return passo({
                  estado: { fase: "CONFIRMAR", v },
                  mensagem: this.resumo(v),
                });
              }
            }
            return null;
          }
          if (state.fase === "REVISAR")
            return principal(
              "Não vou repetir a operação para evitar duplicidade. Confira sua lista antes de tentar novamente.\n\n",
            );
          if (state.fase === "MENU") {
            const g: any = {
              "1": "evento",
              "2": "nota",
              "3": "gasto",
              "4": "projeto",
              "5": "tarefa",
            };
            const permitido: any = {
              evento: "agenda:ver",
              nota: "keep:ver",
              gasto: "gastos:ver",
              projeto: "projetos:ver",
              tarefa: "keep:ver",
            };
            if (
              g[t] &&
              (permissao(p, permitido[g[t]]) ||
                (g[t] === "gasto" && permissao(p, "financeiro:ver")))
            ) {
              const contexto = g[t] === "projeto" ? "EMPRESA" : "PESSOAL";
              await tx.$executeRaw`INSERT INTO whatsapp_contextos(user_id,organization_id,instancia,conversa,contexto) VALUES (${u.id},${u.organizationId},${instancia},${conversa},${contexto}) ON CONFLICT(user_id,instancia,conversa) DO UPDATE SET organization_id=EXCLUDED.organization_id,contexto=EXCLUDED.contexto,atualizado_em=CURRENT_TIMESTAMP`;
              await tx.$executeRaw`DELETE FROM whatsapp_previas WHERE user_id=${u.id} AND instancia=${instancia} AND conversa=${conversa}`;
              return passo({
                estado: { fase: "GRUPO", v: { grupo: g[t] } },
                mensagem: this.submenu(g[t], p),
              });
            }
            if (t === "6")
              return passo({
                estado: { fase: "MAIS", v: {} },
                mensagem:
                  "Mais opções:\n*1* — Ver meu dia\n*2* — Pedir ajuda à equipe\n*3* — Consultar meus pedidos de ajuda\n*4* — Contas a pagar da empresa\n*5* — Procurar uma orientação\n*6* — O que posso fazer por aqui?" +
                  NAV,
              });
            return principal("Escolha um número que aparece abaixo.\n\n");
          }
          if (state.fase === "GRUPO") {
            if (t === "1") return form(state.v.grupo + ".criar");
            if (t === "2")
              return passo(
                await this.lista(tx, u, { grupo: state.v.grupo, pagina: 0 }),
              );
            if (t === "3" && state.v.grupo === "gasto") {
              externo = true;
              await portas.outro("gastos.resumo", {});
              return principal();
            }
            return salvar(state, this.submenu(state.v.grupo, p));
          }
          if (state.fase === "MAIS") {
            if (t === "1") {
              externo = true;
              await portas.outro("dia", {});
              return principal();
            }
            if (t === "2") return form("chamado.criar");
            if (t === "3" && permissao(p, "chamados:ver")) {
              externo = true;
              await portas.outro("chamados.lista", {});
              return principal();
            }
            if (t === "4" && permissao(p, "financeiro:ver"))
              return passo({
                estado: { fase: "CONTAS", v: {} },
                mensagem:
                  "*Contas a pagar da empresa*\n*1* — Anotar conta\n*2* — Ver contas\n*3* — Ver resumo" +
                  NAV,
              });
            if (t === "5" && permissao(p, "conhecimento:ver"))
              return passo({
                estado: { fase: "BUSCA", v: {} },
                mensagem:
                  "O que você quer saber? Escreva algumas palavras. Exemplo: *como criar um projeto*." +
                  NAV,
              });
            if (t === "6")
              return principal(
                "Aqui eu ajudo com compromissos, anotações, gastos, projetos e tarefas. Também consulto orientações e pedidos de ajuda, conforme seu acesso.\n\nNo site você encontra as opções avançadas: anexos, compartilhamentos, quadro completo, relatórios detalhados e configurações. Acesse *https://www.orkiestri.com/login*.\n\n",
              );
            return principal(
              "Essa opção não está disponível para sua conta.\n\n",
            );
          }
          if (state.fase === "CONTAS") {
            if (t === "1") return form("conta.criar");
            if (t === "2" || t === "3") {
              externo = true;
              await portas.outro(
                t === "2" ? "contas.lista" : "contas.resumo",
                {},
              );
              return principal();
            }
          }
          if (state.fase === "BUSCA") {
            if (!permissao(p, "conhecimento:ver"))
              return principal("Seu acesso mudou. Escolha outra opção.\n\n");
            if (t.length < 2 || t.length > 120)
              return salvar(
                state,
                "Escreva entre 2 e 120 caracteres para eu procurar." + NAV,
              );
            externo = true;
            await portas.outro("buscar", { texto: t });
            return principal();
          }
          if (state.fase === "LISTA") {
            if (t === "8" && state.v.mais)
              return passo(
                await this.lista(tx, u, {
                  ...state.v,
                  pagina: (state.v.pagina || 0) + 1,
                }),
                false,
              );
            if (t === "7" && state.v.pagina)
              return passo(
                await this.lista(tx, u, {
                  ...state.v,
                  pagina: state.v.pagina - 1,
                }),
                false,
              );
            if (t === "6" && state.v.grupo === "pessoa") {
              const v = {
                ...state.v,
                assigneeId: null,
                pessoaNome: "Sem responsável",
                indice: state.v.indice + 1,
              };
              return passo(
                v.corrigindo
                  ? {
                      estado: { fase: "CONFIRMAR", v },
                      mensagem: this.resumo(v),
                    }
                  : await this.perguntar(tx, u, v),
              );
            }
            const item = /^[1-5]$/.test(t)
              ? state.v.itens[Number(t) - 1]
              : null;
            if (!item)
              return salvar(
                state,
                "Escolha um número desta página, ou escreva *voltar*." + NAV,
              );
            if (state.v.grupo === "pessoa") {
              const v = {
                ...state.v,
                assigneeId: item.id,
                pessoaNome: item.nome,
                indice: state.v.indice + 1,
              };
              return passo(
                v.corrigindo
                  ? {
                      estado: { fase: "CONFIRMAR", v },
                      mensagem: this.resumo(v),
                    }
                  : await this.perguntar(tx, u, v),
              );
            }
            const r = item.dados,
              grupo = state.v.grupo;
            const v: any = {
              ...r,
              grupo,
              id: item.id,
              versao: item.versao,
              titulo: r.titulo,
              projectId: grupo === "projeto" ? item.id : state.v.projectId,
              projectNome:
                grupo === "projeto" ? item.nome : state.v.projectNome,
              taskId: grupo === "demanda" ? item.id : undefined,
            };
            if (grupo === "evento") {
              v.quando = r.inicio;
              v.duracao = r.fim
                ? Math.max(
                    1,
                    Math.round(
                      (Date.parse(r.fim) - Date.parse(r.inicio)) / 60000,
                    ),
                  )
                : 30;
              v.serie = !!r.recorrencia;
            }
            if (grupo === "gasto") v.dataGasto = r.dataGasto.slice(0, 10);
            if (grupo === "tarefa") {
              v.data = r.data.slice(0, 10);
              v.originalPersonal = {
                titulo: r.titulo,
                data: r.data,
                concluido: r.concluido,
              };
            }
            if (grupo === "projeto")
              v.dataFim = r.dataFim?.slice(0, 10) || null;
            if (grupo === "demanda") {
              v.dataVencimento = r.dataVencimento?.slice(0, 10) || null;
              v.pessoaNome = r.assignee?.nome || "Sem responsável";
            }
            let menu =
              grupo === "projeto"
                ? "*1* — Ver tarefas\n" +
                  (this.pode(p, "demanda.criar")
                    ? "*2* — Criar tarefa\n"
                    : "") +
                  (this.pode(p, "projeto.editar")
                    ? "*3* — Alterar projeto\n"
                    : "") +
                  (this.pode(p, "projeto.excluir")
                    ? "*4* — Excluir projeto"
                    : "")
                : grupo === "demanda"
                  ? (this.pode(p, "demanda.editar")
                      ? "*1* — Alterar ou escolher responsável\n"
                      : "") +
                    (this.pode(p, "demanda.status")
                      ? "*2* — Iniciar\n*3* — Concluir\n*4* — Reabrir\n"
                      : "") +
                    (this.pode(p, "demanda.excluir") ? "*5* — Excluir" : "")
                  : grupo === "tarefa"
                    ? (this.pode(p, "tarefa.editar")
                        ? "*1* — Alterar\n*2* — Concluir\n*3* — Reabrir\n"
                        : "") +
                      (this.pode(p, "tarefa.excluir") ? "*4* — Excluir" : "")
                    : (this.pode(p, grupo + ".editar")
                        ? "*1* — Alterar\n"
                        : "") +
                      (this.pode(p, grupo + ".excluir") ? "*2* — Excluir" : "");
            if(grupo==='nota' && r.tipo!=='TEXTO')menu='Esta anotação é uma lista com caixas de seleção. Para editar ou marcar os itens, abra Anotações no site: *https://www.orkiestri.com/login*.\n'+(this.pode(p,'nota.excluir')?'*2* — Mover para a lixeira':'');
            return passo({
              estado: { fase: "ITEM", v },
              mensagem:
                `*${item.nome}*${grupo === "nota" ? "\n" + String(r.conteudo || "").slice(0, 2000) : ""}\n\n${menu}` +
                NAV,
            });
          }
          if (state.fase === "ITEM") {
            const v = { ...state.v };
            if(v.grupo==='nota' && v.tipo!=='TEXTO' && t==='1')return salvar(state,'Para editar os itens dessa lista, abra Anotações no site: *https://www.orkiestri.com/login*.'+NAV);
            let acao = "";
            if (v.grupo === "projeto") {
              if (t === "1")
                return passo(
                  await this.lista(tx, u, {
                    grupo: "demanda",
                    projectId: v.id,
                    projectNome: v.titulo,
                    pagina: 0,
                  }),
                );
              if (t === "2")
                return form("demanda.criar", {
                  projectId: v.id,
                  projectNome: v.titulo,
                });
              if (t === "3") acao = "projeto.editar";
              if (t === "4") acao = "projeto.excluir";
            } else if (v.grupo === "demanda") {
              if (t === "1") acao = "demanda.editar";
              if (["2", "3", "4"].includes(t)) {
                acao = "demanda.status";
                v.status = (
                  {
                    "2": "EM_ANDAMENTO",
                    "3": "CONCLUIDA",
                    "4": "A_FAZER",
                  } as any
                )[t];
              }
              if (t === "5") acao = "demanda.excluir";
            } else if (v.grupo === "tarefa") {
              if (t === "1") acao = "tarefa.editar";
              if (t === "2" || t === "3") {
                acao = "tarefa.status";
                v.concluido = t === "2";
              }
              if (t === "4") acao = "tarefa.excluir";
            } else {
              if (t === "1") acao = v.grupo + ".editar";
              if (t === "2") acao = v.grupo + ".excluir";
            }
            if (!acao)
              return salvar(
                state,
                "Escolha uma das opções mostradas, ou escreva *voltar*." + NAV,
              );
            if (!this.pode(p, acao))
              return principal(
                "Seu acesso não permite essa alteração. Nada foi modificado.\n\n",
              );
            v.acao = acao;
            if (acao.endsWith(".editar"))
              return passo({
                estado: { fase: "CORRIGIR", v },
                mensagem:
                  "O que você quer alterar?\n" +
                  this.campos(v)
                    .map((c, i) => `*${i + 1}* — ${c.nome}`)
                    .join("\n") +
                  NAV,
              });
            return passo({
              estado: { fase: "CONFIRMAR", v },
              mensagem: this.resumo(v),
            });
          }
          if (state.fase === "CORRIGIR") {
            const i = Number(t) - 1;
            if (!/^\d$/.test(t) || !this.campos(state.v)[i])
              return salvar(
                state,
                "Escolha o número da informação que deseja corrigir." + NAV,
              );
            return passo(
              await this.perguntar(tx, u, {
                ...state.v,
                indice: i,
                corrigindo: true,
              }),
            );
          }
          if (state.fase === "FORM") {
            const v = { ...state.v },
              campo = this.campos(v)[v.indice || 0];
            if (
              v.acao === "projeto.editar" &&
              campo.key === "dataFim" &&
              v.dataFim &&
              n === "pular"
            )
              return salvar(
                state,
                "Para remover o prazo de um projeto, abra o projeto no site. Por aqui você pode informar uma nova data ou enviar *manter*." +
                  NAV,
              );
            const valid =
              n === "manter" && v[campo.key] != null
                ? { valor: v[campo.key] }
                : validarCampo(campo, t, portas.evento);
            if (valid.erro)
              return salvar(state, valid.erro + "\n\n" + campo.pergunta + NAV);
            if (
              campo.key === "recorrenciaFim" &&
              valid.valor &&
              valid.valor < diaSaoPaulo(new Date(v.quando))
            )
              return salvar(
                state,
                "O último dia não pode vir antes do primeiro compromisso. Informe outra data ou envie *pular*." +
                  NAV,
              );
            v[campo.key] = valid.valor;
            if (campo.key === "formaPagamento" && valid.valor !== "CREDITO")
              v.parcelas = 1;
            v.indice = (v.indice || 0) + 1;
            return passo(
              v.corrigindo
                ? { estado: { fase: "CONFIRMAR", v }, mensagem: this.resumo(v) }
                : await this.perguntar(tx, u, v),
            );
          }
          if (state.fase === "CONFIRMAR") {
            if (t === "2" || n === "corrigir") {
              if (
                !this.campos(state.v).length ||
                state.v.acao.endsWith(".excluir")
              )
                return principal(
                  "Você pode escolher novamente o item correto. Nada foi alterado.\n\n",
                );
              return passo({
                estado: { fase: "CORRIGIR", v: state.v },
                mensagem:
                  "Qual informação quer corrigir?\n" +
                  this.campos(state.v)
                    .map((c, i) => `*${i + 1}* — ${c.nome}`)
                    .join("\n") +
                  NAV,
              });
            }
            if (!/^(1|sim|confirmar|confirmo)$/.test(n))
              return salvar(state, this.resumo(state.v));
            if (!this.pode(p, state.v.acao))
              return principal(
                "Seu acesso mudou. Nada foi alterado. Escolha outra opção.\n\n",
              );
            gravando = true;
            await antesDeEfeito();
            const r = await this.executar(tx, u, state.v, portas);
            eventoSync = r.sync;
            externo = !!r.externo;
            acaoUtil("GUIADO_" + state.v.acao.toUpperCase().replace(".", "_"));
            return principal("✅ " + r.mensagem + "\n\n");
          }
          return principal(
            "Vamos escolher novamente. Nada foi salvo nesta etapa.\n\n",
          );
        },
        { timeout: 30000 },
      );
      if (resultado === null) return false;
      if (eventoSync) {
        if (eventoSync.tipo === "excluir")
          await this.writeback.onEventDeleted(eventoSync.snap).catch(() => {});
        else
          await (
            eventoSync.tipo === "criar"
              ? this.writeback.onEventCreated(eventoSync.id)
              : this.writeback.onEventUpdated(eventoSync.id)
          ).catch(() => {});
      }
      await this.wa.sendToJid(conversa, resultado, instancia);
      return true;
    } catch {
      if (gravando || externo)
        await this.prisma
          .$executeRaw`UPDATE whatsapp_inicio SET etapa='GUIA_REVISAR',dados=${JSON.stringify({ fase: "REVISAR", v: {} })}::jsonb WHERE user_id=${u.id} AND instancia=${instancia} AND conversa=${conversa}`;
      await this.wa.sendToJid(
        conversa,
        gravando || externo
          ? "Não consegui confirmar o resultado. Para evitar repetir, consulte sua lista pelo *menu* antes de tentar novamente."
          : "Não consegui continuar agora. Suas respostas foram preservadas. Tente novamente ou escreva *menu*.",
        instancia,
      );
      if (gravando || externo)
        throw new Error("Operação guiada requer revisão");
      return true;
    }
  }
  private async executar(
    tx: any,
    u: User,
    v: any,
    portas: PortasGuia,
  ): Promise<any> {
    const base = { userId: u.id, organizationId: u.organizationId },
      m = v.acao.split(".")[0],
      op = v.acao.split(".")[1];
    const model: any = {
      evento: "event",
      nota: "note",
      gasto: "gasto",
      tarefa: "dailyTask",
    };
    let atual: any = null;
    if (model[m] && op !== "criar") {
      atual = await tx[model[m]].findFirst({
        where: {
          id: v.id,
          ...(m === "tarefa"
            ? {
                userId: u.id,
                checklistItemId: null,
                ...(v.originalPersonal
                  ? {
                      titulo: v.originalPersonal.titulo,
                      data: new Date(v.originalPersonal.data),
                      concluido: v.originalPersonal.concluido,
                    }
                  : {}),
              }
            : base),
          ...(m === "nota" ? { lixeira: false } : {}),
          ...(m === "evento" ? { externalCancelled: false } : {}),
        },
      });
      if (
        !atual ||
        (v.versao && atual.atualizadoEm?.toISOString() !== v.versao)
      )
        throw new Error("Registro mudou");
    }
    if (m === "projeto" || m === "demanda") {
      await this.equipe.executarGuiado(u, v.acao, v);
      return {
        mensagem:
          "Pronto! A alteração foi salva em " +
          (m === "demanda" ? "tarefas do projeto." : "projetos."),
      };
    }
    if (m === "chamado") {
      await portas.outro(v.acao, v);
      return { mensagem: "Solicitação registrada.", externo: true };
    }
    if (m === "conta") {
      await tx.contaPagar.create({
        data: {
          id: randomUUID(),
          organizationId: u.organizationId,
          fornecedorNome: v.descricao,
          numero: "WA-" + randomUUID().slice(0, 12).toUpperCase(),
          tipo: "MANUAL",
          valorOriginal: Number(v.valor),
          dataVencto: new Date(v.dataVencto + "T12:00:00Z"),
          dataVenctoReal: new Date(v.dataVencto + "T12:00:00Z"),
          dataEmissao: new Date(),
        },
      });
      return { mensagem: "Conta a pagar registrada na sua empresa." };
    }
    const data: any = {};
    if (m === "evento") {
      if (op === "excluir") {
        const r = await tx.event.deleteMany({
          where: { id: atual.id, ...base, atualizadoEm: atual.atualizadoEm },
        });
        if (!r.count) throw new Error("Compromisso alterado");
        return {
          mensagem: "Compromisso excluído.",
          sync: {
            tipo: "excluir",
            snap: {
              externalId: atual.externalId,
              connectionId: atual.connectionId,
              userId: u.id,
            },
          },
        };
      }
      const inicio = new Date(v.quando);
      if (!Number.isFinite(inicio.getTime()) || inicio <= new Date())
        throw new Error("Horário passou");
      Object.assign(data, {
        titulo: v.titulo,
        inicio,
        fim: v.diaTodo
          ? null
          : new Date(inicio.getTime() + (v.duracao || 30) * 60000),
        diaTodo: !!v.diaTodo,
        ...(op === "criar"
          ? {
              tipo: "COMPROMISSO",
              cor: "#22d3ee",
              recorrencia: v.recorrencia || null,
              recorrenciaFim: v.recorrenciaFim
                ? new Date(
                    instanteSaoPaulo(somarDias(v.recorrenciaFim, 1)).getTime() -
                      1,
                  )
                : null,
              criadoPorId: u.id,
            }
          : {}),
      });
    }
    if (m === "nota") {
      Object.assign(
        data,
        op === "excluir"
          ? { lixeira: true }
          : {
              titulo: String(v.conteudo).split("\n")[0].slice(0, 80),
              conteudo: v.conteudo,
            },
      );
      if (op !== "excluir" && atual && atual.tipo !== "TEXTO")
        throw new Error(
          "Use o site para editar uma lista com caixas de seleção",
        );
    }
    if (m === "gasto") {
      if (op === "excluir") {
        const r = await tx.gasto.deleteMany({
          where: { id: atual.id, ...base, atualizadoEm: atual.atualizadoEm },
        });
        if (!r.count) throw new Error("Gasto alterado");
        return { mensagem: "Gasto excluído." };
      }
      Object.assign(data, {
        descricao: v.descricao,
        valor: Number(v.valor),
        formaPagamento: v.formaPagamento,
        parcelas: v.formaPagamento === "CREDITO" ? v.parcelas || 1 : 1,
        dataGasto: new Date(v.dataGasto + "T12:00:00Z"),
      });
      data.valorParcela =
        data.parcelas > 1
          ? Math.round((data.valor / data.parcelas) * 100) / 100
          : null;
    }
    if (m === "tarefa") {
      if (op === "excluir") {
        const r = await tx.dailyTask.deleteMany({
          where: {
            id: atual.id,
            userId: u.id,
            checklistItemId: null,
            titulo: atual.titulo,
            concluido: atual.concluido,
            data: atual.data,
          },
        });
        if (!r.count) throw new Error("Tarefa alterada");
        return { mensagem: "Tarefa pessoal excluída." };
      }
      Object.assign(
        data,
        op === "status"
          ? { concluido: v.concluido }
          : {
              titulo: v.titulo,
              data: new Date(v.data + "T00:00:00Z"),
              ...(op === "criar" ? { tipo: "TAREFA" } : {}),
            },
      );
    }
    let salvo: any;
    if (op === "criar")
      salvo = await tx[model[m]].create({
        data: { ...data, ...(m === "tarefa" ? { userId: u.id } : base) },
      });
    else {
      const result = await tx[model[m]].updateMany({
        where: {
          id: atual.id,
          ...(m === "tarefa"
            ? {
                userId: u.id,
                checklistItemId: null,
                titulo: atual.titulo,
                concluido: atual.concluido,
                data: atual.data,
              }
            : base),
          ...(v.versao ? { atualizadoEm: new Date(v.versao) } : {}),
        },
        data,
      });
      if (!result.count)
        throw new Error("Registro alterado durante a conversa");
      salvo = { id: atual.id };
    }
    return {
      mensagem:
        m === "nota"
          ? op === "excluir"
            ? "Anotação movida para a lixeira. Você pode recuperá-la no site."
            : "Anotação salva."
          : m === "gasto"
            ? "Gasto salvo em Meus gastos."
            : m === "tarefa"
              ? op === "status"
                ? v.concluido
                  ? "Tarefa concluída."
                  : "Tarefa reaberta."
                : "Tarefa pessoal salva."
              : "Compromisso salvo em sua agenda.",
      ...(m === "evento"
        ? { sync: { id: salvo.id, tipo: op === "criar" ? "criar" : "editar" } }
        : {}),
    };
  }
}
