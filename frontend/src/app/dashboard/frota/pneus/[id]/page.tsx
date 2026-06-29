"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, fmtMoney } from "../../_components/crud";
import { ArrowLeft, X } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  estoque: { label: "Estoque", color: "var(--accent-cyan)" },
  em_uso: { label: "Em uso", color: "var(--accent-green)" },
  reserva: { label: "Reserva", color: "#8b5cf6" },
  recapagem: { label: "Recapagem", color: "var(--accent-amber)" },
  descarte: { label: "Descarte", color: "var(--accent-red)" },
};
const EVENTO_LABEL: Record<string, { label: string; color: string }> = {
  instalacao: { label: "Instalação", color: "var(--accent-green)" },
  remocao: { label: "Remoção", color: "var(--text-muted)" },
  rodizio: { label: "Rodízio", color: "var(--accent-cyan)" },
  recapagem: { label: "Recapagem", color: "var(--accent-amber)" },
  descarte: { label: "Descarte", color: "var(--accent-red)" },
};
const ACOES = [
  { tipo: "instalacao", label: "Instalar" },
  { tipo: "rodizio", label: "Rodízio" },
  { tipo: "remocao", label: "Remover" },
  { tipo: "recapagem", label: "Recapagem" },
  { tipo: "descarte", label: "Descartar" },
];
const num = (v: any) => v != null ? Number(v).toLocaleString("pt-BR") : "—";
const hasPerms = (user: any, ...perms: string[]) => user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

function kmRodado(p: any) { const ini = p.kmInicial ?? p.kmInstalacao; return (ini != null && p.kmAtual != null) ? Math.max(0, p.kmAtual - ini) : null; }
function custoKm(p: any) { const r = kmRodado(p); return (p.valorCompra != null && r && r > 0) ? p.valorCompra / r : null; }

