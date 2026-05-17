"use client";
import EventModalAgenda from "@/components/ui/EventModalAgenda";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Calendar } from "lucide-react";

const DAYS_SHORT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];
const DAYS_FULL   = ["Domingo","Segunda","Terca","Quarta","Quinta","Sexta","Sabado"];
const MONTHS      = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TIPOS       = ["PESSOAL","REUNIAO","PROJETO","COMPROMISSO","LEMBRETE"];
const CORES       = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6"];
const RECORRENCIAS = [
  { value:"", label:"Nao repetir" },
  { value:"DIARIA", label:"Diariamente" },
  { value:"SEMANAL", label:"Semanalmente" },
  { value:"QUINZENAL", label:"A cada 2 semanas" },
  { value:"MENSAL", label:"Mensalmente" },
];
const HOURS = Array.from({length:24},(_,i)=>i);

type Participante = { id: string; nome: string; email: string; };
type Event = { id: string; titulo: string; descricao?: string; inicio: string; fim?: string; tipo: string; cor: string; diaTodo: boolean; confirmado: boolean; criadoPorId: string; participants?: {user:Participante}[]; recorrencia?: string; local?: string; ata?: string; isRecurring?: boolean; recurringParentId?: string; };
type View = "mes"|"semana"|"dia";

function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("pt-BR"); }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function toLocalISOStr(d: Date) { const pad=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function calculateMovableHolidays(year: number) {
  const f = Math.floor, G = year % 19, C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J, month = 3 + f((L + 40) / 44), day = L + 28 - 31 * f(month / 4);
  const easter = new Date(year, month - 1, day);
  const carnival = addDays(easter, -47);
  const corpus = addDays(easter, 60);
  const paixao = addDays(easter, -2);
  const pad = (d: Date) => `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}`;
  return { [pad(carnival)]: "Carnaval", [pad(paixao)]: "Paixão de Cristo", [pad(easter)]: "Páscoa", [pad(corpus)]: "Corpus Christi" };
}

const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "Ano Novo", "21-04": "Tiradentes", "01-05": "Dia do Trabalhador",
  "07-09": "Independência do Brasil", "12-10": "Nossa Sra. Aparecida",
  "02-11": "Finados", "15-11": "Proclamação da República", "25-12": "Natal"
};

