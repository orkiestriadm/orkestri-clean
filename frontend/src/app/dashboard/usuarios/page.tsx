"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

type Setor = { id: string; nome: string; cor: string; };
type User  = { id: string; nome: string; email: string; ativo: boolean; roles: string[]; isMaster: boolean; ultimoLogin?: string; criadoEm: string; cargo?: string; telefone?: string; setor?: Setor; modulos: string[]; };

const CORES_SETOR = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6","#94a3b8"];

function Spin() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}
function Avatar({ nome, size=36 }: { nome:string; size?:number }) {
  const i = nome.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase();
  return <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>{i}</div>;
}
function Field({ label, children }: any) {
  return <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>{label}</label>{children}</div>;
}
function Modal({ title, onClose, children, maxWidth=520 }: any) {
  return (
    <div className="modal-overlay" onClick={e=>{if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose();}}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700 }}>{title}</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// â"€â"€ Modal Setor â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function SetorModal({ setor, onClose, onSave }: { setor?: Setor; onClose: ()=>void; onSave: ()=>void }) {
  const [nome,    setNome]    = useState(setor?.nome||"");
  const [cor,     setCor]     = useState(setor?.cor||"#a78bfa");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const save = async () => {
    if (!nome.trim()) { setError("Nome obrigatorio"); return; }
    setLoading(true);
    try {
      if (setor) await api.put("/setores/"+setor.id, { nome, cor });
      else await api.post("/setores", { nome, cor });
      onSave(); onClose();
    } catch (e:any) { setError(e.response?.data?.message||"Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={setor?"Editar setor":"Novo setor"} onClose={onClose} maxWidth={400}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <Field label="NOME DO SETOR">
          <input className="input-o" placeholder="Ex: Tecnologia, Comercial..." value={nome} onChange={e=>setNome(e.target.value)} autoFocus />
        </Field>
        <Field label="COR">
          <div style={{ display:"flex", gap:8 }}>
            {CORES_SETOR.map(c=>(
              <button key={c} onClick={()=>setCor(c)} style={{ width:26, height:26, borderRadius:"50%", background:c, border:cor===c?"3px solid white":"3px solid transparent", cursor:"pointer", outline:"none", boxShadow:cor===c?`0 0 0 2px ${c}`:"none" }} />
            ))}
          </div>
        </Field>
        {error && <p style={{ color:"var(--accent-red)", fontSize:12 }}>{error}</p>}
        <div style={{ display:"flex", gap:10, marginTop:4 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>{loading?<Spin/>:setor?"Salvar":"Criar setor"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Configuracao dos modulos controlados ─────────────────────────────────────
const ALL_MODULOS = ["projetos","crm","keep","gantt","relatorios"];
const MODULOS_CFG = [
  { key:"projetos",  label:"Projetos",       desc:"Gerenciamento de projetos e tarefas",   cor:"#a78bfa" },
  { key:"crm",       label:"CRM",            desc:"Pipeline de negocios e clientes",       cor:"#f472b6" },
  { key:"keep",      label:"Keep",           desc:"Notas e anotacoes pessoais",             cor:"#22d3ee" },
  { key:"gantt",     label:"Linha do Tempo", desc:"Visualizacao Gantt dos projetos",        cor:"#34d399" },
  { key:"relatorios",label:"Relatorios",     desc:"Dashboards e relatorios analiticos",     cor:"#fbbf24" },
];
const ALWAYS_ON = [
  { label:"Visao Geral", desc:"Dashboard e resumo do sistema"     },
  { label:"Agenda",      desc:"Calendario de eventos e reunioes"  },
  { label:"WhatsApp",    desc:"Configuracao de alertas WhatsApp"  },
];

// ── Modal Novo/Editar Usuario (2 steps) ──────────────────────────────────────
function UserModal({ user, setores, onClose, onSave }: { user?: User; setores: Setor[]; onClose:()=>void; onSave:()=>void }) {
  const [step,     setStep]    = useState(1);
  const [nome,     setNome]    = useState(user?.nome||"");
  const [email,    setEmail]   = useState(user?.email||"");
  const [senha,    setSenha]   = useState("");
  const [cargo,    setCargo]   = useState(user?.cargo||"");
  const [telefone, setTelefone]= useState(user?.telefone||"");
  const [setorId,  setSetorId] = useState(user?.setor?.id||"");
  const [modulos,  setModulos] = useState<string[]>(user?.modulos?.length ? user.modulos : [...ALL_MODULOS]);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const isEdit = !!user;

  const toggleModulo = (key:string) =>
    setModulos(prev => prev.includes(key) ? prev.filter(m=>m!==key) : [...prev, key]);

  const goNext = () => {
    if (!nome.trim()||!email.trim()) { setError("Nome e e-mail obrigatorios"); return; }
    if (!isEdit && senha.length < 6) { setError("Senha deve ter minimo 6 caracteres"); return; }
    setError(""); setStep(2);
  };

  const save = async () => {
    setLoading(true); setError("");
    try {
      if (isEdit) {
        await api.put("/users/"+user.id, { nome, email, cargo, telefone, setorId:setorId||undefined });
        await api.patch("/users/"+user.id+"/modulos", { modulos });
      } else {
        await api.post("/users", { nome, email, senha, cargo, telefone, setorId:setorId||undefined, modulos });
      }
      onSave(); onClose();
    } catch(e:any) { setError(e.response?.data?.message||"Erro ao salvar"); setStep(1); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={isEdit?"Editar usuario":"Novo usuario"} onClose={onClose} maxWidth={540}>
      {/* Indicador de progresso */}
      <div style={{ display:"flex", gap:6, marginBottom:20 }}>
        {[1,2].map(s=>(
          <div key={s} style={{ flex:1, height:3, borderRadius:2, background:step>=s?"var(--accent-violet)":"var(--border-subtle)", transition:"background 0.2s" }} />
        ))}
      </div>
      <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em", marginBottom:18 }}>
        {step===1 ? "PASSO 1 DE 2 — DADOS DO USUARIO" : "PASSO 2 DE 2 — MODULOS DE ACESSO"}
      </div>

      {step===1 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="NOME COMPLETO">
                <input className="input-o" placeholder="Joao Silva" value={nome} onChange={e=>setNome(e.target.value)} autoFocus />
              </Field>
            </div>
            <Field label="E-MAIL">
              <input className="input-o" type="email" placeholder="joao@empresa.com" value={email} onChange={e=>setEmail(e.target.value)} />
            </Field>
            {!isEdit && (
              <Field label="SENHA INICIAL">
                <input className="input-o" type="password" placeholder="Minimo 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} />
              </Field>
            )}
            <Field label="CARGO / FUNCAO">
              <input className="input-o" placeholder="Ex: Analista, Gerente..." value={cargo} onChange={e=>setCargo(e.target.value)} />
            </Field>
            <Field label="TELEFONE">
              <input className="input-o" placeholder="(11) 99999-9999" value={telefone} onChange={e=>setTelefone(e.target.value)} />
            </Field>
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="SETOR">
                <select className="input-o" value={setorId} onChange={e=>setSetorId(e.target.value)}>
                  <option value="">Sem setor</option>
                  {setores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </Field>
            </div>
          </div>
          {error && <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"10px 14px", color:"var(--accent-red)", fontSize:12 }}>{error}</div>}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={goNext}>
              Proximo — Modulos →
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Modulos sempre ativos */}
          <div>
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em", marginBottom:8 }}>SEMPRE HABILITADOS</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {ALWAYS_ON.map(m=>(
                <div key={m.label} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 12px", background:"rgba(34,211,238,0.04)", border:"1px solid rgba(34,211,238,0.15)", borderRadius:8 }}>
                  <div style={{ width:16, height:16, borderRadius:3, background:"rgba(34,211,238,0.2)", border:"1px solid rgba(34,211,238,0.4)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:12, fontWeight:500, color:"var(--text-primary)" }}>{m.label}</span>
                    <span style={{ fontSize:11, color:"var(--text-muted)", marginLeft:8 }}>{m.desc}</span>
                  </div>
                  <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"#22d3ee", letterSpacing:"0.08em" }}>FIXO</span>
                </div>
              ))}
            </div>
          </div>

          {/* Modulos controlados */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em" }}>MODULOS OPCIONAIS</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setModulos([...ALL_MODULOS])} style={{ fontSize:10, color:"var(--accent-violet)", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font-mono)" }}>marcar todos</button>
                <button onClick={()=>setModulos([])} style={{ fontSize:10, color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer", fontFamily:"var(--font-mono)" }}>limpar</button>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {MODULOS_CFG.map(m=>{
                const on = modulos.includes(m.key);
                return (
                  <button key={m.key} onClick={()=>toggleModulo(m.key)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:on?"var(--accent-violet-dim)":"var(--bg-hover)", border:`1px solid ${on?"rgba(124,58,237,0.35)":"var(--border-subtle)"}`, borderRadius:8, cursor:"pointer", textAlign:"left", transition:"all 0.15s", width:"100%" }}>
                    <div style={{ width:18, height:18, borderRadius:4, background:on?"var(--accent-violet)":"transparent", border:`2px solid ${on?"var(--accent-violet)":"var(--border-subtle)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                      {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:on?"var(--text-primary)":"var(--text-secondary)" }}>{m.label}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{m.desc}</div>
                    </div>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:on?m.cor:"var(--border-subtle)", flexShrink:0, transition:"background 0.15s" }} />
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"10px 14px", color:"var(--accent-red)", fontSize:12 }}>{error}</div>}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setStep(1)}>← Voltar</button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>
              {loading?<Spin/>:isEdit?"Salvar alteracoes":"Criar usuario"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ResetPwdModal({ user, onClose }: { user: User; onClose: ()=>void }) {
  const [senha,   setSenha]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [ok,      setOk]      = useState(false);

  const save = async () => {
    if (senha.length < 6) { setError("Minimo 6 caracteres"); return; }
    if (senha !== confirm) { setError("Senhas nao conferem"); return; }
    setLoading(true);
    try { await api.patch("/users/"+user.id+"/password", { novaSenha: senha }); setOk(true); setTimeout(onClose, 1800); }
    catch (e:any) { setError(e.response?.data?.message||"Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Resetar senha" onClose={onClose} maxWidth={400}>
      {ok ? (
        <div style={{ textAlign:"center", padding:"24px 0", color:"var(--accent-green)" }}>Senha alterada com sucesso!</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:8, padding:"10px 14px", fontSize:13, color:"var(--text-secondary)" }}>
            Alterando senha de <strong>{user.nome}</strong>
          </div>
          <Field label="NOVA SENHA"><input className="input-o" type="password" value={senha} onChange={e=>setSenha(e.target.value)} autoFocus /></Field>
          <Field label="CONFIRMAR"><input className="input-o" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} /></Field>
          {error && <p style={{ color:"var(--accent-red)", fontSize:12 }}>{error}</p>}
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>{loading?<Spin/>:"Resetar senha"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }: any) {
  const [loading, setLoading] = useState(false);
  return (
    <Modal title={title} onClose={onClose} maxWidth={400}>
      <p style={{ color:"var(--text-secondary)", fontSize:13, marginBottom:24, lineHeight:1.6 }}>{message}</p>
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
        <button className={`btn ${danger?"btn-danger":"btn-violet"}`} style={{ flex:2 }} disabled={loading}
          onClick={async()=>{ setLoading(true); await onConfirm(); setLoading(false); onClose(); }}>
          {loading?<Spin/>:confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default function UsuariosPage() {
  const { user: me } = useAuthStore();
  const [users,        setUsers]        = useState<User[]>([]);
  const [setores,      setSetores]      = useState<Setor[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filter,       setFilter]       = useState<"todos"|"ativos"|"inativos">("ativos");
  const [tab,          setTab]          = useState<"usuarios"|"setores">("usuarios");
  const [modalNew,     setModalNew]     = useState(false);
  const [modalEdit,    setModalEdit]    = useState<User|null>(null);
  const [modalPwd,     setModalPwd]     = useState<User|null>(null);
  const [modalToggle,  setModalToggle]  = useState<User|null>(null);
  const [modalDelete,  setModalDelete]  = useState<User|null>(null);
  const [modalSetor,   setModalSetor]   = useState<Setor|"novo"|null>(null);
  const [deleteSetorId,setDeleteSetorId]= useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        api.get("/users", { params: { incluirMaster: "true" } }),
        api.get("/setores"),
      ]);
      setUsers(uRes.data);
      setSetores(sRes.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    const ms = u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const mf = filter==="todos" ? true : filter==="ativos" ? u.ativo : !u.ativo;
    return ms && mf;
  });

  const stats = { total: users.length, ativos: users.filter(u=>u.ativo).length, masters: users.filter(u=>u.isMaster).length };

  if (!me?.isMaster) return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar />
      <div className="empty-state" style={{ marginTop:80 }}><p style={{ color:"var(--text-muted)" }}>Acesso restrito a masters</p></div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>tab==="usuarios"?setModalNew(true):setModalSetor("novo")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          {tab==="usuarios" ? "Novo usuario" : "Novo setor"}
        </button>
      </Topbar>

      {/* Tabs */}
      <div style={{ display:"flex", padding:"0 24px", borderBottom:"1px solid var(--border-subtle)" }}>
        {[{key:"usuarios",label:"Usuarios"},{key:"setores",label:"Setores"}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)} style={{ padding:"12px 18px", background:"none", border:"none", borderBottom:tab===t.key?"2px solid var(--accent-violet)":"2px solid transparent", color:tab===t.key?"var(--accent-violet)":"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-display)", fontSize:13, fontWeight:tab===t.key?600:400, marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:20 }}>

        {/* ABA USUARIOS */}
        {tab === "usuarios" && (
          <>
            <div className="animate-up" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              {[{label:"TOTAL",value:stats.total,color:"var(--accent-violet)"},{label:"ATIVOS",value:stats.ativos,color:"var(--accent-green)"},{label:"MASTERS",value:stats.masters,color:"var(--accent-cyan)"}].map(s=>(
                <div key={s.label} className="card" style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:16 }}>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", letterSpacing:"0.08em", color:"var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="animate-up" style={{ display:"flex", gap:10, alignItems:"center" }}>
              <input className="input-o" placeholder="Buscar por nome ou e-mail..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, maxWidth:320 }} />
              <div style={{ display:"flex", gap:4 }}>
                {(["todos","ativos","inativos"] as const).map(f=>(
                  <button key={f} onClick={()=>setFilter(f)} className={`btn ${filter===f?"btn-violet":"btn-ghost"}`} style={{ padding:"6px 14px", fontSize:12 }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
                ))}
              </div>
              <button className="btn-icon" onClick={load} title="Atualizar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="animate-up card">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:16, padding:"10px 20px", borderBottom:"1px solid var(--border-subtle)" }}>
                {["USUARIO","DETALHES","MODULOS","ACOES"].map(h=><span key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", letterSpacing:"0.08em", color:"var(--text-muted)" }}>{h}</span>)}
              </div>
              {loading ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:13 }}>Carregando...</span></div>
              ) : filtered.length === 0 ? (
                <div className="empty-state"><p style={{ color:"var(--text-secondary)", fontWeight:500 }}>{search?"Nenhum usuario encontrado":"Nenhum usuario cadastrado"}</p></div>
              ) : filtered.map((u,i)=>{
                const isMe = u.id===me?.id;
                return (
                  <div key={u.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:16, padding:"14px 20px", borderBottom:i<filtered.length-1?"1px solid var(--border-subtle)":"none", alignItems:"center", opacity:u.ativo?1:0.5, transition:"background 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
                      <Avatar nome={u.nome} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.nome}</span>
                          {isMe && <span style={{ fontSize:10, color:"var(--accent-violet)", fontFamily:"var(--font-mono)" }}>voce</span>}
                        </div>
                        <span style={{ fontSize:11, color:"var(--text-muted)" }}>{u.email}</span>
                      </div>
                    </div>
                    <div style={{ minWidth:0 }}>
                      {u.cargo && <div style={{ fontSize:12, color:"var(--text-secondary)", marginBottom:2 }}>{u.cargo}</div>}
                      {u.setor && (
                        <span className="badge" style={{ fontSize:10, background:u.setor.cor+"15", color:u.setor.cor, border:`1px solid ${u.setor.cor}30` }}>{u.setor.nome}</span>
                      )}
                      {u.telefone && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{u.telefone}</div>}
                      {!u.cargo && !u.setor && !u.telefone && <span style={{ fontSize:11, color:"var(--text-muted)" }}>sem detalhes</span>}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:3, maxWidth:140 }}>
                        {u.isMaster ? (
                          <span className="badge badge-violet" style={{ fontSize:9 }}>TODOS OS MODULOS</span>
                        ) : u.modulos.length === 0 ? (
                          <span style={{ fontSize:11, color:"var(--text-muted)" }}>nenhum</span>
                        ) : (
                          MODULOS_CFG.filter(m=>u.modulos.includes(m.key)).map(m=>(
                            <span key={m.key} className="badge" style={{ fontSize:9, background:m.cor+"18", color:m.cor, border:`1px solid ${m.cor}30` }}>{m.label}</span>
                          ))
                        )}
                      </div>
                      <span className={`badge ${u.ativo?"badge-green":"badge-red"}`} style={{ fontSize:10 }}>{u.ativo?"ATIVO":"INATIVO"}</span>
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      <button className="btn-icon" title="Editar" onClick={()=>setModalEdit(u)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button className="btn-icon" title="Resetar senha" onClick={()=>setModalPwd(u)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
                      </button>
                      {!isMe && (
                        <button className="btn-icon" title={u.ativo?"Desativar":"Ativar"} onClick={()=>setModalToggle(u)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" strokeLinecap="round"/></svg>
                        </button>
                      )}
                      {!isMe && (
                        <button className="btn-icon" title="Remover" onClick={()=>setModalDelete(u)} style={{ color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ABA SETORES */}
        {tab === "setores" && (
          <div style={{ maxWidth:600 }}>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16 }}>
              Setores sao usados para organizar os usuarios da empresa. Cada usuario pode pertencer a um setor.
            </p>
            {setores.length === 0 ? (
              <div className="empty-state card" style={{ padding:40 }}>
                <p style={{ color:"var(--text-secondary)", fontWeight:500 }}>Nenhum setor cadastrado</p>
                <button className="btn btn-violet" onClick={()=>setModalSetor("novo")}>Criar primeiro setor</button>
              </div>
            ) : (
              <div className="card">
                {setores.map((s,i)=>(
                  <div key={s.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:i<setores.length-1?"1px solid var(--border-subtle)":"none", transition:"background 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    <div style={{ width:32, height:32, borderRadius:8, background:s.cor+"20", border:`1px solid ${s.cor}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <div style={{ width:12, height:12, borderRadius:"50%", background:s.cor }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)" }}>{s.nome}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                        {users.filter(u=>u.setor?.id===s.id).length} usuario{users.filter(u=>u.setor?.id===s.id).length!==1?"s":""}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="btn-icon" onClick={()=>setModalSetor(s)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button className="btn-icon" style={{ color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }} onClick={()=>setDeleteSetorId(s.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      {modalNew && <UserModal setores={setores} onClose={()=>setModalNew(false)} onSave={load} />}
      {modalEdit && <UserModal user={modalEdit} setores={setores} onClose={()=>setModalEdit(null)} onSave={load} />}
      {modalPwd && <ResetPwdModal user={modalPwd} onClose={()=>setModalPwd(null)} />}
      {modalToggle && <ConfirmModal title={modalToggle.ativo?"Desativar usuario":"Ativar usuario"} message={modalToggle.ativo?`${modalToggle.nome} perdera acesso ao sistema.`:`${modalToggle.nome} voltara a ter acesso.`} confirmLabel={modalToggle.ativo?"Desativar":"Ativar"} danger={modalToggle.ativo} onConfirm={async()=>{ await api.patch("/users/"+modalToggle.id+"/toggle"); await load(); }} onClose={()=>setModalToggle(null)} />}
      {modalDelete && <ConfirmModal title="Remover usuario" message={`Tem certeza que deseja remover ${modalDelete.nome}?`} confirmLabel="Remover permanentemente" danger onConfirm={async()=>{ await api.delete("/users/"+modalDelete.id); await load(); }} onClose={()=>setModalDelete(null)} />}
      {modalSetor && <SetorModal setor={modalSetor==="novo"?undefined:modalSetor as Setor} onClose={()=>setModalSetor(null)} onSave={load} />}
      {deleteSetorId && <ConfirmModal title="Remover setor" message="Tem certeza? Os usuarios deste setor ficarao sem setor." confirmLabel="Remover" danger onConfirm={async()=>{ await api.delete("/setores/"+deleteSetorId); await load(); }} onClose={()=>setDeleteSetorId(null)} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}