// ── Modal de ação ────────────────────────────────────────────────────────────────
function AcaoModal({ pneu, tipo, onSaved, onClose }: { pneu: any; tipo: string; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>({ km: pneu.kmAtual ?? "", data: new Date().toISOString().slice(0, 10), status: "estoque" });
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [posicoes, setPosicoes] = useState<{ codigo: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const meta = EVENTO_LABEL[tipo];

  useEffect(() => {
    if (tipo === "instalacao") api.get("/frota/veiculos", { params: { limit: 200 } }).then(r => setVeiculos(r.data?.items || [])).catch(() => {});
    if (tipo === "rodizio" && pneu.veiculoId) loadPos(pneu.veiculoId);
  }, [tipo]);

  const loadPos = (vId: string) => api.get(`/frota/veiculos/${vId}/pneus-tree`).then(r => setPosicoes(r.data?.posicoes || [])).catch(() => setPosicoes([]));

  const save = async () => {
    if (tipo === "instalacao" && !d.veiculoId) { setErr("Selecione o veículo"); return; }
    setSaving(true); setErr("");
    try { await api.post(`/frota/pneus/${pneu.id}/evento`, { ...d, tipo }); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro"); setSaving(false); }
  };
  const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{label}</label>{children}</div>
  );

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>{meta?.label} de pneu</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}

        {tipo === "instalacao" && (
          <>
            <L label="VEÍCULO *">
              <select className="input-o" value={d.veiculoId || ""} onChange={e => { set("veiculoId", e.target.value); if (e.target.value) loadPos(e.target.value); }}>
                <option value="">—</option>
                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ""}</option>)}
              </select>
            </L>
            <L label="POSIÇÃO">
              <select className="input-o" value={d.posicaoPara || ""} onChange={e => set("posicaoPara", e.target.value)}>
                <option value="">—</option>
                {posicoes.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.label}</option>)}
              </select>
            </L>
          </>
        )}
        {tipo === "rodizio" && (
          <L label="NOVA POSIÇÃO">
            <select className="input-o" value={d.posicaoPara || ""} onChange={e => set("posicaoPara", e.target.value)}>
              <option value="">—</option>
              {posicoes.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.label}</option>)}
            </select>
          </L>
        )}
        {tipo === "remocao" && (
          <L label="DESTINO">
            <select className="input-o" value={d.status || "estoque"} onChange={e => set("status", e.target.value)}>
              <option value="estoque">Estoque</option>
              <option value="reserva">Reserva</option>
            </select>
          </L>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <L label="DATA"><input className="input-o" type="date" value={d.data || ""} onChange={e => set("data", e.target.value)} /></L>
          <L label="KM"><input className="input-o" type="number" value={d.km ?? ""} onChange={e => set("km", e.target.value === "" ? null : Number(e.target.value))} /></L>
        </div>
        {(tipo === "recapagem" || tipo === "descarte") && (
          <L label="CUSTO (R$)"><input className="input-o" type="number" step={0.01} value={d.custo ?? ""} onChange={e => set("custo", e.target.value === "" ? null : Number(e.target.value))} /></L>
        )}
        <L label="OBSERVAÇÕES"><input className="input-o" value={d.observacoes || ""} onChange={e => set("observacoes", e.target.value)} /></L>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function PneuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [p, setP] = useState<any>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState<string | null>(null);
  const canEdit = hasPerms(user, "frota:editar");

  const loadEv = useCallback(() => { api.get(`/frota/pneus/${id}/eventos`).then(r => setEventos(r.data || [])).catch(() => {}); }, [id]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const [d] = await Promise.all([api.get(`/frota/pneus/${id}`), loadEv()]); setP(d.data); }
    catch { setP(null); } finally { setLoading(false); }
  }, [id, loadEv]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Carregando...</main></div>;
  if (!p) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Pneu não encontrado.</main></div>;

  const st = STATUS[p.status] || { label: p.status, color: "var(--text-muted)" };
  const rodado = kmRodado(p);
  const ck = custoKm(p);
  const INFO: [string, any][] = [
    ["Código interno", p.codigo], ["Marca/Modelo", [p.marca, p.modelo].filter(Boolean).join(" ")], ["Medida", p.medida],
    ["DOT", p.dot], ["Fabricação", fmtDate(p.dataFabricacao)], ["Fornecedor", p.fornecedor],
    ["Valor de compra", fmtMoney(p.valorCompra)], ["Vida útil prevista", p.vidaUtilKm ? `${num(p.vidaUtilKm)} km` : null],
    ["KM previsto", p.kmPrevisto ? `${num(p.kmPrevisto)} km` : null],
    ["Veículo / Posição", p.veiculo ? `${p.veiculo.placa}${p.posicao ? " · " + p.posicao : ""}` : null],
    ["KM inicial", num(p.kmInicial ?? p.kmInstalacao)], ["KM atual", num(p.kmAtual)],
    ["KM rodado", rodado != null ? `${num(rodado)} km` : "—"],
    ["Custo / km", ck != null ? ck.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 3 }) : "—"],
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {canEdit && ACOES.map(a => (
          <button key={a.tipo} className="btn btn-ghost text-xs" onClick={() => setAcao(a.tipo)}>{a.label}</button>
        ))}
      </Topbar>
      <main className="flex-1 overflow-y-auto p-6">
        <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/frota/pneus")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={14} /> Voltar</button>

        <div className="card" style={{ padding: "20px 24px", marginBottom: 18, borderLeft: `3px solid ${st.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{p.numeroFogo || p.codigo || "Pneu"}</h2>
            <Badge color={st.color}>{st.label}</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
            {INFO.filter(([, v]) => v && v !== "—").map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Histórico de eventos */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>HISTÓRICO COMPLETO</div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Data", "Evento", "Posição", "KM", "Custo", "Obs."].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventos.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Nenhum evento registrado.</td></tr>}
              {eventos.map(e => {
                const m = EVENTO_LABEL[e.tipo] || { label: e.tipo, color: "var(--text-muted)" };
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 14px" }}>{fmtDate(e.data)}</td>
                    <td style={{ padding: "10px 14px" }}><Badge color={m.color}>{m.label}</Badge></td>
                    <td style={{ padding: "10px 14px" }}>{[e.posicaoDe, e.posicaoPara].filter(Boolean).join(" → ") || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>{num(e.km)}</td>
                    <td style={{ padding: "10px 14px" }}>{fmtMoney(e.custo)}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{e.observacoes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {acao && <AcaoModal pneu={p} tipo={acao} onSaved={() => { setAcao(null); load(); }} onClose={() => setAcao(null)} />}
    </div>
  );
}
