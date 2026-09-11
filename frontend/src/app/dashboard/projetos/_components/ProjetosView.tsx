"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, History, PanelLeftClose, PanelLeftOpen, PartyPopper, X } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import TaskDetailModal, { type AbaTarefa } from "@/components/ui/TaskDetailModal";
import HistoricoProjeto from "@/components/ui/HistoricoProjeto";
import MemberSelector from "@/components/ui/MemberSelector";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { api } from "@/lib/api";
import AnexosProjeto from "./AnexosProjeto";

/**
 * Projetos — a fila (em andamento) e Projetos Concluídos são a MESMA tela com um
 * filtro. O projeto sai da fila quando toda tarefa ativa chega a Concluída e
 * volta se uma for reaberta. Quem decide é o servidor (`concluido`); a tela só
 * percebe a troca e avisa para onde o projeto foi.
 */

export type ModoProjetos = "ativos" | "concluidos";

type Member  = { userId?: string; user: { id: string; nome: string; email: string } };
type Task    = { id: string; titulo: string; descricao?: string; status: string; prioridade: string; dataVencimento?: string; assignee?: { id: string; nome: string }; _count?: { registros?: number }; };
type Project = {
  id: string; titulo: string; descricao?: string; status: string; prioridade: string; cor: string;
  progressoPct: number; dataFim?: string; members: Member[]; tasks: Task[]; totalTasks: number; tasksConcluidas: number;
  criadoPorId: string; concluido?: boolean; concluidoEm?: string | null; atualizadoEm?: string; podeMoverStatus?: boolean;
};

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
const STATUS_LABELS: Record<string,string> = { PLANEJAMENTO:"Planejamento", EM_ANDAMENTO:"Em andamento", PAUSADO:"Pausado", CONCLUIDO:"Concluído", CANCELADO:"Cancelado" };
const STATUS_COLORS: Record<string,string> = { PLANEJAMENTO:"var(--accent-violet)", EM_ANDAMENTO:"var(--accent-cyan)", PAUSADO:"var(--accent-amber)", CONCLUIDO:"var(--accent-green)", CANCELADO:"var(--accent-red)" };

const dataBR = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "";

