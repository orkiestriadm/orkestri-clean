"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import TaskComments from "./TaskComments";

type Task = { id: string; titulo: string; descricao?: string; status: string; prioridade: string; dataVencimento?: string; assignee?: { id: string; nome: string }; };

const PRIO_COLORS: Record<string,string> = { BAIXA:"var(--accent-green)", MEDIA:"var(--accent-cyan)", ALTA:"var(--accent-amber)", CRITICA:"var(--accent-red)" };
const STATUS_LABELS: Record<string,string> = { A_FAZER:"A Fazer", EM_ANDAMENTO:"Em Andamento", REVISAO:"Revisao", BLOQUEADA:"Bloqueada", CONCLUIDA:"Concluida" };

export default function TaskDetailModal({ projectId, task, onClose, onUpdate }: {
  projectId: string;
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [tab, setTab] = useState<"detalhes"|"comentarios">("detalhes");

  return (
    <div className="modal-overlay" onClick={e=>{ if((e.target as HTMLElement).classList.contains("modal-overlay"))onClose(); }}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:560, maxHeight:"80vh", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>{task.titulo}</h3>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <span className="badge" style={{ fontSize:10, background:PRIO_COLORS[task.prioridade]+"15", color:PRIO_COLORS[task.prioridade], border:`1px solid ${PRIO_COLORS[task.prioridade]}30` }}>{task.prioridade}</span>
              <span className="badge badge-violet" style={{ fontSize:10 }}>{STATUS_LABELS[task.status]||task.status}</span>
              {task.dataVencimento && (
                <span className="badge" style={{ fontSize:10, color:"var(--text-muted)", background:"var(--bg-hover)", border:"1px solid var(--border-subtle)" }}>
                  {new Date(task.dataVencimento).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, borderBottom:"1px solid var(--border-subtle)", marginBottom:16 }}>
          {(["detalhes","comentarios"] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{ padding:"8px 16px", background:"none", border:"none", borderBottom:tab===t?"2px solid var(--accent-violet)":"2px solid transparent", color:tab===t?"var(--accent-violet)":"var(--text-muted)", cursor:"pointer", fontFamily:"var(--font-display)", fontSize:13, fontWeight:tab===t?600:400, marginBottom:-1, textTransform:"capitalize" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Conteudo */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {tab === "detalhes" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {task.descricao && (
                <div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:6 }}>DESCRICAO</div>
                  <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6 }}>{task.descricao}</div>
                </div>
              )}
              {task.assignee && (
                <div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:6 }}>RESPONSAVEL</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--accent-violet)" }}>{task.assignee.nome.charAt(0)}</div>
                    <span style={{ fontSize:13 }}>{task.assignee.nome}</span>
                  </div>
                </div>
              )}
              {!task.descricao && !task.assignee && (
                <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text-muted)", fontSize:13 }}>Sem detalhes adicionais</div>
              )}
            </div>
          )}
          {tab === "comentarios" && (
            <TaskComments projectId={projectId} taskId={task.id} />
          )}
        </div>
      </div>
    </div>
  );
}