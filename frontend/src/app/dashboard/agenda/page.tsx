"use client";
import EventModalAgenda from "@/components/ui/EventModalAgenda";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Calendar, CalendarDays, Users, Briefcase, Bell, ClipboardList, Keyboard, Printer } from "lucide-react";
import MiniCalendar from "@/components/agenda/MiniCalendar";
import UpcomingEventsList from "@/components/agenda/UpcomingEventsList";

const DAYS_SHORT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];
const DAYS_FULL   = ["Domingo","Segunda","Terca","Quarta","Quinta","Sexta","Sabado"];
const MONTHS      = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ── Tipos com ícone + cor padrão (item #6) ───────────────────────────────────
type TipoMeta = { value: string; label: string; icon: any; defaultColor: string };
const TIPO_META: TipoMeta[] = [
  { value: "REUNIAO",     label: "Reunião",     icon: Users,         defaultColor: "#22d3ee" },
  { value: "COMPROMISSO", label: "Compromisso", icon: CalendarDays,  defaultColor: "#a78bfa" },
  { value: "PROJETO",     label: "Projeto",     icon: Briefcase,     defaultColor: "#34d399" },
  { value: "LEMBRETE",    label: "Lembrete",    icon: Bell,          defaultColor: "#fbbf24" },
  { value: "PESSOAL",     label: "Pessoal",     icon: ClipboardList, defaultColor: "#f472b6" },
];
const tipoMeta = (t: string) => TIPO_META.find(x => x.value === t) || TIPO_META[1];

const CORES = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6","#fb923c","#a3e635","#94a3b8"];
const RECORRENCIAS = [
  { value:"", label:"Nao repetir" },
  { value:"DIARIA", label:"Diariamente" },
  { value:"SEMANAL", label:"Semanalmente" },
  { value:"QUINZENAL", label:"A cada 2 semanas" },
  { value:"MENSAL", label:"Mensalmente" },
];
const HOURS = Array.from({length:24},(_,i)=>i);
const HOUR_HEIGHT = 56; // px por slot de hora (usado em conflitos e linha do agora)

type Participante = { id: string; nome: string; email: string; };
type Event = { id: string; titulo: string; descricao?: string; inicio: string; fim?: string; tipo: string; cor: string; diaTodo: boolean; confirmado: boolean; criadoPorId: string; participants?: {user:Participante}[]; recorrencia?: string; local?: string; ata?: string; isRecurring?: boolean; recurringParentId?: string; userId?: string; };
type View = "mes"|"semana"|"dia";

function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("pt-BR"); }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function toLocalISOStr(d: Date) { const pad=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

// ── Feriados ───────────────────────────────────────────────────────────────────
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

// ── Item #1: diferenciar visualmente feriado vs FDS vs hoje ───────────────────
// Antes ambos usavam o mesmo vermelho. Agora cada caso tem visual próprio.
function dayVisual(date: Date) {
  const today = new Date();
  const isToday   = isSameDay(date, today);
  const dow       = date.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const holiday   = getHoliday(date);

  if (isToday) {
    return { bg: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.5)", color: "var(--accent-violet)", weight: 700, kind: "today" as const, holiday };
  }
  if (holiday) {
    // Feriado: vermelho real, com bg mais nítido
    return { bg: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--accent-red)", weight: 600, kind: "holiday" as const, holiday };
  }
  if (isWeekend) {
    // FDS: cinza esmaecido, NÃO compete por atenção
    return { bg: "rgba(148,163,184,0.04)", border: "1px solid transparent", color: "var(--text-muted)", weight: 400, kind: "weekend" as const, holiday: null };
  }
  return { bg: "transparent", border: "1px solid transparent", color: "var(--text-secondary)", weight: 400, kind: "normal" as const, holiday: null };
}

// ── Item #10: detecta conflitos (eventos sobrepostos no tempo) ────────────────
function detectConflicts(events: Event[]): Set<string> {
  const conflicts = new Set<string>();
  const timed = events.filter(e => !e.diaTodo && e.fim);
  for (let i = 0; i < timed.length; i++) {
    const a = timed[i];
    const aStart = new Date(a.inicio).getTime();
    const aEnd = new Date(a.fim!).getTime();
    for (let j = i + 1; j < timed.length; j++) {
      const b = timed[j];
      const bStart = new Date(b.inicio).getTime();
      const bEnd = new Date(b.fim!).getTime();
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}

// ── Item #2: hook que atualiza minuto a minuto para a linha "agora" ───────────
function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, 60_000); // a cada minuto
    return () => clearInterval(t);
  }, []);
  return now;
}

