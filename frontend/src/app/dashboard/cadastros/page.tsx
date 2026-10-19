"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Setor   = { id: string; nome: string; cor?: string; descricao?: string; parentId?: string; responsavelId?: string; responsavel?: { id: string; nome: string } | null; _count?: { users: number }; filhos?: Setor[]; };
type User    = { id: string; nome: string; email: string; ativo: boolean; roles: string[]; isMaster: boolean; ultimoLogin?: string; criadoEm: string; cargo?: string; telefone?: string; setor?: Setor; modulos: string[]; };
type Permission = { id: string; recurso: string; acao: string; descricao?: string; };
type Role    = { id: string; nome: string; descricao?: string; isMaster: boolean; nivel: number; _count?: { userRoles: number }; rolePermissions?: { permission: Permission }[]; };
type Solicitacao = { id: string; nome: string; email: string; whatsapp?: string; cargo?: string; departamento?: string; empresa?: string; motivacao?: string; produtos?: string[]; status: string; criado_em: string; };
type Trial = { id: string; nome: string; email: string; whatsapp?: string | null; produto?: string | null; trialExpiraEm?: string | null; avisado?: boolean; criadoEm?: string; };
type OrgItem = {
  id: string; nome: string; slug: string; plano: string; ativo: boolean;
  statusOperacional?: string | null; statusComercial?: string | null;
  cnpj?: string | null; nomeFantasia?: string | null; segmento?: string | null; site?: string | null;
  emailContato?: string | null; telefone?: string | null; responsavelNome?: string | null;
  cep?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null;
  observacoes?: string | null;
  usuarios: number; criadoEm: string;
};

// ── Constantes ────────────────────────────────────────────────────────────────
const CORES_SETOR  = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6","#94a3b8"];

