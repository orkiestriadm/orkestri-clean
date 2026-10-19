"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Search, FolderKanban, CheckSquare, Users, X, ArrowRight,
} from "lucide-react";

/**
 * Busca global.
 *
 * Antes de 18/10/2026 procurava em chamados, clientes, contratos, faturas e
 * artigos da base de conhecimento — cinco entidades que saíram com os módulos
 * removidos. Hoje procura no que o sistema tem: projetos, tarefas e pessoas.
 */
type SearchResult = {
  projetos: { id: string; titulo: string; status: string; prioridade: string }[];
  tarefas: { id: string; titulo: string; status: string; prioridade: string; projectId: string; project?: { titulo: string } }[];
  usuarios: { id: string; nome: string; email: string }[];
};

const PRIO_DOT: Record<string, string> = { BAIXA: "bg-slate-400", MEDIA: "bg-blue-400", ALTA: "bg-amber-400", URGENTE: "bg-red-500" };
const STATUS_LABEL: Record<string, string> = {
  A_FAZER: "A fazer", EM_ANDAMENTO: "Em andamento", EM_REVISAO: "Em revisão",
  CONCLUIDA: "Concluída", CANCELADA: "Cancelada",
  PLANEJAMENTO: "Planejamento", CONCLUIDO: "Concluído", CANCELADO: "Cancelado", PAUSADO: "Pausado",
};
const rotulo = (s: string) => STATUS_LABEL[s] ?? s;

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/stats/search", { params: { q } });
        setResults(r.data);
        setSel(0);
      } catch {}
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Build flat list for keyboard nav
  const items: { label: string; sub?: string; href: string; icon: any; dot?: string }[] = [];
  if (results) {
    for (const p of results.projetos)
      items.push({ label: p.titulo, sub: rotulo(p.status), href: `/dashboard/projetos/${p.id}`, icon: FolderKanban, dot: PRIO_DOT[p.prioridade] });
    for (const t of results.tarefas)
      items.push({ label: t.titulo, sub: `${t.project?.titulo ?? "Sem projeto"} · ${rotulo(t.status)}`, href: `/dashboard/projetos/${t.projectId}`, icon: CheckSquare, dot: PRIO_DOT[t.prioridade] });
    for (const u of results.usuarios)
      items.push({ label: u.nome, sub: u.email, href: `/dashboard/cadastros`, icon: Users });
  }

  const navigate = (href: string) => { router.push(href); onClose(); };

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && items[sel]) navigate(items[sel].href);
  }, [items, sel, onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const SECTION_LABELS: Record<string, string> = {
    projetos: "Projetos", tarefas: "Tarefas", usuarios: "Pessoas",
  };
  const SECTION_ICONS: Record<string, any> = {
    projetos: FolderKanban, tarefas: CheckSquare, usuarios: Users,
  };
  const SECTION_HREFS: Record<string, (item: any) => string> = {
    projetos: (i) => `/dashboard/projetos/${i.id}`,
    tarefas:  (i) => `/dashboard/projetos/${i.projectId}`,
    usuarios: () => `/dashboard/cadastros`,
  };

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Buscar projetos, tarefas, pessoas..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground shrink-0">
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-[12px] text-muted-foreground">Buscando...</div>
          )}

          {!loading && q.length < 2 && (
            <div className="p-6 text-center text-[12px] text-muted-foreground">
              Digite pelo menos 2 caracteres para pesquisar
            </div>
          )}

          {!loading && results && items.length === 0 && (
            <div className="p-6 text-center text-[12px] text-muted-foreground">
              Nenhum resultado para "{q}"
            </div>
          )}

          {!loading && results && (
            <div className="py-1">
              {(Object.keys(results) as (keyof SearchResult)[]).map(section => {
                const list = results[section];
                if (!list?.length) return null;
                const Icon = SECTION_ICONS[section];
                const hrefFn = SECTION_HREFS[section];
                return (
                  <div key={section}>
                    <div className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono text-muted-foreground uppercase tracking-[0.1em] bg-muted/20">
                      <Icon size={10} />
                      {SECTION_LABELS[section]}
                    </div>
                    {list.map((item: any) => {
                      const idx = flatIdx++;
                      const active = idx === sel;
                      const label = section === "usuarios" ? item.nome
                        : section === "projetos" ? item.titulo
                        : item.titulo;
                      const sub = section === "usuarios" ? item.email
                        : section === "projetos" ? rotulo(item.status)
                        : `${item.project?.titulo ?? "Sem projeto"} · ${rotulo(item.status)}`;
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(hrefFn(item))}
                          onMouseEnter={() => setSel(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            active ? "bg-primary/10" : "hover:bg-accent/50"
                          )}
                        >
                          {section !== "usuarios" && item.prioridade && (
                            <span className={cn("w-2 h-2 rounded-full shrink-0", PRIO_DOT[item.prioridade])} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-foreground truncate">{label}</div>
                            {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
                          </div>
                          {active && <ArrowRight size={12} className="text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="border border-border rounded px-1 font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="border border-border rounded px-1 font-mono">↵</kbd> abrir</span>
          <span><kbd className="border border-border rounded px-1 font-mono">ESC</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
