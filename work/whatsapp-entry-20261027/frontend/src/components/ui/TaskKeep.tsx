"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

/**
 * Keep da tarefa: cada membro do projeto registra o que fez nela.
 *
 * Visual das notas do Keep pessoal (cor, checklist), mas o conteúdo é do
 * projeto: todos os membros leem, só o autor altera. Quem pode escrever vem do
 * servidor (`podeEscrever`), para não mostrar campo a quem levaria 403.
 */

type Item     = { id: string; descricao: string; concluido: boolean; ordem: number };
type Registro = { id: string; conteudo: string | null; cor: string | null; criadoEm: string; atualizadoEm: string; autor: { id: string; nome: string }; itens: Item[] };

// Mesma paleta do Keep pessoal (app/dashboard/keep/page.tsx).
const CORES = [
  { value:"",        bg:"var(--bg-card)",      border:"var(--border-subtle)" },
  { value:"#581c87", bg:"rgba(88,28,135,0.2)", border:"rgba(139,92,246,0.35)" },
  { value:"#164e63", bg:"rgba(22,78,99,0.2)",  border:"rgba(34,211,238,0.3)" },
  { value:"#14532d", bg:"rgba(20,83,45,0.2)",  border:"rgba(52,211,153,0.3)" },
  { value:"#713f12", bg:"rgba(113,63,18,0.2)", border:"rgba(251,191,36,0.3)" },
  { value:"#7f1d1d", bg:"rgba(127,29,29,0.2)", border:"rgba(248,113,113,0.3)" },
];

function estiloCor(cor?: string | null) {
  const c = CORES.find(x => x.value === (cor || "")) || CORES[0];
  return { background: c.bg, borderColor: c.border };
}

function quando(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}`;
}

function erroDe(e: any, padrao: string): string {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(" ") : (m || padrao);
}

function Avatar({ nome }: { nome: string }) {
  const i = nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>
      {i}
    </div>
  );
}

function Spin() {
  return <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

function Checkbox({ marcado, onClick, desabilitado }: { marcado: boolean; onClick?: () => void; desabilitado?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={desabilitado} aria-pressed={marcado}
      style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${marcado?"var(--accent-green)":"var(--border-medium)"}`, background:marcado?"var(--accent-green)":"transparent", cursor:desabilitado?"default":"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
      {marcado && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round"/></svg>}
    </button>
  );
}

function SeletorCor({ valor, onChange }: { valor: string; onChange: (cor: string) => void }) {
  return (
    <div style={{ display:"flex", gap:3 }}>
      {CORES.map(c => (
        <button key={c.value} type="button" title={c.value ? "Cor da nota" : "Sem cor"} onClick={() => onChange(c.value)}
          style={{ width:14, height:14, borderRadius:"50%", background:c.value||"var(--border-medium)", border:valor===c.value?"2px solid var(--text-primary)":"1px solid transparent", cursor:"pointer", outline:"none", padding:0 }} />
      ))}
    </div>
  );
}

