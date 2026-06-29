"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";
import { api } from "@/lib/api";

const COMB_OPTS = ["gasolina", "etanol", "diesel", "flex", "gnv"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const fmtKmL = (v: any) => v != null ? `${Number(v).toLocaleString("pt-BR")} km/L` : "—";
const fmtCustoKm = (v: any) => v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 3 }) : "—";

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${color}`, minWidth: 150 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function AnaliseConsumo() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get("/frota/abastecimentos/analise/consumo").then(r => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;
  const t = d.totais || {};

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>ANÁLISE DE CONSUMO</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Card label="LITROS" value={`${(t.totalLitros || 0).toLocaleString("pt-BR")} L`} color="var(--accent-cyan)" />
        <Card label="GASTO TOTAL" value={fmtMoney(t.totalGasto)} color="var(--accent-green)" />
        <Card label="CONSUMO MÉDIO" value={fmtKmL(t.mediaKmL)} color="#8b5cf6" />
        <Card label="CUSTO/KM MÉDIO" value={fmtCustoKm(t.custoKmMedio)} color="var(--accent-amber)" />
        <Card label="DESVIOS" value={String((d.desvios || []).length)} color={(d.desvios || []).length ? "var(--accent-red)" : "var(--accent-green)"} />
      </div>

      {d.veiculos?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: d.desvios?.length ? "1.3fr 1fr" : "1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>CONSUMO POR VEÍCULO</div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto", maxHeight: 240 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {["Veículo", "Abast.", "Litros", "Gasto", "km/L", "Custo/km"].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 12px", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {d.veiculos.map((v: any) => (
                      <tr key={v.veiculoId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v.placa}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{v.count}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{(v.litros || 0).toLocaleString("pt-BR")}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtMoney(v.gasto)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{fmtKmL(v.mediaKmL)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmtCustoKm(v.custoKmMedio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {d.desvios?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "var(--accent-red)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>⚠ DESVIOS DE CONSUMO</div>
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto", maxHeight: 240 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      {["Data", "Veículo", "km/L", "Desvio"].map((h, i) => <th key={h} style={{ textAlign: i > 1 ? "right" : "left", padding: "8px 12px", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {d.desvios.slice(0, 20).map((x: any) => (
                        <tr key={x.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 12px" }}>{fmtDate(x.data)}</td>
                          <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{x.placa}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{x.consumoKmL} <span style={{ color: "var(--text-muted)" }}>(méd {x.mediaKmL})</span></td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}><Badge color={x.desvioPct < 0 ? "var(--accent-red)" : "var(--accent-amber)"}>{x.desvioPct > 0 ? "+" : ""}{x.desvioPct}%</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const config: CrudConfig = {
  endpoint: "/frota/abastecimentos", tabela: "abastecimentos", singular: "abastecimento", plural: "Abastecimentos",
  defaults: { tanqueCheio: true },
  filters: [{ key: "tipoCombustivel", label: "Combustível", options: COMB_OPTS }],
  columns: [
    { key: "data", label: "Data", render: r => fmtDate(r.data) },
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "motorista", label: "Motorista", render: r => r.motorista?.nome || "—" },
    { key: "kmAtual", label: "KM", align: "right", render: r => r.kmAtual != null ? r.kmAtual.toLocaleString("pt-BR") : "—" },
    { key: "litros", label: "Litros", align: "right", render: r => r.litros != null ? r.litros.toLocaleString("pt-BR") : "—" },
    { key: "valorTotal", label: "Total", align: "right", render: r => fmtMoney(r.valorTotal) },
    { key: "consumoKmL", label: "km/L", align: "right", render: r => r.consumoKmL != null ? r.consumoKmL.toLocaleString("pt-BR") : "—" },
    { key: "custoKm", label: "Custo/km", align: "right", render: r => fmtCustoKm(r.custoKm) },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "motoristaId", label: "Motorista", type: "select", source: "motoristas" },
    { key: "data", label: "Data", type: "date" },
    { key: "kmAtual", label: "KM atual", type: "number" },
    { key: "litros", label: "Litros", type: "number", step: 0.01 },
    { key: "valorLitro", label: "Valor por litro (R$)", type: "number", step: 0.001 },
    { key: "valorTotal", label: "Valor total (R$) — auto se vazio", type: "number", step: 0.01 },
    { key: "tipoCombustivel", label: "Combustível", type: "select", options: COMB_OPTS },
    { key: "posto", label: "Posto" },
    { key: "tanqueCheio", label: "Tanque cheio", type: "checkbox", placeholder: "Encheu o tanque" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function AbastecimentosPage() {
  return <CrudView config={config} intro={<AnaliseConsumo />} />;
}
