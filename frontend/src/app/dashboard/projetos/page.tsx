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
  return <div style={{ width:size, height:size, fontSize:size*0.35 }} className="rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/30 border border-violet-500/30 flex items-center justify-center font-bold text-[var(--accent-violet)] shrink-0">{i}</div>;
}
function Spin() { return <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>; }
function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="modal-overlay" onClick={e=>{if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose();}}>
      <div className="modal-box" style={{ maxWidth:wide?700:480 }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">{title}</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
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
      <div className="flex flex-col gap-4">
        <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Titulo</label><input className="input-o" placeholder="Nome do projeto" value={titulo} onChange={e=>setTitulo(e.target.value)} autoFocus /></div>
        <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Descricao</label><textarea className="input-o min-h-[70px] resize-y" placeholder="Objetivo..." value={descricao} onChange={e=>setDescricao(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Prioridade</label>
            <select className="input-o" value={prioridade} onChange={e=>setPrio(e.target.value)}>{PRIORIDADES.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Prazo final</label>
            <input className="input-o text-[var(--text-primary)]" type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} />
          </div>
        </div>
        <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Cor</label>
          <div className="flex gap-2">{CORES_PROJ.map(c=><button key={c} onClick={()=>setCor(c)} style={{ background:c, boxShadow:cor===c?`0 0 0 2px ${c}`:"none" }} className={`w-7 h-7 rounded-full cursor-pointer outline-none transition-all ${cor===c?"border-[3px] border-white dark:border-[var(--bg-primary)]":"border-[3px] border-transparent"}`} />)}</div>
        </div>
        {dataFim && (
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2 text-xs text-[var(--accent-cyan)]">
            Um evento de prazo será criado na agenda de todos os membros
          </div>
        )}
        {!isEdit && (
          otherUsers.length > 0 ? (
            <MemberSelector users={otherUsers} selected={membros} onChange={setMembros} label="MEMBROS DO PROJETO" />
          ) : (
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Membros do projeto</label>
              <div className="text-[12px] text-[var(--text-muted)] italic bg-[var(--bg-hover)] border border-dashed border-[var(--border-subtle)] rounded-lg px-3 py-2.5">
                Nenhum outro colaborador disponivel na sua organizacao. Voce sera o unico membro inicial — adicione outros depois pela tela do projeto.
              </div>
            </div>
          )
        )}
        {error && <p className="text-xs text-[var(--accent-red)]">{error}</p>}
        <div className="flex gap-3 mt-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet flex-[2]" onClick={save} disabled={loading}>{loading?<Spin/>:isEdit?"Salvar":"Criar projeto"}</button>
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
      <div className="flex flex-col gap-4">
        <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Titulo</label><input className="input-o" placeholder="O que precisa ser feito?" value={titulo} onChange={e=>setTitulo(e.target.value)} autoFocus /></div>
        <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Descricao</label><textarea className="input-o min-h-[60px] resize-y" placeholder="Detalhes..." value={descricao} onChange={e=>setDescricao(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Prioridade</label>
            <select className="input-o" value={prioridade} onChange={e=>setPrio(e.target.value)}>{PRIORIDADES.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          <div><label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Vencimento</label>
            <input className="input-o text-[var(--text-primary)]" type="date" value={dataVenc} onChange={e=>setDataVenc(e.target.value)} />
          </div>
        </div>
        {memberUsers.length > 0 && (
          <MemberSelector users={memberUsers} selected={assigneeId} onChange={ids => setAssignee(ids.slice(-1))} label="RESPONSAVEL" />
        )}
        {dataVenc && assigneeId.length > 0 && (
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2 text-xs text-[var(--accent-cyan)]">
            Um evento de vencimento será criado na agenda do responsável
          </div>
        )}
        {error && <p className="text-xs text-[var(--accent-red)]">{error}</p>}
        <div className="flex gap-3 mt-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet flex-[2]" onClick={save} disabled={loading}>{loading?<Spin/>:task?"Salvar":"Criar task"}</button>
        </div>
      </div>
    </Modal>
  );
}

function KanbanBoard({ project, onMoveTask, onNewTask, onEditTask, onDeleteTask, onDetailTask }: any) {
  const [dragging, setDragging] = useState<string|null>(null);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 min-h-[400px]">
      {COLUNAS.map(col => {
        const tasks = (project.tasks||[]).filter((t:Task)=>t.status===col.key);
        return (
          <div key={col.key} className="w-[280px] shrink-0 rounded-2xl pb-2 transition-colors duration-200"
            onDragOver={e=>{e.preventDefault();(e.currentTarget as HTMLElement).classList.add("bg-[var(--bg-hover)]");}}
            onDragLeave={e=>{(e.currentTarget as HTMLElement).classList.remove("bg-[var(--bg-hover)]");}}
            onDrop={e=>{e.preventDefault();(e.currentTarget as HTMLElement).classList.remove("bg-[var(--bg-hover)]");if(dragging)onMoveTask(dragging,col.key);setDragging(null);}}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <span className="text-[13px] font-semibold text-[var(--text-secondary)] font-display">{col.label}</span>
                <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-hover)] rounded-full px-2 py-0.5">{tasks.length}</span>
              </div>
              <button onClick={()=>onNewTask(col.key)} className="w-6 h-6 rounded-md bg-transparent border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center text-lg leading-none">+</button>
            </div>
            <div className="flex flex-col gap-2.5">
              {tasks.map((task:Task)=>{
                const vencida = task.dataVencimento && new Date(task.dataVencimento) < new Date() && task.status !== "CONCLUIDA";
                return (
                  <div key={task.id} draggable onDragStart={()=>setDragging(task.id)} onDragEnd={()=>setDragging(null)}
                    className="card-premium p-3.5 cursor-grab transition-all hover:shadow-premium-md relative"
                    style={{ borderLeft:`3px solid ${PRIO_COLORS[task.prioridade]||"var(--border-subtle)"}`, opacity:dragging===task.id?0.4:1 }}
                  >
                    <div className="text-[13px] font-medium text-[var(--text-primary)] mb-2 leading-snug cursor-pointer hover:text-[var(--accent-violet)] transition-colors" onClick={()=>onDetailTask(task)}>{task.titulo}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        <span className="badge" style={{ fontSize:9, background:PRIO_COLORS[task.prioridade]+"15", color:PRIO_COLORS[task.prioridade], border:`1px solid ${PRIO_COLORS[task.prioridade]}30` }}>{task.prioridade}</span>
                        {vencida && <span className="badge badge-red" style={{ fontSize:9 }}>VENCIDA</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {task.assignee && <Avatar nome={task.assignee.nome} size={22} />}
                        <button onClick={()=>onEditTask(task)} className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-violet)] transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                        </button>
                        <button onClick={()=>onDeleteTask(task.id)} className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
                    </div>
                    {task.dataVencimento && (
                      <div className={`text-[10px] font-mono mt-2 ${vencida?"text-[var(--accent-red)]":"text-[var(--text-muted)]"}`}>
                        {new Date(task.dataVencimento).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <div className="border border-dashed border-[var(--border-subtle)] rounded-xl p-5 text-center bg-[var(--bg-card)]/50">
                  <p className="text-xs text-[var(--text-muted)]">Solte tarefas aqui</p>
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

  // /users/picklist e uma lista enxuta (id, nome, email, avatar) que NAO exige
  // 'usuarios:ver' — qualquer usuario autenticado pode escolher colegas pra
  // adicionar como membro do projeto.
  // Chamadas SEPARADAS: falha numa nao deve impedir a outra (antes era
  // Promise.all, all-or-nothing).
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/projects");
      setProjects(Array.isArray(data) ? data : []);
    } catch { setProjects([]); }
    try {
      const { data } = await api.get("/users/picklist");
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); }
    setLoading(false);
  }, []);

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
        <div className="w-[280px] border-r border-[var(--border-subtle)] overflow-y-auto p-4 shrink-0 bg-[var(--bg-primary)]">
          <div className="text-[11px] font-mono text-[var(--text-muted)] tracking-widest mb-4 uppercase">
            {projects.length} projeto{projects.length!==1?"s":""}
          </div>
          {loading && <div className="flex justify-center p-8"><Spin/></div>}
          {!loading && projects.length === 0 && (
            <div className="empty-state">
              <p className="text-[var(--text-muted)] text-xs text-center">Nenhum projeto ainda</p>
              <button className="btn btn-violet text-xs" onClick={()=>setModalNew(true)}>Criar projeto</button>
            </div>
          )}
          {projects.map(p => (
            <div key={p.id} onClick={()=>{ api.get("/projects/"+p.id).then(r=>setSelected(r.data)).catch(()=>{}); }}
              className={`p-3.5 rounded-xl cursor-pointer mb-2.5 border transition-all ${selected?.id===p.id ? "border-[var(--accent-violet)] bg-[var(--accent-violet-dim)] shadow-[0_0_15px_rgba(124,58,237,0.1)]" : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-medium)] hover:shadow-premium-sm"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background:p.cor }} />
                <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate flex-1">{p.titulo}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="badge" style={{ fontSize:10, background:STATUS_COLORS[p.status]+"15", color:STATUS_COLORS[p.status], border:`1px solid ${STATUS_COLORS[p.status]}30` }}>{STATUS_LABELS[p.status]||p.status}</span>
                <span className="badge" style={{ fontSize:10, background:PRIO_COLORS[p.prioridade]+"15", color:PRIO_COLORS[p.prioridade], border:`1px solid ${PRIO_COLORS[p.prioridade]}30` }}>{p.prioridade}</span>
              </div>
              <div className="h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden mb-1.5">
                <div className="h-full rounded-full transition-all duration-500" style={{ background:p.cor, width:p.progressoPct+"%" }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[var(--text-muted)]">{p.tasksConcluidas||0}/{p.totalTasks||0} tasks</span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.progressoPct}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-primary)]">
          {!selected ? (
            <div className="empty-state mt-20">
              <div className="empty-state-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round"/></svg></div>
              <p className="text-[var(--text-primary)] font-medium text-base">Selecione um projeto</p>
              <p className="text-[var(--text-muted)] text-sm">ou crie um novo para começar</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ background:selected.cor, boxShadow:`0 0 10px ${selected.cor}80` }} />
                    <h2 className="font-display text-2xl font-bold text-[var(--text-primary)] tracking-tight">{selected.titulo}</h2>
                  </div>
                  {selected.descricao && <p className="text-[13px] text-[var(--text-secondary)] ml-6 max-w-2xl">{selected.descricao}</p>}
                  <div className="flex items-center gap-2 mt-2 ml-6">
                    <span className="text-xs text-[var(--text-muted)] font-medium">{selected.members?.length||0} membros</span>
                    <span className="text-[var(--border-medium)]">•</span>
                    <span className="text-xs text-[var(--text-muted)] font-medium">{selected.progressoPct}% concluído</span>
                    {selected.dataFim && (
                      <><span className="text-[var(--border-medium)]">•</span>
                      <span className={`text-xs font-medium ${new Date(selected.dataFim)<new Date()?"text-[var(--accent-red)]":"text-[var(--text-muted)]"}`}>Prazo: {new Date(selected.dataFim).toLocaleDateString("pt-BR")}</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex">
                    {selected.members?.slice(0,4).map((m,i)=>(
                      <div key={m.user.id} className="relative ring-2 ring-[var(--bg-primary)] rounded-full" style={{ marginLeft:i>0?-8:0, zIndex:4-i }}><Avatar nome={m.user.nome} size={32} /></div>
                    ))}
                  </div>
                  <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={()=>setModalEdit(selected)}>Editar</button>
                  <button className="btn btn-danger text-xs py-1.5 px-3" onClick={()=>setDeleteId(selected.id)}>Remover</button>
                </div>
              </div>

              <div className="mb-6 card-premium p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Progresso</span>
                  <span className="text-xs font-mono font-bold" style={{ color:selected.cor }}>{selected.progressoPct}%</span>
                </div>
                <div className="h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ background:selected.cor, width:selected.progressoPct+"%", boxShadow:`0 0 10px ${selected.cor}80` }} />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">{(selected.tasks||[]).filter((t:Task)=>t.status==="CONCLUIDA").length} concluídas</span>
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">{(selected.tasks||[]).length} total</span>
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
          <p className="text-[13px] text-[var(--text-secondary)] mb-6">Tem certeza? Todas as tasks serão removidas junto.</p>
          <div className="flex gap-3">
            <button className="btn btn-ghost flex-1" onClick={()=>setDeleteId(null)}>Cancelar</button>
            <button className="btn btn-danger flex-[2]" onClick={async()=>{ await api.delete("/projects/"+deleteId); setSelected(null); load(); setDeleteId(null); }}>Remover</button>
          </div>
        </Modal>
      )}
      {detailTask && selected && <TaskDetailModal projectId={selected.id} task={detailTask} onClose={()=>setDetailTask(null)} onUpdate={()=>refreshSelected(selected.id)} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}