const inputItem: React.CSSProperties = { flex:1, background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", borderRadius:6, padding:"5px 10px", fontSize:12, color:"var(--text-primary)", outline:"none" };
const btnMais: React.CSSProperties  = { background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:6, padding:"5px 10px", fontSize:12, color:"var(--accent-violet)", cursor:"pointer" };

/* ── Novo registro ─────────────────────────────────────────────────────── */

function NovoRegistro({ base, onSalvo, onCancelar }: { base: string; onSalvo: () => void; onCancelar: () => void }) {
  const [conteudo, setConteudo] = useState("");
  const [itens,    setItens]    = useState<string[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [cor,      setCor]      = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro,     setErro]     = useState("");

  const addItem = () => {
    const t = novoItem.trim();
    if (!t) return;
    setItens(i => [...i, t]);
    setNovoItem("");
  };

  const salvar = async () => {
    // Item digitado e não confirmado com Enter entra também: perder o que a
    // pessoa escreveu por não ter apertado Enter seria frustrante.
    const todos = novoItem.trim() ? [...itens, novoItem.trim()] : itens;
    if (!conteudo.trim() && !todos.length) { setErro("Escreva o que foi feito ou adicione um item."); return; }
    setSalvando(true); setErro("");
    try {
      await api.post(base, { conteudo: conteudo.trim() || undefined, itens: todos, cor: cor || undefined });
      onSalvo();
    } catch (e) { setErro(erroDe(e, "Não foi possível salvar o registro.")); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ ...estiloCor(cor), border:"1px solid", borderRadius:14, padding:"12px 14px", display:"flex", flexDirection:"column", gap:10, boxShadow:"0 0 0 3px rgba(124,58,237,0.08)" }}>
      <textarea autoFocus value={conteudo} onChange={e=>setConteudo(e.target.value)} placeholder="O que você fez nesta tarefa?"
        style={{ width:"100%", background:"transparent", border:"none", outline:"none", fontSize:13, color:"var(--text-primary)", resize:"vertical", minHeight:70, fontFamily:"var(--font-body)", lineHeight:1.6, padding:0 }} />

      {itens.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {itens.map((it, idx) => (
            <div key={idx} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Checkbox marcado={false} desabilitado />
              <span style={{ flex:1, fontSize:13, color:"var(--text-primary)" }}>{it}</span>
              <button type="button" title="Tirar item" onClick={()=>setItens(i => i.filter((_, j) => j !== idx))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", display:"flex", padding:2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:6 }}>
        <input value={novoItem} onChange={e=>setNovoItem(e.target.value)} onKeyDown={e=>{ if (e.key==="Enter") { e.preventDefault(); addItem(); } }} placeholder="Item do checklist (Enter adiciona)" style={inputItem} />
        <button type="button" onClick={addItem} style={btnMais}>+</button>
      </div>

      {erro && <p style={{ fontSize:12, color:"var(--accent-red)", margin:0 }}>{erro}</p>}

      <div style={{ display:"flex", alignItems:"center", gap:8, borderTop:"1px solid var(--border-subtle)", paddingTop:10 }}>
        <SeletorCor valor={cor} onChange={setCor} />
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize:12, padding:"5px 12px" }} onClick={onCancelar}>Cancelar</button>
          <button type="button" className="btn btn-violet" style={{ fontSize:12, padding:"5px 14px" }} onClick={salvar} disabled={salvando}>{salvando ? <Spin/> : "Salvar registro"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Registro existente ────────────────────────────────────────────────── */

function CartaoRegistro({ registro, base, meu, podeApagar, onMudou }: { registro: Registro; base: string; meu: boolean; podeApagar: boolean; onMudou: () => void }) {
  const [editando,   setEditando]   = useState(false);
  const [texto,      setTexto]      = useState(registro.conteudo || "");
  const [novoItem,   setNovoItem]   = useState("");
  const [confirmar,  setConfirmar]  = useState(false);
  const [ocupado,    setOcupado]    = useState(false);
  const [erro,       setErro]       = useState("");

  const url = `${base}/${registro.id}`;
  const feitos = registro.itens.filter(i => i.concluido).length;
  const editado = new Date(registro.atualizadoEm).getTime() - new Date(registro.criadoEm).getTime() > 60_000;

  // Toda ação segue o mesmo caminho: chama, recarrega a lista, mostra o erro do servidor se houver.
  const agir = async (fn: () => Promise<unknown>, padrao: string) => {
    setOcupado(true); setErro("");
    try { await fn(); onMudou(); return true; }
    catch (e) { setErro(erroDe(e, padrao)); return false; }
    finally { setOcupado(false); }
  };

  const salvarTexto = async () => {
    if (await agir(() => api.patch(url, { conteudo: texto }), "Não foi possível salvar.")) setEditando(false);
  };
  const addItem = async () => {
    const t = novoItem.trim();
    if (!t) return;
    if (await agir(() => api.post(`${url}/itens`, { descricao: t }), "Não foi possível adicionar o item.")) setNovoItem("");
  };

  return (
    <div style={{ ...estiloCor(registro.cor), border:"1px solid", borderRadius:14, padding:"12px 14px", display:"flex", flexDirection:"column", gap:10, opacity:ocupado?0.7:1, transition:"opacity 0.15s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Avatar nome={registro.autor.nome} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color:meu?"var(--accent-violet)":"var(--text-primary)" }}>{meu ? "Você" : registro.autor.nome}</div>
          <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
            {quando(registro.criadoEm)}{editado && " · editado"}
          </div>
        </div>
      </div>

      {editando ? (
        <textarea autoFocus value={texto} onChange={e=>setTexto(e.target.value)} placeholder="O que você fez nesta tarefa?"
          style={{ width:"100%", background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", borderRadius:8, outline:"none", fontSize:13, color:"var(--text-primary)", resize:"vertical", minHeight:70, fontFamily:"var(--font-body)", lineHeight:1.6, padding:"8px 10px" }} />
      ) : registro.conteudo ? (
        <div onClick={meu ? () => setEditando(true) : undefined}
          style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word", cursor:meu?"text":"default" }}>
          {registro.conteudo}
        </div>
      ) : null}

      {(registro.itens.length > 0 || meu) && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {registro.itens.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Checkbox marcado={item.concluido} desabilitado={!meu || ocupado}
                onClick={() => agir(() => api.patch(`${url}/itens/${item.id}`, { concluido: !item.concluido }), "Não foi possível marcar o item.")} />
              <span style={{ flex:1, fontSize:13, color:item.concluido?"var(--text-muted)":"var(--text-primary)", textDecoration:item.concluido?"line-through":"none", wordBreak:"break-word" }}>{item.descricao}</span>
              {meu && (
                <button type="button" title="Tirar item" disabled={ocupado} onClick={() => agir(() => api.delete(`${url}/itens/${item.id}`), "Não foi possível tirar o item.")}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", display:"flex", padding:2 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          ))}
          {registro.itens.length > 0 && (
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{feitos}/{registro.itens.length} concluídos</div>
          )}
          {meu && (
            <div style={{ display:"flex", gap:6 }}>
              <input value={novoItem} onChange={e=>setNovoItem(e.target.value)} onKeyDown={e=>{ if (e.key==="Enter") { e.preventDefault(); addItem(); } }} placeholder="Novo item..." style={inputItem} />
              <button type="button" onClick={addItem} disabled={ocupado} style={btnMais}>+</button>
            </div>
          )}
        </div>
      )}

      {erro && <p style={{ fontSize:12, color:"var(--accent-red)", margin:0 }}>{erro}</p>}

      {(meu || podeApagar) && (
        <div style={{ display:"flex", alignItems:"center", gap:6, borderTop:"1px solid var(--border-subtle)", paddingTop:8 }}>
          {confirmar ? (
            <>
              <span style={{ fontSize:12, color:"var(--text-secondary)" }}>Apagar este registro?</span>
              <button type="button" className="btn btn-danger" style={{ fontSize:11, padding:"3px 10px" }} disabled={ocupado}
                onClick={() => agir(() => api.delete(url), "Não foi possível apagar o registro.")}>Apagar</button>
              <button type="button" className="btn btn-ghost" style={{ fontSize:11, padding:"3px 10px" }} onClick={() => setConfirmar(false)}>Não</button>
            </>
          ) : editando ? (
            <>
              <button type="button" className="btn btn-violet" style={{ fontSize:11, padding:"3px 10px" }} onClick={salvarTexto} disabled={ocupado}>Salvar</button>
              <button type="button" className="btn btn-ghost" style={{ fontSize:11, padding:"3px 10px" }} onClick={() => { setEditando(false); setTexto(registro.conteudo || ""); setErro(""); }}>Cancelar</button>
            </>
          ) : (
            <>
              {meu && (
                <button type="button" title="Editar texto" className="btn-icon" style={{ width:26, height:26 }} onClick={() => setEditando(true)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                </button>
              )}
              {podeApagar && (
                <button type="button" title="Apagar registro" className="btn-icon" style={{ width:26, height:26, color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }} onClick={() => setConfirmar(true)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              )}
              {meu && (
                <div style={{ marginLeft:"auto" }}>
                  <SeletorCor valor={registro.cor || ""} onChange={cor => agir(() => api.patch(url, { cor }), "Não foi possível trocar a cor.")} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Aba ───────────────────────────────────────────────────────────────── */

export default function TaskKeep({ projectId, taskId, onTotal }: { projectId: string; taskId: string; onTotal?: (total: number) => void }) {
  const { user: me } = useAuthStore();
  const base = `/projects/${projectId}/tasks/${taskId}/registros`;
  const [registros,    setRegistros]    = useState<Registro[]>([]);
  const [podeEscrever, setPodeEscrever] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [erro,         setErro]         = useState("");
  const [novo,         setNovo]         = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(base);
      const lista: Registro[] = Array.isArray(data?.registros) ? data.registros : [];
      setRegistros(lista);
      setPodeEscrever(!!data?.podeEscrever);
      setErro("");
      onTotal?.(lista.length);
    } catch (e) { setErro(erroDe(e, "Não foi possível carregar o Keep desta tarefa.")); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); load(); }, [taskId]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div>
        <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em" }}>KEEP DA TAREFA ({registros.length})</div>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>O que cada membro do projeto fez nesta tarefa.</div>
      </div>

      {podeEscrever && (novo ? (
        <NovoRegistro base={base} onCancelar={() => setNovo(false)} onSalvo={() => { setNovo(false); load(); }} />
      ) : (
        <div role="button" tabIndex={0} onClick={() => setNovo(true)} onKeyDown={e => { if (e.key === "Enter") setNovo(true); }}
          style={{ border:"1px solid var(--border-subtle)", borderRadius:14, padding:"11px 14px", cursor:"text", color:"var(--text-muted)", fontSize:13, background:"var(--bg-card)" }}>
          Registrar o que você fez...
        </div>
      ))}

      {!loading && !podeEscrever && !erro && (
        <div style={{ fontSize:12, color:"var(--text-muted)", background:"var(--bg-hover)", border:"1px dashed var(--border-subtle)", borderRadius:10, padding:"8px 12px" }}>
          Só quem faz parte do projeto registra aqui. Você pode ler os registros.
        </div>
      )}

      {erro && <p style={{ fontSize:12, color:"var(--accent-red)", margin:0 }}>{erro}</p>}

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:24, color:"var(--text-muted)" }}><Spin/></div>
      ) : registros.length === 0 ? (
        !erro && (
          <div style={{ textAlign:"center", padding:"20px 0", color:"var(--text-muted)", fontSize:13 }}>
            Nenhum registro ainda.
          </div>
        )
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {registros.map(r => {
            const meu = podeEscrever && r.autor.id === me?.id;
            return (
              <CartaoRegistro key={r.id + r.atualizadoEm} registro={r} base={base} meu={meu}
                podeApagar={meu || !!me?.isMaster} onMudou={load} />
            );
          })}
        </div>
      )}
    </div>
  );
}