// ── Componentes base ──────────────────────────────────────────────────────────
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
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose} maxWidth={400}>
      <p style={{ color:"var(--text-secondary)", fontSize:13, marginBottom:24, lineHeight:1.6 }}>{message}</p>
      {error && <p style={{ color:"var(--danger)", fontSize:12, marginBottom:12, textAlign:"center" }}>{error}</p>}
      <div style={{ display:"flex", gap:10 }}>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
        <button className={`btn ${danger?"btn-danger":"btn-violet"}`} style={{ flex:2 }} disabled={loading}
          onClick={async()=>{ setLoading(true); setError(""); try { await onConfirm(); onClose(); } catch(e:any) { setError(e?.response?.data?.message || "Erro ao executar operação"); } finally { setLoading(false); } }}>
          {loading?<Spin/>:confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ── Modal Setor ───────────────────────────────────────────────────────────────
function SetorModal({ setor, setores, users, onClose, onSave }: { setor?: Setor; setores: Setor[]; users: User[]; onClose:()=>void; onSave:()=>void }) {
  const [nome,         setNome]         = useState(setor?.nome||"");
  const [descricao,    setDescricao]    = useState(setor?.descricao||"");
  const [cor,          setCor]          = useState(setor?.cor||"#a78bfa");
  const [parentId,     setParentId]     = useState(setor?.parentId||"");
  const [responsavelId,setResponsavelId]= useState(setor?.responsavelId||"");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Setores disponíveis como pai (excluindo o próprio e seus filhos)
  const parentOptions = setores.filter(s => s.id !== setor?.id);

  const save = async () => {
    if (!nome.trim()) { setError("Nome obrigatorio"); return; }
    setLoading(true);
    try {
      const payload = {
        nome,
        descricao: descricao || undefined,
        cor,
        parentId: parentId || undefined,
        responsavelId: responsavelId || undefined,
      };
      if (setor) await api.put("/setores/"+setor.id, payload);
      else       await api.post("/setores", payload);
      onSave(); onClose();
    } catch (e:any) { setError(e.response?.data?.message||"Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={setor?"Editar setor":"Novo setor"} onClose={onClose} maxWidth={460}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <Field label="NOME DO SETOR">
          <input className="input-o" placeholder="Ex: Tecnologia, Comercial..." value={nome} onChange={e=>setNome(e.target.value)} autoFocus />
        </Field>
        <Field label="DESCRICAO (OPCIONAL)">
          <input className="input-o" placeholder="Breve descrição do setor..." value={descricao} onChange={e=>setDescricao(e.target.value)} />
        </Field>
        <Field label="SETOR PAI (HIERARQUIA)">
          <select className="input-o" value={parentId} onChange={e=>setParentId(e.target.value)}>
            <option value="">Nenhum — setor raiz</option>
            {parentOptions.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
        <Field label="RESPONSAVEL">
          <select className="input-o" value={responsavelId} onChange={e=>setResponsavelId(e.target.value)}>
            <option value="">Nenhum responsável definido</option>
            {users.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Field>
        <Field label="COR">
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
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

// ── Modal Usuario (2 steps) ───────────────────────────────────────────────────
function UserModal({ user, setores, roles, onClose, onSave }: { user?: User; setores: Setor[]; roles: Role[]; onClose:()=>void; onSave:()=>void }) {
  const me = useAuthStore(s => s.user);
  const [step,     setStep]    = useState(1);
  const [nome,     setNome]    = useState(user?.nome||"");
  const [email,    setEmail]   = useState(user?.email||"");
  const [senha,    setSenha]   = useState("");
  const [cargo,    setCargo]   = useState(user?.cargo||"");
  const [telefone, setTelefone]= useState(user?.telefone||"");
  const [setorId,  setSetorId] = useState(user?.setor?.id||"");
  const [roleId,   setRoleId]  = useState<string>("");
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const isEdit = !!user;

  // Papéis atuais na edição. Plural de propósito: o modelo é N:N e compor
  // papéis é o que evita promover alguém a administrador só porque ele precisa
  // de duas áreas.
  const [roleIds, setRoleIds] = useState<string[]>([]);
  useEffect(() => {
    if (isEdit && user) {
      api.get("/rbac/users/"+user.id+"/roles").then(res => {
        const atuais = (res.data||[]).filter((ur:any)=>!ur.role?.isMaster).map((ur:any)=>ur.roleId);
        setRoleIds(atuais);
        if (atuais[0]) setRoleId(atuais[0]);
      }).catch(()=>{});
    }
  }, [isEdit, user]);

  function alternarPapel(id: string) {
    setRoleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const goNext = () => {
    if (!nome.trim()||!email.trim()) { setError("Nome e e-mail obrigatorios"); return; }
    if (!isEdit && senha.length < 6) { setError("Senha deve ter minimo 6 caracteres"); return; }
    setError(""); setStep(2);
  };

  const save = async () => {
    setLoading(true); setError("");
    try {
      let userId = user?.id;
      if (isEdit) {
        await api.put("/users/"+user!.id, { nome, email, cargo, telefone, setorId:setorId||undefined });
      } else {
        const res = await api.post("/users", { nome, email, senha, cargo, telefone, setorId:setorId||undefined, modulos:[] });
        userId = res.data.id;
      }
      // Grava a DIFERENÇA em vez de apagar tudo e regravar: assim um papel que
      // permanece não perde e reganha acesso no meio do caminho, e o master
      // nunca é tocado.
      if (userId) {
        const rolesRes = await api.get("/rbac/users/"+userId+"/roles");
        const atuais = (rolesRes.data||[]).filter((ur:any)=>!ur.role?.isMaster).map((ur:any)=>ur.roleId);
        const desejados = roleIds.length ? roleIds : (roleId ? [roleId] : []);
        for (const id of atuais.filter((x:string)=>!desejados.includes(x))) {
          await api.delete("/rbac/users/"+userId+"/roles/"+id).catch(()=>{});
        }
        for (const id of desejados.filter((x:string)=>!atuais.includes(x))) {
          await api.post("/rbac/users/"+userId+"/roles", { roleId: id }).catch(()=>{});
        }
      }
      onSave(); onClose();
    } catch(e:any) { setError(e.response?.data?.message||"Erro ao salvar"); setStep(1); }
    finally { setLoading(false); }
  };

  // Papéis disponíveis: oculta 'master' e 'administrador' para não-SA
  const availableRoles = roles.filter(r => {
    if (r.isMaster) return false;
    if (r.nome === "administrador" && !me?.isMaster) return false;
    return true;
  });

  const selectedRole = roles.find(r => r.id === roleId);

  // Agrupa permissões do papel selecionado por recurso
  const permsByRecurso: Record<string, string[]> = {};
  if (selectedRole?.rolePermissions) {
    selectedRole.rolePermissions.forEach(rp => {
      if (!permsByRecurso[rp.permission.recurso]) permsByRecurso[rp.permission.recurso] = [];
      permsByRecurso[rp.permission.recurso].push(rp.permission.acao);
    });
  }

  const nivelColor = (r: Role) => r.nivel >= 80 ? "#f59e0b" : r.nivel >= 50 ? "#22d3ee" : r.nivel >= 20 ? "#34d399" : "var(--text-muted)";

  return (
    <Modal title={isEdit?"Editar usuario":"Novo usuario"} onClose={onClose} maxWidth={560}>
      {/* Barra de progresso */}
      <div style={{ display:"flex", gap:6, marginBottom:20 }}>
        {[1,2].map(s=>(
          <div key={s} style={{ flex:1, height:3, borderRadius:2, background:step>=s?"var(--accent-violet)":"var(--border-subtle)", transition:"background 0.2s" }} />
        ))}
      </div>
      <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em", marginBottom:18 }}>
        {step===1?"PASSO 1 DE 2 — DADOS DO USUARIO":"PASSO 2 DE 2 — PAPEL DE ACESSO"}
      </div>

      {/* ── Passo 1: dados ── */}
      {step===1 && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <Field label="NOME COMPLETO"><input className="input-o" placeholder="Joao Silva" value={nome} onChange={e=>setNome(e.target.value)} autoFocus /></Field>
            </div>
            <Field label="E-MAIL"><input className="input-o" type="email" placeholder="joao@empresa.com" value={email} onChange={e=>setEmail(e.target.value)} /></Field>
            {!isEdit && <Field label="SENHA INICIAL"><input className="input-o" type="password" placeholder="Minimo 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} /></Field>}
            <Field label="CARGO / FUNCAO"><input className="input-o" placeholder="Ex: Analista..." value={cargo} onChange={e=>setCargo(e.target.value)} /></Field>
            <Field label="TELEFONE"><input className="input-o" placeholder="(11) 99999-9999" value={telefone} onChange={e=>setTelefone(e.target.value)} /></Field>
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
            <button className="btn btn-violet" style={{ flex:2 }} onClick={goNext}>Proximo — Papel →</button>
          </div>
        </div>
      )}

      {/* ── Passo 2: papel ── */}
      {step===2 && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Permissões base fixas */}
          <div style={{ padding:"10px 14px", background:"rgba(34,211,238,0.04)", border:"1px solid rgba(34,211,238,0.15)", borderRadius:8, display:"flex", alignItems:"center", gap:10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
            <div>
              <span style={{ fontSize:12, fontWeight:500, color:"#22d3ee" }}>Permissoes base (fixas para todos)</span>
              <span style={{ fontSize:11, color:"var(--text-muted)", marginLeft:8 }}>Agenda completa · WhatsApp</span>
            </div>
            <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"#22d3ee", marginLeft:"auto" }}>SEMPRE ATIVO</span>
          </div>

          {/* Seleção de papel */}
          <div>
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em", marginBottom:10 }}>PAPEIS (PODE MARCAR MAIS DE UM)</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {availableRoles.map(r => {
                const sel = roleIds.includes(r.id);
                const cor = nivelColor(r);
                return (
                  <button key={r.id} onClick={()=>{ alternarPapel(r.id); setRoleId(r.id); }}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:sel?"var(--accent-violet-dim)":"var(--bg-hover)", border:`1px solid ${sel?"rgba(124,58,237,0.4)":"var(--border-subtle)"}`, borderRadius:8, cursor:"pointer", textAlign:"left", transition:"all 0.15s", width:"100%" }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:cor+"18", border:`1px solid ${cor}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:cor, fontFamily:"var(--font-mono)" }}>{r.nivel}</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:sel?"var(--text-primary)":"var(--text-secondary)", textTransform:"capitalize" }}>{r.nome}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{r.descricao}</div>
                    </div>
                    <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${sel?"var(--accent-violet)":"var(--border-subtle)"}`, background:sel?"var(--accent-violet)":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                      {sel && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </button>
                );
              })}
              <button onClick={()=>{ setRoleIds([]); setRoleId(""); }}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:roleId===""?"var(--bg-hover)":"transparent", border:`1px solid ${roleId===""?"var(--border-subtle)":"transparent"}`, borderRadius:8, cursor:"pointer", textAlign:"left", transition:"all 0.15s", width:"100%" }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"rgba(100,116,139,0.1)", border:"1px solid rgba(100,116,139,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:10, fontWeight:800, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>—</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"var(--text-muted)" }}>Sem papel definido</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>Apenas permissoes base (agenda + whatsapp)</div>
                </div>
              </button>
            </div>
          </div>

          {/* Preview das permissões do papel selecionado */}
          {selectedRole && Object.keys(permsByRecurso).length > 0 && (
            <div style={{ background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", marginBottom:10, textTransform:"uppercase" }}>
                Permissoes do papel — {selectedRole.nome}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
                {Object.entries(permsByRecurso).map(([recurso, acoes]) => (
                  <div key={recurso}>
                    <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:4, textTransform:"uppercase" }}>{recurso}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                      {acoes.map(a => (
                        <span key={a} style={{ fontSize:10, fontFamily:"var(--font-mono)", background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:4, padding:"1px 6px", color:"var(--accent-violet)" }}>{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"10px 14px", color:"var(--accent-red)", fontSize:12 }}>{error}</div>}
          <div style={{ display:"flex", gap:10 }}>
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

// ── Modal Reset Senha ─────────────────────────────────────────────────────────
function ResetPwdModal({ user, onClose }: { user: User; onClose:()=>void }) {
  const [senha, setSenha]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [ok,      setOk]      = useState(false);
  const save = async () => {
    if (senha.length < 6) { setError("Minimo 6 caracteres"); return; }
    if (senha !== confirm)  { setError("Senhas nao conferem"); return; }
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


// ── Pagina Cadastros ──────────────────────────────────────────────────────────
// ── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ roleName, roles }: { roleName?: string; roles: Role[] }) {
  if (!roleName) return <span style={{ fontSize:11, color:"var(--text-muted)" }}>sem papel</span>;
  const role = roles.find(r => r.nome === roleName);
  const nivel = role?.nivel ?? 0;
  const cor = roleName === "master" ? "var(--accent-violet)" :
    nivel >= 80 ? "#f59e0b" : nivel >= 50 ? "#22d3ee" : nivel >= 20 ? "#34d399" : "var(--text-muted)";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, fontFamily:"var(--font-mono)", color:cor, background:cor+"18", border:`1px solid ${cor}35`, borderRadius:6, padding:"2px 8px", textTransform:"capitalize" }}>
      {roleName}
    </span>
  );
}

// ── Modal Permissões Individuais ──────────────────────────────────────────────
function UserPermissionsModal({ user, allPerms, onClose }: { user: User; allPerms: Permission[]; onClose:()=>void }) {
  const [overrides,   setOverrides]   = useState<{id:string; permissionId:string; conceder:boolean; permission:{recurso:string;acao:string}}[]>([]);
  const [effective,   setEffective]   = useState<string[]>([]);
  const [saving,      setSaving]      = useState<string|null>(null);
  const [loading,     setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, effRes] = await Promise.all([
        api.get("/rbac/users/"+user.id+"/overrides"),
        api.get("/rbac/users/"+user.id+"/effective"),
      ]);
      setOverrides(ovRes.data);
      setEffective(effRes.data.permissions || []);
    } catch {} finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const toggleOverride = async (permId: string, recurso: string, acao: string) => {
    const key = `${recurso}:${acao}`;
    const existing = overrides.find(o => o.permissionId === permId);
    setSaving(permId);
    try {
      if (existing) {
        // Alterna entre conceder/revogar ou remove se já estava revogando
        if (existing.conceder) {
          await api.post("/rbac/users/"+user.id+"/overrides", { permissionId: permId, conceder: false });
        } else {
          await api.delete("/rbac/users/"+user.id+"/overrides/"+permId);
        }
      } else {
        // Cria override: se está efetivo, revoga; se não está, concede
        const isEffective = effective.includes("*") || effective.includes(key);
        await api.post("/rbac/users/"+user.id+"/overrides", { permissionId: permId, conceder: !isEffective });
      }
      await load();
    } catch {} finally { setSaving(null); }
  };

  const removeOverride = async (permId: string) => {
    setSaving(permId);
    try {
      await api.delete("/rbac/users/"+user.id+"/overrides/"+permId);
      await load();
    } catch {} finally { setSaving(null); }
  };

  const recursos = [...new Set(allPerms.map(p => p.recurso))].sort();
  const overrideMap = Object.fromEntries(overrides.map(o => [o.permissionId, o]));
  const isAllAccess = effective.includes("*");

  return (
    <Modal title={`Permissões — ${user.nome}`} onClose={onClose} maxWidth={620}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* Cabeçalho com info do papel */}
        <div style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 16px", background:"var(--bg-hover)", borderRadius:8, border:"1px solid var(--border-subtle)" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:500, color:"var(--text-primary)" }}>{user.nome}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>
              Papel: <strong style={{ textTransform:"capitalize" }}>{user.roles?.[0] || "sem papel"}</strong>
              {" · "}{overrides.length > 0 ? `${overrides.length} override${overrides.length!==1?"s":""}` : "sem overrides"}
            </div>
          </div>
          {overrides.length > 0 && (
            <button className="btn" style={{ fontSize:11 }} onClick={async()=>{ for(const o of overrides) await api.delete("/rbac/users/"+user.id+"/overrides/"+o.permissionId).catch(()=>{}); await load(); }}>
              Limpar overrides
            </button>
          )}
        </div>

        <div style={{ fontSize:11, color:"var(--text-muted)" }}>
          Clique em uma permissao para <strong style={{ color:"var(--accent-green)" }}>conceder</strong> ou <strong style={{ color:"var(--accent-red)" }}>revogar</strong> individualmente, sobrescrevendo o papel.
        </div>

        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:32 }}><Spin/></div>
        ) : isAllAccess ? (
          <div style={{ padding:"14px 16px", background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:8, fontSize:12, color:"var(--accent-violet)" }}>
            Este usuário tem acesso irrestrito. Overrides não se aplicam a contas master.
          </div>
        ) : (
          <div style={{ maxHeight:400, overflowY:"auto", display:"flex", flexDirection:"column", gap:16 }}>
            {recursos.map(recurso => {
              const permsDoRecurso = allPerms.filter(p => p.recurso === recurso);
              return (
                <div key={recurso}>
                  <div style={{ fontSize:10, fontFamily:"var(--font-mono)", fontWeight:700, textTransform:"uppercase", color:"var(--text-secondary)", letterSpacing:".08em", marginBottom:6 }}>{recurso}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {permsDoRecurso.map(p => {
                      const key = `${p.recurso}:${p.acao}`;
                      const ov = overrideMap[p.id];
                      const isActive = effective.includes(key);
                      const isSaving = saving === p.id;
                      let bg, border, color, label;
                      if (ov?.conceder === true) {
                        bg="rgba(34,197,94,0.12)"; border="rgba(34,197,94,0.4)"; color="#22c55e"; label="+ concedido";
                      } else if (ov?.conceder === false) {
                        bg="rgba(239,68,68,0.12)"; border="rgba(239,68,68,0.4)"; color="#ef4444"; label="- revogado";
                      } else if (isActive) {
                        bg="rgba(124,58,237,0.08)"; border="rgba(124,58,237,0.25)"; color="var(--accent-violet)"; label="";
                      } else {
                        bg="var(--bg-hover)"; border="var(--border-subtle)"; color="var(--text-muted)"; label="";
                      }
                      return (
                        <div key={p.id} style={{ display:"flex", alignItems:"center", gap:0, background:bg, border:`1px solid ${border}`, borderRadius:6, overflow:"hidden" }}>
                          <button
                            onClick={()=>toggleOverride(p.id, p.recurso, p.acao)}
                            disabled={!!isSaving}
                            style={{ fontSize:11, fontFamily:"var(--font-mono)", color, padding:"3px 8px", background:"none", border:"none", cursor:"pointer", opacity:isSaving?0.5:1 }}
                          >
                            {p.acao}{label ? <span style={{ fontSize:9, marginLeft:4, opacity:0.8 }}>{label}</span> : null}
                          </button>
                          {ov && (
                            <button onClick={()=>removeOverride(p.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:"0 5px 0 0", color, opacity:0.6, fontSize:12, lineHeight:1 }}>×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button className="btn btn-violet" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Aba Organograma + Diretório ────────────────────────────────────────────────
type SetorTree = Setor & { filhos?: SetorTree[] };
type DiretorioUser = { id:string; nome:string; email:string; avatar?:string; cargo?:string; telefone?:string; statusOnline?:string; setor?:{ id:string; nome:string; cor:string }|null; roles:string[]; isMaster:boolean; nivel:number; ultimoLogin?:string; };

function SetorCard({ s, depth=0 }: { s: SetorTree; depth?: number }) {
  const [open, setOpen] = useState(true);
  const cor = s.cor || "#a78bfa";
  const memberCount = s._count?.users ?? 0;
  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"var(--card)", border:"1px solid var(--border-subtle)", borderLeft:`3px solid ${cor}`, borderRadius:8, marginBottom:6, cursor:s.filhos?.length?"pointer":"default" }}
        onClick={()=>s.filhos?.length && setOpen(o=>!o)}>
        <div style={{ width:32, height:32, borderRadius:8, background:cor+"20", border:`1px solid ${cor}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <div style={{ width:12, height:12, borderRadius:"50%", background:cor }} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{s.nome}</span>
            {depth > 0 && <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--text-muted)", background:"var(--bg-hover)", padding:"1px 5px", borderRadius:4 }}>sub</span>}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:2 }}>
            <span style={{ fontSize:11, color:"var(--text-muted)" }}>{memberCount} membro{memberCount!==1?"s":""}</span>
            {s.responsavel && <span style={{ fontSize:11, color:"var(--text-muted)" }}>resp: <strong style={{ color:"var(--text-secondary)" }}>{s.responsavel.nome}</strong></span>}
            {s.descricao && <span style={{ fontSize:11, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>{s.descricao}</span>}
          </div>
        </div>
        {s.filhos?.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{s.filhos.length} sub</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:"var(--text-muted)", transform:open?"rotate(180deg)":"none", transition:"transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        )}
      </div>
      {open && s.filhos?.map(child => <SetorCard key={child.id} s={child} depth={depth+1} />)}
    </div>
  );
}

function OrgTab() {
  const [view, setView]         = useState<"arvore"|"diretorio">("arvore");
  const [tree, setTree]         = useState<SetorTree[]>([]);
  const [diretorio, setDiretorio] = useState<DiretorioUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterSetor, setFilterSetor] = useState("");
  const [filterRole,  setFilterRole]  = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/setores/tree"),
      api.get("/organizacao/diretorio"),
    ]).then(([tRes, dRes]) => {
      setTree(tRes.data);
      setDiretorio(dRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spin/></div>;

  const allSetores = diretorio.reduce<{id:string;nome:string}[]>((acc, u) => {
    if (u.setor && !acc.find(s=>s.id===u.setor!.id)) acc.push(u.setor);
    return acc;
  }, []);
  const allRoles = [...new Set(diretorio.flatMap(u=>u.roles))].sort();

  const filtered = diretorio.filter(u => {
    const ms = !search || u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || (u.cargo||"").toLowerCase().includes(search.toLowerCase());
    const mset = !filterSetor || u.setor?.id === filterSetor;
    const mrol = !filterRole || u.roles.includes(filterRole);
    return ms && mset && mrol;
  });

  const statusColor = (s?:string) => s==="disponivel"?"#34d399":s==="ocupado"?"#f87171":s==="ausente"?"#fbbf24":"var(--border-subtle)";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Switcher */}
      <div style={{ display:"flex", gap:6 }}>
        {(["arvore","diretorio"] as const).map(v=>(
          <button key={v} onClick={()=>setView(v)} className={`btn ${view===v?"btn-violet":"btn-ghost"}`} style={{ fontSize:12, padding:"6px 16px" }}>
            {v==="arvore"?"Organograma":"Diretório de Pessoas"}
          </button>
        ))}
      </div>

      {/* ── Organograma (Árvore) ── */}
      {view==="arvore" && (
        <div>
          {tree.length === 0 ? (
            <div className="empty-state card" style={{ padding:40 }}>
              <p style={{ color:"var(--text-secondary)", fontWeight:500 }}>Nenhum setor cadastrado</p>
              <p style={{ fontSize:12, color:"var(--text-muted)" }}>Crie setores na aba "Setores" para ver o organograma</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {tree.map(s => <SetorCard key={s.id} s={s} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Diretório de Pessoas ── */}
      {view==="diretorio" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <input className="input-o" placeholder="Buscar por nome, e-mail ou cargo..." value={search}
              onChange={e=>setSearch(e.target.value)} style={{ flex:1, minWidth:220 }} />
            <select className="input-o" value={filterSetor} onChange={e=>setFilterSetor(e.target.value)} style={{ width:180 }}>
              <option value="">Todos os setores</option>
              {allSetores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
              <option value="__none">Sem setor</option>
            </select>
            <select className="input-o" value={filterRole} onChange={e=>setFilterRole(e.target.value)} style={{ width:150 }}>
              <option value="">Todos os papéis</option>
              {allRoles.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ fontSize:11, color:"var(--text-muted)" }}>{filtered.length} pessoa{filtered.length!==1?"s":""}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:10 }}>
            {filtered.map(u => {
              const initials = u.nome.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase();
              const cor = u.isMaster ? "var(--accent-violet)" : u.nivel >= 80 ? "#f59e0b" : u.nivel >= 50 ? "#22d3ee" : u.nivel >= 20 ? "#34d399" : "#60a5fa";
              return (
                <div key={u.id} className="card" style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${cor}40,${cor}20)`, border:`1px solid ${cor}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:cor }}>
                        {initials}
                      </div>
                      <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:statusColor(u.statusOnline), border:"1.5px solid var(--card)" }} />
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.nome}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {u.roles.slice(0,2).map(r=>(
                      <span key={r} style={{ fontSize:10, fontFamily:"var(--font-mono)", background:cor+"15", color:cor, border:`1px solid ${cor}30`, borderRadius:5, padding:"1px 7px", textTransform:"capitalize" }}>{r}</span>
                    ))}
                    {u.setor && <span style={{ fontSize:10, fontFamily:"var(--font-mono)", background:u.setor.cor+"15", color:u.setor.cor, border:`1px solid ${u.setor.cor}30`, borderRadius:5, padding:"1px 7px" }}>{u.setor.nome}</span>}
                  </div>
                  {u.cargo && <div style={{ fontSize:11, color:"var(--text-secondary)" }}>{u.cargo}</div>}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn:"1/-1" }} className="empty-state">
                <p style={{ color:"var(--text-muted)" }}>Nenhuma pessoa encontrada</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba Matriz Role × Permissão ───────────────────────────────────────────────
type MatrixData = {
  roles: { id: string; nome: string; nivel: number; isMaster: boolean; permissoes: string[] }[];
  permissions: { id: string; recurso: string; acao: string; descricao?: string }[];
};
function MatrizTab() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.get("/rbac/matrix").then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spin /></div>;
  if (!data)   return <div className="empty-state"><p style={{ color:"var(--text-muted)" }}>Erro ao carregar matriz</p></div>;

  const nivelColor = (nivel: number, isMaster: boolean) =>
    isMaster ? "var(--accent-violet)" : nivel >= 80 ? "#f59e0b" : nivel >= 50 ? "#22d3ee" : nivel >= 30 ? "#34d399" : nivel >= 10 ? "#60a5fa" : "var(--text-muted)";

  const permMap = new Map<string, Set<string>>();
  for (const r of data.roles) permMap.set(r.id, new Set(r.permissoes));

  const recursos = [...new Set(data.permissions.map(p => p.recurso))].sort();
  const filteredRecursos = filter
    ? recursos.filter(r => r.includes(filter.toLowerCase()) ||
        data.permissions.some(p => p.recurso === r && p.acao.includes(filter.toLowerCase())))
    : recursos;

  const cellW = 72;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <input className="input-o" placeholder="Filtrar recurso ou ação..." value={filter}
          onChange={e=>setFilter(e.target.value)} style={{ maxWidth:280 }} />
        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
          {data.roles.length} papéis · {data.permissions.length} permissões · {recursos.length} recursos
        </span>
      </div>

      <div style={{ overflowX:"auto", borderRadius:10, border:"1px solid var(--border-subtle)" }}>
        <table style={{ borderCollapse:"collapse", fontSize:11, minWidth:"100%" }}>
          <thead>
            <tr style={{ background:"var(--bg-hover)" }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-muted)", letterSpacing:".08em", borderBottom:"1px solid var(--border-subtle)", whiteSpace:"nowrap", position:"sticky", left:0, background:"var(--bg-hover)", zIndex:1, minWidth:180 }}>
                RECURSO / AÇÃO
              </th>
              {data.roles.map(role => {
                const cor = nivelColor(role.nivel, role.isMaster);
                return (
                  <th key={role.id} style={{ padding:"10px 8px", width:cellW, minWidth:cellW, textAlign:"center", borderBottom:"1px solid var(--border-subtle)", borderLeft:"1px solid var(--border-subtle)" }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, color:cor, textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{role.nome}</div>
                    <div style={{ fontSize:9, color:"var(--text-muted)", marginTop:2 }}>nível {role.nivel}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRecursos.map(recurso => {
              const perms = data.permissions.filter(p => p.recurso === recurso);
              return perms.map((perm, pi) => (
                <tr key={perm.id}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(124,58,237,0.03)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
                  <td style={{ padding:"3px 16px 3px 0", borderBottom: pi === perms.length-1 ? "1px solid var(--border-subtle)" : "none", position:"sticky", left:0, background:"var(--card)", zIndex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {pi === 0 && (
                        <div style={{ width:3, height: perms.length * 24, background:"var(--accent-violet)", borderRadius:2, position:"absolute", left:0, opacity:0.3 }} />
                      )}
                      <span style={{ paddingLeft:16, fontSize:10, fontFamily:"var(--font-mono)", color:pi===0?"var(--text-secondary)":"var(--text-muted)", fontWeight:pi===0?600:400 }}>
                        {pi === 0 && <span style={{ color:"var(--accent-violet)", opacity:0.7, marginRight:6 }}>{recurso}</span>}
                        {perm.acao}
                      </span>
                    </div>
                  </td>
                  {data.roles.map(role => {
                    const hasPerm = role.isMaster || (permMap.get(role.id)?.has(perm.id) ?? false);
                    const cor = nivelColor(role.nivel, role.isMaster);
                    return (
                      <td key={role.id} style={{ textAlign:"center", borderLeft:"1px solid var(--border-subtle)", borderBottom: pi === perms.length-1 ? "1px solid var(--border-subtle)" : "none", padding:"2px 4px", width:cellW }}>
                        {hasPerm
                          ? <span style={{ display:"inline-flex", width:18, height:18, borderRadius:5, background:cor+"20", border:`1px solid ${cor}50`, alignItems:"center", justifyContent:"center" }}>
                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M10 3L5 9L2 6" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </span>
                          : <span style={{ color:"var(--border-subtle)", fontSize:13, lineHeight:1 }}>—</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize:11, color:"var(--text-muted)" }}>
        Papéis master têm acesso irrestrito — todos os marcadores são exibidos por padrão.
      </p>
    </div>
  );
}

// ── Modal Papel ────────────────────────────────────────────────────────────────
function RoleModal({ role, allPerms, onClose, onSave }: { role?: Role; allPerms: Permission[]; onClose:()=>void; onSave:()=>void }) {
  const [nome,     setNome]     = useState(role?.nome || "");
  const [descricao,setDescricao]= useState(role?.descricao || "");
  const [nivel,    setNivel]    = useState(role?.nivel ?? 30);
  const [selected, setSelected] = useState<Set<string>>(
    new Set((role?.rolePermissions||[]).map(rp => rp.permission.id))
  );
  const [saving,   setSaving]   = useState(false);

  const recursos = [...new Set(allPerms.map(p => p.recurso))].sort();

  const toggleAll = (recurso: string) => {
    const ids = allPerms.filter(p => p.recurso === recurso).map(p => p.id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const save = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), descricao: descricao.trim(), nivel, permissoes: Array.from(selected) };
      if (role) await api.patch("/rbac/roles/"+role.id, payload);
      else await api.post("/rbac/roles", payload);
      onSave(); onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <Modal title={role ? "Editar papel" : "Novo papel"} onClose={onClose} maxWidth={600}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", gap:12 }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>NOME</label>
            <input className="input-o" value={nome} onChange={e=>setNome(e.target.value)} placeholder="ex: gerente, colaborador" />
          </div>
          <div style={{ width:80 }}>
            <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>NIVEL (0-99)</label>
            <input className="input-o" type="number" min={0} max={99} value={nivel} onChange={e=>setNivel(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>DESCRICAO</label>
          <input className="input-o" value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Descricao do papel (opcional)" />
        </div>
        <div>
          <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:8 }}>PERMISSOES ({selected.size} selecionadas)</label>
          <div style={{ maxHeight:320, overflowY:"auto", display:"flex", flexDirection:"column", gap:12 }}>
            {recursos.map(recurso => {
              const permsDoRecurso = allPerms.filter(p => p.recurso === recurso);
              const allSel = permsDoRecurso.every(p => selected.has(p.id));
              return (
                <div key={recurso}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <input type="checkbox" checked={allSel} onChange={()=>toggleAll(recurso)} style={{ cursor:"pointer" }} />
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:700, textTransform:"uppercase", color:"var(--text-secondary)", letterSpacing:".08em" }}>{recurso}</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, paddingLeft:22 }}>
                    {permsDoRecurso.map(p=>(
                      <label key={p.id} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:12, color:"var(--text-secondary)", background:selected.has(p.id)?"var(--accent-violet-dim)":"var(--bg-hover)", border:`1px solid ${selected.has(p.id)?"var(--accent-violet)":"var(--border-subtle)"}`, borderRadius:6, padding:"3px 10px" }}>
                        <input type="checkbox" checked={selected.has(p.id)} onChange={()=>{
                          setSelected(prev=>{ const n=new Set(prev); selected.has(p.id)?n.delete(p.id):n.add(p.id); return n; });
                        }} style={{ display:"none" }} />
                        {p.acao}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:4 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" onClick={save} disabled={saving||!nome.trim()}>
            {saving ? "Salvando..." : role ? "Salvar" : "Criar papel"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function OrgSection({ titulo }: { titulo: string }) {
  return <div style={{ gridColumn:"1/-1", fontSize:10, fontFamily:"var(--font-mono)", letterSpacing:"0.1em", color:"var(--accent-violet)", marginTop:4, paddingBottom:4, borderBottom:"1px solid var(--border-subtle)" }}>{titulo}</div>;
}

function OrgForm({ org, onClose, onSave }: { org?: OrgItem; onClose:()=>void; onSave:()=>void }) {
  const isEdit = !!org;
  const [f, setF] = useState({
    nome: org?.nome || "", slug: org?.slug || "", plano: org?.plano || "starter",
    cnpj: org?.cnpj || "", nomeFantasia: org?.nomeFantasia || "", segmento: org?.segmento || "", site: org?.site || "",
    emailContato: org?.emailContato || "", telefone: org?.telefone || "", responsavelNome: org?.responsavelNome || "",
    cep: org?.cep || "", endereco: org?.endereco || "", cidade: org?.cidade || "", estado: org?.estado || "",
    observacoes: org?.observacoes || "",
    statusOperacional: org?.statusOperacional || "", statusComercial: org?.statusComercial || "",
    ativo: org?.ativo ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.nome.trim()) { setErr("Razão social é obrigatória"); return; }
    if (!isEdit && !f.slug.trim()) { setErr("Slug é obrigatório"); return; }
    setLoading(true); setErr("");
    const payload: any = {
      nome:f.nome, plano:f.plano,
      cnpj:f.cnpj||undefined, nomeFantasia:f.nomeFantasia||undefined, segmento:f.segmento||undefined, site:f.site||undefined,
      emailContato:f.emailContato||undefined, telefone:f.telefone||undefined, responsavelNome:f.responsavelNome||undefined,
      cep:f.cep||undefined, endereco:f.endereco||undefined, cidade:f.cidade||undefined, estado:f.estado||undefined,
      observacoes:f.observacoes||undefined,
    };
    try {
      if (isEdit) {
        await api.patch("/superadmin/organizations/"+org!.id, {
          ...payload, statusOperacional:f.statusOperacional||undefined, statusComercial:f.statusComercial||undefined, ativo:f.ativo,
        });
      } else {
        await api.post("/superadmin/organizations", { ...payload, slug:f.slug });
      }
      onSave(); onClose();
    } catch(e:any) { setErr(e?.response?.data?.message||"Erro ao salvar"); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <OrgSection titulo="IDENTIFICAÇÃO" />
        <div style={{ gridColumn:"1/-1" }}>
          <Field label="RAZÃO SOCIAL *">
            <input className="input-o" value={f.nome} autoFocus
              onChange={e=>setF(p=>({...p, nome:e.target.value, slug: isEdit ? p.slug : (p.slug || e.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")) }))} />
          </Field>
        </div>
        <Field label="NOME FANTASIA"><input className="input-o" value={f.nomeFantasia} onChange={e=>set("nomeFantasia",e.target.value)} /></Field>
        <Field label="CNPJ"><input className="input-o" value={f.cnpj} onChange={e=>set("cnpj",e.target.value)} placeholder="00.000.000/0000-00" /></Field>
        {!isEdit && (
          <Field label="SLUG (URL) *">
            <input className="input-o" value={f.slug} placeholder="empresa-abc"
              onChange={e=>set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} />
          </Field>
        )}
        <Field label="SEGMENTO"><input className="input-o" value={f.segmento} onChange={e=>set("segmento",e.target.value)} placeholder="Ex: Tecnologia, Saúde..." /></Field>
        <Field label="SITE"><input className="input-o" value={f.site} onChange={e=>set("site",e.target.value)} placeholder="https://" /></Field>

        <OrgSection titulo="CONTATO" />
        <Field label="RESPONSÁVEL"><input className="input-o" value={f.responsavelNome} onChange={e=>set("responsavelNome",e.target.value)} /></Field>
        <Field label="E-MAIL"><input className="input-o" type="email" value={f.emailContato} onChange={e=>set("emailContato",e.target.value)} /></Field>
        <Field label="TELEFONE"><input className="input-o" value={f.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(11) 99999-9999" /></Field>

        <OrgSection titulo="ENDEREÇO" />
        <Field label="CEP"><input className="input-o" value={f.cep} onChange={e=>set("cep",e.target.value)} placeholder="00000-000" /></Field>
        <Field label="CIDADE"><input className="input-o" value={f.cidade} onChange={e=>set("cidade",e.target.value)} /></Field>
        <div style={{ gridColumn:"1/-1" }}>
          <Field label="LOGRADOURO"><input className="input-o" value={f.endereco} onChange={e=>set("endereco",e.target.value)} placeholder="Rua, número, complemento" /></Field>
        </div>
        <Field label="ESTADO">
          <select className="input-o" value={f.estado} onChange={e=>set("estado",e.target.value)}>
            <option value="">—</option>
            {ESTADOS_BR.map(uf=><option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>

        <OrgSection titulo="OPERACIONAL" />
        <Field label="PLANO">
          <select className="input-o" value={f.plano} onChange={e=>set("plano",e.target.value)}>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </Field>
        {isEdit && (
          <Field label="SITUAÇÃO">
            <select className="input-o" value={f.ativo?"ativo":"inativo"} onChange={e=>set("ativo", e.target.value==="ativo")}>
              <option value="ativo">Ativa</option>
              <option value="inativo">Inativa</option>
            </select>
          </Field>
        )}
        {isEdit && (
          <>
            <Field label="STATUS OPERACIONAL">
              <select className="input-o" value={f.statusOperacional} onChange={e=>set("statusOperacional",e.target.value)}>
                <option value="">—</option>
                <option value="ativo">Ativo</option>
                <option value="suspenso">Suspenso</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </Field>
            <Field label="STATUS COMERCIAL">
              <select className="input-o" value={f.statusComercial} onChange={e=>set("statusComercial",e.target.value)}>
                <option value="">—</option>
                <option value="ativo">Ativo</option>
                <option value="inadimplente">Inadimplente</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </Field>
          </>
        )}
        <div style={{ gridColumn:"1/-1" }}>
          <Field label="OBSERVAÇÕES"><textarea className="input-o" rows={2} value={f.observacoes} onChange={e=>set("observacoes",e.target.value)} style={{ resize:"vertical" }} /></Field>
        </div>
      </div>
      {err && <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:8, padding:"10px 14px", color:"var(--accent-red)", fontSize:12 }}>{err}</div>}
      <div style={{ display:"flex", gap:10, marginTop:4 }}>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
        <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>{loading?<Spin/>:isEdit?"Salvar alterações":"Criar organização"}</button>
      </div>
    </div>
  );
}

export default function CadastrosPage() {
  const { user: me } = useAuthStore();
  const [tab,           setTab]          = useState<"usuarios"|"setores"|"papeis"|"solicitacoes"|"testes"|"matriz"|"organograma"|"organizacoes">("usuarios");
  const [roles,         setRoles]        = useState<Role[]>([]);
  const [allPerms,      setAllPerms]     = useState<Permission[]>([]);
  const [modalRole,     setModalRole]    = useState<Role|"novo"|null>(null);
  const [modalDelRole,  setModalDelRole] = useState<Role|null>(null);
  const [expandedRole,  setExpandedRole] = useState<string|null>(null);
  const [users,         setUsers]        = useState<User[]>([]);
  const [setores,       setSetores]      = useState<Setor[]>([]);
  const [solicitacoes,  setSolicitacoes] = useState<Solicitacao[]>([]);
  const [trials,        setTrials]       = useState<Trial[]>([]);
  const [modalAprovar,  setModalAprovar] = useState<Solicitacao|null>(null);
  const [aprovarForm,   setAprovarForm]  = useState<{
    nome:string;email:string;whatsapp:string;cargo:string;departamento:string;empresa:string;
    setorId:string;perfilRoleId:string;squad:string;matricula:string;
    jornadaHorasDia:number;tipoVinculo:string;senioridade:string;
  }>({nome:"",email:"",whatsapp:"",cargo:"",departamento:"",empresa:"",setorId:"",perfilRoleId:"",squad:"",matricula:"",jornadaHorasDia:8,tipoVinculo:"",senioridade:""});
  const [aprovarStep,   setAprovarStep]  = useState<1|2|3>(1);
  const [aprovarErr,    setAprovarErr]   = useState("");
  const [aprovarLoading,setAprovarLoading]=useState(false);
  const [modalRejeitar, setModalRejeitar]= useState<Solicitacao|null>(null);
  const [motivoRejeitar,setMotivoRejeitar]=useState("");
  const [aprovadoInfo,  setAprovadoInfo] = useState<{nome:string;email:string;senha:string;entregaWhatsapp?:boolean;entregaEmail?:boolean}|null>(null);
  const [loading,       setLoading]      = useState(true);
  const [search,        setSearch]       = useState("");
  const [filterUser,    setFilterUser]   = useState<"todos"|"ativos"|"inativos">("ativos");

  // modais usuarios
  const [modalNewUser,   setModalNewUser]   = useState(false);
  const [modalEditUser,  setModalEditUser]  = useState<User|null>(null);
  const [modalPwd,       setModalPwd]       = useState<User|null>(null);
  const [modalToggle,    setModalToggle]    = useState<User|null>(null);
  const [modalDelUser,   setModalDelUser]   = useState<User|null>(null);
  const [modalUserPerms, setModalUserPerms] = useState<User|null>(null);
  // modais setores
  const [modalSetor,    setModalSetor]    = useState<Setor|"novo"|null>(null);
  const [modalDelSetor, setModalDelSetor] = useState<string|null>(null);
  // organizações
  const [orgs,             setOrgs]             = useState<OrgItem[]>([]);
  const [modalNewOrg,      setModalNewOrg]      = useState(false);
  const [modalEditOrg,     setModalEditOrg]     = useState<OrgItem|null>(null);
  const [modalDelOrg,      setModalDelOrg]      = useState<OrgItem|null>(null);
  const [filterOrg,        setFilterOrg]        = useState<"todos"|"ativos"|"inativos">("ativos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, sRes, rRes, pRes] = await Promise.all([
        api.get("/users", { params: { incluirMaster:"true" } }),
        api.get("/setores"),
        api.get("/rbac/roles"),
        api.get("/rbac/permissions"),
      ]);
      setUsers(uRes.data);
      setSetores(sRes.data);
      setRoles(rRes.data);
      setAllPerms(pRes.data);
      const podeVerSolicitacoes = me?.isMaster || me?.permissions?.includes("*") || me?.permissions?.includes("usuarios:criar");
      if (podeVerSolicitacoes) {
        try { const sRes2 = await api.get("/auth/solicitacoes"); setSolicitacoes(sRes2.data); } catch {}
        try { const tRes = await api.get("/auth/trials"); setTrials(tRes.data); } catch {}
      }
      if (me?.isSuperAdmin) {
        try { const oRes = await api.get("/superadmin/organizations"); setOrgs(oRes.data); } catch {}
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Delete robusto: revalida a lista MESMO se a requisição falhar, e trata
  // 404 (registro já removido) como sucesso. Evita lista desatualizada
  // quando o delete funcionou no servidor mas a resposta falhou no cliente.
  const confirmarDelete = async (url: string) => {
    let delErr: any = null;
    try { await api.delete(url); }
    catch (e: any) { delErr = e; }
    await load();
    if (delErr && delErr?.response?.status !== 404) throw delErr;
  };

  // A matrícula era sugerida por `/collaborators/next-matricula` (iniciais da
  // organização + sequencial). O módulo que servia essa rota saiu em
  // 19/10/2026, então o campo passou a ser digitado por quem aprova.
  useEffect(() => {
    if (!modalAprovar) return;
    setAprovarErr("");
  }, [modalAprovar]);

  const filteredUsers = users.filter(u => {
    const ms = u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const mf = filterUser==="todos" ? true : filterUser==="ativos" ? u.ativo : !u.ativo;
    return ms && mf;
  });
  const filteredSetores = setores.filter(s =>
    !search || s.nome.toLowerCase().includes(search.toLowerCase())
  );

  const statsUsers = { total:users.length, ativos:users.filter(u=>u.ativo).length, masters:users.filter(u=>u.isMaster).length };

  const podeGerenciarUsuarios = me?.isMaster || me?.permissions?.includes("usuarios:ver");
  if (!podeGerenciarUsuarios) return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar />
      <div className="empty-state" style={{ marginTop:80 }}><p style={{ color:"var(--text-muted)" }}>Sem permissao para acessar Cadastros</p></div>
    </div>
  );

  const btnLabel = tab==="usuarios" ? "Novo usuario" : tab==="setores" ? "Novo setor" : tab==="papeis" ? "Novo papel" : tab==="organizacoes" ? "Nova organização" : null;
  const btnAction = () => {
    if (tab==="usuarios")       setModalNewUser(true);
    if (tab==="setores")        setModalSetor("novo");
    if (tab==="papeis")         setModalRole("novo");
    if (tab==="organizacoes")   setModalNewOrg(true);
  };
  const filteredOrgs = orgs.filter(o => {
    const ms = !search || o.nome.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase());
    const mf = filterOrg==="todos" ? true : filterOrg==="ativos" ? o.ativo : !o.ativo;
    return ms && mf;
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        {btnLabel && (
          <button className="btn btn-violet" style={{ fontSize:12 }} onClick={btnAction}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            {btnLabel}
          </button>
        )}
      </Topbar>

      {/* Tabs */}
      {/* Tabs */}
      <div className="modern-tabs-container" style={{ display:"flex", padding:"12px 24px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid var(--border-subtle)", gap:8, overflowX:"auto" }}>
        {[
          { key:"usuarios",       label:"Usuarios",      count:users.length },
          { key:"setores",        label:"Setores",       count:setores.length },
          { key:"organograma",    label:"Organograma",   count:0 },
          { key:"papeis",         label:"Papeis",        count:roles.length },
          { key:"matriz",         label:"Matriz",        count:0 },
          ...((me?.isMaster || me?.permissions?.includes("*") || me?.permissions?.includes("usuarios:criar")) ? [{ key:"solicitacoes", label:"Solicitacoes", count:solicitacoes.filter(s=>s.status==="PENDENTE").length }] : []),
          ...((me?.isMaster || me?.permissions?.includes("*") || me?.permissions?.includes("usuarios:criar")) ? [{ key:"testes", label:"Testes", count:trials.length }] : []),
          ...(me?.isSuperAdmin ? [{ key:"organizacoes", label:"Organizacoes", count:orgs.length }] : []),
        ].map(t=>(
          <button key={t.key} onClick={()=>{ setTab(t.key as any); setSearch(""); }}
            style={{ 
              padding:"8px 16px", borderRadius:20, border:"1px solid", 
              borderColor: tab===t.key ? "var(--accent-violet)" : "transparent",
              background: tab===t.key ? "var(--accent-violet-dim)" : "transparent",
              color: tab===t.key ? "var(--accent-violet)" : "var(--text-secondary)",
              cursor:"pointer", fontFamily:"var(--font-display)", fontSize:13, fontWeight:tab===t.key?600:500,
              display:"flex", alignItems:"center", gap:6, transition:"all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              whiteSpace: "nowrap"
            }}
            onMouseEnter={e => { if(tab!==t.key) e.currentTarget.style.background="var(--bg-hover)"; }}
            onMouseLeave={e => { if(tab!==t.key) e.currentTarget.style.background="transparent"; }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ fontSize:10, fontFamily:"var(--font-mono)", background:tab===t.key?"var(--accent-violet)":"var(--border-subtle)", color:tab===t.key?"#fff":"var(--text-muted)", padding:"2px 8px", borderRadius:12, fontWeight:700 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"32px 24px", display:"flex", flexDirection:"column", gap:24, background:"linear-gradient(to bottom, rgba(255,255,255,0.01), transparent)" }}>

        {/* Busca + filtros */}
        {tab !== "solicitacoes" && tab !== "matriz" && tab !== "organograma" && (
          <div style={{ display:"flex", gap:16, alignItems:"center", background:"var(--card)", padding:"12px 16px", borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, background:"var(--bg-body)", borderRadius:12, padding:"0 14px", border:"1px solid var(--border-subtle)", transition:"all 0.2s" }}
              onFocus={e=>e.currentTarget.style.borderColor="var(--accent-violet)"} onBlur={e=>e.currentTarget.style.borderColor="var(--border-subtle)"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input className="input-unstyled" placeholder={
                tab==="usuarios"?"Buscar por nome ou e-mail...":
                tab==="organizacoes"?"Buscar por nome ou slug...":
                "Buscar setor..."}
                value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, border:"none", background:"transparent", padding:"10px 0", outline:"none", color:"var(--text-primary)", fontSize:14 }} />
            </div>
            {tab==="organizacoes" && (
              <div style={{ display:"flex", gap:6, background:"var(--bg-body)", padding:4, borderRadius:12, border:"1px solid var(--border-subtle)" }}>
                {(["todos","ativos","inativos"] as const).map(f=>(
                  <button key={f} onClick={()=>setFilterOrg(f)} style={{ padding:"6px 16px", fontSize:12, borderRadius:8, border:"none", cursor:"pointer", transition:"all 0.2s", background:filterOrg===f?"var(--card)":"transparent", color:filterOrg===f?"var(--text-primary)":"var(--text-muted)", fontWeight:filterOrg===f?600:500, boxShadow:filterOrg===f?"0 2px 8px rgba(0,0,0,0.04)":"none" }}>
                    {f.charAt(0).toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>
            )}
            {tab==="usuarios" && (
              <div style={{ display:"flex", gap:6, background:"var(--bg-body)", padding:4, borderRadius:12, border:"1px solid var(--border-subtle)" }}>
                {(["todos","ativos","inativos"] as const).map(f=>(
                  <button key={f} onClick={()=>setFilterUser(f)} style={{ padding:"6px 16px", fontSize:12, borderRadius:8, border:"none", cursor:"pointer", transition:"all 0.2s", background:filterUser===f?"var(--card)":"transparent", color:filterUser===f?"var(--text-primary)":"var(--text-muted)", fontWeight:filterUser===f?600:500, boxShadow:filterUser===f?"0 2px 8px rgba(0,0,0,0.04)":"none" }}>
                    {f.charAt(0).toUpperCase()+f.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <button onClick={load} title="Atualizar" style={{ width:40, height:40, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent-violet)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text-secondary)"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
        {tab === "solicitacoes" && (
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button onClick={load} title="Atualizar" style={{ width:40, height:40, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent-violet)"} onMouseLeave={e=>e.currentTarget.style.color="var(--text-secondary)"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}

        {/* ── ABA USUARIOS ── */}
        {tab==="usuarios" && (
          <div className="animate-fade-in" style={{ display:"flex", flexDirection:"column", gap:24 }}>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
              {[
                {label:"TOTAL", value:statsUsers.total, color:"var(--accent-violet)", bg:"linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(124,58,237,0.02) 100%)", icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>},
                {label:"ATIVOS", value:statsUsers.ativos, color:"var(--accent-green)", bg:"linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.02) 100%)", icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>},
                {label:"MASTERS", value:statsUsers.masters, color:"var(--accent-cyan)", bg:"linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(34,211,238,0.02) 100%)", icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
              ].map(s=>(
                <div key={s.label} style={{ padding:"24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, background:s.bg, border:`1px solid ${s.color}30`, borderRadius:16, transition:"transform 0.2s, box-shadow 0.2s", cursor:"default" }} onMouseEnter={e=>{(e.currentTarget.style.transform="translateY(-2px)"); e.currentTarget.style.boxShadow=`0 8px 24px ${s.color}15`;}} onMouseLeave={e=>{(e.currentTarget.style.transform="none"); e.currentTarget.style.boxShadow="none";}}>
                  <div>
                    <div style={{ fontSize:12, fontFamily:"var(--font-mono)", letterSpacing:"0.08em", color:"var(--text-secondary)", marginBottom:8 }}>{s.label}</div>
                    <div className="metric" style={{ fontSize:36, color:s.color, lineHeight:1 }}>{s.value}</div>
                  </div>
                  <div style={{ color:s.color, opacity:0.8 }}>
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* List */}
            <div className="card" style={{ padding:0, overflow:"hidden", border:"1px solid var(--border-subtle)", borderRadius:16, boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1.5fr 140px 140px auto", gap:16, padding:"16px 24px", background:"var(--bg-hover)", borderBottom:"1px solid var(--border-subtle)", alignItems:"center" }}>
                {["USUÁRIO","DETALHES","PAPEL","STATUS",""].map((h, i)=><span key={i} style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:600, letterSpacing:"0.08em", color:"var(--text-muted)" }}>{h}</span>)}
              </div>
              {loading ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:14 }}>Carregando usuários...</span></div>
              ) : filteredUsers.length===0 ? (
                <div className="empty-state" style={{ padding:60 }}><p style={{ color:"var(--text-secondary)", fontSize:15, fontWeight:500 }}>{search?"Nenhum usuário encontrado":"Nenhum usuário cadastrado"}</p></div>
              ) : filteredUsers.map((u,i)=>{
                const isMe = u.id===me?.id;
                return (
                  <div key={u.id} style={{ display:"grid", gridTemplateColumns:"1.5fr 1.5fr 140px 140px auto", gap:16, padding:"16px 24px", borderBottom:i<filteredUsers.length-1?"1px solid var(--border-subtle)":"none", alignItems:"center", opacity:u.ativo?1:0.6, transition:"all 0.2s", background:"transparent" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:16, minWidth:0 }}>
                      <div style={{ position:"relative" }}>
                        <Avatar nome={u.nome} size={42} />
                        {isMe && <div style={{ position:"absolute", bottom:-2, right:-2, width:14, height:14, background:"var(--accent-violet)", border:"2px solid var(--card)", borderRadius:"50%" }} title="Você" />}
                      </div>
                      <div style={{ minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.nome}</div>
                        <span style={{ fontSize:12, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</span>
                      </div>
                    </div>
                    <div style={{ minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
                      {u.cargo ? <div style={{ fontSize:13, color:"var(--text-secondary)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.cargo}</div> : <span style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic" }}>Sem cargo</span>}
                      {u.setor ? <span style={{ fontSize:11, fontFamily:"var(--font-mono)", background:u.setor.cor+"15", color:u.setor.cor, padding:"2px 8px", borderRadius:6, border:`1px solid ${u.setor.cor}30`, display:"inline-block", width:"fit-content" }}>{u.setor.nome}</span> : null}
                    </div>
                    <div>
                      <RoleBadge roleName={u.isMaster ? "master" : u.roles?.[0]} roles={roles} />
                    </div>
                    <div>
                      <span style={{ fontSize:11, fontWeight:600, fontFamily:"var(--font-mono)", letterSpacing:"0.05em", padding:"4px 10px", borderRadius:20, background:u.ativo?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", color:u.ativo?"var(--accent-green)":"var(--accent-red)", border:`1px solid ${u.ativo?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)"}` }}>
                        {u.ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} title="Editar" onClick={()=>setModalEditUser(u)} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-violet)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      {!u.isMaster && (
                        <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} title="Permissões individuais" onClick={()=>setModalUserPerms(u)} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-violet)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        </button>
                      )}
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} title="Resetar senha" onClick={()=>setModalPwd(u)} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-violet)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
                      </button>
                      {!isMe && <>
                        <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} title={u.ativo?"Desativar":"Ativar"} onClick={()=>setModalToggle(u)} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-cyan)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" strokeLinecap="round"/></svg>
                        </button>
                        <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--accent-red)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", opacity:0.7 }} title="Remover" onClick={()=>setModalDelUser(u)} onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.1)"; e.currentTarget.style.borderColor="rgba(220,38,38,0.2)"; e.currentTarget.style.opacity="1";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.opacity="0.7";}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ABA SETORES ── */}
        {tab==="setores" && (
          <div className="animate-fade-in" style={{ maxWidth:800 }}>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:24, lineHeight:1.5 }}>
              Setores organizam os usuários da empresa. Cada usuário pode pertencer a um setor.
            </p>
            {filteredSetores.length===0 ? (
              <div className="empty-state card" style={{ padding:60, borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
                <p style={{ color:"var(--text-secondary)", fontSize:15, fontWeight:500 }}>{search?"Nenhum setor encontrado":"Nenhum setor cadastrado"}</p>
                {!search && <button className="btn btn-violet" style={{ marginTop:16, borderRadius:20, padding:"8px 20px" }} onClick={()=>setModalSetor("novo")}>Criar primeiro setor</button>}
              </div>
            ) : (
              <div className="card" style={{ padding:0, overflow:"hidden", border:"1px solid var(--border-subtle)", borderRadius:16, boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 100px auto", gap:16, padding:"16px 24px", background:"var(--bg-hover)", borderBottom:"1px solid var(--border-subtle)", alignItems:"center" }}>
                  {["SETOR","COR",""].map((h, i)=><span key={i} style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:600, letterSpacing:"0.08em", color:"var(--text-muted)" }}>{h}</span>)}
                </div>
                {filteredSetores.map((s,i)=>(
                  <div key={s.id} style={{ display:"grid", gridTemplateColumns:"2fr 100px auto", gap:16, padding:"16px 24px", borderBottom:i<filteredSetores.length-1?"1px solid var(--border-subtle)":"none", alignItems:"center", transition:"all 0.2s", background:"transparent" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                  >
                    <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", gap:16 }}>
                      <div style={{ width:42, height:42, borderRadius:12, background:`linear-gradient(135deg, ${s.cor}15 0%, ${s.cor}05 100%)`, border:`1px solid ${s.cor}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <div style={{ width:16, height:16, borderRadius:"50%", background:s.cor, boxShadow:`0 0 10px ${s.cor}80` }} />
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)" }}>{s.nome}</span>
                          {s.parentId && <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--accent-violet)", background:"var(--accent-violet-dim)", padding:"2px 6px", borderRadius:6, border:"1px solid var(--accent-violet)" }}>SUB</span>}
                        </div>
                        <div style={{ fontSize:12, color:"var(--text-muted)", display:"flex", gap:10 }}>
                          <span>{s._count?.users ?? 0} membro{(s._count?.users ?? 0)!==1?"s":""}</span>
                          {s.responsavel && <span>•<span style={{ marginLeft:10 }}>resp: <strong style={{ color:"var(--text-secondary)" }}>{s.responsavel.nome}</strong></span></span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize:11, fontFamily:"var(--font-mono)", background:"var(--bg-body)", color:"var(--text-secondary)", padding:"4px 10px", borderRadius:6, border:"1px solid var(--border-subtle)" }}>{s.cor.toUpperCase()}</span>
                    </div>
                    <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setModalSetor(s)} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-violet)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--accent-red)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", opacity:0.7 }} onClick={()=>setModalDelSetor(s.id)} onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.1)"; e.currentTarget.style.borderColor="rgba(220,38,38,0.2)"; e.currentTarget.style.opacity="1";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.opacity="0.7";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── ABA PAPEIS ── */}
        {tab==="papeis" && (
          <div className="animate-fade-in" style={{ maxWidth:800 }}>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:24, lineHeight:1.5 }}>
              Papéis definem conjuntos de permissões. Cada usuário recebe um papel que determina o que pode acessar.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {roles.map(role => {
                const expanded = expandedRole === role.id;
                const permsByRecurso: Record<string, string[]> = {};
                (role.rolePermissions||[]).forEach(rp => {
                  if (!permsByRecurso[rp.permission.recurso]) permsByRecurso[rp.permission.recurso] = [];
                  permsByRecurso[rp.permission.recurso].push(rp.permission.acao);
                });
                const nivelColor = role.isMaster ? "var(--accent-violet)" : role.nivel >= 80 ? "#f59e0b" : role.nivel >= 50 ? "#22d3ee" : role.nivel >= 20 ? "#34d399" : "var(--text-muted)";
                return (
                  <div key={role.id} className="card" style={{ padding:0, overflow:"hidden", border:"1px solid var(--border-subtle)", borderRadius:16, boxShadow:"0 4px 24px rgba(0,0,0,0.02)", transition:"all 0.2s" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 24px", cursor:"pointer", background:expanded?"var(--bg-hover)":"transparent", transition:"background 0.2s" }}
                      onClick={()=>setExpandedRole(expanded ? null : role.id)}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"}
                      onMouseLeave={e=>{if(!expanded) e.currentTarget.style.background="transparent";}}>
                      <div style={{ width:42, height:42, borderRadius:12, background:`linear-gradient(135deg, ${nivelColor}15 0%, ${nivelColor}05 100%)`, border:`1px solid ${nivelColor}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <span style={{ fontSize:14, fontWeight:800, color:nivelColor, fontFamily:"var(--font-mono)" }}>{role.nivel}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)" }}>{role.nome}</span>
                          {role.isMaster && <span style={{ fontSize:10, fontFamily:"var(--font-mono)", background:"var(--accent-violet-dim)", color:"var(--accent-violet)", padding:"2px 8px", borderRadius:12, fontWeight:700 }}>MASTER</span>}
                        </div>
                        <div style={{ fontSize:12, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{role.descricao}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                          <span style={{ fontSize:12, color:"var(--text-secondary)", fontWeight:500 }}>
                            {role._count?.userRoles || 0} usuário{(role._count?.userRoles||0)!==1?"s":""}
                          </span>
                          <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                            {(role.rolePermissions||[]).length} perm.
                          </span>
                        </div>
                        {!role.isMaster && (
                          <div style={{ display:"flex", gap:6 }}>
                            <button style={{ width:32, height:32, borderRadius:8, background:"var(--card)", border:"1px solid var(--border-subtle)", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e=>{e.stopPropagation();setModalRole(role);}} onMouseEnter={e=>{e.currentTarget.style.color="var(--accent-violet)";}} onMouseLeave={e=>{e.currentTarget.style.color="var(--text-secondary)";}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                            </button>
                            <button style={{ width:32, height:32, borderRadius:8, background:"var(--card)", border:"1px solid var(--border-subtle)", color:"var(--accent-red)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", opacity:0.8 }} onClick={e=>{e.stopPropagation();setModalDelRole(role);}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.1)"; e.currentTarget.style.borderColor="rgba(220,38,38,0.2)"; e.currentTarget.style.opacity="1";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--card)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.opacity="0.8";}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                            </button>
                          </div>
                        )}
                        <div style={{ width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", background:expanded?"var(--card)":"transparent", borderRadius:"50%", border:expanded?"1px solid var(--border-subtle)":"1px solid transparent", transition:"all 0.2s" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:expanded?"var(--text-primary)":"var(--text-muted)", transform:expanded?"rotate(180deg)":"none", transition:"transform .3s cubic-bezier(0.4, 0, 0.2, 1)" }}><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ padding:"24px", background:"linear-gradient(to bottom, rgba(255,255,255,0.01), transparent)", borderTop:"1px solid var(--border-subtle)", animation:"fadeIn 0.3s ease" }}>
                        {role.isMaster ? (
                          <div style={{ padding:"16px", background:"rgba(124,58,237,0.05)", borderRadius:12, border:"1px dashed rgba(124,58,237,0.2)" }}>
                            <p style={{ fontSize:13, color:"var(--accent-violet)", fontWeight:500, margin:0, display:"flex", alignItems:"center", gap:8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              O papel master tem acesso irrestrito a todo o sistema.
                            </p>
                          </div>
                        ) : Object.keys(permsByRecurso).length === 0 ? (
                          <div className="empty-state" style={{ padding:"24px", borderRadius:12, background:"var(--bg-body)", border:"1px dashed var(--border-subtle)" }}>
                            <p style={{ fontSize:13, color:"var(--text-muted)", margin:0 }}>Nenhuma permissão atribuída a este papel.</p>
                          </div>
                        ) : (
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:20 }}>
                            {Object.entries(permsByRecurso).map(([recurso, acoes])=>(
                              <div key={recurso} style={{ background:"var(--bg-body)", padding:"12px 16px", borderRadius:12, border:"1px solid var(--border-subtle)" }}>
                                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:600, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>{recurso}</div>
                                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                                  {acoes.map(a=>(
                                    <span key={a} style={{ fontSize:11, fontFamily:"var(--font-mono)", background:"var(--card)", border:"1px solid var(--border-subtle)", borderRadius:6, padding:"4px 8px", color:"var(--text-primary)", fontWeight:500 }}>{a}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {roles.length === 0 && (
                <div className="empty-state card" style={{ padding:60, borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
                  <p style={{ color:"var(--text-secondary)", fontSize:15, fontWeight:500 }}>Nenhum papel encontrado</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── ABA ORGANOGRAMA ── */}
        {tab==="organograma" && (
          <div className="animate-fade-in" style={{ maxWidth: 1000 }}>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:24, lineHeight:1.5 }}>
              Estrutura organizacional da empresa — hierarquia de setores e diretório de pessoas.
            </p>
            <OrgTab />
          </div>
        )}

        {/* ── ABA MATRIZ ── */}
        {tab==="matriz" && (
          <div className="animate-fade-in" style={{ maxWidth: 1000 }}>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:24, lineHeight:1.5 }}>
              Matriz de permissões — visualize quais papéis têm acesso a cada recurso e ação do sistema.
            </p>
            <MatrizTab />
          </div>
        )}

        {/* ── ABA CLIENTES ── */}

        {/* ── ABA ORGANIZAÇÕES ── */}
        {tab==="organizacoes" && (
          <div className="animate-fade-in">
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
              {[
                { label:"TOTAL",   value:orgs.length,                       color:"var(--accent-violet)" },
                { label:"ATIVAS",  value:orgs.filter(o=>o.ativo).length,    color:"var(--accent-green)"  },
                { label:"PLANOS",  value:new Set(orgs.map(o=>o.plano)).size, color:"var(--accent-cyan)"   },
              ].map(s=>(
                <div key={s.label} className="card" style={{ padding:"20px", display:"flex", alignItems:"center", gap:16, borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
                  <div className="metric" style={{ fontSize:32, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:12, fontFamily:"var(--font-mono)", fontWeight:600, letterSpacing:"0.08em", color:"var(--text-secondary)" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding:0, overflow:"hidden", border:"1px solid var(--border-subtle)", borderRadius:16, boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:16, padding:"16px 24px", background:"var(--bg-hover)", borderBottom:"1px solid var(--border-subtle)", alignItems:"center" }}>
                {["ORGANIZAÇÃO","DETALHES","STATUS","AÇÕES"].map(h=><span key={h} style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:600, letterSpacing:"0.08em", color:"var(--text-muted)" }}>{h}</span>)}
              </div>
              {loading ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:14 }}>Carregando...</span></div>
              ) : filteredOrgs.length===0 ? (
                <div className="empty-state" style={{ padding:60 }}><p style={{ color:"var(--text-secondary)", fontSize:15, fontWeight:500 }}>{search?"Nenhuma organização encontrada":"Nenhuma organização cadastrada"}</p></div>
              ) : filteredOrgs.map((o,i)=>{
                const planoColor = o.plano==="enterprise"?"var(--accent-violet)":o.plano==="professional"?"var(--accent-cyan)":"var(--text-muted)";
                return (
                  <div key={o.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:16, padding:"16px 24px", borderBottom:i<filteredOrgs.length-1?"1px solid var(--border-subtle)":"none", alignItems:"center", opacity:o.ativo?1:0.6, transition:"all 0.2s", background:"transparent" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:16, minWidth:0 }}>
                      <Avatar nome={o.nome} size={42} />
                      <div style={{ minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                        <div style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.nome}</div>
                        <code style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>/{o.slug}</code>
                      </div>
                    </div>
                    <div style={{ minWidth:0, display:"flex", flexDirection:"column", gap:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:11, fontFamily:"var(--font-mono)", padding:"2px 8px", borderRadius:6, background:planoColor+"15", border:`1px solid ${planoColor}30`, color:planoColor, fontWeight:600 }}>{o.plano.toUpperCase()}</span>
                        <span style={{ fontSize:12, color:"var(--text-muted)" }}>{o.usuarios} usuário{o.usuarios!==1?"s":""}</span>
                      </div>
                      {o.statusOperacional && <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>op: {o.statusOperacional}</div>}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <span style={{ fontSize:11, fontWeight:600, fontFamily:"var(--font-mono)", padding:"2px 8px", borderRadius:20, background:o.ativo?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", color:o.ativo?"var(--accent-green)":"var(--accent-red)" }}>{o.ativo?"ATIVA":"INATIVA"}</span>
                      {o.statusComercial && <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{o.statusComercial}</span>}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} title="Entrar como" onClick={async()=>{
                        try { await api.post(`/superadmin/organizations/${o.id}/impersonate`); window.location.href="/dashboard"; } catch {}
                      }} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-violet)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </button>
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} title="Editar" onClick={()=>setModalEditOrg(o)} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-violet)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--text-secondary)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center" }} title={o.ativo?"Desativar":"Ativar"} onClick={async()=>{ await api.patch("/superadmin/organizations/"+o.id, { ativo:!o.ativo }); load(); }} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg-hover)"; e.currentTarget.style.borderColor="var(--border-subtle)"; e.currentTarget.style.color="var(--accent-cyan)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="var(--text-secondary)";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" strokeLinecap="round"/></svg>
                      </button>
                      <button style={{ width:32, height:32, borderRadius:8, background:"transparent", border:"1px solid transparent", color:"var(--accent-red)", cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", opacity:0.7 }} title="Remover" onClick={()=>setModalDelOrg(o)} onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,0.1)"; e.currentTarget.style.borderColor="rgba(220,38,38,0.2)"; e.currentTarget.style.opacity="1";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.opacity="0.7";}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}




        {/* ── ABA SOLICITACOES ── */}
        {tab==="testes" && (
          <div className="animate-fade-in" style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:8 }}>
              Acessos de teste de 7 dias criados pela landing page. Fale pelo WhatsApp para converter em assinatura antes ou logo após o vencimento.
            </p>
            {loading ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:14 }}>Carregando...</span></div>
            ) : trials.length===0 ? (
              <div className="empty-state card" style={{ padding:60, borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
                <p style={{ color:"var(--text-secondary)", fontSize:15, fontWeight:500 }}>Nenhum acesso de teste no momento</p>
              </div>
            ) : trials.map(t => {
              const exp = t.trialExpiraEm ? new Date(t.trialExpiraEm) : null;
              const diffMs = exp ? exp.getTime() - Date.now() : 0;
              const dias = Math.ceil(diffMs / 86400000);
              const vencido = diffMs <= 0;
              const cor = vencido ? "#f87171" : dias <= 2 ? "#f59e0b" : "#34d399";
              const rotulo = vencido ? "Vencido" : `${dias} dia${dias===1?"":"s"} restante${dias===1?"":"s"}`;
              const digits = (t.whatsapp||"").replace(/\D/g,"");
              const zap = digits ? (digits.startsWith("55") ? digits : "55"+digits) : "";
              return (
                <div key={t.id} className="card" style={{ padding:"18px 22px", borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                    <div style={{ flex:1, minWidth:220, display:"flex", flexDirection:"column", gap:5 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                        <span style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)" }}>{t.nome}</span>
                        {t.produto && <span style={{ fontSize:11, fontWeight:600, background:"#fff7ed", color:"#9a3412", padding:"2px 8px", borderRadius:6, border:"1px solid #fed7aa" }}>{t.produto}</span>}
                        {t.avisado && <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>suporte avisado</span>}
                      </div>
                      <div style={{ fontSize:13, color:"var(--text-secondary)" }}>{t.email}</div>
                      {t.whatsapp && <div style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{t.whatsapp}</div>}
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, background:cor+"18", color:cor, padding:"5px 12px", borderRadius:8, border:`1px solid ${cor}35`, whiteSpace:"nowrap" }}>{rotulo}</span>
                    {zap && (
                      <a href={`https://wa.me/${zap}`} target="_blank" rel="noreferrer" className="btn btn-violet" style={{ fontSize:13, padding:"8px 16px", borderRadius:8, fontWeight:500, display:"inline-flex", alignItems:"center", gap:6, textDecoration:"none" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/></svg>
                        Falar
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==="solicitacoes" && (
          <div className="animate-fade-in" style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:8 }}>
              Solicitações de criação de acesso enviadas pelo formulário público.
            </p>
            {loading ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:14 }}>Carregando...</span></div>
            ) : solicitacoes.length===0 ? (
              <div className="empty-state card" style={{ padding:60, borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
                <p style={{ color:"var(--text-secondary)", fontSize:15, fontWeight:500 }}>Nenhuma solicitação encontrada</p>
              </div>
            ) : solicitacoes.map(s => {
              const statusColor = s.status==="PENDENTE" ? "#f59e0b" : s.status==="APROVADO" ? "#34d399" : "#f87171";
              const dt = new Date(s.criado_em).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" });
              return (
                <div key={s.id} className="card" style={{ padding:"20px 24px", borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)", transition:"all 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 32px rgba(0,0,0,0.06)";}} onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,0.02)";}}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:20 }}>
                    <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:16, fontWeight:600, color:"var(--text-primary)" }}>{s.nome}</span>
                        <span style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:600, background:statusColor+"15", color:statusColor, padding:"4px 10px", borderRadius:6, border:`1px solid ${statusColor}30` }}>{s.status}</span>
                      </div>
                      <div style={{ fontSize:13, color:"var(--text-secondary)", display:"flex", flexWrap:"wrap", gap:"6px 20px" }}>
                        <span style={{ display:"flex", alignItems:"center", gap:6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> {s.email}</span>
                        {s.whatsapp && <span style={{ display:"flex", alignItems:"center", gap:6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> {s.whatsapp}</span>}
                        {s.cargo && <span style={{ display:"flex", alignItems:"center", gap:6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> {s.cargo}</span>}
                        {s.empresa && <span style={{ display:"flex", alignItems:"center", gap:6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> {s.empresa}</span>}
                      </div>
                      {s.produtos && s.produtos.length > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:12, color:"var(--text-muted)", fontWeight:500 }}>Quer testar:</span>
                          {s.produtos.map(p => (
                            <span key={p} style={{ fontSize:11, fontWeight:600, background:"#fff7ed", color:"#9a3412", padding:"3px 9px", borderRadius:6, border:"1px solid #fed7aa" }}>{p}</span>
                          ))}
                        </div>
                      )}
                      {s.motivacao && (
                        <div style={{ padding:"12px 16px", background:"var(--bg-hover)", borderRadius:8, borderLeft:"3px solid var(--border-subtle)" }}>
                          <p style={{ fontSize:13, color:"var(--text-secondary)", fontStyle:"italic", margin:0 }}>"{s.motivacao}"</p>
                        </div>
                      )}
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4, fontFamily:"var(--font-mono)", fontWeight:500 }}>{dt}</div>
                    </div>
                    {s.status==="PENDENTE" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
                        <button className="btn btn-violet" style={{ fontSize:13, padding:"8px 16px", borderRadius:8, fontWeight:500 }} onClick={()=>{ setModalAprovar(s); setAprovarStep(1); setAprovarForm({ nome:s.nome, email:s.email, whatsapp:s.whatsapp||"", cargo:s.cargo||"", departamento:s.departamento||"", empresa:s.empresa||"", setorId:"", perfilRoleId:"", squad:"", matricula:"", jornadaHorasDia:8, tipoVinculo:"", senioridade:"" }); }}>Aprovar Acesso</button>
                        <button className="btn btn-ghost" style={{ fontSize:13, padding:"8px 16px", borderRadius:8, fontWeight:500, color:"var(--accent-red)" }} onClick={()=>{ setModalRejeitar(s); setMotivoRejeitar(""); }}>Rejeitar</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modais organização */}
      {modalNewOrg && (
        <Modal title="Nova organização" onClose={()=>setModalNewOrg(false)} maxWidth={580}>
          <OrgForm onClose={()=>setModalNewOrg(false)} onSave={load} />
        </Modal>
      )}
      {modalEditOrg && (
        <Modal title="Editar organização" onClose={()=>setModalEditOrg(null)} maxWidth={580}>
          <OrgForm org={modalEditOrg} onClose={()=>setModalEditOrg(null)} onSave={load} />
        </Modal>
      )}
      {modalDelOrg && (
        <ConfirmModal title="Remover organização" message={`Tem certeza que deseja remover ${modalDelOrg.nome}? Esta ação não pode ser desfeita.`} confirmLabel="Remover permanentemente" danger
          onConfirm={()=>confirmarDelete("/superadmin/organizations/"+modalDelOrg.id)} onClose={()=>setModalDelOrg(null)} />
      )}

      {/* Modal aprovar solicitacao (3 steps) */}
      {modalAprovar && (
        <Modal title="Aprovar solicitacao de acesso" onClose={()=>setModalAprovar(null)} maxWidth={560}>
          {/* Stepper */}
          <div style={{ display:"flex", gap:6, marginBottom:18 }}>
            {[
              { n:1, label:"Dados do solicitante" },
              { n:2, label:"Estrutura organizacional" },
              { n:3, label:"Operacional" },
            ].map(s=>(
              <button key={s.n} onClick={()=>setAprovarStep(s.n as 1|2|3)}
                style={{
                  flex:1, padding:"8px 6px", borderRadius:8, border:"1px solid", cursor:"pointer", textAlign:"center",
                  borderColor: aprovarStep===s.n?"var(--accent-violet)":"var(--border-subtle)",
                  background: aprovarStep===s.n?"var(--accent-violet-dim)":"transparent",
                  color: aprovarStep===s.n?"var(--accent-violet)":"var(--text-muted)",
                  fontSize:11, fontFamily:"var(--font-mono)", fontWeight:aprovarStep===s.n?600:400,
                  transition:"all 0.15s",
                }}>
                {s.n}. {s.label}
              </button>
            ))}
          </div>

          {/* STEP 1: Dados do solicitante */}
          {aprovarStep===1 && (
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
              <p style={{ color:"var(--text-secondary)", fontSize:12, lineHeight:1.5 }}>
                Revise os dados do solicitante. Uma senha temporária será enviada via WhatsApp/e-mail e o usuário deverá alterá-la no primeiro acesso.
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="NOME COMPLETO *">
                  <input className="input-o" value={aprovarForm.nome} onChange={e=>setAprovarForm(f=>({...f,nome:e.target.value}))} />
                </Field>
                <Field label="E-MAIL *">
                  <input className="input-o" type="email" value={aprovarForm.email} onChange={e=>setAprovarForm(f=>({...f,email:e.target.value}))} />
                </Field>
                <Field label="WHATSAPP">
                  <input className="input-o" value={aprovarForm.whatsapp} onChange={e=>setAprovarForm(f=>({...f,whatsapp:e.target.value}))} placeholder="(11) 99999-9999" />
                </Field>
                <Field label="CARGO">
                  <input className="input-o" value={aprovarForm.cargo} onChange={e=>setAprovarForm(f=>({...f,cargo:e.target.value}))} />
                </Field>
                <Field label="DEPARTAMENTO">
                  <input className="input-o" value={aprovarForm.departamento} onChange={e=>setAprovarForm(f=>({...f,departamento:e.target.value}))} />
                </Field>
                <Field label="EMPRESA">
                  <input className="input-o" value={aprovarForm.empresa} onChange={e=>setAprovarForm(f=>({...f,empresa:e.target.value}))} />
                </Field>
              </div>
              {modalAprovar.motivacao && (
                <div style={{ background:"var(--bg-hover)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"var(--text-secondary)" }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-muted)", display:"block", marginBottom:4 }}>MOTIVAÇÃO INFORMADA</span>
                  {modalAprovar.motivacao}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Estrutura organizacional */}
          {aprovarStep===2 && (
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
              <p style={{ color:"var(--text-secondary)", fontSize:12, lineHeight:1.5 }}>
                Defina onde o colaborador se encaixa na estrutura organizacional. Estes dados criam o vínculo operacional além do login.
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="SETOR">
                  <select className="input-o" value={aprovarForm.setorId} onChange={e=>setAprovarForm(f=>({...f,setorId:e.target.value}))}>
                    <option value="">— Sem setor —</option>
                    {setores.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </Field>
                <Field label="PERFIL DE ACESSO (PAPEL)">
                  <select className="input-o" value={aprovarForm.perfilRoleId} onChange={e=>setAprovarForm(f=>({...f,perfilRoleId:e.target.value}))}>
                    <option value="">— Padrão (técnico/analista) —</option>
                    {roles.filter(r=>!r.isMaster).map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </Field>
                <Field label="SQUAD / EQUIPE">
                  <input className="input-o" value={aprovarForm.squad} onChange={e=>setAprovarForm(f=>({...f,squad:e.target.value}))} placeholder="Ex: Squad Alpha" />
                </Field>
                <Field label="MATRÍCULA">
                  <input className="input-o" value={aprovarForm.matricula} onChange={e=>setAprovarForm(f=>({...f,matricula:e.target.value}))} placeholder="Ex: COL-001" />
                </Field>
                <Field label="SENIORIDADE">
                  <select className="input-o" value={aprovarForm.senioridade} onChange={e=>setAprovarForm(f=>({...f,senioridade:e.target.value}))}>
                    <option value="">—</option>
                    <option value="estagiario">Estagiário</option>
                    <option value="junior">Júnior</option>
                    <option value="pleno">Pleno</option>
                    <option value="senior">Sênior</option>
                    <option value="especialista">Especialista</option>
                    <option value="lider">Líder</option>
                    <option value="gerente">Gerente</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* STEP 3: Operacional */}
          {aprovarStep===3 && (
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
              <p style={{ color:"var(--text-secondary)", fontSize:12, lineHeight:1.5 }}>
                Define capacidade operacional do colaborador — utilizada para distribuição de tarefas, chamados e cálculo de capacity.
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="JORNADA (HORAS/DIA)">
                  <input className="input-o" type="number" step="0.5" min="0" max="24" value={aprovarForm.jornadaHorasDia} onChange={e=>setAprovarForm(f=>({...f,jornadaHorasDia:parseFloat(e.target.value)||0}))} />
                </Field>
                <Field label="JORNADA (HORAS/MÊS)">
                  <input className="input-o" type="number" value={aprovarForm.jornadaHorasDia ? aprovarForm.jornadaHorasDia*22 : 0} disabled />
                </Field>
                <Field label="TIPO DE VÍNCULO">
                  <select className="input-o" value={aprovarForm.tipoVinculo} onChange={e=>setAprovarForm(f=>({...f,tipoVinculo:e.target.value}))}>
                    <option value="">—</option>
                    <option value="clt">CLT</option>
                    <option value="pj">PJ</option>
                    <option value="estagio">Estágio</option>
                    <option value="terceirizado">Terceirizado</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="socio">Sócio</option>
                  </select>
                </Field>
              </div>
              <div style={{ background:"rgba(34,211,238,0.06)", border:"1px solid rgba(34,211,238,0.2)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"var(--text-secondary)" }}>
                <strong style={{ color:"var(--accent-cyan)" }}>Pronto para criar:</strong> ao confirmar, será criado o usuário <code style={{ fontFamily:"var(--font-mono)" }}>{aprovarForm.email}</code> + colaborador vinculado ao setor selecionado, com perfil de acesso e capacidade definidos.
              </div>
            </div>
          )}

          {/* Erro */}
          {aprovarErr && (
            <div style={{ background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:8, padding:"10px 14px", color:"var(--accent-red)", fontSize:12, marginBottom:12 }}>
              {aprovarErr}
            </div>
          )}

          {/* Footer com navegação */}
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setModalAprovar(null)}>Cancelar</button>
            {aprovarStep > 1 && (
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setAprovarStep((aprovarStep-1) as 1|2|3)}>← Voltar</button>
            )}
            {aprovarStep < 3 ? (
              <button className="btn btn-violet" style={{ flex:2 }} disabled={aprovarStep===1 && (!aprovarForm.nome||!aprovarForm.email)} onClick={()=>setAprovarStep((aprovarStep+1) as 1|2|3)}>Próximo →</button>
            ) : (
              <button className="btn btn-violet" style={{ flex:2 }} disabled={!aprovarForm.nome||!aprovarForm.email||aprovarLoading} onClick={async()=>{
                setAprovarErr(""); setAprovarLoading(true);
                try {
                  const r = await api.patch(`/auth/solicitacoes/${modalAprovar.id}/aprovar`, {
                    nome: aprovarForm.nome,
                    email: aprovarForm.email,
                    whatsapp: aprovarForm.whatsapp||undefined,
                    cargo: aprovarForm.cargo||undefined,
                    departamento: aprovarForm.departamento||undefined,
                    empresa: aprovarForm.empresa||undefined,
                    setorId: aprovarForm.setorId||undefined,
                    perfilRoleId: aprovarForm.perfilRoleId||undefined,
                    squad: aprovarForm.squad||undefined,
                    matricula: aprovarForm.matricula||undefined,
                    senioridade: aprovarForm.senioridade||undefined,
                    tipoVinculo: aprovarForm.tipoVinculo||undefined,
                    jornadaHorasDia: aprovarForm.jornadaHorasDia||undefined,
                  });
                  setAprovadoInfo({
                    nome: aprovarForm.nome,
                    email: aprovarForm.email,
                    senha: r.data?.senhaTemporaria || "",
                    entregaWhatsapp: r.data?.entregaWhatsapp,
                    entregaEmail: r.data?.entregaEmail,
                  });
                  setModalAprovar(null);
                  await load();
                } catch(e:any) {
                  const m = e?.response?.data?.message;
                  setAprovarErr(Array.isArray(m) ? m.join(" • ") : (m || "Erro ao criar conta. Tente novamente."));
                } finally { setAprovarLoading(false); }
              }}>{aprovarLoading?<Spin/>:"Criar conta e colaborador"}</button>
            )}
          </div>
        </Modal>
      )}

      {/* Modal rejeitar solicitacao */}
      {modalRejeitar && (
        <Modal title="Rejeitar solicitacao" onClose={()=>setModalRejeitar(null)} maxWidth={420}>
          <p style={{ color:"var(--text-secondary)", fontSize:13, marginBottom:14, lineHeight:1.6 }}>
            Rejeitar solicitacao de <strong>{modalRejeitar.nome}</strong>?
          </p>
          <Field label="MOTIVO (OPCIONAL)">
            <textarea className="input-o" rows={3} style={{ resize:"none" }} value={motivoRejeitar} onChange={e=>setMotivoRejeitar(e.target.value)} placeholder="Ex: Perfil nao se enquadra nos criterios..." />
          </Field>
          <div style={{ display:"flex", gap:10, marginTop:16 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setModalRejeitar(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex:2 }} onClick={async()=>{
              try {
                await api.patch(`/auth/solicitacoes/${modalRejeitar.id}/rejeitar`, { motivo: motivoRejeitar });
                setModalRejeitar(null);
                await load();
              } catch {}
            }}>Rejeitar</button>
          </div>
        </Modal>
      )}

      {/* Modal senha temporaria */}
      {aprovadoInfo && (
        <Modal title="Conta criada com sucesso" onClose={()=>setAprovadoInfo(null)} maxWidth={440}>
          <div style={{ textAlign:"center", padding:"12px 0" }}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"var(--accent-green)20", border:"1px solid var(--accent-green)40", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:14, lineHeight:1.6 }}>
              Conta criada para <strong>{aprovadoInfo.nome}</strong>.
            </p>
            <div style={{ background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", borderRadius:10, padding:"14px 20px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", marginBottom:6 }}>CREDENCIAIS DE ACESSO — ANOTE AGORA</div>
              <div style={{ fontSize:13, color:"var(--text-primary)", marginBottom:4 }}>{aprovadoInfo.email}</div>
              <div style={{ fontSize:18, fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent-violet)", letterSpacing:"0.04em" }}>{aprovadoInfo.senha || "—"}</div>
            </div>
            <button className="btn btn-ghost" style={{ fontSize:12, marginBottom:12 }} onClick={()=>{
              navigator.clipboard.writeText(`E-mail: ${aprovadoInfo.email}\nSenha: ${aprovadoInfo.senha}`);
            }}>Copiar credenciais</button>
            <div style={{ fontSize:11, lineHeight:1.6, color:"var(--text-muted)" }}>
              {aprovadoInfo.entregaWhatsapp
                ? "✓ Enviado por WhatsApp. "
                : "⚠ Não foi possível enviar por WhatsApp (sem número ou instância desconectada). "}
              {aprovadoInfo.entregaEmail
                ? "✓ Enviado por e-mail."
                : "⚠ Não foi possível enviar por e-mail."}
              <br/>Esta é a única vez que a senha é exibida. O usuário deverá alterá-la no primeiro acesso.
            </div>
          </div>
          <button className="btn btn-violet" style={{ width:"100%", marginTop:16 }} onClick={()=>setAprovadoInfo(null)}>Fechar</button>
        </Modal>
      )}

      {/* Modais usuarios */}
      {modalNewUser  && <UserModal setores={setores} roles={roles} onClose={()=>setModalNewUser(false)} onSave={load} />}
      {modalEditUser && <UserModal user={modalEditUser} setores={setores} roles={roles} onClose={()=>setModalEditUser(null)} onSave={load} />}
      {modalPwd      && <ResetPwdModal user={modalPwd} onClose={()=>setModalPwd(null)} />}
      {modalToggle   && <ConfirmModal title={modalToggle.ativo?"Desativar usuario":"Ativar usuario"} message={modalToggle.ativo?`${modalToggle.nome} perdera acesso ao sistema.`:`${modalToggle.nome} voltara a ter acesso.`} confirmLabel={modalToggle.ativo?"Desativar":"Ativar"} danger={modalToggle.ativo} onConfirm={async()=>{ await api.patch("/users/"+modalToggle.id+"/toggle"); await load(); }} onClose={()=>setModalToggle(null)} />}
      {modalDelUser  && <ConfirmModal title="Remover usuario" message={`Tem certeza que deseja remover ${modalDelUser.nome}? Todos os seus dados serao excluidos.`} confirmLabel="Remover permanentemente" danger onConfirm={()=>confirmarDelete("/users/"+modalDelUser.id)} onClose={()=>setModalDelUser(null)} />}
      {/* Modais setores */}
      {modalSetor    && <SetorModal setor={modalSetor==="novo"?undefined:modalSetor as Setor} setores={setores} users={users} onClose={()=>setModalSetor(null)} onSave={load} />}
      {modalDelSetor && <ConfirmModal title="Remover setor" message="Os usuarios deste setor ficarao sem setor. Deseja continuar?" confirmLabel="Remover" danger onConfirm={()=>confirmarDelete("/setores/"+modalDelSetor)} onClose={()=>setModalDelSetor(null)} />}
      {/* Modais papeis */}
      {modalRole     && <RoleModal role={modalRole==="novo"?undefined:modalRole as Role} allPerms={allPerms} onClose={()=>setModalRole(null)} onSave={load} />}
      {modalDelRole  && <ConfirmModal title="Remover papel" message={`Remover o papel "${modalDelRole.nome}"? Usuarios com este papel precisarao de novo papel.`} confirmLabel="Remover" danger onConfirm={()=>confirmarDelete("/rbac/roles/"+modalDelRole.id)} onClose={()=>setModalDelRole(null)} />}
      {/* Modal permissoes individuais */}
      {modalUserPerms && <UserPermissionsModal user={modalUserPerms} allPerms={allPerms} onClose={()=>setModalUserPerms(null)} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
