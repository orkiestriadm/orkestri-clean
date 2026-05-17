"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Plus, Search, X, Send, Tag, Building2, Star, Loader2, RefreshCw,
  MessageSquare, ExternalLink, BookOpen
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";

// ── Types ──────────────────────────────────────────────────────────────────────
type Chamado = {
  id: string; numero: number; titulo: string; descricao: string;
  status: string; prioridade: string; categoria?: string; tags?: string;
  solicitanteId: string; atendenteId?: string; clienteId?: string;
  slaHoras?: number; slaStatus?: "ok" | "risco" | "violado";
  resolvidoEm?: string; fechadoEm?: string;
  avaliacao?: number; avaliacaoNota?: string;
  criadoEm: string; atualizadoEm: string;
  solicitante: { id: string; nome: string; email: string };
  atendente?: { id: string; nome: string; email: string };
  cliente?: { id: string; nome: string; empresa?: string };
  comentarios?: Comentario[];
};
type Comentario = {
  id: string; userId: string; texto: string;
  interno: boolean; criadoEm: string;
  user: { id: string; nome: string };
};
type Stats = {
  total: number; aberto: number; em_atendimento: number;
  aguardando: number; resolvido: number; fechado: number;
  slaViolados: number; slaEmRisco: number;
};
type Usuario = { id: string; nome: string; email: string };
type Cliente = { id: string; nome: string; empresa?: string };

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_COLS = [
  { key: "aberto",         label: "Aberto",         color: "#94a3b8", bg: "bg-slate-500/10",   border: "border-slate-500/30"  },
  { key: "em_atendimento", label: "Em Atendimento", color: "#60a5fa", bg: "bg-blue-500/10",    border: "border-blue-500/30"   },
  { key: "aguardando",     label: "Aguardando",     color: "#fbbf24", bg: "bg-yellow-500/10",  border: "border-yellow-500/30" },
  { key: "resolvido",      label: "Resolvido",      color: "#34d399", bg: "bg-emerald-500/10", border: "border-emerald-500/30"},
  { key: "fechado",        label: "Fechado",        color: "#a78bfa", bg: "bg-violet-500/10",  border: "border-violet-500/30" },
];
const PRIORIDADE_MAP: Record<string, { label: string; color: string; dot: string }> = {
  baixa:   { label: "Baixa",   color: "text-slate-400",  dot: "bg-slate-400"  },
  media:   { label: "Média",   color: "text-blue-400",   dot: "bg-blue-400"   },
  alta:    { label: "Alta",    color: "text-orange-400", dot: "bg-orange-400" },
  critica: { label: "Crítica", color: "text-red-400",    dot: "bg-red-400"    },
};
const SLA_STATUS_MAP = {
  risco:   { label: "SLA em Risco", cls: "text-yellow-400" },
  violado: { label: "SLA Violado",  cls: "text-red-400"    },
};
const CATEGORIAS = ["Suporte Técnico","Financeiro","Comercial","RH","TI","Infraestrutura","Dúvida","Solicitação","Reclamação","Outro"];
const PRIORIDADES = ["baixa","media","alta","critica"];
const NEXT_STATUS: Record<string, string[]> = {
  aberto:         ["em_atendimento", "fechado"],
  em_atendimento: ["aguardando", "resolvido"],
  aguardando:     ["em_atendimento", "resolvido"],
  resolvido:      ["fechado", "em_atendimento"],
  fechado:        [],
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(nome: string) {
  return nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}
function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const p = PRIORIDADE_MAP[prioridade] || PRIORIDADE_MAP.media;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${p.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
}

function SlaBadge({ slaStatus }: { slaStatus?: string }) {
  if (!slaStatus || slaStatus === "ok") return null;
  const s = SLA_STATUS_MAP[slaStatus as keyof typeof SLA_STATUS_MAP];
  if (!s) return null;
  return <span className={`text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
}

function Avatar({ nome, size = 6 }: { nome: string; size?: number }) {
  const sizeClass = `w-${size} h-${size}`;
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary/40 to-cyan-400/30 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0`}>
      {initials(nome)}
    </div>
  );
}

