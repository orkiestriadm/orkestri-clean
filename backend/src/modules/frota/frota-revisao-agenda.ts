/**
 * Agenda de revisão preventiva — a projeção, fora do controller.
 *
 * A agenda não é uma lista de agendamentos: é a PROJEÇÃO de cada plano de
 * revisão sobre cada veículo. Decisão de 13/07/2026 — a frota roda muito e o KM
 * chega sozinho pela importação do cartão-combustível, então controlar por
 * quilometragem funciona e controlar por data virava trabalho manual que
 * ninguém fazia.
 *
 * Vivia inteira dentro do `RevisaoAgendaController`, e por isso o alerta
 * diário não a enxergava: o scheduler lia só registros `agendada` com
 * `dataPrevista`, que é justamente o modelo descartado. Resultado — a tela
 * mostrava vermelho e ninguém recebia nada. Extraído para cá para que a tela e
 * o alerta projetem com a MESMA regra, que é a lição que o farol já tinha
 * ensinado (ver `frota-status.ts`).
 */

import { sincronizarKmPorAbastecimento } from "./frota-km";

export type FarolAgenda = "vermelho" | "laranja" | "amarelo" | "verde" | "cinza";

/**
 * Farol pela fração do intervalo que ainda resta.
 *
 * Passou (≤0) é vermelho; os 10% finais são laranja; os 30% finais, amarelo.
 */
export function farolFromPct(pct: number): FarolAgenda {
  if (pct <= 0) return "vermelho";
  if (pct <= 0.10) return "laranja";
  if (pct <= 0.30) return "amarelo";
  return "verde";
}

export const SEVERIDADE_FAROL: Record<string, number> = {
  vermelho: 0, laranja: 1, amarelo: 2, verde: 3, cinza: 4,
};

export type VeiculoAgenda = {
  id: string;
  placa?: string | null;
  codigo?: string | null;
  identificacao?: string | null;
  modelo?: string | null;
  marca?: string | null;
  kmAtual?: number | null;
  horimetroAtual?: number | null;
  dataAquisicao?: Date | string | null;
  criadoEm?: Date | string | null;
  organizationId?: string;
};

export type PlanoAgenda = {
  id: string;
  veiculoId?: string | null;
  modelo?: string | null;
  marca?: string | null;
  tipo: string;
  base: string;
  intervaloKm?: number | null;
  intervaloDias?: number | null;
  intervaloHorimetro?: number | null;
};

export type UltimaRevisao = {
  veiculoId: string;
  tipo: string;
  dataRealizada?: Date | string | null;
  kmRealizado?: number | null;
  horimetro?: number | null;
};

export type ItemAgendaRevisao = {
  veiculoId: string;
  organizationId?: string;
  placa?: string | null;
  codigo?: string | null;
  modelo?: string | null;
  tipo: string;
  baseTipo: string;
  planoId: string;
  kmAtual?: number | null;
  ultimaData?: Date | string | null;
  ultimaKm?: number | null;
  proximaKm?: number;
  proximaData?: Date;
  proximaHorimetro?: number;
  atual?: number;
  restante?: number;
  unidade?: string;
  intervalo?: number;
  pct?: number;
  semDado?: boolean;
  farol: FarolAgenda;
};

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/**
 * O plano vale para este veículo?
 *
 * `veiculoId` preenchido manda — foi o campo criado quando descobrimos que a
 * operação escreve "GL 4 - FYS0H34" no campo modelo, e o casamento por texto
 * deixava a agenda vazia sem avisar. Sem ele, casa por modelo (+ marca, quando
 * o plano especifica uma).
 */
function planoServeAoVeiculo(p: PlanoAgenda, v: VeiculoAgenda): boolean {
  if (p.veiculoId) return p.veiculoId === v.id;
  return norm(p.modelo) === norm(v.modelo) && (!p.marca || norm(p.marca) === norm(v.marca));
}

/**
 * Projeta os planos sobre os veículos. Função pura: recebe tudo pronto.
 *
 * `agora` entra por parâmetro para o teste não depender do relógio.
 */
