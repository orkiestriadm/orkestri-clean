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
  History, MessageSquare, UserCheck, AlertCircle, Tag, Activity,
  ArrowRight, FilePlus, UserPlus, Pencil,
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
type TimelineActor = { id: string; nome: string; avatar?: string } | null;
type TimelineEvent =
  | { id: string; kind: "audit"; acao: string; de?: string|null; para?: string|null; metadata?: any; criadoEm: string; actor: TimelineActor }
  | { id: string; kind: "comentario"; interno: boolean; texto: string; criadoEm: string; actor: TimelineActor }
  | { id: string; kind: "anexo"; nomeOriginal: string; nomeArquivo: string; mimeType: string; tamanhoBytes: number; url: string; criadoEm: string; actor: TimelineActor }
  | { id: string; kind: "apontamento"; minutos: number; descricao?: string; criadoEm: string; actor: TimelineActor };
type TimelineMetrics = {
  tempoEmAbertoMs: number | null; totalEventos: number;
  interacoesPublicas: number; interacoesInternas: number;
  totalAnexos: number; totalApontamentos: number; totalMinutosApontados: number;
};

type Watcher = { id: string; criadoEm: string; user: { id: string; nome: string; email: string; avatar?: string } };
type Subtask = { id: string; titulo: string; concluido: boolean; assigneeId?: string|null; ordem: number; criadoEm: string; concluidoEm?: string|null; assignee?: { id: string; nome: string; avatar?: string } | null };
type LinkedTicket = { id: string; tipo: string; criadoEm: string; outro: { id: string; numero: number; titulo: string; status: string }; criadoPor?: { id: string; nome: string } | null };
type CustomFieldDef = { id: string; categoria?: string|null; label: string; tipo: string; obrigatorio: boolean; ordem: number; opcoesJson?: any; ativo: boolean };
type CustomValue = { id: string; fieldId: string; valor: string; field: CustomFieldDef };
type StatusDurations = { byStatus: Record<string, number>; statusAtual: string; totalSeg: number; segments: { status: string; iniciadoEm: string; finalizadoEm: string|null; duracaoSeg: number }[] };
type ChamadoTemplate = { id: string; nome: string; titulo: string; descricao?: string };

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
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tlMetrics, setTlMetrics] = useState<TimelineMetrics | null>(null);
  const [tlFilter, setTlFilter] = useState<"all"|"audit"|"comentario"|"anexo"|"apontamento">("all");
  // Chamados v2
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [iAmWatching, setIAmWatching] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [novaSub, setNovaSub] = useState("");
  const [links, setLinks] = useState<LinkedTicket[]>([]);
  const [linkForm, setLinkForm] = useState<{ numero: string; tipo: string }>({ numero: "", tipo: "RELACIONADO" });
  const [linkErr, setLinkErr] = useState("");
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<CustomValue[]>([]);
  const [customDirty, setCustomDirty] = useState<Record<string, string>>({});
  const [statusDur, setStatusDur] = useState<StatusDurations | null>(null);
  const [templates, setTemplates] = useState<ChamadoTemplate[]>([]);
  const [showTplMenu, setShowTplMenu] = useState(false);
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
      const [
        { data: c }, { data: apts }, { data: anx }, { data: tl },
        { data: w }, { data: wm }, { data: st }, { data: lk },
        { data: cf }, { data: cv }, { data: sd }, { data: tpls },
      ] = await Promise.all([
        api.get(`/chamados/${id}`),
        api.get(`/apontamentos?chamadoId=${id}`),
        api.get(`/chamados/${id}/anexos`).catch(() => ({ data: [] })),
        api.get(`/chamados/${id}/timeline`).catch(() => ({ data: { events: [], metricas: null } })),
        api.get(`/chamados/${id}/watchers`).catch(() => ({ data: [] })),
        api.get(`/chamados/${id}/watchers/me`).catch(() => ({ data: { watching: false } })),
        api.get(`/chamados/${id}/subtasks`).catch(() => ({ data: [] })),
        api.get(`/chamados/${id}/links`).catch(() => ({ data: [] })),
        api.get(`/chamados/custom-fields`).catch(() => ({ data: [] })),
        api.get(`/chamados/${id}/custom-values`).catch(() => ({ data: [] })),
        api.get(`/chamados/${id}/status-durations`).catch(() => ({ data: null })),
        api.get(`/chamado-templates`).catch(() => ({ data: [] })),
      ]);
      setChamado(c);
      setApontamentos(apts);
      setAnexos(Array.isArray(anx) ? anx : []);
      setTimeline(tl?.events || []);
      setTlMetrics(tl?.metricas || null);
      setWatchers(Array.isArray(w) ? w : []);
      setIAmWatching(!!wm?.watching);
      setSubtasks(Array.isArray(st) ? st : []);
      setLinks(Array.isArray(lk) ? lk : []);
      // re-fetch custom fields filtrados pela categoria do chamado
      try {
        const { data: cfFiltered } = await api.get(`/chamados/custom-fields`, { params: { categoria: c?.categoria || undefined } });
        setCustomFields(Array.isArray(cfFiltered) ? cfFiltered : []);
      } catch { setCustomFields(Array.isArray(cf) ? cf : []); }
      setCustomValues(Array.isArray(cv) ? cv : []);
      setStatusDur(sd || null);
      setTemplates(Array.isArray(tpls) ? tpls : []);
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

  // ─── Watchers ────
  async function toggleWatch() {
    try {
      if (iAmWatching) {
        await api.delete(`/chamados/${id}/watchers/${user?.id}`);
        setIAmWatching(false);
        setWatchers(prev => prev.filter(x => x.user.id !== user?.id));
      } else {
        const { data } = await api.post(`/chamados/${id}/watchers`, {});
        setIAmWatching(true);
        setWatchers(prev => [...prev, data]);
      }
    } catch {}
  }
  async function removeWatcher(userId: string) {
    try {
      await api.delete(`/chamados/${id}/watchers/${userId}`);
      setWatchers(prev => prev.filter(x => x.user.id !== userId));
      if (userId === user?.id) setIAmWatching(false);
    } catch {}
  }
  // ─── Subtasks ────
  async function addSubtask() {
    const t = novaSub.trim();
    if (!t) return;
    try {
      const { data } = await api.post(`/chamados/${id}/subtasks`, { titulo: t });
      setSubtasks(prev => [...prev, data]);
      setNovaSub("");
    } catch {}
  }
  async function toggleSubtask(s: Subtask) {
    try {
      const { data } = await api.patch(`/chamados/${id}/subtasks/${s.id}`, { concluido: !s.concluido });
      setSubtasks(prev => prev.map(x => x.id === s.id ? data : x));
    } catch {}
  }
  async function deleteSubtask(s: Subtask) {
    try {
      await api.delete(`/chamados/${id}/subtasks/${s.id}`);
      setSubtasks(prev => prev.filter(x => x.id !== s.id));
    } catch {}
  }
  // ─── Links ────
  async function addLink() {
    setLinkErr("");
    const num = Number(linkForm.numero);
    if (!num) { setLinkErr("Digite o número do chamado"); return; }
    try {
      // resolve numero -> id via api de chamados (lista filtrada)
      const { data: list } = await api.get(`/chamados`, { params: { q: String(num) } });
      const items = list?.chamados || list || [];
      const found: any = items.find((x: any) => x.numero === num);
      if (!found) { setLinkErr(`Chamado #${num} não encontrado`); return; }
      const { data: link } = await api.post(`/chamados/${id}/links`, { toChamadoId: found.id, tipo: linkForm.tipo });
      // recarrega lista de links pra pegar nome formatado
      const { data: refreshed } = await api.get(`/chamados/${id}/links`);
      setLinks(refreshed);
      setLinkForm({ numero: "", tipo: "RELACIONADO" });
    } catch (e: any) {
      setLinkErr(e?.response?.data?.message || "Erro ao vincular");
    }
  }
  async function removeLink(linkId: string) {
    try {
      await api.delete(`/chamados/${id}/links/${linkId}`);
      setLinks(prev => prev.filter(x => x.id !== linkId));
    } catch {}
  }
  // ─── Custom values ────
  function setCustomLocal(fieldId: string, valor: string) {
    setCustomDirty(prev => ({ ...prev, [fieldId]: valor }));
  }
  async function saveCustomValues() {
    if (Object.keys(customDirty).length === 0) return;
    try {
      const { data } = await api.patch(`/chamados/${id}/custom-values`, { values: customDirty });
      setCustomValues(data);
      setCustomDirty({});
    } catch {}
  }
  // ─── Templates: aplicar no editor de comentário ────
  function applyTemplate(t: ChamadoTemplate) {
    const snip = t.descricao || t.titulo;
    setNovoComent(prev => (prev ? prev + "\n\n" : "") + snip);
    setShowTplMenu(false);
    setTimeout(() => comentRef.current?.focus(), 50);
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
                    {(chamado as any).reaberturasCount > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                        ↺ Reaberto {(chamado as any).reaberturasCount}x
                      </span>
                    )}
                    <button
                      onClick={toggleWatch}
                      className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors",
                        iAmWatching
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-accent")}
                      title={iAmWatching ? "Deixar de seguir" : "Seguir o chamado pra receber notificações"}
                    >
                      {iAmWatching ? "✓ Seguindo" : "+ Seguir"}
                    </button>
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
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Chamado na fila pública</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Ninguém assumiu ainda. Clique em "Assumir" para que ele apareça no seu painel.</div>
                </div>
                <button
                  onClick={handleAssumir}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-colors shrink-0"
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

            {/* Campos customizados (por categoria) */}
            {customFields.length > 0 && (
              <CustomFieldsCard
                fields={customFields}
                values={customValues}
                dirty={customDirty}
                onChange={setCustomLocal}
                onSave={saveCustomValues}
              />
            )}

            {/* Subtasks / Checklist */}
            <SubtasksCard
              subtasks={subtasks}
              novo={novaSub}
              setNovo={setNovaSub}
              onAdd={addSubtask}
              onToggle={toggleSubtask}
              onDelete={deleteSubtask}
              canEdit={canEditarPerm}
              currentUserId={user?.id || ""}
              isMaster={isMaster}
            />

            {/* Vinculos entre chamados */}
            <LinksCard
              links={links}
              form={linkForm}
              setForm={setLinkForm}
              err={linkErr}
              onAdd={addLink}
              onRemove={removeLink}
              canEdit={canEditarPerm}
            />

            {/* Tempo por status (derivado do log) */}
            {statusDur && <StatusDurationsCard data={statusDur} />}

            {/* Histórico unificado (auditoria + comentários + anexos + apontamentos) */}
            <TimelineSection
              events={timeline}
              metricas={tlMetrics}
              filter={tlFilter}
              setFilter={setTlFilter}
              chamadoCriadoEm={chamado.criadoEm}
              solicitanteNome={chamado.solicitante?.nome}
            />

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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInterno(i => !i)}
                      className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                        interno ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" : "text-muted-foreground border-border hover:bg-accent"
                      )}
                    >
                      {interno ? <Lock size={12} /> : <Unlock size={12} />}
                      {interno ? "Nota interna" : "Público"}
                    </button>
                    {/* Template picker */}
                    {templates.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowTplMenu(s => !s)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
                          title="Inserir template de resposta"
                        >
                          ⚡ Template <ChevronDown size={11} />
                        </button>
                        {showTplMenu && (
                          <div className="absolute bottom-full left-0 mb-1 min-w-[260px] max-h-[300px] overflow-auto bg-card border border-border rounded-lg shadow-lg z-30">
                            {templates.map(t => (
                              <button
                                key={t.id}
                                onClick={() => applyTemplate(t)}
                                className="block w-full text-left px-3 py-2 text-xs hover:bg-accent border-b border-border last:border-b-0"
                              >
                                <div className="font-semibold text-foreground">{t.nome}</div>
                                <div className="text-muted-foreground truncate">{t.descricao || t.titulo}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground">Use <code className="bg-muted/50 px-1 rounded">@nome</code> para mencionar</span>
                  </div>
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
            {/* Seguidores */}
            <WatchersCard
              watchers={watchers}
              iAmWatching={iAmWatching}
              onToggleSelf={toggleWatch}
              onRemove={removeWatcher}
              currentUserId={user?.id || ""}
              isMaster={isMaster}
            />

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
                    chamado.skillRequerida && { label: "Skill requerida", content: <span className="text-xs text-red-400">{chamado.skillRequerida.nome}{chamado.nivelMinimo ? ` · ${chamado.nivelMinimo}` : ""}</span> },
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

// ───────────────────────────────────────────────────────────────────────────────
// Timeline / Histórico unificado
// ───────────────────────────────────────────────────────────────────────────────

function fmtRelative(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60_000)    return `${Math.round(diff/1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.round(diff/60_000)} min atrás`;
  if (diff < 86_400_000) return `${Math.round(diff/3_600_000)} h atrás`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff/86_400_000)} d atrás`;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: diff > 365*86_400_000 ? "numeric" : undefined });
}
function fmtAbs(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(ms: number | null): string {
  if (!ms || ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr  / 24);
  if (day > 0) return `${day}d ${hr % 24}h`;
  if (hr  > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min} min`;
  return `${sec}s`;
}
function fmtHorasMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h)      return `${h}h`;
  return `${m}m`;
}

// Avatar mini reutilizado pelos eventos da timeline
function MiniAvatar({ nome }: { nome?: string }) {
  if (!nome) return (
    <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-[10px] text-muted-foreground">?</div>
  );
  const ini = nome.split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase();
  // hash simples para hue estavel por nome
  let h = 0; for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return (
    <div
      title={nome}
      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue},65%,45%), hsl(${(hue+30)%360},65%,55%))` }}
    >
      {ini}
    </div>
  );
}

const FILTER_LABEL: Record<string, string> = {
  all:          "Tudo",
  audit:        "Sistema",
  comentario:   "Comentários",
  anexo:        "Anexos",
  apontamento:  "Horas",
};

function TimelineSection({
  events, metricas, filter, setFilter, chamadoCriadoEm, solicitanteNome,
}: {
  events: TimelineEvent[];
  metricas: TimelineMetrics | null;
  filter: "all"|"audit"|"comentario"|"anexo"|"apontamento";
  setFilter: (f: "all"|"audit"|"comentario"|"anexo"|"apontamento") => void;
  chamadoCriadoEm: string;
  solicitanteNome?: string;
}) {
  const filtered = filter === "all" ? events : events.filter(e => e.kind === filter);

  // Agrupar por dia (chave: YYYY-MM-DD)
  const groups = filtered.reduce<Record<string, TimelineEvent[]>>((acc, ev) => {
    const k = new Date(ev.criadoEm).toISOString().slice(0, 10);
    (acc[k] = acc[k] || []).push(ev);
    return acc;
  }, {});
  const dayKeys = Object.keys(groups).sort().reverse();

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header da seção */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Histórico do chamado</h2>
          <span className="text-xs text-muted-foreground">({events.length})</span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {(["all","audit","comentario","anexo","apontamento"] as const).map(k => {
            const isOn = filter === k;
            const count = k === "all" ? events.length : events.filter(e => e.kind === k).length;
            return (
              <button key={k}
                onClick={() => setFilter(k)}
                className={cn("px-2.5 py-1 rounded-md transition-colors border",
                  isOn
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "border-transparent text-muted-foreground hover:bg-accent")}
              >
                {FILTER_LABEL[k]} {count > 0 && <span className="opacity-60">· {count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Métricas resumo */}
      {metricas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 pb-4 border-b border-border">
          <MetricChip label="Aberto há"          value={fmtDur(metricas.tempoEmAbertoMs)} />
          <MetricChip label="Interações"         value={`${metricas.interacoesPublicas} púb · ${metricas.interacoesInternas} int`} />
          <MetricChip label="Anexos"             value={metricas.totalAnexos.toString()} />
          <MetricChip label="Horas apontadas"    value={metricas.totalMinutosApontados ? fmtHorasMin(metricas.totalMinutosApontados) : "—"} />
        </div>
      )}

      {/* Timeline */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {events.length === 0 ? "Histórico vazio." : "Nenhum evento no filtro atual."}
        </p>
      ) : (
        <div className="space-y-5">
          {dayKeys.map(day => (
            <div key={day}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
                {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
              </div>
              <ol className="relative border-l border-border ml-3 space-y-3">
                {groups[day].map(ev => <TimelineItem key={ev.id} ev={ev} />)}
              </ol>
            </div>
          ))}
          {solicitanteNome && (
            <div className="pt-2 text-[11px] text-muted-foreground italic">
              Chamado aberto por <b>{solicitanteNome}</b> em {fmtAbs(chamadoCriadoEm)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5 truncate" title={value}>{value}</div>
    </div>
  );
}

// Mapeia uma acao de auditoria pra label/icone/cor amigaveis
function describeAudit(ev: Extract<TimelineEvent, { kind: "audit" }>) {
  const a = ev.acao;
  if (a === "criado")        return { Icon: AlertCircle, color: "text-blue-400",   verb: "Abriu o chamado" };
  if (a === "status")        return { Icon: Activity,    color: "text-yellow-400", verb: `Status: ${ev.de || "—"} → ${ev.para || "—"}` };
  if (a === "prioridade")    return { Icon: Tag,         color: "text-orange-400", verb: `Prioridade: ${ev.de || "—"} → ${ev.para || "—"}` };
  if (a === "atribuicao")    return { Icon: UserCheck,   color: "text-violet-400", verb: ev.para ? "Atribuiu atendente" : "Removeu atendente" };
  if (a === "assumido")      return { Icon: UserPlus,    color: "text-green-400",  verb: "Assumiu o chamado" };
  if (a === "comentario")    return { Icon: MessageSquare, color: "text-blue-400", verb: `Comentário ${ev.para === "interno" ? "interno" : "público"}` };
  if (a === "reabertura")    return { Icon: RefreshCw,   color: "text-orange-400", verb: `Reabriu o chamado (${(ev.metadata as any)?.contador || "?"}ª vez)` };
  if (a === "watcher_add")   return { Icon: UserPlus,    color: "text-cyan-400",   verb: `Adicionou seguidor: ${ev.para}` };
  if (a === "subtask_add")   return { Icon: CheckCircle, color: "text-green-400",  verb: `Adicionou subtarefa: "${ev.para}"` };
  if (a === "subtask_toggle")return { Icon: CheckCircle, color: ev.para === "feito" ? "text-green-400" : "text-muted-foreground", verb: `Subtarefa "${(ev.metadata as any)?.titulo || ""}" ${ev.para === "feito" ? "concluída" : "reaberta"}` };
  if (a === "subtask_remove")return { Icon: Trash2,      color: "text-red-400",    verb: `Removeu subtarefa: "${ev.de}"` };
  if (a === "link_add")      return { Icon: ArrowRight,  color: "text-violet-400", verb: `Vinculou chamado: ${(ev.metadata as any)?.toNumero ? "#" + (ev.metadata as any).toNumero : (ev.metadata as any)?.fromNumero ? "#" + (ev.metadata as any).fromNumero : ""} (${ev.para})` };
  if (a === "link_remove")   return { Icon: ArrowRight,  color: "text-muted-foreground", verb: `Removeu vínculo ${ev.de || ""}` };
  if (a === "custom_field")  return { Icon: Pencil,      color: "text-blue-400",   verb: `Campo "${(ev.metadata as any)?.label || ""}": ${ev.de || "—"} → ${ev.para || "—"}` };
  if (a === "mencao")        return { Icon: UserCheck,   color: "text-cyan-400",   verb: `Mencionou ${ev.para}` };
  return { Icon: Pencil, color: "text-muted-foreground", verb: a };
}

// ───────────────────────────────────────────────────────────────────────────────
// Watchers / Seguidores
// ───────────────────────────────────────────────────────────────────────────────
function WatchersCard({ watchers, iAmWatching, onToggleSelf, onRemove, currentUserId, isMaster }: {
  watchers: Watcher[]; iAmWatching: boolean; onToggleSelf: () => void;
  onRemove: (userId: string) => void; currentUserId: string; isMaster: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <User size={12} /> Seguidores ({watchers.length})
        </h3>
        <button
          onClick={onToggleSelf}
          className={cn("text-[11px] px-2 py-0.5 rounded-md border transition-colors",
            iAmWatching ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-border hover:bg-accent")}
        >
          {iAmWatching ? "✓ Seguindo" : "+ Seguir"}
        </button>
      </div>
      {watchers.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Ninguém está acompanhando este chamado.</p>
      ) : (
        <div className="space-y-1.5">
          {watchers.map(w => (
            <div key={w.id} className="flex items-center gap-2 text-xs">
              <MiniAvatar nome={w.user.nome} />
              <span className="flex-1 truncate text-foreground">{w.user.nome}</span>
              {(w.user.id === currentUserId || isMaster) && (
                <button onClick={() => onRemove(w.user.id)} className="text-muted-foreground hover:text-red-400" title="Remover">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Subtasks (checklist)
// ───────────────────────────────────────────────────────────────────────────────
function SubtasksCard({ subtasks, novo, setNovo, onAdd, onToggle, onDelete, canEdit, currentUserId, isMaster }: {
  subtasks: Subtask[]; novo: string; setNovo: (s: string) => void;
  onAdd: () => void; onToggle: (s: Subtask) => void; onDelete: (s: Subtask) => void;
  canEdit: boolean; currentUserId: string; isMaster: boolean;
}) {
  const done = subtasks.filter(s => s.concluido).length;
  const pct = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CheckCircle size={14} className="text-muted-foreground" />
          Checklist <span className="text-muted-foreground font-normal">({done}/{subtasks.length})</span>
        </h2>
        {subtasks.length > 0 && (
          <span className="text-[11px] text-muted-foreground font-mono">{pct}% concluído</span>
        )}
      </div>
      {subtasks.length > 0 && (
        <div className="h-1 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="space-y-1">
        {subtasks.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Sem subtarefas. Adicione abaixo.</p>
        )}
        {subtasks.map(s => (
          <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/30 transition-colors group">
            <input
              type="checkbox" checked={s.concluido}
              onChange={() => onToggle(s)}
              disabled={!canEdit}
              className="rounded border-border w-4 h-4 cursor-pointer"
            />
            <span className={cn("flex-1 text-sm", s.concluido ? "line-through text-muted-foreground" : "text-foreground")}>
              {s.titulo}
            </span>
            {s.assignee && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MiniAvatar nome={s.assignee.nome} /> {s.assignee.nome.split(" ")[0]}
              </span>
            )}
            {canEdit && (
              <button onClick={() => onDelete(s)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition" title="Remover">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="mt-3 flex gap-2">
          <input
            value={novo}
            onChange={e => setNovo(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onAdd(); }}
            placeholder="Nova subtarefa…"
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={onAdd} disabled={!novo.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            <Plus size={12} className="inline" /> Add
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Linked tickets
// ───────────────────────────────────────────────────────────────────────────────
const LINK_TIPO_LABEL: Record<string, { label: string; color: string }> = {
  RELACIONADO:    { label: "relacionado",     color: "text-blue-400" },
  BLOQUEIA:       { label: "bloqueia",        color: "text-red-400" },
  BLOQUEADO_POR:  { label: "bloqueado por",   color: "text-orange-400" },
  DUPLICADO_DE:   { label: "duplicado de",    color: "text-muted-foreground" },
  DUPLICADO_POR:  { label: "duplicado por",   color: "text-muted-foreground" },
};

function LinksCard({ links, form, setForm, err, onAdd, onRemove, canEdit }: {
  links: LinkedTicket[]; form: { numero: string; tipo: string };
  setForm: (f: { numero: string; tipo: string }) => void;
  err: string; onAdd: () => void; onRemove: (id: string) => void; canEdit: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <ArrowRight size={14} className="text-muted-foreground" />
        Chamados vinculados <span className="text-muted-foreground font-normal">({links.length})</span>
      </h2>
      {links.length === 0 && <p className="text-xs text-muted-foreground italic mb-3">Nenhum vínculo.</p>}
      <div className="space-y-1.5 mb-3">
        {links.map(l => {
          const info = LINK_TIPO_LABEL[l.tipo] || { label: l.tipo, color: "text-muted-foreground" };
          return (
            <div key={l.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-accent/30 group">
              <span className={cn("text-[10px] uppercase font-mono font-medium", info.color)}>{info.label}</span>
              <Link href={`/dashboard/chamados/${l.outro.id}`} className="flex-1 truncate hover:underline">
                <span className="text-muted-foreground font-mono">#{l.outro.numero}</span> <span className="text-foreground">{l.outro.titulo}</span>
              </Link>
              {canEdit && (
                <button onClick={() => onRemove(l.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400" title="Desvincular">
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
            className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs">
            <option value="RELACIONADO">Relacionado</option>
            <option value="BLOQUEIA">Bloqueia</option>
            <option value="BLOQUEADO_POR">Bloqueado por</option>
            <option value="DUPLICADO_DE">Duplicado de</option>
          </select>
          <input
            value={form.numero}
            onChange={e => setForm({ ...form, numero: e.target.value })}
            onKeyDown={e => { if (e.key === "Enter") onAdd(); }}
            placeholder="# do chamado"
            type="number"
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={onAdd} disabled={!form.numero}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            Vincular
          </button>
        </div>
      )}
      {err && <div className="text-xs text-red-400 mt-2">{err}</div>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Custom fields
// ───────────────────────────────────────────────────────────────────────────────
function CustomFieldsCard({ fields, values, dirty, onChange, onSave }: {
  fields: CustomFieldDef[]; values: CustomValue[];
  dirty: Record<string, string>;
  onChange: (fieldId: string, valor: string) => void;
  onSave: () => void;
}) {
  const valueOf = (fid: string) => {
    if (fid in dirty) return dirty[fid];
    const v = values.find(x => x.fieldId === fid);
    return v?.valor ?? "";
  };
  const hasDirty = Object.keys(dirty).length > 0;
  const sorted = [...fields].sort((a, b) => a.ordem - b.ordem);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Tag size={14} className="text-muted-foreground" /> Campos customizados
        </h2>
        {hasDirty && (
          <button onClick={onSave} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
            <Save size={11} className="inline mr-1" /> Salvar alterações
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map(f => {
          const v = valueOf(f.id);
          const opts: string[] = Array.isArray(f.opcoesJson) ? f.opcoesJson : (f.opcoesJson?.options || []);
          return (
            <div key={f.id} className="space-y-1">
              <label className="block text-[11px] text-muted-foreground">
                {f.label} {f.obrigatorio && <span className="text-red-400">*</span>}
              </label>
              {f.tipo === "TEXTAREA" ? (
                <textarea value={v} onChange={e => onChange(f.id, e.target.value)} rows={2}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              ) : f.tipo === "SELECT" ? (
                <select value={v} onChange={e => onChange(f.id, e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm">
                  <option value="">—</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.tipo === "BOOLEAN" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={v === "true"} onChange={e => onChange(f.id, e.target.checked ? "true" : "false")} className="w-4 h-4" />
                  <span className="text-foreground">{v === "true" ? "Sim" : "Não"}</span>
                </label>
              ) : (
                <input
                  value={v}
                  onChange={e => onChange(f.id, e.target.value)}
                  type={f.tipo === "DATE" ? "date" : f.tipo === "NUMBER" ? "number" : "text"}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Status durations (tempo gasto em cada status)
// ───────────────────────────────────────────────────────────────────────────────
const STATUS_COLOR_BAR: Record<string, string> = {
  aberto: "#94a3b8",
  em_atendimento: "#60a5fa",
  aguardando: "#facc15",
  resolvido: "#22c55e",
  fechado: "#64748b",
  cancelado: "#ef4444",
};
function StatusDurationsCard({ data }: { data: StatusDurations }) {
  const total = Math.max(1, data.totalSeg);
  const items = Object.entries(data.byStatus).sort((a,b) => b[1]-a[1]);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
        <Clock size={14} className="text-muted-foreground" /> Tempo em cada status
        <span className="text-muted-foreground font-normal">· total {fmtDur(data.totalSeg * 1000)}</span>
      </h2>
      <div className="flex w-full h-2 rounded-full overflow-hidden bg-muted mb-3">
        {items.map(([s, sec]) => (
          <div key={s}
            title={`${s}: ${fmtDur(sec * 1000)} (${Math.round(sec / total * 100)}%)`}
            style={{ width: `${(sec / total) * 100}%`, background: STATUS_COLOR_BAR[s] || "#888" }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        {items.map(([s, sec]) => (
          <div key={s} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLOR_BAR[s] || "#888" }} />
            <span className="text-muted-foreground capitalize flex-1">{s.replace(/_/g, " ")}</span>
            <span className="font-mono text-foreground">{fmtDur(sec * 1000)}</span>
          </div>
        ))}
      </div>
      {data.statusAtual && (
        <div className="text-[10px] text-muted-foreground mt-3 italic">
          Status atual: <b className="text-foreground capitalize">{data.statusAtual.replace(/_/g, " ")}</b>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ ev }: { ev: TimelineEvent }) {
  // Aviso: a auditoria de "comentario" nao vai aparecer (filtrado no backend),
  // os comentarios reais entram como kind === "comentario" abaixo.
  if (ev.kind === "audit") {
    const { Icon, color, verb } = describeAudit(ev);
    return (
      <li className="ml-4 relative">
        <span className="absolute -left-[26px] top-0.5 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
          <Icon size={11} className={color} />
        </span>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <MiniAvatar nome={ev.actor?.nome} />
          <span className="font-medium">{ev.actor?.nome || "Sistema"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{verb}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 ml-9" title={fmtAbs(ev.criadoEm)}>
          {fmtRelative(ev.criadoEm)}
        </div>
      </li>
    );
  }
  if (ev.kind === "comentario") {
    return (
      <li className="ml-4 relative">
        <span className="absolute -left-[26px] top-0.5 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
          <MessageSquare size={11} className={ev.interno ? "text-yellow-400" : "text-blue-400"} />
        </span>
        <div className="flex items-center gap-2 text-sm">
          <MiniAvatar nome={ev.actor?.nome} />
          <span className="font-medium text-foreground">{ev.actor?.nome || "?"}</span>
          {ev.interno && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-medium">
              <Lock size={9} className="inline mr-1" /> Nota interna
            </span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground" title={fmtAbs(ev.criadoEm)}>{fmtRelative(ev.criadoEm)}</span>
        </div>
        <div className={cn("text-sm mt-1 ml-9 px-3 py-2 rounded-lg whitespace-pre-wrap break-words",
          ev.interno ? "bg-yellow-500/8 border border-yellow-500/20 text-foreground"
                     : "bg-muted/40 text-foreground")}>
          {ev.texto}
        </div>
      </li>
    );
  }
  if (ev.kind === "anexo") {
    return (
      <li className="ml-4 relative">
        <span className="absolute -left-[26px] top-0.5 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
          <Paperclip size={11} className="text-emerald-400" />
        </span>
        <div className="flex items-center gap-2 text-sm">
          <MiniAvatar nome={ev.actor?.nome} />
          <span className="font-medium text-foreground">{ev.actor?.nome || "?"}</span>
          <span className="text-muted-foreground">enviou anexo</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground" title={fmtAbs(ev.criadoEm)}>{fmtRelative(ev.criadoEm)}</span>
        </div>
        <a href={ev.url} target="_blank" rel="noopener noreferrer"
           className="text-xs ml-9 mt-1 inline-flex items-center gap-1.5 text-emerald-400 hover:underline">
          <FilePlus size={11} /> {ev.nomeOriginal}
          <span className="text-muted-foreground">· {(ev.tamanhoBytes/1024).toFixed(0)} KB</span>
        </a>
      </li>
    );
  }
  if (ev.kind === "apontamento") {
    return (
      <li className="ml-4 relative">
        <span className="absolute -left-[26px] top-0.5 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
          <Clock size={11} className="text-cyan-400" />
        </span>
        <div className="flex items-center gap-2 text-sm">
          <MiniAvatar nome={ev.actor?.nome} />
          <span className="font-medium text-foreground">{ev.actor?.nome || "?"}</span>
          <span className="text-muted-foreground">apontou</span>
          <span className="font-mono text-cyan-400">{fmtHorasMin(ev.minutos)}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground" title={fmtAbs(ev.criadoEm)}>{fmtRelative(ev.criadoEm)}</span>
        </div>
        {ev.descricao && <div className="text-xs text-muted-foreground italic ml-9 mt-1">{ev.descricao}</div>}
      </li>
    );
  }
  return null;
}
