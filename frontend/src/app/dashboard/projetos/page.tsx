"use client";
import TaskDetailModal from "@/components/ui/TaskDetailModal";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import MemberSelector from "@/components/ui/MemberSelector";

type Member  = { user: { id: string; nome: string; email: string } };
type Task    = { id: string; titulo: string; descricao?: string; status: string; prioridade: string; dataVencimento?: string; assignee?: { id: string; nome: string }; };
type Project = { id: string; titulo: string; descricao?: string; status: string; prioridade: string; cor: string; progressoPct: number; dataFim?: string; members: Member[]; tasks: Task[]; totalTasks: number; tasksConcluidas: number; criadoPorId: string; };

const COLUNAS = [
  { key:"A_FAZER",      label:"A Fazer",      color:"var(--text-muted)" },
  { key:"EM_ANDAMENTO", label:"Em Andamento",  color:"var(--accent-cyan)" },
  { key:"EM_REVISAO",   label:"Em Revisão",    color:"var(--accent-amber)" },
  { key:"CANCELADA",    label:"Cancelada",     color:"var(--accent-red)" },
  { key:"CONCLUIDA",    label:"Concluída",     color:"var(--accent-green)" },
];
const PRIORIDADES = ["BAIXA","MEDIA","ALTA","URGENTE"];
const PRIO_COLORS: Record<string,string> = { BAIXA:"var(--accent-green)", MEDIA:"var(--accent-cyan)", ALTA:"var(--accent-amber)", URGENTE:"var(--accent-red)" };
const CORES_PROJ = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6"];
const STATUS_LABELS: Record<string,string> = { PLANEJAMENTO:"Planejamento", EM_ANDAMENTO:"Em andamento", PAUSADO:"Pausado", CONCLUIDO:"Concluido", CANCELADO:"Cancelado" };
const STATUS_COLORS: Record<string,string> = { PLANEJAMENTO:"var(--accent-violet)", EM_ANDAMENTO:"var(--accent-cyan)", PAUSADO:"var(--accent-amber)", CONCLUIDO:"var(--accent-green)", CANCELADO:"var(--accent-red)" };