// ── Kanban Card ────────────────────────────────────────────────────────────────
function ChamadoCard({ chamado, onClick, selected, onSelect }: {
  chamado: Chamado; onClick: () => void;
  selected?: boolean; onSelect?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className={`relative w-full text-left bg-card border rounded-lg p-3 transition-all ${selected ? "border-primary/60 ring-1 ring-primary/20" : "border-border hover:border-primary/40 hover:shadow-sm"}`}>
      {onSelect && (
        <div className="absolute top-2 right-2 z-10" onClick={onSelect}>
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${selected ? "bg-primary border-primary" : "border-border bg-background hover:border-primary/60"}`}>
            {selected && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>}
          </div>
        </div>
      )}
      <button onClick={onClick} className="w-full text-left">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] text-muted-foreground font-mono">#{chamado.numero}</span>
        <PrioridadeBadge prioridade={chamado.prioridade} />
      </div>
      <p className="text-xs font-medium text-foreground line-clamp-2 mb-2">{chamado.titulo}</p>
      {chamado.categoria && (
        <span className="inline-block text-[10px] text-muted-foreground bg-accent/60 rounded px-1.5 py-0.5 mb-2">
          {chamado.categoria}
        </span>
      )}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          <Avatar nome={chamado.solicitante.nome} size={5} />
          {chamado.atendente && (
            <>
              <span className="text-muted-foreground/40 text-[10px]">→</span>
              <Avatar nome={chamado.atendente.nome} size={5} />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SlaBadge slaStatus={chamado.slaStatus} />
          <span className="text-[10px] text-muted-foreground">{relTime(chamado.criadoEm)}</span>
        </div>
      </div>
      </button>
    </div>
  );
}

// ── New Chamado Modal ──────────────────────────────────────────────────────────
type Template = { nome: string; titulo: string; descricao: string; prioridade: string; categoria: string };
const TEMPLATES_KEY = "chamado-templates-v1";
function loadTemplates(): Template[] { try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"); } catch { return []; } }
function saveTemplates(ts: Template[]) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(ts)); }

type KbSugestao = { id: string; titulo: string; slug: string; resumo?: string; categoria?: { nome: string; cor: string } };

function NovoChamadoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ titulo: "", descricao: "", prioridade: "media", categoria: "", clienteId: "" });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateNome, setTemplateNome] = useState("");
  const [kbSugestoes, setKbSugestoes] = useState<KbSugestao[]>([]);
  const [kbArtigo, setKbArtigo] = useState<KbSugestao & { conteudo?: string } | null>(null);

  useEffect(() => {
    api.get("/clientes").then(r => setClientes(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    setTemplates(loadTemplates());
  }, []);

  useEffect(() => {
    if (form.titulo.length < 3) { setKbSugestoes([]); return; }
    const t = setTimeout(() => {
      api.get("/conhecimento/artigos", { params: { status: "publicado", search: form.titulo, limit: 3 } })
        .then(r => setKbSugestoes(Array.isArray(r.data) ? r.data.slice(0, 3) : []))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [form.titulo]);

  function applyTemplate(t: Template) {
    setForm(f => ({ ...f, titulo: t.titulo, descricao: t.descricao, prioridade: t.prioridade, categoria: t.categoria }));
  }
  function saveAsTemplate() {
    if (!templateNome.trim() || !form.titulo) return;
    const updated = [...templates.filter(t => t.nome !== templateNome.trim()), { nome: templateNome.trim(), ...form }];
    saveTemplates(updated);
    setTemplates(updated);
    setShowSaveTemplate(false);
    setTemplateNome("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) {
      setError("Título e descrição são obrigatórios");
      return;
    }
    setSaving(true); setError("");
    try {
      await api.post("/chamados", { ...form, clienteId: form.clienteId || undefined });
      onCreated(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao criar chamado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Novo Chamado</h2>
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <select onChange={e => { if (e.target.value) applyTemplate(templates.find(t => t.nome === e.target.value)!); e.target.value = ""; }}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-muted-foreground focus:outline-none">
                <option value="">Usar template...</option>
                {templates.map(t => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
              </select>
            )}
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          {/* Artigo KB selecionado */}
          {kbArtigo && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BookOpen size={12} className="text-blue-400 shrink-0" />
                    <span className="text-[10px] text-blue-400 font-medium">Artigo relacionado</span>
                  </div>
                  <div className="text-[12px] font-medium text-foreground truncate">{kbArtigo.titulo}</div>
                  {kbArtigo.resumo && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{kbArtigo.resumo}</div>}
                </div>
                <button type="button" onClick={() => setKbArtigo(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X size={14} /></button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Título *</label>
            <input
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
              placeholder="Descreva brevemente o problema..."
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            />
            {kbSugestoes.length > 0 && !kbArtigo && (
              <div className="mt-1 rounded-lg border border-border bg-card shadow-md overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center gap-1.5">
                  <BookOpen size={11} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Artigos relacionados na base de conhecimento</span>
                </div>
                {kbSugestoes.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setKbArtigo(a)}
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {a.categoria && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: a.categoria.cor + "20", color: a.categoria.cor }}>
                          {a.categoria.nome}
                        </span>
                      )}
                      <span className="text-[12px] text-foreground truncate">{a.titulo}</span>
                    </div>
                    {a.resumo && <div className="text-[10px] text-muted-foreground truncate mt-0.5">{a.resumo}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Descrição *</label>
            <textarea
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 resize-none"
              placeholder="Detalhe o problema ou solicitação..."
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
              >
                {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_MAP[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              >
                <option value="">Selecionar...</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cliente (opcional)</label>
            <select
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
              value={form.clienteId}
              onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
            >
              <option value="">Nenhum</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ""}</option>
              ))}
            </select>
          </div>
          {showSaveTemplate ? (
            <div className="flex gap-2 pt-1">
              <input value={templateNome} onChange={e => setTemplateNome(e.target.value)}
                placeholder="Nome do template..." autoFocus
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/60" />
              <button type="button" onClick={saveAsTemplate}
                className="px-3 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-xs hover:bg-primary/20 transition-colors">Salvar</button>
              <button type="button" onClick={() => setShowSaveTemplate(false)}
                className="px-2 py-2 text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSaveTemplate(true)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors self-start">
              + Salvar como template
            </button>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Abrir Chamado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────
function ChamadoDrawer({ chamado, isMaster, userId, onClose, onUpdated }: {
  chamado: Chamado; isMaster: boolean; userId: string;
  onClose: () => void; onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<Chamado>(chamado);
  const [comment, setComment] = useState("");
  const [interno, setInterno] = useState(false);
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingNota, setRatingNota] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [users, setUsers] = useState<Usuario[]>([]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/chamados/${chamado.id}`);
      setDetail(data);
    } catch {}
  }, [chamado.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isMaster) return;
    api.get("/users").then(r => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [isMaster]);

  async function sendComment() {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await api.post(`/chamados/${chamado.id}/comentarios`, { texto: comment, interno });
      setComment("");
      load();
      onUpdated();
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(newStatus: string) {
    setChangingStatus(true);
    try {
      await api.patch(`/chamados/${chamado.id}/status`, { status: newStatus });
      load();
      onUpdated();
    } finally {
      setChangingStatus(false);
    }
  }

  async function atribuir(atendenteId: string) {
    setAtribuindo(true);
    try {
      await api.patch(`/chamados/${chamado.id}/atribuir`, { atendenteId: atendenteId || null });
      load();
      onUpdated();
    } finally {
      setAtribuindo(false);
    }
  }

  async function avaliar() {
    if (!rating) return;
    setSavingRating(true);
    try {
      await api.patch(`/chamados/${chamado.id}/avaliar`, { avaliacao: rating, avaliacaoNota: ratingNota });
      load();
      onUpdated();
    } finally {
      setSavingRating(false);
    }
  }

  const col = STATUS_COLS.find(c => c.key === detail.status) || STATUS_COLS[0];
  const nextStatuses = NEXT_STATUS[detail.status] || [];
  const isSolicitante = detail.solicitanteId === userId;
  const canEvaluate = isSolicitante && detail.status === "resolvido" && !detail.avaliacao;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-card border-l border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-mono">#{detail.numero}</span>
              <span
                className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: col.color + "20", color: col.color }}
              >
                {col.label}
              </span>
              <PrioridadeBadge prioridade={detail.prioridade} />
              <SlaBadge slaStatus={detail.slaStatus} />
            </div>
            <h2 className="font-semibold text-foreground text-sm leading-snug">{detail.titulo}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <a href={`/dashboard/chamados/${detail.id}`} title="Abrir página completa"
              className="text-muted-foreground hover:text-foreground">
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Meta info */}
          <div className="px-6 py-4 space-y-3 border-b border-border">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Solicitante</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Avatar nome={detail.solicitante.nome} />
                  <span className="text-foreground font-medium">{detail.solicitante.nome}</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Atendente</span>
                {isMaster ? (
                  <select
                    className="mt-1 w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                    value={detail.atendenteId || ""}
                    onChange={e => atribuir(e.target.value)}
                    disabled={atribuindo}
                  >
                    <option value="">Não atribuído</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1">
                    {detail.atendente
                      ? <><Avatar nome={detail.atendente.nome} /><span className="text-foreground font-medium">{detail.atendente.nome}</span></>
                      : <span className="text-muted-foreground italic">Não atribuído</span>}
                  </div>
                )}
              </div>
              {detail.cliente && (
                <div>
                  <span className="text-muted-foreground">Cliente</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Building2 size={14} className="text-muted-foreground" />
                    <span className="text-foreground">{detail.cliente.nome}</span>
                  </div>
                </div>
              )}
              {detail.categoria && (
                <div>
                  <span className="text-muted-foreground">Categoria</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Tag size={14} className="text-muted-foreground" />
                    <span className="text-foreground">{detail.categoria}</span>
                  </div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Aberto em</span>
                <div className="text-foreground mt-1">{formatDate(detail.criadoEm)}</div>
              </div>
              {detail.slaHoras && (
                <div>
                  <span className="text-muted-foreground">SLA</span>
                  <div className="text-foreground mt-1">{detail.slaHoras}h</div>
                </div>
              )}
            </div>

            {/* Status actions */}
            {nextStatuses.length > 0 && (isMaster || detail.atendenteId === userId || isSolicitante) && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs text-muted-foreground">Mover para:</span>
                {nextStatuses.map(s => {
                  const c = STATUS_COLS.find(x => x.key === s)!;
                  return (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      disabled={changingStatus}
                      className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ borderColor: c.color + "40", color: c.color, background: c.color + "15" }}
                    >
                      {changingStatus ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Descrição</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{detail.descricao}</p>
          </div>

          {/* CSAT rating */}
          {canEvaluate && (
            <div className="px-6 py-4 border-b border-border bg-emerald-500/5">
              <h3 className="text-xs font-medium text-emerald-400 mb-3">Avaliar atendimento</h3>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRating(n)} className={`transition-colors ${n <= rating ? "text-yellow-400" : "text-muted-foreground/40"}`}>
                    <Star size={22} fill={n <= rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none resize-none mb-2"
                placeholder="Comentário (opcional)..."
                value={ratingNota}
                onChange={e => setRatingNota(e.target.value)}
              />
              <button
                onClick={avaliar}
                disabled={!rating || savingRating}
                className="text-xs px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-500 transition-colors flex items-center gap-2"
              >
                {savingRating && <Loader2 size={12} className="animate-spin" />}
                Enviar avaliação
              </button>
            </div>
          )}
          {detail.avaliacao && (
            <div className="px-6 py-3 border-b border-border bg-yellow-500/5">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} size={14} className={n <= detail.avaliacao! ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"} />
                ))}
                <span className="text-xs text-muted-foreground ml-2">Avaliação do solicitante</span>
              </div>
              {detail.avaliacaoNota && <p className="text-xs text-muted-foreground mt-1 italic">"{detail.avaliacaoNota}"</p>}
            </div>
          )}

          {/* Comments */}
          <div className="px-6 py-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-4 flex items-center gap-1.5">
              <MessageSquare size={13} /> Comentários ({detail.comentarios?.length || 0})
            </h3>
            <div className="space-y-3">
              {(detail.comentarios || []).map(c => (
                <div key={c.id} className={`flex gap-2.5 ${c.interno ? "opacity-70" : ""}`}>
                  <Avatar nome={c.user.nome} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-foreground">{c.user.nome}</span>
                      {c.interno && (
                        <span className="text-[10px] text-orange-400 bg-orange-400/10 px-1.5 rounded">interno</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{relTime(c.criadoEm)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap">{c.texto}</p>
                  </div>
                </div>
              ))}
              {(!detail.comentarios || detail.comentarios.length === 0) && (
                <p className="text-xs text-muted-foreground italic">Nenhum comentário ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Comment input */}
        {detail.status !== "fechado" && (
          <div className="border-t border-border p-4 flex-shrink-0">
            {isMaster && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2 cursor-pointer select-none w-fit">
                <input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} className="rounded" />
                Comentário interno (não visível ao solicitante)
              </label>
            )}
            <div className="flex gap-2">
              <textarea
                rows={2}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/60 resize-none"
                placeholder="Escreva um comentário..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendComment(); }}
              />
              <button
                onClick={sendComment}
                disabled={!comment.trim() || sending}
                className="px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bulk Action Bar ────────────────────────────────────────────────────────────
function BulkActionBar({ ids, users, onDone, onCancel }: {
  ids: string[]; users: Usuario[];
  onDone: () => void; onCancel: () => void;
}) {
  const [status, setStatus] = useState("");
  const [atendente, setAtendente] = useState("");
  const [saving, setSaving] = useState(false);

  async function apply() {
    if (!status && !atendente) return;
    setSaving(true);
    try {
      if (status)    await api.patch("/chamados/bulk/status",   { ids, status });
      if (atendente) await api.patch("/chamados/bulk/atribuir", { ids, atendenteId: atendente || null });
      onDone();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-card border border-primary/30 rounded-2xl shadow-2xl shadow-primary/10">
      <span className="text-sm font-medium text-primary">{ids.length} selecionados</span>
      <div className="w-px h-5 bg-border" />
      <select value={status} onChange={e => setStatus(e.target.value)}
        className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none">
        <option value="">Alterar status...</option>
        {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <select value={atendente} onChange={e => setAtendente(e.target.value)}
        className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none">
        <option value="">Atribuir para...</option>
        <option value="__none__">Remover atribuição</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
      <button onClick={apply} disabled={saving || (!status && !atendente)}
        className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors">
        {saving ? <Loader2 size={13} className="animate-spin" /> : "Aplicar"}
      </button>
      <button onClick={onCancel} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ChamadosPage() {
  const { user } = useAuthStore();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Chamado | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPrio, setFilterPrio] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkUsers, setBulkUsers] = useState<Usuario[]>([]);

  function toggleBulk(id: string) {
    setBulkIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterPrio) params.set("prioridade", filterPrio);
      if (filterCat) params.set("categoria", filterCat);
      if (search) params.set("q", search);
      const [cRes, sRes] = await Promise.all([
        api.get(`/chamados?${params}`),
        api.get("/chamados/stats"),
      ]);
      setChamados(Array.isArray(cRes.data) ? cRes.data : []);
      setStats(sRes.data);
    } catch {
      setChamados([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPrio, filterCat, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user?.isMaster) api.get("/users").then(r => setBulkUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [user?.isMaster]);

  const byCols = STATUS_COLS.map(col => ({
    ...col,
    items: chamados.filter(c => c.status === col.key),
  }));

  const topbarActions = (
    <>
      <button
        onClick={load}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
      >
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        Atualizar
      </button>
      <button
        onClick={() => setShowNew(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
      >
        <Plus size={13} /> Novo Chamado
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <Topbar>{topbarActions}</Topbar>

      {/* Stats */}
      {stats && (
        <div className="px-6 py-3 border-b border-border flex-shrink-0">
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard label="Total"        value={stats.total} />
            <StatCard label="Abertos"      value={stats.aberto}          color="text-slate-400" />
            <StatCard label="Em Atend."    value={stats.em_atendimento}  color="text-blue-400" />
            <StatCard label="Aguardando"   value={stats.aguardando}      color="text-yellow-400" />
            <StatCard label="Resolvidos"   value={stats.resolvido}       color="text-emerald-400" />
            <StatCard label="Fechados"     value={stats.fechado}         color="text-violet-400" />
            <StatCard label="SLA Violado"  value={stats.slaViolados}     color={stats.slaViolados > 0 ? "text-red-400" : undefined} />
            <StatCard label="SLA em Risco" value={stats.slaEmRisco}      color={stats.slaEmRisco > 0 ? "text-yellow-400" : undefined} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-3 border-b border-border flex-shrink-0 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/60"
            placeholder="Pesquisar chamados..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select
          className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none"
          value={filterPrio}
          onChange={e => setFilterPrio(e.target.value)}
        >
          <option value="">Todas as prioridades</option>
          {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_MAP[p].label}</option>)}
        </select>
        <select
          className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterStatus || filterPrio || filterCat || search) && (
          <button
            onClick={() => { setFilterStatus(""); setFilterPrio(""); setFilterCat(""); setSearch(""); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-2"
          >
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {loading && chamados.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max">
            {byCols.map(col => (
              <div key={col.key} className={`w-72 flex-shrink-0 flex flex-col rounded-xl border ${col.border} ${col.bg} overflow-hidden`}>
                <div className="px-3 py-2.5 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-xs font-semibold text-foreground">{col.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-background/50 rounded px-1.5 py-0.5">
                    {col.items.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {col.items.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground/50 py-8">Nenhum chamado</p>
                  )}
                  {col.items.map(c => (
                    <ChamadoCard key={c.id} chamado={c} onClick={() => setSelected(c)}
                      selected={bulkIds.has(c.id)}
                      onSelect={user?.isMaster ? e => { e.stopPropagation(); toggleBulk(c.id); } : undefined} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {bulkIds.size > 0 && (
        <BulkActionBar
          ids={[...bulkIds]}
          users={bulkUsers}
          onDone={() => { setBulkIds(new Set()); load(); }}
          onCancel={() => setBulkIds(new Set())}
        />
      )}

      {/* Modals / Drawers */}
      {showNew && <NovoChamadoModal onClose={() => setShowNew(false)} onCreated={load} />}
      {selected && user && (
        <ChamadoDrawer
          chamado={selected}
          isMaster={!!user.isMaster}
          userId={user.id}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
