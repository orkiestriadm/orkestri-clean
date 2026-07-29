"use client";

import { useState } from "react";
import { useVacation } from "@/hooks/useVacation";
import { PeriodoFerias, StatusPeriodo } from "@/lib/people/vacations.service";
import {
  Panel, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  StatusBadge, BadgeTone,
} from "@/components/data-ui";
import { Plus, CalendarOff, AlertTriangle, CalendarDays } from "lucide-react";
import SolicitarFerias from "./SolicitarFerias";

/**
 * Férias do colaborador.
 *
 * A tela existe para responder duas perguntas em ordem: quantos dias a pessoa
 * pode tirar hoje, e o que está prestes a virar passivo. Por isso o saldo vem
 * antes da tabela, e período vencido aparece destacado mesmo tendo "saldo" — o
 * número existe, mas não é mais um direito a agendar: é conta a pagar em dobro.
 */

const STATUS: Record<StatusPeriodo, { label: string; tone: BadgeTone }> = {
  EM_AQUISICAO: { label: "Em aquisição", tone: "info" },
  ADQUIRIDO:    { label: "Disponível",   tone: "ok" },
  GOZADO:       { label: "Gozado",       tone: "neutro" },
  VENCIDO:      { label: "Vencido",      tone: "critico" },
};

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** "em 45 dias" / "há 12 dias" — o prazo importa mais que a data em si. */
function prazo(dias: number): string {
  if (dias === 0) return "vence hoje";
  return dias > 0 ? `em ${dias} dias` : `venceu há ${Math.abs(dias)} dias`;
}

type Props = {
  collaboratorId: string;
  nome: string;
  podeSolicitar: boolean;
};

export default function AbaFerias({ collaboratorId, nome, podeSolicitar }: Props) {
  const { situacao, carregando, erro, semPermissao, recarregar } = useVacation(collaboratorId);
  const [solicitando, setSolicitando] = useState(false);

  if (semPermissao) {
    return <PermissionDenied hint="Você não tem permissão para ver as férias deste colaborador." />;
  }

  // Sem admissão o cálculo inteiro é impossível. Dizer "0 dias de saldo" seria
  // uma resposta errada para uma pergunta que nem pôde ser feita.
  if (situacao?.semDataAdmissao) {
    return (
      <Panel title="FÉRIAS">
        <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
          <CalendarOff size={17} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            Este colaborador não tem data de admissão cadastrada, e o período
            aquisitivo é contado a partir dela. Preencha a admissão na aba
            Vínculo para que o saldo passe a ser calculado.
          </p>
        </div>
      </Panel>
    );
  }

  const vencidos = situacao?.periodos.filter(p => p.status === "VENCIDO") ?? [];
  const COLUNAS = ["Período aquisitivo", "Limite para gozar", "Direito", "Gozados", "Saldo", "Situação"];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!carregando && situacao && <Resumo situacao={situacao} vencidos={vencidos.length} />}

        <Panel
          title="PERÍODOS AQUISITIVOS"
          actions={
            podeSolicitar && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSolicitando(true)}
                disabled={!situacao || situacao.saldoDisponivel === 0}
                title={
                  situacao && situacao.saldoDisponivel === 0
                    ? "Nenhum período com saldo disponível"
                    : undefined
                }
              >
                <Plus size={13} /> Solicitar férias
              </button>
            )
          }
        >
          <TableCard>
            <thead>
              <tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {carregando ? (
                <LoadingRows colSpan={COLUNAS.length} rows={3} />
              ) : erro ? (
                <ErrorState detail={erro} onRetry={recarregar} colSpan={COLUNAS.length} />
              ) : !situacao?.periodos.length ? (
                <EmptyState
                  colSpan={COLUNAS.length}
                  icon={<CalendarDays size={20} />}
                  title="Nenhum período aquisitivo fechado"
                  hint="O primeiro período se completa 12 meses após a admissão."
                />
              ) : (
                situacao.periodos.map(p => <Linha key={p.id} periodo={p} />)
              )}
            </tbody>
          </TableCard>
        </Panel>
      </div>

      <SolicitarFerias
        aberto={solicitando}
        collaboratorId={collaboratorId}
        nome={nome}
        saldoDisponivel={situacao?.saldoDisponivel ?? 0}
        onFechar={() => setSolicitando(false)}
        onSolicitado={recarregar}
      />
    </>
  );
}

function Resumo({
  situacao,
  vencidos,
}: {
  situacao: { saldoDisponivel: number; vencendo: number };
  vencidos: number;
}) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
      <div
        style={{
          padding: "14px 18px", borderRadius: 14, minWidth: 168,
          background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 6 }}>
          Saldo disponível
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="metric" style={{ fontSize: 26, fontWeight: 600 }}>
            {situacao.saldoDisponivel}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>dias</span>
        </div>
      </div>

      {vencidos > 0 && (
        <Aviso
          tone="critico"
          titulo={`${vencidos} ${vencidos === 1 ? "período vencido" : "períodos vencidos"}`}
          texto="Passou do prazo concessivo. A empresa deve pagar esses dias em dobro — não são mais dias a agendar."
        />
      )}
      {situacao.vencendo > 0 && (
        <Aviso
          tone="atencao"
          titulo={`${situacao.vencendo} ${situacao.vencendo === 1 ? "período vencendo" : "períodos vencendo"}`}
          texto="Programe as férias antes do limite concessivo para evitar o pagamento em dobro."
        />
      )}
    </div>
  );
}

function Aviso({ tone, titulo, texto }: { tone: "critico" | "atencao"; titulo: string; texto: string }) {
  const cor = tone === "critico" ? "var(--accent-red)" : "var(--accent-amber)";
  return (
    <div
      style={{
        flex: 1, minWidth: 260, display: "flex", gap: 10, alignItems: "flex-start",
        padding: "13px 15px", borderRadius: 14,
        background: `color-mix(in srgb, ${cor} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${cor} 24%, transparent)`,
      }}
    >
      <AlertTriangle size={15} style={{ color: cor, flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{titulo}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{texto}</div>
      </div>
    </div>
  );
}

function Linha({ periodo }: { periodo: PeriodoFerias }) {
  const status = STATUS[periodo.status];
  // O prazo só informa enquanto pode mudar o desfecho: em período já gozado ele
  // vira ruído, e em período ainda em aquisição a data está longe demais.
  const mostrarPrazo = periodo.status === "ADQUIRIDO" || periodo.status === "VENCIDO";

  return (
    <tr>
      <td>{fmtData(periodo.inicio)} a {fmtData(periodo.fim)}</td>
      <td className="num">
        {fmtData(periodo.limiteConcessivo)}
        {mostrarPrazo && (
          <div
            style={{
              fontSize: 11, marginTop: 2,
              color: periodo.diasParaVencer < 0 ? "var(--accent-red)" : "var(--text-muted)",
            }}
          >
            {prazo(periodo.diasParaVencer)}
          </div>
        )}
      </td>
      <td className="num">{periodo.diasDireito}</td>
      <td className="num">{periodo.diasGozados}</td>
      <td className="num" style={{ fontWeight: 600 }}>{periodo.saldo}</td>
      <td><StatusBadge label={status.label} tone={status.tone} /></td>
    </tr>
  );
}
