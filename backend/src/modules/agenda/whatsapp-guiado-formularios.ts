import {
  diaSaoPaulo,
  instanteSaoPaulo,
  somarDias,
} from "./whatsapp-rotina-datas";
import { diaCompromisso, novaDataCompromisso } from "../notifications/evento-alerta-datas";

export const simples = (t: string) =>
  t
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\//, "");
export const NAV =
  "\n\n*Voltar* — pergunta anterior\n*Menu* — início · *0* — sair";
export type CampoGuia = {
  key: string;
  nome: string;
  pergunta: string;
  tipo: string;
  opcional?: boolean;
};
const titulo = {
  key: "titulo",
  nome: "Nome",
  pergunta: "Qual é o nome? Exemplo: *Consulta com o dentista*.",
  tipo: "titulo",
};
const descricao = {
  key: "descricao",
  nome: "Descrição",
  pergunta: "Escreva uma descrição. Se não precisar, envie *pular*.",
  tipo: "texto",
  opcional: true,
};
const exemploDia = () =>
  somarDias(diaSaoPaulo(new Date()), 1).split("-").reverse().join("/");
const prazo = (key: string): CampoGuia => ({
  key,
  nome: "Prazo",
  pergunta: `Para qual dia? Envie *amanhã* ou uma data como *${exemploDia()}*. Sem prazo? Envie *pular*.`,
  tipo: "dia",
  opcional: true,
});
export function camposGuia(acao: string): CampoGuia[] {
  if (acao.startsWith("evento."))
    return [
      titulo,
      {
        key: "quando",
        nome: "Dia e horário",
        pergunta: "Qual é o dia e o horário? Exemplo: *amanhã às 14h*.",
        tipo: "quando",
      },
      {
        key: "duracao",
        nome: "Duração",
        pergunta:
          "Quanto tempo vai durar? Envie os minutos, por exemplo *30*. Uma hora é *60*.",
        tipo: "duracao",
      },
      ...(acao === "evento.criar"
        ? [
            {
              key: "recorrencia",
              nome: "Repetição",
              pergunta:
                "Esse compromisso se repete?\n*1* — Não\n*2* — Todos os dias\n*3* — Toda semana\n*4* — Todo mês",
              tipo: "repeticao",
            },
            {
              key: "recorrenciaFim",
              nome: "Último dia da repetição",
              pergunta:
                "Até que dia deve repetir? Envie a data com dia, mês e ano. Se não tiver uma data final, envie *pular*.",
              tipo: "dia",
              opcional: true,
            },
          ]
        : []),
    ];
  if (acao.startsWith("nota."))
    return [
      {
        key: "conteudo",
        nome: "Anotação",
        pergunta: "O que você quer anotar? Pode escrever com suas palavras.",
        tipo: "texto",
      },
    ];
  if (acao.startsWith("gasto."))
    return [
      {
        key: "descricao",
        nome: "Com o que gastou",
        pergunta: "Com o que você gastou? Exemplo: *Mercado*.",
        tipo: "titulo",
      },
      {
        key: "valor",
        nome: "Valor total",
        pergunta: "Qual foi o valor total? Exemplo: *48,90*.",
        tipo: "valor",
      },
      {
        key: "formaPagamento",
        nome: "Como pagou",
        pergunta:
          "Como você pagou?\n*1* — Pix\n*2* — Cartão de crédito\n*3* — Cartão de débito\n*4* — Dinheiro\n*5* — Boleto",
        tipo: "pagamento",
      },
      {
        key: "parcelas",
        nome: "Parcelas",
        pergunta: "Em quantas parcelas? Para pagar de uma vez, envie *1*.",
        tipo: "parcelas",
      },
      {
        key: "dataGasto",
        nome: "Dia do gasto",
        pergunta: `Em qual dia você gastou? Envie *hoje*, *ontem* ou uma data como *${exemploDia()}*.`,
        tipo: "dia",
      },
    ];
  if (acao === "projeto.criar" || acao === "projeto.editar")
    return [
      {
        ...titulo,
        pergunta: "Como vai se chamar o projeto? Exemplo: *Reforma da casa*.",
      },
      descricao,
      prazo("dataFim"),
    ];
  if (acao === "demanda.criar" || acao === "demanda.editar")
    return [
      {
        ...titulo,
        pergunta:
          "O que precisa ser feito no projeto? Exemplo: *Pintar a sala*.",
      },
      descricao,
      prazo("dataVencimento"),
      {
        key: "assigneeId",
        nome: "Responsável",
        pergunta: "Quem ficará responsável? Escolha uma pessoa da lista.",
        tipo: "pessoa",
      },
    ];
  if (acao === "tarefa.criar" || acao === "tarefa.editar")
    return [
      {
        ...titulo,
        pergunta: "O que você precisa fazer? Exemplo: *Comprar pão*.",
      },
      {
        ...prazo("data"),
        opcional: false,
        pergunta:
          "Para qual dia é essa tarefa? Envie *hoje*, *amanhã* ou uma data.",
      },
    ];
  if (acao === "chamado.criar")
    return [
      {
        key: "descricao",
        nome: "Pedido de ajuda",
        pergunta: "Conte o que aconteceu e com o que precisa de ajuda.",
        tipo: "texto",
      },
    ];
  if (acao === "conta.criar")
    return [
      {
        key: "descricao",
        nome: "Conta",
        pergunta: "Qual conta precisa pagar? Exemplo: *Energia*.",
        tipo: "titulo",
      },
      {
        key: "valor",
        nome: "Valor",
        pergunta: "Qual é o valor? Exemplo: *150,00*.",
        tipo: "valor",
      },
      {
        ...prazo("dataVencto"),
        opcional: false,
        pergunta: `Em que dia a conta vence? Envie uma data, como *${exemploDia()}*.`,
      },
    ];
  return [];
}
export function diaGuia(t: string, agora = new Date()): string | null {
  const n = simples(t),
    hoje = diaSaoPaulo(agora);
  if (n === "hoje") return hoje;
  if (n === "amanha") return somarDias(hoje, 1);
  if (n === "ontem") return somarDias(hoje, -1);
  return diaCompromisso(t, agora);
}
export function validarCampo(
  c: CampoGuia,
  texto: string,
  prepararEvento: (t: string) => any,
  agora = new Date(),
): { valor?: any; erro?: string } {
  const t = texto.trim(),
    n = simples(t);
  if (c.opcional && /^(pular|nenhum|sem prazo|nao)$/.test(n))
    return { valor: null };
  if (c.tipo === "titulo" || c.tipo === "texto")
    return t.length >= 2 && t.length <= (c.tipo === "titulo" ? 120 : 2000)
      ? { valor: t }
      : {
          erro:
            c.tipo === "titulo"
              ? "Escreva um nome de 2 a 120 letras."
              : "Escreva entre 2 e 2.000 caracteres. Pode dividir uma anotação grande em duas.",
        };
  if (c.tipo === "valor") {
    if (!/^(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?$/.test(t))
      return { erro: "Envie só o valor total. Exemplo: *48,90*." };
    const numero = Number(
      t
        .replace(/^R\$\s*/i, "")
        .replace(/\.(?=\d{3}(?:\D|$))/g, "")
        .replace(",", "."),
    );
    return numero > 0 && numero < 1e12
      ? { valor: numero }
      : {
          erro: "O valor precisa ser maior que zero. Confira e envie novamente.",
        };
  }
  if (c.tipo === "pagamento") {
    const formas: any = {
      "1": "PIX",
      "2": "CREDITO",
      "3": "DEBITO",
      "4": "DINHEIRO",
      "5": "BOLETO",
      pix: "PIX",
      credito: "CREDITO",
      "cartao de credito": "CREDITO",
      debito: "DEBITO",
      "cartao de debito": "DEBITO",
      dinheiro: "DINHEIRO",
      boleto: "BOLETO",
    };
    return formas[n]
      ? { valor: formas[n] }
      : { erro: "Escolha um número de *1* a *5*, ou escreva como pagou." };
  }
  if (c.tipo === "parcelas" || c.tipo === "duracao") {
    const v = Number(t.replace(/\s*(minutos?|min)$/i, ""));
    return /^\d+(?:\s*(?:minutos?|min))?$/i.test(t) &&
      Number.isInteger(v) &&
      v >= 1 &&
      v <= (c.tipo === "parcelas" ? 120 : 10080)
      ? { valor: v }
      : {
          erro:
            c.tipo === "parcelas"
              ? "Envie o número de parcelas, de 1 a 120."
              : "Envie a duração em minutos. Exemplo: *60* para uma hora.",
        };
  }
  if (c.tipo === "dia") {
    const dia = diaGuia(t, agora);
    return dia
      ? { valor: dia }
      : {
          erro: `Não encontrei uma data válida. Tente *hoje*, *amanhã* ou *${exemploDia()}*.`,
        };
  }
  if (c.tipo === "quando") {
    const data = novaDataCompromisso(t, agora);
    return data
      ? { valor: data.toISOString() }
      : {
          erro: "Falta uma data válida e um horário no futuro. Exemplo: *amanhã às 14h*. Ainda não salvei nada.",
        };
  }
  if (c.tipo === "repeticao") {
    const r: any = {
      "1": null,
      "2": "DIARIA",
      "3": "SEMANAL",
      "4": "MENSAL",
      nao: null,
    };
    return Object.prototype.hasOwnProperty.call(r, n)
      ? { valor: r[n] }
      : { erro: "Responda *1*, *2*, *3* ou *4*." };
  }
  return { erro: "Escolha uma opção da lista." };
}
export const diaData = (dia: string) => instanteSaoPaulo(dia);
export const dataLegivel = (d: any) =>
  new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
export const diaLegivel = (dia: any) =>
  String(dia).slice(0, 10).split("-").reverse().join("/");
export const rotuloStatus = (s: string) =>
  ({
    A_FAZER: "A fazer",
    EM_ANDAMENTO: "Em andamento",
    EM_REVISAO: "Em revisão",
    CONCLUIDA: "Concluída",
    CONCLUIDO: "Concluído",
    PLANEJAMENTO: "Planejamento",
    CANCELADA: "Cancelada",
    PAUSADO: "Pausado",
    CANCELADO: "Cancelado",
  })[s] || s;
