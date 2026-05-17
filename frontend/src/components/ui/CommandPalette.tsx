"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Search, Headphones, Building2, FileText, Receipt, BookOpen, X, ArrowRight,
} from "lucide-react";

type SearchResult = {
  chamados: { id: string; numero: number; titulo: string; status: string; prioridade: string }[];
  clientes: { id: string; nome: string; empresa?: string }[];
  contratos: { id: string; numero?: number; titulo: string; status: string; cliente: { nome: string } }[];
  faturas: { id: string; numero: number; descricao?: string; valor: number; status: string; cliente: { nome: string } }[];
  artigos: { id: string; titulo: string; slug: string; resumo?: string }[];
};

const PRIO_DOT: Record<string, string> = { baixa: "bg-slate-400", media: "bg-blue-400", alta: "bg-amber-400", urgente: "bg-red-500" };
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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
    for (const c of results.chamados)
      items.push({ label: `#${c.numero} ${c.titulo}`, sub: c.status, href: `/dashboard/chamados/${c.id}`, icon: Headphones, dot: PRIO_DOT[c.prioridade] });
    for (const c of results.clientes)
      items.push({ label: c.empresa || c.nome, sub: c.empresa ? c.nome : undefined, href: `/dashboard/clientes`, icon: Building2 });
    for (const c of results.contratos)
      items.push({ label: c.titulo, sub: `${c.cliente.nome} · ${c.status}`, href: `/dashboard/contratos`, icon: FileText });
    for (const f of results.faturas)
      items.push({ label: `Fatura #${f.numero}${f.descricao ? ` — ${f.descricao}` : ""}`, sub: `${f.cliente.nome} · ${fmt(f.valor)}`, href: `/dashboard/faturas`, icon: Receipt });
    for (const a of results.artigos)
      items.push({ label: a.titulo, sub: a.resumo?.slice(0, 60), href: `/dashboard/conhecimento`, icon: BookOpen });
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
    chamados: "Chamados", clientes: "Clientes", contratos: "Contratos", faturas: "Faturas", artigos: "Artigos KB",
  };
  const SECTION_ICONS: Record<string, any> = {
    chamados: Headphones, clientes: Building2, contratos: FileText, faturas: Receipt, artigos: BookOpen,
  };
  const SECTION_HREFS: Record<string, (item: any) => string> = {
    chamados: (i) => `/dashboard/chamados/${i.id}`,
    clientes: () => `/dashboard/clientes`,
    contratos: () => `/dashboard/contratos`,
    faturas: () => `/dashboard/faturas`,
    artigos: () => `/dashboard/conhecimento`,
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
            placeholder="Buscar chamados, clientes, contratos, faturas, artigos..."
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
                if (!list.length) return null;
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
                      const label = section === "chamados" ? `#${item.numero} ${item.titulo}`
                        : section === "clientes"  ? (item.empresa || item.nome)
                        : section === "contratos" ? item.titulo
                        : section === "faturas"   ? `Fatura #${item.numero}${item.descricao ? ` — ${item.descricao}` : ""}`
                        : item.titulo;
                      const sub = section === "chamados" ? item.status
                        : section === "clientes"  ? (item.empresa ? item.nome : undefined)
                        : section === "contratos" ? `${item.cliente.nome} · ${item.status}`
                        : section === "faturas"   ? `${item.cliente.nome} · ${fmt(item.valor)}`
                        : item.resumo?.slice(0, 60);
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
                          {section === "chamados" && item.prioridade && (
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
