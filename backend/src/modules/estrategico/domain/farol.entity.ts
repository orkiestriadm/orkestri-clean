import {
  naturezaDe, oportunidadeEmEstruturacao, classificacaoGeral, diasEntre, DIMENSOES_RISCO,
} from "./caso.entity";

/**
 * Farol estratégico.
 *
 * O plano separa STATUS OPERACIONAL (a etapa) de SAÚDE ESTRATÉGICA (o farol), e
 * exige que o farol não seja só digitado. Este é o cálculo; o override manual
 * existe, mas fica registrado com justificativa e nunca apaga a sugestão — a
 * tela mostra as duas quando divergem.
 *
 *   verde    situação controlada, avanço dentro do esperado
 *   amarelo  dependência, atraso potencial ou necessidade de acompanhamento
 *   vermelho risco relevante — financeiro, jurídico, regulatório ou de prazo
 *   cinza    suspenso (ou cancelado)
 *   azul     oportunidade ainda em estruturação
 *
 * Todo motivo sai em texto. "Vermelho" sem o porquê é a mesma caixa-preta que
 * a cor de fundo da planilha.
 */

export type Farol = "verde" | "amarelo" | "vermelho" | "cinza" | "azul";
export const FAROIS: Farol[] = ["vermelho", "amarelo", "azul", "verde", "cinza"];

export const ROTULO_FAROL: Record<Farol, string> = {
  verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho", cinza: "Cinza", azul: "Azul",
};

export type MotivoFarol = { nivel: "vermelho" | "amarelo"; codigo: string; texto: string };

export type ParametrosFarol = {
  diasAtencaoSemMovimento: number;
  diasCriticoSemMovimento: number;
  diasAtrasoCritico: number;
  diasDependenciaAtencao: number;
  limiarValorRelevante: number | null;
};

export const PARAMETROS_PADRAO: ParametrosFarol = {
  diasAtencaoSemMovimento: 30,
  diasCriticoSemMovimento: 90,
  diasAtrasoCritico: 15,
  diasDependenciaAtencao: 30,
  limiarValorRelevante: null,
};

export type EntradaFarol = {
  tipo: string;
  etapa: string;
  estagioOportunidade?: string | null;
  prioridade: string;
  proximaAcao?: string | null;
  proximaAcaoPrazo?: Date | string | null;
  prazoFinal?: Date | string | null;
  ultimaMovimentacaoEm?: Date | string | null;
  probabilidade?: number | null;
  impacto?: number | null;
  riscoFinanceiro?: number | null;
  riscoJuridico?: number | null;
  riscoRegulatorio?: number | null;
  riscoOperacional?: number | null;
  riscoPrazo?: number | null;
  valorEmRisco?: number | string | null;
  /** Dependências ATIVAS (não resolvidas). */
  dependencias?: { nome: string; desde?: Date | string | null }[];
  tarefasVencidas?: number;
};