function getHoliday(date: Date) {
  const key = `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (FIXED_HOLIDAYS[key]) return FIXED_HOLIDAYS[key];
  const movable = calculateMovableHolidays(date.getFullYear());
  if (movable[key]) return movable[key];
  return null;
}

function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="modal-overlay" onClick={e=>{if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose();}}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:wide?680:520 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>{title}</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>{label}</label>{children}</div>;
}

function EventModal({ date, event, users, onClose, onSave }: any) {
  const { user: me } = useAuthStore();
  const [titulo,      setTitulo]      = useState(event?.titulo||"");
  const [descricao,   setDescricao]   = useState(event?.descricao||"");
  const [inicio,      setInicio]      = useState(event?event.inicio.slice(0,16):date+"T09:00");
  const [fim,         setFim]         = useState(event?.fim?event.fim.slice(0,16):date+"T10:00");
  const [tipo,        setTipo]        = useState(event?.tipo||"PESSOAL");
  const [cor,         setCor]         = useState(event?.cor||"#a78bfa");
  const [diaTodo,     setDiaTodo]     = useState(event?.diaTodo||false);
  const [local,       setLocal]       = useState(event?.local||"");
  const [recorrencia, setRecorrencia] = useState(event?.recorrencia||"");
  const [recFim,      setRecFim]      = useState("");
  const [partic,      setPartic]      = useState<string[]>(event?.participants?.map((p:any)=>p.user.id).filter((id:string)=>id!==me?.id)||[]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const isEdit = !!event;

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

  const toggleP = (id:string) => setPartic(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  return (
    <Modal title={isEdit?"Editar evento":"Novo evento"} onClose={onClose} wide>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div style={{ gridColumn:"1/-1" }}><Field label="TITULO"><input className="input-o" placeholder="Ex: Reuniao de alinhamento" value={titulo} onChange={e=>setTitulo(e.target.value)} autoFocus /></Field></div>
        <Field label="DESCRICAO"><textarea className="input-o" placeholder="Detalhes..." value={descricao} onChange={e=>setDescricao(e.target.value)} style={{ minHeight:60, resize:"vertical" }} /></Field>
        <Field label="LOCAL"><input className="input-o" placeholder="Sala, endereco ou link" value={local} onChange={e=>setLocal(e.target.value)} /></Field>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"var(--text-secondary)" }}>
            <input type="checkbox" checked={diaTodo} onChange={e=>setDiaTodo(e.target.checked)} style={{ accentColor:"var(--accent-violet)", width:15, height:15 }} /> Dia todo
          </label>
        </div>
        {!diaTodo && <>
          <Field label="INICIO"><input className="input-o" type="datetime-local" value={inicio} onChange={e=>setInicio(e.target.value)} /></Field>
          <Field label="FIM"><input className="input-o" type="datetime-local" value={fim} onChange={e=>setFim(e.target.value)} /></Field>
        </>}
        <Field label="TIPO"><select className="input-o" value={tipo} onChange={e=>setTipo(e.target.value)}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="RECORRENCIA"><select className="input-o" value={recorrencia} onChange={e=>setRecorrencia(e.target.value)}>{RECORRENCIAS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
        {recorrencia && <div style={{ gridColumn:"1/-1" }}><Field label="REPETIR ATE"><input className="input-o" type="date" value={recFim} onChange={e=>setRecFim(e.target.value)} /></Field></div>}
        <div style={{ gridColumn:"1/-1" }}><Field label="COR"><div style={{ display:"flex", gap:8 }}>{CORES.map(c=><button key={c} onClick={()=>setCor(c)} style={{ width:26, height:26, borderRadius:"50%", background:c, border:cor===c?"3px solid white":"3px solid transparent", cursor:"pointer", outline:"none", boxShadow:cor===c?`0 0 0 2px ${c}`:"none" }} />)}</div></Field></div>
        {users.filter((u:any)=>u.id!==me?.id).length > 0 && (
          <div style={{ gridColumn:"1/-1" }}><Field label="PARTICIPANTES">
            <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:120, overflowY:"auto" }}>
              {users.filter((u:any)=>u.id!==me?.id).map((u:any)=>(
                <label key={u.id} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"5px 8px", borderRadius:6, background:partic.includes(u.id)?"var(--accent-violet-dim)":"transparent" }}>
                  <input type="checkbox" checked={partic.includes(u.id)} onChange={()=>toggleP(u.id)} style={{ accentColor:"var(--accent-violet)" }} />
                  <span style={{ fontSize:13 }}>{u.nome}</span>
                </label>
              ))}
            </div>
          </Field></div>
        )}
        {error && <div style={{ gridColumn:"1/-1", color:"var(--accent-red)", fontSize:12 }}>{error}</div>}
        <div style={{ gridColumn:"1/-1", display:"flex", gap:10, marginTop:4 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>
            {loading?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>:isEdit?"Salvar":"Criar evento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EventDetail({ event, onClose, onEdit, onDelete, canEdit, me, onRespond }: any) {
  const [ata, setAta]       = useState(event.ata||"");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [responding, setResponding] = useState(false);
  const dur = event.fim && !event.diaTodo ? Math.round((new Date(event.fim).getTime()-new Date(event.inicio).getTime())/60000) : null;

  const saveAta = async () => {
    setSaving(true);
    try { await api.patch("/agenda/"+event.id+"/ata", { ata }); setSaved(true); setTimeout(()=>setSaved(false),2000); }
    catch {} finally { setSaving(false); }
  };

  const respond = async (status: "aceito" | "recusado") => {
    setResponding(true);
    try { await api.patch("/agenda/"+event.id+"/respond", { status }); if (onRespond) onRespond(); onClose(); }
    catch {} finally { setResponding(false); }
  };

  const isPendingForMe = !event.confirmado && event.userId === me?.id;

  return (
    <Modal title="Detalhes do evento" onClose={onClose} wide>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {isPendingForMe && (
          <div style={{ background:"var(--accent-amber-dim)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:8, padding:14, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--accent-amber)", marginBottom:4 }}>Convite pendente</div>
              <div style={{ fontSize:12, color:"var(--text-secondary)" }}>Voce foi adicionado a esta atividade. Deseja participar?</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-ghost" style={{ fontSize:12, color:"var(--accent-red)", background:"rgba(239,68,68,0.1)" }} onClick={()=>respond("recusado")} disabled={responding}>Recusar</button>
              <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>respond("aceito")} disabled={responding}>Aceitar</button>
            </div>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
          <div style={{ width:12, height:12, borderRadius:"50%", background:event.cor, boxShadow:`0 0 8px ${event.cor}`, marginTop:4, flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <h2 style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, marginBottom:6 }}>{event.titulo}</h2>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <span className="badge badge-violet">{event.tipo}</span>
              {event.isRecurring && <span className="badge badge-cyan">Recorrente</span>}
              {!event.confirmado && <span className="badge badge-amber">Pendente</span>}
            </div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ background:"var(--bg-hover)", borderRadius:8, padding:"10px 14px" }}>
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:4 }}>DATA E HORARIO</div>
            <div style={{ fontSize:13, fontWeight:500 }}>{fmtDate(event.inicio)}{!event.diaTodo && ` • ${fmtTime(event.inicio)}${event.fim?` - ${fmtTime(event.fim)}`:""}`}{event.diaTodo && " (Dia todo)"}</div>
            {dur && <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Duracao: {dur>=60?`${Math.floor(dur/60)}h${dur%60>0?` ${dur%60}min`:""}` : `${dur} min`}</div>}
          </div>
          {event.local && (
            <div style={{ background:"var(--bg-hover)", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:4 }}>LOCAL</div>
              <div style={{ fontSize:13 }}>{event.local}</div>
            </div>
          )}
        </div>
        {event.descricao && <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6 }}>{event.descricao}</p>}
        {event.participants && event.participants.length > 0 && (
          <div>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:8 }}>PARTICIPANTES</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {event.participants.map((p:any)=>(
                <div key={p.user.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, background:"var(--bg-hover)", border:"1px solid var(--border-subtle)" }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", background:"var(--accent-violet-dim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"var(--accent-violet)" }}>{p.user.nome.charAt(0)}</div>
                  <span style={{ fontSize:12 }}>{p.user.nome}</span>
                  {p.status === "pendente" && <span style={{ fontSize:10, color:"var(--accent-amber)" }}>(Pendente)</span>}
                  {p.status === "recusado" && <span style={{ fontSize:10, color:"var(--accent-red)" }}>(Recusado)</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>ATA DA REUNIAO</div>
            {saved && <span style={{ fontSize:11, color:"var(--accent-green)" }}>Salvo!</span>}
          </div>
          <textarea className="input-o" placeholder="Registre decisoes e proximos passos..." value={ata} onChange={e=>setAta(e.target.value)} style={{ minHeight:80, resize:"vertical", fontSize:12, lineHeight:1.7 }} />
          {ata !== (event.ata||"") && <button className="btn btn-violet" style={{ marginTop:8, fontSize:12 }} onClick={saveAta} disabled={saving}>{saving?"Salvando...":"Salvar ata"}</button>}
        </div>
        <div style={{ display:"flex", gap:8, paddingTop:8, borderTop:"1px solid var(--border-subtle)" }}>
          {canEdit && <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onEdit}>Editar</button>}
          {canEdit && <button className="btn btn-danger" style={{ fontSize:12 }} onClick={onDelete}>Remover</button>}
          <button className="btn btn-violet" style={{ marginLeft:"auto", fontSize:12 }} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </Modal>
  );
}

function MonthView({ events, cur, onDayClick, onDayDblClick, onEventClick }: any) {
  const today = new Date();
  const daysInMonth = new Date(cur.year, cur.month, 0).getDate();
  const firstDay = new Date(cur.year, cur.month-1, 1).getDay();
  const dayStr = (d:number) => `${cur.year}-${String(cur.month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const todayStr = today.toISOString().split("T")[0];
  return (
    <div className="card animate-up" style={{ padding:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
        {DAYS_SHORT.map(d=><div key={d} style={{ textAlign:"center", fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", padding:"4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i} />)}
        {Array(daysInMonth).fill(null).map((_,i)=>{
          const d=i+1; const ds=dayStr(d);
          const dateObj = new Date(cur.year, cur.month-1, d);
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
          const holiday = getHoliday(dateObj);
          const isToday=ds===todayStr;
          const dayEvs=events.filter((e:Event)=>e.inicio.startsWith(ds));
          
          let bgClass = "transparent";
          let borderClass = "1px solid transparent";
          let textClass = "var(--text-secondary)";
          let fontW = 400;

          if (isToday) {
            bgClass = "rgba(124,58,237,0.08)";
            borderClass = "1px solid rgba(124,58,237,0.4)";
            textClass = "var(--accent-violet)";
            fontW = 700;
          } else if (holiday || isWeekend) {
            bgClass = "rgba(239,68,68,0.03)";
            borderClass = "1px solid rgba(239,68,68,0.15)";
            textClass = "var(--accent-red)";
            fontW = 500;
          }

          return (
            <div key={d} onClick={()=>onDayClick(ds)} onDoubleClick={()=>onDayDblClick(ds)}
              style={{ minHeight:72, borderRadius:8, padding:"5px 6px", cursor:"pointer", background:bgClass, border:borderClass, transition:"all 0.15s" }}
              onMouseEnter={e=>{if(!isToday)(e.currentTarget as HTMLElement).style.background="var(--bg-hover)";}}
              onMouseLeave={e=>{if(!isToday)(e.currentTarget as HTMLElement).style.background=bgClass;}}
            >
              <div style={{ fontSize:12, fontWeight:fontW, color:textClass, marginBottom:3, display:"flex", justifyContent:"space-between" }}>
                <span>{d}</span>
              </div>
              {holiday && (
                <div style={{ background:"rgba(239,68,68,0.1)", borderLeft:"2px solid var(--accent-red)", borderRadius:3, padding:"1px 5px", fontSize:9, color:"var(--accent-red)", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  ★ {holiday}
                </div>
              )}
              {dayEvs.slice(0,2).map((ev:Event)=>(
                <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev);}} style={{ background:ev.cor+(ev.confirmado?"20":"0f"), borderLeft:`2px ${ev.confirmado?"solid":"dashed"} ${ev.cor}`, borderRadius:3, padding:"1px 5px", fontSize:10, color:ev.cor, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer", opacity:ev.confirmado?1:0.7 }}>
                  {!ev.diaTodo&&<span style={{ opacity:0.7 }}>{fmtTime(ev.inicio)} </span>}{!ev.confirmado&&"⏳ "}{ev.titulo}
                </div>
              ))}
              {dayEvs.length>2&&<div style={{ fontSize:9, color:"var(--text-muted)" }}>+{dayEvs.length-2}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ events, weekStart, onSlotClick, onEventClick }: any) {
  const today = new Date();
  const days = Array.from({length:7},(_,i)=>addDays(weekStart,i));
  return (
    <div className="card animate-up" style={{ overflow:"hidden" }}>
      <div style={{ display:"grid", gridTemplateColumns:"48px repeat(7,1fr)", borderBottom:"1px solid var(--border-subtle)" }}>
        <div />
        {days.map(d=>{
          const isToday=isSameDay(d,today);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const holiday = getHoliday(d);
          const isSpecial = isWeekend || !!holiday;
          
          let bgClass = "transparent";
          let numClass = "var(--text-primary)";
          let nameClass = "var(--text-muted)";
          if (isToday) {
            bgClass = "rgba(124,58,237,0.05)";
            numClass = "var(--accent-violet)";
            nameClass = "var(--accent-violet)";
          } else if (isSpecial) {
            bgClass = "rgba(239,68,68,0.02)";
            numClass = "var(--accent-red)";
            nameClass = "var(--accent-red)";
          }

          return (
            <div key={d.toISOString()} style={{ padding:"10px 4px", textAlign:"center", borderLeft:"1px solid var(--border-subtle)", background:bgClass }}>
              <div style={{ fontSize:11, color:nameClass, fontFamily:"var(--font-mono)", opacity:isToday?1:0.7 }}>{DAYS_SHORT[d.getDay()]}</div>
              <div style={{ fontSize:16, fontWeight:isToday?700:isSpecial?600:400, color:numClass, fontFamily:"var(--font-display)" }}>{d.getDate()}</div>
              {holiday && <div style={{ fontSize:9, color:"var(--accent-red)", marginTop:2, opacity:0.8 }}>{holiday.split(" ")[0]}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ overflowY:"auto", maxHeight:"calc(100vh - 260px)" }}>
        {HOURS.map(h=>(
          <div key={h} style={{ display:"grid", gridTemplateColumns:"48px repeat(7,1fr)", borderBottom:"1px solid rgba(162,130,255,0.05)", minHeight:56 }}>
            <div style={{ padding:"2px 8px 0 0", textAlign:"right", fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{String(h).padStart(2,"0")}:00</div>
            {days.map(d=>{
              const isToday=isSameDay(d,today);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const holiday = getHoliday(d);
              const isSpecial = isWeekend || !!holiday;
              
              let bgHover = "var(--bg-hover)";
              let bgBase = "transparent";
              if (isToday) { bgBase = "rgba(124,58,237,0.02)"; bgHover = "rgba(124,58,237,0.06)"; }
              else if (isSpecial) { bgBase = "rgba(239,68,68,0.01)"; bgHover = "rgba(239,68,68,0.04)"; }

              const slotEvs=events.filter((e:Event)=>{ if(!e.inicio)return false; const ed=new Date(e.inicio); return isSameDay(ed,d)&&ed.getHours()===h; });
              return (
                <div key={d.toISOString()} onClick={()=>{ const dt=new Date(d); dt.setHours(h,0,0,0); onSlotClick(toLocalISOStr(dt)); }}
                  style={{ borderLeft:"1px solid var(--border-subtle)", padding:"2px 3px", minHeight:56, cursor:"pointer", background:bgBase }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=bgHover}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=bgBase}
                >
                  {slotEvs.map((ev:Event)=>(
                    <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev);}} style={{ background:ev.cor+(ev.confirmado?"25":"10"), borderLeft:`2px ${ev.confirmado?"solid":"dashed"} ${ev.cor}`, borderRadius:4, padding:"2px 5px", fontSize:11, color:ev.cor, marginBottom:2, cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", opacity:ev.confirmado?1:0.72 }}>
                      {!ev.confirmado&&"⏳ "}{fmtTime(ev.inicio)} {ev.titulo}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ events, date, onSlotClick, onEventClick }: any) {
  const dayEvs = events.filter((e:Event)=>isSameDay(new Date(e.inicio),date));
  const allDay  = dayEvs.filter((e:Event)=>e.diaTodo);
  const timed   = dayEvs.filter((e:Event)=>!e.diaTodo);
  
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const holiday = getHoliday(date);
  const isSpecial = isWeekend || !!holiday;
  const bgHeader = isSpecial ? "rgba(239,68,68,0.04)" : "rgba(124,58,237,0.04)";
  const colorTitle = isSpecial ? "var(--accent-red)" : "inherit";

  return (
    <div className="card animate-up" style={{ overflow:"hidden" }}>
      <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border-subtle)", background:bgHeader }}>
        <div style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, color:colorTitle }}>
          {DAYS_FULL[date.getDay()]}, {date.getDate()} de {MONTHS[date.getMonth()]}
          {holiday && <span style={{ fontSize:13, fontWeight:500, marginLeft:8, opacity:0.8 }}>- {holiday}</span>}
        </div>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{dayEvs.length} evento{dayEvs.length!==1?"s":""}</div>
      </div>
      {allDay.length > 0 && (
        <div style={{ padding:"8px 20px", borderBottom:"1px solid var(--border-subtle)", display:"flex", flexWrap:"wrap", gap:6 }}>
          <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginRight:4 }}>DIA TODO</span>
          {allDay.map((ev:Event)=><div key={ev.id} onClick={()=>onEventClick(ev)} style={{ background:ev.cor+"20", border:`1px solid ${ev.cor}40`, borderRadius:6, padding:"3px 10px", fontSize:12, color:ev.cor, cursor:"pointer" }}>{ev.titulo}</div>)}
        </div>
      )}
      <div style={{ overflowY:"auto", maxHeight:"calc(100vh - 300px)" }}>
        {HOURS.map(h=>{
          const hEvs=timed.filter((e:Event)=>new Date(e.inicio).getHours()===h);
          return (
            <div key={h} style={{ display:"grid", gridTemplateColumns:"60px 1fr", borderBottom:"1px solid rgba(162,130,255,0.05)", minHeight:64 }}>
              <div style={{ padding:"6px 12px 0", fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{String(h).padStart(2,"0")}:00</div>
              <div onClick={()=>{ const dt=new Date(date); dt.setHours(h,0,0,0); onSlotClick(toLocalISOStr(dt)); }} style={{ padding:"4px 8px", cursor:"pointer", borderLeft:"1px solid var(--border-subtle)" }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
              >
                {hEvs.map((ev:Event)=>(
                  <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev);}} style={{ background:ev.cor+(ev.confirmado?"18":"0a"), borderLeft:`3px ${ev.confirmado?"solid":"dashed"} ${ev.cor}`, borderRadius:6, padding:"6px 12px", marginBottom:4, cursor:"pointer", opacity:ev.confirmado?1:0.75 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{!ev.confirmado&&<span style={{ opacity:0.8, marginRight:4 }}>⏳</span>}{ev.titulo}</div>
                    <div style={{ fontSize:11, color:ev.cor, marginTop:2 }}>{!ev.confirmado&&<span style={{ marginRight:4, fontSize:10 }}>Aguardando •</span>}{fmtTime(ev.inicio)}{ev.fim?` - ${fmtTime(ev.fim)}`:""}{ev.local?`  -  ${ev.local}`:""}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const { user: me } = useAuthStore();
  const today = new Date();
  const [view,      setView]      = useState<View>("mes");
  const [curDate,   setCurDate]   = useState(new Date());
  const [cur,       setCur]       = useState({ year:today.getFullYear(), month:today.getMonth()+1 });
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [events,    setEvents]    = useState<Event[]>([]);
  const [users,     setUsers]     = useState<Participante[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modalNew,  setModalNew]  = useState<string|null>(null);
  const [modalEdit, setModalEdit] = useState<Event|null>(null);
  const [modalDet,  setModalDet]  = useState<Event|null>(null);
  const [deleteId,  setDeleteId]  = useState<string|null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let params: any = {};
      if (view==="mes") { params.mes=cur.month; params.ano=cur.year; }
      else if (view==="semana") { params.inicio=weekStart.toISOString(); params.fim=addDays(weekStart,7).toISOString(); }
      else { const d=new Date(curDate); d.setHours(0,0,0,0); params.inicio=d.toISOString(); const e=new Date(curDate); e.setHours(23,59,59,999); params.fim=e.toISOString(); }
      const canSeeUsers = me?.isMaster || (me?.permissions || []).some(p => p === "*" || p === "usuarios:ver");
      const [evRes, usRes] = await Promise.all([
        api.get("/agenda",{params}),
        canSeeUsers ? api.get("/users") : Promise.resolve({ data: [] }),
      ]);
      setEvents(evRes.data); setUsers(usRes.data);
    } catch {} finally { setLoading(false); }
  }, [view, cur, weekStart, curDate]);

  useEffect(() => { load(); }, [load]);

  const prev = () => {
    if (view==="mes") setCur(c=>c.month===1?{year:c.year-1,month:12}:{...c,month:c.month-1});
    else if (view==="semana") setWeekStart(d=>addDays(d,-7));
    else setCurDate(d=>addDays(d,-1));
  };
  const next = () => {
    if (view==="mes") setCur(c=>c.month===12?{year:c.year+1,month:1}:{...c,month:c.month+1});
    else if (view==="semana") setWeekStart(d=>addDays(d,7));
    else setCurDate(d=>addDays(d,1));
  };
  const goToday = () => { setCur({year:today.getFullYear(),month:today.getMonth()+1}); setWeekStart(startOfWeek(today)); setCurDate(new Date()); };

  const periodLabel = () => {
    if (view==="mes") return `${MONTHS[cur.month-1]} ${cur.year}`;
    if (view==="semana") { const we=addDays(weekStart,6); return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0,3)} - ${we.getDate()} ${MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`; }
    return `${DAYS_FULL[curDate.getDay()]}, ${curDate.getDate()} de ${MONTHS[curDate.getMonth()]} ${curDate.getFullYear()}`;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.delete("/agenda/"+deleteId); await load(); setDeleteId(null); setModalDet(null); } catch {}
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        <Link href="/dashboard/agenda/disponibilidade">
          <button className="btn btn-ghost" style={{ fontSize:12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            Disponibilidade
          </button>
        </Link>
        <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>setModalNew(toLocalISOStr(new Date()))}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Novo evento
        </button>
      </Topbar>

      <div style={{ flex:1, overflowY:"auto", padding:"16px 24px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button className="btn-icon" onClick={prev}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round"/></svg></button>
            <div className="relative flex items-center justify-center gap-1">
              <div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                <h2 style={{ fontFamily:"var(--font-display)", fontSize:17, fontWeight:700 }}>{periodLabel()}</h2>
                <Calendar size={16} className="text-muted-foreground" />
              </div>
              
              {showDatePicker && (
                <>
                  <div className="fixed inset-0 z-[40]" onClick={() => setShowDatePicker(false)} />
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[280px] bg-white dark:bg-zinc-950/90 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-[50] animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <button className="p-1 hover:bg-accent rounded-md transition-colors" onClick={() => setPickerYear(y => y - 1)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round"/></svg>
                      </button>
                      <span className="font-display font-bold text-lg">{pickerYear}</span>
                      <button className="p-1 hover:bg-accent rounded-md transition-colors" onClick={() => setPickerYear(y => y + 1)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {MONTHS.map((m, idx) => (
                        <button 
                          key={m}
                          className={`py-2 px-1 text-[13px] font-medium rounded-lg transition-colors ${cur.year === pickerYear && cur.month === idx + 1 ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
                          onClick={() => {
                            const d = new Date(pickerYear, idx, 1, 12, 0, 0);
                            setCurDate(d);
                            setCur({ year: pickerYear, month: idx + 1 });
                            setWeekStart(startOfWeek(d));
                            setShowDatePicker(false);
                          }}
                        >
                          {m.slice(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button 
                      className="w-full mt-3 py-2 rounded-lg bg-accent text-[13px] font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() => {
                        goToday();
                        setShowDatePicker(false);
                      }}
                    >
                      Ir para Hoje
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="btn-icon" onClick={next}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round"/></svg></button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={goToday}>Hoje</button>
            <div style={{ display:"flex", gap:2, background:"var(--bg-glass)", border:"1px solid var(--border-subtle)", borderRadius:8, padding:3 }}>
              {(["mes","semana","dia"] as View[]).map(v=>(
                <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 12px", borderRadius:6, background:view===v?"var(--accent-violet)":"transparent", border:"none", color:view===v?"white":"var(--text-muted)", fontSize:12, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:view===v?600:400, transition:"all 0.15s", textTransform:"capitalize" }}>
                  {v==="mes"?"Mes":v==="semana"?"Semana":"Dia"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view==="mes" && <MonthView events={events} cur={cur} onDayClick={(ds:string)=>setCurDate(new Date(ds+"T12:00:00"))} onDayDblClick={(ds:string)=>setModalNew(ds+"T09:00")} onEventClick={(ev:Event)=>setModalDet(ev)} />}
        {view==="semana" && <WeekView events={events} weekStart={weekStart} onSlotClick={(dt:string)=>setModalNew(dt)} onEventClick={(ev:Event)=>setModalDet(ev)} />}
        {view==="dia" && <DayView events={events} date={curDate} onSlotClick={(dt:string)=>setModalNew(dt)} onEventClick={(ev:Event)=>setModalDet(ev)} />}
      </div>

      {(modalNew||modalEdit) && <EventModalAgenda date={modalNew||(modalEdit?.inicio.slice(0,16)??"")} event={modalEdit||undefined} users={users} onClose={()=>{setModalNew(null);setModalEdit(null);}} onSave={load} />}
      {modalDet && <EventDetail event={modalDet} me={me} onRespond={load} canEdit={modalDet.criadoPorId===me?.id||!!me?.isMaster} onClose={()=>setModalDet(null)} onEdit={()=>{setModalEdit(modalDet);setModalDet(null);}} onDelete={()=>setDeleteId(modalDet.recurringParentId||modalDet.id)} />}
      {deleteId && (
        <Modal title="Remover evento" onClose={()=>setDeleteId(null)}>
          <p style={{ color:"var(--text-secondary)", fontSize:13, marginBottom:24 }}>Tem certeza? Esta acao nao pode ser desfeita.</p>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setDeleteId(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex:2 }} onClick={handleDelete}>Remover</button>
          </div>
        </Modal>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}