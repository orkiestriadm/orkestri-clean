"use client";
import React from "react";

export type PneuPos = { codigo: string; label: string; x: number; y: number };

// Árvore visual: silhueta do veículo com as posições dos pneus (x/y em grid 0-100).
export default function PneuTree({ posicoes, pneus, onClickPos, height = 320 }: {
  posicoes: PneuPos[];
  pneus: any[];
  onClickPos?: (codigo: string) => void;
  height?: number;
}) {
  const byPos: Record<string, any> = {};
  for (const p of pneus) if (p.posicao) byPos[p.posicao] = p;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 360, height, margin: "0 auto", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 16 }}>
      {/* corpo do veículo */}
      <div style={{ position: "absolute", left: "34%", right: "34%", top: "8%", bottom: "8%", background: "var(--bg-hover)", border: "1px solid var(--border-subtle)", borderRadius: 14 }} />
      {posicoes.map(pos => {
        const pneu = byPos[pos.codigo];
        const filled = !!pneu;
        const color = filled ? "var(--accent-green)" : "var(--text-muted)";
        return (
          <button
            key={pos.codigo}
            title={pos.label}
            onClick={() => onClickPos?.(pos.codigo)}
            style={{
              position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)",
              width: 54, height: 64, borderRadius: 8, cursor: onClickPos ? "pointer" : "default",
              background: filled ? "var(--accent-green)10" : "var(--bg-card)",
              border: `2px solid ${color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 2,
            }}>
            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color, fontWeight: 700 }}>{pos.codigo}</span>
            <span style={{ fontSize: 9, color: filled ? "var(--text-primary)" : "var(--text-muted)", textAlign: "center", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 50 }}>
              {filled ? (pneu.numeroFogo || pneu.codigo || "pneu") : "vazio"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
