"use client";
import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Headphones, User, Building2, Clock, CheckCircle,
  XCircle, AlertTriangle, Send, Lock, Unlock, Edit2, Save, X,
  Plus, Trash2, Star, RefreshCw, ChevronDown, Paperclip,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Chamado {
  id: string; numero: number; titulo: string; descricao: string;
  status: string; prioridade: string; categoria?: string; tags?: string;
  solicitanteId: string; atendenteId?: string; clienteId?: string;
  slaHoras?: number; slaStatus: string; slaDeadline?: string;
  slaRespostaStatus: string; slaRespostaAt?: string; slaResolucaoAt?: string;
  primeiraRespostaEm?: string; avaliacao?: number; avaliacaoNota?: string;
  resolvidoEm?: string; fechadoEm?: string; criadoEm: string; atualizadoEm: string;
  horasEstimadas?: number;
  skillRequerida?: { id: string; nome: string };
  nivelMinimo?: string;
  solicitante: { id: string; nome: string; email: string; avatar?: string };
  atendente?: { id: string; nome: string; email: string; avatar?: string } | null;
  cliente?: { id: string; nome: string; empresa?: string } | null;
  comentarios: Comentario[];
}
interface Comentario {
  id: string; texto: string; interno: boolean; criadoEm: string;
  user: { id: string; nome: string; avatar?: string };
}
interface Apontamento {
  id: string; minutos: number; descricao?: string; data: string;
  user: { id: string; nome: string };
  chamado: { numero: number; titulo: string };
}
type Anexo = {
  id: string; nomeOriginal: string; nomeArquivo: string; mimeType: string;
  tamanhoBytes: number; criadoEm: string; url: string;
  uploader: { id: string; nome: string };
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  aberto:         { label: "Aberto",         color: "text-slate-400",  bg: "bg-slate-500/15 border-slate-500/30" },
  em_atendimento: { label: "Em atendimento", color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/30" },
  aguardando:     { label: "Aguardando",     color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  resolvido:      { label: "Resolvido",      color: "text-green-400",  bg: "bg-green-500/15 border-green-500/30" },
  fechado:        { label: "Fechado",        color: "text-gray-400",   bg: "bg-gray-500/15 border-gray-500/30" },
  cancelado:      { label: "Cancelado",      color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30" },
};
const PRIO_MAP: Record<string, { label: string; color: string }> = {
  baixa:   { label: "Baixa",   color: "text-blue-400" },
  media:   { label: "Média",   color: "text-yellow-400" },
  alta:    { label: "Alta",    color: "text-orange-400" },
  critica: { label: "Crítica", color: "text-red-400" },
  urgente: { label: "Urgente", color: "text-red-400" },
};
const SLA_MAP: Record<string, { label: string; color: string; icon: any }> = {
  ok:      { label: "Dentro do prazo", color: "text-green-400",  icon: CheckCircle },
  risco:   { label: "Em risco",        color: "text-yellow-400", icon: AlertTriangle },
  violado: { label: "Violado",         color: "text-red-400",    icon: XCircle },
  cumprido:{ label: "Cumprido",        color: "text-green-400",  icon: CheckCircle },
  pendente:{ label: "Pendente",        color: "text-muted-foreground", icon: Clock },
};

function fmtDt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtHoras(min: number) {
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}
function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return fmtDate(d);
}
function Avatar({ nome, size = 28 }: { nome: string; size?: number }) {
  const initials = nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

// ── SLA Bar ───────────────────────────────────────────────────────────────────
function SlaBar({ chamado }: { chamado: Chamado }) {
  const isOpen = !["resolvido","fechado","cancelado"].includes(chamado.status);
  const deadline = chamado.slaDeadline ? new Date(chamado.slaDeadline) : null;
  const now = new Date();

  let pct = 0;
  if (deadline && chamado.criadoEm) {
    const total = deadline.getTime() - new Date(chamado.criadoEm).getTime();
    const elapsed = now.getTime() - new Date(chamado.criadoEm).getTime();
    pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  const sla = SLA_MAP[chamado.slaStatus] || SLA_MAP.ok;
  const Icon = sla.icon;
  const barColor = chamado.slaStatus === "violado" ? "bg-red-500" : chamado.slaStatus === "risco" ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SLA Resolução</span>
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", sla.color)}>
          <Icon size={13} />
          {sla.label}
        </div>
      </div>
      {deadline && (
        <>
          {isOpen && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>Abertura: {fmtDt(chamado.criadoEm)}</span>
                <span>Prazo: {fmtDt(chamado.slaDeadline)}</span>
              </div>
            </div>
          )}
          {!isOpen && chamado.resolvidoEm && (
            <div className="text-xs text-muted-foreground">
              Resolvido em {fmtDt(chamado.resolvidoEm)} · Prazo era {fmtDt(chamado.slaDeadline)}
            </div>
          )}
        </>
      )}
      {chamado.slaRespostaAt && (
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-[11px] text-muted-foreground">SLA Resposta</span>
          <div className={cn("flex items-center gap-1 text-[11px] font-medium", (SLA_MAP[chamado.slaRespostaStatus] || SLA_MAP.pendente).color)}>
            {chamado.slaRespostaStatus === "cumprido" ? <CheckCircle size={11} /> : <Clock size={11} />}
            {(SLA_MAP[chamado.slaRespostaStatus] || SLA_MAP.pendente).label}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comentário ────────────────────────────────────────────────────────────────
function ComentarioItem({ c, currentUserId, onDelete }: { c: Comentario; currentUserId: string; onDelete: () => void }) {
  const mine = c.user.id === currentUserId;
  return (
    <div className={cn("flex gap-3", mine && "flex-row-reverse")}>
      <Avatar nome={c.user.nome} size={30} />
      <div className={cn("flex-1 max-w-[80%]", mine && "items-end flex flex-col")}>
        <div className={cn("rounded-2xl px-4 py-2.5 text-sm", mine ? "bg-primary/10 border border-primary/20 rounded-tr-sm" : "bg-muted/50 border border-border rounded-tl-sm",
          c.interno && "border-yellow-500/30 bg-yellow-500/5")}>
          {c.interno && <div className="text-[10px] text-yellow-400 font-medium mb-1 flex items-center gap-1"><Lock size={10} /> Nota interna</div>}
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">{c.texto}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">{c.user.nome}</span>
          <span className="text-[10px] text-muted-foreground">{timeAgo(c.criadoEm)}</span>
          {mine && <button onClick={onDelete} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={10} /></button>}
        </div>
      </div>
    </div>
  );
}

// ── Star Rating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}
          className="transition-transform hover:scale-110">
          <Star size={20} className={cn("transition-colors", (hover || value) >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
        </button>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ChamadoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();

  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  // Edit mode
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Comentário
  const [novoComent, setNovoComent] = useState("");
  const [interno, setInterno] = useState(false);
  const [enviandoComent, setEnviandoComent] = useState(false);
  const comentRef = useRef<HTMLTextAreaElement>(null);

  // Apontamento
  const [showAptForm, setShowAptForm] = useState(false);
  const [aptHoras, setAptHoras] = useState(""); const [aptMins, setAptMins] = useState("");
  const [aptDesc, setAptDesc] = useState(""); const [aptData, setAptData] = useState(new Date().toISOString().slice(0,10));
  const [savingApt, setSavingApt] = useState(false);

  // CSAT
  const [csatNota, setCsatNota] = useState(0);
  const [csatComent, setCsatComent] = useState("");
  const [savingCsat, setSavingCsat] = useState(false);

  // Anexos
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMaster = user?.isMaster;
  const isAtendente = chamado?.atendenteId === user?.id;
  const isSolicitante = chamado?.solicitanteId === user?.id;
  const canEdit = isMaster || isAtendente || isSolicitante;
  // Pode assumir = chamado na fila pública + usuário tem chamados:editar
  const canEditarPerm = !!(isMaster
    || user?.permissions?.includes("*")
    || user?.permissions?.includes("chamados:editar"));
  const inPublicQueue = chamado?.status === "aberto" && !chamado?.atendenteId;
  const showAssumir = inPublicQueue && canEditarPerm;

  async function load(silent = false) {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [{ data: c }, { data: apts }, { data: anx }] = await Promise.all([
        api.get(`/chamados/${id}`),
        api.get(`/apontamentos?chamadoId=${id}`),
        api.get(`/chamados/${id}/anexos`).catch(() => ({ data: [] })),
      ]);
      setChamado(c);
      setApontamentos(apts);
      setAnexos(Array.isArray(anx) ? anx : []);
      setEditForm({ titulo: c.titulo, descricao: c.descricao, status: c.status, prioridade: c.prioridade, categoria: c.categoria || "", tags: c.tags || "", atendenteId: c.atendenteId || "" });
      if (c.avaliacao) setCsatNota(c.avaliacao);
    } catch { router.push("/dashboard/chamados"); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api.get("/users").then(r => setUsuarios(r.data?.users || r.data || [])).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.put(`/chamados/${id}`, editForm);
      setChamado(data);
      setEditando(false);
    } finally { setSaving(false); }
  }

  async function handleStatus(status: string) {
    const { data } = await api.patch(`/chamados/${id}/status`, { status });
    setChamado(data);
  }

  async function handleAssumir() {
    try {
      await api.patch(`/chamados/${id}/assumir`);
      await load(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Nao foi possivel assumir o chamado.");
      await load(true);
    }
  }

  async function handleComentario() {
    if (!novoComent.trim()) return;
    setEnviandoComent(true);
    try {
      await api.post(`/chamados/${id}/comentarios`, { texto: novoComent.trim(), interno });
      setNovoComent(""); setInterno(false);
      await load(true);
    } finally { setEnviandoComent(false); }
  }

  async function handleDeleteComentario(comentId: string) {
    if (!confirm("Remover comentário?")) return;
    await api.delete(`/chamados/${id}/comentarios/${comentId}`);
    setChamado(c => c ? { ...c, comentarios: c.comentarios.filter(x => x.id !== comentId) } : c);
  }

  async function handleApontamento() {
    const minutos = (Number(aptHoras) || 0) * 60 + (Number(aptMins) || 0);
    if (minutos <= 0) return;
    setSavingApt(true);
    try {
      await api.post("/apontamentos", { chamadoId: id, minutos, descricao: aptDesc || undefined, data: aptData });
      setAptHoras(""); setAptMins(""); setAptDesc(""); setShowAptForm(false);
      const { data } = await api.get(`/apontamentos?chamadoId=${id}`);
      setApontamentos(data);
    } finally { setSavingApt(false); }
  }

  async function handleDeleteApontamento(aptId: string) {
    if (!confirm("Remover apontamento?")) return;
    await api.delete(`/apontamentos/${aptId}`);
    setApontamentos(p => p.filter(a => a.id !== aptId));
  }

  function fmtBytes(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.ceil(bytes / 1024)} KB`;
  }

  function fileIcon(mimeType: string) {
    if (mimeType.startsWith("image/")) return "📷";
    if (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("document")) return "📄";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return "📊";
    if (mimeType === "application/zip" || mimeType.includes("compressed")) return "🗜️";
    return "📎";
  }

  async function handleAnexoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAnexo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/chamados/${id}/anexos`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setAnexos(prev => [...prev, data]);
    } catch {} finally {
      setUploadingAnexo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAnexo(anexoId: string) {
    if (!confirm("Remover anexo?")) return;
    await api.delete(`/chamados/${id}/anexos/${anexoId}`);
    setAnexos(prev => prev.filter(a => a.id !== anexoId));
  }

  async function handleCsat() {
    if (!csatNota) return;
    setSavingCsat(true);
    try {
      await api.patch(`/chamados/${id}/avaliar`, { avaliacao: csatNota, avaliacaoNota: csatComent || undefined });
      await load(true);
    } finally { setSavingCsat(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!chamado) return null;

  const totalHoras = apontamentos.reduce((s, a) => s + a.minutos, 0);
  const statusInfo = STATUS_MAP[chamado.status] || STATUS_MAP.aberto;
  const prioInfo = PRIO_MAP[chamado.prioridade] || PRIO_MAP.media;
  const isClosed = ["resolvido","fechado"].includes(chamado.status);
  const tags = chamado.tags ? chamado.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1200px] mx-auto p-6 space-y-5">

        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/dashboard/chamados" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> Chamados
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">#{chamado.numero}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load(true)} disabled={refreshing} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
            {canEdit && !editando && (
              <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
                <Edit2 size={13} /> Editar
              </button>
            )}
            {editando && (
              <>
                <button onClick={() => setEditando(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
                  <X size={13} /> Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Save size={13} /> {saving ? "Salvando..." : "Salvar"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Left: main content ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Header card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Headphones size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  {editando ? (
                    <input value={editForm.titulo} onChange={e => setEditForm((f: any) => ({ ...f, titulo: e.target.value }))}
                      className="w-full text-lg font-bold bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  ) : (
                    <h1 className="text-lg font-bold text-foreground leading-tight">{chamado.titulo}</h1>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", statusInfo.bg)}>{statusInfo.label}</span>
                    <span className={cn("text-[11px] font-medium", prioInfo.color)}>● {prioInfo.label}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">#{chamado.numero}</span>
                    {tags.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              {editando ? (
                <textarea value={editForm.descricao} onChange={e => setEditForm((f: any) => ({ ...f, descricao: e.target.value }))}
                  rows={5} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              ) : (
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{chamado.descricao}</div>
              )}
            </div>

            {/* Banner fila pública (qualquer um com chamados:editar) */}
            {showAssumir && !editando && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Chamado na fila pública</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Ninguém assumiu ainda. Clique em "Assumir" para que ele apareça no seu painel.</div>
                </div>
                <button
                  onClick={handleAssumir}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 transition-colors shrink-0"
                >
                  Assumir Chamado
                </button>
              </div>
            )}

            {/* Status actions */}
            {canEdit && !editando && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Ações rápidas</div>
                <div className="flex flex-wrap gap-2">
                  {chamado.status === "aberto" && (
                    <button onClick={() => handleStatus("em_atendimento")} className="px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                      → Em atendimento
                    </button>
                  )}
                  {["aberto","em_atendimento"].includes(chamado.status) && (
                    <button onClick={() => handleStatus("aguardando")} className="px-3 py-1.5 rounded-lg text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">
                      ⏸ Aguardando cliente
                    </button>
                  )}
                  {["aberto","em_atendimento","aguardando"].includes(chamado.status) && (
                    <button onClick={() => handleStatus("resolvido")} className="px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                      <CheckCircle size={12} className="inline mr-1" />Marcar resolvido
                    </button>
                  )}
                  {chamado.status === "resolvido" && (
                    <button onClick={() => handleStatus("fechado")} className="px-3 py-1.5 rounded-lg text-xs bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20 transition-colors">
                      Fechar chamado
                    </button>
                  )}
                  {!isClosed && (
                    <button onClick={() => handleStatus("cancelado")} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                      <XCircle size={12} className="inline mr-1" />Cancelar
                    </button>
                  )}
                  {isClosed && chamado.status !== "aberto" && (
                    <button onClick={() => handleStatus("aberto")} className="px-3 py-1.5 rounded-lg text-xs bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500/20 transition-colors">
                      ↺ Reabrir
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Comentários */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Comentários <span className="text-muted-foreground font-normal">({chamado.comentarios.length})</span>
                </h2>
              </div>

              <div className="space-y-4 mb-5">
                {chamado.comentarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum comentário ainda. Seja o primeiro.</p>
                ) : chamado.comentarios.map(c => (
                  <ComentarioItem key={c.id} c={c} currentUserId={user?.id || ""} onDelete={() => handleDeleteComentario(c.id)} />
                ))}
              </div>

              {/* New comment */}
              <div className="border-t border-border pt-4 space-y-3">
                <textarea
                  ref={comentRef}
                  value={novoComent}
                  onChange={e => setNovoComent(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleComentario(); }}
                  placeholder="Adicionar comentário... (Ctrl+Enter para enviar)"
                  rows={3}
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setInterno(i => !i)}
                    className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                      interno ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" : "text-muted-foreground border-border hover:bg-accent"
                    )}
                  >
                    {interno ? <Lock size={12} /> : <Unlock size={12} />}
                    {interno ? "Nota interna" : "Público"}
                  </button>
                  <button
                    onClick={handleComentario}
                    disabled={!novoComent.trim() || enviandoComent}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Send size={12} />
                    {enviandoComent ? "Enviando..." : "Comentar"}
                  </button>
                </div>
              </div>
            </div>

            {/* Apontamentos de horas */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Horas apontadas
                  {totalHoras > 0 && <span className="text-muted-foreground font-normal ml-2">— {fmtHoras(totalHoras)} total</span>}
                </h2>
                <button onClick={() => setShowAptForm(f => !f)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-accent px-2.5 py-1 rounded-lg transition-colors">
                  <Plus size={12} /> Apontar
                </button>
              </div>

              {showAptForm && (
                <div className="mb-4 p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Horas</label>
                      <input type="number" min="0" value={aptHoras} onChange={e => setAptHoras(e.target.value)} placeholder="0" className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Minutos</label>
                      <input type="number" min="0" max="59" value={aptMins} onChange={e => setAptMins(e.target.value)} placeholder="0" className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Data</label>
                      <input type="date" value={aptData} onChange={e => setAptData(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  </div>
                  <input value={aptDesc} onChange={e => setAptDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAptForm(false)} className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
                    <button onClick={handleApontamento} disabled={savingApt || (Number(aptHoras||0)*60+Number(aptMins||0)) <= 0}
                      className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                      {savingApt ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              )}

              {apontamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma hora apontada neste chamado.</p>
              ) : (
                <div className="space-y-2">
                  {apontamentos.map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <Clock size={14} className="text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{fmtHoras(a.minutos)}</span>
                          <span className="text-xs text-muted-foreground">{a.user.nome}</span>
                          <span className="text-xs text-muted-foreground">· {fmtDate(a.data)}</span>
                        </div>
                        {a.descricao && <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.descricao}</div>}
                      </div>
                      {(isMaster || a.user.id === user?.id) && (
                        <button onClick={() => handleDeleteApontamento(a.id)} className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Anexos */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Paperclip size={14} className="text-muted-foreground" />
                  Anexos
                  {anexos.length > 0 && <span className="text-muted-foreground font-normal">({anexos.length})</span>}
                </h2>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAnexo}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-accent px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  {uploadingAnexo ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  {uploadingAnexo ? "Enviando..." : "Adicionar anexo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                  onChange={handleAnexoUpload}
                />
              </div>
              {anexos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum anexo neste chamado.</p>
              ) : (
                <div className="space-y-2">
                  {anexos.map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                      <span className="text-lg flex-shrink-0">{fileIcon(a.mimeType)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a href={a.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate max-w-[200px]">
                            {a.nomeOriginal}
                          </a>
                          <span className="text-xs text-muted-foreground font-mono">{fmtBytes(a.tamanhoBytes)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.uploader.nome} · {fmtDate(a.criadoEm)}
                        </div>
                      </div>
                      {(isMaster || a.uploader.id === user?.id) && (
                        <button onClick={() => handleDeleteAnexo(a.id)} className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CSAT */}
            {isClosed && (isSolicitante || isMaster) && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">
                  Avaliação do atendimento
                  {chamado.avaliacao && <span className="text-muted-foreground font-normal ml-2">(já avaliado)</span>}
                </h2>
                <div className="space-y-3">
                  <StarRating value={csatNota} onChange={setCsatNota} />
                  <textarea value={csatComent} onChange={e => setCsatComent(e.target.value)} placeholder="Comentário sobre o atendimento (opcional)"
                    rows={2} className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                  <button onClick={handleCsat} disabled={!csatNota || savingCsat}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {savingCsat ? "Salvando..." : chamado.avaliacao ? "Atualizar avaliação" : "Enviar avaliação"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: sidebar ── */}
          <div className="space-y-4">
            {/* Info */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações</h3>

              {editando ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm((f: any) => ({...f, status: e.target.value}))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none">
                      {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Prioridade</label>
                    <select value={editForm.prioridade} onChange={e => setEditForm((f: any) => ({...f, prioridade: e.target.value}))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none">
                      {Object.entries(PRIO_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Categoria</label>
                    <input value={editForm.categoria} onChange={e => setEditForm((f: any) => ({...f, categoria: e.target.value}))} placeholder="Categoria"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Tags (separadas por vírgula)</label>
                    <input value={editForm.tags} onChange={e => setEditForm((f: any) => ({...f, tags: e.target.value}))} placeholder="urgente, bug, cliente-vip"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Atendente</label>
                    <select value={editForm.atendenteId} onChange={e => setEditForm((f: any) => ({...f, atendenteId: e.target.value}))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none">
                      <option value="">Sem atendente</option>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Solicitante", content: chamado.solicitante ? <div className="flex items-center gap-2"><Avatar nome={chamado.solicitante.nome} size={22} /><span className="text-foreground">{chamado.solicitante.nome}</span></div> : "—" },
                    { label: "Atendente", content: chamado.atendente ? <div className="flex items-center gap-2"><Avatar nome={chamado.atendente.nome} size={22} /><span className="text-foreground">{chamado.atendente.nome}</span></div> : <span className="text-muted-foreground">Não atribuído</span> },
                    { label: "Cliente", content: chamado.cliente ? <div className="flex items-center gap-1.5 text-foreground"><Building2 size={13} className="text-muted-foreground" />{chamado.cliente.empresa || chamado.cliente.nome}</div> : "—" },
                    { label: "Categoria", content: chamado.categoria || <span className="text-muted-foreground">—</span> },
                    chamado.horasEstimadas != null && { label: "Horas estimadas", content: <span className="font-mono text-xs text-blue-400">{chamado.horasEstimadas}h</span> },
                    chamado.skillRequerida && { label: "Skill requerida", content: <span className="text-xs text-violet-400">{chamado.skillRequerida.nome}{chamado.nivelMinimo ? ` · ${chamado.nivelMinimo}` : ""}</span> },
                    { label: "Criado em", content: <span className="font-mono text-xs">{fmtDt(chamado.criadoEm)}</span> },
                    { label: "Atualizado", content: <span className="font-mono text-xs">{fmtDt(chamado.atualizadoEm)}</span> },
                    chamado.resolvidoEm && { label: "Resolvido em", content: <span className="font-mono text-xs text-green-400">{fmtDt(chamado.resolvidoEm)}</span> },
                  ].filter(Boolean).map((row: any) => (
                    <div key={row.label} className="flex justify-between gap-2">
                      <span className="text-muted-foreground flex-shrink-0">{row.label}</span>
                      <div className="text-right">{row.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SLA */}
            <SlaBar chamado={chamado} />

            {/* CSAT resultado */}
            {chamado.avaliacao && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">CSAT</h3>
                <div className="flex items-center gap-2 mb-2">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} size={16} className={cn(n <= chamado.avaliacao! ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                  ))}
                  <span className="text-sm font-bold text-foreground ml-1">{chamado.avaliacao}/5</span>
                </div>
                {chamado.avaliacaoNota && <p className="text-xs text-muted-foreground italic">"{chamado.avaliacaoNota}"</p>}
              </div>
            )}

            {/* Link cliente */}
            {chamado.cliente && (
              <Link href={`/dashboard/clientes/${chamado.clienteId}`} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors text-sm text-muted-foreground hover:text-foreground">
                <Building2 size={14} />
                <span>Ver cliente: {chamado.cliente.empresa || chamado.cliente.nome}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
