"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";

type Linha = {
  veiculo: { id: string; placa: string; codigo: string; modelo?: string };
  custoManutencao: number; custoAbastecimento: number; litros: number;
  totalManutencoes: number; totalAbastecimentos: number; custoTotal: number;
};
type Resp = { linhas: Linha[]; totais: { custoManutencao: number; custoAbastecimento: number; custoTotal: number } };

const fmtMoney = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FrotaRelatoriosPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [veiculos, setVeiculos] = useState<{ id: string; placa: string }[]>([]);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/frota/veiculos", { params: { limit: 200 } }).then(r => setVeiculos(r.data?.items || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/frota/relatorios/custos", { params: { from, to, veiculoId } });
      setData(data);
    } catch { setData(null); } finally { setLoading(false); }
  }, [from, to, veiculoId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Filtros */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>DE</label>
            <input className="input-o" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>ATÉ</label>
            <input className="input-o" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>VEÍCULO</label>
            <select className="input-o" value={veiculoId} onChange={e => setVeiculoId(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Todos</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
            </select>
          </div>
        </div>

        {/* Totais */}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
            <div className="card" style={{ padding: "16px 18px", borderLeft: "3px solid var(--accent-amber)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>MANUTENÇÕES</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-amber)" }}>{fmtMoney(data.totais.custoManutencao)}</div>
            </div>
            <div className="card" style={{ padding: "16px 18px", borderLeft: "3px solid var(--accent-green)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>ABASTECIMENTOS</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-green)" }}>{fmtMoney(data.totais.custoAbastecimento)}</div>
            </div>
            <div className="card" style={{ padding: "16px 18px", borderLeft: "3px solid var(--accent-cyan)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>CUSTO TOTAL</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-cyan)" }}>{fmtMoney(data.totais.custoTotal)}</div>
            </div>
          </div>
        )}

        {/* Tabela por veículo */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Veículo", "Manutenções", "Abastecimentos", "Litros", "Custo manut.", "Custo abast.", "Custo total"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
                {!loading && (!data || data.linhas.length === 0) && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Sem dados no período.</td></tr>}
                {!loading && data?.linhas.map(l => (
                  <tr key={l.veiculo.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{l.veiculo.placa}</span>
                      {l.veiculo.modelo && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{l.veiculo.modelo}</span>}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{l.totalManutencoes}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{l.totalAbastecimentos}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{l.litros.toLocaleString("pt-BR")}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{fmtMoney(l.custoManutencao)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{fmtMoney(l.custoAbastecimento)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{fmtMoney(l.custoTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
