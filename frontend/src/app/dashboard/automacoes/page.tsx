"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type Condicao = { campo: string; operador: string; valor?: any; };
type Acao     = { tipo: string; [key: string]: any; };
type Automacao = {
  id: string; nome: string; descricao?: string; trigger: string;
  condicoes: Condicao[]; acoes: Acao[];
  ativo: boolean; totalExecucoes: number; ultimaExecucao?: string;
  criadoEm: string;
};
type Execucao = { id: string; trigger: string; contextId: string; resultado: string; detalhes?: any; criadoEm: string; automacao: { id: string; nome: string; }; };

// ── Constants ─────────────────────────────────────────────────────────────────
const TRIGGERS = [
  { value:"chamado_criado",    label:"Chamado criado" },
  { value:"chamado_atualizado",label:"Chamado atualizado" },
];

const CAMPOS = [
  { value:"prioridade", label:"Prioridade" },
  { value:"status",     label:"Status" },
  { value:"categoria",  label:"Categoria" },
  { value:"atendenteId",label:"Atendente" },
  { value:"clienteId",  label:"Cliente" },
];

const OPERADORES = [
  { value:"eq",       label:"é igual a" },
  { value:"neq",      label:"é diferente de" },
  { value:"empty",    label:"está vazio" },
  { value:"notempty", label:"não está vazio" },
  { value:"contains", label:"contém" },
];

const TIPO_ACAO = [
  { value:"atribuir_atendente",  label:"Atribuir atendente" },
  { value:"mudar_status",        label:"Mudar status" },
  { value:"mudar_prioridade",    label:"Mudar prioridade" },
  { value:"adicionar_tag",       label:"Adicionar tag" },
  { value:"criar_notificacao",   label:"Criar notificação" },
];

const PRIORIDADES   = ["baixa","media","alta","critica"];
const STATUS_LIST   = ["aberto","em_atendimento","aguardando","resolvido","fechado"];
const PARA_OPTIONS  = [
  { value:"solicitante", label:"Solicitante" },
  { value:"atendente",   label:"Atendente" },
  { value:"masters",     label:"Masters" },
];

