"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Tipos ─────────────────────────────────────────────────────────────────────
/**
 * O usuario do cadastro geral -- cinco campos, um para o sistema inteiro.
 *
 * Sairam `cargo`, `setor` e a escolha de papel: desde 20/10/2026 todo usuario
 * recebe o papel `usuario`, que abre todos os produtos da versao reduzida e
 * fecha o grupo Core. `roles` e `isMaster` ficam porque a lista ainda precisa
 * distinguir quem administra (master / administrador) de quem nao administra.
 */
type User = {
  id: string; nome: string; email: string; ativo: boolean;
  cpf?: string | null; telefone?: string | null; whatsapp?: string | null;
  roles: string[]; isMaster: boolean;
  ultimoLogin?: string; criadoEm: string; modulos: string[];
};
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

// ── Modal Usuario ──────────────────────────────────────────────

/** Mascara de CPF conforme se digita: 000.000.000-00. */
function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 6)  return d.slice(0,3) + "." + d.slice(3);
  if (d.length <= 9)  return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6);
  return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
}

/** Mascara de telefone brasileiro, fixo ou celular. */
function mascaraFone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.length ? "(" + d : "";
  if (d.length <= 6)  return "(" + d.slice(0,2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
  return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
}

/**
 * O cadastro de usuario: nome completo, CPF, e-mail, telefone e WhatsApp.
 *
 * Era um assistente de dois passos -- dados no primeiro, escolha de papel e
 * leitura das permissoes desse papel no segundo. Os perfis diferenciados
 * (aprovacao, administrador, consultor, auditor) deixaram de se aplicar em
 * 20/10/2026: todo usuario nasce com o papel `usuario`, entao nao ha segundo
 * passo nem campo de senha -- o backend sorteia uma senha provisoria e a
 * devolve UMA vez, que e o que `senhaCriada` mostra aqui.
 */
function UserModal({ user, onClose, onSave }: { user?: User; onClose:()=>void; onSave:()=>void }) {
  const [nome,     setNome]     = useState(user?.nome || "");
  const [cpf,      setCpf]      = useState(mascaraCpf(user?.cpf || ""));
  const [email,    setEmail]    = useState(user?.email || "");
  const [telefone, setTelefone] = useState(mascaraFone(user?.telefone || ""));
  const [whatsapp, setWhatsapp] = useState(mascaraFone(user?.whatsapp || ""));
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [senhaCriada, setSenhaCriada] = useState<string|null>(null);
  const isEdit = !!user;

  const save = async () => {
    if (!nome.trim())  { setError("Nome completo e obrigatorio"); return; }
    if (!email.trim()) { setError("E-mail e obrigatorio"); return; }
    const cpfDigitos = cpf.replace(/\D/g, "");
    if (cpfDigitos.length !== 11) { setError("CPF deve ter 11 digitos"); return; }
    setLoading(true); setError("");
    const corpo = {
      nome: nome.trim(), cpf: cpfDigitos, email: email.trim(),
      telefone: telefone.replace(/\D/g, "") || undefined,
      whatsapp: whatsapp.replace(/\D/g, "") || undefined,
    };
    try {
      if (isEdit) {
        await api.put("/users/" + user!.id, corpo);
        onSave(); onClose();
      } else {
        const res = await api.post("/users", corpo);
        onSave();
        // Nao fecha: a senha provisoria aparece uma unica vez.
        setSenhaCriada(res.data?.senhaProvisoria || null);
      }
    } catch (e:any) { setError(e.response?.data?.message || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  if (senhaCriada) return (
    <Modal title="Usuario criado" onClose={onClose} maxWidth={440}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:8, padding:"12px 14px", fontSize:13, color:"var(--text-secondary)" }}>
          <strong style={{ color:"var(--text-primary)" }}>{nome}</strong> ja pode entrar com o e-mail <code style={{ fontFamily:"var(--font-mono)" }}>{email}</code> e a senha abaixo.
        </div>
        <Field label="SENHA PROVISORIA">
          <input className="input-o" readOnly value={senhaCriada} onFocus={e=>e.currentTarget.select()}
            style={{ fontFamily:"var(--font-mono)", letterSpacing:"0.05em" }} />
        </Field>
        <p style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5, margin:0 }}>
          Esta e a unica vez que a senha aparece. O usuario tera de troca-la no primeiro acesso.
        </p>
        <button className="btn btn-violet" style={{ width:"100%" }} onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );

  return (
    <Modal title={isEdit ? "Editar usuario" : "Novo usuario"} onClose={onClose} maxWidth={460}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <Field label="NOME COMPLETO">
          <input className="input-o" value={nome} onChange={e=>setNome(e.target.value)} autoFocus />
        </Field>
        <Field label="CPF">
          <input className="input-o" value={cpf} onChange={e=>setCpf(mascaraCpf(e.target.value))}
            placeholder="000.000.000-00" inputMode="numeric" style={{ fontFamily:"var(--font-mono)" }} />
        </Field>
        <Field label="E-MAIL">
          <input className="input-o" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="TELEFONE">
            <input className="input-o" value={telefone} onChange={e=>setTelefone(mascaraFone(e.target.value))}
              placeholder="(11) 3333-3333" inputMode="tel" />
          </Field>
          <Field label="WHATSAPP">
            <input className="input-o" value={whatsapp} onChange={e=>setWhatsapp(mascaraFone(e.target.value))}
              placeholder="(11) 99999-9999" inputMode="tel" />
          </Field>
        </div>
        {!isEdit && (
          <p style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5, margin:0 }}>
            O acesso e o mesmo para todos: Space, Projects e Finance. A senha provisoria aparece ao salvar.
          </p>
        )}
        {error && <p style={{ color:"var(--accent-red)", fontSize:12, margin:0 }}>{error}</p>}
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>
            {loading ? <Spin/> : isEdit ? "Salvar" : "Criar usuario"}
          </button>
        </div>
      </div>
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


