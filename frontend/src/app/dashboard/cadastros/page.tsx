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
type Solicitacao = { id: string; nome: string; email: string; whatsapp?: string; cargo?: string; departamento?: string; empresa?: string; motivacao?: string; status: string; criado_em: string; };

// ── Constantes ────────────────────────────────────────────────────────────────
const CORES_SETOR  = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6","#94a3b8"];
const ALL_MODULOS  = ["projetos","crm","keep","gantt","relatorios"];
const MODULOS_CFG  = [
  { key:"projetos",  label:"Projetos",       desc:"Gerenciamento de projetos e tarefas", cor:"#a78bfa" },
  { key:"crm",       label:"CRM",            desc:"Pipeline de negocios e clientes",     cor:"#f472b6" },
  { key:"keep",      label:"Keep",           desc:"Notas e anotacoes pessoais",           cor:"#22d3ee" },
  { key:"gantt",     label:"Linha do Tempo", desc:"Visualizacao Gantt dos projetos",      cor:"#34d399" },
  { key:"relatorios",label:"Relatorios",     desc:"Dashboards e relatorios analiticos",   cor:"#fbbf24" },
];
const ALWAYS_ON = [
  { label:"Visao Geral", desc:"Dashboard e resumo do sistema"    },
  { label:"Agenda",      desc:"Calendario de eventos e reunioes" },
  { label:"WhatsApp",    desc:"Configuracao de alertas WhatsApp" },
];

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

  // Busca papel atual do usuário na edição
  useEffect(() => {
    if (isEdit && user) {
      api.get("/rbac/users/"+user.id+"/roles").then(res => {
        const first = res.data?.[0]?.role;
        if (first) setRoleId(first.id);
      }).catch(()=>{});
    }
  }, [isEdit, user]);

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
      // Atribui papel se selecionado
      if (roleId && userId) {
        // Remove papéis anteriores (exceto master) e atribui o novo
        const rolesRes = await api.get("/rbac/users/"+userId+"/roles");
        for (const ur of (rolesRes.data||[])) {
          if (!ur.role.isMaster) await api.delete("/rbac/users/"+userId+"/roles/"+ur.roleId).catch(()=>{});
        }
        await api.post("/rbac/users/"+userId+"/roles", { roleId });
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
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em", marginBottom:10 }}>SELECIONE O PAPEL</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {availableRoles.map(r => {
                const sel = roleId === r.id;
                const cor = nivelColor(r);
                return (
                  <button key={r.id} onClick={()=>setRoleId(r.id)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:sel?"var(--accent-violet-dim)":"var(--bg-hover)", border:`1px solid ${sel?"rgba(124,58,237,0.4)":"var(--border-subtle)"}`, borderRadius:8, cursor:"pointer", textAlign:"left", transition:"all 0.15s", width:"100%" }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:cor+"18", border:`1px solid ${cor}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:cor, fontFamily:"var(--font-mono)" }}>{r.nivel}</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:sel?"var(--text-primary)":"var(--text-secondary)", textTransform:"capitalize" }}>{r.nome}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{r.descricao}</div>
                    </div>
                    <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${sel?"var(--accent-violet)":"var(--border-subtle)"}`, background:sel?"var(--accent-violet)":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                      {sel && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </button>
                );
              })}
              <button onClick={()=>setRoleId("")}
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
type SetorTree = Setor & { filhos: SetorTree[] };
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

