"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Brain, Search, Sparkles, X, ArrowRight, Loader2 } from "lucide-react";

// ── AI Search Panel (Fase 5) ───────────────────────────────────────────────────
function AISearchPanel({ artigos, onClose, onOpenArticle }: {
  artigos: Artigo[]; onClose: () => void; onOpenArticle: (a: Artigo) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Artigo[]>([]);
  const [answer, setAnswer] = useState("");
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setSearched(true);
    try {
      // Search in knowledge base using API
      const { data } = await api.get("/conhecimento", { params: { q: query, limit: 5 } });
      const found: Artigo[] = data.items || [];
      setResults(found);

      // Generate rule-based "AI answer" from found articles
      if (found.length > 0) {
        const keywords = query.toLowerCase().split(" ").filter(w => w.length > 2);
        const best = found[0];
        const snippet = best.resumo || best.conteudo?.slice(0, 200) || "";
        setAnswer(`Com base na base de conhecimento, encontrei ${found.length} artigo${found.length > 1 ? "s" : ""} relacionado${found.length > 1 ? "s" : ""} à sua consulta. O artigo mais relevante é "${best.titulo}"${snippet ? `: ${snippet}...` : "."}`);
      } else {
        // Cross-search via stats/search
        try {
          const sr = await api.get("/stats/search", { params: { q: query } });
          if (sr.data?.chamados?.length || sr.data?.projetos?.length) {
            const total = (sr.data.chamados?.length || 0) + (sr.data.projetos?.length || 0);
            setAnswer(`Não encontrei artigos específicos sobre "${query}", mas encontrei ${total} resultado${total > 1 ? "s" : ""} em chamados e projetos. Considere criar um artigo sobre este tema.`);
          } else {
            setAnswer(`Não encontrei artigos sobre "${query}" na base de conhecimento. Considere criar um novo artigo sobre este tema para ajudar outros usuários.`);
          }
        } catch {
          setAnswer(`Não encontrei artigos sobre "${query}". Considere criar um novo artigo.`);
        }
      }
    } catch {
      setAnswer("Não foi possível realizar a busca. Tente novamente.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "80px 16px" }}>
      <div className="card" style={{ width: "100%", maxWidth: 640, maxHeight: "70vh", overflowY: "auto", padding: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Brain size={15} style={{ color: "var(--accent-violet)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>Perguntar à IA</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Busca inteligente na base de conhecimento</div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input-o" style={{ flex: 1 }}
              placeholder="Ex: Como redefinir senha? Como abrir chamado urgente?"
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()} autoFocus />
            <button className="btn btn-violet" style={{ fontSize: 12, paddingLeft: 14, paddingRight: 14 }} onClick={search} disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={13} />}
            </button>
          </div>
        </div>

        {/* Results */}
        {searched && !loading && (
          <div style={{ padding: "16px 20px" }}>
            {/* AI Answer */}
            {answer && (
              <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Sparkles size={12} style={{ color: "var(--accent-violet)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-violet)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>RESPOSTA IA</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{answer}</p>
              </div>
            )}

            {/* Article results */}
            {results.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 10, letterSpacing: "0.06em" }}>ARTIGOS ENCONTRADOS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {results.map(a => (
                    <button key={a.id} onClick={() => { onOpenArticle(a); onClose(); }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-violet)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
                      {a.categoria && (
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.categoria.cor, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</div>
                        {a.resumo && <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{a.resumo}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{a.visualizacoes} views</div>
                      <ArrowRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!searched && (
          <div style={{ padding: "20px 20px 24px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", width: "100%", fontFamily: "var(--font-mono)", marginBottom: 4 }}>SUGESTÕES</div>
            {["Como abrir um chamado urgente?", "Como redefinir minha senha?", "Como solicitar acesso a sistema?", "Política de uso de equipamentos"].map(s => (
              <button key={s} onClick={() => { setQuery(s); }}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, border: "1px solid var(--border-subtle)", background: "var(--bg-hover)", color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-violet)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-subtle)")}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Categoria = { id: string; nome: string; descricao?: string; icone: string; cor: string; ordem: number; ativo: boolean; totalArtigos?: number; };
type Artigo = {
  id: string; titulo: string; slug: string; resumo?: string; conteudo?: string;
  status: string; categoriaId?: string; tags: string[]; visualizacoes: number;
  publicadoEm?: string; criadoEm: string; atualizadoEm: string;
  categoria?: { id: string; nome: string; cor: string; icone: string; };
  autor: { id: string; nome: string; avatar?: string; };
};

// ── Simple markdown renderer ──────────────────────────────────────────────────
function renderMd(text: string): string {
  return text
    .replace(/^### (.+)$/gm,  '<h3 style="font-size:15px;font-weight:700;margin:18px 0 8px;color:var(--text-primary)">$1</h3>')
    .replace(/^## (.+)$/gm,   '<h2 style="font-size:17px;font-weight:700;margin:22px 0 10px;color:var(--text-primary)">$1</h2>')
    .replace(/^# (.+)$/gm,    '<h1 style="font-size:20px;font-weight:800;margin:24px 0 12px;color:var(--text-primary)">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code style="font-family:var(--font-mono);background:var(--bg-hover);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/^- (.+)$/gm,     '<li style="margin:4px 0;padding-left:6px">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm,'<li style="margin:4px 0;padding-left:6px">$2</li>')
    .replace(/\n\n/g,           '</p><p style="margin:0 0 12px">')
    .replace(/\n/g,             '<br/>');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }) : "";
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

// ── ArticleCard ───────────────────────────────────────────────────────────────
function ArticleCard({ artigo, onClick }: { artigo: Artigo; onClick: () => void }) {
  const statusColor = artigo.status === "publicado" ? "var(--accent-green)" : "var(--accent-amber)";
  return (
    <div className="card" onClick={onClick} style={{ padding:"16px 18px", cursor:"pointer", transition:"box-shadow 0.15s, background 0.15s", borderLeft:`3px solid ${artigo.categoria?.cor || "var(--border-medium)"}` }}
      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow="0 4px 20px rgba(0,0,0,0.15)"}
      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow=""}
    >
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            {artigo.categoria && (
              <span className="badge" style={{ fontSize:10, background:artigo.categoria.cor+"18", color:artigo.categoria.cor, border:`1px solid ${artigo.categoria.cor}30` }}>{artigo.categoria.nome}</span>
            )}
            <span className="badge" style={{ fontSize:10, background:statusColor+"15", color:statusColor, border:`1px solid ${statusColor}30` }}>{artigo.status}</span>
          </div>
          <h3 style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", marginBottom:4, fontFamily:"var(--font-display)", overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{artigo.titulo}</h3>
          {artigo.resumo && <p style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{artigo.resumo}</p>}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:10 }}>
        <span style={{ fontSize:11, color:"var(--text-muted)" }}>{artigo.autor.nome}</span>
        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{fmtDate(artigo.publicadoEm || artigo.criadoEm)}</span>
        <span style={{ fontSize:11, color:"var(--text-muted)", marginLeft:"auto" }}>{artigo.visualizacoes} views</span>
      </div>
      {artigo.tags.length > 0 && (
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:8 }}>
          {artigo.tags.slice(0,4).map(t=>(
            <span key={t} style={{ fontSize:10, background:"var(--bg-hover)", color:"var(--text-muted)", border:"1px solid var(--border-subtle)", borderRadius:4, padding:"2px 6px" }}>#{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ArticleEditor ─────────────────────────────────────────────────────────────
function ArticleEditor({ artigo, categorias, onSave, onCancel }: { artigo?: Artigo; categorias: Categoria[]; onSave: (a: Artigo) => void; onCancel: () => void; }) {
  const [titulo,     setTitulo]     = useState(artigo?.titulo || "");
  const [resumo,     setResumo]     = useState(artigo?.resumo || "");
  const [conteudo,   setConteudo]   = useState(artigo?.conteudo || "");
  const [categoriaId,setCategoriaId]= useState(artigo?.categoriaId || "");
  const [tags,       setTags]       = useState((artigo?.tags || []).join(", "));
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const save = async (publish?: boolean) => {
    if (!titulo.trim()) { setErr("Titulo obrigatorio"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        titulo: titulo.trim(),
        resumo: resumo.trim() || null,
        conteudo,
        categoriaId: categoriaId || null,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        ...(publish !== undefined && { status: publish ? "publicado" : "rascunho" }),
      };
      const res = artigo
        ? await api.put("/conhecimento/" + artigo.id, payload)
        : await api.post("/conhecimento", payload);
      onSave(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h2 style={{ fontSize:16, fontWeight:700, fontFamily:"var(--font-display)" }}>{artigo ? "Editar artigo" : "Novo artigo"}</h2>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onCancel}>Cancelar</button>
      </div>
      {err && <div style={{ fontSize:12, color:"var(--accent-red)", padding:"8px 12px", background:"rgba(239,68,68,0.08)", borderRadius:6 }}>{err}</div>}
      <div>
        <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>TITULO *</label>
        <input className="input-o" value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Titulo do artigo" style={{ fontSize:16, fontWeight:600 }} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>CATEGORIA</label>
          <select className="input-o" value={categoriaId} onChange={e=>setCategoriaId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>TAGS (separadas por virgula)</label>
          <input className="input-o" value={tags} onChange={e=>setTags(e.target.value)} placeholder="ex: tutorial, onboarding" />
        </div>
      </div>
      <div>
        <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>RESUMO</label>
        <input className="input-o" value={resumo} onChange={e=>setResumo(e.target.value)} placeholder="Breve descricao do artigo (opcional)" />
      </div>
      <div>
        <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>CONTEUDO (Markdown suportado)</label>
        <textarea className="input-o" value={conteudo} onChange={e=>setConteudo(e.target.value)}
          style={{ minHeight:300, resize:"vertical", fontFamily:"var(--font-mono)", fontSize:13, lineHeight:1.7 }}
          placeholder={"# Titulo\n\nEscreva o conteudo aqui...\n\n## Secao\n\n- Item 1\n- Item 2\n\n**Negrito**, *italico*, `codigo`"}
        />
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button className="btn btn-ghost" onClick={() => save(false)} disabled={saving}>Salvar rascunho</button>
        <button className="btn btn-violet" onClick={() => save(true)}  disabled={saving}>{saving ? "Salvando..." : "Salvar e publicar"}</button>
      </div>
    </div>
  );
}

// ── ArticleReader ─────────────────────────────────────────────────────────────
function ArticleReader({ artigo, canEdit, canPublish, canDelete, onEdit, onBack, onStatusChange, onDelete }: {
  artigo: Artigo; canEdit: boolean; canPublish: boolean; canDelete: boolean;
  onEdit: () => void; onBack: () => void;
  onStatusChange: (a: Artigo) => void;
  onDelete: () => void;
}) {
  const [toggling, setToggling] = useState(false);

  const togglePublish = async () => {
    setToggling(true);
    try {
      const { data } = await api.patch("/conhecimento/" + artigo.id + "/publicar", { publicar: artigo.status !== "publicado" });
      onStatusChange({ ...artigo, ...data });
    } catch {} finally { setToggling(false); }
  };

  return (
    <div style={{ maxWidth:760 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onBack}>← Voltar</button>
        <div style={{ flex:1 }} />
        {canDelete && (
          <button className="btn btn-ghost" style={{ fontSize:12, color:"var(--accent-red)" }} onClick={onDelete}>Excluir</button>
        )}
        {canPublish && (
          <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={togglePublish} disabled={toggling}>
            {artigo.status === "publicado" ? "Despublicar" : "Publicar"}
          </button>
        )}
        {canEdit && (
          <button className="btn btn-violet" style={{ fontSize:12 }} onClick={onEdit}>Editar</button>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {artigo.categoria && (
            <span className="badge" style={{ fontSize:11, background:artigo.categoria.cor+"18", color:artigo.categoria.cor, border:`1px solid ${artigo.categoria.cor}30` }}>{artigo.categoria.nome}</span>
          )}
          {artigo.status === "rascunho" && (
            <span className="badge" style={{ fontSize:11, background:"rgba(245,158,11,0.12)", color:"var(--accent-amber)", border:"1px solid rgba(245,158,11,0.2)" }}>Rascunho</span>
          )}
        </div>
        <h1 style={{ fontSize:24, fontWeight:800, fontFamily:"var(--font-display)", lineHeight:1.3, color:"var(--text-primary)", marginBottom:10 }}>{artigo.titulo}</h1>
        {artigo.resumo && <p style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:12 }}>{artigo.resumo}</p>}
        <div style={{ display:"flex", alignItems:"center", gap:16, fontSize:12, color:"var(--text-muted)" }}>
          <span>{artigo.autor.nome}</span>
          <span style={{ fontFamily:"var(--font-mono)" }}>{fmtDate(artigo.publicadoEm || artigo.criadoEm)}</span>
          <span>{artigo.visualizacoes} visualizacoes</span>
        </div>
        {artigo.tags.length > 0 && (
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:10 }}>
            {artigo.tags.map(t=>(
              <span key={t} style={{ fontSize:11, background:"var(--bg-hover)", color:"var(--text-muted)", border:"1px solid var(--border-subtle)", borderRadius:4, padding:"3px 8px" }}>#{t}</span>
            ))}
          </div>
        )}
      </div>

      <hr style={{ border:"none", borderTop:"1px solid var(--border-subtle)", marginBottom:24 }} />

      {/* Content */}
      <div className="card" style={{ padding:"24px 28px" }}>
        {artigo.conteudo ? (
          <div style={{ fontSize:14, lineHeight:1.8, color:"var(--text-secondary)" }}
            dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 12px">${renderMd(artigo.conteudo)}</p>` }}
          />
        ) : (
          <div className="empty-state"><p style={{ color:"var(--text-muted)" }}>Sem conteudo</p></div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ConhecimentoPage() {
  const { user } = useAuthStore();
  const [categorias,   setCategorias]  = useState<Categoria[]>([]);
  const [artigos,      setArtigos]     = useState<Artigo[]>([]);
  const [total,        setTotal]       = useState(0);
  const [page,         setPage]        = useState(1);
  const [loading,      setLoading]     = useState(false);
  const [q,            setQ]           = useState("");
  const [filterCat,    setFilterCat]   = useState("");
  const [filterTag,    setFilterTag]   = useState("");
  const [allTags,      setAllTags]     = useState<string[]>([]);
  const [selected,     setSelected]    = useState<Artigo | null>(null);
  const [editing,      setEditing]     = useState(false);
  const [showAI,       setShowAI]      = useState(false);
  const [showDrafts,   setShowDrafts]  = useState(false);
  const [msg,          setMsg]         = useState("");

  const canCreate  = hasPerms(user, "conhecimento:criar");
  const canEdit    = hasPerms(user, "conhecimento:editar");
  const canPublish = hasPerms(user, "conhecimento:publicar");
  const canDelete  = hasPerms(user, "conhecimento:deletar");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const loadCategorias = useCallback(() => {
    api.get("/conhecimento/categorias").then(r => setCategorias(r.data)).catch(() => {});
    api.get("/conhecimento/tags").then(r => setAllTags(r.data)).catch(() => {});
  }, []);

  const loadArtigos = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = showDrafts && canEdit ? "/conhecimento/todos" : "/conhecimento";
      const { data } = await api.get(endpoint, { params: { q, categoriaId: filterCat, tag: filterTag, page, limit: 20 } });
      setArtigos(data.items);
      setTotal(data.total);
    } catch {} finally { setLoading(false); }
  }, [q, filterCat, filterTag, page, showDrafts, canEdit]);

  useEffect(() => { loadCategorias(); }, [loadCategorias]);
  useEffect(() => { setPage(1); }, [q, filterCat, filterTag, showDrafts]);
  useEffect(() => { loadArtigos(); }, [loadArtigos]);

  const openArticle = async (a: Artigo) => {
    try {
      const { data } = await api.get("/conhecimento/" + a.id);
      setSelected(data); setEditing(false);
    } catch { setSelected(a); setEditing(false); }
  };

  const handleSave = (saved: Artigo) => {
    setSelected(saved); setEditing(false);
    loadArtigos(); loadCategorias();
    showMsg(saved.id ? "Artigo salvo!" : "Artigo criado!");
  };

  const handleDelete = async () => {
    if (!selected || !confirm("Remover este artigo permanentemente?")) return;
    try {
      await api.delete("/conhecimento/" + selected.id);
      setSelected(null); loadArtigos(); loadCategorias(); showMsg("Artigo removido");
    } catch { showMsg("Erro ao remover"); }
  };

  const limit = 20;
  const pages = Math.ceil(total / limit);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        {msg && <span style={{ fontSize:12, color: msg.includes("Erro") ? "var(--accent-red)" : "var(--accent-green)", fontFamily:"var(--font-mono)" }}>{msg}</span>}
        {!selected && !editing && (
          <button className="btn btn-ghost" style={{ fontSize:12, display:"flex", alignItems:"center", gap:6 }} onClick={() => setShowAI(true)}>
            <Brain size={13} style={{ color:"var(--accent-violet)" }} /> Perguntar à IA
          </button>
        )}
        {canCreate && !selected && !editing && (
          <button className="btn btn-violet" style={{ fontSize:12 }} onClick={() => { setSelected(null); setEditing(true); }}>Novo artigo</button>
        )}
      </Topbar>
      {showAI && <AISearchPanel artigos={artigos} onClose={() => setShowAI(false)} onOpenArticle={openArticle} />}

      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
        {/* Sidebar: categories + tags */}
        {!editing && (
          <div style={{ width:220, flexShrink:0, borderRight:"1px solid var(--border-subtle)", overflowY:"auto", padding:"16px 12px", display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", fontWeight:600, padding:"4px 8px", marginBottom:4 }}>CATEGORIAS</div>
            <button onClick={() => { setFilterCat(""); setFilterTag(""); }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:6, border:"none", cursor:"pointer", background:!filterCat && !filterTag ? "var(--accent-violet-dim)" : "transparent", color:!filterCat && !filterTag ? "var(--accent-violet)" : "var(--text-muted)", fontSize:13 }}>
              <span>Todos</span>
              <span style={{ fontSize:11, fontFamily:"var(--font-mono)" }}>{total}</span>
            </button>
            {categorias.map(c => (
              <button key={c.id} onClick={() => { setFilterCat(c.id); setFilterTag(""); }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:6, border:"none", cursor:"pointer", background:filterCat===c.id ? c.cor+"18" : "transparent", color:filterCat===c.id ? c.cor : "var(--text-secondary)", fontSize:13, textAlign:"left" }}>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nome}</span>
                <span style={{ fontSize:11, fontFamily:"var(--font-mono)", flexShrink:0, marginLeft:6 }}>{c.totalArtigos ?? ""}</span>
              </button>
            ))}

            {allTags.length > 0 && (
              <>
                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", fontWeight:600, padding:"4px 8px", marginTop:12, marginBottom:2 }}>TAGS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, padding:"0 4px" }}>
                  {allTags.map(t=>(
                    <button key={t} onClick={() => { setFilterTag(filterTag===t?"":t); setFilterCat(""); }} style={{ fontSize:11, padding:"3px 8px", borderRadius:4, border:"1px solid var(--border-subtle)", background:filterTag===t ? "var(--accent-violet-dim)" : "transparent", color:filterTag===t ? "var(--accent-violet)" : "var(--text-muted)", cursor:"pointer" }}>#{t}</button>
                  ))}
                </div>
              </>
            )}

            {canEdit && (
              <div style={{ marginTop:"auto", paddingTop:12, borderTop:"1px solid var(--border-subtle)" }}>
                <button onClick={() => setShowDrafts(d => !d)} style={{ width:"100%", padding:"7px 10px", borderRadius:6, border:"1px solid var(--border-subtle)", cursor:"pointer", background: showDrafts ? "var(--accent-amber-dim, rgba(245,158,11,0.1))" : "transparent", color: showDrafts ? "var(--accent-amber)" : "var(--text-muted)", fontSize:12 }}>
                  {showDrafts ? "Ocultar rascunhos" : "Ver rascunhos"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px" }}>
          {editing ? (
            <ArticleEditor
              artigo={selected || undefined}
              categorias={categorias}
              onSave={handleSave}
              onCancel={() => { setEditing(false); }}
            />
          ) : selected ? (
            <ArticleReader
              artigo={selected}
              canEdit={canEdit || selected.autor?.id === user?.id}
              canPublish={canPublish}
              canDelete={canDelete || selected.autor?.id === user?.id}
              onEdit={() => setEditing(true)}
              onBack={() => setSelected(null)}
              onStatusChange={a => { setSelected(a); setArtigos(p => p.map(x => x.id === a.id ? { ...x, ...a } : x)); }}
              onDelete={handleDelete}
            />
          ) : (
            <>
              {/* Search bar */}
              <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                <input className="input-o" style={{ flex:1, maxWidth:400 }} placeholder="Buscar artigos..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
                {(filterCat || filterTag || q) && (
                  <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => { setQ(""); setFilterCat(""); setFilterTag(""); }}>Limpar</button>
                )}
              </div>

              {/* Stats bar */}
              <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16, fontFamily:"var(--font-mono)" }}>
                {total} artigo{total !== 1 ? "s" : ""}
                {filterCat && categorias.find(c=>c.id===filterCat) ? ` em "${categorias.find(c=>c.id===filterCat)?.nome}"` : ""}
                {filterTag ? ` com tag #${filterTag}` : ""}
                {q ? ` para "${q}"` : ""}
              </div>

              {/* Article grid */}
              {loading ? (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
                  {Array.from({length:6}).map((_,i)=><div key={i} className="card skeleton" style={{ height:140 }} />)}
                </div>
              ) : artigos.length === 0 ? (
                <div className="empty-state">
                  <p style={{ color:"var(--text-muted)" }}>Nenhum artigo encontrado</p>
                  {canCreate && <button className="btn btn-violet" style={{ marginTop:12 }} onClick={() => setEditing(true)}>Criar primeiro artigo</button>}
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
                  {artigos.map(a=>(
                    <ArticleCard key={a.id} artigo={a} onClick={() => openArticle(a)} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pages > 1 && (
                <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:24 }}>
                  <button className="btn btn-ghost" style={{ fontSize:12 }} disabled={page===1} onClick={()=>setPage(p=>p-1)}>Anterior</button>
                  <span style={{ fontSize:12, color:"var(--text-muted)", padding:"6px 12px", fontFamily:"var(--font-mono)" }}>{page} / {pages}</span>
                  <button className="btn btn-ghost" style={{ fontSize:12 }} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Proximo</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
