"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, fmtMoney } from "../_components/crud";
import { Plus, Pencil, Trash2, X, CheckCircle2, ChevronLeft, CalendarDays } from "lucide-react";

const TIPO_OPTS = [
  { value: "troca_oleo", label: "Troca de óleo" }, { value: "filtros", label: "Filtros" },
  { value: "correias", label: "Correias" }, { value: "freios", label: "Freios" },
  { value: "suspensao", label: "Suspensão" }, { value: "revisao_geral", label: "Revisão geral" },
];
const BASE_OPTS = [{ value: "km", label: "KM" }, { value: "data", label: "Data" }, { value: "horimetro", label: "Horímetro" }];
const STATUS_OPTS = [
  { value: "agendada", label: "Agendada" }, { value: "realizada", label: "Realizada" },
  { value: "atrasada", label: "Atrasada" }, { value: "cancelada", label: "Cancelada" },
];
const STATUS_COLOR: Record<string, string> = { agendada: "var(--accent-cyan)", realizada: "var(--accent-green)", atrasada: "var(--accent-red)", cancelada: "var(--text-muted)" };
const FAROL: Record<string, { color: string; label: string }> = {
  verde: { color: "#22c55e", label: "Em dia" }, amarelo: { color: "#eab308", label: "Atenção" },
  laranja: { color: "#f97316", label: "Próxima" }, vermelho: { color: "#ef4444", label: "Vencida/Crítica" },
  cinza: { color: "var(--text-muted)", label: "Sem dado" },
};
const tipoLabel = (t: string) => TIPO_OPTS.find(o => o.value === t)?.label || t;
const num = (v: any) => v != null ? Number(v).toLocaleString("pt-BR") : "—";
const hasPerms = (user: any, ...perms: string[]) => user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

const FieldLabel = ({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) => (
  <div style={full ? { gridColumn: "1/-1" } : undefined}>
    <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{label}</label>
    {children}
  </div>
);

function FarolDot({ farol }: { farol: string }) {
  const f = FAROL[farol] || FAROL.cinza;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: f.color, boxShadow: `0 0 6px ${f.color}80` }} /><span style={{ fontSize: 12 }}>{f.label}</span></span>;
}