export default function CadastrosPage() {
  const { user: me } = useAuthStore();
  const [tab,           setTab]          = useState<"usuarios"|"setores"|"papeis"|"solicitacoes"|"matriz"|"organograma">("usuarios");
  const [roles,         setRoles]        = useState<Role[]>([]);
  const [allPerms,      setAllPerms]     = useState<Permission[]>([]);
  const [modalRole,     setModalRole]    = useState<Role|"novo"|null>(null);
  const [modalDelRole,  setModalDelRole] = useState<Role|null>(null);
  const [expandedRole,  setExpandedRole] = useState<string|null>(null);
  const [users,         setUsers]        = useState<User[]>([]);
  const [setores,       setSetores]      = useState<Setor[]>([]);
  const [solicitacoes,  setSolicitacoes] = useState<Solicitacao[]>([]);
  const [modalAprovar,  setModalAprovar] = useState<Solicitacao|null>(null);
  const [aprovarForm,   setAprovarForm]  = useState<{nome:string;email:string;whatsapp:string;cargo:string;departamento:string;empresa:string}>({nome:"",email:"",whatsapp:"",cargo:"",departamento:"",empresa:""});
  const [modalRejeitar, setModalRejeitar]= useState<Solicitacao|null>(null);
  const [motivoRejeitar,setMotivoRejeitar]=useState("");
  const [aprovadoInfo,  setAprovadoInfo] = useState<{nome:string;email:string}|null>(null);
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
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const btnLabel = tab==="usuarios" ? "Novo usuario" : tab==="setores" ? "Novo setor" : tab==="papeis" ? "Novo papel" : null;
  // matriz e solicitacoes nao tem botao
  const btnAction = () => {
    if (tab==="usuarios")  setModalNewUser(true);
    if (tab==="setores")   setModalSetor("novo");
    if (tab==="papeis")    setModalRole("novo");
  };

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
      <div style={{ display:"flex", padding:"0 24px", borderBottom:"1px solid var(--border-subtle)" }}>
        {[
          { key:"usuarios",       label:"Usuarios",      count:users.length },
          { key:"setores",        label:"Setores",       count:setores.length },
          { key:"organograma",    label:"Organograma",   count:0 },
          { key:"papeis",         label:"Papeis",        count:roles.length },
          { key:"matriz",         label:"Matriz",        count:0 },
          ...((me?.isMaster || me?.permissions?.includes("*") || me?.permissions?.includes("usuarios:criar")) ? [{ key:"solicitacoes", label:"Solicitacoes", count:solicitacoes.filter(s=>s.status==="PENDENTE").length }] : []),
        ].map(t=>(
          <button key={t.key} onClick={()=>{ setTab(t.key as any); setSearch(""); }}
            style={{ padding:"12px 18px", background:"none", border:"none", borderBottom:tab===t.key?"2px solid var(--accent-violet)":"2px solid transparent", color:tab===t.key?"var(--accent-violet)":"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-display)", fontSize:13, fontWeight:tab===t.key?600:400, marginBottom:-1 }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft:6, fontSize:10, fontFamily:"var(--font-mono)", background:tab===t.key?"var(--accent-violet-dim)":"var(--bg-hover)", color:tab===t.key?"var(--accent-violet)":"var(--text-muted)", padding:"1px 6px", borderRadius:8 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:20 }}>

        {/* Busca + filtros */}
        {tab !== "solicitacoes" && tab !== "matriz" && tab !== "organograma" && <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <input className="input-o" placeholder={
            tab==="usuarios"?"Buscar por nome ou e-mail...":
            "Buscar setor..."}
            value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, maxWidth:360 }} />
          {tab==="usuarios" && (
            <div style={{ display:"flex", gap:4 }}>
              {(["todos","ativos","inativos"] as const).map(f=>(
                <button key={f} onClick={()=>setFilterUser(f)} className={`btn ${filterUser===f?"btn-violet":"btn-ghost"}`} style={{ padding:"6px 14px", fontSize:12 }}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
          )}
          <button className="btn-icon" onClick={load} title="Atualizar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/></svg>
          </button>
        </div>}
        {tab === "solicitacoes" && (
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button className="btn-icon" onClick={load} title="Atualizar">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}

        {/* ── ABA USUARIOS ── */}
        {tab==="usuarios" && (
          <>
            <div className="animate-up" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              {[{label:"TOTAL",value:statsUsers.total,color:"var(--accent-violet)"},{label:"ATIVOS",value:statsUsers.ativos,color:"var(--accent-green)"},{label:"MASTERS",value:statsUsers.masters,color:"var(--accent-cyan)"}].map(s=>(
                <div key={s.label} className="card" style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:16 }}>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, fontFamily:"var(--font-mono)", letterSpacing:"0.08em", color:"var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="animate-up card">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 160px auto", gap:16, padding:"10px 20px", borderBottom:"1px solid var(--border-subtle)" }}>
                {["USUARIO","DETALHES","PAPEL","ACOES"].map(h=><span key={h} style={{ fontSize:10, fontFamily:"var(--font-mono)", letterSpacing:"0.08em", color:"var(--text-muted)" }}>{h}</span>)}
              </div>
              {loading ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:13 }}>Carregando...</span></div>
              ) : filteredUsers.length===0 ? (
                <div className="empty-state"><p style={{ color:"var(--text-secondary)", fontWeight:500 }}>{search?"Nenhum usuario encontrado":"Nenhum usuario cadastrado"}</p></div>
              ) : filteredUsers.map((u,i)=>{
                const isMe = u.id===me?.id;
                return (
                  <div key={u.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 160px auto", gap:16, padding:"14px 20px", borderBottom:i<filteredUsers.length-1?"1px solid var(--border-subtle)":"none", alignItems:"center", opacity:u.ativo?1:0.5 }}
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
                      {u.setor && <span className="badge" style={{ fontSize:10, background:u.setor.cor+"15", color:u.setor.cor, border:`1px solid ${u.setor.cor}30` }}>{u.setor.nome}</span>}
                      {u.telefone && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{u.telefone}</div>}
                      {!u.cargo && !u.setor && !u.telefone && <span style={{ fontSize:11, color:"var(--text-muted)" }}>sem detalhes</span>}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      <RoleBadge roleName={u.isMaster ? "master" : u.roles?.[0]} roles={roles} />
                      <span className={`badge ${u.ativo?"badge-green":"badge-red"}`} style={{ fontSize:10 }}>{u.ativo?"ATIVO":"INATIVO"}</span>
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      <button className="btn-icon" title="Editar" onClick={()=>setModalEditUser(u)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      {!u.isMaster && (
                        <button className="btn-icon" title="Permissoes individuais" onClick={()=>setModalUserPerms(u)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        </button>
                      )}
                      <button className="btn-icon" title="Resetar senha" onClick={()=>setModalPwd(u)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
                      </button>
                      {!isMe && <>
                        <button className="btn-icon" title={u.ativo?"Desativar":"Ativar"} onClick={()=>setModalToggle(u)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" strokeLinecap="round"/></svg>
                        </button>
                        <button className="btn-icon" title="Remover" onClick={()=>setModalDelUser(u)} style={{ color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── ABA SETORES ── */}
        {tab==="setores" && (
          <div style={{ maxWidth:640 }}>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16 }}>
              Setores organizam os usuarios da empresa. Cada usuario pode pertencer a um setor.
            </p>
            {filteredSetores.length===0 ? (
              <div className="empty-state card" style={{ padding:40 }}>
                <p style={{ color:"var(--text-secondary)", fontWeight:500 }}>{search?"Nenhum setor encontrado":"Nenhum setor cadastrado"}</p>
                {!search && <button className="btn btn-violet" onClick={()=>setModalSetor("novo")}>Criar primeiro setor</button>}
              </div>
            ) : (
              <div className="card animate-up">
                {filteredSetores.map((s,i)=>(
                  <div key={s.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:i<filteredSetores.length-1?"1px solid var(--border-subtle)":"none" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    <div style={{ width:36, height:36, borderRadius:10, background:s.cor+"20", border:`1px solid ${s.cor}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <div style={{ width:14, height:14, borderRadius:"50%", background:s.cor }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)" }}>{s.nome}</span>
                        {s.parentId && <span style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--accent-violet)", background:"var(--accent-violet-dim)", padding:"1px 5px", borderRadius:4 }}>sub</span>}
                      </div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", display:"flex", gap:10, marginTop:2 }}>
                        <span>{s._count?.users ?? 0} membro{(s._count?.users ?? 0)!==1?"s":""}</span>
                        {s.responsavel && <span>resp: <strong style={{ color:"var(--text-secondary)" }}>{s.responsavel.nome}</strong></span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="btn-icon" onClick={()=>setModalSetor(s)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button className="btn-icon" style={{ color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }} onClick={()=>setModalDelSetor(s.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
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
          <div style={{ maxWidth:760 }}>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16 }}>
              Papeis definem conjuntos de permissoes. Cada usuario recebe um papel que determina o que pode acessar.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {roles.map(role => {
                const expanded = expandedRole === role.id;
                const permsByRecurso: Record<string, string[]> = {};
                (role.rolePermissions||[]).forEach(rp => {
                  if (!permsByRecurso[rp.permission.recurso]) permsByRecurso[rp.permission.recurso] = [];
                  permsByRecurso[rp.permission.recurso].push(rp.permission.acao);
                });
                const nivelColor = role.isMaster ? "var(--accent-violet)" : role.nivel >= 80 ? "#f59e0b" : role.nivel >= 50 ? "#22d3ee" : role.nivel >= 20 ? "#34d399" : "var(--text-muted)";
                return (
                  <div key={role.id} className="card" style={{ overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", cursor:"pointer" }}
                      onClick={()=>setExpandedRole(expanded ? null : role.id)}>
                      <div style={{ width:36, height:36, borderRadius:10, background:nivelColor+"20", border:`1px solid ${nivelColor}35`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <span style={{ fontSize:11, fontWeight:800, color:nivelColor, fontFamily:"var(--font-mono)" }}>{role.nivel}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{role.nome}</span>
                          {role.isMaster && <span style={{ fontSize:10, fontFamily:"var(--font-mono)", background:"var(--accent-violet-dim)", color:"var(--accent-violet)", padding:"1px 6px", borderRadius:4 }}>MASTER</span>}
                        </div>
                        <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{role.descricao}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                          {role._count?.userRoles || 0} usuario{(role._count?.userRoles||0)!==1?"s":""}
                        </span>
                        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                          {(role.rolePermissions||[]).length} perm.
                        </span>
                        {!role.isMaster && (
                          <div style={{ display:"flex", gap:4 }}>
                            <button className="btn-icon" onClick={e=>{e.stopPropagation();setModalRole(role);}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                            </button>
                            <button className="btn-icon" style={{ color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }}
                              onClick={e=>{e.stopPropagation();setModalDelRole(role);}}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                            </button>
                          </div>
                        )}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:"var(--text-muted)", transform:expanded?"rotate(180deg)":"none", transition:"transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ padding:"0 20px 16px", borderTop:"1px solid var(--border-subtle)" }}>
                        {role.isMaster ? (
                          <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:12 }}>O papel master tem acesso irrestrito a todo o sistema.</p>
                        ) : Object.keys(permsByRecurso).length === 0 ? (
                          <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:12 }}>Nenhuma permissao atribuida.</p>
                        ) : (
                          <div style={{ display:"flex", flexWrap:"wrap", gap:16, marginTop:12 }}>
                            {Object.entries(permsByRecurso).map(([recurso, acoes])=>(
                              <div key={recurso} style={{ minWidth:160 }}>
                                <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>{recurso}</div>
                                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                                  {acoes.map(a=>(
                                    <span key={a} style={{ fontSize:10, fontFamily:"var(--font-mono)", background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", borderRadius:4, padding:"2px 7px", color:"var(--text-secondary)" }}>{a}</span>
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
                <div className="empty-state card" style={{ padding:40 }}>
                  <p style={{ color:"var(--text-secondary)", fontWeight:500 }}>Nenhum papel encontrado</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── ABA ORGANOGRAMA ── */}
        {tab==="organograma" && (
          <div>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16 }}>
              Estrutura organizacional da empresa — hierarquia de setores e diretório de pessoas.
            </p>
            <OrgTab />
          </div>
        )}

        {/* ── ABA MATRIZ ── */}
        {tab==="matriz" && (
          <div>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:16 }}>
              Matriz de permissões — visualize quais papéis têm acesso a cada recurso e ação do sistema.
            </p>
            <MatrizTab />
          </div>
        )}

        {/* ── ABA SOLICITACOES ── */}
        {tab==="solicitacoes" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:4 }}>
              Solicitacoes de criacao de acesso enviadas pelo formulario publico.
            </p>
            {loading ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12 }}><Spin/><span style={{ color:"var(--text-muted)", fontSize:13 }}>Carregando...</span></div>
            ) : solicitacoes.length===0 ? (
              <div className="empty-state card" style={{ padding:40 }}>
                <p style={{ color:"var(--text-secondary)", fontWeight:500 }}>Nenhuma solicitacao encontrada</p>
              </div>
            ) : solicitacoes.map(s => {
              const statusColor = s.status==="PENDENTE" ? "#f59e0b" : s.status==="APROVADO" ? "#34d399" : "#f87171";
              const dt = new Date(s.criado_em).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" });
              return (
                <div key={s.id} className="card animate-up" style={{ padding:"16px 20px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:16 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                        <span style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)" }}>{s.nome}</span>
                        <span style={{ fontSize:10, fontFamily:"var(--font-mono)", background:statusColor+"20", color:statusColor, padding:"1px 7px", borderRadius:8, border:`1px solid ${statusColor}40` }}>{s.status}</span>
                      </div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", display:"flex", flexWrap:"wrap", gap:"4px 16px" }}>
                        <span>{s.email}</span>
                        {s.whatsapp && <span>WA: {s.whatsapp}</span>}
                        {s.cargo && <span>{s.cargo}</span>}
                        {s.empresa && <span>{s.empresa}</span>}
                      </div>
                      {s.motivacao && (
                        <p style={{ fontSize:12, color:"var(--text-secondary)", marginTop:6, fontStyle:"italic" }}>"{s.motivacao}"</p>
                      )}
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4, fontFamily:"var(--font-mono)" }}>{dt}</div>
                    </div>
                    {s.status==="PENDENTE" && (
                      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                        <button className="btn btn-violet" style={{ fontSize:12, padding:"6px 14px" }} onClick={()=>{ setModalAprovar(s); setAprovarForm({ nome:s.nome, email:s.email, whatsapp:s.whatsapp||"", cargo:s.cargo||"", departamento:s.departamento||"", empresa:s.empresa||"" }); }}>Aprovar</button>
                        <button className="btn btn-danger" style={{ fontSize:12, padding:"6px 14px" }} onClick={()=>{ setModalRejeitar(s); setMotivoRejeitar(""); }}>Rejeitar</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal aprovar solicitacao */}
      {modalAprovar && (
        <Modal title="Aprovar solicitacao de acesso" onClose={()=>setModalAprovar(null)} maxWidth={500}>
          <p style={{ color:"var(--text-secondary)", fontSize:12, marginBottom:16, lineHeight:1.6 }}>
            Revise e corrija os dados antes de criar a conta. A senha padrão <strong>123@mudar</strong> será enviada via WhatsApp e o usuário deverá alterá-la no primeiro acesso.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="NOME COMPLETO">
                <input className="input-o" value={aprovarForm.nome} onChange={e=>setAprovarForm(f=>({...f,nome:e.target.value}))} />
              </Field>
              <Field label="E-MAIL">
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
                <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-muted)", display:"block", marginBottom:4 }}>MOTIVACAO</span>
                {modalAprovar.motivacao}
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setModalAprovar(null)}>Cancelar</button>
            <button className="btn btn-violet" style={{ flex:2 }} disabled={!aprovarForm.nome||!aprovarForm.email} onClick={async()=>{
              try {
                await api.patch(`/auth/solicitacoes/${modalAprovar.id}/aprovar`, aprovarForm);
                setAprovadoInfo({ nome: aprovarForm.nome, email: aprovarForm.email });
                setModalAprovar(null);
                await load();
              } catch {}
            }}>Criar conta e enviar acesso</button>
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
        <Modal title="Conta criada com sucesso" onClose={()=>setAprovadoInfo(null)} maxWidth={420}>
          <div style={{ textAlign:"center", padding:"12px 0" }}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"var(--accent-green)20", border:"1px solid var(--accent-green)40", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:16, lineHeight:1.6 }}>
              Conta criada para <strong>{aprovadoInfo.nome}</strong>.<br/>
              As credenciais foram enviadas via WhatsApp.
            </p>
            <div style={{ background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", borderRadius:10, padding:"12px 20px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", marginBottom:4 }}>CREDENCIAIS ENVIADAS</div>
              <div style={{ fontSize:13, color:"var(--text-primary)", marginBottom:4 }}>{aprovadoInfo.email}</div>
              <div style={{ fontSize:15, fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--accent-violet)" }}>123@mudar</div>
            </div>
            <p style={{ fontSize:11, color:"var(--text-muted)" }}>O usuario deverá alterar a senha no primeiro acesso.</p>
          </div>
          <button className="btn btn-violet" style={{ width:"100%", marginTop:16 }} onClick={()=>setAprovadoInfo(null)}>Fechar</button>
        </Modal>
      )}

      {/* Modais usuarios */}
      {modalNewUser  && <UserModal setores={setores} roles={roles} onClose={()=>setModalNewUser(false)} onSave={load} />}
      {modalEditUser && <UserModal user={modalEditUser} setores={setores} roles={roles} onClose={()=>setModalEditUser(null)} onSave={load} />}
      {modalPwd      && <ResetPwdModal user={modalPwd} onClose={()=>setModalPwd(null)} />}
      {modalToggle   && <ConfirmModal title={modalToggle.ativo?"Desativar usuario":"Ativar usuario"} message={modalToggle.ativo?`${modalToggle.nome} perdera acesso ao sistema.`:`${modalToggle.nome} voltara a ter acesso.`} confirmLabel={modalToggle.ativo?"Desativar":"Ativar"} danger={modalToggle.ativo} onConfirm={async()=>{ await api.patch("/users/"+modalToggle.id+"/toggle"); await load(); }} onClose={()=>setModalToggle(null)} />}
      {modalDelUser  && <ConfirmModal title="Remover usuario" message={`Tem certeza que deseja remover ${modalDelUser.nome}? Todos os seus dados serao excluidos.`} confirmLabel="Remover permanentemente" danger onConfirm={async()=>{ await api.delete("/users/"+modalDelUser.id); await load(); }} onClose={()=>setModalDelUser(null)} />}
      {/* Modais setores */}
      {modalSetor    && <SetorModal setor={modalSetor==="novo"?undefined:modalSetor as Setor} setores={setores} users={users} onClose={()=>setModalSetor(null)} onSave={load} />}
      {modalDelSetor && <ConfirmModal title="Remover setor" message="Os usuarios deste setor ficarao sem setor. Deseja continuar?" confirmLabel="Remover" danger onConfirm={async()=>{ await api.delete("/setores/"+modalDelSetor); await load(); }} onClose={()=>setModalDelSetor(null)} />}
      {/* Modais papeis */}
      {modalRole     && <RoleModal role={modalRole==="novo"?undefined:modalRole as Role} allPerms={allPerms} onClose={()=>setModalRole(null)} onSave={load} />}
      {modalDelRole  && <ConfirmModal title="Remover papel" message={`Remover o papel "${modalDelRole.nome}"? Usuarios com este papel precisarao de novo papel.`} confirmLabel="Remover" danger onConfirm={async()=>{ await api.delete("/rbac/roles/"+modalDelRole.id); await load(); }} onClose={()=>setModalDelRole(null)} />}
      {/* Modal permissoes individuais */}
      {modalUserPerms && <UserPermissionsModal user={modalUserPerms} allPerms={allPerms} onClose={()=>setModalUserPerms(null)} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
