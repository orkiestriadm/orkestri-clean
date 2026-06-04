"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Plus, Search, X, Send, Tag, Building2, Star, Loader2, RefreshCw,
  MessageSquare, ExternalLink, BookOpen, Hand, Inbox, User as UserIcon,
  Globe2, History, AlertCircle, CheckCircle2, Download, Clock,
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
  fila?: number; meus?: number;
};
type AuditoriaEntry = {
  id: string; acao: string; de?: string | null; para?: string | null;
  metadata?: any; criadoEm: string;
  user: { id: string; nome: string; avatar?: string } | null;
};
type Scope = "fila" | "meus" | "todos";
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

// ── Age Badge ─────────────────────────────────────────────────────────────────
function AgeBadge({ atualizadoEm, status }: { atualizadoEm: string; status: string }) {
  if (["resolvido","fechado","cancelado"].includes(status)) return null;
  const h = (Date.now() - new Date(atualizadoEm).getTime()) / 3600000;
  if (h < 24) return null;
  const d = Math.floor(h / 24);
  const cls = d >= 3
    ? "text-red-400 bg-red-500/10 border-red-500/20"
    : "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      <Clock size={8} /> {d}d sem resposta
    </span>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(chamados: Chamado[]) {
  const headers = ["#","Título","Status","Prioridade","Categoria","Solicitante","Atendente","Cliente","SLA","Criado em","Atualizado em"];
  const rows = chamados.map(c => [
    c.numero,
    `"${c.titulo.replace(/"/g,'""')}"`,
    c.status,
    c.prioridade,
    c.categoria || "",
    `"${c.solicitante.nome}"`,
    c.atendente ? `"${c.atendente.nome}"` : "",
    c.cliente ? `"${c.cliente.empresa || c.cliente.nome}"` : "",
    c.slaStatus || "ok",
    new Date(c.criadoEm).toLocaleString("pt-BR"),
    new Date(c.atualizadoEm).toLocaleString("pt-BR"),
  ].join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `chamados-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card-premium rounded-xl p-4 flex flex-col gap-1.5 shadow-premium-sm transition-all hover:-translate-y-0.5 hover:shadow-premium-md">
      <span className="text-xs text-[var(--text-muted)] font-medium tracking-wide uppercase">{label}</span>
      <span className={`text-2xl font-bold font-display ${color || "text-[var(--text-primary)]"}`}>{value}</span>
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
function ChamadoCard({ chamado, onClick, selected, onSelect, onAssumir, canAssumir }: {
  chamado: Chamado; onClick: () => void;
  selected?: boolean; onSelect?: (e: React.MouseEvent) => void;
  onAssumir?: (id: string) => void; canAssumir?: boolean;
}) {
  // Chamado é "fila pública" quando status=aberto e ninguém o assumiu ainda.
  const isPublicQueue = chamado.status === "aberto" && !chamado.atendenteId;
  const showAssumir = canAssumir && isPublicQueue;
  const [assumindo, setAssumindo] = useState(false);

  async function handleAssumir(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onAssumir || assumindo) return;
    setAssumindo(true);
    try { await onAssumir(chamado.id); }
    finally { setAssumindo(false); }
  }

  return (
    <div className={`relative w-full text-left card-premium p-3.5 transition-all hover:shadow-premium-md ${selected ? "ring-2 ring-[var(--accent-violet)] bg-[var(--accent-violet-dim)]" : "hover:border-[var(--border-medium)]"} ${isPublicQueue ? "border-l-2 border-l-[var(--accent-violet)]" : ""}`}>
      {onSelect && (
        <div className="absolute top-2 right-2 z-10" onClick={onSelect}>
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${selected ? "bg-[var(--accent-violet)] border-[var(--accent-violet)]" : "border-[var(--border-strong)] bg-[var(--bg-primary)] hover:border-[var(--accent-violet)]"}`}>
            {selected && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>}
          </div>
        </div>
      )}
      <button onClick={onClick} className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-violet)] rounded">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] text-[var(--text-muted)] font-mono">#{chamado.numero}</span>
        <PrioridadeBadge prioridade={chamado.prioridade} />
      </div>
      <p className="text-[13px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2 mb-2.5 hover:text-[var(--accent-violet)] transition-colors">{chamado.titulo}</p>
      {chamado.categoria && (
        <span className="inline-block text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 mb-2.5">
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
          {isPublicQueue && (
            <span className="ml-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-violet)] bg-[var(--accent-violet)]/10 border border-[var(--accent-violet)]/20 px-1.5 py-0.5 rounded">
              <Globe2 size={9} /> Fila
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AgeBadge atualizadoEm={chamado.atualizadoEm} status={chamado.status} />
          <SlaBadge slaStatus={chamado.slaStatus} />
          <span className="text-[10px] text-muted-foreground">{relTime(chamado.criadoEm)}</span>
        </div>
      </div>
      </button>
      {showAssumir && (
        <button
          onClick={handleAssumir}
          disabled={assumindo}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 px-2 rounded-md border border-[var(--accent-violet)]/40 text-[var(--accent-violet)] bg-[var(--accent-violet)]/10 hover:bg-[var(--accent-violet)]/20 transition-colors disabled:opacity-50"
          title="Assumir este chamado da fila pública"
        >
          {assumindo ? <Loader2 size={12} className="animate-spin" /> : <Hand size={12} />}
          Assumir Chamado
        </button>
      )}
    </div>
  );
}

// ── New Chamado Modal ──────────────────────────────────────────────────────────
type Template = { id: string; nome: string; titulo: string; descricao?: string; prioridade: string; categoria?: string };

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
    api.get("/chamado-templates").then(r => setTemplates(Array.isArray(r.data) ? r.data : [])).catch(() => {});
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
    setForm(f => ({ ...f, titulo: t.titulo, descricao: t.descricao || f.descricao, prioridade: t.prioridade, categoria: t.categoria || f.categoria }));
  }
  async function saveAsTemplate() {
    if (!templateNome.trim() || !form.titulo) return;
    try {
      const { data } = await api.post("/chamado-templates", {
        nome: templateNome.trim(),
        titulo: form.titulo,
        descricao: form.descricao,
        prioridade: form.prioridade,
        categoria: form.categoria || undefined,
      });
      setTemplates(prev => [...prev.filter(t => t.nome !== templateNome.trim()), data]);
    } catch {}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="card-premium rounded-2xl w-full max-w-lg shadow-premium-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-semibold text-[var(--text-primary)] font-display text-lg">Novo Chamado</h2>
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <select onChange={e => { if (e.target.value) applyTemplate(templates.find(t => t.id === e.target.value)!); e.target.value = ""; }}
                className="input-o text-xs py-1.5 w-auto">
                <option value="">Usar template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            )}
            <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={18} /></button>
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
            <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Título *</label>
            <input
              className="input-o"
              placeholder="Descreva brevemente o problema..."
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            />
            {kbSugestoes.length > 0 && !kbArtigo && (
              <div className="mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-premium-sm overflow-hidden">
                <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] flex items-center gap-1.5 bg-[var(--bg-hover)]">
                  <BookOpen size={11} className="text-[var(--text-muted)]" />
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">Artigos relacionados na base de conhecimento</span>
                </div>
                {kbSugestoes.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setKbArtigo(a)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {a.categoria && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: a.categoria.cor + "20", color: a.categoria.cor }}>
                          {a.categoria.nome}
                        </span>
                      )}
                      <span className="text-[12px] text-[var(--text-primary)] font-medium truncate">{a.titulo}</span>
                    </div>
                    {a.resumo && <div className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{a.resumo}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Descrição *</label>
            <textarea
              rows={4}
              className="input-o resize-y min-h-[80px]"
              placeholder="Detalhe o problema ou solicitação..."
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Prioridade</label>
              <select
                className="input-o"
                value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
              >
                {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_MAP[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Categoria</label>
              <select
                className="input-o"
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              >
                <option value="">Selecionar...</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Cliente (opcional)</label>
            <select
              className="input-o"
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
            <div className="flex gap-2 pt-1 items-center">
              <input value={templateNome} onChange={e => setTemplateNome(e.target.value)}
                placeholder="Nome do template..." autoFocus
                className="input-o flex-1" />
              <button type="button" onClick={saveAsTemplate}
                className="btn btn-ghost text-xs py-2 px-3 text-[var(--accent-violet)]">Salvar</button>
              <button type="button" onClick={() => setShowSaveTemplate(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={14} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSaveTemplate(true)}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-violet)] transition-colors self-start block">
              + Salvar como template
            </button>
          )}
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn btn-violet flex-1 flex items-center justify-center gap-2">
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
function ChamadoDrawer({ chamado, isMaster, userId, canEditar, onClose, onUpdated }: {
  chamado: Chamado; isMaster: boolean; userId: string; canEditar: boolean;
  onClose: () => void; onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<Chamado>(chamado);
  const [comment, setComment] = useState("");
  const [interno, setInterno] = useState(false);
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [assumirErro, setAssumirErro] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingNota, setRatingNota] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaEntry[]>([]);
  const [showAuditoria, setShowAuditoria] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/chamados/${chamado.id}`);
      setDetail(data);
    } catch {}
  }, [chamado.id]);

  const loadAuditoria = useCallback(async () => {
    try {
      const { data } = await api.get(`/chamados/${chamado.id}/auditoria`);
      setAuditoria(Array.isArray(data) ? data : []);
    } catch { setAuditoria([]); }
  }, [chamado.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (showAuditoria) loadAuditoria(); }, [showAuditoria, loadAuditoria]);

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

  async function assumir() {
    setAssumindo(true); setAssumirErro("");
    try {
      await api.patch(`/chamados/${chamado.id}/assumir`);
      await load();
      onUpdated();
    } catch (err: any) {
      // 409 = outro usuário assumiu primeiro. Recarrega pra UI mostrar o atendente atual.
      setAssumirErro(err?.response?.data?.message || "Nao foi possivel assumir o chamado");
      await load();
      onUpdated();
    } finally {
      setAssumindo(false);
    }
  }

  async function loadSuggestions() {
    setShowSuggest(true);
    setLoadingSuggest(true);
    try {
      const params: any = { limit: 5 };
      if ((detail as any)?.skillRequeridaId) params.skillId = (detail as any).skillRequeridaId;
      if ((detail as any)?.nivelMinimo)      params.nivelMinimo = (detail as any).nivelMinimo;
      const r = await api.get("/skills/suggest", { params });
      setSuggestions(r.data);
    } catch { setSuggestions([]); }
    finally { setLoadingSuggest(false); }
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
  // Pode assumir: status=aberto, sem atendente, usuário tem permissão de editar,
  // e não é o solicitante (evita auto-atribuição passiva — mas mantemos como
  // possibilidade já que a regra de negócio permite). Para Jira-likeness: o
  // solicitante também pode assumir o próprio (útil em times pequenos).
  const inPublicQueue = detail.status === "aberto" && !detail.atendenteId;
  const showAssumirBtn = inPublicQueue && canEditar;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="w-full max-w-2xl bg-[var(--bg-glass)] backdrop-blur-3xl border-l border-[var(--border-subtle)] flex flex-col overflow-hidden shadow-premium-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/50 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[var(--text-muted)] font-mono">#{detail.numero}</span>
              <span
                className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: col.color + "20", color: col.color, border: `1px solid ${col.color}40` }}
              >
                {col.label}
              </span>
              <PrioridadeBadge prioridade={detail.prioridade} />
              <SlaBadge slaStatus={detail.slaStatus} />
            </div>
            <h2 className="font-display font-bold text-[var(--text-primary)] text-xl leading-snug">{detail.titulo}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              onClick={() => setShowAuditoria(s => !s)}
              title="Histórico do chamado"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showAuditoria ? "bg-[var(--accent-violet)]/15 text-[var(--accent-violet)]" : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              <History size={16} />
            </button>
            <a href={`/dashboard/chamados/${detail.id}`} title="Abrir página completa"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Banner "Assumir chamado" — só na fila pública */}
        {showAssumirBtn && (
          <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--accent-violet)]/8 flex items-center gap-3 flex-shrink-0">
            <Globe2 size={16} className="text-[var(--accent-violet)] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">Este chamado está na fila pública</div>
              <div className="text-[11px] text-[var(--text-muted)]">Assuma para que ele apareça apenas no seu painel.</div>
              {assumirErro && (
                <div className="mt-1 text-[11px] text-[var(--accent-red)] flex items-center gap-1">
                  <AlertCircle size={11} /> {assumirErro}
                </div>
              )}
            </div>
            <button
              onClick={assumir}
              disabled={assumindo}
              className="btn btn-violet text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            >
              {assumindo ? <Loader2 size={13} className="animate-spin" /> : <Hand size={13} />}
              Assumir Chamado
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Meta info */}
          <div className="px-6 py-5 space-y-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/40">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-1.5 block">Solicitante</span>
                <div className="flex items-center gap-2">
                  <Avatar nome={detail.solicitante.nome} size={6} />
                  <span className="text-[var(--text-primary)] font-medium">{detail.solicitante.nome}</span>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-1.5 block">Atendente</span>
                {isMaster ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="input-o text-xs py-1.5 flex-1"
                      value={detail.atendenteId || ""}
                      onChange={e => atribuir(e.target.value)}
                      disabled={atribuindo}
                    >
                      <option value="">Não atribuído</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                    <button
                      onClick={loadSuggestions}
                      className="btn btn-ghost text-xs py-1.5 px-3"
                      title="Sugerir atendente com base em skill + carga + senioridade"
                      style={{ whiteSpace:"nowrap" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display:"inline-block", verticalAlign:"middle", marginRight:4 }}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      Sugerir
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {detail.atendente
                      ? <><Avatar nome={detail.atendente.nome} size={6} /><span className="text-[var(--text-primary)] font-medium">{detail.atendente.nome}</span></>
                      : <span className="text-[var(--text-muted)] italic">Não atribuído</span>}
                  </div>
                )}
              </div>
              {detail.cliente && (
                <div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-1.5 block">Cliente</span>
                  <div className="flex items-center gap-1.5">
                    <Building2 size={14} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-primary)] font-medium">{detail.cliente.nome}</span>
                  </div>
                </div>
              )}
              {detail.categoria && (
                <div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-1.5 block">Categoria</span>
                  <div className="flex items-center gap-1.5">
                    <Tag size={14} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-primary)] font-medium">{detail.categoria}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Status actions */}
            {nextStatuses.length > 0 && (isMaster || detail.atendenteId === userId || isSolicitante) && (
              <div className="flex items-center gap-2 flex-wrap pt-2 mt-2 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)] font-medium">Mover para:</span>
                {nextStatuses.map(s => {
                  const c = STATUS_COLS.find(x => x.key === s)!;
                  return (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      disabled={changingStatus}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all hover:opacity-90 disabled:opacity-50 uppercase tracking-wider"
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
          <div className="px-6 py-6 border-b border-[var(--border-subtle)]">
            <h3 className="text-[11px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase mb-3">Descrição</h3>
            <p className="text-[14px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{detail.descricao}</p>
          </div>

          {/* Auditoria / Histórico */}
          {showAuditoria && (
            <div className="px-6 py-6 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/30">
              <h3 className="text-[11px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <History size={13} /> Histórico ({auditoria.length})
              </h3>
              {auditoria.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] italic text-center py-3 bg-[var(--bg-hover)] rounded-lg border border-dashed border-[var(--border-subtle)]">Nenhuma ação registrada ainda.</p>
              ) : (
                <ol className="space-y-3">
                  {auditoria.map(e => {
                    const labelMap: Record<string, { txt: string; icon: any; color: string }> = {
                      criado:               { txt: "Chamado criado",                icon: Plus,        color: "var(--text-secondary)" },
                      assumido:             { txt: "Assumiu o chamado",             icon: Hand,        color: "var(--accent-violet)" },
                      atribuicao:           { txt: "Atribuído",                     icon: UserIcon,    color: "#60a5fa" },
                      atribuicao_removida:  { txt: "Atribuição removida",           icon: X,           color: "#94a3b8" },
                      transferencia:        { txt: "Transferido",                   icon: UserIcon,    color: "#fbbf24" },
                      status:               { txt: "Status alterado",               icon: CheckCircle2,color: "#34d399" },
                      prioridade:           { txt: "Prioridade alterada",           icon: AlertCircle, color: "#fbbf24" },
                    };
                    const meta = labelMap[e.acao] || { txt: e.acao, icon: History, color: "var(--text-muted)" };
                    const Icon = meta.icon;
                    return (
                      <li key={e.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: meta.color + "20", color: meta.color, border: `1px solid ${meta.color}40` }}>
                          <Icon size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold text-[var(--text-primary)]">{meta.txt}</span>
                            {(e.de || e.para) && (e.acao === "status" || e.acao === "prioridade") && (
                              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                                {e.de || "—"} <span className="opacity-50">→</span> {e.para || "—"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {e.user?.nome || "Sistema"} • {formatDate(e.criadoEm)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="px-6 py-6 bg-[var(--bg-primary)]/20">
            <h3 className="text-[11px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4 flex items-center gap-2">
              <MessageSquare size={13} /> Comentários ({detail.comentarios?.length || 0})
            </h3>
            <div className="space-y-4">
              {(detail.comentarios || []).map(c => (
                <div key={c.id} className={`flex gap-3 ${c.interno ? "opacity-80" : ""}`}>
                  <Avatar nome={c.user.nome} size={8} />
                  <div className="flex-1 min-w-0 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-xl shadow-premium-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-bold text-[var(--text-primary)]">{c.user.nome}</span>
                      {c.interno && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 px-1.5 py-0.5 rounded">interno</span>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] ml-auto font-mono">{relTime(c.criadoEm)}</span>
                    </div>
                    <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{c.texto}</p>
                  </div>
                </div>
              ))}
              {(!detail.comentarios || detail.comentarios.length === 0) && (
                <p className="text-[13px] text-[var(--text-muted)] italic text-center py-4 bg-[var(--bg-hover)] rounded-xl border border-dashed border-[var(--border-subtle)]">Nenhum comentário ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Comment input */}
        {detail.status !== "fechado" && (
          <div className="border-t border-[var(--border-subtle)] p-4 flex-shrink-0 bg-[var(--bg-card)]">
            {isMaster && (
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] mb-3 cursor-pointer select-none w-fit hover:text-[var(--text-primary)] transition-colors">
                <input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} className="rounded border-[var(--border-strong)] bg-transparent w-4 h-4 text-[var(--accent-violet)] focus:ring-[var(--accent-violet)]" />
                Comentário interno (não visível ao solicitante)
              </label>
            )}
            <div className="flex gap-2">
              <textarea
                rows={2}
                className="input-o flex-1 min-h-[50px] resize-none"
                placeholder="Escreva um comentário..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendComment(); }}
              />
              <button
                onClick={sendComment}
                disabled={!comment.trim() || sending}
                className="btn btn-violet px-4 flex items-center justify-center disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Smart Suggest Drawer */}
      {showSuggest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={()=>setShowSuggest(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-2xl w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-display">Sugestão de atendente</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Top 5 colaboradores ordenados por: skill + carga + senioridade</p>
              </div>
              <button onClick={()=>setShowSuggest(false)} className="btn-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              {loadingSuggest ? (
                <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /></div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-12 text-sm text-[var(--text-muted)]">
                  Nenhum colaborador qualificado encontrado.<br/>
                  <span className="text-xs">Verifique se há colaboradores ativos cadastrados{(detail as any)?.skillRequeridaId ? " com a skill requerida" : ""}.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {suggestions.map((s,i)=>{
                    const utilColor = s.carga.utilizacao > 90 ? "var(--accent-red)" : s.carga.utilizacao > 70 ? "#fbbf24" : "var(--accent-green)";
                    return (
                      <div key={s.collaborator.id} className="card-premium p-4" style={{ borderLeft: i===0 ? "3px solid var(--accent-violet)" : "3px solid var(--border-subtle)" }}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <Avatar nome={s.collaborator.nome} size={10} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{s.collaborator.nome}</div>
                                <div className="text-[11px] text-[var(--text-muted)]">{s.collaborator.cargo || "—"} {s.collaborator.setor?.nome ? `• ${s.collaborator.setor.nome}` : ""}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">SCORE</div>
                                <div className="text-base font-bold" style={{ color: i===0 ? "var(--accent-violet)" : "var(--text-secondary)" }}>{s.score}</div>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 items-center text-[10px]">
                              {s.skillMatch && (
                                <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.12)", color: "var(--accent-violet)", border: "1px solid rgba(124,58,237,0.2)" }}>
                                  Skill {s.skillMatch.nivel}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full font-mono" style={{ background: utilColor + "20", color: utilColor, border: `1px solid ${utilColor}40` }}>
                                {s.carga.utilizacao}% util
                              </span>
                              <span className="text-[var(--text-muted)] font-mono">
                                {s.carga.ticketsAbertos} chamados • {s.carga.horasAlocadas}h / {s.carga.jornadaMes}h
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--text-secondary)] italic">{s.motivo}</div>
                          </div>
                        </div>
                        <button
                          className="btn btn-violet w-full mt-3 text-xs"
                          onClick={()=>{ atribuir(s.collaborator.userId); setShowSuggest(false); }}
                        >
                          Atribuir a {s.collaborator.nome.split(" ")[0]}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 card-premium rounded-2xl sm:rounded-full shadow-premium-xl border-[var(--accent-violet)]/30 backdrop-blur-xl animate-in slide-in-from-bottom-8 max-w-[calc(100vw-32px)]">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent-violet)]/20 text-[var(--accent-violet)] font-bold text-xs">
        {ids.length}
      </div>
      <span className="text-sm font-semibold text-[var(--text-primary)]">selecionados</span>
      <div className="w-px h-5 bg-[var(--border-medium)] mx-1" />
      <select value={status} onChange={e => setStatus(e.target.value)}
        className="input-o text-xs py-1.5 w-full sm:min-w-[120px] sm:w-auto rounded-full px-4 border-transparent bg-[var(--bg-hover)]">
        <option value="">Alterar status...</option>
        {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <select value={atendente} onChange={e => setAtendente(e.target.value)}
        className="input-o text-xs py-1.5 w-full sm:min-w-[120px] sm:w-auto rounded-full px-4 border-transparent bg-[var(--bg-hover)]">
        <option value="">Atribuir para...</option>
        <option value="__none__">Remover atribuição</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
      <button onClick={apply} disabled={saving || (!status && !atendente)}
        className="btn btn-violet text-xs py-1.5 px-5 rounded-full disabled:opacity-50 font-bold ml-2">
        {saving ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
      </button>
      <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-1">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ChamadosPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Chamado | null>(null);
  const [showNew, setShowNew] = useState(false);
  // Filtros inicializados da URL
  const [search, setSearch] = useState(() => searchParams?.get("q") || "");
  const [filterStatus, setFilterStatus] = useState(() => searchParams?.get("status") || "");
  const [filterPrio, setFilterPrio] = useState(() => searchParams?.get("prioridade") || "");
  const [filterCat, setFilterCat] = useState(() => searchParams?.get("categoria") || "");
  const [scope, setScope] = useState<Scope>(() => (searchParams?.get("scope") as Scope) || "meus");
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkUsers, setBulkUsers] = useState<Usuario[]>([]);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  // Drag-and-drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Quem pode editar/assumir chamado: master OU permissão chamados:editar/*
  const canEditar = !!(user?.isMaster
    || user?.permissions?.includes("*")
    || user?.permissions?.includes("chamados:editar"));

  // Master pode ver "Todos" (sem filtro de propriedade). Demais: fila ∪ meus.
  useEffect(() => {
    if (!user?.isMaster && scope === "todos") setScope("meus");
  }, [user?.isMaster, scope]);

  // Sync filtros → URL (preserva compartilhamento e refresh)
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (filterStatus) p.set("status", filterStatus);
    if (filterPrio) p.set("prioridade", filterPrio);
    if (filterCat) p.set("categoria", filterCat);
    if (scope !== "meus") p.set("scope", scope);
    const q = p.toString();
    router.replace(`/dashboard/chamados${q ? "?" + q : ""}`, { scroll: false });
  }, [search, filterStatus, filterPrio, filterCat, scope]);

  // Drag-and-drop: muda status ao soltar em outra coluna
  const handleDrop = useCallback(async (newStatus: string) => {
    if (!dragId || !newStatus) return;
    const chamado = chamados.find(c => c.id === dragId);
    if (!chamado || chamado.status === newStatus) { setDragId(null); setDragOver(null); return; }
    // Otimista: atualiza localmente primeiro
    setChamados(prev => prev.map(c => c.id === dragId ? { ...c, status: newStatus } : c));
    setDragId(null); setDragOver(null);
    try {
      await api.patch(`/chamados/${dragId}/status`, { status: newStatus });
      setToast({ type: "ok", msg: `#${chamado.numero} movido para ${newStatus.replace("_"," ")}` });
    } catch {
      // Reverte em caso de erro
      setChamados(prev => prev.map(c => c.id === dragId ? { ...c, status: chamado.status } : c));
      setToast({ type: "err", msg: "Não foi possível mover o chamado." });
    }
  }, [dragId, chamados]);

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
      if (scope) params.set("scope", scope);
      const sParams = new URLSearchParams();
      sParams.set("scope", scope);
      const [cRes, sRes] = await Promise.all([
        api.get(`/chamados?${params}`),
        api.get(`/chamados/stats?${sParams}`),
      ]);
      setChamados(Array.isArray(cRes.data) ? cRes.data : []);
      setStats(sRes.data);
    } catch {
      setChamados([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPrio, filterCat, search, scope]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Handler: assumir chamado da fila pública (atômico no backend; trata 409).
  const handleAssumir = useCallback(async (id: string) => {
    try {
      await api.patch(`/chamados/${id}/assumir`);
      setToast({ type: "ok", msg: "Chamado assumido com sucesso." });
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Nao foi possivel assumir o chamado.";
      setToast({ type: "err", msg });
      load(); // revalida pra remover da fila se outra pessoa pegou
    }
  }, [load]);

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
      <button onClick={load}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors">
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
      </button>
      {chamados.length > 0 && (
        <button onClick={() => exportCSV(chamados)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
          title="Exportar chamados em CSV">
          <Download size={13} /> CSV
        </button>
      )}
      <button onClick={() => setShowNew(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
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

      {/* Scope tabs: Fila Pública / Meus Chamados / Todos (master) */}
      <div className="px-6 pt-3 pb-0 border-b border-[var(--border-subtle)] flex-shrink-0 bg-[var(--bg-primary)]">
        <div className="flex items-center gap-1">
          {([
            { k: "meus",  label: "Meus Chamados", icon: UserIcon, count: stats?.meus },
            { k: "fila",  label: "Fila Pública",  icon: Globe2,   count: stats?.fila },
            ...(user?.isMaster ? [{ k: "todos" as const, label: "Todos", icon: Inbox, count: stats?.total }] : []),
          ] as Array<{ k: Scope; label: string; icon: any; count?: number }>).map(tab => {
            const active = scope === tab.k;
            const Icon = tab.icon;
            return (
              <button
                key={tab.k}
                onClick={() => setScope(tab.k)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px
                  ${active
                    ? "text-[var(--accent-violet)] border-[var(--accent-violet)]"
                    : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"}`}
              >
                <Icon size={14} />
                {tab.label}
                {typeof tab.count === "number" && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full
                    ${active
                      ? "bg-[var(--accent-violet)]/15 text-[var(--accent-violet)] border border-[var(--accent-violet)]/30"
                      : "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border-subtle)] flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 bg-[var(--bg-primary)]">
        <div className="relative w-full sm:flex-1 sm:min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input-o pl-9 py-2"
            placeholder="Pesquisar chamados..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-o py-2 flex-1 min-w-[120px]"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Status</option>
          {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select
          className="input-o py-2 flex-1 min-w-[120px]"
          value={filterPrio}
          onChange={e => setFilterPrio(e.target.value)}
        >
          <option value="">Prioridade</option>
          {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_MAP[p].label}</option>)}
        </select>
        <select
          className="input-o py-2 flex-1 min-w-[120px]"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">Categoria</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterStatus || filterPrio || filterCat || search) && (
          <button
            onClick={() => { setFilterStatus(""); setFilterPrio(""); setFilterCat(""); setSearch(""); }}
            className="btn btn-ghost flex items-center gap-1 py-2 px-3 text-[var(--accent-red)] hover:text-[var(--accent-red)] hover:bg-red-500/10"
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
          <div className="flex gap-5 h-full min-w-max pb-4">
            {byCols.map(col => (
              <div key={col.key} className="w-[260px] sm:w-[300px] lg:w-[320px] flex-shrink-0 flex flex-col"
                onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="px-1 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color, boxShadow: `0 0 10px ${col.color}80` }} />
                    <span className="text-[13px] font-bold text-[var(--text-secondary)] font-display tracking-wide uppercase">{col.label}</span>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-full px-2 py-0.5">
                    {col.items.length}
                  </span>
                </div>
                <div className={`flex-1 overflow-y-auto space-y-3 px-1 pb-4 rounded-xl transition-all ${dragOver === col.key && dragId ? "bg-[var(--bg-hover)] ring-2 ring-inset ring-[var(--border-medium)]" : ""}`}>
                  {col.items.length === 0 && dragOver !== col.key && (
                    <div className="border border-dashed border-[var(--border-subtle)] rounded-xl p-5 text-center bg-[var(--bg-card)]/50 mt-1">
                      <p className="text-xs text-[var(--text-muted)]">Nenhum chamado</p>
                    </div>
                  )}
                  {col.items.map(c => (
                    <div key={c.id}
                      draggable={canEditar}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      style={{ opacity: dragId === c.id ? 0.4 : 1, cursor: canEditar ? "grab" : "default" }}
                    >
                      <ChamadoCard chamado={c} onClick={() => setSelected(c)}
                        selected={bulkIds.has(c.id)}
                        onSelect={user?.isMaster ? e => { e.stopPropagation(); toggleBulk(c.id); } : undefined}
                        onAssumir={handleAssumir}
                        canAssumir={canEditar}
                      />
                    </div>
                  ))}
                  {dragOver === col.key && dragId && (
                    <div className="border-2 border-dashed rounded-xl p-4 text-center text-xs text-[var(--text-muted)]" style={{ borderColor: col.color }}>
                      Soltar aqui → {col.label}
                    </div>
                  )}
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
          canEditar={canEditar}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}

      {/* Toast (assumir chamado / conflitos) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[80] flex items-center gap-2 px-4 py-3 rounded-xl shadow-premium-lg border backdrop-blur-xl animate-in slide-in-from-bottom-4
          ${toast.type === "ok"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/15 border-red-500/30 text-red-300"}`}>
          {toast.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