// ── Item #2: linha vermelha horizontal indicando hora atual ───────────────────
function NowLine({ visible }: { visible: boolean }) {
  const now = useNow();
  if (!visible) return null;
  const top = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: `${top}px`, pointerEvents: "none",
      zIndex: 5, display: "flex", alignItems: "center",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.6)", marginLeft: -4 }} />
      <div style={{ flex: 1, height: 2, background: "#ef4444", opacity: 0.85 }} />
    </div>
  );
}

// ── Modal genérico ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="modal-overlay no-print" role="dialog" aria-modal="true" aria-label={title} onClick={e=>{if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose();}}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:wide?680:520 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Item #14: modal de ajuda dos atalhos ──────────────────────────────────
function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const SHORTCUTS = [
    { keys: ["T"], desc: "Ir para hoje" },
    { keys: ["J"], desc: "Período anterior" },
    { keys: ["K"], desc: "Próximo período" },
    { keys: ["M"], desc: "Vista de mês" },
    { keys: ["W"], desc: "Vista de semana" },
    { keys: ["D"], desc: "Vista de dia" },
    { keys: ["N"], desc: "Criar novo evento" },
    { keys: ["Shift", "P"], desc: "Imprimir agenda" },
    { keys: ["?"], desc: "Mostrar esta ajuda" },
    { keys: ["Esc"], desc: "Fechar modal ou popover" },
  ];
  return (
    <Modal title="Atalhos de teclado" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SHORTCUTS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-hover)", borderRadius: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.desc}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {s.keys.map((k, j) => (
                <kbd key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", background: "var(--bg-glass)", border: "1px solid var(--border-subtle)", borderRadius: 4, color: "var(--text-primary)", boxShadow: "0 1px 0 var(--border-subtle)", minWidth: 26, textAlign: "center" }}>
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          Os atalhos não funcionam enquanto você está digitando em campos de texto.
        </p>
      </div>
    </Modal>
  );
}

function Field({ label, children }: any) {
  return <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>{label}</label>{children}</div>;
}

