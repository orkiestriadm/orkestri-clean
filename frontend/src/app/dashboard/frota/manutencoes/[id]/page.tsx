"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, fmtMoney } from "../../_components/crud";
import { ArrowLeft, X, Plus, Trash2, FileText } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  aberta: { label: "Aberta", color: "var(--accent-cyan)" },
  em_andamento: { label: "Em andamento", color: "var(--accent-amber)" },
  aguardando_pecas: { label: "Aguardando peças", color: "#f97316" },
  finalizada: { label: "Finalizada", color: "var(--accent-green)" },
  cancelada: { label: "Cancelada", color: "var(--text-muted)" },
};
const TIPO_LABEL: Record<string, string> = { preventiva: "Preventiva", corretiva: "Corretiva", emergencial: "Emergencial" };
const ANEXO_CATS = [
  { tipo: "nota_fiscal", label: "Notas Fiscais" }, { tipo: "foto", label: "Fotos" }, { tipo: "orcamento", label: "Orçamentos" },
];
const hasPerms = (user: any, ...perms: string[]) => user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

// ── Modal mão de obra ──────────────────────────────────────────────────────────
function MaoObraModal({ manutencaoId, onSaved, onClose }: { manutencaoId: string; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const custoAuto = (d.horas != null && d.valorHora != null && d.custo == null) ? (Number(d.horas) * Number(d.valorHora)) : null;

  const save = async () => {
    if (!d.descricao?.trim()) { setErr("Descrição obrigatória"); return; }
    setSaving(true); setErr("");
    try { await api.post(`/frota/manutencoes/${manutencaoId}/mao-obra`, d); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro"); setSaving(false); }
  };
  const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{label}</label>{children}</div>
  );

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Apontar mão de obra</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}
        <L label="DESCRIÇÃO *"><input className="input-o" value={d.descricao || ""} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Troca de pastilhas" /></L>
        <L label="RESPONSÁVEL / MECÂNICO"><input className="input-o" value={d.responsavel || ""} onChange={e => set("responsavel", e.target.value)} /></L>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <L label="HORAS"><input className="input-o" type="number" step={0.5} value={d.horas ?? ""} onChange={e => set("horas", e.target.value === "" ? null : Number(e.target.value))} /></L>
          <L label="R$/HORA"><input className="input-o" type="number" step={0.01} value={d.valorHora ?? ""} onChange={e => set("valorHora", e.target.value === "" ? null : Number(e.target.value))} /></L>
          <L label="CUSTO"><input className="input-o" type="number" step={0.01} value={d.custo ?? (custoAuto ?? "")} onChange={e => set("custo", e.target.value === "" ? null : Number(e.target.value))} /></L>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Anexos por categoria ──────────────────────────────────────────────────────────
function AnexoCat({ tipo, label, anexos, manutencaoId, canEdit, onChange }: { tipo: string; label: string; anexos: any[]; manutencaoId: string; canEdit: boolean; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const itens = anexos.filter(a => a.tipo === tipo);
  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file); fd.append("tipo", tipo);
    try { await api.post(`/frota/manutencoes/${manutencaoId}/anexos`, fd); onChange(); }
    catch {} finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const remove = async (anexoId: string) => { if (!confirm("Remover anexo?")) return; try { await api.delete(`/frota/manutencoes/${manutencaoId}/anexos/${anexoId}`); onChange(); } catch {} };

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
        {canEdit && (<>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={busy} onClick={() => inputRef.current?.click()}><Plus size={12} /> {busy ? "Enviando..." : "Anexar"}</button>
        </>)}
      </div>
      {itens.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum arquivo.</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {itens.map(a => {
          const isImg = (a.mime || "").startsWith("image/");
          return (
            <div key={a.id} style={{ width: 120, border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
              <a href={a.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                {isImg ? <img src={a.url} alt={a.nomeOriginal} style={{ width: "100%", height: 80, objectFit: "cover" }} />
                  : <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-hover)" }}><FileText size={28} style={{ color: "var(--text-muted)" }} /></div>}
              </a>
              <div style={{ padding: "4px 6px", fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nomeOriginal}</div>
              {canEdit && <button className="btn-icon" style={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, background: "rgba(0,0,0,0.4)", color: "#fff" }} onClick={() => remove(a.id)}><Trash2 size={11} /></button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustoCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${color}`, minWidth: 130 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{fmtMoney(value)}</div>
    </div>
  );
}

export default function ManutencaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [m, setM] = useState<any>(null);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moOpen, setMoOpen] = useState(false);
  const canEdit = hasPerms(user, "frota:editar");

  const loadAnexos = useCallback(() => { api.get(`/frota/manutencoes/${id}/anexos`).then(r => setAnexos(r.data || [])).catch(() => {}); }, [id]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const [d] = await Promise.all([api.get(`/frota/manutencoes/${id}`), loadAnexos()]); setM(d.data); }
    catch { setM(null); } finally { setLoading(false); }
  }, [id, loadAnexos]);
  useEffect(() => { load(); }, [load]);

  const delMo = async (moId: string) => { if (!confirm("Remover apontamento?")) return; try { await api.delete(`/frota/manutencoes/${id}/mao-obra/${moId}`); load(); } catch {} };

  if (loading) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Carregando...</main></div>;
  if (!m) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Ordem de serviço não encontrada.</main></div>;

  const st = STATUS[m.status] || { label: m.status, color: "var(--text-muted)" };
  const maoObra = m.maoObra || [];
  const custoMo = maoObra.reduce((s: number, x: any) => s + (x.custo || 0), 0);
  const total = (m.custoPecas || 0) + (m.custoServicos || 0) + (m.custoTerceiros || 0) + custoMo;
  const INFO: [string, any][] = [
    ["Veículo", m.veiculo?.placa], ["Tipo", TIPO_LABEL[m.tipo] || m.tipo], ["Solicitante", m.solicitante?.nome],
    ["Oficina", m.oficina], ["Fornecedor", m.fornecedor], ["Abertura", fmtDate(m.dataAbertura)],
    ["Fechamento", fmtDate(m.dataFechamento)], ["KM", m.km != null ? Number(m.km).toLocaleString("pt-BR") : null],
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {canEdit && <button className="btn btn-violet text-xs" onClick={() => setMoOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Mão de obra</button>}
      </Topbar>
      <main className="flex-1 overflow-y-auto p-6">
        <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/frota/manutencoes")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={14} /> Voltar</button>

        {/* Header */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 18, borderLeft: `3px solid ${st.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.numeroOs || "OS"}</h2>
            <Badge color={st.color}>{st.label}</Badge>
          </div>
          {m.descricao && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{m.descricao}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {INFO.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{v}</div></div>
            ))}
          </div>
        </div>

        {/* Custos */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>CUSTOS DA MANUTENÇÃO</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          <CustoCard label="PEÇAS" value={m.custoPecas || 0} color="var(--accent-cyan)" />
          <CustoCard label="SERVIÇOS" value={m.custoServicos || 0} color="var(--accent-amber)" />
          <CustoCard label="TERCEIROS" value={m.custoTerceiros || 0} color="#f97316" />
          <CustoCard label="MÃO DE OBRA" value={custoMo} color="#8b5cf6" />
          <CustoCard label="TOTAL" value={total} color="var(--accent-green)" />
        </div>

        {/* Mão de obra */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>APONTAMENTO DE MÃO DE OBRA</div>
        <div className="card" style={{ overflow: "hidden", marginBottom: 22 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["Descrição", "Responsável", "Horas", "R$/h", "Custo", ""].map(h => <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {maoObra.length === 0 && <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "var(--text-muted)" }}>Nenhum apontamento.</td></tr>}
              {maoObra.map((x: any) => (
                <tr key={x.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "10px 14px" }}>{x.descricao}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{x.responsavel || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>{x.horas ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}>{fmtMoney(x.valorHora)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmtMoney(x.custo)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{canEdit && <button className="btn-icon" onClick={() => delMo(x.id)} style={{ color: "var(--accent-red)" }}><Trash2 size={13} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Anexos */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>ANEXOS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {ANEXO_CATS.map(c => <AnexoCat key={c.tipo} tipo={c.tipo} label={c.label} anexos={anexos} manutencaoId={id} canEdit={canEdit} onChange={loadAnexos} />)}
        </div>
      </main>

      {moOpen && <MaoObraModal manutencaoId={id} onSaved={() => { setMoOpen(false); load(); }} onClose={() => setMoOpen(false)} />}
    </div>
  );
}
