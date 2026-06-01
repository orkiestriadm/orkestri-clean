"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Plus, Search, Filter,
  ChevronDown, ArrowRight, RotateCcw, UserCheck, MessageSquare,
  Settings, Loader2, Check, X, RefreshCw, Eye, DollarSign,
  Plane, ShoppingCart, UserCog, CalendarOff, Timer, HelpCircle,
  Shield,
} from "lucide-react";

/* ═══════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════ */
type WfRequest = {
  id: string; tipo: string; titulo: string; descricao: string | null;
  payload: any; valor: number | null;
  status: "PENDENTE" | "APROVADA" | "REJEITADA" | "CANCELADA";
  solicitante: { id: string; nome: string; email: string; avatar?: string | null };
  aprovadorAtual: { id: string; nome: string } | null;
  aprovadoPor: { id: string; nome: string } | null;
  rejeitadoPor: { id: string; nome: string } | null;
  aprovadoEm: string | null; rejeitadoEm: string | null; motivoRejeicao: string | null;
  _count?: { aprovacoes: number };
  aprovacoes?: { id: string; nivel: number; decisao: string; observacoes: string | null; criadoEm: string; aprovador: { id: string; nome: string } }[];
  criadoEm: string; atualizadoEm: string;
};
type Stats = { minhasPendentes: number; aguardandoMinhaAprovacao: number; aprovadas: number; rejeitadas: number };
type SimpleUser = { id: string; nome: string; email: string };

/* ═══════════════════════════════════════════════
   CONFIGS
═══════════════════════════════════════════════ */
const TIPOS: Record<string, { label: string; icon: any; color: string }> = {
  despesa:             { label: "Despesa",             icon: DollarSign,  color: "#fbbf24" },
  horas_extra:         { label: "Horas extra",         icon: Timer,       color: "#22d3ee" },
  alteracao_cadastral: { label: "Alt. cadastral",      icon: UserCog,     color: "#a78bfa" },
  folga_compensatoria: { label: "Folga compens.",      icon: CalendarOff, color: "#34d399" },
  compra:              { label: "Compra",               icon: ShoppingCart,color: "#f472b6" },
  viagem:              { label: "Viagem",               icon: Plane,       color: "#60a5fa" },
  outro:               { label: "Outro",                icon: HelpCircle,  color: "#94a3b8" },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  PENDENTE:  { label: "Pendente",  color: "#fbbf24", bg: "bg-amber-500/10",   border: "border-amber-500/25",   icon: Clock },
  APROVADA:  { label: "Aprovada",  color: "#34d399", bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: CheckCircle2 },
  REJEITADA: { label: "Rejeitada", color: "#f87171", bg: "bg-red-500/10",     border: "border-red-500/25",     icon: XCircle },
  CANCELADA: { label: "Cancelada", color: "#94a3b8", bg: "bg-gray-500/10",    border: "border-gray-500/25",    icon: X },
};

const DECISAO_CFG: Record<string, { label: string; color: string }> = {
  APROVADO:          { label: "Aprovado",         color: "#34d399" },
  REJEITADO:         { label: "Rejeitado",        color: "#f87171" },
  ESCALADO:          { label: "Escalado",         color: "#fbbf24" },
  DELEGADO:          { label: "Delegado",         color: "#60a5fa" },
  AJUSTE_SOLICITADO: { label: "Ajuste solicit.",  color: "#a78bfa" },
};

/* ═══════════════════════════════════════════════
   SMALL HELPERS
═══════════════════════════════════════════════ */
function Avatar({ nome, size = 32 }: { nome: string; size?: number }) {
  const ini = nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,rgba(124,58,237,0.35),rgba(34,211,238,0.25))", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "var(--accent-violet)", flexShrink: 0 }}>
      {ini}
    </div>
  );
}

