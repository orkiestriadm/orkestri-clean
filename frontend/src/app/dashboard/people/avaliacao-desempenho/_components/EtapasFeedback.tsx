"use client";

import { Check } from "lucide-react";
import { ETAPAS, StatusFeedbackDesempenho } from "@/lib/people/feedback-desempenho.service";
import type { BadgeTone } from "@/components/data-ui";

export const TOM_STATUS: Record<StatusFeedbackDesempenho, BadgeTone> = {
  REGISTRADO: "neutro",
  REUNIAO_AGENDADA: "info",
  AGUARDANDO_CIENCIA: "atencao",
  ENCERRADO: "ok",
};

/**
 * As quatro etapas do RH, na ordem, com a atual destacada.
 *
 * Os nomes são os do texto do RH — Registro, Reunião, Ciência, Encerramento —
 * e não os status técnicos: quem lê a tela reconhece o processo que já conhece.
 */

const NOMES = ["Registro", "Reunião", "Ciência", "Encerramento"];

export default function EtapasFeedback({ status }: { status: StatusFeedbackDesempenho }) {
  const indiceAtual = ETAPAS.findIndex(e => e.status === status);
  // Encerrado é a última etapa CONCLUÍDA, não uma etapa em andamento.
  const concluidoAte = status === "ENCERRADO" ? ETAPAS.length : indiceAtual;

  return (
    <ol
      aria-label="Etapas do feedback"
      style={{
        display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8,
        listStyle: "none", padding: 0, margin: "0 0 18px",
      }}
    >
      {NOMES.map((nome, i) => {
        const feita = i < concluidoAte;
        const atual = i === indiceAtual && status !== "ENCERRADO";
        const cor = feita ? "var(--accent-green)" : atual ? "var(--accent-violet)" : "var(--text-muted)";
        return (
          <li
            key={nome}
            aria-current={atual ? "step" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 9, minWidth: 0,
              padding: "10px 12px", borderRadius: 12,
              background: atual ? "color-mix(in srgb, var(--accent-violet) 9%, transparent)" : "var(--bg-secondary)",
              border: `1px solid ${atual ? "color-mix(in srgb, var(--accent-violet) 35%, transparent)" : "var(--border-subtle)"}`,
            }}
          >
            <span
              style={{
                width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: feita ? "white" : cor,
                background: feita ? "var(--accent-green)" : "transparent",
                border: feita ? "none" : `1.5px solid ${cor}`,
              }}
            >
              {feita ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span
              style={{
                fontSize: 12.5, fontWeight: atual ? 600 : 500,
                color: feita || atual ? "var(--text-primary)" : "var(--text-muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {nome}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