// ── Pagina Cadastros ──────────────────────────────────────────
//
// Sairam daqui em 20/10/2026, com as abas que servivam:
//
//   RoleBadge             crachá do papel na lista (nao ha mais papel a exibir)
//   UserPermissionsModal  permissoes individuais (overrides por usuario)
//   SetorCard / OrgTab    arvore de setores + diretorio de pessoas
//   MatrizTab             matriz papel x permissao
//   RoleModal             criar e editar papel
//
// O motor de papel/permissao continua inteiro no backend -- e dele que
// `resolvePermissions` tira o array `permissions` que autoriza cada rota. O que
// saiu foi a TELA: nao ha mais perfil a escolher, entao nao ha o que editar.

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
  const [tab,           setTab]          = useState<"usuarios"|"solicitacoes"|"testes"|"organizacoes">("usuarios");
  const [users,         setUsers]        = useState<User[]>([]);
  const [solicitacoes,  setSolicitacoes] = useState<Solicitacao[]>([]);
  const [trials,        setTrials]       = useState<Trial[]>([]);
  const [modalAprovar,  setModalAprovar] = useState<Solicitacao|null>(null);
  const [aprovarForm,   setAprovarForm]  = useState<{
    nome:string;email:string;whatsapp:string;cargo:string;departamento:string;empresa:string;
    squad:string;matricula:string;
    jornadaHorasDia:number;tipoVinculo:string;senioridade:string;
  }>({nome:"",email:"",whatsapp:"",cargo:"",departamento:"",empresa:"",squad:"",matricula:"",jornadaHorasDia:8,tipoVinculo:"",senioridade:""});
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
  // organizações
  const [orgs,             setOrgs]             = useState<OrgItem[]>([]);
  const [modalNewOrg,      setModalNewOrg]      = useState(false);
  const [modalEditOrg,     setModalEditOrg]     = useState<OrgItem|null>(null);
  const [modalDelOrg,      setModalDelOrg]      = useState<OrgItem|null>(null);
  const [filterOrg,        setFilterOrg]        = useState<"todos"|"ativos"|"inativos">("ativos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Sobrou uma chamada: /setores saiu com a tabela, e /rbac/roles e
      // /rbac/permissions alimentavam as abas Papeis e Matriz.
      const uRes = await api.get("/users", { params: { incluirMaster:"true" } });
      setUsers(uRes.data);
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

  const statsUsers = { total:users.length, ativos:users.filter(u=>u.ativo).length, masters:users.filter(u=>u.isMaster).length };

  const podeGerenciarUsuarios = me?.isMaster || me?.permissions?.includes("usuarios:ver");
  if (!podeGerenciarUsuarios) return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar />
      <div className="empty-state" style={{ marginTop:80 }}><p style={{ color:"var(--text-muted)" }}>Sem permissao para acessar Cadastros</p></div>
    </div>
  );

  const btnLabel = tab==="usuarios" ? "Novo usuario" : tab==="organizacoes" ? "Nova organização" : null;
  const btnAction = () => {
    if (tab==="usuarios")     setModalNewUser(true);
    if (tab==="organizacoes") setModalNewOrg(true);
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
        {tab !== "solicitacoes" && (
          <div style={{ display:"flex", gap:16, alignItems:"center", background:"var(--card)", padding:"12px 16px", borderRadius:16, border:"1px solid var(--border-subtle)", boxShadow:"0 4px 24px rgba(0,0,0,0.02)" }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, background:"var(--bg-body)", borderRadius:12, padding:"0 14px", border:"1px solid var(--border-subtle)", transition:"all 0.2s" }}
              onFocus={e=>e.currentTarget.style.borderColor="var(--accent-violet)"} onBlur={e=>e.currentTarget.style.borderColor="var(--border-subtle)"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input className="input-unstyled" placeholder={
                tab==="usuarios"?"Buscar por nome ou e-mail...":
                "Buscar por nome ou slug..."}
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
                {["USUÁRIO","CPF","CONTATO","STATUS",""].map((h, i)=><span key={i} style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:600, letterSpacing:"0.08em", color:"var(--text-muted)" }}>{h}</span>)}
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
                    <div style={{ minWidth:0 }}>
                      {u.cpf
                        ? <span style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--text-secondary)" }}>{mascaraCpf(u.cpf)}</span>
                        : <span style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic" }}>—</span>}
                    </div>
                    <div style={{ minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
                      {u.telefone && <span style={{ fontSize:12, color:"var(--text-secondary)" }}>{mascaraFone(u.telefone)}</span>}
                      {u.whatsapp && <span style={{ fontSize:11, color:"var(--text-muted)" }}>zap {mascaraFone(u.whatsapp)}</span>}
                      {!u.telefone && !u.whatsapp && <span style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic" }}>—</span>}
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
                        <button className="btn btn-violet" style={{ fontSize:13, padding:"8px 16px", borderRadius:8, fontWeight:500 }} onClick={()=>{ setModalAprovar(s); setAprovarStep(1); setAprovarForm({ nome:s.nome, email:s.email, whatsapp:s.whatsapp||"", cargo:s.cargo||"", departamento:s.departamento||"", empresa:s.empresa||"", squad:"", matricula:"", jornadaHorasDia:8, tipoVinculo:"", senioridade:"" }); }}>Aprovar Acesso</button>
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
              {/* SETOR e PERFIL DE ACESSO saíram em 20/10/2026: não há mais
                  setor para escolher, e o perfil é um só — quem é aprovado
                  recebe o papel `usuario`, como quem é cadastrado na aba. */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
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
      {modalNewUser  && <UserModal onClose={()=>setModalNewUser(false)} onSave={load} />}
      {modalEditUser && <UserModal user={modalEditUser} onClose={()=>setModalEditUser(null)} onSave={load} />}
      {modalPwd      && <ResetPwdModal user={modalPwd} onClose={()=>setModalPwd(null)} />}
      {modalToggle   && <ConfirmModal title={modalToggle.ativo?"Desativar usuario":"Ativar usuario"} message={modalToggle.ativo?`${modalToggle.nome} perdera acesso ao sistema.`:`${modalToggle.nome} voltara a ter acesso.`} confirmLabel={modalToggle.ativo?"Desativar":"Ativar"} danger={modalToggle.ativo} onConfirm={async()=>{ await api.patch("/users/"+modalToggle.id+"/toggle"); await load(); }} onClose={()=>setModalToggle(null)} />}
      {modalDelUser  && <ConfirmModal title="Remover usuario" message={`Tem certeza que deseja remover ${modalDelUser.nome}? Todos os seus dados serao excluidos.`} confirmLabel="Remover permanentemente" danger onConfirm={()=>confirmarDelete("/users/"+modalDelUser.id)} onClose={()=>setModalDelUser(null)} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