function Avatar({ nome, size=28 }: { nome:string; size?:number }) {
  const i = nome.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase();
  return <div title={nome} style={{ width:size, height:size, fontSize:size*0.35 }} className="rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/30 border border-violet-500/30 flex items-center justify-center font-bold text-[var(--accent-violet)] shrink-0">{i}</div>;
}
function Spin() { return <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>; }
function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="modal-overlay" onClick={e=>{if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose();}}>
      <div className="modal-box" style={{ maxWidth:wide?700:480 }}>
        <div className="flex items-center justify-between gap-3 mb-6">
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)] min-w-0 break-words">{title}</h3>
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
  // Membros que não receberão o WhatsApp por não terem número verificado. Vem na
  // resposta da criação; enquanto preenchido, o modal mostra o aviso em vez do
  // formulário — o projeto JÁ foi criado, o aviso é só informativo.
  const [semWa,     setSemWa]     = useState<{id:string;nome:string}[]|null>(null);
  const isEdit = !!project;

  const otherUsers = users.filter((u:any) => u.id !== me?.id);

  const save = async () => {
    if (!titulo.trim()) { setError("Titulo obrigatorio"); return; }
    setLoading(true); setError("");
    try {
      if (isEdit) {
        await api.put("/projects/"+project.id, { titulo, descricao, cor, prioridade, dataFim:dataFim||undefined });
        onSave(); onClose();
      } else {
        const { data } = await api.post("/projects", { titulo, descricao, cor, prioridade, dataFim:dataFim||undefined, membros });
        onSave(); // atualiza a lista atrás do modal
        const faltantes = data?.avisosWhatsapp?.semWhatsapp;
        if (Array.isArray(faltantes) && faltantes.length) { setSemWa(faltantes); }
        else onClose();
      }
    } catch (e:any) { setError(e.response?.data?.message||"Erro"); }
    finally { setLoading(false); }
  };

  if (semWa) {
    return (
      <Modal title="Projeto criado" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-[13px] text-[var(--text-secondary)]">
            O projeto foi criado. Estes membros <strong className="text-[var(--accent-amber)]">não têm WhatsApp cadastrado e verificado</strong>, então não receberam o aviso por lá:
          </div>
          <ul className="flex flex-col gap-1.5">
            {semWa.map(m => (
              <li key={m.id} className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                <Avatar nome={m.nome} size={22} /> {m.nome}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-[var(--text-muted)]">Eles continuam vendo o projeto e as notificações dentro do sistema. Para receber por WhatsApp, precisam cadastrar e verificar o número no perfil.</p>
          <button className="btn btn-violet mt-1" onClick={onClose}>Entendi</button>
        </div>
      </Modal>
    );
  }

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
          <div className="flex flex-wrap gap-2">{CORES_PROJ.map(c=><button key={c} onClick={()=>setCor(c)} style={{ background:c, boxShadow:cor===c?`0 0 0 2px ${c}`:"none" }} className={`w-7 h-7 rounded-full cursor-pointer outline-none transition-all ${cor===c?"border-[3px] border-white dark:border-[var(--bg-primary)]":"border-[3px] border-transparent"}`} />)}</div>
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

/* ── Quadro ─────────────────────────────────────────────────────────────────
   As 5 colunas dividem a largura disponível (grid), em vez de 280px fixos cada:
   com o menu e a lista abertos, 5 × 280 não cabia em tela de notebook e a
   última coluna ficava cortada. Abaixo do mínimo, só o quadro rola de lado —
   nunca a página. */

type QuadroProps = {
  project: Project;
  podeMover: boolean;
  podeEditar: boolean;
  onMoveTask: (taskId: string, status: string) => void;
  onNewTask: (status: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onDetailTask: (task: Task, aba?: AbaTarefa) => void;
};

function KanbanBoard({ project, podeMover, podeEditar, onMoveTask, onNewTask, onEditTask, onDeleteTask, onDetailTask }: QuadroProps) {
  const [dragging, setDragging] = useState<string|null>(null);
  const [alvo,     setAlvo]     = useState<string|null>(null);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid gap-3 min-w-[760px]" style={{ gridTemplateColumns:"repeat(5, minmax(0, 1fr))" }}>
        {COLUNAS.map(col => {
          const tasks = (project.tasks||[]).filter(t => t.status === col.key);
          const destacada = alvo === col.key && !!dragging;
          return (
            <div key={col.key}
              className="min-w-0 flex flex-col rounded-2xl border p-2 transition-colors duration-150"
              style={{ borderColor: destacada ? "var(--accent-violet)" : "var(--border-subtle)", background: destacada ? "var(--accent-violet-dim)" : "transparent" }}
              onDragOver={e=>{ if (!dragging) return; e.preventDefault(); if (alvo !== col.key) setAlvo(col.key); }}
              onDragLeave={e=>{ if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setAlvo(a => a === col.key ? null : a); }}
              onDrop={e=>{ e.preventDefault(); setAlvo(null); if (dragging) onMoveTask(dragging, col.key); setDragging(null); }}
            >
              <div className="flex items-center justify-between gap-2 mb-2 px-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                  <span className="text-[12.5px] font-semibold text-[var(--text-secondary)] font-display truncate">{col.label}</span>
                  <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-hover)] rounded-full px-2 py-0.5 shrink-0">{tasks.length}</span>
                </div>
                {podeEditar && (
                  <button onClick={()=>onNewTask(col.key)} title="Nova tarefa" className="w-6 h-6 shrink-0 rounded-md bg-transparent border border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center text-lg leading-none">+</button>
                )}
              </div>

              <div className="flex flex-col gap-2 min-h-[72px]">
                {tasks.map(task => {
                  const vencida = task.dataVencimento && new Date(task.dataVencimento) < new Date() && task.status !== "CONCLUIDA";
                  const qtdKeep = task._count?.registros ?? 0;
                  return (
                    <div key={task.id}
                      draggable={podeMover}
                      onDragStart={e=>{ setDragging(task.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={()=>{ setDragging(null); setAlvo(null); }}
                      className={`card-premium p-3 min-w-0 transition-all hover:shadow-premium-md ${podeMover ? "cursor-grab active:cursor-grabbing" : ""}`}
                      style={{ borderLeft:`3px solid ${PRIO_COLORS[task.prioridade]||"var(--border-subtle)"}`, opacity:dragging===task.id?0.4:1 }}
                    >
                      <button type="button" onClick={()=>onDetailTask(task)}
                        className="block w-full text-left text-[13px] font-medium text-[var(--text-primary)] leading-snug break-words hover:text-[var(--accent-violet)] transition-colors">
                        {task.titulo}
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="badge" style={{ fontSize:9, background:PRIO_COLORS[task.prioridade]+"15", color:PRIO_COLORS[task.prioridade], border:`1px solid ${PRIO_COLORS[task.prioridade]}30` }}>{task.prioridade}</span>
                        {vencida && <span className="badge badge-red" style={{ fontSize:9 }}>VENCIDA</span>}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2 min-w-0">
                        <span className={`text-[10px] font-mono truncate ${vencida?"text-[var(--accent-red)]":"text-[var(--text-muted)]"}`}>
                          {dataBR(task.dataVencimento)}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {task.assignee && <Avatar nome={task.assignee.nome} size={20} />}
                          <button onClick={()=>onDetailTask(task,"keep")}
                            title={qtdKeep > 0 ? `Keep: ${qtdKeep} registro${qtdKeep !== 1 ? "s" : ""}` : "Keep: registrar o que foi feito"}
                            className={`p-1 flex items-center gap-0.5 transition-colors hover:text-[var(--accent-violet)] ${qtdKeep > 0 ? "text-[var(--accent-violet)]" : "text-[var(--text-muted)]"}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>
                            {qtdKeep > 0 && <span className="text-[10px] font-mono leading-none">{qtdKeep}</span>}
                          </button>
                          {podeEditar && (
                            <button onClick={()=>onEditTask(task)} title="Editar tarefa" className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-violet)] transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                            </button>
                          )}
                          {podeEditar && (
                            <button onClick={()=>onDeleteTask(task.id)} title="Remover tarefa" className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <div className="flex-1 border border-dashed border-[var(--border-subtle)] rounded-xl p-4 flex items-center justify-center text-center">
                    <p className="text-xs text-[var(--text-muted)]">{podeMover ? "Solte tarefas aqui" : "Sem tarefas"}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Tela ─────────────────────────────────────────────────────────────────── */

export default function ProjetosView({ modo }: { modo: ModoProjetos }) {
  const { user: me } = useAuthStore();
  const permissoes: string[] = (me as any)?.permissions ?? [];
  const tem = (p: string) => !!me?.isMaster || permissoes.includes("*") || permissoes.includes(p);
  // Mesmas permissões que o servidor exige — mostrar o botão a quem leva 403 no
  // clique é pior que não mostrar.
  const podeEditarProjetos = tem("projetos:editar");
  const podeCriarProjetos  = tem("projetos:criar");

  const [projects,   setProjects]   = useState<Project[]>([]);
  const [users,      setUsers]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<Project|null>(null);
  const [modalNew,   setModalNew]   = useState(false);
  const [modalEdit,  setModalEdit]  = useState<Project|null>(null);
  const [taskModal,  setTaskModal]  = useState<{status:string;task?:Task}|null>(null);
  const [deleteId,   setDeleteId]   = useState<string|null>(null);
  const [detailTask, setDetailTask] = useState<Task|null>(null);
  // Aba em que o detalhe abre: o atalho do Keep no cartão cai direto nela.
  const [detailAba,  setDetailAba]  = useState<AbaTarefa>("detalhes");
  const [listaAberta, setListaAberta] = useState(true);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historicoVersao, setHistoricoVersao] = useState(0);
  // Projeto que acabou de mudar de fila enquanto estava aberto aqui.
  const [aviso, setAviso] = useState<{ tipo: "concluido" | "reaberto"; titulo: string } | null>(null);

  // /users/picklist e uma lista enxuta (id, nome, email, avatar) que NAO exige
  // 'usuarios:ver'. Chamadas SEPARADAS: falha numa nao deve impedir a outra.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/projects", { params: { situacao: modo } });
      setProjects(Array.isArray(data) ? data : []);
    } catch { setProjects([]); }
    if (modo === "ativos") {
      try {
        const { data } = await api.get("/users/picklist");
        setUsers(Array.isArray(data) ? data : []);
      } catch { setUsers([]); }
    }
    setLoading(false);
  }, [modo]);

  useEffect(() => { load(); }, [load]);

  const abrir = async (id: string) => {
    try {
      const { data } = await api.get("/projects/" + id);
      setSelected(data);
      setAviso(null);
    } catch { /* interceptor */ }
  };

  /**
   * Recarrega o projeto aberto depois de qualquer mudança nas tarefas — mover,
   * criar, editar, apagar — e trata a troca de fila num lugar só: se ele
   * concluiu (ou reabriu), sai da lista desta tela e a tela diz para onde foi.
   */
  const aposMudanca = async (anterior: Project) => {
    let atual: Project;
    try {
      atual = (await api.get("/projects/" + anterior.id)).data;
    } catch { return; }

    setSelected(atual);
    setHistoricoVersao(v => v + 1);

    const pertenceAEstaTela = modo === "ativos" ? !atual.concluido : !!atual.concluido;
    setProjects(lista => pertenceAEstaTela
      ? lista.map(p => p.id === atual.id ? {
          ...p,
          status: atual.status, progressoPct: atual.progressoPct, concluido: atual.concluido, concluidoEm: atual.concluidoEm,
          totalTasks: atual.tasks.length, tasksConcluidas: atual.tasks.filter(t => t.status === "CONCLUIDA").length,
        } : p)
      : lista.filter(p => p.id !== atual.id));

    if (!!atual.concluido !== !!anterior.concluido) {
      if (atual.concluido) useToastStore.getState().success("Projeto concluído", `"${atual.titulo}" chegou a 100% e foi para Projetos Concluídos.`);
      else useToastStore.getState().info("Projeto reaberto", `"${atual.titulo}" voltou para a fila de projetos.`);
      if (!pertenceAEstaTela) setAviso({ tipo: atual.concluido ? "concluido" : "reaberto", titulo: atual.titulo });
    }
  };

  const handleMove = async (taskId: string, status: string) => {
    if (!selected) return;
    const anterior = selected;
    const tarefa = anterior.tasks.find(t => t.id === taskId);
    if (!tarefa || tarefa.status === status) return;

    // O cartão muda de coluna na hora; se o servidor recusar, volta para onde estava.
    setSelected({ ...anterior, tasks: anterior.tasks.map(t => t.id === taskId ? { ...t, status } : t) });
    try {
      await api.patch(`/projects/${anterior.id}/tasks/${taskId}/status`, { status });
    } catch {
      setSelected(anterior); // o interceptor mostra o motivo
      return;
    }
    await aposMudanca(anterior);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selected) return;
    const anterior = selected;
    try {
      await api.delete(`/projects/${anterior.id}/tasks/${taskId}`);
    } catch { return; }
    await aposMudanca(anterior);
  };

  const concluidas = selected ? selected.tasks.filter(t => t.status === "CONCLUIDA").length : 0;
  const podeRemoverSelecionado = !!selected && (!!me?.isMaster || (tem("projetos:deletar") && selected.criadoPorId === me?.id));
  const vazioLista = modo === "ativos" ? "Nenhum projeto em andamento" : "Nenhum projeto concluído ainda";

  return (
    <div className="flex flex-col h-full min-w-0">
      <Topbar>
        {modo === "ativos" ? (
          <>
            <Link href="/dashboard/projetos/concluidos" className="btn btn-ghost" style={{ fontSize:12 }}>
              <CheckCircle2 size={14} /> Concluídos
            </Link>
            {podeCriarProjetos && (
              <button className="btn btn-violet" style={{ fontSize:12 }} onClick={()=>setModalNew(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                Novo projeto
              </button>
            )}
          </>
        ) : (
          <Link href="/dashboard/projetos" className="btn btn-ghost" style={{ fontSize:12 }}>
            <ArrowLeft size={14} /> Projetos em andamento
          </Link>
        )}
      </Topbar>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {listaAberta && (
          <aside className="w-[232px] 2xl:w-[272px] shrink-0 border-r border-[var(--border-subtle)] flex flex-col min-h-0 bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
              <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-widest uppercase truncate">
                {projects.length} {modo === "ativos" ? (projects.length !== 1 ? "projetos" : "projeto") : (projects.length !== 1 ? "concluídos" : "concluído")}
              </span>
              <button className="btn-icon shrink-0" style={{ width:28, height:28 }} title="Recolher lista" aria-label="Recolher lista de projetos" onClick={()=>setListaAberta(false)}>
                <PanelLeftClose size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-2">
              {loading && <div className="flex justify-center p-8"><Spin/></div>}
              {!loading && projects.length === 0 && (
                <div className="empty-state">
                  <p className="text-[var(--text-muted)] text-xs text-center">{vazioLista}</p>
                  {modo === "ativos" && podeCriarProjetos && <button className="btn btn-violet text-xs" onClick={()=>setModalNew(true)}>Criar projeto</button>}
                  {modo === "concluidos" && <p className="text-[var(--text-muted)] text-[11px] text-center leading-relaxed">O projeto chega aqui quando todas as tarefas estão em Concluída.</p>}
                </div>
              )}
              {projects.map(p => (
                <button key={p.id} type="button" onClick={()=>abrir(p.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id===p.id ? "border-[var(--accent-violet)] bg-[var(--accent-violet-dim)] shadow-[0_0_15px_rgba(124,58,237,0.1)]" : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-medium)] hover:shadow-premium-sm"}`}
                >
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background:p.cor }} />
                    <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate flex-1" title={p.titulo}>{p.titulo}</span>
                  </div>
                  {modo === "ativos" ? (
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-2.5">
                      <span className="badge" style={{ fontSize:10, background:STATUS_COLORS[p.status]+"15", color:STATUS_COLORS[p.status], border:`1px solid ${STATUS_COLORS[p.status]}30` }}>{STATUS_LABELS[p.status]||p.status}</span>
                      <span className="badge" style={{ fontSize:10, background:PRIO_COLORS[p.prioridade]+"15", color:PRIO_COLORS[p.prioridade], border:`1px solid ${PRIO_COLORS[p.prioridade]}30` }}>{p.prioridade}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mb-2.5 text-[11px] font-medium text-[var(--accent-green)]">
                      <CheckCircle2 size={12} className="shrink-0" />
                      <span className="truncate">Concluído {p.concluidoEm ? `em ${dataBR(p.concluidoEm)}` : ""}</span>
                    </div>
                  )}
                  <div className="h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ background:p.cor, width:p.progressoPct+"%" }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-[var(--text-muted)]">{p.tasksConcluidas||0}/{p.totalTasks||0} tarefas</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.progressoPct}%</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        <section className="flex-1 min-w-0 overflow-y-auto bg-[var(--bg-primary)]">
          <div className="p-4 xl:p-6 flex flex-col gap-4 min-w-0">
            {!listaAberta && (
              <button className="btn btn-ghost self-start" style={{ fontSize:12 }} onClick={()=>setListaAberta(true)}>
                <PanelLeftOpen size={14} /> {modo === "ativos" ? "Lista de projetos" : "Lista de concluídos"}
              </button>
            )}

            {aviso && (
              <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${aviso.tipo === "concluido" ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                {aviso.tipo === "concluido"
                  ? <PartyPopper size={16} className="shrink-0 text-[var(--accent-green)]" />
                  : <History size={16} className="shrink-0 text-[var(--accent-amber)]" />}
                <span className="flex-1 min-w-[220px] text-[13px] text-[var(--text-primary)]">
                  {aviso.tipo === "concluido"
                    ? <>“{aviso.titulo}” chegou a 100% e saiu da fila. Agora está em <strong>Projetos Concluídos</strong>.</>
                    : <>“{aviso.titulo}” foi reaberto e voltou para a <strong>fila de projetos</strong>.</>}
                </span>
                <Link href={aviso.tipo === "concluido" ? "/dashboard/projetos/concluidos" : "/dashboard/projetos"} className="btn btn-ghost" style={{ fontSize:12, padding:"4px 12px" }}>
                  {aviso.tipo === "concluido" ? "Ver concluídos" : "Ver na fila"}
                </Link>
                <button className="btn-icon" style={{ width:26, height:26 }} aria-label="Fechar aviso" onClick={()=>setAviso(null)}><X size={13} /></button>
              </div>
            )}

            {!selected ? (
              <div className="empty-state mt-16">
                <div className="empty-state-icon">
                  {modo === "ativos"
                    ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round"/></svg>
                    : <CheckCircle2 size={24} strokeWidth={1.5} />}
                </div>
                <p className="text-[var(--text-primary)] font-medium text-base">{modo === "ativos" ? "Selecione um projeto" : "Selecione um projeto concluído"}</p>
                <p className="text-[var(--text-muted)] text-sm text-center max-w-sm">
                  {modo === "ativos" ? "ou crie um novo para começar" : "Aqui ficam os projetos que chegaram a 100%. O quadro, o Keep e o histórico continuam disponíveis."}
                </p>
              </div>
            ) : (
              <>
                <header className="card-premium p-4 xl:p-5 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-[320px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background:selected.cor, boxShadow:`0 0 10px ${selected.cor}80` }} />
                        <h2 className="font-display text-xl xl:text-2xl font-bold text-[var(--text-primary)] tracking-tight break-words min-w-0">{selected.titulo}</h2>
                      </div>
                      {selected.descricao && <p className="text-[13px] text-[var(--text-secondary)] mt-1 ml-[22px] max-w-3xl break-words">{selected.descricao}</p>}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 ml-[22px] text-xs font-medium text-[var(--text-muted)]">
                        <span>{selected.members?.length||0} membros</span>
                        <span className="text-[var(--border-medium)]">•</span>
                        <span>{selected.progressoPct}% concluído</span>
                        {selected.dataFim && (
                          <>
                            <span className="text-[var(--border-medium)]">•</span>
                            <span className={!selected.concluido && new Date(selected.dataFim) < new Date() ? "text-[var(--accent-red)]" : ""}>Prazo: {dataBR(selected.dataFim)}</span>
                          </>
                        )}
                        {selected.concluido && (
                          <>
                            <span className="text-[var(--border-medium)]">•</span>
                            <span className="inline-flex items-center gap-1 text-[var(--accent-green)]"><CheckCircle2 size={12} /> Concluído{selected.concluidoEm ? ` em ${dataBR(selected.concluidoEm)}` : ""}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex mr-1">
                        {selected.members?.slice(0,4).map((m,i)=>(
                          <div key={m.user.id} className="relative ring-2 ring-[var(--bg-card)] rounded-full" style={{ marginLeft:i>0?-8:0, zIndex:4-i }}><Avatar nome={m.user.nome} size={30} /></div>
                        ))}
                        {(selected.members?.length ?? 0) > 4 && (
                          <div className="relative ring-2 ring-[var(--bg-card)] rounded-full w-[30px] h-[30px] -ml-2 bg-[var(--bg-hover)] text-[10px] font-bold text-[var(--text-muted)] flex items-center justify-center">+{selected.members.length - 4}</div>
                        )}
                      </div>
                      <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={()=>setHistoricoAberto(true)}><History size={13} /> Histórico</button>
                      {podeEditarProjetos && <button className="btn btn-ghost text-xs py-1.5 px-3" onClick={()=>setModalEdit(selected)}>Editar</button>}
                      {podeRemoverSelecionado && <button className="btn btn-danger text-xs py-1.5 px-3" onClick={()=>setDeleteId(selected.id)}>Remover</button>}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Progresso</span>
                      <span className="text-xs font-mono font-bold" style={{ color:selected.cor }}>{selected.progressoPct}%</span>
                    </div>
                    <div className="h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ background:selected.cor, width:selected.progressoPct+"%" }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      <span>{concluidas} concluídas</span>
                      <span>{selected.tasks.length} total</span>
                    </div>
                  </div>
                </header>

                {modo === "concluidos" && selected.concluido && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-2.5 text-[12px] text-[var(--text-secondary)]">
                    Projeto concluído. Se uma tarefa sair de <strong>Concluída</strong> ou uma nova tarefa for criada, ele volta para a fila de projetos.
                  </div>
                )}

                <AnexosProjeto projectId={selected.id} podeEditar={podeEditarProjetos} />

                {!selected.podeMoverStatus && (
                  <div className="text-[12px] text-[var(--text-muted)] bg-[var(--bg-hover)] border border-dashed border-[var(--border-subtle)] rounded-lg px-3 py-2">
                    Só quem faz parte do projeto move as tarefas no quadro. Você pode acompanhar, abrir o Keep e o histórico.
                  </div>
                )}

                <KanbanBoard
                  project={selected}
                  podeMover={!!selected.podeMoverStatus}
                  podeEditar={podeEditarProjetos}
                  onMoveTask={handleMove}
                  onNewTask={(status)=>setTaskModal({status})}
                  onEditTask={(task)=>setTaskModal({status:task.status,task})}
                  onDeleteTask={handleDeleteTask}
                  onDetailTask={(task, aba = "detalhes")=>{ setDetailAba(aba); setDetailTask(task); }}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {modalNew && <ProjectModal users={users} onClose={()=>setModalNew(false)} onSave={load} />}
      {modalEdit && (
        <ProjectModal project={modalEdit} users={users} onClose={()=>setModalEdit(null)}
          onSave={()=>{ load(); if (selected) abrir(selected.id); setModalEdit(null); }} />
      )}
      {taskModal && selected && (
        <TaskModal projectId={selected.id} task={taskModal.task} members={selected.members||[]} onClose={()=>setTaskModal(null)}
          onSave={()=>{ const anterior = selected; setTaskModal(null); aposMudanca(anterior); }} />
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
      {historicoAberto && selected && (
        <Modal title={`Histórico — ${selected.titulo}`} wide onClose={()=>setHistoricoAberto(false)}>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <HistoricoProjeto projectId={selected.id} versao={historicoVersao} />
          </div>
        </Modal>
      )}
      {detailTask && selected && (
        <TaskDetailModal key={detailTask.id + detailAba} projectId={selected.id} task={detailTask} abaInicial={detailAba}
          onClose={()=>setDetailTask(null)} onUpdate={()=>aposMudanca(selected)} />
      )}
    </div>
  );
}
