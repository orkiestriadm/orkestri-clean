/**
 * Checklist de admissão e desligamento — regras puras.
 *
 * O módulo sabia registrar a admissão; não sabia responder "o que falta para
 * essa pessoa entrar?". Cada item — documento, crachá, acesso, exame,
 * integração — vivia na cabeça de alguém ou numa planilha à parte.
 *
 * O que dá valor aqui é o PROGRESSO com nome: não "70%", e sim quais itens
 * faltam, de quem é cada um e qual já passou do prazo.
 */

import { diaLocal } from "../../../common/datas";

export const EVENTOS_CHECKLIST = ["admissao", "desligamento"] as const;
export type EventoChecklist = (typeof EVENTOS_CHECKLIST)[number];

export const RESPONSAVEIS = ["rh", "gestor", "colaborador"] as const;
export type Responsavel = (typeof RESPONSAVEIS)[number];

export function eventoValido(v: string): v is EventoChecklist {
  return (EVENTOS_CHECKLIST as readonly string[]).includes(v);
}

export function responsavelValido(v: string): v is Responsavel {
  return (RESPONSAVEIS as readonly string[]).includes(v);
}

export type ItemChecklist = {
  id: string;
  ordem: number;
  titulo: string;
  obrigatorio: boolean;
  responsavel: string;
  prazoDias?: number | null;
  concluidoEm?: Date | null;
};

export type SituacaoItem = "concluido" | "pendente" | "atrasado";

export type ItemAvaliado = ItemChecklist & {
  situacao: SituacaoItem;
  /** Negativo quando já passou. Nulo quando o item não tem prazo. */
  diasParaPrazo: number | null;
};

export type ProgressoChecklist = {
  itens: ItemAvaliado[];
  total: number;
  concluidos: number;
  /** 0–100 sobre os itens OBRIGATÓRIOS. */
  percentual: number;
  /** Verdadeiro quando nenhum obrigatório está em aberto. */
  completo: boolean;
  atrasados: number;
};

/**
 * Só o dia importa: prazo não é hora do dia.
 *
 * A conta partia dos componentes LOCAIS, e `referencia` vem de coluna DATE
 * (meia-noite UTC): em UTC-3 todo prazo recuava um dia, e item que vencia hoje
 * já aparecia atrasado. Ver a nota em common/datas.ts.
 */
function dia(d: Date): number {
  return diaLocal(d).getTime();
}

/**
 * Avalia um item contra o prazo, contado a partir da data do evento.
 *
 * `referencia` é a data da admissão ou do desligamento — não a de abertura do
 * checklist. Um checklist aberto com atraso não pode dar prazo extra: o relógio
 * do exame admissional começou quando a pessoa foi admitida.
 */
export function avaliarItem(
  item: ItemChecklist,
  referencia: Date | null,
  hoje: Date = new Date(),
): ItemAvaliado {
  if (item.concluidoEm) {
    return { ...item, situacao: "concluido", diasParaPrazo: null };
  }

  if (item.prazoDias === null || item.prazoDias === undefined || !referencia) {
    // Sem prazo definido — ou sem data de referência — não há como chamar de
    // atrasado. Pendente é o que se pode afirmar.
    return { ...item, situacao: "pendente", diasParaPrazo: null };
  }

  const limite = new Date(referencia);
  limite.setDate(limite.getDate() + item.prazoDias);
  const dias = Math.round((dia(limite) - dia(hoje)) / 86_400_000);

  return {
    ...item,
    situacao: dias < 0 ? "atrasado" : "pendente",
    diasParaPrazo: dias,
  };
}

/**
 * Progresso do checklist.
 *
 * O percentual conta só os OBRIGATÓRIOS: item opcional que ninguém fez não
 * pode impedir uma admissão de aparecer como concluída, e o contrário — contar
 * tudo — faria a barra nunca chegar a 100 em checklists com extras.
 *
 * Checklist sem item obrigatório nenhum vale 100: não é um checklist
 * impossível, é um checklist sem exigência.
 */
export function calcularProgresso(
  itens: ItemChecklist[],
  referencia: Date | null,
  hoje: Date = new Date(),
): ProgressoChecklist {
  const avaliados = itens
    .map(i => avaliarItem(i, referencia, hoje))
    .sort((a, b) => a.ordem - b.ordem);

  const obrigatorios = avaliados.filter(i => i.obrigatorio);
  const feitos = obrigatorios.filter(i => i.situacao === "concluido").length;

  return {
    itens: avaliados,
    total: avaliados.length,
    concluidos: avaliados.filter(i => i.situacao === "concluido").length,
    percentual: obrigatorios.length === 0 ? 100 : Math.round((feitos / obrigatorios.length) * 100),
    completo: feitos === obrigatorios.length,
    atrasados: avaliados.filter(i => i.situacao === "atrasado").length,
  };
}

/** Reindexa em 1..N — buraco na ordem faz a tela dizer "item 4 de 3". */
export function reindexar<T extends { ordem: number }>(itens: T[]): T[] {
  return [...itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i, idx) => ({ ...i, ordem: idx + 1 }));
}