// ── Item #3: popover "+N eventos" — lista completa ao clicar ──────────────────
function MoreEventsPopover({ events, anchor, onClose, onPick }: { events: Event[]; anchor: { x: number; y: number }; onClose: () => void; onPick: (e: Event) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  return (
    <div ref={ref} style={{
      position: "fixed", top: anchor.y, left: anchor.x, zIndex: 100,
      background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10,
      boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: 8, minWidth: 240, maxHeight: 320, overflowY: "auto",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", padding: "4px 8px 6px" }}>
        {events.length} eventos
      </div>
      {events.map(ev => {
        const Icon = tipoMeta(ev.tipo).icon;
        return (
          <button key={ev.id} onClick={() => { onPick(ev); onClose(); }}
            style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-primary)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <Icon size={12} style={{ color: ev.cor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.titulo}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{ev.diaTodo ? "Dia todo" : fmtTime(ev.inicio)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Item #8: skeleton de loading ─────────────────────────────────────────────
function CalendarSkeleton({ view }: { view: View }) {
  if (view === "mes") {
    return (
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
          {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: "4px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} style={{ minHeight: 96, borderRadius: 8, background: "var(--bg-hover)", opacity: 0.4, animation: `pulse 1.5s ease-in-out ${i * 0.02}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 16, minHeight: 400 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ height: 40, borderRadius: 6, background: "var(--bg-hover)", opacity: 0.4, animation: `pulse 1.5s ease-in-out ${i * 0.05}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ── Item #9: estado vazio ─────────────────────────────────────────────────────
function EmptyState({ onCreate, period }: { onCreate: () => void; period: string }) {
  return (
    <div className="card" style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(124,58,237,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Calendar size={28} style={{ color: "var(--accent-violet)" }} />
      </div>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Nenhum evento {period}</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Comece criando seu primeiro evento — clique em qualquer dia ou no botão acima.</p>
      </div>
      <button className="btn btn-violet" style={{ fontSize: 12, marginTop: 4 }} onClick={onCreate}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
        Criar evento agora
      </button>
    </div>
  );
}

// ── EventModal (com cor custom + ícone por tipo) ─────────────────────────────
function EventModal({ date, event, users, onClose, onSave }: any) {
  const { user: me } = useAuthStore();
  const [titulo,      setTitulo]      = useState(event?.titulo||"");
  const [descricao,   setDescricao]   = useState(event?.descricao||"");
  const [inicio,      setInicio]      = useState(event?event.inicio.slice(0,16):date+"T09:00");
  const [fim,         setFim]         = useState(event?.fim?event.fim.slice(0,16):date+"T10:00");
  const [tipo,        setTipo]        = useState(event?.tipo||"REUNIAO");
  const [cor,         setCor]         = useState(event?.cor||tipoMeta(event?.tipo||"REUNIAO").defaultColor);
  const [diaTodo,     setDiaTodo]     = useState(event?.diaTodo||false);
  const [local,       setLocal]       = useState(event?.local||"");
  const [recorrencia, setRecorrencia] = useState(event?.recorrencia||"");
  const [recFim,      setRecFim]      = useState("");
  const [partic,      setPartic]      = useState<string[]>(event?.participants?.map((p:any)=>p.user.id).filter((id:string)=>id!==me?.id)||[]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const isEdit = !!event;

  // Item #5: quando muda o tipo, atualiza a cor pra default daquele tipo (se ainda não customizou)
  const onTipoChange = (t: string) => {
    if (cor === tipoMeta(tipo).defaultColor) setCor(tipoMeta(t).defaultColor);
    setTipo(t);
  };

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
        {/* Item #6: tipo com ícone visível na lista */}
        <Field label="TIPO">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {TIPO_META.map(t => {
              const Icon = t.icon;
              const active = tipo === t.value;
              return (
                <button key={t.value} onClick={() => onTipoChange(t.value)} type="button"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px",
                    border: active ? `1px solid ${t.defaultColor}` : "1px solid var(--border-subtle)",
                    background: active ? `${t.defaultColor}15` : "transparent",
                    color: active ? t.defaultColor : "var(--text-muted)",
                    borderRadius: 8, cursor: "pointer", fontSize: 10, transition: "all 0.15s",
                  }}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="RECORRENCIA"><select className="input-o" value={recorrencia} onChange={e=>setRecorrencia(e.target.value)}>{RECORRENCIAS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
        {recorrencia && <div style={{ gridColumn:"1/-1" }}><Field label="REPETIR ATE"><input className="input-o" type="date" value={recFim} onChange={e=>setRecFim(e.target.value)} /></Field></div>}
        {/* Item #5: paleta + cor customizada */}
        <div style={{ gridColumn:"1/-1" }}>
          <Field label="COR">
            <div style={{ display:"flex", gap:8, alignItems: "center", flexWrap: "wrap" }}>
              {CORES.map(c=><button key={c} type="button" onClick={()=>setCor(c)} style={{ width:26, height:26, borderRadius:"50%", background:c, border:cor===c?"3px solid white":"3px solid transparent", cursor:"pointer", outline:"none", boxShadow:cor===c?`0 0 0 2px ${c}`:"none" }} />)}
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 8px", borderRadius: 6, background: "var(--bg-hover)", border: "1px dashed var(--border-subtle)" }}>
                <input type="color" value={cor} onChange={e => setCor(e.target.value)} style={{ width: 18, height: 18, padding: 0, border: "none", background: "transparent", cursor: "pointer" }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Custom</span>
              </label>
            </div>
          </Field>
        </div>
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
  const TipoIcon = tipoMeta(event.tipo).icon;

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
          <div style={{ width:36, height:36, borderRadius:8, background: event.cor+"22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
            <TipoIcon size={18} style={{ color: event.cor }} />
          </div>
          <div style={{ flex:1 }}>
            <h2 style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, marginBottom:6 }}>{event.titulo}</h2>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              <span className="badge badge-violet">{tipoMeta(event.tipo).label}</span>
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

// ── Pílula visual de evento (compacta) ───────────────────────────────────────
function EventPill({ ev, conflict, onClick }: { ev: Event; conflict: boolean; onClick: (e: React.MouseEvent) => void }) {
  const Icon = tipoMeta(ev.tipo).icon;
  return (
    <div onClick={onClick} title={conflict ? `⚠️ Conflito de horário: ${ev.titulo}` : ev.titulo}
      style={{
        background: ev.cor + (ev.confirmado ? "20" : "0f"),
        borderLeft: `2px ${ev.confirmado ? "solid" : "dashed"} ${ev.cor}`,
        borderRight: conflict ? `2px solid #ef4444` : undefined,
        borderRadius: 3, padding: "1px 5px", fontSize: 10, color: ev.cor,
        marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        cursor: "pointer", opacity: ev.confirmado ? 1 : 0.7,
        display: "flex", alignItems: "center", gap: 3,
      }}
    >
      <Icon size={9} style={{ flexShrink: 0 }} />
      {conflict && <span style={{ fontSize: 9 }}>⚠️</span>}
      {!ev.diaTodo && <span style={{ opacity: 0.7, flexShrink: 0 }}>{fmtTime(ev.inicio)}</span>}
      {!ev.confirmado && <span>⏳</span>}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.titulo}</span>
    </div>
  );
}

// ── MONTH VIEW ────────────────────────────────────────────────────────────────
function MonthView({ events, cur, onDayClick, onDayDblClick, onEventClick, selectedDate }: any) {
  const daysInMonth = new Date(cur.year, cur.month, 0).getDate();
  const firstDay = new Date(cur.year, cur.month-1, 1).getDay();
  const dayStr = (d:number) => `${cur.year}-${String(cur.month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const [more, setMore] = useState<{ events: Event[]; anchor: { x: number; y: number } } | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // item #10
  const conflicts = detectConflicts(events);

  // ── Lógica de clique inteligente — funciona em desktop E mobile ──────────
  // - Clique único em dia diferente → seleciona dia (sem abrir modal)
  // - Clique único em dia JÁ selecionado → abre modal de criação (mobile-friendly)
  // - Duplo clique em qualquer dia → abre modal (desktop)
  // - Clique no botão "+" no canto → abre modal direto
  const handleDayClick = (ds: string, dateObj: Date) => {
    if (selectedDate && isSameDay(dateObj, selectedDate)) {
      onDayDblClick(ds);   // segundo clique no mesmo dia = criar evento
    } else {
      onDayClick(ds);      // primeiro clique = selecionar
    }
  };

  return (
    <div className="card animate-up" style={{ padding:16, position: "relative" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
        {DAYS_SHORT.map(d=><div key={d} style={{ textAlign:"center", fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", padding:"4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i} />)}
        {Array(daysInMonth).fill(null).map((_,i)=>{
          const d=i+1; const ds=dayStr(d);
          const dateObj = new Date(cur.year, cur.month-1, d);
          const vis = dayVisual(dateObj);                                 // item #1
          const dayEvs = events.filter((e:Event)=>e.inicio.startsWith(ds));
          const visible = dayEvs.slice(0, 3);                             // item #3: agora mostra 3
          const overflow = dayEvs.length - visible.length;

          const isSelected = selectedDate && isSameDay(dateObj, selectedDate);
          const isHovered  = hoveredDay === d;

          return (
            <div
              key={d}
              onClick={() => handleDayClick(ds, dateObj)}
              onDoubleClick={() => onDayDblClick(ds)}
              role="button"
              tabIndex={0}
              aria-label={`${d} de ${MONTHS[cur.month-1]}, ${dayEvs.length} evento${dayEvs.length !== 1 ? "s" : ""}. Duplo clique para criar.`}
              title="Duplo clique para criar evento"
              onKeyDown={(e) => {
                if (e.key === "Enter") onDayDblClick(ds);
              }}
              style={{
                minHeight: 96, borderRadius: 8, padding: "5px 6px", cursor: "pointer",
                background: vis.bg, border: isSelected ? "1px solid var(--accent-violet)" : vis.border,
                transition: "all 0.15s",
                position: "relative",
              }}
              onMouseEnter={e=>{ setHoveredDay(d); if(vis.kind!=="today") (e.currentTarget as HTMLElement).style.background="var(--bg-hover)"; }}
              onMouseLeave={e=>{ setHoveredDay(null); if(vis.kind!=="today") (e.currentTarget as HTMLElement).style.background=vis.bg; }}
            >
              {/* Botão "+" que aparece no hover — terceira forma de criar (a mais óbvia visualmente) */}
              {isHovered && (
                <button
                  className="no-print"
                  onClick={(e) => { e.stopPropagation(); onDayDblClick(ds); }}
                  aria-label={`Criar evento no dia ${d}`}
                  title="Criar evento neste dia"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: "var(--accent-violet)",
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    boxShadow: "0 2px 6px rgba(124,58,237,0.4)",
                  }}
                >
                  +
                </button>
              )}
              <div style={{ fontSize:12, fontWeight: vis.weight, color: vis.color, marginBottom:3, display:"flex", justifyContent:"space-between", alignItems: "center" }}>
                <span>{d}</span>
                {vis.kind === "today" && !isHovered && <span style={{ fontSize: 8, fontFamily: "var(--font-mono)", background: "var(--accent-violet)", color: "white", padding: "1px 5px", borderRadius: 3 }}>HOJE</span>}
              </div>
              {vis.holiday && (
                <div style={{ background:"rgba(239,68,68,0.1)", borderLeft:"2px solid var(--accent-red)", borderRadius:3, padding:"1px 5px", fontSize:9, color:"var(--accent-red)", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  ★ {vis.holiday}
                </div>
              )}
              {visible.map((ev:Event)=>(
                <EventPill key={ev.id} ev={ev} conflict={conflicts.has(ev.id)} onClick={e=>{e.stopPropagation(); onEventClick(ev);}} />
              ))}
              {overflow > 0 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setMore({ events: dayEvs, anchor: { x: rect.left, y: rect.bottom + 4 } });
                  }}
                  style={{
                    fontSize: 9, color: "var(--accent-violet)", background: "transparent", border: "none",
                    cursor: "pointer", padding: "0 4px", fontWeight: 600,
                  }}
                >
                  +{overflow} mais
                </button>
              )}
            </div>
          );
        })}
      </div>
      {more && <MoreEventsPopover events={more.events} anchor={more.anchor} onClose={() => setMore(null)} onPick={onEventClick} />}
    </div>
  );
}

// ── WEEK VIEW ─────────────────────────────────────────────────────────────────
function WeekView({ events, weekStart, onSlotClick, onEventClick }: any) {
  const days = Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const today = new Date();
  const showNowLine = days.some(d => isSameDay(d, today));    // item #2
  const conflicts = detectConflicts(events);                   // item #10
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para 7h ao montar (item bônus: não começa às 0h vazio)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  return (
    <div className="card animate-up" style={{ overflow:"hidden" }}>
      <div style={{ display:"grid", gridTemplateColumns:"48px repeat(7,1fr)", borderBottom:"1px solid var(--border-subtle)" }}>
        <div />
        {days.map(d=>{
          const vis = dayVisual(d);                            // item #1
          return (
            <div key={d.toISOString()} style={{ padding:"10px 4px", textAlign:"center", borderLeft:"1px solid var(--border-subtle)", background: vis.bg }}>
              <div style={{ fontSize:11, color: vis.color, fontFamily:"var(--font-mono)", opacity: vis.kind === "today" ? 1 : 0.7 }}>{DAYS_SHORT[d.getDay()]}</div>
              <div style={{ fontSize:16, fontWeight: vis.weight, color: vis.color, fontFamily:"var(--font-display)" }}>{d.getDate()}</div>
              {vis.holiday && <div style={{ fontSize:9, color:"var(--accent-red)", marginTop:2, opacity:0.85 }}>{vis.holiday.split(" ")[0]}</div>}
            </div>
          );
        })}
      </div>
      <div ref={scrollRef} style={{ overflowY:"auto", maxHeight:"calc(100vh - 260px)", position: "relative" }}>
        {/* item #2: linha do agora — posicionada absoluta no container scrollável */}
        <NowLine visible={showNowLine} />
        {HOURS.map(h=>(
          <div key={h} style={{ display:"grid", gridTemplateColumns:"48px repeat(7,1fr)", borderBottom:"1px solid rgba(162,130,255,0.05)", minHeight: HOUR_HEIGHT }}>
            <div style={{ padding:"2px 8px 0 0", textAlign:"right", fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{String(h).padStart(2,"0")}:00</div>
            {days.map(d=>{
              const vis = dayVisual(d);
              const slotBg = vis.bg !== "transparent" ? vis.bg : "transparent";
              const slotEvs=events.filter((e:Event)=>{ if(!e.inicio)return false; const ed=new Date(e.inicio); return isSameDay(ed,d)&&ed.getHours()===h; });
              return (
                <div key={d.toISOString()} onClick={()=>{ const dt=new Date(d); dt.setHours(h,0,0,0); onSlotClick(toLocalISOStr(dt)); }}
                  style={{ borderLeft:"1px solid var(--border-subtle)", padding:"2px 3px", minHeight: HOUR_HEIGHT, cursor:"pointer", background: slotBg }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=slotBg}
                >
                  {slotEvs.map((ev:Event)=>(
                    <EventPill key={ev.id} ev={ev} conflict={conflicts.has(ev.id)} onClick={e=>{e.stopPropagation();onEventClick(ev);}} />
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

// ── DAY VIEW ──────────────────────────────────────────────────────────────────
function DayView({ events, date, onSlotClick, onEventClick }: any) {
  const dayEvs = events.filter((e:Event)=>isSameDay(new Date(e.inicio),date));
  const allDay  = dayEvs.filter((e:Event)=>e.diaTodo);
  const timed   = dayEvs.filter((e:Event)=>!e.diaTodo);
  const vis = dayVisual(date);                                  // item #1
  const showNowLine = isSameDay(date, new Date());               // item #2
  const conflicts = detectConflicts(events);                     // item #10
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  return (
    <div className="card animate-up" style={{ overflow:"hidden" }}>
      <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border-subtle)", background: vis.bg }}>
        <div style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, color: vis.color }}>
          {DAYS_FULL[date.getDay()]}, {date.getDate()} de {MONTHS[date.getMonth()]}
          {vis.holiday && <span style={{ fontSize:13, fontWeight:500, marginLeft:8, opacity:0.8 }}>· {vis.holiday}</span>}
          {vis.kind === "today" && <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", background: "var(--accent-violet)", color: "white", padding: "2px 8px", borderRadius: 4, marginLeft: 10, verticalAlign: "middle" }}>HOJE</span>}
        </div>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{dayEvs.length} evento{dayEvs.length!==1?"s":""}</div>
      </div>
      {allDay.length > 0 && (
        <div style={{ padding:"8px 20px", borderBottom:"1px solid var(--border-subtle)", display:"flex", flexWrap:"wrap", gap:6 }}>
          <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginRight:4 }}>DIA TODO</span>
          {allDay.map((ev:Event)=>{
            const Icon = tipoMeta(ev.tipo).icon;
            return (
              <div key={ev.id} onClick={()=>onEventClick(ev)} style={{ background:ev.cor+"20", border:`1px solid ${ev.cor}40`, borderRadius:6, padding:"3px 10px", fontSize:12, color:ev.cor, cursor:"pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Icon size={11} /> {ev.titulo}
              </div>
            );
          })}
        </div>
      )}
      <div ref={scrollRef} style={{ overflowY:"auto", maxHeight:"calc(100vh - 300px)", position: "relative" }}>
        <NowLine visible={showNowLine} />
        {HOURS.map(h=>{
          const hEvs=timed.filter((e:Event)=>new Date(e.inicio).getHours()===h);
          return (
            <div key={h} style={{ display:"grid", gridTemplateColumns:"60px 1fr", borderBottom:"1px solid rgba(162,130,255,0.05)", minHeight: HOUR_HEIGHT }}>
              <div style={{ padding:"6px 12px 0", fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{String(h).padStart(2,"0")}:00</div>
              <div onClick={()=>{ const dt=new Date(date); dt.setHours(h,0,0,0); onSlotClick(toLocalISOStr(dt)); }} style={{ padding:"4px 8px", cursor:"pointer", borderLeft:"1px solid var(--border-subtle)" }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
              >
                {hEvs.map((ev:Event)=>{
                  const Icon = tipoMeta(ev.tipo).icon;
                  const isConflict = conflicts.has(ev.id);
                  return (
                    <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev);}}
                      title={isConflict ? "⚠️ Conflito de horário" : undefined}
                      style={{
                        background: ev.cor + (ev.confirmado ? "18" : "0a"),
                        borderLeft: `3px ${ev.confirmado ? "solid" : "dashed"} ${ev.cor}`,
                        borderRight: isConflict ? `3px solid #ef4444` : undefined,
                        borderRadius: 6, padding: "6px 12px", marginBottom: 4, cursor: "pointer",
                        opacity: ev.confirmado ? 1 : 0.75,
                      }}
                    >
                      <div style={{ fontSize:13, fontWeight:500, display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon size={12} style={{ color: ev.cor, opacity: 0.8 }} />
                        {isConflict && <span style={{ color: "#ef4444" }}>⚠️</span>}
                        {!ev.confirmado && <span style={{ opacity:0.8 }}>⏳</span>}
                        <span>{ev.titulo}</span>
                      </div>
                      <div style={{ fontSize:11, color:ev.cor, marginTop:2, paddingLeft: 18 }}>
                        {!ev.confirmado && <span style={{ marginRight: 4, fontSize: 10 }}>Aguardando •</span>}
                        {fmtTime(ev.inicio)}{ev.fim?` - ${fmtTime(ev.fim)}`:""}{ev.local?`  ·  ${ev.local}`:""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
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
  const [showHelp, setShowHelp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let params: any = {};
      if (view==="mes") { params.mes=cur.month; params.ano=cur.year; }
      else if (view==="semana") { params.inicio=weekStart.toISOString(); params.fim=addDays(weekStart,7).toISOString(); }
      else { const d=new Date(curDate); d.setHours(0,0,0,0); params.inicio=d.toISOString(); const e=new Date(curDate); e.setHours(23,59,59,999); params.fim=e.toISOString(); }
      const [evRes, usRes] = await Promise.all([
        api.get("/agenda",{params}),
        api.get("/users/picklist").catch(() => ({ data: [] })),
      ]);
      setEvents(evRes.data); setUsers(usRes.data);
    } catch {} finally { setLoading(false); }
  }, [view, cur, weekStart, curDate]);

  useEffect(() => { load(); }, [load]);

  // ── Item #14: atalhos de teclado ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignora quando digitando em input/textarea/select ou com modal aberto
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const anyModalOpen = !!(modalNew || modalEdit || modalDet || deleteId || showHelp || showDatePicker);

      if (e.key === "Escape") {
        if (showHelp) setShowHelp(false);
        else if (showDatePicker) setShowDatePicker(false);
        else if (deleteId) setDeleteId(null);
        else if (modalNew) setModalNew(null);
        else if (modalEdit) setModalEdit(null);
        else if (modalDet) setModalDet(null);
        return;
      }
      if (anyModalOpen) return; // só atalhos com tudo fechado

      switch (e.key.toLowerCase()) {
        case "t": goToday(); break;
        case "j": prev(); break;
        case "k": next(); break;
        case "m": setView("mes"); break;
        case "w": setView("semana"); break;
        case "d": setView("dia"); break;
        case "n": setModalNew(toLocalISOStr(new Date())); break;
        case "?": setShowHelp(true); break;
        case "/": e.preventDefault(); setShowHelp(true); break;
        case "p": if (e.shiftKey) window.print(); break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cur, weekStart, curDate, modalNew, modalEdit, modalDet, deleteId, showHelp, showDatePicker]);

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

  // ── Item #11: helpers do mini-calendar ──────────────────────────────────
  // Atualiza o período de exibição para incluir a data clicada (mantém a vista).
  const selectDate = (d: Date) => {
    setCurDate(d);
    setCur({ year: d.getFullYear(), month: d.getMonth() + 1 });
    setWeekStart(startOfWeek(d));
  };
  // Set de YYYY-MM-DD com pelo menos 1 evento — alimenta os pontinhos do mini.
  const eventDateSet = (() => {
    const s = new Set<string>();
    for (const e of events) s.add(e.inicio.slice(0, 10));
    return s;
  })();

  const periodLabel = () => {
    if (view==="mes") return `${MONTHS[cur.month-1]} ${cur.year}`;
    if (view==="semana") { const we=addDays(weekStart,6); return `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0,3)} - ${we.getDate()} ${MONTHS[we.getMonth()].slice(0,3)} ${we.getFullYear()}`; }
    return `${DAYS_FULL[curDate.getDay()]}, ${curDate.getDate()} de ${MONTHS[curDate.getMonth()]} ${curDate.getFullYear()}`;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.delete("/agenda/"+deleteId); await load(); setDeleteId(null); setModalDet(null); } catch {}
  };

  // empty state: nenhum evento no período (item #9)
  const isEmpty = !loading && events.length === 0;
  const emptyPeriod = view === "mes" ? "neste mês" : view === "semana" ? "nesta semana" : "neste dia";

  return (
    <div className="agenda-printable" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        <Link href="/dashboard/agenda/disponibilidade" className="no-print">
          <button className="btn btn-ghost" style={{ fontSize:12 }} aria-label="Ver disponibilidade da equipe">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            Disponibilidade
          </button>
        </Link>
        <button className="btn btn-ghost no-print" style={{ fontSize:12 }} onClick={() => setShowHelp(true)} aria-label="Ver atalhos de teclado" title="Atalhos de teclado (?)">
          <Keyboard size={13} aria-hidden="true" />
        </button>
        <button className="btn btn-ghost no-print" style={{ fontSize:12 }} onClick={() => window.print()} aria-label="Imprimir agenda" title="Imprimir (Shift+P)">
          <Printer size={13} aria-hidden="true" />
        </button>
        <button className="btn btn-violet no-print" style={{ fontSize:12 }} onClick={()=>setModalNew(toLocalISOStr(new Date()))} aria-label="Criar novo evento">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Novo evento
        </button>
      </Topbar>

      <div style={{ flex:1, overflowY:"auto", padding:"16px 24px 24px" }} className="agenda-content">
       <div className="agenda-layout" style={{
         display: "grid",
         gridTemplateColumns: "240px minmax(0, 1fr)",
         gap: 20,
         alignItems: "start",
       }}>
        {/* ── Sidebar (mini-calendar + próximos eventos) — item #11 ── */}
        <aside className="agenda-sidebar no-print" style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0 }}>
          <MiniCalendar
            selectedDate={curDate}
            eventDates={eventDateSet}
            onChange={selectDate}
          />
          <UpcomingEventsList
            events={events as any}
            limit={6}
            onPick={(ev) => setModalDet(ev as any)}
          />
        </aside>

        {/* ── Calendário principal ──────────────────────────────────── */}
        <main className="agenda-main" style={{ minWidth: 0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }} className="no-print">
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button className="btn-icon" onClick={prev} aria-label="Período anterior" title="Anterior (J)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" strokeLinecap="round"/></svg></button>
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
            <button className="btn-icon" onClick={next} aria-label="Próximo período" title="Próximo (K)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 18l6-6-6-6" strokeLinecap="round"/></svg></button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={goToday} aria-label="Ir para hoje" title="Hoje (T)">Hoje</button>
            <div role="tablist" aria-label="Modo de visualização" style={{ display:"flex", gap:2, background:"var(--bg-glass)", border:"1px solid var(--border-subtle)", borderRadius:8, padding:3 }}>
              {(["mes","semana","dia"] as View[]).map(v=>{
                const labels = { mes: "Mês (M)", semana: "Semana (W)", dia: "Dia (D)" };
                return (
                  <button key={v} role="tab" aria-selected={view===v} aria-label={labels[v]} title={labels[v]} onClick={()=>setView(v)} style={{ padding:"5px 12px", borderRadius:6, background:view===v?"var(--accent-violet)":"transparent", border:"none", color:view===v?"white":"var(--text-muted)", fontSize:12, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:view===v?600:400, transition:"all 0.15s", textTransform:"capitalize" }}>
                    {v==="mes"?"Mes":v==="semana"?"Semana":"Dia"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* item #8: skeleton enquanto carrega */}
        {loading && <CalendarSkeleton view={view} />}

        {/* item #9: empty state quando carregou e não tem nada */}
        {isEmpty && <EmptyState period={emptyPeriod} onCreate={() => setModalNew(toLocalISOStr(new Date()))} />}

        {!loading && !isEmpty && view==="mes" && <MonthView events={events} cur={cur} selectedDate={curDate} onDayClick={(ds:string)=>setCurDate(new Date(ds+"T12:00:00"))} onDayDblClick={(ds:string)=>setModalNew(ds+"T09:00")} onEventClick={(ev:Event)=>setModalDet(ev)} />}
        {!loading && !isEmpty && view==="semana" && <WeekView events={events} weekStart={weekStart} onSlotClick={(dt:string)=>setModalNew(dt)} onEventClick={(ev:Event)=>setModalDet(ev)} />}
        {!loading && !isEmpty && view==="dia" && <DayView events={events} date={curDate} onSlotClick={(dt:string)=>setModalNew(dt)} onEventClick={(ev:Event)=>setModalDet(ev)} />}
        </main>
       </div>
      </div>

      {/* Título de impressão — só visível em print */}
      <div className="print-only" style={{ display: "none" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Agenda — {periodLabel()}</h1>
        <p style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>
          Impresso em {new Date().toLocaleString("pt-BR")} · {events.length} evento{events.length !== 1 ? "s" : ""}
        </p>
      </div>

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
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
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.6}}

        /* ── Acessibilidade: foco visível ─────────────────────────────── */
        .agenda-printable button:focus-visible,
        .agenda-printable [role="button"]:focus-visible,
        .agenda-printable a:focus-visible {
          outline: 2px solid var(--accent-violet);
          outline-offset: 2px;
          border-radius: 6px;
        }

        /* ── Item #11: layout responsivo da sidebar ───────────────────── */
        @media (max-width: 1024px) {
          .agenda-layout {
            grid-template-columns: 1fr !important;
          }
          .agenda-sidebar {
            display: none !important;
          }
        }

        /* ── Item #16: print-friendly ─────────────────────────────────── */
        @media print {
          .no-print, [aria-label="Fechar"] { display: none !important; }
          .print-only { display: block !important; }

          body, html { background: white !important; color: black !important; }
          .agenda-printable { width: 100%; padding: 0 !important; }
          .agenda-content { overflow: visible !important; padding: 0 !important; }
          /* sidebar não imprime (já está no .no-print acima, mas reforça) */
          .agenda-layout { grid-template-columns: 1fr !important; }

          /* Cards limpos, sem sombra */
          .card { border: 1px solid #999 !important; box-shadow: none !important;
                  background: white !important; color: black !important; }

          /* Preserva cores dos eventos */
          [style*="background"], [style*="border"] { print-color-adjust: exact !important;
                                                     -webkit-print-color-adjust: exact !important; }

          /* Layout de quebra de página */
          h1, h2, h3 { page-break-after: avoid; }

          /* Mês: garante grid legível */
          .card[style*="padding:16"] { padding: 8px !important; }
        }
      `}</style>
    </div>
  );
}
