"use client";
import { useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  UserPlus, Laptop, KeyRound, Mail, Shield, Wrench, RotateCcw, Printer,
  Palmtree, UserCog, Gift, FileText, Clock,
  Receipt, FileCheck, DollarSign,
  Scale, Stamp, BookOpen,
  CalendarDays, Building2, Package,
  Search, X, Loader2, CheckCircle2, AlertCircle,
  type LucideIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type CategoryKey = "TI" | "RH" | "Financeiro" | "Jurídico" | "Facilities";

type ServiceItem = {
  nome: string;
  descricao: string;
  icon: LucideIcon;
  color: string;
  sla: string;
  categoria: CategoryKey;
  chamadoCategoria: string;
};

// ── Catalog Data ───────────────────────────────────────────────────────────────
const SERVICES: ServiceItem[] = [
  // TI
  { nome: "Novo Usuário",         descricao: "Criar conta no sistema",            icon: UserPlus,    color: "#60a5fa", sla: "Atende em 4h",    categoria: "TI",        chamadoCategoria: "TI" },
  { nome: "Novo Notebook",        descricao: "Solicitação de equipamento",         icon: Laptop,      color: "#60a5fa", sla: "Atende em 2 dias", categoria: "TI",        chamadoCategoria: "TI" },
  { nome: "Acesso ao Sistema",    descricao: "Permissão em sistema específico",    icon: KeyRound,    color: "#60a5fa", sla: "Atende em 4h",    categoria: "TI",        chamadoCategoria: "TI" },
  { nome: "Configurar E-mail",    descricao: "Setup de e-mail corporativo",        icon: Mail,        color: "#60a5fa", sla: "Atende em 4h",    categoria: "TI",        chamadoCategoria: "TI" },
  { nome: "VPN / Acesso Remoto",  descricao: "Configuração de acesso remoto",      icon: Shield,      color: "#60a5fa", sla: "Atende em 8h",    categoria: "TI",        chamadoCategoria: "TI" },
  { nome: "Suporte Técnico",      descricao: "Problema técnico geral",             icon: Wrench,      color: "#60a5fa", sla: "Atende em 2h",    categoria: "TI",        chamadoCategoria: "Suporte Técnico" },
  { nome: "Reset de Senha",       descricao: "Redefinição de credenciais",         icon: RotateCcw,   color: "#60a5fa", sla: "Atende em 1h",    categoria: "TI",        chamadoCategoria: "TI" },
  { nome: "Impressora / Periférico", descricao: "Configuração de hardware",        icon: Printer,     color: "#60a5fa", sla: "Atende em 4h",    categoria: "TI",        chamadoCategoria: "TI" },
  // RH
  { nome: "Solicitação de Férias", descricao: "Agendamento de férias",             icon: Palmtree,    color: "#34d399", sla: "Atende em 1 dia",  categoria: "RH",        chamadoCategoria: "RH" },
  { nome: "Alteração Cadastral",  descricao: "Atualização de dados pessoais",      icon: UserCog,     color: "#34d399", sla: "Atende em 1 dia",  categoria: "RH",        chamadoCategoria: "RH" },
  { nome: "Benefícios",           descricao: "Dúvidas ou alterações de benefícios",icon: Gift,        color: "#34d399", sla: "Atende em 2 dias", categoria: "RH",        chamadoCategoria: "RH" },
  { nome: "Documentação",         descricao: "Emissão de documentos (holerite, IR)",icon: FileText,   color: "#34d399", sla: "Atende em 2 dias", categoria: "RH",        chamadoCategoria: "RH" },
  { nome: "Ponto Eletrônico",     descricao: "Ajuste ou dúvida de ponto",          icon: Clock,       color: "#34d399", sla: "Atende em 1 dia",  categoria: "RH",        chamadoCategoria: "RH" },
  // Financeiro
  { nome: "Reembolso de Despesa", descricao: "Reembolso por gasto aprovado",       icon: Receipt,     color: "#fbbf24", sla: "Atende em 3 dias", categoria: "Financeiro", chamadoCategoria: "Financeiro" },
  { nome: "Nota Fiscal",          descricao: "Solicitação de emissão de NF",        icon: FileCheck,   color: "#fbbf24", sla: "Atende em 2 dias", categoria: "Financeiro", chamadoCategoria: "Financeiro" },
  { nome: "Adiantamento",         descricao: "Solicitação de adiantamento financeiro",icon: DollarSign,color: "#fbbf24", sla: "Atende em 3 dias", categoria: "Financeiro", chamadoCategoria: "Financeiro" },
  // Jurídico
  { nome: "Revisão de Contrato",  descricao: "Análise de documento legal",          icon: Scale,       color: "#a78bfa", sla: "Atende em 5 dias", categoria: "Jurídico",  chamadoCategoria: "Jurídico" },
  { nome: "Procuração",           descricao: "Emissão de procuração",               icon: Stamp,       color: "#a78bfa", sla: "Atende em 3 dias", categoria: "Jurídico",  chamadoCategoria: "Jurídico" },
  { nome: "Parecer Jurídico",     descricao: "Consulta ao jurídico",                icon: BookOpen,    color: "#a78bfa", sla: "Atende em 5 dias", categoria: "Jurídico",  chamadoCategoria: "Jurídico" },
  // Facilities
  { nome: "Reserva de Sala",      descricao: "Agendamento de sala de reunião",      icon: CalendarDays,color: "#fb923c", sla: "Atende em 2h",    categoria: "Facilities", chamadoCategoria: "Solicitação" },
  { nome: "Manutenção Predial",   descricao: "Reparo ou manutenção física",         icon: Building2,   color: "#fb923c", sla: "Atende em 1 dia",  categoria: "Facilities", chamadoCategoria: "Solicitação" },
  { nome: "Material de Escritório",descricao: "Solicitação de suprimentos",         icon: Package,     color: "#fb923c", sla: "Atende em 1 dia",  categoria: "Facilities", chamadoCategoria: "Solicitação" },
];

const CATEGORIES: Array<{ key: "Todos" | CategoryKey; color?: string }> = [
  { key: "Todos" },
  { key: "TI",         color: "#60a5fa" },
  { key: "RH",         color: "#34d399" },
  { key: "Financeiro", color: "#fbbf24" },
  { key: "Jurídico",   color: "#a78bfa" },
  { key: "Facilities", color: "#fb923c" },
];

const URGENCIA_MAP: Record<string, string> = {
  Normal:   "media",
  Alta:     "alta",
  Urgente:  "critica",
};

// ── Service Card ───────────────────────────────────────────────────────────────
function ServiceCard({ service, onClick }: { service: ServiceItem; onClick: () => void }) {
  const Icon = service.icon;
  return (
    <button
      onClick={onClick}
      className="group card-premium rounded-2xl p-5 text-left w-full transition-all hover:-translate-y-1 hover:shadow-premium-md focus-visible:ring-2 focus-visible:ring-[var(--accent-violet)] outline-none"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
          style={{ background: service.color + "20", border: `1px solid ${service.color}40` }}
        >
          <Icon size={20} style={{ color: service.color }} />
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap mt-0.5"
          style={{ background: service.color + "15", color: service.color, border: `1px solid ${service.color}30` }}
        >
          {service.sla}
        </span>
      </div>

      <h3 className="text-[14px] font-semibold text-[var(--text-primary)] font-display mb-1 leading-snug">
        {service.nome}
      </h3>
      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mb-4 line-clamp-2">
        {service.descricao}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
          {service.categoria}
        </span>
        <span
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all -translate-y-1 group-hover:translate-y-0"
          style={{ background: service.color + "20", color: service.color }}
        >
          Solicitar
        </span>
      </div>
    </button>
  );
}

// ── Request Modal ──────────────────────────────────────────────────────────────
type Toast = { type: "ok" | "err"; msg: string };

function RequestModal({
  service,
  onClose,
  onSuccess,
}: {
  service: ServiceItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [urgencia, setUrgencia] = useState<"Normal" | "Alta" | "Urgente">("Normal");
  const [usuarioAfetado, setUsuarioAfetado] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isTI = service.categoria === "TI";
  const Icon = service.icon;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const titulo = descricao.trim()
        ? `${service.nome} — ${descricao.trim().slice(0, 60)}`
        : service.nome;

      const fullDesc = [
        descricao.trim() || service.descricao,
        isTI && usuarioAfetado.trim() ? `\nUsuário afetado: ${usuarioAfetado.trim()}` : "",
      ]
        .filter(Boolean)
        .join("");

      await api.post("/chamados", {
        titulo,
        descricao: fullDesc,
        prioridade: URGENCIA_MAP[urgencia],
        categoria: service.chamadoCategoria,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao abrir chamado. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="modal-box card-premium rounded-2xl w-full max-w-md shadow-premium-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: service.color + "20", border: `1px solid ${service.color}40` }}
            >
              <Icon size={17} style={{ color: service.color }} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider leading-none mb-0.5">
                Solicitar
              </p>
              <h2 className="text-[15px] font-bold font-display text-[var(--text-primary)] leading-tight">
                {service.nome}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* SLA info */}
        <div
          className="mx-6 mt-4 px-3 py-2 rounded-lg text-[11px] flex items-center gap-2"
          style={{ background: service.color + "10", border: `1px solid ${service.color}25`, color: service.color }}
        >
          <Clock size={12} />
          <span className="font-medium">{service.sla}</span>
          <span className="opacity-60">• {service.descricao}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle size={13} className="shrink-0" /> {error}
            </p>
          )}

          <div>
            <label className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
              Descrição adicional
            </label>
            <textarea
              rows={4}
              className="input-o resize-y min-h-[80px]"
              placeholder="Descreva detalhes adicionais sobre sua solicitação..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {isTI && (
            <div>
              <label className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                Usuário afetado <span className="normal-case opacity-60">(opcional)</span>
              </label>
              <input
                type="text"
                className="input-o"
                placeholder="Nome ou e-mail do usuário afetado..."
                value={usuarioAfetado}
                onChange={(e) => setUsuarioAfetado(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-2">
              Urgência
            </label>
            <div className="flex gap-2">
              {(["Normal", "Alta", "Urgente"] as const).map((u) => {
                const colors = {
                  Normal:  { active: "#60a5fa", bg: "#60a5fa" },
                  Alta:    { active: "#fbbf24", bg: "#fbbf24" },
                  Urgente: { active: "#f87171", bg: "#f87171" },
                };
                const c = colors[u];
                const isActive = urgencia === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgencia(u)}
                    className={cn(
                      "flex-1 text-[12px] font-semibold py-2 rounded-xl border transition-all",
                      isActive ? "shadow-sm" : "opacity-60 hover:opacity-80"
                    )}
                    style={
                      isActive
                        ? { background: c.bg + "25", borderColor: c.bg + "60", color: c.active }
                        : { background: "var(--bg-hover)", borderColor: "var(--border-subtle)", color: "var(--text-muted)" }
                    }
                  >
                    {u}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-violet flex-1 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Abrir Chamado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CatalogoPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<"Todos" | CategoryKey>("Todos");
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  }

  const filtered = SERVICES.filter((s) => {
    const matchCat = activeCategory === "Todos" || s.categoria === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || s.nome.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  // Group by category for display when "Todos" is selected
  const groupedByCategory =
    activeCategory === "Todos"
      ? CATEGORIES.filter((c) => c.key !== "Todos").map((c) => ({
          ...c,
          services: filtered.filter((s) => s.categoria === c.key),
        })).filter((g) => g.services.length > 0)
      : null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-primary)]">
      <Topbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-primary)] flex flex-col pt-5 pb-4 px-3 gap-1 overflow-y-auto">
          <p className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-2">
            Categorias
          </p>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            const count =
              cat.key === "Todos"
                ? SERVICES.length
                : SERVICES.filter((s) => s.categoria === cat.key).length;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "flex items-center justify-between w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-[var(--accent-violet)]/10 text-[var(--accent-violet)] border border-[var(--accent-violet)]/20"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border border-transparent"
                )}
              >
                <span className="flex items-center gap-2">
                  {cat.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: cat.color }}
                    />
                  )}
                  {cat.key}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-[var(--accent-violet)]/15 text-[var(--accent-violet)]"
                      : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Search bar */}
          <div className="sticky top-0 z-10 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 backdrop-blur-xl">
            <div className="relative max-w-xl">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                className="input-o pl-10 py-2.5"
                placeholder="Buscar serviço por nome ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
                  <Search size={22} className="text-[var(--text-muted)]" />
                </div>
                <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
                  Nenhum serviço encontrado
                </p>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Tente ajustar a busca ou selecione outra categoria.
                </p>
              </div>
            ) : groupedByCategory ? (
              // Grouped view (Todos selected)
              <div className="space-y-8">
                {groupedByCategory.map((group) => (
                  <section key={group.key}>
                    <div className="flex items-center gap-2 mb-4">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: group.color }}
                      />
                      <h2 className="text-[13px] font-bold font-display text-[var(--text-secondary)] uppercase tracking-widest">
                        {group.key}
                      </h2>
                      <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-full px-2 py-0.5">
                        {group.services.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.services.map((s) => (
                        <ServiceCard key={s.nome} service={s} onClick={() => setSelectedService(s)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              // Flat grid (specific category selected)
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((s) => (
                  <ServiceCard key={s.nome} service={s} onClick={() => setSelectedService(s)} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Request Modal */}
      {selectedService && (
        <RequestModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onSuccess={() =>
            showToast({ type: "ok", msg: `Chamado "${selectedService.nome}" aberto com sucesso!` })
          }
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[80] flex items-center gap-2 px-4 py-3 rounded-xl shadow-premium-lg border backdrop-blur-xl animate-in slide-in-from-bottom-4",
            toast.type === "ok"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/15 border-red-500/30 text-red-300"
          )}
        >
          {toast.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
