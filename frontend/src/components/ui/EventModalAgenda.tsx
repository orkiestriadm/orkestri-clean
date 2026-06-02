"use client";
import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import MemberSelector from "./MemberSelector";

type User = { id: string; nome: string; email: string; };

const TIPOS = ["PESSOAL","REUNIAO","PROJETO","COMPROMISSO","LEMBRETE"];
const CORES = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6"];
const RECORRENCIAS = [
  { value:"", label:"Nao repetir" },
  { value:"DIARIA", label:"Diariamente" },
  { value:"SEMANAL", label:"Semanalmente" },
  { value:"QUINZENAL", label:"A cada 2 semanas" },
  { value:"MENSAL", label:"Mensalmente" },
];

function Field({ label, children }: any) {
  return <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>{label}</label>{children}</div>;
}

export default function EventModalAgenda({ date, event, users, onClose, onSave }: {
  date: string;
  event?: any;
  users: User[];
  onClose: () => void;
  onSave: () => void;
}) {
  const { user: me } = useAuthStore();
  const [titulo,      setTitulo]      = useState(event?.titulo||"");
  const [descricao,   setDescricao]   = useState(event?.descricao||"");
  const [inicio,      setInicio]      = useState(event?event.inicio.slice(0,16):date.includes("T")?date:date+"T09:00");
  const [fim,         setFim]         = useState(event?.fim?event.fim.slice(0,16):date.includes("T")?date.replace(/T\d+:\d+/,m=>{ const [h,min]=m.slice(1).split(":"); return `T${String(Number(h)+1).padStart(2,"0")}:${min}`; }):date+"T10:00");
  const [tipo,        setTipo]        = useState(event?.tipo||"PESSOAL");
  const [cor,         setCor]         = useState(event?.cor||"#a78bfa");
  const [diaTodo,     setDiaTodo]     = useState(event?.diaTodo||false);
  const [local,       setLocal]       = useState(event?.local||"");
  const [recorrencia, setRecorrencia] = useState(event?.recorrencia||"");
  const [recFim,      setRecFim]      = useState("");
  const [partic,      setPartic]      = useState<string[]>(
    event?.participants?.map((p:any)=>p.user.id).filter((id:string)=>id!==me?.id)||[]
  );
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const isEdit = !!event;

  const otherUsers = users.filter(u => u.id !== me?.id);

  const save = async () => {
    if (!titulo.trim()) { setError("Titulo obrigatorio"); return; }
    setLoading(true); setError("");
    try {
      const payload: any = { titulo, descricao, inicio, fim:diaTodo?undefined:fim, tipo, cor, diaTodo, local, participantes:partic };
      if (recorrencia) { payload.recorrencia=recorrencia; if(recFim) payload.recorrenciaFim=recFim; }
      if (isEdit) await api.put("/agenda/"+(event.recurringParentId||event.id), payload);
      else await api.post("/agenda", payload);
      onSave(); onClose();
    } catch (e:any) { setError(e.response?.data?.message||"Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>{if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose();}}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:600 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>{isEdit?"Editar evento":"Novo evento"}</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Field label="TITULO">
            <input className="input-o" placeholder="Ex: Reuniao de alinhamento" value={titulo} onChange={e=>setTitulo(e.target.value)} autoFocus />
          </Field>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="DESCRICAO">
              <textarea className="input-o" placeholder="Detalhes..." value={descricao} onChange={e=>setDescricao(e.target.value)} style={{ minHeight:60, resize:"vertical" }} />
            </Field>
            <Field label="LOCAL">
              <input className="input-o" placeholder="Sala, endereco ou link" value={local} onChange={e=>setLocal(e.target.value)} />
            </Field>
          </div>

          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"var(--text-secondary)" }}>
            <input type="checkbox" checked={diaTodo} onChange={e=>setDiaTodo(e.target.checked)} style={{ accentColor:"var(--accent-violet)", width:15, height:15 }} />
            Dia todo
          </label>

          {!diaTodo && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="INICIO">
                <input className="input-o" type="datetime-local" value={inicio} onChange={e=>setInicio(e.target.value)} />
              </Field>
              <Field label="FIM">
                <input className="input-o" type="datetime-local" value={fim} onChange={e=>setFim(e.target.value)} />
              </Field>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="TIPO">
              <select className="input-o" value={tipo} onChange={e=>setTipo(e.target.value)}>
                {TIPOS.map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="RECORRENCIA">
              <select className="input-o" value={recorrencia} onChange={e=>setRecorrencia(e.target.value)}>
                {RECORRENCIAS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>

          {recorrencia && (
            <Field label="REPETIR ATE (opcional)">
              <input className="input-o" type="date" value={recFim} onChange={e=>setRecFim(e.target.value)} />
            </Field>
          )}

          <Field label="COR">
            <div style={{ display:"flex", gap:8 }}>
              {CORES.map(c=>(
                <button key={c} onClick={()=>setCor(c)} style={{ width:26, height:26, borderRadius:"50%", background:c, border:cor===c?"3px solid white":"3px solid transparent", cursor:"pointer", outline:"none", boxShadow:cor===c?`0 0 0 2px ${c}`:"none" }} />
              ))}
            </div>
          </Field>

          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>PARTICIPANTES</label>
            {otherUsers.length > 0 ? (
              <MemberSelector
                users={otherUsers}
                selected={partic}
                onChange={setPartic}
                label=""
              />
            ) : (
              <div style={{ padding:"10px 14px", borderRadius:10, border:"1px dashed var(--border-medium)", background:"var(--bg-secondary)", fontSize:12, color:"var(--text-muted)", display:"flex", alignItems:"center", gap:8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Nenhum membro disponível — cadastre usuários em <a href="/dashboard/cadastros" style={{ color:"var(--accent-violet)", textDecoration:"underline" }}>Cadastros → Usuários</a>
              </div>
            )}
          </div>

          {error && <p style={{ color:"var(--accent-red)", fontSize:12 }}>{error}</p>}

          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>
              {loading
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>
                : isEdit ? "Salvar" : "Criar evento"
              }
            </button>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}