export function projetarAgendaRevisao(
  veiculos: VeiculoAgenda[],
  planos: PlanoAgenda[],
  ultimas: UltimaRevisao[],
  agora: Date = new Date(),
): { itens: ItemAgendaRevisao[]; resumo: Record<string, number> } {
  const lastByKey: Record<string, UltimaRevisao> = {};
  for (const r of ultimas) {
    const k = `${r.veiculoId}::${r.tipo}`;
    if (!lastByKey[k]) lastByKey[k] = r;
  }

  const itens: ItemAgendaRevisao[] = [];
  for (const v of veiculos) {
    for (const p of planos.filter(pl => planoServeAoVeiculo(pl, v))) {
      const last = lastByKey[`${v.id}::${p.tipo}`];
      const base = {
        veiculoId: v.id,
        organizationId: v.organizationId,
        placa: v.placa, codigo: v.codigo, modelo: v.modelo,
        tipo: p.tipo, baseTipo: p.base, planoId: p.id,
        kmAtual: v.kmAtual,
        ultimaData: last?.dataRealizada || null,
        ultimaKm: last?.kmRealizado ?? null,
      };

      if (p.base === "km" && p.intervaloKm) {
        const atual = v.kmAtual ?? 0;
        const lastKm = last?.kmRealizado ?? atual;
        const prox = lastKm + p.intervaloKm;
        const restante = prox - atual;
        itens.push({
          ...base, proximaKm: prox, atual, restante, unidade: "km", intervalo: p.intervaloKm,
          pct: Math.max(0, Math.min(1, 1 - restante / p.intervaloKm)),
          farol: farolFromPct(restante / p.intervaloKm),
        });
      } else if (p.base === "data" && p.intervaloDias) {
        const lastData = last?.dataRealizada
          ? new Date(last.dataRealizada)
          : (v.dataAquisicao ? new Date(v.dataAquisicao) : new Date(v.criadoEm || agora));
        const prox = new Date(lastData.getTime() + p.intervaloDias * 86400000);
        const restante = Math.ceil((prox.getTime() - agora.getTime()) / 86400000);
        itens.push({
          ...base, proximaData: prox, restante, unidade: "dias", intervalo: p.intervaloDias,
          pct: Math.max(0, Math.min(1, 1 - restante / p.intervaloDias)),
          farol: farolFromPct(restante / p.intervaloDias),
        });
      } else if (p.base === "horimetro" && p.intervaloHorimetro) {
        if (v.horimetroAtual == null) {
          itens.push({ ...base, semDado: true, unidade: "h", farol: "cinza" });
        } else {
          const lastH = last?.horimetro ?? v.horimetroAtual;
          const prox = lastH + p.intervaloHorimetro;
          const restante = prox - v.horimetroAtual;
          itens.push({
            ...base, proximaHorimetro: prox, atual: v.horimetroAtual, restante, unidade: "h",
            intervalo: p.intervaloHorimetro,
            pct: Math.max(0, Math.min(1, 1 - restante / p.intervaloHorimetro)),
            farol: farolFromPct(restante / p.intervaloHorimetro),
          });
        }
      }
    }
  }

  itens.sort((a, b) =>
    (SEVERIDADE_FAROL[a.farol] - SEVERIDADE_FAROL[b.farol]) ||
    ((a.restante ?? 1e12) - (b.restante ?? 1e12)));

  const resumo: Record<string, number> = { vermelho: 0, laranja: 0, amarelo: 0, verde: 0, cinza: 0 };
  for (const i of itens) resumo[i.farol] = (resumo[i.farol] || 0) + 1;
  return { itens, resumo };
}

/**
 * Carrega o que a projeção precisa e projeta.
 *
 * Reconcilia o hodômetro ANTES de projetar: a agenda por KM lida com um
 * `km_atual` desatualizado projeta a revisão no lugar errado, e era exatamente
 * isso que o botão "Atualizar KM (abastecimento)" existia para remendar à mão.
 *
 * `orgId` opcional: o scheduler roda para todas as organizações de uma vez.
 */
export async function carregarAgendaRevisao(
  db: any,
  orgId?: string | null,
  agora: Date = new Date(),
): Promise<{ itens: ItemAgendaRevisao[]; resumo: Record<string, number> }> {
  const escopo = orgId ? { organizationId: orgId } : {};
  const [veiculos, planos] = await Promise.all([
    db.veiculo.findMany({
      where: { ...escopo, deletedAt: null, status: { in: ["ativo", "manutencao", "operando_com_avaria"] } },
      select: {
        id: true, placa: true, codigo: true, identificacao: true, modelo: true, marca: true,
        kmAtual: true, horimetroAtual: true, dataAquisicao: true, criadoEm: true, organizationId: true,
      },
    }),
    db.planoRevisao.findMany({ where: { ...escopo, deletedAt: null, ativo: true } }),
  ]);
  if (!veiculos.length || !planos.length) {
    return { itens: [], resumo: { vermelho: 0, laranja: 0, amarelo: 0, verde: 0, cinza: 0 } };
  }

  const sync = await sincronizarKmPorAbastecimento(db, {
    orgId: orgId ?? undefined,
    veiculos: veiculos.map((v: any) => ({ id: v.id, kmAtual: v.kmAtual })),
  });
  for (const v of veiculos) {
    const km = sync.km.get(v.id);
    if (km != null) v.kmAtual = km;
  }

  const ultimas = await db.revisaoVeiculo.findMany({
    where: { ...escopo, deletedAt: null, status: "realizada", veiculoId: { in: veiculos.map((v: any) => v.id) } },
    select: { veiculoId: true, tipo: true, dataRealizada: true, kmRealizado: true, horimetro: true },
    orderBy: { dataRealizada: "desc" },
  });

  return projetarAgendaRevisao(veiculos, planos, ultimas, agora);
}
