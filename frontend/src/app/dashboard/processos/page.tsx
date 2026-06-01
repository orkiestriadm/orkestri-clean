"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Play, CheckSquare, Shield, Bell, GitBranch, Flag, Plus, Trash2, Save, ChevronDown, X, Loader2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type StepTipo = "inicio" | "tarefa" | "aprovacao" | "notificacao" | "condicao" | "fim";
type WfStep = {
  id: string; nome: string; tipo: StepTipo;
  responsavel?: string; descricao?: string; prazo?: number;
  obrigatorio?: boolean; proximaEtapaId?: string; etapaAlternativaId?: string;
};
type Template = {
  id: string; nome: string; descricao?: string; tipo: string;
  icone?: string; cor: string; ativo: boolean; etapas: WfStep[];
  criadoPor: { id: string; nome: string }; criadoEm: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const TIPO_CORES: Record<string, string> = {
  ti:"#60a5fa", rh:"#34d399", financeiro:"#fbbf24",
  juridico:"#a78bfa", compras:"#f472b6", facilities:"#fb923c", outro:"#94a3b8",
};
const TIPO_LABELS: Record<string, string> = {
  ti:"TI", rh:"RH", financeiro:"Financeiro", juridico:"Jurídico",
  compras:"Compras", facilities:"Facilities", outro:"Outro",
};
const STEP_BORDER: Record<StepTipo, string> = {
  inicio:"#94a3b8", tarefa:"#60a5fa", aprovacao:"#a78bfa",
  notificacao:"#22d3ee", condicao:"#fbbf24", fim:"#94a3b8",
};
const STEP_TYPES: { tipo: StepTipo; label: string }[] = [
  { tipo:"inicio", label:"Início" }, { tipo:"tarefa", label:"Tarefa" },
  { tipo:"aprovacao", label:"Aprovação" }, { tipo:"notificacao", label:"Notificação" },
  { tipo:"condicao", label:"Condição" }, { tipo:"fim", label:"Fim" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

function StepIcon({ tipo, size = 14 }: { tipo: StepTipo; size?: number }) {
  const p = { size, className: "shrink-0" };
  if (tipo === "inicio")      return <Play {...p} style={{ color:"#34d399" }} />;
  if (tipo === "tarefa")      return <CheckSquare {...p} style={{ color:"#60a5fa" }} />;
  if (tipo === "aprovacao")   return <Shield {...p} style={{ color:"#a78bfa" }} />;
  if (tipo === "notificacao") return <Bell {...p} style={{ color:"#22d3ee" }} />;
  if (tipo === "condicao")    return <GitBranch {...p} style={{ color:"#fbbf24" }} />;
  return <Flag {...p} style={{ color:"#94a3b8" }} />;
}

function groupByTipo(ts: Template[]) {
  return ts.reduce<Record<string, Template[]>>((acc, t) => {
    const k = t.tipo || "outro"; if (!acc[k]) acc[k] = []; acc[k].push(t); return acc;
  }, {});
}

// ── StepCard ───────────────────────────────────────────────────────────────────
function StepCard({ step, index, onDelete, onChangeName, onChangeField }: {
  step: WfStep; index: number;
  onDelete: () => void; onChangeName: (v: string) => void; onChangeField: (k: keyof WfStep, v: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const b = STEP_BORDER[step.tipo];
  const lbl = (t: string) => (
    <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1 uppercase tracking-wider">{t}</label>
  );
  return (
    <div className="card-premium animate-fade-in" style={{ borderLeft:`3px solid ${b}`, padding:"12px 14px" }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-[var(--text-muted)] w-4 shrink-0">{index + 1}</span>
        <StepIcon tipo={step.tipo} size={14} />
        <input className="input-o flex-1 text-[13px] py-1" value={step.nome}
          onChange={e => onChangeName(e.target.value)} placeholder="Nome da etapa" />
        <span className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
          style={{ background:`${b}18`, color:b, border:`1px solid ${b}30` }}>
          {STEP_TYPES.find(s => s.tipo === step.tipo)?.label}
        </span>
        <button className="btn-icon shrink-0" onClick={() => setExpanded(p => !p)} title="Detalhes">
          <ChevronDown size={13} style={{ transform: expanded ? "rotate(180deg)" : undefined, transition:"transform 0.15s" }} />
        </button>
        <button className="btn-icon shrink-0" onClick={onDelete} title="Remover">
          <X size={13} style={{ color:"var(--accent-red)" }} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-1.5 ml-6 flex-wrap">
        {step.responsavel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">👤 {step.responsavel}</span>}
        {step.prazo       && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">⏱ {step.prazo}d</span>}
        {step.obrigatorio && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">obrigatório</span>}
        {step.tipo === "condicao" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Sim / Não</span>}
      </div>

      {expanded && (
        <div className="mt-3 ml-6 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              {lbl("Responsável")}
              <input className="input-o text-[12px]" value={step.responsavel || ""}
                onChange={e => onChangeField("responsavel", e.target.value || undefined)} placeholder="Nome ou cargo" />
            </div>
            <div>
              {lbl("Prazo (dias)")}
              <input className="input-o text-[12px]" type="number" min={1} value={step.prazo ?? ""}
                onChange={e => onChangeField("prazo", e.target.value ? Number(e.target.value) : undefined)} placeholder="Ex: 3" />
            </div>
          </div>
          <div>
            {lbl("Descrição")}
            <input className="input-o text-[12px]" value={step.descricao || ""}
              onChange={e => onChangeField("descricao", e.target.value || undefined)} placeholder="Instruções..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!step.obrigatorio}
              onChange={e => onChangeField("obrigatorio", e.target.checked)} className="accent-violet-500" />
            <span className="text-[12px] text-[var(--text-secondary)]">Etapa obrigatória</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ── AddStepButton ──────────────────────────────────────────────────────────────
function AddStepButton({ onAdd }: { onAdd: (tipo: StepTipo) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative flex flex-col items-center" ref={ref}>
      <div className="w-px h-4 bg-[var(--border-subtle)]" />
      <button className="btn btn-ghost text-[11px] flex items-center gap-1 py-1.5 px-3" onClick={() => setOpen(p => !p)}>
        <Plus size={12} /> Adicionar etapa
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-10 rounded-lg border border-[var(--border-subtle)] shadow-xl overflow-hidden animate-fade-in"
          style={{ background:"var(--bg-card)", minWidth:160 }}>
          {STEP_TYPES.map(s => (
            <button key={s.tipo} onClick={() => { onAdd(s.tipo); setOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors">
              <StepIcon tipo={s.tipo} size={13} /><span>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FlowEditor ─────────────────────────────────────────────────────────────────
function FlowEditor({ template, onSave, onDelete, saving }: {
  template: Template; saving: boolean;
  onSave: (t: Template) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const [nome,   setNome]   = useState(template.nome);
  const [etapas, setEtapas] = useState<WfStep[]>(template.etapas || []);
  const [dirty,  setDirty]  = useState(false);
  const mark = useCallback(() => setDirty(true), []);

  useEffect(() => { setNome(template.nome); setEtapas(template.etapas || []); setDirty(false); }, [template.id]);

  const addStep = (tipo: StepTipo) => {
    setEtapas(p => [...p, { id: uid(), nome: STEP_TYPES.find(s => s.tipo === tipo)?.label ?? tipo, tipo }]);
    mark();
  };
  const delStep = (id: string) => { setEtapas(p => p.filter(s => s.id !== id)); mark(); };
  const setStepName = (id: string, v: string) => { setEtapas(p => p.map(s => s.id === id ? {...s, nome:v} : s)); mark(); };
  const setStepField = (id: string, k: keyof WfStep, v: any) => { setEtapas(p => p.map(s => s.id === id ? {...s,[k]:v} : s)); mark(); };

  const tipoCor = TIPO_CORES[template.tipo] || TIPO_CORES.outro;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border-subtle)] shrink-0" style={{ background:"var(--bg-card)" }}>
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background:tipoCor, boxShadow:`0 0 6px ${tipoCor}80` }} />
        <input className="input-o flex-1 font-semibold text-[15px]" value={nome}
          onChange={e => { setNome(e.target.value); mark(); }} placeholder="Nome do processo" />
        <span className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
          style={{ background:`${tipoCor}18`, color:tipoCor, border:`1px solid ${tipoCor}30` }}>
          {TIPO_LABELS[template.tipo] || template.tipo}
        </span>
        <span className="text-[11px] text-[var(--text-muted)] shrink-0 font-mono">{etapas.length} etapa{etapas.length !== 1 ? "s" : ""}</span>
        <button className={cn("btn text-[12px] flex items-center gap-1.5 shrink-0", dirty ? "btn-violet" : "btn-ghost")}
          onClick={() => onSave({ ...template, nome, etapas })} disabled={saving || !dirty}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button className="btn-icon shrink-0" style={{ color:"var(--accent-red)" }} onClick={onDelete} title="Excluir">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center max-w-[560px] mx-auto">
          {etapas.length === 0 && (
            <div className="text-center py-10 text-[var(--text-muted)] text-[13px] w-full rounded-xl border border-dashed border-[var(--border-subtle)] mb-0"
              style={{ background:"var(--bg-secondary)" }}>
              Nenhuma etapa — adicione a primeira abaixo.
            </div>
          )}
          {etapas.map((step, i) => (
            <div key={step.id} className="w-full flex flex-col items-center">
              {i > 0 && (
                <div className="flex flex-col items-center">
                  <div className="w-px h-4 bg-[var(--border-subtle)]" />
                  {etapas[i-1]?.tipo === "condicao" && (
                    <div className="flex items-center gap-6 text-[10px] font-mono mb-1">
                      <span className="text-amber-400">✓ Sim</span>
                      <span className="text-[var(--text-muted)] opacity-40">|</span>
                      <span className="text-red-400">✗ Não</span>
                    </div>
                  )}
                  <svg width="16" height="10" viewBox="0 0 16 10" className="mb-0.5">
                    <path d="M8 0 L8 6 M4 4 L8 10 L12 4" stroke="var(--border-subtle)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div className="w-full mb-0">
                <StepCard step={step} index={i}
                  onDelete={() => delStep(step.id)}
                  onChangeName={v => setStepName(step.id, v)}
                  onChangeField={(k, v) => setStepField(step.id, k, v)} />
              </div>
            </div>
          ))}
          <AddStepButton onAdd={addStep} />
        </div>
      </div>
    </div>
  );
}

// ── NewTemplateModal ───────────────────────────────────────────────────────────
function NewTemplateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Template) => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("ti");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!nome.trim()) { setErr("Nome obrigatório"); return; }
    setLoading(true); setErr("");
    try {
      const { data } = await api.post("/workflow-templates", {
        nome: nome.trim(), tipo, descricao: desc || undefined, cor: TIPO_CORES[tipo], ativo: true, etapas: [],
      });
      onCreate(data);
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao criar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box animate-fade-in" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-[16px] font-bold text-[var(--text-primary)]">Novo processo</h3>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1.5 uppercase tracking-wider">Nome *</label>
            <input className="input-o" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Solicitação de TI" autoFocus />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1.5 uppercase tracking-wider">Categoria</label>
            <select className="input-o" value={tipo} onChange={e => setTipo(e.target.value)}>
              {Object.keys(TIPO_LABELS).map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1.5 uppercase tracking-wider">Descrição</label>
            <input className="input-o" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descreva o processo (opcional)" />
          </div>
          {err && <div className="text-[12px] text-[var(--accent-red)] px-3 py-2 rounded-lg" style={{ background:"rgba(239,68,68,0.08)" }}>{err}</div>}
          <div className="flex justify-end gap-2 mt-1">
            <button className="btn btn-ghost text-[12px]" onClick={onClose}>Cancelar</button>
            <button className="btn btn-violet text-[12px] flex items-center gap-1.5" onClick={submit} disabled={loading}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Criar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TemplateSidebar ────────────────────────────────────────────────────────────
function TemplateSidebar({ templates, selectedId, onSelect, onNew, loading }: {
  templates: Template[]; selectedId: string | null; loading: boolean;
  onSelect: (t: Template) => void; onNew: () => void;
}) {
  const grouped = groupByTipo(templates);
  return (
    <div className="flex flex-col shrink-0 border-r border-[var(--border-subtle)] h-full overflow-hidden"
      style={{ width:250, background:"var(--bg-secondary)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Processos</span>
        <button className="btn btn-violet text-[11px] flex items-center gap-1 py-1 px-2.5" onClick={onNew}>
          <Plus size={11} /> Novo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {loading && <div className="flex items-center justify-center py-10"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>}
        {!loading && templates.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">Nenhum processo.<br />Crie o primeiro.</div>
        )}
        {!loading && Object.entries(grouped).map(([tipo, list]) => {
          const cor = TIPO_CORES[tipo] || TIPO_CORES.outro;
          return (
            <div key={tipo} className="mb-1">
              <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color:cor }}>
                {TIPO_LABELS[tipo] || tipo}
              </div>
              {list.map(t => (
                <button key={t.id} onClick={() => onSelect(t)}
                  className={cn("w-full flex items-center gap-2 px-4 py-2 text-left text-[12px] transition-colors",
                    selectedId === t.id ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                  style={{ background: selectedId === t.id ? `${cor}14` : undefined,
                    borderRight: selectedId === t.id ? `2px solid ${cor}` : "2px solid transparent" }}>
                  <span className="text-[13px] shrink-0">{t.icone || "📋"}</span>
                  <span className="flex-1 truncate">{t.nome}</span>
                  <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{ background:`${cor}18`, color:cor }}>
                    {t.etapas?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ProcessosPage() {
  useAuthStore(); // ensure store is initialized
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected,  setSelected]  = useState<Template | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showNew,   setShowNew]   = useState(false);
  const [msg,       setMsg]       = useState("");

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/workflow-templates");
      const list: Template[] = Array.isArray(data) ? data : [];
      if (list.length === 0) {
        try {
          const { data: seeded } = await api.get("/workflow-templates/seed");
          const s: Template[] = Array.isArray(seeded) ? seeded : [];
          setTemplates(s);
          if (s.length) setSelected(s[0]);
        } catch { setTemplates([]); }
      } else {
        setTemplates(list);
        setSelected(p => p ?? list[0] ?? null);
      }
    } catch { setTemplates([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (t: Template) => {
    setSaving(true);
    try {
      const { data } = await api.put(`/workflow-templates/${t.id}`, {
        nome: t.nome, etapas: t.etapas, descricao: t.descricao, tipo: t.tipo, cor: t.cor, ativo: t.ativo,
      });
      setTemplates(p => p.map(x => x.id === data.id ? data : x));
      setSelected(data);
      flash("Processo salvo!");
    } catch (e: any) { flash(e?.response?.data?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`Excluir "${selected.nome}"?`)) return;
    try {
      await api.delete(`/workflow-templates/${selected.id}`);
      const next = templates.filter(t => t.id !== selected.id);
      setTemplates(next); setSelected(next[0] ?? null);
      flash("Processo excluído.");
    } catch (e: any) { flash(e?.response?.data?.message || "Erro ao excluir"); }
  };

  const handleCreated = (t: Template) => {
    setTemplates(p => [t, ...p]); setSelected(t); setShowNew(false); flash("Processo criado!");
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {msg && <span className={cn("text-[12px] font-mono", msg.includes("Erro") ? "text-red-400" : "text-green-400")}>{msg}</span>}
      </Topbar>
      <div className="flex flex-1 overflow-hidden">
        <TemplateSidebar templates={templates} selectedId={selected?.id ?? null}
          onSelect={setSelected} onNew={() => setShowNew(true)} loading={loading} />
        <div className="flex-1 overflow-hidden" style={{ background:"var(--bg-primary)" }}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background:"var(--bg-card)", border:"1px solid var(--border-subtle)" }}>🔄</div>
              <div>
                <div className="font-display text-[16px] font-bold text-[var(--text-primary)] mb-1">Workflow Visual Builder</div>
                <div className="text-[13px] text-[var(--text-muted)] max-w-[340px] leading-relaxed">
                  Selecione um processo na lista ou crie um novo para desenhar o fluxo de etapas.
                </div>
              </div>
              <button className="btn btn-violet text-[13px] flex items-center gap-2" onClick={() => setShowNew(true)}>
                <Plus size={14} /> Novo processo
              </button>
            </div>
          ) : (
            <FlowEditor key={selected.id} template={selected}
              onSave={handleSave} onDelete={handleDelete} saving={saving} />
          )}
        </div>
      </div>
      {showNew && <NewTemplateModal onClose={() => setShowNew(false)} onCreate={handleCreated} />}
    </div>
  );
}
