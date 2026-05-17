"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";

type ChecklistItem = { id: string; descricao: string; concluido: boolean; };
type Checklist     = { id: string; items: ChecklistItem[]; };
type Note = { id: string; titulo?: string; conteudo?: string; cor?: string; fixado: boolean; arquivado: boolean; lixeira: boolean; tipo: string; checklists: Checklist[]; atualizadoEm: string; };
type DailyTask = { id: string; titulo: string; concluido: boolean; tipo: string; data: string; };

const NOTE_COLORS = [
  { value:"",        bg:"var(--bg-card)",          border:"var(--border-subtle)" },
  { value:"#581c87", bg:"rgba(88,28,135,0.2)",     border:"rgba(139,92,246,0.35)" },
  { value:"#164e63", bg:"rgba(22,78,99,0.2)",      border:"rgba(34,211,238,0.3)" },
  { value:"#14532d", bg:"rgba(20,83,45,0.2)",      border:"rgba(52,211,153,0.3)" },
  { value:"#713f12", bg:"rgba(113,63,18,0.2)",     border:"rgba(251,191,36,0.3)" },
  { value:"#7f1d1d", bg:"rgba(127,29,29,0.2)",     border:"rgba(248,113,113,0.3)" },
];
const TASK_TIPOS = ["TAREFA","COMPROMISSO","HABITO"];
const TIPO_COLORS: Record<string,string> = { TAREFA:"var(--accent-violet)", COMPROMISSO:"var(--accent-amber)", HABITO:"var(--accent-green)" };

function getNoteStyle(cor?: string) {
  const c = NOTE_COLORS.find(n => n.value === (cor||"")) || NOTE_COLORS[0];
  return { background: c.bg, borderColor: c.border };
}

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