export type ResultadoFarol = { farol: Farol; motivos: MotivoFarol[] };

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function calcularFarol(
  c: EntradaFarol,
  parametros: ParametrosFarol = PARAMETROS_PADRAO,
  hoje: Date = new Date(),
): ResultadoFarol {
  const natureza = naturezaDe(c.etapa);
  if (natureza === "suspensa") {
    return { farol: "cinza", motivos: [] };
  }
  if (natureza === "encerrada") {
    return { farol: c.etapa === "cancelado" ? "cinza" : "verde", motivos: [] };
  }

  const motivos: MotivoFarol[] = [];
  const vermelho = (codigo: string, texto: string) => motivos.push({ nivel: "vermelho", codigo, texto });
  const amarelo = (codigo: string, texto: string) => motivos.push({ nivel: "amarelo", codigo, texto });
  const prioridadeAlta = c.prioridade === "alta" || c.prioridade === "critica";

  // ── Próxima ação ────────────────────────────────────────────────────────
  const temAcao = !!c.proximaAcao?.trim();
  if (!temAcao) {
    if (c.prioridade === "critica") vermelho("sem_acao_critico", "Assunto crítico sem próxima ação definida");
    else amarelo("sem_acao", "Assunto sem próxima ação definida");
  } else if (!c.proximaAcaoPrazo) {
    amarelo("acao_sem_prazo", "Próxima ação sem prazo");
  } else {
    const dias = diasEntre(hoje, c.proximaAcaoPrazo);
    if (dias < 0) {
      const atraso = -dias;
      if (atraso >= parametros.diasAtrasoCritico || prioridadeAlta) {
        vermelho("acao_vencida", `Próxima ação vencida há ${plural(atraso, "dia", "dias")}`);
      } else {
        amarelo("acao_vencida", `Próxima ação vencida há ${plural(atraso, "dia", "dias")}`);
      }
    } else if (dias <= 7) {
      amarelo("acao_vencendo", dias === 0 ? "Próxima ação vence hoje" : `Próxima ação vence em ${plural(dias, "dia", "dias")}`);
    }
  }

  // ── Prazo final do assunto ──────────────────────────────────────────────
  if (c.prazoFinal) {
    const dias = diasEntre(hoje, c.prazoFinal);
    if (dias < 0) vermelho("prazo_final_vencido", `Prazo final vencido há ${plural(-dias, "dia", "dias")}`);
    else if (dias <= 15) amarelo("prazo_final_proximo", `Prazo final em ${plural(dias, "dia", "dias")}`);
  }

  // ── Movimentação ─────────────────────────────────────────────────────────
  if (!c.ultimaMovimentacaoEm) {
    amarelo("sem_movimentacao", "Nenhum andamento datado registrado");
  } else {
    const parado = diasEntre(c.ultimaMovimentacaoEm, hoje);
    if (parado >= parametros.diasCriticoSemMovimento) {
      vermelho("parado", `Sem movimentação há ${plural(parado, "dia", "dias")}`);
    } else if (parado >= parametros.diasAtencaoSemMovimento) {
      amarelo("parado", `Sem movimentação há ${plural(parado, "dia", "dias")}`);
    }
  }

  // ── Dependências ─────────────────────────────────────────────────────────
  for (const d of c.dependencias ?? []) {
    if (!d.desde) continue;
    const dias = diasEntre(d.desde, hoje);
    if (dias >= parametros.diasDependenciaAtencao) {
      amarelo("dependencia", `Aguardando ${d.nome} há ${plural(dias, "dia", "dias")}`);
    }
  }

  // ── Risco ────────────────────────────────────────────────────────────────
  const nivel = classificacaoGeral(c);
  if (nivel === "critico") vermelho("risco_critico", "Risco classificado como crítico");
  else if (nivel === "alto") amarelo("risco_alto", "Risco classificado como alto");

  for (const d of DIMENSOES_RISCO) {
    if ((c as any)[d.campo] === 5) vermelho(`risco_${d.campo}`, `Risco ${d.rotulo.toLowerCase()} crítico`);
  }

  // ── Valor ────────────────────────────────────────────────────────────────
  const emRisco = c.valorEmRisco == null ? null : Number(c.valorEmRisco);
  if (
    parametros.limiarValorRelevante != null && emRisco != null &&
    emRisco >= parametros.limiarValorRelevante && (nivel === "alto" || nivel === "critico")
  ) {
    vermelho("valor_relevante_em_risco", "Valor em risco acima do limiar relevante, com risco alto");
  }

  if ((c.tarefasVencidas ?? 0) > 0) {
    amarelo("tarefas_vencidas", `${plural(c.tarefasVencidas!, "tarefa vencida", "tarefas vencidas")}`);
  }

  // Um mesmo código não aparece duas vezes (ex.: duas dimensões críticas somam
  // motivos distintos, mas "risco crítico" não se repete).
  const unicos = motivos.filter((m, i) => motivos.findIndex(x => x.codigo === m.codigo && x.texto === m.texto) === i);

  if (unicos.some(m => m.nivel === "vermelho")) return { farol: "vermelho", motivos: ordenar(unicos) };
  if (oportunidadeEmEstruturacao(c.tipo, c.estagioOportunidade, c.etapa)) return { farol: "azul", motivos: ordenar(unicos) };
  if (unicos.length) return { farol: "amarelo", motivos: ordenar(unicos) };
  return { farol: "verde", motivos: [] };
}

function ordenar(m: MotivoFarol[]): MotivoFarol[] {
  return [...m].sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "vermelho" ? -1 : 1));
}

export function farolEfetivo(calculado: string, manual?: string | null): Farol {
  return ((manual || calculado) as Farol) ?? "verde";
}
