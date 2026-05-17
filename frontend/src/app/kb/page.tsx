"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, BookOpen, ChevronRight, Eye, Tag, ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Categoria = { id: string; nome: string; descricao?: string; icone: string; cor: string; totalArtigos: number };
type Artigo = {
  id: string; titulo: string; slug: string; resumo?: string;
  visualizacoes: number; tags: string[]; publicadoEm?: string;
  categoria?: { id: string; nome: string; cor: string };
  autor: { id: string; nome: string };
};

function renderMd(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
}

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }) : "";
}

export default function KbPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [search, setSearch] = useState("");
  const [catFiltro, setCatFiltro] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchArtigos = useCallback(async (s: string, cat: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (cat) params.set("categoriaId", cat);
      const res = await fetch(`${API}/conhecimento/publico/artigos?${params}`);
      if (res.ok) setArtigos(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch(`${API}/conhecimento/publico/categorias`)
      .then(r => r.json())
      .then(setCategorias)
      .catch(() => {});
    fetchArtigos("", null);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchArtigos(search, catFiltro), 300);
    return () => clearTimeout(t);
  }, [search, catFiltro]);

  const openArticle = async (slug: string) => {
    try {
      const res = await fetch(`${API}/conhecimento/publico/artigos/${slug}`);
      if (res.ok) setSelected(await res.json());
    } catch {}
  };

  if (selected) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-[13px] text-purple-400 hover:text-purple-300 mb-8 transition-colors"
          >
            <ArrowLeft size={16} /> Voltar para a base de conhecimento
          </button>

          {selected.categoria && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium mb-3 inline-block"
              style={{ background: selected.categoria.cor + "20", color: selected.categoria.cor, border: `1px solid ${selected.categoria.cor}40` }}>
              {selected.categoria.nome}
            </span>
          )}
          <h1 className="text-2xl font-bold mb-3 text-white">{selected.titulo}</h1>
          <div className="flex items-center gap-4 text-[12px] text-gray-400 mb-8">
            <span>{selected.autor.nome}</span>
            <span>·</span>
            <span>{fmtDate(selected.publicadoEm)}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Eye size={12} /> {selected.visualizacoes} visualizações</span>
          </div>

          {selected.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {selected.tags.map((t: string) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">#{t}</span>
              ))}
            </div>
          )}

          <div
            className="prose prose-invert max-w-none text-[14px] leading-relaxed text-gray-200"
            style={{ lineHeight: "1.8" }}
            dangerouslySetInnerHTML={{ __html: `<p>${renderMd(selected.conteudo || "")}</p>` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <BookOpen size={16} />
            </div>
            <div>
              <div className="font-bold text-white">Base de Conhecimento</div>
              <div className="text-[11px] text-gray-400">Orkestri</div>
            </div>
          </div>
          <Link href="/login" className="text-[12px] text-purple-400 hover:text-purple-300 transition-colors">
            Acessar sistema →
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Hero + busca */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Como podemos ajudar?
          </h1>
          <p className="text-gray-400 text-[14px] mb-6">Encontre respostas, guias e tutoriais</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-[14px] text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 transition-all"
              placeholder="Buscar artigos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Categorias */}
        {!search && categorias.length > 0 && (
          <div className="mb-8">
            <div className="text-[11px] font-mono tracking-[0.1em] text-gray-500 uppercase mb-3">Categorias</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setCatFiltro(null)}
                className={`p-3 rounded-xl border text-left transition-all ${!catFiltro ? "border-purple-500/50 bg-purple-500/10" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
              >
                <div className="text-[13px] font-semibold text-white">Todos</div>
                <div className="text-[11px] text-gray-400">{artigos.length} artigos</div>
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCatFiltro(catFiltro === cat.id ? null : cat.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${catFiltro === cat.id ? "border-[var(--cc)]/50 bg-[var(--cc)]/10" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
                  style={{ "--cc": cat.cor } as any}
                >
                  <div className="text-[13px] font-semibold text-white" style={{ color: catFiltro === cat.id ? cat.cor : undefined }}>
                    {cat.nome}
                  </div>
                  <div className="text-[11px] text-gray-400">{cat.totalArtigos} artigos</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lista de artigos */}
        <div>
          {search && (
            <div className="text-[12px] text-gray-400 mb-3">
              {artigos.length} resultado{artigos.length !== 1 ? "s" : ""} para "{search}"
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_,i) => (
                <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : artigos.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[14px]">Nenhum artigo encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {artigos.map(a => (
                <button
                  key={a.id}
                  onClick={() => openArticle(a.slug)}
                  className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 hover:border-purple-500/30 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {a.categoria && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                            style={{ background: a.categoria.cor + "20", color: a.categoria.cor }}>
                            {a.categoria.nome}
                          </span>
                        )}
                        <span className="text-[14px] font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                          {a.titulo}
                        </span>
                      </div>
                      {a.resumo && (
                        <p className="text-[12px] text-gray-400 line-clamp-1">{a.resumo}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><Eye size={10} /> {a.visualizacoes}</span>
                        {a.tags?.slice(0,3).map(t => <span key={t}>#{t}</span>)}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-purple-400 transition-colors shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