const TRIGGER_COLORS: Record<string,string> = {
  chamado_criado:     "var(--accent-green)",
  chamado_atualizado: "var(--accent-cyan)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate  = (d?: string) => d ? new Date(d).toLocaleString("pt-BR") : "—";
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

// ── CondicaoBuilder ───────────────────────────────────────────────────────────
function CondicaoBuilder({ condicoes, onChange }: { condicoes: Condicao[]; onChange: (c: Condicao[]) => void; }) {
  const add = () => onChange([...condicoes, { campo:"prioridade", operador:"eq", valor:"alta" }]);
  const remove = (i: number) => onChange(condicoes.filter((_,j)=>j!==i));
  const set = (i: number, k: string, v: any) => onChange(condicoes.map((c,j)=>j===i?{...c,[k]:v}:c));
  const needsValor = (op: string) => !["empty","notempty"].includes(op);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", fontWeight:600 }}>CONDIÇÕES {condicoes.length === 0 && <span style={{ opacity:0.6 }}>(sem condições = sempre executa)</span>}</span>
        <button className="btn btn-ghost" style={{ fontSize:11, padding:"3px 10px" }} onClick={add}>+ Condição</button>
      </div>
      {condicoes.map((c, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"8px 10px", background:"var(--bg-hover)", borderRadius:6 }}>
          {i > 0 && <span style={{ fontSize:11, color:"var(--text-muted)", flexShrink:0 }}>E</span>}
          <select className="input-o" style={{ fontSize:12 }} value={c.campo} onChange={e=>set(i,"campo",e.target.value)}>
            {CAMPOS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select className="input-o" style={{ fontSize:12 }} value={c.operador} onChange={e=>set(i,"operador",e.target.value)}>
            {OPERADORES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {needsValor(c.operador) && (
            c.campo === "prioridade" ? (
              <select className="input-o" style={{ fontSize:12 }} value={c.valor||""} onChange={e=>set(i,"valor",e.target.value)}>
                <option value="">Selecione</option>
                {PRIORIDADES.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            ) : c.campo === "status" ? (
              <select className="input-o" style={{ fontSize:12 }} value={c.valor||""} onChange={e=>set(i,"valor",e.target.value)}>
                <option value="">Selecione</option>
                {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input className="input-o" style={{ fontSize:12 }} value={c.valor||""} onChange={e=>set(i,"valor",e.target.value)} placeholder="valor" />
            )
          )}
          <button onClick={()=>remove(i)} style={{ background:"none", border:"none", color:"var(--accent-red)", cursor:"pointer", padding:"0 4px", fontSize:16, flexShrink:0 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── AcaoBuilder ───────────────────────────────────────────────────────────────
function AcaoBuilder({ acoes, onChange, users }: { acoes: Acao[]; onChange: (a: Acao[]) => void; users: {id:string;nome:string}[]; }) {
  const add = () => onChange([...acoes, { tipo:"mudar_status", status:"em_atendimento" }]);
  const remove = (i: number) => onChange(acoes.filter((_,j)=>j!==i));
  const set = (i: number, data: Partial<Acao>) => onChange(acoes.map((a,j)=>j===i?{...a,...data}:a));

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", fontWeight:600 }}>AÇÕES</span>
        <button className="btn btn-ghost" style={{ fontSize:11, padding:"3px 10px" }} onClick={add}>+ Ação</button>
      </div>
      {acoes.length === 0 && <div style={{ fontSize:12, color:"var(--text-muted)", padding:"8px 10px", background:"var(--bg-hover)", borderRadius:6 }}>Nenhuma ação — adicione pelo menos uma</div>}
      {acoes.map((a, i) => (
        <div key={i} style={{ marginBottom:8, padding:"12px 14px", background:"var(--bg-hover)", borderRadius:6, borderLeft:"3px solid var(--accent-violet)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: a.tipo === "criar_notificacao" ? 10 : 0 }}>
            <select className="input-o" style={{ fontSize:12 }} value={a.tipo} onChange={e=>set(i,{tipo:e.target.value})}>
              {TIPO_ACAO.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {a.tipo === "mudar_status" && (
              <select className="input-o" style={{ fontSize:12 }} value={a.status||""} onChange={e=>set(i,{status:e.target.value})}>
                <option value="">Selecione</option>
                {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {a.tipo === "mudar_prioridade" && (
              <select className="input-o" style={{ fontSize:12 }} value={a.prioridade||""} onChange={e=>set(i,{prioridade:e.target.value})}>
                <option value="">Selecione</option>
                {PRIORIDADES.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {a.tipo === "atribuir_atendente" && (
              <select className="input-o" style={{ fontSize:12 }} value={a.atendenteId||""} onChange={e=>set(i,{atendenteId:e.target.value})}>
                <option value="">Selecione usuário</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            )}
            {a.tipo === "adicionar_tag" && (
              <input className="input-o" style={{ fontSize:12 }} value={a.tag||""} onChange={e=>set(i,{tag:e.target.value})} placeholder="tag" />
            )}
            <button onClick={()=>remove(i)} style={{ background:"none", border:"none", color:"var(--accent-red)", cursor:"pointer", padding:"0 4px", fontSize:16, flexShrink:0, marginLeft:"auto" }}>×</button>
          </div>
          {a.tipo === "criar_notificacao" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", gap:8 }}>
                <select className="input-o" style={{ fontSize:12, width:160 }} value={a.para||"solicitante"} onChange={e=>set(i,{para:e.target.value})}>
                  {PARA_OPTIONS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <input className="input-o" style={{ fontSize:12, flex:1 }} value={a.titulo||""} onChange={e=>set(i,{titulo:e.target.value})} placeholder="Título (use {{titulo}}, {{numero}}, {{prioridade}})" />
              </div>
              <input className="input-o" style={{ fontSize:12 }} value={a.mensagem||""} onChange={e=>set(i,{mensagem:e.target.value})} placeholder="Mensagem (opcional)" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── AutomacaoForm ─────────────────────────────────────────────────────────────
function AutomacaoForm({ automacao, users, onSave, onCancel }: {
  automacao?: Automacao; users: {id:string;nome:string}[];
  onSave: (a: Automacao) => void; onCancel: () => void;
}) {
  const [nome,      setNome]      = useState(automacao?.nome || "");
  const [descricao, setDescricao] = useState(automacao?.descricao || "");
  const [trigger,   setTrigger]   = useState(automacao?.trigger || "chamado_criado");
  const [condicoes, setCondicoes] = useState<Condicao[]>(automacao?.condicoes || []);
  const [acoes,     setAcoes]     = useState<Acao[]>(automacao?.acoes || []);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const save = async () => {
    if (!nome.trim()) { setErr("Nome obrigatorio"); return; }
    if (acoes.length === 0) { setErr("Adicione pelo menos uma ação"); return; }
    setSaving(true); setErr("");
    try {
      const payload = { nome: nome.trim(), descricao: descricao || null, trigger, condicoes, acoes };
      const res = automacao
        ? await api.put("/automacoes/" + automacao.id, payload)
        : await api.post("/automacoes", payload);
      onSave(res.data);
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth:720, display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h2 style={{ fontSize:16, fontWeight:700, fontFamily:"var(--font-display)" }}>{automacao ? "Editar automação" : "Nova automação"}</h2>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onCancel}>Cancelar</button>
      </div>
      {err && <div style={{ fontSize:12, color:"var(--accent-red)", padding:"8px 12px", background:"rgba(239,68,68,0.08)", borderRadius:6 }}>{err}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>NOME *</label>
          <input className="input-o" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome da automação" />
        </div>
        <div>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>GATILHO (TRIGGER)</label>
          <select className="input-o" value={trigger} onChange={e=>setTrigger(e.target.value)}>
            {TRIGGERS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:4 }}>DESCRIÇÃO</label>
          <input className="input-o" value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Descreva o que esta automação faz (opcional)" />
        </div>
      </div>

      {/* Flow diagram */}
      <div className="card" style={{ padding:"16px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <span style={{ fontSize:11, background:TRIGGER_COLORS[trigger]+"18", color:TRIGGER_COLORS[trigger]||"var(--accent-violet)", border:`1px solid ${TRIGGER_COLORS[trigger]||"var(--accent-violet)"}30`, borderRadius:4, padding:"3px 10px", fontFamily:"var(--font-mono)", fontWeight:600 }}>
            {TRIGGERS.find(t=>t.value===trigger)?.label || trigger}
          </span>
          <span style={{ fontSize:13, color:"var(--text-muted)" }}>→</span>
          <span style={{ fontSize:11, color:"var(--text-muted)" }}>se condições passarem</span>
          <span style={{ fontSize:13, color:"var(--text-muted)" }}>→</span>
          <span style={{ fontSize:11, color:"var(--text-muted)" }}>executar ações</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <CondicaoBuilder condicoes={condicoes} onChange={setCondicoes} />
          <hr style={{ border:"none", borderTop:"1px solid var(--border-subtle)" }} />
          <AcaoBuilder acoes={acoes} onChange={setAcoes} users={users} />
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-violet" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar automação"}</button>
      </div>
    </div>
  );
}

// ── AutomacaoCard ─────────────────────────────────────────────────────────────
function AutomacaoCard({ a, onEdit, onToggle, onDelete, onViewExec }: {
  a: Automacao;
  onEdit: () => void; onToggle: () => void; onDelete: () => void; onViewExec: () => void;
}) {
  const trigCol = TRIGGER_COLORS[a.trigger] || "var(--accent-violet)";
  return (
    <div className="card" style={{ padding:"16px 18px", borderLeft:`3px solid ${a.ativo?trigCol:"var(--border-subtle)"}`, opacity:a.ativo?1:0.6 }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span className="badge" style={{ fontSize:10, background:trigCol+"18", color:trigCol, border:`1px solid ${trigCol}30` }}>{TRIGGERS.find(t=>t.value===a.trigger)?.label||a.trigger}</span>
            <span className="badge" style={{ fontSize:10, background:a.ativo?"rgba(34,197,94,0.1)":"var(--bg-hover)", color:a.ativo?"var(--accent-green)":"var(--text-muted)", border:`1px solid ${a.ativo?"rgba(34,197,94,0.2)":"var(--border-subtle)"}` }}>{a.ativo?"Ativa":"Inativa"}</span>
          </div>
          <h3 style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", fontFamily:"var(--font-display)" }}>{a.nome}</h3>
          {a.descricao && <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>{a.descricao}</p>}
        </div>
        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 8px" }} onClick={onViewExec}>Histórico</button>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 8px" }} onClick={onEdit}>Editar</button>
          <button className={`btn ${a.ativo?"btn-ghost":"btn-violet"}`} style={{ fontSize:11, padding:"4px 8px" }} onClick={onToggle}>{a.ativo?"Pausar":"Ativar"}</button>
        </div>
      </div>
      <div style={{ display:"flex", gap:16, fontSize:11, color:"var(--text-muted)", marginTop:8 }}>
        <span>{a.condicoes.length} condição{a.condicoes.length!==1?"ões":""}</span>
        <span>{a.acoes.length} ação{a.acoes.length!==1?"ões":""}</span>
        <span style={{ fontFamily:"var(--font-mono)" }}>{a.totalExecucoes} execuç{a.totalExecucoes!==1?"ões":"ão"}</span>
        {a.ultimaExecucao && <span>Última: {fmtDate(a.ultimaExecucao)}</span>}
        <button onClick={onDelete} style={{ background:"none", border:"none", color:"var(--accent-red)", cursor:"pointer", fontSize:11, marginLeft:"auto", padding:0 }}>Remover</button>
      </div>
    </div>
  );
}

// ── ExecucoesPanel ────────────────────────────────────────────────────────────
function ExecucoesPanel({ automacao, onClose }: { automacao: Automacao; onClose: () => void; }) {
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/automacoes/execucoes", { params: { automacaoId: automacao.id, limit: 50 } })
      .then(r => setExecucoes(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [automacao.id]);

  const resColor = (r: string) => r === "sucesso" ? "var(--accent-green)" : r === "erro" ? "var(--accent-red)" : "var(--text-muted)";

  return (
    <div style={{ maxWidth:640 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onClose}>← Voltar</button>
        <h2 style={{ fontSize:15, fontWeight:700, fontFamily:"var(--font-display)" }}>Histórico — {automacao.nome}</h2>
      </div>
      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {Array.from({length:5}).map((_,i)=><div key={i} className="card skeleton" style={{ height:52 }} />)}
        </div>
      ) : execucoes.length === 0 ? (
        <div className="empty-state"><p style={{ color:"var(--text-muted)" }}>Nenhuma execução registrada</p></div>
      ) : (
        <div className="card" style={{ overflow:"hidden" }}>
          {execucoes.map((e, i) => {
            const col = resColor(e.resultado);
            return (
              <div key={e.id} style={{ padding:"12px 16px", borderBottom:i<execucoes.length-1?"1px solid var(--border-subtle)":"none", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:col, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, color:"var(--text-primary)" }}>
                    Chamado <code style={{ fontSize:11, background:"var(--bg-hover)", padding:"1px 5px", borderRadius:3 }}>{e.contextId.slice(0,8)}…</code>
                  </div>
                  {e.detalhes?.acoes && (
                    <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
                      {(e.detalhes.acoes as any[]).map((a: any) => a.acao).filter(Boolean).join(", ")}
                    </div>
                  )}
                  {e.detalhes?.erro && <div style={{ fontSize:11, color:"var(--accent-red)", marginTop:2 }}>{e.detalhes.erro}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <span className="badge" style={{ fontSize:10, background:col+"15", color:col, border:`1px solid ${col}30` }}>{e.resultado}</span>
                  <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:3 }}>{fmtDate(e.criadoEm)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
// ── Webhook types ─────────────────────────────────────────────────────────────
type Webhook = {
  id: string; nome: string; url: string; evento: string;
  headers: Record<string, string>; secret?: string; descricao?: string;
  ativo: boolean; totalEnvios: number; ultimoEnvio?: string; ultimoStatus?: number;
  criadoEm: string;
};
type WebhookLog = { id: string; evento: string; statusCode?: number; sucesso: boolean; erro?: string; criadoEm: string; };

const EVENTOS_WEBHOOK = [
  "chamado.criado","chamado.atualizado","chamado.resolvido","chamado.fechado",
  "contrato.vencendo","contrato.vencido","ativo.garantia_vencendo","projeto.concluido","usuario.criado",
];

function WebhookForm({ hook, onSave, onCancel }: { hook?: Webhook; onSave: (w: Webhook) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    nome: hook?.nome || "", url: hook?.url || "", evento: hook?.evento || EVENTOS_WEBHOOK[0],
    secret: hook?.secret || "", descricao: hook?.descricao || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!form.nome.trim()) { setError("Nome obrigatório"); return; }
    if (!form.url.trim())  { setError("URL obrigatória"); return; }
    setLoading(true);
    try {
      const payload = { ...form, secret: form.secret || undefined };
      const { data } = hook
        ? await api.put(`/webhooks/${hook.id}`, payload)
        : await api.post("/webhooks", payload);
      onSave(data);
    } catch (err: any) { setError(err?.response?.data?.message || "Erro ao salvar"); }
    finally { setLoading(false); }
  }

  return (
    <div className="card" style={{ padding:20, maxWidth:600 }}>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>{hook ? "Editar Webhook" : "Novo Webhook"}</div>
      <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>Nome *</label>
            <input className="input-o" value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Meu webhook" />
          </div>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>Evento *</label>
            <select className="input-o" value={form.evento} onChange={e => set("evento", e.target.value)}>
              {EVENTOS_WEBHOOK.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>URL de destino *</label>
          <input className="input-o" value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://hooks.exemplo.com/orkestri" />
        </div>
        <div>
          <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>Secret (HMAC SHA256 — opcional)</label>
          <input className="input-o" value={form.secret} onChange={e => set("secret", e.target.value)} placeholder="meu-segredo-para-validar-assinatura" />
        </div>
        <div>
          <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>Descrição</label>
          <input className="input-o" value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Para que serve este webhook..." />
        </div>
        {error && <span style={{ fontSize:12, color:"var(--accent-red)" }}>{error}</span>}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="btn btn-violet" disabled={loading}>{loading?"Salvando...":"Salvar webhook"}</button>
        </div>
      </form>
    </div>
  );
}

function WebhookLogsPanel({ hook, onClose }: { hook: Webhook; onClose: () => void }) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/webhooks/${hook.id}/logs`).then(r => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [hook.id]);
  return (
    <div className="card" style={{ padding:20, maxWidth:720 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>Logs — {hook.nome}</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{hook.url}</div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ fontSize:12 }}>← Voltar</button>
      </div>
      {loading ? <div style={{ padding:32, textAlign:"center", color:"var(--text-muted)" }}>Carregando...</div> : logs.length === 0 ? (
        <div style={{ textAlign:"center", padding:32, color:"var(--text-muted)", fontSize:13 }}>Nenhum envio registrado</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {logs.map(l => (
            <div key={l.id} style={{ display:"grid", gridTemplateColumns:"140px 80px 60px 1fr", gap:10, padding:"8px 12px", borderRadius:8, background:l.sucesso?"rgba(52,211,153,0.04)":"rgba(248,113,113,0.06)", border:`1px solid ${l.sucesso?"rgba(52,211,153,0.15)":"rgba(248,113,113,0.15)"}`, alignItems:"center" }}>
              <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{new Date(l.criadoEm).toLocaleString("pt-BR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
              <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:l.sucesso?"#34d399":"#f87171" }}>{l.sucesso?"✓ OK":"✗ ERRO"}</span>
              <span style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>{l.statusCode || "—"}</span>
              <span style={{ fontSize:11, color:"var(--text-secondary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.erro || l.evento}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebhooksPanel({ canCreate }: { canCreate: boolean }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Webhook | null>(null);
  const [viewLogs, setViewLogs] = useState<Webhook | null>(null);
  const [msg, setMsg] = useState("");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/webhooks"); setWebhooks(data); }
    catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleToggle(w: Webhook) {
    try {
      const { data } = await api.patch(`/webhooks/${w.id}/toggle`);
      setWebhooks(p => p.map(x => x.id === w.id ? data : x));
      showMsg(data.ativo ? "Webhook ativado" : "Webhook pausado");
    } catch { showMsg("Erro ao atualizar"); }
  }

  async function handleDelete(w: Webhook) {
    if (!confirm(`Remover o webhook "${w.nome}"?`)) return;
    try {
      await api.delete(`/webhooks/${w.id}`);
      setWebhooks(p => p.filter(x => x.id !== w.id));
      showMsg("Webhook removido");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Erro ao remover"); }
  }

  async function handleTest(w: Webhook) {
    try {
      await api.post(`/webhooks/${w.id}/testar`);
      showMsg("Teste enviado — verifique os logs");
    } catch { showMsg("Erro ao testar"); }
  }

  if (viewLogs) return <WebhookLogsPanel hook={viewLogs} onClose={() => setViewLogs(null)} />;
  if (editing) return (
    <WebhookForm
      hook={selected || undefined}
      onSave={w => { setWebhooks(p => { const i = p.findIndex(x => x.id === w.id); return i >= 0 ? p.map(x => x.id === w.id ? w : x) : [w, ...p]; }); setEditing(false); setSelected(null); showMsg("Webhook salvo!"); }}
      onCancel={() => { setEditing(false); setSelected(null); }}
    />
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600 }}>Webhooks</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>HTTP callbacks disparados por eventos do sistema</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {msg && <span style={{ fontSize:12, color:msg.includes("Erro")?"var(--accent-red)":"var(--accent-green)", fontFamily:"var(--font-mono)" }}>{msg}</span>}
          {canCreate && <button className="btn btn-violet" style={{ fontSize:12 }} onClick={() => { setSelected(null); setEditing(true); }}>+ Novo webhook</button>}
        </div>
      </div>

      {/* Event reference */}
      <div style={{ padding:"10px 14px", background:"rgba(124,58,237,0.06)", border:"1px solid rgba(124,58,237,0.15)", borderRadius:8, fontSize:11, color:"var(--text-secondary)", marginBottom:20 }}>
        <strong style={{ color:"var(--accent-violet)" }}>Eventos disponíveis: </strong>
        {EVENTOS_WEBHOOK.map((ev, i) => <span key={ev}><code style={{ fontSize:10, background:"rgba(0,0,0,0.2)", padding:"1px 5px", borderRadius:3 }}>{ev}</code>{i < EVENTOS_WEBHOOK.length-1 ? ", " : ""}</span>)}
      </div>

      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Array.from({length:2}).map((_,i) => <div key={i} className="card skeleton" style={{ height:80 }} />)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="empty-state">
          <p style={{ color:"var(--text-muted)" }}>Nenhum webhook configurado</p>
          {canCreate && <button className="btn btn-violet" style={{ marginTop:12 }} onClick={() => setEditing(true)}>Criar primeiro webhook</button>}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {webhooks.map(w => (
            <div key={w.id} className="card" style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:w.ativo?"#34d399":"#94a3b8", flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{w.nome}</span>
                  <code style={{ fontSize:10, background:"rgba(124,58,237,0.12)", color:"#a78bfa", padding:"1px 6px", borderRadius:4 }}>{w.evento}</code>
                </div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.url}</div>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2, fontFamily:"var(--font-mono)" }}>
                  {w.totalEnvios} envio{w.totalEnvios!==1?"s":""}
                  {w.ultimoStatus && <span style={{ color:w.ultimoStatus>=200&&w.ultimoStatus<300?"#34d399":"#f87171" }}> · último: HTTP {w.ultimoStatus}</span>}
                  {w.ultimoEnvio && <span> · {new Date(w.ultimoEnvio).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => handleTest(w)}>Testar</button>
                <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => setViewLogs(w)}>Logs</button>
                <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => { setSelected(w); setEditing(true); }}>Editar</button>
                <button
                  className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px" }}
                  onClick={() => handleToggle(w)}
                >{w.ativo?"Pausar":"Ativar"}</button>
                <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px", color:"var(--accent-red)" }} onClick={() => handleDelete(w)}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AutomacoesPage() {
  const { user } = useAuthStore();
  const [mainTab, setMainTab] = useState<"automacoes"|"webhooks">("automacoes");
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [users,      setUsers]      = useState<{id:string;nome:string}[]>([]);
  const [editing,    setEditing]    = useState(false);
  const [selected,   setSelected]   = useState<Automacao | null>(null);
  const [viewExec,   setViewExec]   = useState<Automacao | null>(null);
  const [msg,        setMsg]        = useState("");

  const canCreate = hasPerms(user, "automacoes:criar");
  const canEdit   = hasPerms(user, "automacoes:editar");
  const canDelete = hasPerms(user, "automacoes:deletar");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/automacoes"); setAutomacoes(data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/users").then(r => setUsers(r.data?.users || r.data || [])).catch(() => {});
  }, []);

  const handleToggle = async (a: Automacao) => {
    try {
      const { data } = await api.patch("/automacoes/" + a.id + "/toggle");
      setAutomacoes(p => p.map(x => x.id === a.id ? data : x));
      showMsg(data.ativo ? "Automação ativada" : "Automação pausada");
    } catch { showMsg("Erro ao atualizar"); }
  };

  const handleDelete = async (a: Automacao) => {
    if (!confirm(`Remover a automação "${a.nome}"?`)) return;
    try {
      await api.delete("/automacoes/" + a.id);
      setAutomacoes(p => p.filter(x => x.id !== a.id));
      showMsg("Automação removida");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Erro ao remover"); }
  };

  const handleSave = (saved: Automacao) => {
    setAutomacoes(p => {
      const idx = p.findIndex(x => x.id === saved.id);
      return idx >= 0 ? p.map(x => x.id === saved.id ? saved : x) : [saved, ...p];
    });
    setEditing(false); setSelected(null);
    showMsg("Automação salva!");
  };

  const ativas   = automacoes.filter(a => a.ativo).length;
  const inativas = automacoes.filter(a => !a.ativo).length;
  const execTotal = automacoes.reduce((acc, a) => acc + a.totalExecucoes, 0);

  if (viewExec) {
    return (
      <div className="flex flex-col h-full">
        <Topbar />
        <div className="flex-1 overflow-y-auto p-6">
          <ExecucoesPanel automacao={viewExec} onClose={() => setViewExec(null)} />
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col h-full">
        <Topbar>
          {msg && <span className="text-xs font-mono text-green-400">{msg}</span>}
        </Topbar>
        <div className="flex-1 overflow-y-auto p-6">
          <AutomacaoForm
            automacao={selected||undefined} users={users}
            onSave={handleSave}
            onCancel={() => { setEditing(false); setSelected(null); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
        {mainTab === "automacoes" && canCreate && (
          <button className="btn btn-violet text-xs" onClick={() => { setSelected(null); setEditing(true); }}>Nova automação</button>
        )}
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Main tabs */}
        <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--border-subtle)", marginBottom:20 }}>
          {(["automacoes","webhooks"] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t)} style={{
              padding:"8px 18px", background:"none", border:"none", cursor:"pointer",
              borderBottom: mainTab===t ? "2px solid var(--accent-violet)" : "2px solid transparent",
              color: mainTab===t ? "var(--accent-violet)" : "var(--text-muted)",
              fontSize:13, fontWeight: mainTab===t ? 600 : 400, transition:"all 0.15s", marginBottom:-1,
            }}>
              {t === "automacoes" ? "Automações" : "Webhooks"}
            </button>
          ))}
        </div>

        {mainTab === "webhooks" && <WebhooksPanel canCreate={canCreate} />}
        {mainTab === "automacoes" && (<div>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, maxWidth:460, marginBottom:24 }}>
          {[
            { label:"Ativas",    value:ativas,    color:"var(--accent-green)" },
            { label:"Inativas",  value:inativas,  color:"var(--text-muted)" },
            { label:"Execuções", value:execTotal, color:"var(--accent-violet)" },
          ].map(s=>(
            <div key={s.label} className="card" style={{ padding:"14px 16px", borderLeft:`3px solid ${s.color}` }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:"var(--font-mono)" }}>{s.value}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div style={{ padding:"12px 16px", background:"rgba(124,58,237,0.06)", border:"1px solid rgba(124,58,237,0.15)", borderRadius:8, fontSize:12, color:"var(--text-secondary)", marginBottom:24, maxWidth:720 }}>
          <strong style={{ color:"var(--accent-violet)" }}>Como funciona:</strong> Automações são disparadas quando eventos ocorrem no sistema. Se as condições forem satisfeitas, as ações são executadas automaticamente em segundo plano.
          Triggers disponíveis: <strong>Chamado criado</strong> e <strong>Chamado atualizado</strong>.
        </div>

        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12, maxWidth:720 }}>
            {Array.from({length:3}).map((_,i)=><div key={i} className="card skeleton" style={{ height:90 }} />)}
          </div>
        ) : automacoes.length === 0 ? (
          <div className="empty-state" style={{ maxWidth:720 }}>
            <p style={{ color:"var(--text-muted)" }}>Nenhuma automação configurada</p>
            {canCreate && <button className="btn btn-violet" style={{ marginTop:12 }} onClick={() => setEditing(true)}>Criar primeira automação</button>}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12, maxWidth:720 }}>
            {automacoes.map(a=>(
              <AutomacaoCard key={a.id} a={a}
                onEdit={() => { setSelected(a); setEditing(true); }}
                onToggle={() => handleToggle(a)}
                onDelete={() => canDelete ? handleDelete(a) : showMsg("Sem permissão")}
                onViewExec={() => setViewExec(a)}
              />
            ))}
          </div>
        )}
        </div>)}
      </div>
    </div>
  );
}