function Avatar({ nome, size=28 }: { nome:string; size?:number }) {
  const i = nome.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase();
  return <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>{i}</div>;
}
function Spin() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>; }
function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="modal-overlay" onClick={e=>{if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose();}}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:wide?700:480 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700 }}>{title}</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProjectModal({ project, users, onClose, onSave }: { project?:Project; users:any[]; onClose:()=>void; onSave:()=>void }) {
  const { user: me } = useAuthStore();
  const [titulo,    setTitulo]    = useState(project?.titulo||"");
  const [descricao, setDescricao] = useState(project?.descricao||"");
  const [cor,       setCor]       = useState(project?.cor||"#a78bfa");
  const [prioridade,setPrio]      = useState(project?.prioridade||"MEDIA");
  const [dataFim,   setDataFim]   = useState(project?.dataFim?.slice(0,10)||"");
  const [membros,   setMembros]   = useState<string[]>(project?.members?.map(m=>m.user.id).filter(id=>id!==me?.id)||[]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const isEdit = !!project;

  const otherUsers = users.filter((u:any) => u.id !== me?.id);

  const save = async () => {
    if (!titulo.trim()) { setError("Titulo obrigatorio"); return; }
    setLoading(true); setError("");
    try {
      if (isEdit) await api.put("/projects/"+project.id, { titulo, descricao, cor, prioridade, dataFim:dataFim||undefined });
      else await api.post("/projects", { titulo, descricao, cor, prioridade, dataFim:dataFim||undefined, membros });
      onSave(); onClose();
    } catch (e:any) { setError(e.response?.data?.message||"Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={isEdit?"Editar projeto":"Novo projeto"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>TITULO</label><input className="input-o" placeholder="Nome do projeto" value={titulo} onChange={e=>setTitulo(e.target.value)} autoFocus /></div>
        <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>DESCRICAO</label><textarea className="input-o" placeholder="Objetivo..." value={descricao} onChange={e=>setDescricao(e.target.value)} style={{ minHeight:70, resize:"vertical" }} /></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>PRIORIDADE</label>
            <select className="input-o" value={prioridade} onChange={e=>setPrio(e.target.value)}>{PRIORIDADES.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>PRAZO FINAL</label>
            <input className="input-o" type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} />
          </div>
        </div>
        <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>COR</label>
          <div style={{ display:"flex", gap:8 }}>{CORES_PROJ.map(c=><button key={c} onClick={()=>setCor(c)} style={{ width:26, height:26, borderRadius:"50%", background:c, border:cor===c?"3px solid white":"3px solid transparent", cursor:"pointer", outline:"none", boxShadow:cor===c?`0 0 0 2px ${c}`:"none" }} />)}</div>
        </div>
        {dataFim && (
          <div style={{ background:"rgba(34,211,238,0.06)", border:"1px solid rgba(34,211,238,0.2)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"var(--accent-cyan)" }}>
            Um evento de prazo sera criado na agenda de todos os membros
          </div>
        )}
        {!isEdit && otherUsers.length > 0 && (
          <MemberSelector users={otherUsers} selected={membros} onChange={setMembros} label="MEMBROS DO PROJETO" />
        )}
        {error && <p style={{ color:"var(--accent-red)", fontSize:12 }}>{error}</p>}
        <div style={{ display:"flex", gap:10, marginTop:4 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>{loading?<Spin/>:isEdit?"Salvar":"Criar projeto"}</button>
        </div>
      </div>
    </Modal>
  );
}

function TaskModal({ projectId, task, members, onClose, onSave }: { projectId:string; task?:Task; members:Member[]; onClose:()=>void; onSave:()=>void }) {
  const [titulo,    setTitulo]    = useState(task?.titulo||"");
  const [descricao, setDescricao] = useState(task?.descricao||"");
  const [prioridade,setPrio]      = useState(task?.prioridade||"MEDIA");
  const [assigneeId,setAssignee]  = useState<string[]>(task?.assignee?.id ? [task.assignee.id] : []);
  const [dataVenc,  setDataVenc]  = useState(task?.dataVencimento?.slice(0,10)||"");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const memberUsers = members.map(m => m.user);

  const save = async () => {
    if (!titulo.trim()) { setError("Titulo obrigatorio"); return; }
    setLoading(true); setError("");
    try {
      const p = { titulo, descricao, prioridade, assigneeId:assigneeId[0]||undefined, dataVencimento:dataVenc||undefined };
      if (task) await api.patch("/projects/"+projectId+"/tasks/"+task.id, p);
      else await api.post("/projects/"+projectId+"/tasks", p);
      onSave(); onClose();
    } catch (e:any) { setError(e.response?.data?.message||"Erro"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={task?"Editar task":"Nova task"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>TITULO</label><input className="input-o" placeholder="O que precisa ser feito?" value={titulo} onChange={e=>setTitulo(e.target.value)} autoFocus /></div>
        <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>DESCRICAO</label><textarea className="input-o" placeholder="Detalhes..." value={descricao} onChange={e=>setDescricao(e.target.value)} style={{ minHeight:60, resize:"vertical" }} /></div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>PRIORIDADE</label>
            <select className="input-o" value={prioridade} onChange={e=>setPrio(e.target.value)}>{PRIORIDADES.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          <div><label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>VENCIMENTO</label>
            <input className="input-o" type="date" value={dataVenc} onChange={e=>setDataVenc(e.target.value)} />
          </div>
        </div>
        {memberUsers.length > 0 && (
          <MemberSelector users={memberUsers} selected={assigneeId} onChange={ids => setAssignee(ids.slice(-1))} label="RESPONSAVEL" />
        )}
        {dataVenc && assigneeId.length > 0 && (
          <div style={{ background:"rgba(34,211,238,0.06)", border:"1px solid rgba(34,211,238,0.2)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"var(--accent-cyan)" }}>
            Um evento de vencimento sera criado na agenda do responsavel
          </div>
        )}
        {error && <p style={{ color:"var(--accent-red)", fontSize:12 }}>{error}</p>}
        <div style={{ display:"flex", gap:10, marginTop:4 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>{loading?<Spin/>:task?"Salvar":"Criar task"}</button>
        </div>
      </div>
    </Modal>
  );
}

function KanbanBoard({ project, onMoveTask, onNewTask, onEditTask, onDeleteTask, onDetailTask }: any) {
  const [dragging, setDragging] = useState<string|null>(null);
  return (
    <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:8, minHeight:400 }}>
      {COLUNAS.map(col => {
        const tasks = (project.tasks||[]).filter((t:Task)=>t.status===col.key);
        return (
          <div key={col.key} style={{ minWidth:220, width:220, flexShrink:0, borderRadius:12, padding:"0 0 8px", transition:"background 0.15s" }}
            onDragOver={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.background="var(--bg-hover)";}}
            onDragLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}
            onDrop={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.background="transparent";if(dragging)onMoveTask(dragging,col.key);setDragging(null);}}
          >
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, padding:"0 4px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:col.color }} />
                <span style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", fontFamily:"var(--font-display)" }}>{col.label}</span>
                <span style={{ fontSize:10, color:"var(--text-muted)", background:"var(--bg-hover)", borderRadius:10, padding:"1px 6px" }}>{tasks.length}</span>
              </div>
              <button onClick={()=>onNewTask(col.key)} style={{ width:22, height:22, borderRadius:6, background:"transparent", border:"1px solid var(--border-subtle)", cursor:"pointer", color:"var(--text-muted)", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>+</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {tasks.map((task:Task)=>{
                const vencida = task.dataVencimento && new Date(task.dataVencimento) < new Date() && task.status !== "CONCLUIDA";
                return (
                  <div key={task.id} draggable onDragStart={()=>setDragging(task.id)} onDragEnd={()=>setDragging(null)}
                    style={{ background:"var(--bg-card)", border:`1px solid var(--border-subtle)`, borderLeft:`3px solid ${PRIO_COLORS[task.prioridade]||"var(--border-subtle)"}`, borderRadius:10, padding:"10px 12px", cursor:"grab", opacity:dragging===task.id?0.4:1, transition:"all 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow="0 2px 12px rgba(0,0,0,0.15)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow="none"}
                  >
                    <div style={{ fontSize:12, fontWeight:500, color:"var(--text-primary)", marginBottom:8, lineHeight:1.4, cursor:"pointer" }} onClick={()=>onDetailTask(task)}>{task.titulo}</div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        <span className="badge" style={{ fontSize:9, background:PRIO_COLORS[task.prioridade]+"15", color:PRIO_COLORS[task.prioridade], border:`1px solid ${PRIO_COLORS[task.prioridade]}30` }}>{task.prioridade}</span>
                        {vencida && <span className="badge badge-red" style={{ fontSize:9 }}>VENCIDA</span>}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                        {task.assignee && <Avatar nome={task.assignee.nome} size={20} />}
                        <button onClick={()=>onEditTask(task)} className="btn-icon" style={{ width:22, height:22 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                        </button>
                        <button onClick={()=>onDeleteTask(task.id)} className="btn-icon" style={{ width:22, height:22, color:"var(--accent-red)", borderColor:"rgba(220,38,38,0.2)" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
                    </div>
                    {task.dataVencimento && (
                      <div style={{ fontSize:10, color:vencida?"var(--accent-red)":"var(--text-muted)", fontFamily:"var(--font-mono)", marginTop:5 }}>
                        {new Date(task.dataVencimento).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <div style={{ border:"1px dashed var(--border-subtle)", borderRadius:10, padding:"20px 12px", textAlign:"center" }}>
                  <p style={{ fontSize:11, color:"var(--text-muted)" }}>Solte aqui</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjetosPage() {
  const { user: me } = useAuthStore();
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [users,     setUsers]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<Project|null>(null);
  const [modalNew,  setModalNew]  = useState(false);
  const [modalEdit, setModalEdit] = useState<Project|null>(null);
  const [taskModal, setTaskModal] = useState<{status:string;task?:Task}|null>(null);
  const [deleteId,  setDeleteId]  = useState<string|null>(null);
  const [detailTask, setDetailTask] = useState<Task|null>(null);

  const canSeeUsers = me?.isMaster || (me?.permissions || []).some(p => p === "*" || p === "usuarios:ver");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, uRes] = await Promise.all([
        api.get("/projects"),
        canSeeUsers ? api.get("/users") : Promise.resolve({ data: [] }),
      ]);
      setProjects(pRes.data);
      setUsers(uRes.data);
    } catch {} finally { setLoading(false); }
  }, [canSeeUsers]);

  useEffect(() => { load(); }, []);

  const refreshSelected = async (id: string) => {
    const { data } = await api.get("/projects/"+id);
    setSelected(data);
    setProjects(p => p.map(proj => proj.id === data.id ? { ...proj, progressoPct: data.progressoPct, tasks: data.tasks, tasksConcluidas: data.tasks.filter((t:Task)=>t.status==="CONCLUIDA").length } : proj));
  };

  const handleMove = async (taskId: string, status: string) => {
    if (!selected) return;
    await api.patch("/projects/"+selected.id+"/tasks/"+taskId, { status });
    refreshSelected(selected.id);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selected) return;
    await api.delete("/projects/"+selected.id+"/tasks/"+taskId);
    refreshSelected(selected.id);
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>setModalNew(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Novo projeto
        </button>
      </Topbar>

      <div className="flex-1 flex overflow-hidden">
        <div style={{ width:270, borderRight:"1px solid var(--border-subtle)", overflowY:"auto", padding:16, flexShrink:0 }}>
          <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.1em", marginBottom:12, textTransform:"uppercase" }}>
            {projects.length} projeto{projects.length!==1?"s":""}
          </div>
          {loading && <div style={{ display:"flex", justifyContent:"center", padding:32 }}><Spin/></div>}
          {!loading && projects.length === 0 && (
            <div className="empty-state">
              <p style={{ color:"var(--text-muted)", fontSize:12, textAlign:"center" }}>Nenhum projeto ainda</p>
              <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>setModalNew(true)}>Criar projeto</button>
            </div>
          )}
          {projects.map(p => (
            <div key={p.id} onClick={()=>{ api.get("/projects/"+p.id).then(r=>setSelected(r.data)).catch(()=>{}); }}
              style={{ padding:"12px 14px", borderRadius:10, cursor:"pointer", marginBottom:6, border:`1px solid ${selected?.id===p.id?"rgba(124,58,237,0.3)":"var(--border-subtle)"}`, background:selected?.id===p.id?"var(--accent-violet-dim)":"var(--bg-card)", transition:"all 0.15s" }}
            >
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:p.cor, flexShrink:0 }} />
                <span style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{p.titulo}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span className="badge" style={{ fontSize:10, background:STATUS_COLORS[p.status]+"15", color:STATUS_COLORS[p.status], border:`1px solid ${STATUS_COLORS[p.status]}30` }}>{STATUS_LABELS[p.status]||p.status}</span>
                <span className="badge" style={{ fontSize:10, background:PRIO_COLORS[p.prioridade]+"15", color:PRIO_COLORS[p.prioridade], border:`1px solid ${PRIO_COLORS[p.prioridade]}30` }}>{p.prioridade}</span>
              </div>
              <div style={{ height:4, background:"var(--border-subtle)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", background:p.cor, width:p.progressoPct+"%", transition:"width 0.5s", borderRadius:2 }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ fontSize:10, color:"var(--text-muted)" }}>{p.tasksConcluidas||0}/{p.totalTasks||0} tasks</span>
                <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{p.progressoPct}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!selected ? (
            <div className="empty-state" style={{ marginTop:80 }}>
              <div className="empty-state-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round"/></svg></div>
              <p style={{ color:"var(--text-secondary)", fontWeight:500 }}>Selecione um projeto</p>
              <p style={{ color:"var(--text-muted)", fontSize:12 }}>ou crie um novo para comecar</p>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                    <div style={{ width:12, height:12, borderRadius:"50%", background:selected.cor }} />
                    <h2 style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700 }}>{selected.titulo}</h2>
                  </div>
                  {selected.descricao && <p style={{ fontSize:12, color:"var(--text-muted)", marginLeft:22 }}>{selected.descricao}</p>}
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, marginLeft:22 }}>
                    <span style={{ fontSize:11, color:"var(--text-muted)" }}>{selected.members?.length||0} membros</span>
                    <span style={{ color:"var(--border-subtle)" }}>|</span>
                    <span style={{ fontSize:11, color:"var(--text-muted)" }}>{selected.progressoPct}% concluido</span>
                    {selected.dataFim && (
                      <><span style={{ color:"var(--border-subtle)" }}>|</span>
                      <span style={{ fontSize:11, color:new Date(selected.dataFim)<new Date()?"var(--accent-red)":"var(--text-muted)" }}>Prazo: {new Date(selected.dataFim).toLocaleDateString("pt-BR")}</span></>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ display:"flex" }}>
                    {selected.members?.slice(0,4).map((m,i)=>(
                      <div key={m.user.id} style={{ marginLeft:i>0?-8:0, zIndex:4-i }}><Avatar nome={m.user.nome} size={28} /></div>
                    ))}
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={()=>setModalEdit(selected)}>Editar</button>
                  <button className="btn btn-danger" style={{ fontSize:12 }} onClick={()=>setDeleteId(selected.id)}>Remover</button>
                </div>
              </div>

              <div style={{ marginBottom:20, background:"var(--bg-card)", border:"1px solid var(--border-subtle)", borderRadius:10, padding:"12px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:12, color:"var(--text-secondary)" }}>Progresso</span>
                  <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:selected.cor }}>{selected.progressoPct}%</span>
                </div>
                <div style={{ height:8, background:"var(--border-subtle)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:selected.cor, width:selected.progressoPct+"%", transition:"width 0.8s", borderRadius:4, boxShadow:`0 0 8px ${selected.cor}60` }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                  <span style={{ fontSize:11, color:"var(--text-muted)" }}>{(selected.tasks||[]).filter((t:Task)=>t.status==="CONCLUIDA").length} concluidas</span>
                  <span style={{ fontSize:11, color:"var(--text-muted)" }}>{(selected.tasks||[]).length} total</span>
                </div>
              </div>

              <KanbanBoard project={selected} onMoveTask={handleMove} onNewTask={(status:string)=>setTaskModal({status})} onEditTask={(task:Task)=>setTaskModal({status:task.status,task})} onDeleteTask={handleDeleteTask} onDetailTask={(task:Task)=>setDetailTask(task)} />
            </>
          )}
        </div>
      </div>

      {modalNew && <ProjectModal users={users} onClose={()=>setModalNew(false)} onSave={load} />}
      {modalEdit && <ProjectModal project={modalEdit} users={users} onClose={()=>setModalEdit(null)} onSave={()=>{load();setModalEdit(null);}} />}
      {taskModal && selected && (
        <TaskModal projectId={selected.id} task={taskModal.task} members={selected.members||[]} onClose={()=>setTaskModal(null)}
          onSave={()=>{ refreshSelected(selected.id); setTaskModal(null); }} />
      )}
      {deleteId && (
        <Modal title="Remover projeto" onClose={()=>setDeleteId(null)}>
          <p style={{ color:"var(--text-secondary)", fontSize:13, marginBottom:24 }}>Tem certeza? Todas as tasks serao removidas junto.</p>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setDeleteId(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ flex:2 }} onClick={async()=>{ await api.delete("/projects/"+deleteId); setSelected(null); load(); setDeleteId(null); }}>Remover</button>
          </div>
        </Modal>
      )}
      {detailTask && selected && <TaskDetailModal projectId={selected.id} task={detailTask} onClose={()=>setDetailTask(null)} onUpdate={()=>refreshSelected(selected.id)} />}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}