function Sk({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return <div className="skeleton rounded-md" style={{ width: w, height: h }} />;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", cfg.bg, cfg.border)} style={{ color: cfg.color }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const cfg = TIPOS[tipo] || TIPOS.outro;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-lg"
      style={{ color: cfg.color, background: cfg.color + "14", border: `1px solid ${cfg.color}28` }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

function relTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

/* ═══════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════ */
function ModalWrapper({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {children}
      </div>
    </div>
  );
}

function NovaSolicitacaoModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [f, setF] = useState({ tipo: "despesa", titulo: "", descricao: "", valor: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isMonetario = ["despesa", "compra", "viagem"].includes(f.tipo);

  const save = async () => {
    if (!f.titulo.trim()) { setErr("Título obrigatório"); return; }
    setLoading(true); setErr("");
    try {
      await api.post("/workflows/requests", {
        tipo: f.tipo, titulo: f.titulo.trim(),
        descricao: f.descricao || undefined,
        valor: isMonetario && f.valor ? parseFloat(f.valor) : undefined,
      });
      onSave(); onClose();
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao criar"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-[15px] font-bold text-[var(--text-primary)]">Nova Solicitação</h3>
        <button className="btn-icon" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-2">Tipo</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(TIPOS).map(([k, v]) => {
              const Icon = v.icon;
              return (
                <button key={k} type="button" onClick={() => setF(p => ({ ...p, tipo: k }))}
                  className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border text-[11px] font-medium transition-all cursor-pointer",
                    f.tipo === k ? "border-current" : "border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-muted)]")}
                  style={{ color: f.tipo === k ? v.color : undefined, background: f.tipo === k ? v.color + "12" : undefined }}>
                  <Icon size={16} />
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Título *</label>
          <input className="input-o" value={f.titulo} onChange={e => setF(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Reembolso almoço com cliente" />
        </div>
        {isMonetario && (
          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Valor (R$)</label>
            <input className="input-o" type="number" step="0.01" min="0" value={f.valor}
              onChange={e => setF(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" />
            {f.valor && parseFloat(f.valor) > 5000 && (
              <p className="text-[11px] text-cyan-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={10} /> Valores acima de R$ 5.000 sobem automaticamente um nível hierárquico</p>
            )}
          </div>
        )}
        <div>
          <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Justificativa</label>
          <textarea className="input-o" rows={3} value={f.descricao} onChange={e => setF(p => ({ ...p, descricao: e.target.value }))}
            placeholder="Descreva o motivo da solicitação..." style={{ resize: "vertical" }} />
        </div>
        {err && <div className="text-[12px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">{err}</div>}
        <div className="flex gap-3 pt-1">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet flex-[2]" onClick={save} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={13} /> Enviar solicitação</>}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

function DecisaoModal({ request, decisao, onClose, onSave }: { request: WfRequest; decisao: "APROVAR" | "REJEITAR"; onClose: () => void; onSave: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isReject = decisao === "REJEITAR";

  const submit = async () => {
    if (isReject && !motivo.trim()) { setErr("Motivo obrigatório"); return; }
    setLoading(true); setErr("");
    try {
      if (isReject) await api.patch(`/workflows/requests/${request.id}/rejeitar`, { motivo, observacoes: obs });
      else await api.patch(`/workflows/requests/${request.id}/aprovar`, { observacoes: obs });
      onSave(); onClose();
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <h3 className="font-display text-[15px] font-bold text-[var(--text-primary)] mb-4">
        {isReject ? "Rejeitar solicitação" : "Aprovar solicitação"}
      </h3>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
        <div className="text-[11px] text-[var(--text-muted)] mb-1">Solicitação de <strong className="text-[var(--text-primary)]">{request.solicitante.nome}</strong></div>
        <div className="text-[14px] font-semibold text-[var(--text-primary)]">{request.titulo}</div>
        {request.valor != null && <div className="text-[13px] font-mono text-cyan-400 mt-1">R$ {request.valor.toFixed(2).replace(".", ",")}</div>}
      </div>
      {isReject && (
        <div className="mb-3">
          <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Motivo da rejeição *</label>
          <textarea className="input-o" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Por que está sendo rejeitada?" style={{ resize: "vertical" }} />
        </div>
      )}
      <div className="mb-4">
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Observações (opcional)</label>
        <textarea className="input-o" rows={2} value={obs} onChange={e => setObs(e.target.value)}
          placeholder="Comentários adicionais..." style={{ resize: "vertical" }} />
      </div>
      {err && <div className="text-[12px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 mb-3">{err}</div>}
      <div className="flex gap-3">
        <button className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className={cn("btn flex-[2]", isReject ? "btn-danger" : "btn-violet")} onClick={submit} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : isReject ? <><XCircle size={13} /> Confirmar rejeição</> : <><Check size={13} /> Aprovar</>}
        </button>
      </div>
    </ModalWrapper>
  );
}

function DelegarModal({ request, onClose, onSave }: { request: WfRequest; onClose: () => void; onSave: () => void }) {
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [selected, setSelected] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/users", { params: { ativos: true } }).then(r => setUsers(r.data || [])).catch(() => {});
  }, []);

  const submit = async () => {
    if (!selected) { setErr("Selecione o novo aprovador"); return; }
    setLoading(true); setErr("");
    try {
      await api.patch(`/workflows/requests/${request.id}/delegar`, { novoAprovadorId: selected, motivo: motivo || undefined });
      onSave(); onClose();
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-[15px] font-bold text-[var(--text-primary)] flex items-center gap-2">
          <UserCheck size={15} className="text-blue-400" /> Delegar aprovação
        </h3>
        <button className="btn-icon" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">{request.titulo}</div>
        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">de {request.solicitante.nome}</div>
      </div>
      <div className="mb-3">
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Novo aprovador *</label>
        <select className="input-o" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Selecione...</option>
          {users.filter(u => u.id !== request.aprovadorAtual?.id).map(u => (
            <option key={u.id} value={u.id}>{u.nome}</option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Motivo (opcional)</label>
        <input className="input-o" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por que está delegando?" />
      </div>
      {err && <div className="text-[12px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 mb-3">{err}</div>}
      <div className="flex gap-3">
        <button className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="btn btn-violet flex-[2]" onClick={submit} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <><UserCheck size={13} /> Confirmar delegação</>}
        </button>
      </div>
    </ModalWrapper>
  );
}

function AjustesModal({ request, onClose, onSave }: { request: WfRequest; onClose: () => void; onSave: () => void }) {
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!mensagem.trim()) { setErr("Mensagem obrigatória"); return; }
    setLoading(true); setErr("");
    try {
      await api.patch(`/workflows/requests/${request.id}/ajustes`, { mensagem });
      onSave(); onClose();
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-[15px] font-bold text-[var(--text-primary)] flex items-center gap-2">
          <MessageSquare size={15} className="text-violet-400" /> Solicitar ajustes
        </h3>
        <button className="btn-icon" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">{request.titulo}</div>
        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Solicitante: {request.solicitante.nome}</div>
      </div>
      <div className="mb-4">
        <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono block mb-1.5">Mensagem para o solicitante *</label>
        <textarea className="input-o" rows={4} value={mensagem} onChange={e => setMensagem(e.target.value)}
          placeholder="Explique o que precisa ser ajustado ou complementado..." style={{ resize: "vertical" }} />
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5 flex items-center gap-1">
          <AlertTriangle size={10} /> O solicitante receberá uma notificação com esta mensagem.
        </p>
      </div>
      {err && <div className="text-[12px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 mb-3">{err}</div>}
      <div className="flex gap-3">
        <button className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
        <button className="btn btn-violet flex-[2]" onClick={submit} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <><MessageSquare size={13} /> Enviar pedido de ajuste</>}
        </button>
      </div>
    </ModalWrapper>
  );
}

function DetailModal({ id, onClose, onAction }: { id: string; onClose: () => void; onAction: () => void }) {
  const { user } = useAuthStore();
  const [request, setRequest] = useState<WfRequest | null>(null);
  const [modal, setModal] = useState<"APROVAR" | "REJEITAR" | "DELEGAR" | "AJUSTES" | null>(null);

  useEffect(() => {
    api.get(`/workflows/requests/${id}`).then(r => setRequest(r.data)).catch(onClose);
  }, [id]);

  if (!request) return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-center p-10"><Loader2 size={22} className="animate-spin text-[var(--text-muted)]" /></div>
    </ModalWrapper>
  );

  const canAprovar = request.status === "PENDENTE" && (request.aprovadorAtual?.id === user?.id || !!user?.isMaster);

  if (modal === "APROVAR" || modal === "REJEITAR")
    return <DecisaoModal request={request} decisao={modal} onClose={() => setModal(null)} onSave={() => { onAction(); onClose(); }} />;
  if (modal === "DELEGAR")
    return <DelegarModal request={request} onClose={() => setModal(null)} onSave={() => { onAction(); onClose(); }} />;
  if (modal === "AJUSTES")
    return <AjustesModal request={request} onClose={() => setModal(null)} onSave={() => { onAction(); onClose(); }} />;

  const TipoIcon = (TIPOS[request.tipo] || TIPOS.outro).icon;
  const tipoColor = (TIPOS[request.tipo] || TIPOS.outro).color;

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: tipoColor + "15", border: `1px solid ${tipoColor}28` }}>
            <TipoIcon size={16} style={{ color: tipoColor }} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-[var(--text-primary)]">{request.titulo}</div>
            <TipoBadge tipo={request.tipo} />
          </div>
        </div>
        <button className="btn-icon" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
          <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wide mb-2">Solicitante</div>
          <div className="flex items-center gap-2"><Avatar nome={request.solicitante.nome} size={26} /><span className="text-[13px] font-medium">{request.solicitante.nome}</span></div>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
          <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wide mb-2">Status</div>
          <StatusBadge status={request.status} />
        </div>
        {request.valor != null && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
            <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wide mb-1">Valor</div>
            <div className="text-[18px] font-bold text-cyan-400 font-mono">R$ {request.valor.toFixed(2).replace(".", ",")}</div>
          </div>
        )}
        {request.aprovadorAtual && request.status === "PENDENTE" && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
            <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wide mb-2">Aguardando aprovação de</div>
            <div className="flex items-center gap-2"><Avatar nome={request.aprovadorAtual.nome} size={26} /><span className="text-[13px] font-medium">{request.aprovadorAtual.nome}</span></div>
          </div>
        )}
      </div>

      {request.descricao && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-4 mb-4">
          <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wide mb-1.5">Descrição / Justificativa</div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{request.descricao}</p>
        </div>
      )}

      {request.motivoRejeicao && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4 mb-4">
          <div className="text-[10px] text-red-400 font-mono uppercase tracking-wide mb-1.5">Motivo da rejeição</div>
          <p className="text-[13px] text-[var(--text-primary)]">{request.motivoRejeicao}</p>
        </div>
      )}

      {request.aprovacoes && request.aprovacoes.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wide mb-2">Histórico de aprovações</div>
          <div className="space-y-2">
            {request.aprovacoes.map(a => {
              const dcfg = DECISAO_CFG[a.decisao] || { label: a.decisao, color: "#94a3b8" };
              return (
                <div key={a.id} className="flex items-start gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl p-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: dcfg.color + "20", border: `1px solid ${dcfg.color}35` }}>
                    <span style={{ color: dcfg.color, fontSize: 9, fontWeight: 700 }}>●</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">{a.aprovador.nome}</span>
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">nível {a.nivel}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: dcfg.color, background: dcfg.color + "15" }}>{dcfg.label}</span>
                    </div>
                    {a.observacoes && <p className="text-[11px] text-[var(--text-secondary)] mt-1 italic">"{a.observacoes}"</p>}
                    <div className="text-[10px] text-[var(--text-faint)] font-mono mt-0.5">{new Date(a.criadoEm).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canAprovar && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button className="btn btn-violet" onClick={() => setModal("APROVAR")}><Check size={13} /> Aprovar</button>
          <button className="btn btn-danger" onClick={() => setModal("REJEITAR")}><XCircle size={13} /> Rejeitar</button>
          <button className="btn btn-ghost" onClick={() => setModal("DELEGAR")}><UserCheck size={13} /> Delegar</button>
          <button className="btn btn-ghost" onClick={() => setModal("AJUSTES")}><MessageSquare size={13} /> Solicitar ajustes</button>
        </div>
      )}
    </ModalWrapper>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════ */
type TabKey = "fila" | "minhas" | "historico";

export default function AprovacoesPage() {
  const { user } = useAuthStore();
  const canConfigure = !!user?.isMaster || (user?.permissions || []).some((p: string) => p === "*" || p === "aprovacoes:configurar");

  const [tab, setTab] = useState<TabKey>("fila");
  const [requests, setRequests] = useState<WfRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modals
  const [modalNova, setModalNova] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (tab === "minhas") { params.minhas = true; }
      else if (tab === "fila") { params.aguardandoMinhaAprovacao = true; }
      // historico: sem filtro especial

      const [s, list] = await Promise.all([
        api.get("/workflows/requests/stats"),
        api.get("/workflows/requests", { params }),
      ]);
      setStats(s.data);
      setRequests(list.data);
    } catch { } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // Client-side filter
  const filtered = requests.filter(r => {
    if (filterTipo && r.tipo !== filterTipo) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.titulo.toLowerCase().includes(q) || r.solicitante.nome.toLowerCase().includes(q);
    }
    return true;
  });

  const canAprovarCount = filtered.filter(r => r.status === "PENDENTE" && (r.aprovadorAtual?.id === user?.id || !!user?.isMaster)).length;

  const TABS = [
    { key: "fila" as TabKey, label: "Fila de Aprovações", count: stats?.aguardandoMinhaAprovacao ?? 0, urgent: (stats?.aguardandoMinhaAprovacao ?? 0) > 0 },
    { key: "minhas" as TabKey, label: "Minhas Solicitações", count: stats?.minhasPendentes ?? 0, urgent: false },
    { key: "historico" as TabKey, label: "Histórico", count: 0, urgent: false },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar>
        {canConfigure && (
          <a href="/dashboard/aprovacoes/configuracao" className="btn btn-ghost text-[12px]" title="Configurar aprovadores">
            <Settings size={13} /> Configurar
          </a>
        )}
        <button className="btn btn-violet text-[12px]" onClick={() => setModalNova(true)}>
          <Plus size={13} /> Nova solicitação
        </button>
      </Topbar>

      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 space-y-6 pb-20">

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Fila — Aguardando minha aprovação", value: stats?.aguardandoMinhaAprovacao ?? 0, color: "#fbbf24", icon: Clock, urgent: (stats?.aguardandoMinhaAprovacao ?? 0) > 0 },
              { label: "Minhas pendentes", value: stats?.minhasPendentes ?? 0, color: "#a78bfa", icon: Timer, urgent: false },
              { label: "Aprovadas (total)", value: stats?.aprovadas ?? 0, color: "#34d399", icon: CheckCircle2, urgent: false },
              { label: "Rejeitadas (total)", value: stats?.rejeitadas ?? 0, color: "#f87171", icon: XCircle, urgent: false },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={cn("card-premium p-5 flex flex-col gap-3", s.urgent && "ring-1 ring-amber-500/30")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest font-mono leading-tight">{s.label}</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.color + "18", border: `1px solid ${s.color}28` }}>
                      <Icon size={13} style={{ color: s.color }} />
                    </div>
                  </div>
                  <div className="font-display text-[30px] font-bold leading-none" style={{ color: s.color }}>
                    {loading ? <Sk w={40} h={28} /> : s.value}
                  </div>
                  {s.urgent && s.value > 0 && (
                    <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1 animate-pulse">
                      <AlertTriangle size={10} /> Ação necessária
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl w-fit">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all",
                  tab === t.key ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-[0_0_12px_rgba(124,58,237,0.35)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]")}>
                {t.label}
                {t.count > 0 && (
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", tab === t.key ? "bg-white/20 text-white" : t.urgent ? "bg-amber-500/20 text-amber-400" : "bg-[var(--bg-hover)] text-[var(--text-muted)]")}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Filters bar ── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input className="input-o pl-9 text-[13px]" placeholder="Buscar solicitação ou solicitante..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-o text-[12px] w-auto pr-8" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="input-o text-[12px] w-auto pr-8" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {(search || filterTipo || filterStatus) && (
              <button className="btn btn-ghost text-[12px]" onClick={() => { setSearch(""); setFilterTipo(""); setFilterStatus(""); }}>
                <RotateCcw size={12} /> Limpar
              </button>
            )}
            <button className="btn btn-ghost text-[12px] ml-auto" onClick={load} disabled={loading}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* ── Action header ── */}
          {canAprovarCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <AlertTriangle size={14} className="text-amber-400 shrink-0" />
              <p className="text-[13px] text-amber-400 font-medium">
                <strong>{canAprovarCount}</strong> solicitação{canAprovarCount > 1 ? "ões" : ""} aguardando sua decisão
              </p>
            </div>
          )}

          {/* ── Request list ── */}
          <div className="card-premium overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-3">{Array(5).fill(0).map((_, i) => <Sk key={i} h={56} />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 size={32} className="text-[var(--text-faint)] mb-3" />
                <p className="text-[14px] font-semibold text-[var(--text-secondary)]">Nenhuma solicitação encontrada</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  {tab === "fila" ? "Você está em dia com as aprovações." : "Nenhum resultado para os filtros aplicados."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {filtered.map(r => {
                  const TipoIcon = (TIPOS[r.tipo] || TIPOS.outro).icon;
                  const tipoColor = (TIPOS[r.tipo] || TIPOS.outro).color;
                  const canAprovar = r.status === "PENDENTE" && (r.aprovadorAtual?.id === user?.id || !!user?.isMaster);
                  const horasDesde = Math.round((Date.now() - new Date(r.criadoEm).getTime()) / 3600000);
                  const isUrgent = canAprovar && horasDesde >= 24;

                  return (
                    <div key={r.id}
                      onClick={() => setDetailId(r.id)}
                      className={cn("group flex items-start gap-4 p-5 cursor-pointer hover:bg-[var(--bg-hover)] transition-all", isUrgent && "border-l-2 border-amber-500/60")}>
                      {/* Type icon */}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform"
                        style={{ background: tipoColor + "15", border: `1px solid ${tipoColor}28` }}>
                        <TipoIcon size={15} style={{ color: tipoColor }} />
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap mb-1.5">
                          <span className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-violet)] transition-colors">
                            {r.titulo}
                          </span>
                          <TipoBadge tipo={r.tipo} />
                          {r.valor != null && (
                            <span className="text-[11px] font-mono text-cyan-400 font-bold">R$ {r.valor.toFixed(2).replace(".", ",")}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] flex-wrap">
                          <span className="flex items-center gap-1"><Avatar nome={r.solicitante.nome} size={16} />{r.solicitante.nome}</span>
                          {r.aprovadorAtual && r.status === "PENDENTE" && (
                            <span>aguardando <strong className="text-[var(--text-secondary)]">{r.aprovadorAtual.nome}</strong></span>
                          )}
                          <span className="font-mono">{relTime(r.criadoEm)}</span>
                          {isUrgent && <span className="text-amber-400 flex items-center gap-0.5"><AlertTriangle size={10} />{horasDesde}h em aberto</span>}
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <StatusBadge status={r.status} />
                        {canAprovar && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button title="Aprovar" className="btn-icon text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors"
                              onClick={() => setDetailId(r.id)}>
                              <Check size={12} />
                            </button>
                            <button title="Rejeitar" className="btn-icon text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                              onClick={() => setDetailId(r.id)}>
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        <ArrowRight size={13} className="text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer count ── */}
          {!loading && filtered.length > 0 && (
            <p className="text-[11px] text-[var(--text-muted)] font-mono text-center">
              {filtered.length} solicitaç{filtered.length > 1 ? "ões" : "ão"}{requests.length !== filtered.length ? ` (de ${requests.length})` : ""}
            </p>
          )}

        </div>
      </div>

      {/* ── Modals ── */}
      {modalNova && <NovaSolicitacaoModal onClose={() => setModalNova(false)} onSave={load} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onAction={load} />}
    </div>
  );
}