function NoteCard({ note, onUpdate, onDelete }: { note: Note; onUpdate: (id: string, data: any) => void; onDelete: (id: string) => void; }) {
  const [editing,  setEditing]  = useState(false);
  const [titulo,   setTitulo]   = useState(note.titulo || "");
  const [conteudo, setConteudo] = useState(note.conteudo || "");
  const [newItem,  setNewItem]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const noteStyle = getNoteStyle(note.cor);

  const save = async () => {
    setSaving(true);
    try { await onUpdate(note.id, { titulo, conteudo }); setEditing(false); }
    catch {} finally { setSaving(false); }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    await api.post("/keep/notes/"+note.id+"/checklist", { descricao: newItem });
    setNewItem("");
    onUpdate(note.id, {});
  };

  const toggleItem = async (itemId: string, concluido: boolean) => {
    await api.patch("/keep/notes/"+note.id+"/checklist/"+itemId, { concluido: !concluido });
    onUpdate(note.id, {});
  };

  const deleteItem = async (itemId: string) => {
    await api.delete("/keep/notes/"+note.id+"/checklist/"+itemId);
    onUpdate(note.id, {});
  };

  const allItems = note.checklists.flatMap(c => c.items);
  const doneCount = allItems.filter(i => i.concluido).length;

  return (
    <div style={{ ...noteStyle, border:"1px solid", borderRadius:14, padding:"14px 16px", display:"flex", flexDirection:"column", gap:10, transition:"all 0.2s", position:"relative", breakInside:"avoid", marginBottom:12 }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "translateY(0)"}
    >
      {note.fixado && (
        <div style={{ position:"absolute", top:10, right:10 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent-amber)" stroke="var(--accent-amber)" strokeWidth="1"><path d="M12 2L8.5 8.5 2 9.27l5 4.87L5.82 21 12 17.77 18.18 21l-1.18-6.86L22 9.27l-6.5-.77z"/></svg>
        </div>
      )}

      {editing ? (
        <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Titulo (opcional)" style={{ background:"transparent", border:"none", outline:"none", fontSize:14, fontWeight:600, color:"var(--text-primary)", fontFamily:"var(--font-display)", width:"100%", padding:0 }} />
      ) : (
        note.titulo && <div style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", fontFamily:"var(--font-display)", paddingRight:20 }}>{note.titulo}</div>
      )}

      {note.tipo === "TEXTO" && (
        editing ? (
          <textarea value={conteudo} onChange={e=>setConteudo(e.target.value)} placeholder="Escreva sua nota..." style={{ background:"transparent", border:"none", outline:"none", fontSize:13, color:"var(--text-secondary)", resize:"none", minHeight:60, fontFamily:"var(--font-body)", lineHeight:1.6, width:"100%", padding:0 }} />
        ) : (
          <div onClick={()=>setEditing(true)} style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, cursor:"text", minHeight:40, whiteSpace:"pre-wrap" }}>
            {note.conteudo || <span style={{ color:"var(--text-muted)", fontStyle:"italic" }}>Clique para editar...</span>}
          </div>
        )
      )}

      {note.tipo === "CHECKLIST" && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {allItems.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>toggleItem(item.id, item.concluido)} style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${item.concluido?"var(--accent-green)":"var(--border-medium)"}`, background:item.concluido?"var(--accent-green)":"transparent", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {item.concluido && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round"/></svg>}
              </button>
              <span style={{ fontSize:13, color:item.concluido?"var(--text-muted)":"var(--text-primary)", textDecoration:item.concluido?"line-through":"none", flex:1 }}>{item.descricao}</span>
              <button onClick={()=>deleteItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", display:"flex", padding:2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
          {allItems.length > 0 && (
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{doneCount}/{allItems.length} concluidos</div>
          )}
          <div style={{ display:"flex", gap:6, marginTop:4 }}>
            <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Novo item..." style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid var(--border-subtle)", borderRadius:6, padding:"5px 10px", fontSize:12, color:"var(--text-primary)", outline:"none" }} />
            <button onClick={addItem} style={{ background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:6, padding:"5px 10px", fontSize:12, color:"var(--accent-violet)", cursor:"pointer" }}>+</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:4, paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        {editing ? (
          <>
            <button onClick={save} disabled={saving} style={{ fontSize:11, padding:"3px 10px", background:"var(--accent-violet)", border:"none", borderRadius:6, color:"white", cursor:"pointer" }}>{saving?<Spin/>:"Salvar"}</button>
            <button onClick={()=>{setEditing(false);setTitulo(note.titulo||"");setConteudo(note.conteudo||"");}} style={{ fontSize:11, padding:"3px 10px", background:"transparent", border:"1px solid var(--border-subtle)", borderRadius:6, color:"var(--text-muted)", cursor:"pointer" }}>Cancelar</button>
          </>
        ) : (
          <>
            <button title="Editar" onClick={()=>setEditing(true)} className="btn-icon" style={{ width:26, height:26 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button title={note.fixado?"Desafixar":"Fixar"} onClick={()=>onUpdate(note.id,{fixado:!note.fixado})} className="btn-icon" style={{ width:26, height:26, color:note.fixado?"var(--accent-amber)":undefined }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L8.5 8.5 2 9.27l5 4.87L5.82 21 12 17.77 18.18 21l-1.18-6.86L22 9.27l-6.5-.77z"/></svg>
            </button>
            <button title="Arquivar" onClick={()=>onUpdate(note.id,{arquivado:!note.arquivado})} className="btn-icon" style={{ width:26, height:26 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </button>
            <button title="Remover" onClick={()=>onDelete(note.id)} className="btn-icon" style={{ width:26, height:26, color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </>
        )}
        {!editing && (
          <div style={{ marginLeft:"auto", display:"flex", gap:3 }}>
            {NOTE_COLORS.map(c => (
              <button key={c.value} onClick={()=>onUpdate(note.id,{cor:c.value})} style={{ width:14, height:14, borderRadius:"50%", background:c.value||"var(--border-medium)", border:note.cor===c.value?"2px solid white":"1px solid transparent", cursor:"pointer", outline:"none" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KeepPage() {
  const [notes,       setNotes]       = useState<Note[]>([]);
  const [daily,       setDaily]       = useState<DailyTask[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState<"notas"|"tasks"|"arquivadas">("notas");
  const [newNote,     setNewNote]     = useState(false);
  const [newTipo,     setNewTipo]     = useState("TEXTO");
  const [newTitle,    setNewTitle]    = useState("");
  const [newContent,  setNewContent]  = useState("");
  const [newTask,     setNewTask]     = useState("");
  const [newTaskTipo, setNewTaskTipo] = useState("TAREFA");
  const [creating,    setCreating]    = useState(false);
  const [selectedDate,setSelectedDate]= useState(() => new Date().toISOString().slice(0,10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, dRes] = await Promise.all([
        api.get("/keep/notes", { params: { arquivado: view==="arquivadas" } }),
        api.get("/keep/daily", { params: { data: selectedDate } }),
      ]);
      setNotes(nRes.data);
      setDaily(dRes.data);
    } catch (e) {
      console.error("Erro ao carregar keep:", e);
    } finally { setLoading(false); }
  }, [view, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const createNote = async () => {
    if (!newContent.trim() && !newTitle.trim()) return;
    setCreating(true);
    try {
      await api.post("/keep/notes", { titulo: newTitle, conteudo: newContent, tipo: newTipo });
      setNewNote(false); setNewTitle(""); setNewContent("");
      load();
    } catch {} finally { setCreating(false); }
  };

  const updateNote = async (id: string, data: any) => {
    if (Object.keys(data).length > 0) await api.put("/keep/notes/"+id, data);
    load();
  };

  const deleteNote = async (id: string) => {
    await api.delete("/keep/notes/"+id);
    load();
  };

  const createTask = async () => {
    if (!newTask.trim()) return;
    try {
      await api.post("/keep/daily", { titulo: newTask, tipo: newTaskTipo, data: selectedDate });
      setNewTask("");
      load();
    } catch (e) { console.error("Erro ao criar task:", e); }
  };

  const toggleTask = async (id: string, concluido: boolean) => {
    await api.patch("/keep/daily/"+id, { concluido: !concluido });
    load();
  };

  const deleteTask = async (id: string) => {
    await api.delete("/keep/daily/"+id);
    load();
  };

  const pinnedNotes  = notes.filter(n => n.fixado && !n.arquivado);
  const regularNotes = notes.filter(n => !n.fixado && !n.arquivado);
  const pendentes    = daily.filter(t => !t.concluido).length;
  const concluidas   = daily.filter(t => t.concluido).length;

  const NAV_ITEMS = [
    { key:"notas",      label:"Notas",        count: notes.filter(n=>!n.arquivado).length },
    { key:"tasks",      label:"Tasks do dia",  count: pendentes },
    { key:"arquivadas", label:"Arquivadas",    count: notes.filter(n=>n.arquivado).length },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>{ setView("notas"); setNewNote(true); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Nova nota
        </button>
      </Topbar>

      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        <div style={{ width:220, borderRight:"1px solid var(--border-subtle)", padding:"16px 12px", flexShrink:0, display:"flex", flexDirection:"column", gap:4 }}>
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={()=>setView(item.key as any)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, background:view===item.key?"var(--accent-violet-dim)":"transparent", border:view===item.key?"1px solid rgba(124,58,237,0.2)":"1px solid transparent", cursor:"pointer", textAlign:"left", width:"100%", transition:"all 0.15s" }}>
              <span style={{ fontSize:13, color:view===item.key?"var(--accent-violet)":"var(--text-secondary)", fontWeight:view===item.key?500:400 }}>{item.label}</span>
              {item.count > 0 && <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text-muted)", background:"var(--bg-hover)", borderRadius:10, padding:"1px 6px" }}>{item.count}</span>}
            </button>
          ))}
        </div>

        {/* Conteudo */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* NOTAS */}
          {(view === "notas" || view === "arquivadas") && (
            <>
              {view === "notas" && (
                !newNote ? (
                  <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                    <div onClick={()=>{ setNewTipo("TEXTO"); setNewNote(true); }} style={{ flex:1, border:"1px solid var(--border-subtle)", borderRadius:14, padding:"12px 16px", cursor:"text", color:"var(--text-muted)", fontSize:13, background:"var(--bg-card)" }}>
                      Escrever nota...
                    </div>
                    <button onClick={()=>{ setNewTipo("CHECKLIST"); setNewNote(true); }} className="btn btn-ghost" style={{ fontSize:12, flexShrink:0 }}>Lista</button>
                  </div>
                ) : (
                  <div style={{ border:"1px solid rgba(124,58,237,0.3)", borderRadius:14, padding:"14px 16px", marginBottom:20, background:"var(--bg-card)", boxShadow:"0 0 0 3px rgba(124,58,237,0.08)" }}>
                    <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Titulo (opcional)" style={{ width:"100%", background:"transparent", border:"none", outline:"none", fontSize:14, fontWeight:600, color:"var(--text-primary)", marginBottom:10, fontFamily:"var(--font-display)" }} />
                    <textarea value={newContent} onChange={e=>setNewContent(e.target.value)} placeholder={newTipo==="CHECKLIST"?"Primeiro item da lista...":"Escreva sua nota..."} autoFocus style={{ width:"100%", background:"transparent", border:"none", outline:"none", fontSize:13, color:"var(--text-secondary)", resize:"none", minHeight:80, fontFamily:"var(--font-body)", lineHeight:1.6 }} />
                    <div style={{ display:"flex", gap:8, marginTop:12, borderTop:"1px solid var(--border-subtle)", paddingTop:12 }}>
                      <button onClick={()=>{ setNewNote(false); setNewTitle(""); setNewContent(""); }} style={{ fontSize:12, padding:"5px 12px", borderRadius:7, background:"transparent", border:"1px solid var(--border-subtle)", cursor:"pointer", color:"var(--text-muted)" }}>Cancelar</button>
                      <button onClick={createNote} disabled={creating} style={{ fontSize:12, padding:"5px 14px", borderRadius:7, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"none", cursor:"pointer", color:"white", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>{creating?<Spin/>:"Salvar nota"}</button>
                    </div>
                  </div>
                )
              )}

              {loading ? (
                <div style={{ display:"flex", justifyContent:"center", padding:40 }}><Spin/></div>
              ) : (
                <>
                  {pinnedNotes.length > 0 && view === "notas" && (
                    <div style={{ marginBottom:20 }}>
                      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.1em", marginBottom:10, textTransform:"uppercase" }}>Fixadas</div>
                      <div style={{ columns:"auto 220px", columnGap:12 }}>
                        {pinnedNotes.map(n => <NoteCard key={n.id} note={n} onUpdate={updateNote} onDelete={deleteNote} />)}
                      </div>
                    </div>
                  )}
                  {(view==="notas" ? regularNotes : notes.filter(n=>n.arquivado)).length > 0 ? (
                    <div>
                      {pinnedNotes.length > 0 && view==="notas" && <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.1em", marginBottom:10, textTransform:"uppercase" }}>Outras</div>}
                      <div style={{ columns:"auto 220px", columnGap:12 }}>
                        {(view==="notas" ? regularNotes : notes.filter(n=>n.arquivado)).map(n => <NoteCard key={n.id} note={n} onUpdate={updateNote} onDelete={deleteNote} />)}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                      </div>
                      <p style={{ color:"var(--text-secondary)" }}>{view==="arquivadas"?"Nenhuma nota arquivada":"Nenhuma nota ainda"}</p>
                      {view==="notas" && <button className="btn btn-violet" onClick={()=>setNewNote(true)}>Criar primeira nota</button>}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* TASKS DO DIA */}
          {view === "tasks" && (
            <div style={{ maxWidth:520 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="input-o" style={{ width:"auto" }} />
                <span className="badge badge-violet" style={{ fontSize:11 }}>{pendentes} pendentes</span>
                <span className="badge badge-green"  style={{ fontSize:11 }}>{concluidas} concluidas</span>
              </div>

              {daily.length > 0 && (
                <div style={{ marginBottom:16, background:"var(--bg-card)", border:"1px solid var(--border-subtle)", borderRadius:10, padding:"12px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"var(--text-secondary)" }}>Progresso do dia</span>
                    <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--accent-green)" }}>{daily.length > 0 ? Math.round((concluidas/daily.length)*100) : 0}%</span>
                  </div>
                  <div style={{ height:6, background:"var(--border-subtle)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:"var(--accent-green)", width:(daily.length > 0 ? Math.round((concluidas/daily.length)*100) : 0)+"%", transition:"width 0.5s", borderRadius:3 }} />
                  </div>
                </div>
              )}

              {/* Nova task */}
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <select value={newTaskTipo} onChange={e=>setNewTaskTipo(e.target.value)} className="input-o" style={{ width:130, flexShrink:0 }}>
                  {TASK_TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input-o" placeholder="Nova task para hoje..." value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") createTask(); }} style={{ flex:1 }} />
                <button className="btn btn-violet" style={{ flexShrink:0, padding:"8px 14px" }} onClick={createTask}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                </button>
              </div>

              {loading ? (
                <div style={{ display:"flex", justifyContent:"center", padding:32 }}><Spin/></div>
              ) : daily.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round"/></svg>
                  </div>
                  <p style={{ color:"var(--text-secondary)" }}>Nenhuma task para este dia</p>
                  <p style={{ color:"var(--text-muted)", fontSize:12 }}>Use o campo acima para adicionar</p>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {daily.map(task => (
                    <div key={task.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"var(--bg-card)", border:"1px solid var(--border-subtle)", borderRadius:10, transition:"all 0.15s", opacity:task.concluido?0.6:1 }}>
                      <button onClick={()=>toggleTask(task.id, task.concluido)} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${task.concluido?"var(--accent-green)":"var(--border-medium)"}`, background:task.concluido?"var(--accent-green)":"transparent", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                        {task.concluido && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round"/></svg>}
                      </button>
                      <span style={{ flex:1, fontSize:13, color:"var(--text-primary)", textDecoration:task.concluido?"line-through":"none" }}>{task.titulo}</span>
                      <span className="badge" style={{ fontSize:10, background:TIPO_COLORS[task.tipo]+"15", color:TIPO_COLORS[task.tipo], border:`1px solid ${TIPO_COLORS[task.tipo]}30` }}>{task.tipo}</span>
                      <button onClick={()=>deleteTask(task.id)} className="btn-icon" style={{ width:24, height:24, color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}