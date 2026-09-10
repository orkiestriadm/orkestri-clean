import { tem, ESTRATEGICO_PERMISSIONS as P } from "../estrategico.permissions";
import { PARAMETROS_PADRAO, ParametrosFarol } from "../domain/farol.entity";

export type Usuario = {
  id: string;
  organizationId: string;
  nome?: string;
  isMaster?: boolean;
  permissions?: string[];
};

export const ipDe = (req: any): string | undefined =>
  req?.ip ?? req?.headers?.["x-forwarded-for"] ?? undefined;

/** yyyy-mm-dd → Date em meia-noite UTC (coluna DATE). `null` limpa; `undefined` não mexe. */
export function paraData(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`);
}

/** Hoje como coluna DATE (dia local em meia-noite UTC). */
export function hojeData(agora: Date = new Date()): Date {
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

export const isoDia = (d: Date | string | null | undefined): string | null =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

export function dataBr(d: Date | string | null | undefined): string {
  const s = isoDia(d);
  return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—";
}

export function moedaBr(v: number | string | null | undefined): string {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parametrosDe(config: any): ParametrosFarol {
  if (!config) return PARAMETROS_PADRAO;
  return {
    diasAtencaoSemMovimento: config.diasAtencaoSemMovimento,
    diasCriticoSemMovimento: config.diasCriticoSemMovimento,
    diasAtrasoCritico: config.diasAtrasoCritico,
    diasDependenciaAtencao: config.diasDependenciaAtencao,
    limiarValorRelevante: config.limiarValorRelevante == null ? null : Number(config.limiarValorRelevante),
  };
}

export const CONFIG_PADRAO = {
  diasAtencaoSemMovimento: 30,
  diasCriticoSemMovimento: 90,
  diasAtrasoCritico: 15,
  diasDependenciaAtencao: 30,
  diasFollowUp: 30,
  antecedenciasAviso: [15, 7, 3, 0],
  diasEscalonamento: 5,
  limiarValorRelevante: null,
  automacoesAtivas: true,
  notificarEmail: false,
  gestoresEscalonamento: [] as string[],
};

/** Responsável = executivo, operacional ou dono da próxima ação. */
export function ehResponsavel(user: Usuario, caso: any): boolean {
  return [caso.responsavelExecutivoId, caso.responsavelOperacionalId, caso.proximaAcaoResponsavelId]
    .filter(Boolean).includes(user.id);
}

export function podeEditarCaso(user: Usuario, caso: any): boolean {
  return tem(user, P.caso.editar) || (tem(user, P.caso.editarProprios) && ehResponsavel(user, caso));
}

/** Registrar andamento, tarefa ou comentário: quem edita o caso ou quem executa. */
export function podeRegistrar(user: Usuario, caso: any): boolean {
  return podeEditarCaso(user, caso) || tem(user, P.tarefa.executar);
}

export const verFinanceiro = (user: Usuario) => tem(user, P.financeiro.ver);
