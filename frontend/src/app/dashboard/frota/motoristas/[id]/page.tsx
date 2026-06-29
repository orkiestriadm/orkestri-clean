"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, cnhStatus } from "../../_components/crud";
import { ArrowLeft, X, Plus, Trash2, FileText, RefreshCw } from "lucide-react";

const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));
const CNH_OPTS = ["A", "B", "AB", "C", "D", "E"].map(v => ({ value: v, label: v }));
const ANEXO_CATS = [
  { tipo: "cnh_frente", label: "CNH — Frente" },
  { tipo: "cnh_verso", label: "CNH — Verso" },
  { tipo: "exame", label: "Exames" },
  { tipo: "certificado", label: "Certificados" },
];

// ── Modal Renovar CNH ────────────────────────────────────────────────────────────
function RenovarModal({ motorista, onSaved, onClose }: { motorista: any; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>({ numeroNovo: motorista.cnh || "", categoriaNova: motorista.categoriaCnh || "", orgaoEmissor: motorista.orgaoEmissor || "", dataRenovacao: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!d.validadeNova) { setErr("Informe a nova validade"); return; }
    setSaving(true); setErr("");
    try { await api.post(`/frota/motoristas/${motorista.id}/renovar`, d); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro ao renovar"); setSaving(false); }
  };
  const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{label}</label>{children}</div>
  );

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Renovar CNH</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <L label="NOVO NÚMERO"><input className="input-o" value={d.numeroNovo || ""} onChange={e => set("numeroNovo", e.target.value)} /></L>
          <L label="CATEGORIA">
            <select className="input-o" value={d.categoriaNova || ""} onChange={e => set("categoriaNova", e.target.value || null)}>
              <option value="">—</option>
              {CNH_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </L>
          <L label="NOVA VALIDADE *"><input className="input-o" type="date" value={d.validadeNova || ""} onChange={e => set("validadeNova", e.target.value || null)} /></L>
          <L label="EMISSÃO"><input className="input-o" type="date" value={d.dataRenovacao || ""} onChange={e => set("dataRenovacao", e.target.value || null)} /></L>
          <L label="ÓRGÃO EMISSOR"><input className="input-o" value={d.orgaoEmissor || ""} onChange={e => set("orgaoEmissor", e.target.value)} /></L>
        </div>
        <L label="OBSERVAÇÕES"><input className="input-o" value={d.observacoes || ""} onChange={e => set("observacoes", e.target.value)} /></L>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Renovar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Bloco de anexos por categoria ────────────────────────────────────────────────
function AnexoCat({ tipo, label, anexos, motoristaId, canEdit, onChange }: { tipo: string; label: string; anexos: any[]; motoristaId: string; canEdit: boolean; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const itens = anexos.filter(a => a.tipo === tipo);

  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file); fd.append("tipo", tipo);
    try { await api.post(`/frota/motoristas/${motoristaId}/anexos`, fd); onChange(); }
    catch {} finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const remove = async (anexoId: string) => {
    if (!confirm("Remover anexo?")) return;
    try { await api.delete(`/frota/motoristas/${motoristaId}/anexos/${anexoId}`); onChange(); } catch {}
  };

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={busy} onClick={() => inputRef.current?.click()}>
              <Plus size={12} /> {busy ? "Enviando..." : "Anexar"}
            </button>
          </>
        )}
      </div>
      {itens.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum arquivo.</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {itens.map(a => {
          const isImg = (a.mime || "").startsWith("image/");
          return (
            <div key={a.id} style={{ width: 120, border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
              <a href={a.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                {isImg
                  ? <img src={a.url} alt={a.nomeOriginal} style={{ width: "100%", height: 80, objectFit: "cover" }} />
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

export default function MotoristaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [m, setM] = useState<any>(null);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [renovacoes, setRenovacoes] = useState<any[]>([]);
  const [bloqueio, setBloqueio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [renovOpen, setRenovOpen] = useState(false);
  const canEdit = hasPerms(user, "frota:editar");

  const loadAnexos = useCallback(() => { api.get(`/frota/motoristas/${id}/anexos`).then(r => setAnexos(r.data || [])).catch(() => {}); }, [id]);
  const loadRenov = useCallback(() => { api.get(`/frota/motoristas/${id}/renovacoes`).then(r => setRenovacoes(r.data || [])).catch(() => {}); }, [id]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d] = await Promise.all([api.get(`/frota/motoristas/${id}`), loadAnexos(), loadRenov()]);
      setM(d.data);
      api.get("/frota/motoristas/cnh/dashboard").then(r => setBloqueio(!!r.data?.bloqueioCnhVencida)).catch(() => {});
    } catch { setM(null); } finally { setLoading(false); }
  }, [id, loadAnexos, loadRenov]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Carregando...</main></div>;
  if (!m) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Motorista não encontrado.</main></div>;

  const cnh = cnhStatus(m.validadeCnh, bloqueio);
  const INFO: [string, any][] = [
    ["CPF", m.cpf], ["Matrícula", m.matricula], ["Telefone", m.telefone], ["E-mail", m.email],
    ["Departamento", m.departamento], ["Cargo", m.cargo], ["Vínculo", m.userId ? "Usuário do sistema" : "Externo"],
    ["CNH", m.cnh], ["Categoria", m.categoriaCnh], ["Emissão", fmtDate(m.cnhEmissao)],
    ["Validade", fmtDate(m.validadeCnh)], ["Órgão emissor", m.orgaoEmissor],
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {canEdit && <button className="btn btn-violet text-xs" onClick={() => setRenovOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={14} /> Renovar CNH</button>}
      </Topbar>
      <main className="flex-1 overflow-y-auto p-6">
        <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/frota/motoristas")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={14} /> Voltar</button>

        {/* Header */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 18, borderLeft: `3px solid ${cnh.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{m.nome}</h2>
            <Badge color={cnh.color}>CNH: {cnh.label}</Badge>
            {m.status !== "ativo" && <Badge>{m.status}</Badge>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
            {INFO.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Anexos */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>DOCUMENTOS E ANEXOS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 22 }}>
          {ANEXO_CATS.map(c => <AnexoCat key={c.tipo} tipo={c.tipo} label={c.label} anexos={anexos} motoristaId={id} canEdit={canEdit} onChange={loadAnexos} />)}
        </div>

        {/* Histórico de renovações */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>HISTÓRICO DE RENOVAÇÕES</div>
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {["Data", "Validade anterior", "Validade nova", "Categoria", "Órgão", "Obs."].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renovacoes.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Nenhuma renovação registrada.</td></tr>}
              {renovacoes.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "10px 14px" }}>{fmtDate(r.dataRenovacao)}</td>
                  <td style={{ padding: "10px 14px" }}>{fmtDate(r.validadeAnterior)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{fmtDate(r.validadeNova)}</td>
                  <td style={{ padding: "10px 14px" }}>{r.categoriaNova || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>{r.orgaoEmissor || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{r.observacoes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {renovOpen && <RenovarModal motorista={m} onSaved={() => { setRenovOpen(false); load(); }} onClose={() => setRenovOpen(false)} />}
    </div>
  );
}
