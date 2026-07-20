"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, fmtMoney } from "../_components/crud";
import { Plus, Pencil, Trash2, X, CheckCircle2, ChevronLeft, CalendarDays, RefreshCw, Search, Filter } from "lucide-react";

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
// ── Controles de busca / filtro ─────────────────────────────────────────────────
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
      <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
      <input className="input-o" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ paddingLeft: 34, width: "100%" }} />
    </div>
  );
}
function Sel({ value, onChange, children, minW = 128 }: { value: string; onChange: (v: string) => void; children: React.ReactNode; minW?: number }) {
  return <select className="input-o" value={value} onChange={e => onChange(e.target.value)} style={{ minWidth: minW, flex: "0 0 auto" }}>{children}</select>;
}

function PlanoModal({ plano, veiculos, onSaved, onClose }: { plano?: any; veiculos: any[]; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>(plano || { base: "km", tipo: "troca_oleo", ativo: true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const isEdit = !!plano?.id;
  const escolherVeiculo = (vid: string) => {
    const v = veiculos.find((x: any) => x.id === vid);
    setD((p: any) => ({ ...p, veiculoId: vid || null, ...(v ? { modelo: v.modelo || v.placa, marca: v.marca || p.marca } : {}) }));
  };

  const save = async () => {
    if (!d.veiculoId && !d.modelo?.trim()) { setErr("Escolha um veículo específico ou informe o modelo"); return; }
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
          <FieldLabel label="VEÍCULO ESPECÍFICO (opcional)" full>
            <select className="input-o" value={d.veiculoId || ""} onChange={e => escolherVeiculo(e.target.value)}>
              <option value="">— Aplicar por modelo (todos do modelo) —</option>
              {veiculos.map((v: any) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` · ${v.modelo}` : ""}</option>)}
            </select>
          </FieldLabel>
          <FieldLabel label={d.veiculoId ? "MODELO (do veículo)" : "MODELO *"}><input className="input-o" value={d.modelo || ""} onChange={e => set("modelo", e.target.value)} placeholder="Ex: Saveiro" disabled={!!d.veiculoId} /></FieldLabel>
          <FieldLabel label="MARCA (opcional)"><input className="input-o" value={d.marca || ""} onChange={e => set("marca", e.target.value)} placeholder="Ex: VW" disabled={!!d.veiculoId} /></FieldLabel>
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

const TABS = [{ id: "agenda_km", label: "Agenda KM" }, { id: "agenda_data", label: "Agenda Data" }, { id: "planos", label: "Planos" }, { id: "registros", label: "Registros" }];

export default function RevisoesPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState("agenda_km");
  const [agenda, setAgenda] = useState<any>(null);
  const [planos, setPlanos] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [planoEdit, setPlanoEdit] = useState<any | null>(null);
  const [planoNew, setPlanoNew] = useState(false);
  const [regEdit, setRegEdit] = useState<any | null>(null);
  const [regNew, setRegNew] = useState(false);
  const [msg, setMsg] = useState("");
  // filtros
  const [qAg, setQAg] = useState(""); const [fFarol, setFFarol] = useState(""); const [fTipoAg, setFTipoAg] = useState(""); const [fAgendado, setFAgendado] = useState(false);
  const [qPl, setQPl] = useState(""); const [fTipoPl, setFTipoPl] = useState(""); const [fBasePl, setFBasePl] = useState(""); const [fAtivoPl, setFAtivoPl] = useState("");
  const [qReg, setQReg] = useState(""); const [fTipoReg, setFTipoReg] = useState(""); const [fStatusReg, setFStatusReg] = useState("");
  const canCreate = hasPerms(user, "frota:criar");
  const canConfig = hasPerms(user, "frota:configurar");
  const canEdit = hasPerms(user, "frota:editar");
  const canDelete = hasPerms(user, "frota:excluir");
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };
  const [syncing, setSyncing] = useState(false);
  const sincronizarKm = async () => {
    setSyncing(true);
    try {
      const r = await api.post("/frota/veiculos/km/sincronizar");
      showMsg(`KM atualizado via abastecimento: ${r.data?.atualizados ?? 0} veiculo(s).`);
      loadAgenda();
    } catch (e: any) { showMsg("Erro ao atualizar KM: " + (e?.response?.data?.message || "")); }
    finally { setSyncing(false); }
  };

  const loadAgenda = useCallback(() => { api.get("/frota/revisoes-agenda").then(r => setAgenda(r.data)).catch(() => {}); }, []);
  const loadPlanos = useCallback(() => { api.get("/frota/planos-revisao", { params: { limit: 200 } }).then(r => setPlanos(r.data?.items || [])).catch(() => {}); }, []);
  const loadReg = useCallback(() => { api.get("/frota/revisoes", { params: { limit: 100 } }).then(r => setRegistros(r.data?.items || [])).catch(() => {}); }, []);
  useEffect(() => { loadAgenda(); loadPlanos(); loadReg(); api.get("/frota/veiculos", { params: { limit: 200 } }).then(r => setVeiculos(r.data?.items || [])).catch(() => {}); }, [loadAgenda, loadPlanos, loadReg]);

  const registrarDaAgenda = (item: any) => {
    const v = veiculos.find(x => x.id === item.veiculoId);
    const hoje = new Date().toISOString().slice(0, 10);
    const kmHoje = v?.kmAtual ?? null;
    if (item.registroId) {
      // Item é um AGENDAMENTO: registrar = fechar aquele registro (marca realizada),
      // preservando os dados existentes (data prevista, oficina, etc.).
      const reg = registros.find((r: any) => r.id === item.registroId);
      setRegEdit({ ...(reg || {}), id: item.registroId, veiculoId: item.veiculoId, tipo: item.tipo, status: "realizada", dataRealizada: hoje, kmRealizado: reg?.kmRealizado ?? kmHoje });
    } else {
      setRegEdit({ veiculoId: item.veiculoId, tipo: item.tipo, status: "realizada", dataRealizada: hoje, kmRealizado: kmHoje });
    }
  };
  const delPlano = async (p: any) => { if (!confirm("Excluir plano?")) return; try { await api.delete(`/frota/planos-revisao/${p.id}`); loadPlanos(); loadAgenda(); } catch {} };
  const delReg = async (r: any) => { if (!confirm("Excluir registro?")) return; try { await api.delete(`/frota/revisoes/${r.id}`); loadReg(); loadAgenda(); } catch {} };

  const onPlanoSaved = () => { setPlanoNew(false); setPlanoEdit(null); loadPlanos(); loadAgenda(); showMsg("Plano salvo!"); };
  const onRegSaved = () => { setRegNew(false); setRegEdit(null); loadReg(); loadAgenda(); showMsg("Revisão salva!"); };

  const proxVal = (i: any) => i.semDado ? "—" : i.unidade === "dias" ? fmtDate(i.proximaData) : i.unidade === "h" ? `${num(i.proximaHorimetro)} h` : `${num(i.proximaKm)} km`;
  const restVal = (i: any) => {
    if (i.semDado) return "sem dado";
    const r = i.restante;
    if (i.unidade === "dias") return r <= 0 ? `vencida há ${Math.abs(r)} dias` : `${r} dias`;
    if (i.unidade === "h") return r <= 0 ? `vencida (${num(Math.abs(r))} h)` : `${num(r)} h`;
    return r <= 0 ? `vencida (${num(Math.abs(r))} km)` : `${num(r)} km`;
  };
  const atualVal = (i: any) => i.unidade === "h" ? (i.atual != null ? `${num(i.atual)} h` : "—") : (i.kmAtual != null ? `${num(i.kmAtual)} km` : "—");

  // filtragem client-side
  const baseAg = tab === "agenda_km"
    ? (agenda?.itens || []).filter((i: any) => i.baseTipo !== "data")
    : registros
        .filter((r: any) => r.status === "agendada" || r.status === "atrasada")
        .map((r: any) => {
          let diffDays = null;
          let farol = "cinza";
          if (r.dataPrevista) {
            const d = new Date(r.dataPrevista);
            const hoje = new Date();
            diffDays = Math.ceil((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            if (r.status === "atrasada" || diffDays < 0) farol = "vermelho";
            else if (diffDays <= 7) farol = "laranja";
            else if (diffDays <= 15) farol = "amarelo";
            else farol = "verde";
          } else {
            farol = r.status === "atrasada" ? "vermelho" : "amarelo";
          }
          let pct = 0;
          if (diffDays != null) {
            if (diffDays <= 0) pct = 1;
            else if (diffDays > 30) pct = 0;
            else pct = (30 - diffDays) / 30;
          }
          return {
            registroId: r.id,
            veiculoId: r.veiculoId,
            placa: r.veiculo?.placa || "—",
            modelo: r.veiculo?.modelo || "",
            tipo: r.tipo,
            baseTipo: "data",
            farol,
            agendamento: true,
            proximaData: r.dataPrevista,
            restante: diffDays,
            semDado: !r.dataPrevista,
            unidade: "dias",
            pct,
            kmAtual: r.veiculo?.kmAtual
          };
        });

  const resumoDyn = {
    verde: baseAg.filter((i: any) => i.farol === "verde").length,
    amarelo: baseAg.filter((i: any) => i.farol === "amarelo").length,
    laranja: baseAg.filter((i: any) => i.farol === "laranja").length,
    vermelho: baseAg.filter((i: any) => i.farol === "vermelho").length,
  };

  const itensAg = baseAg.filter((i: any) => {
    if (fFarol && i.farol !== fFarol) return false;
    if (fAgendado && !i.agendamento) return false;
    if (fTipoAg && i.tipo !== fTipoAg) return false;
    if (qAg && !`${i.placa} ${i.modelo || ""} ${tipoLabel(i.tipo)}`.toLowerCase().includes(qAg.toLowerCase())) return false;
    return true;
  });
  const planosF = planos.filter((p: any) => {
    if (fTipoPl && p.tipo !== fTipoPl) return false;
    if (fBasePl && p.base !== fBasePl) return false;
    if (fAtivoPl && String(p.ativo ? 1 : 0) !== fAtivoPl) return false;
    if (qPl) { const vv = p.veiculoId ? veiculos.find((v: any) => v.id === p.veiculoId) : null; if (!`${p.modelo || ""} ${p.marca || ""} ${vv?.placa || ""} ${vv?.modelo || ""} ${tipoLabel(p.tipo)}`.toLowerCase().includes(qPl.toLowerCase())) return false; }
    return true;
  });
  const registrosF = registros.filter((r: any) => {
    if (fTipoReg && r.tipo !== fTipoReg) return false;
    if (fStatusReg && r.status !== fStatusReg) return false;
    if (qReg && !`${r.veiculo?.placa || ""} ${tipoLabel(r.tipo)}`.toLowerCase().includes(qReg.toLowerCase())) return false;
    return true;
  });

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
              {tab === "agenda_km" && canEdit && (
                <button className="btn btn-ghost" onClick={sincronizarKm} disabled={syncing} title="Puxa o KM do ultimo abastecimento de cada veiculo para atualizar a agenda" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={14} /> {syncing ? "Atualizando..." : "Atualizar KM (abastecimento)"}
                </button>
              )}
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

          {/* AGENDAS (KM e DATA) */}
          {(tab === "agenda_km" || tab === "agenda_data") && (
            <>
              <style>{`
                @keyframes revIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
                @keyframes revPulse { 0%,100% { box-shadow: 0 0 0 1px var(--rc), 0 0 22px -8px var(--rc); } 50% { box-shadow: 0 0 0 1px var(--rc), 0 0 44px 0 var(--rc); } }
                @keyframes revShimmer { from { transform: translateX(-100%); } to { transform: translateX(240%); } }
                .rev-card { animation: revIn .4s ease both; }
                .rev-card::before { content:""; position:absolute; inset:0; border-radius:14px; padding:1px; background:linear-gradient(140deg, var(--rc), transparent 42%); -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; opacity:.55; pointer-events:none; }
                .rev-card:hover { transform: translateY(-2px); }
                .rev-bar-fill::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation:revShimmer 2.6s infinite; }
              `}</style>

              {/* Painel de faróis (clique para filtrar) */}
              {agenda && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 12, marginBottom: 16 }}>
                  {["vermelho", "laranja", "amarelo", "verde"].map(k => {
                    const c = FAROL[k].color; const active = fFarol === k; const count = (resumoDyn as any)[k] || 0;
                    const critical = k === "vermelho" && count > 0;
                    return (
                      <button key={k} onClick={() => setFFarol(active ? "" : k)}
                        style={{ position: "relative", overflow: "hidden", textAlign: "left", cursor: "pointer", padding: "16px 18px", borderRadius: 14,
                          background: `radial-gradient(130% 130% at 100% 0%, ${c}22, transparent 58%), var(--bg-secondary)`,
                          border: `1px solid ${active ? c : "var(--border-subtle)"}`,
                          boxShadow: active ? `0 0 0 1px ${c}, 0 12px 36px -16px ${c}` : "0 6px 22px -16px rgba(0,0,0,.5)",
                          transition: "all .2s", ...(critical ? ({ ["--rc"]: c, animation: "revPulse 2.4s infinite" } as any) : {}) }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, boxShadow: `0 0 12px ${c}`, flexShrink: 0 }} />
                          <span style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{FAROL[k].label}</span>
                        </div>
                        <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-display)", color: c, lineHeight: 1, marginTop: 10, textShadow: `0 0 24px ${c}55` }}>{count}</div>
                        <span style={{ position: "absolute", right: 12, bottom: 11, fontSize: 8.5, fontFamily: "var(--font-mono)", color: active ? c : "var(--text-muted)", opacity: .85, textTransform: "uppercase", letterSpacing: "0.08em" }}>{active ? "● filtrando" : "filtrar"}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Busca + filtros */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <SearchBox value={qAg} onChange={setQAg} placeholder="Buscar por placa, modelo ou tipo..." />
                <Sel value={fTipoAg} onChange={setFTipoAg}><option value="">Todos os tipos</option>{TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Sel>
                {(qAg || fFarol || fTipoAg || fAgendado) && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQAg(""); setFFarol(""); setFTipoAg(""); setFAgendado(false); }}>Limpar</button>}
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{itensAg.length} de {baseAg.length}</span>
              </div>

              {/* Grid de cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
                {!agenda && <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</div>}
                {agenda && itensAg.length === 0 && <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{agenda.itens.length === 0 ? "Nenhuma revisão prevista. Cadastre planos na aba Planos." : "Nenhum resultado para o filtro."}</div>}
                {itensAg.map((i: any, idx: number) => {
                  const c = FAROL[i.farol].color; const pct = Math.round((i.pct ?? 0) * 100);
                  return (
                    <div key={idx} className="rev-card" style={{ position: "relative", borderRadius: 14, padding: "16px 18px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", transition: "transform .2s", animationDelay: `${idx * 28}ms`, ["--rc"]: c } as any}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 12px ${c}`, flexShrink: 0 }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.placa}</span>
                        </div>
                        <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: c, background: `${c}18`, border: `1px solid ${c}40`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>{FAROL[i.farol].label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {tipoLabel(i.tipo)} <span style={{ color: "var(--text-muted)" }}>· {BASE_OPTS.find(b => b.value === i.baseTipo)?.label}</span>
                        {i.agendamento && <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent-violet)", background: "var(--accent-violet-dim)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 5, padding: "1px 6px" }}>Agendada</span>}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div><div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Atual</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600 }}>{atualVal(i)}</div></div>
                        <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Próxima</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600 }}>{proxVal(i)}</div></div>
                      </div>
                      <div style={{ height: 8, borderRadius: 6, background: "var(--bg-hover)", overflow: "hidden", marginBottom: 7 }}>
                        <div className="rev-bar-fill" style={{ position: "relative", overflow: "hidden", height: "100%", width: `${Math.max(3, pct)}%`, borderRadius: 6, background: `linear-gradient(90deg, ${c}aa, ${c})`, boxShadow: `0 0 12px ${c}88` }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{i.semDado ? "sem dado" : (i.restante != null && i.restante <= 0 ? restVal(i) : `faltam ${restVal(i)}`)}</span>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: c }}>{pct}%</span>
                      </div>
                      {canEdit && !i.semDado && (
                        <button className="btn btn-ghost text-xs" onClick={() => registrarDaAgenda(i)} style={{ width: "100%", marginTop: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><CheckCircle2 size={13} /> Registrar revisão</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Omitido AGENDA DATA (agora usa o mesmo layout de AGENDA KM acima) */}

          {/* PLANOS */}
          {tab === "planos" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <SearchBox value={qPl} onChange={setQPl} placeholder="Buscar por veículo, modelo ou marca..." />
                <Sel value={fTipoPl} onChange={setFTipoPl}><option value="">Todos os tipos</option>{TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Sel>
                <Sel value={fBasePl} onChange={setFBasePl} minW={110}><option value="">Todas as bases</option>{BASE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Sel>
                <Sel value={fAtivoPl} onChange={setFAtivoPl} minW={116}><option value="">Ativo e inativo</option><option value="1">Só ativos</option><option value="0">Só inativos</option></Sel>
                {(qPl || fTipoPl || fBasePl || fAtivoPl) && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQPl(""); setFTipoPl(""); setFBasePl(""); setFAtivoPl(""); }}>Limpar</button>}
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{planosF.length} de {planos.length}</span>
              </div>
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
                    {planosF.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>{planos.length === 0 ? "Nenhum plano cadastrado. Ex: Saveiro · Troca de óleo · 10.000 km." : "Nenhum resultado para o filtro."}</td></tr>}
                    {planosF.map((p: any) => (
                      <tr key={p.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)", verticalAlign: "middle" }}>{(() => { const vv = p.veiculoId ? veiculos.find((v: any) => v.id === p.veiculoId) : null; return vv ? <span style={{ fontFamily: "var(--font-mono)" }}>{vv.placa}<span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>{vv.modelo || ""}</span></span> : p.modelo; })()}</td>
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
            </>
          )}

          {/* REGISTROS */}
          {tab === "registros" && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                <SearchBox value={qReg} onChange={setQReg} placeholder="Buscar por placa ou tipo..." />
                <Sel value={fTipoReg} onChange={setFTipoReg}><option value="">Todos os tipos</option>{TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Sel>
                <Sel value={fStatusReg} onChange={setFStatusReg}><option value="">Todos os status</option>{STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Sel>
                {(qReg || fTipoReg || fStatusReg) && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQReg(""); setFTipoReg(""); setFStatusReg(""); }}>Limpar</button>}
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{registrosF.length} de {registros.length}</span>
              </div>
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
                    {registrosF.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>{registros.length === 0 ? "Nenhum registro encontrado." : "Nenhum resultado para o filtro."}</td></tr>}
                    {registrosF.map((r: any) => (
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
            </>
          )}
        </div>
      </main>

      {(planoNew || planoEdit) && <PlanoModal plano={planoEdit || undefined} veiculos={veiculos} onSaved={onPlanoSaved} onClose={() => { setPlanoNew(false); setPlanoEdit(null); }} />}
      {(regNew || regEdit) && <RegistroModal registro={regEdit || undefined} veiculos={veiculos} onSaved={onRegSaved} onClose={() => { setRegNew(false); setRegEdit(null); }} />}
    </div>
  );
}