// ── Modal de plano ────────────────────────────────────────────────────────────────
function PlanoModal({ plano, onSaved, onClose }: { plano?: any; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>(plano || { base: "km", tipo: "troca_oleo", ativo: true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const isEdit = !!plano?.id;

  const save = async () => {
    if (!d.modelo?.trim()) { setErr("Informe o modelo"); return; }
    setSaving(true); setErr("");
    try { if (isEdit) await api.put(`/frota/planos-revisao/${plano.id}`, d); else await api.post("/frota/planos-revisao", d); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro"); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>{isEdit ? "Editar plano" : "Novo plano de revisão"}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldLabel label="MODELO *"><input className="input-o" value={d.modelo || ""} onChange={e => set("modelo", e.target.value)} placeholder="Ex: Saveiro" /></FieldLabel>
          <FieldLabel label="MARCA (opcional)"><input className="input-o" value={d.marca || ""} onChange={e => set("marca", e.target.value)} placeholder="Ex: VW" /></FieldLabel>
          <FieldLabel label="TIPO">
            <select className="input-o" value={d.tipo} onChange={e => set("tipo", e.target.value)}>{TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </FieldLabel>
          <FieldLabel label="BASE">
            <select className="input-o" value={d.base} onChange={e => set("base", e.target.value)}>{BASE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </FieldLabel>
          {d.base === "km" && <FieldLabel label="INTERVALO (KM)"><input className="input-o" type="number" value={d.intervaloKm ?? ""} onChange={e => set("intervaloKm", e.target.value === "" ? null : Number(e.target.value))} placeholder="Ex: 10000" /></FieldLabel>}
          {d.base === "data" && <FieldLabel label="INTERVALO (DIAS)"><input className="input-o" type="number" value={d.intervaloDias ?? ""} onChange={e => set("intervaloDias", e.target.value === "" ? null : Number(e.target.value))} placeholder="Ex: 365" /></FieldLabel>}
          {d.base === "horimetro" && <FieldLabel label="INTERVALO (HORAS)"><input className="input-o" type="number" value={d.intervaloHorimetro ?? ""} onChange={e => set("intervaloHorimetro", e.target.value === "" ? null : Number(e.target.value))} placeholder="Ex: 500" /></FieldLabel>}
          <FieldLabel label="ATIVO">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingTop: 6 }}><input type="checkbox" checked={d.ativo !== false} onChange={e => set("ativo", e.target.checked)} style={{ width: 16, height: 16 }} /> Plano ativo</label>
          </FieldLabel>
          <FieldLabel label="OBSERVAÇÕES" full><input className="input-o" value={d.observacoes || ""} onChange={e => set("observacoes", e.target.value)} /></FieldLabel>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de registro de revisão ──────────────────────────────────────────────────
function RegistroModal({ registro, veiculos, onSaved, onClose }: { registro?: any; veiculos: any[]; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>(registro || { status: "agendada", tipo: "troca_oleo" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const isEdit = !!registro?.id;

  const save = async () => {
    if (!d.veiculoId) { setErr("Selecione o veículo"); return; }
    setSaving(true); setErr("");
    try { if (isEdit) await api.put(`/frota/revisoes/${registro.id}`, d); else await api.post("/frota/revisoes", d); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro"); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>{isEdit ? "Editar revisão" : "Registrar revisão"}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldLabel label="VEÍCULO *">
            <select className="input-o" value={d.veiculoId || ""} onChange={e => set("veiculoId", e.target.value)}>
              <option value="">—</option>{veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ""}</option>)}
            </select>
          </FieldLabel>
          <FieldLabel label="TIPO"><select className="input-o" value={d.tipo || "troca_oleo"} onChange={e => set("tipo", e.target.value)}>{TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></FieldLabel>
          <FieldLabel label="STATUS"><select className="input-o" value={d.status || "agendada"} onChange={e => set("status", e.target.value)}>{STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></FieldLabel>
          <FieldLabel label="OFICINA"><input className="input-o" value={d.oficina || ""} onChange={e => set("oficina", e.target.value)} /></FieldLabel>
          <FieldLabel label="DATA PREVISTA"><input className="input-o" type="date" value={d.dataPrevista ? String(d.dataPrevista).slice(0, 10) : ""} onChange={e => set("dataPrevista", e.target.value || null)} /></FieldLabel>
          <FieldLabel label="KM PREVISTO"><input className="input-o" type="number" value={d.kmPrevisto ?? ""} onChange={e => set("kmPrevisto", e.target.value === "" ? null : Number(e.target.value))} /></FieldLabel>
          <FieldLabel label="DATA REALIZADA"><input className="input-o" type="date" value={d.dataRealizada ? String(d.dataRealizada).slice(0, 10) : ""} onChange={e => set("dataRealizada", e.target.value || null)} /></FieldLabel>
          <FieldLabel label="KM REALIZADO"><input className="input-o" type="number" value={d.kmRealizado ?? ""} onChange={e => set("kmRealizado", e.target.value === "" ? null : Number(e.target.value))} /></FieldLabel>
          <FieldLabel label="HORÍMETRO"><input className="input-o" type="number" value={d.horimetro ?? ""} onChange={e => set("horimetro", e.target.value === "" ? null : Number(e.target.value))} /></FieldLabel>
          <FieldLabel label="CUSTO (R$)"><input className="input-o" type="number" step={0.01} value={d.custo ?? ""} onChange={e => set("custo", e.target.value === "" ? null : Number(e.target.value))} /></FieldLabel>
          <FieldLabel label="OBSERVAÇÕES" full><input className="input-o" value={d.observacoes || ""} onChange={e => set("observacoes", e.target.value)} /></FieldLabel>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

const TABS = [{ id: "agenda", label: "Agenda" }, { id: "planos", label: "Planos" }, { id: "registros", label: "Registros" }];

export default function RevisoesPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState("agenda");
  const [agenda, setAgenda] = useState<any>(null);
  const [planos, setPlanos] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [planoEdit, setPlanoEdit] = useState<any | null>(null);
  const [planoNew, setPlanoNew] = useState(false);
  const [regEdit, setRegEdit] = useState<any | null>(null);
  const [regNew, setRegNew] = useState(false);
  const [msg, setMsg] = useState("");
  const canCreate = hasPerms(user, "frota:criar");
  const canConfig = hasPerms(user, "frota:configurar");
  const canEdit = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const loadAgenda = useCallback(() => { api.get("/frota/revisoes-agenda").then(r => setAgenda(r.data)).catch(() => {}); }, []);
  const loadPlanos = useCallback(() => { api.get("/frota/planos-revisao", { params: { limit: 200 } }).then(r => setPlanos(r.data?.items || [])).catch(() => {}); }, []);
  const loadReg = useCallback(() => { api.get("/frota/revisoes", { params: { limit: 100 } }).then(r => setRegistros(r.data?.items || [])).catch(() => {}); }, []);
  useEffect(() => { loadAgenda(); loadPlanos(); loadReg(); api.get("/frota/veiculos", { params: { limit: 200 } }).then(r => setVeiculos(r.data?.items || [])).catch(() => {}); }, [loadAgenda, loadPlanos, loadReg]);

  const registrarDaAgenda = (item: any) => {
    const v = veiculos.find(x => x.id === item.veiculoId);
    setRegEdit({ veiculoId: item.veiculoId, tipo: item.tipo, status: "realizada", dataRealizada: new Date().toISOString().slice(0, 10), kmRealizado: v?.kmAtual ?? null });
  };
  const delPlano = async (p: any) => { if (!confirm("Excluir plano?")) return; try { await api.delete(`/frota/planos-revisao/${p.id}`); loadPlanos(); loadAgenda(); } catch {} };
  const delReg = async (r: any) => { if (!confirm("Excluir registro?")) return; try { await api.delete(`/frota/revisoes/${r.id}`); loadReg(); loadAgenda(); } catch {} };

  const onPlanoSaved = () => { setPlanoNew(false); setPlanoEdit(null); loadPlanos(); loadAgenda(); showMsg("Plano salvo!"); };
  const onRegSaved = () => { setRegNew(false); setRegEdit(null); loadReg(); loadAgenda(); showMsg("Revisão salva!"); };

  const proxText = (i: any) => {
    if (i.semDado) return "Sem horímetro";
    if (i.unidade === "dias") return `${fmtDate(i.proximaData)} (${i.restante}d)`;
    if (i.unidade === "h") return `${num(i.proximaHorimetro)} h (${num(i.restante)} h)`;
    return `${num(i.proximaKm)} km (${num(i.restante)} km)`;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
      </Topbar>

      <main className="flex-1 overflow-y-auto page-content">
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>
          
          {/* Back link */}
          <Link href="/dashboard/frota" className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-3" style={{ textDecoration: "none", transition: "colors 0.2s" }}>
            <ChevronLeft size={12} /> Voltar para o Dashboard de Frota
          </Link>

          {/* Header Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-violet)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(99,102,241,0.6)", flexShrink: 0 }}>
              <CalendarDays size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Revisões Preventivas</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>
                Agenda de manutenções programadas por KM, data ou horímetro
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tab === "planos" && canConfig && (
                <button className="btn btn-violet" onClick={() => setPlanoNew(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Novo plano
                </button>
              )}
              {tab === "registros" && canCreate && (
                <button className="btn btn-violet" onClick={() => setRegNew(true)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Nova revisão
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)", borderBottom: tab === t.id ? "2px solid var(--accent-violet, #8b5cf6)" : "2px solid transparent", background: "none" }}>{t.label}</button>
            ))}
          </div>

          {/* AGENDA */}
          {tab === "agenda" && (
            <>
              {agenda?.resumo && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                  {["vermelho", "laranja", "amarelo", "verde"].map(k => (
                    <div key={k} className="card-premium" style={{ padding: "12px 16px", borderLeft: `3px solid ${FAROL[k].color}`, minWidth: 130, flex: "1 1 auto" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: FAROL[k].color, fontFamily: "var(--font-display)", lineHeight: 1.1 }}>{agenda.resumo[k] || 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>{FAROL[k].label}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="card-premium overflow-hidden">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                        {["Farol", "Veículo", "Tipo", "Base", "Última", "Próxima revisão", ""].map((h, i) => (
                          <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!agenda && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</td></tr>}
                      {agenda && agenda.itens.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhuma revisão prevista. Cadastre planos por modelo na aba Planos.</td></tr>}
                      {agenda?.itens.map((i: any, idx: number) => (
                        <tr key={idx} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                          <td style={{ padding: "12px 16px", verticalAlign: "middle" }}><FarolDot farol={i.farol} /></td>
                          <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)", verticalAlign: "middle" }}>{i.placa}</td>
                          <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{tipoLabel(i.tipo)}</td>
                          <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{BASE_OPTS.find(b => b.value === i.baseTipo)?.label}</td>
                          <td style={{ padding: "12px 16px", color: "var(--text-muted)", verticalAlign: "middle" }}>{i.ultimaData ? fmtDate(i.ultimaData) : (i.ultimaKm != null ? `${num(i.ultimaKm)} km` : "—")}</td>
                          <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{proxText(i)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", verticalAlign: "middle" }}>
                            {canEdit && (
                              <button className="btn btn-ghost text-xs" style={{ display: "inline-flex", gap: 4, alignItems: "center" }} onClick={() => registrarDaAgenda(i)}>
                                <CheckCircle2 size={13} /> Registrar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* PLANOS */}
          {tab === "planos" && (
            <div className="card-premium overflow-hidden">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      {["Modelo", "Marca", "Tipo", "Base", "Intervalo", "Ativo", ""].map((h, i) => (
                        <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planos.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum plano cadastrado. Ex: Saveiro · Troca de óleo · 10.000 km.</td></tr>}
                    {planos.map(p => (
                      <tr key={p.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", verticalAlign: "middle" }}>{p.modelo}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)", verticalAlign: "middle" }}>{p.marca || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{tipoLabel(p.tipo)}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{BASE_OPTS.find(b => b.value === p.base)?.label}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{p.base === "km" ? `${num(p.intervaloKm)} km` : p.base === "data" ? `${num(p.intervaloDias)} dias` : `${num(p.intervaloHorimetro)} h`}</td>
                        <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>{p.ativo ? <Badge color="var(--accent-green)">Sim</Badge> : <Badge>Não</Badge>}</td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            {canConfig && <button className="btn-icon" title="Editar" onClick={() => setPlanoEdit(p)}><Pencil size={14} /></button>}
                            {canConfig && <button className="btn-icon" title="Excluir" onClick={() => delPlano(p)} style={{ color: "var(--accent-red)" }}><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REGISTROS */}
          {tab === "registros" && (
            <div className="card-premium overflow-hidden">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      {["Veículo", "Tipo", "Prevista", "Realizada", "Custo", "Status", ""].map((h, i) => (
                        <th key={i} style={{ textAlign: "left", padding: "12px 16px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registros.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nenhum registro encontrado.</td></tr>}
                    {registros.map(r => (
                      <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)", verticalAlign: "middle" }}>{r.veiculo?.placa || "—"}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{tipoLabel(r.tipo)}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{fmtDate(r.dataPrevista)}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{fmtDate(r.dataRealizada)}</td>
                        <td style={{ padding: "12px 16px", color: "var(--text-primary)", verticalAlign: "middle" }}>{fmtMoney(r.custo)}</td>
                        <td style={{ padding: "12px 16px", verticalAlign: "middle" }}><Badge color={STATUS_COLOR[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge></td>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            {canEdit && <button className="btn-icon" title="Editar" onClick={() => setRegEdit(r)}><Pencil size={14} /></button>}
                            {canDelete && <button className="btn-icon" title="Excluir" onClick={() => delReg(r)} style={{ color: "var(--accent-red)" }}><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {(planoNew || planoEdit) && <PlanoModal plano={planoEdit || undefined} onSaved={onPlanoSaved} onClose={() => { setPlanoNew(false); setPlanoEdit(null); }} />}
      {(regNew || regEdit) && <RegistroModal registro={regEdit || undefined} veiculos={veiculos} onSaved={onRegSaved} onClose={() => { setRegNew(false); setRegEdit(null); }} />}
    </div>
  );
}
