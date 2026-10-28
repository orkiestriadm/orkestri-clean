"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  KpiCard, KpiGrid, Panel, TableCard, EmptyState, LoadingRows, ErrorState, StatusBadge,
} from "@/components/data-ui";
import {
  feedbackDesempenhoService, Acompanhamento as Dados, formatarDataHora,
} from "@/lib/people/feedback-desempenho.service";
import { CheckCircle2, Clock, MessagesSquare, UserX, AlertTriangle } from "lucide-react";

/**
 * Acompanhamento — as duas perguntas que a lista não responde.
 *
 *  QUEM AINDA NÃO FEZ: a tabela de gestores parte do ORGANOGRAMA, não dos
 *  feedbacks existentes. Gestor que não registrou nada não tem linha na lista
 *  de feedbacks, e é exatamente quem o RH procura — por isso ele aparece aqui,
 *  no topo, com cobertura zero.
 *
 *  QUEM NÃO RETORNOU: a fila de ciência pendente, do mais antigo para o mais
 *  novo. Ela ignora o filtro de período de propósito: um feedback parado há
 *  seis meses é o que mais precisa de cobrança, e sumiria se o período o
 *  cortasse.
 */

const PERIODOS = [
  { dias: 30, label: "Últimos 30 dias" },
  { dias: 90, label: "Últimos 90 dias" },
  { dias: 180, label: "Últimos 6 meses" },
  { dias: 365, label: "Últimos 12 meses" },
];

const corDaCobertura = (pct: number) =>
  pct === 0 ? "var(--accent-red)" : pct < 50 ? "var(--accent-amber)" : "var(--accent-green)";

function Cobertura({ pct }: { pct: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 96 }}>
      <span style={{ width: 52, height: 5, borderRadius: 3, background: "var(--bg-hover)", overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${pct}%`, background: corDaCobertura(pct) }} />
      </span>
      <span className="num" style={{ fontSize: 12, color: corDaCobertura(pct), fontWeight: 600 }}>{pct}%</span>
    </span>
  );
}

export default function Acompanhamento() {
  const [dias, setDias] = useState(90);
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      setDados((await feedbackDesempenhoService.acompanhamento(dias)).data);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Não foi possível carregar o acompanhamento.");
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <ErrorState detail={erro} onRetry={carregar} />;

  const r = dados?.resumo;
  const COL_GESTORES = ["Gestor", "Liderados", "Feedbacks", "Pessoas", "Reuniões", "Ciências", "Cobertura"];
  const COL_FILA = ["Colaborador", "Gestor", "Liberado em", "Esperando há"];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select
          className="select-field" value={dias} onChange={e => setDias(Number(e.target.value))}
          aria-label="Período dos indicadores"
        >
          {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Os números abaixo contam os feedbacks registrados no período. A fila de ciência mostra tudo que está parado.
        </span>
      </div>

      <KpiGrid>
        <KpiCard label="Feedbacks registrados" valor={carregando ? "—" : r?.registrados ?? 0} icon={<MessagesSquare size={16} />} />
        <KpiCard
          label="Conversa ainda não aconteceu" valor={carregando ? "—" : r?.aguardandoReuniao ?? 0}
          icon={<Clock size={16} />} color="var(--accent-cyan)"
        />
        <KpiCard
          label="Aguardando ciência" valor={carregando ? "—" : r?.aguardandoCiencia ?? 0}
          icon={<UserX size={16} />} color="var(--accent-amber)"
          hint="Colaboradores que já podem ler o feedback e ainda não registraram ciência"
        />
        <KpiCard
          label="Retorno dos colaboradores" valor={carregando ? "—" : `${r?.percentualRetorno ?? 0}%`}
          icon={<CheckCircle2 size={16} />} color="var(--accent-green)"
          hint="Dos feedbacks que chegaram à etapa de ciência, quantos já foram assinados"
        />
        <KpiCard
          label="Gestores sem nenhum registro" valor={carregando ? "—" : r?.gestoresSemRegistro ?? 0}
          icon={<AlertTriangle size={16} />} color="var(--accent-red)"
          hint="Gestores do organograma que não registraram feedback no período"
        />
      </KpiGrid>

      {!carregando && (dados?.exclusoesPendentes ?? 0) > 0 && (
        <div
          style={{
            display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderRadius: 12,
            background: "color-mix(in srgb, var(--accent-red) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-red) 26%, transparent)",
            fontSize: 12.5, color: "var(--text-secondary)",
          }}
        >
          <AlertTriangle size={15} style={{ color: "var(--accent-red)", flexShrink: 0 }} />
          {dados!.exclusoesPendentes === 1
            ? "1 pedido de exclusão aguardando decisão do RH."
            : `${dados!.exclusoesPendentes} pedidos de exclusão aguardando decisão do RH.`}
        </div>
      )}

      <Panel title={`GESTORES (${carregando ? "—" : dados?.gestores.length ?? 0})`}>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Todo gestor do organograma aparece aqui, inclusive quem não registrou nada. A ordem começa pela menor cobertura.
        </p>
        <TableCard>
          <thead><tr>{COL_GESTORES.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {carregando ? (
              <LoadingRows colSpan={COL_GESTORES.length} rows={4} />
            ) : (dados?.gestores.length ?? 0) === 0 ? (
              <EmptyState
                colSpan={COL_GESTORES.length}
                title="Nenhum gestor no organograma"
                hint="Um colaborador vira gestor quando alguém aponta para ele no campo Gestor da ficha."
              />
            ) : (
              dados!.gestores.map(g => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                    <Link href={`/dashboard/people/${g.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {g.nome}
                    </Link>
                  </td>
                  <td className="num">{g.liderados}</td>
                  <td className="num">
                    {g.registrados === 0
                      ? <StatusBadge label="Nenhum" tone="critico" />
                      : g.registrados}
                  </td>
                  <td className="num">{g.colaboradoresAtingidos}</td>
                  <td className="num">{g.reuniaoRealizada}</td>
                  <td className="num">{g.cienciaDada}</td>
                  <td><Cobertura pct={g.cobertura} /></td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </Panel>

      <Panel title={`AGUARDANDO CIÊNCIA (${carregando ? "—" : dados?.semRetorno.length ?? 0})`}>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Feedbacks já apresentados na reunião e ainda sem ciência do colaborador, do mais antigo para o mais recente.
        </p>
        <TableCard>
          <thead><tr>{COL_FILA.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {carregando ? (
              <LoadingRows colSpan={COL_FILA.length} rows={3} />
            ) : (dados?.semRetorno.length ?? 0) === 0 ? (
              <EmptyState
                colSpan={COL_FILA.length}
                icon={<CheckCircle2 size={20} />}
                title="Ninguém pendente"
                hint="Todos os feedbacks apresentados já receberam ciência."
              />
            ) : (
              dados!.semRetorno.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                    <Link
                      href={`/dashboard/people/avaliacao-desempenho/feedback/${s.id}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {s.colaborador}
                    </Link>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{s.gestor}</td>
                  <td className="num">{formatarDataHora(s.reuniaoRealizadaEm)}</td>
                  <td className="num" style={{ color: s.diasEsperando >= 7 ? "var(--accent-red)" : "var(--text-secondary)", fontWeight: 600 }}>
                    {s.diasEsperando === 0
                      ? "hoje"
                      : `${s.diasEsperando} ${s.diasEsperando === 1 ? "dia" : "dias"}`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </Panel>
    </div>
  );
}
